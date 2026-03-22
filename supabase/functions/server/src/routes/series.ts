import { Hono } from "npm:hono";
import { requireAdmin } from "../lib/auth.ts";
import { handleApiError, ValidationError } from "../lib/errors.ts";
import { assertMessageExists, fetchMessagesByIds, syncSeriesModuleCounts } from "../lib/messages.ts";
import { mapSeries } from "../lib/mappers.ts";
import { getUser, supabaseAdmin } from "../lib/supabase.ts";
import { normalizeStringArray, validateOptionalString, validateRequiredString } from "../lib/validation.ts";

export const seriesRoutes = new Hono();

async function getSeriesMessageIds(seriesId: string) {
  const { data, error } = await supabaseAdmin()
    .from("series_messages")
    .select("message_id, sort_order")
    .eq("series_id", seriesId)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row: any) => row.message_id);
}

async function assertSeriesExists(seriesId: string) {
  const { data, error } = await supabaseAdmin().from("series").select("*").eq("id", seriesId).maybeSingle();
  if (error) throw error;
  if (!data) throw new ValidationError("Series not found", 404);
  return data;
}

async function validateMessageIds(messageIds: string[]) {
  for (const messageId of messageIds) {
    await assertMessageExists(messageId);
  }
}

async function buildProgress(userId: string, seriesId: string) {
  const { data, error } = await supabaseAdmin()
    .from("series_progress")
    .select("message_id, last_accessed_at")
    .eq("user_id", userId)
    .eq("series_id", seriesId);
  if (error) throw error;
  const completedMessageIds = (data ?? []).map((row: any) => row.message_id);
  const lastAccessedAt = (data ?? []).map((row: any) => row.last_accessed_at).filter(Boolean).sort().at(-1) ?? null;
  return { userId, seriesId, completedMessageIds, lastAccessedAt };
}

seriesRoutes.get("/series", async (c) => {
  try {
    const { data, error } = await supabaseAdmin().from("series").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    const allSeries = [];
    for (const row of data ?? []) {
      const messageIds = await getSeriesMessageIds(row.id);
      allSeries.push(mapSeries(row, messageIds));
    }
    return c.json({ series: allSeries });
  } catch (error) {
    return handleApiError(c, error, "List series error");
  }
});

seriesRoutes.get("/series/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const row = await assertSeriesExists(id);
    const messageIds = await getSeriesMessageIds(id);
    const messages = await fetchMessagesByIds(messageIds);
    return c.json({ series: mapSeries(row, messageIds), messages });
  } catch (error) {
    return handleApiError(c, error, "Get series error");
  }
});

seriesRoutes.post("/series", async (c) => {
  try {
    const { user, error: authError } = await requireAdmin(c.req.raw);
    if (authError) return c.json({ error: authError }, user ? 403 : 401);

    const body = await c.req.json();
    const title = validateRequiredString(body.title, "Titre", 2, 160);
    const description = validateOptionalString(body.description, "Description", 2000);
    const coverImage = validateOptionalString(body.coverImage, "Image de couverture", 2048);
    const author = validateOptionalString(body.author, "Auteur", 120);
    const category = validateOptionalString(body.category, "Categorie", 80);
    const messageIds = normalizeStringArray(body.messageIds, "messageIds");
    await validateMessageIds(messageIds);

    const admin = supabaseAdmin();
    const now = new Date().toISOString();
    const { data: seriesRow, error } = await admin.from("series").insert({
      title,
      description,
      cover_image: coverImage,
      author,
      category,
      total_modules: messageIds.length,
      created_at: now,
      updated_at: now,
    }).select("*").single();
    if (error) throw error;

    if (messageIds.length > 0) {
      await admin.from("series_messages").insert(
        messageIds.map((messageId, index) => ({ series_id: seriesRow.id, message_id: messageId, sort_order: index + 1 })),
      );
    }
    await syncSeriesModuleCounts([seriesRow.id]);
    return c.json({ series: mapSeries(seriesRow, messageIds) });
  } catch (error) {
    return handleApiError(c, error, "Create series error");
  }
});

seriesRoutes.put("/series/:id", async (c) => {
  try {
    const { user, error: authError } = await requireAdmin(c.req.raw);
    if (authError) return c.json({ error: authError }, user ? 403 : 401);

    const id = c.req.param("id");
    const existing = await assertSeriesExists(id);
    const currentMessageIds = await getSeriesMessageIds(id);
    const body = await c.req.json();
    const messageIds = body.messageIds ? normalizeStringArray(body.messageIds, "messageIds") : currentMessageIds;
    await validateMessageIds(messageIds);

    const payload = {
      ...(body.title !== undefined ? { title: validateRequiredString(body.title, "Titre", 2, 160) } : {}),
      ...(body.description !== undefined ? { description: validateOptionalString(body.description, "Description", 2000) } : {}),
      ...(body.coverImage !== undefined ? { cover_image: validateOptionalString(body.coverImage, "Image de couverture", 2048) } : {}),
      ...(body.author !== undefined ? { author: validateOptionalString(body.author, "Auteur", 120) } : {}),
      ...(body.category !== undefined ? { category: validateOptionalString(body.category, "Categorie", 80) } : {}),
      updated_at: new Date().toISOString(),
    };

    const admin = supabaseAdmin();
    const { data: updatedRow, error } = await admin.from("series").update(payload).eq("id", id).select("*").single();
    if (error) throw error;

    if (body.messageIds) {
      await admin.from("series_messages").delete().eq("series_id", id);
      if (messageIds.length > 0) {
        await admin.from("series_messages").insert(
          messageIds.map((messageId, index) => ({ series_id: id, message_id: messageId, sort_order: index + 1 })),
        );
      }
    }

    await syncSeriesModuleCounts([id]);
    return c.json({ series: mapSeries(updatedRow, messageIds) });
  } catch (error) {
    return handleApiError(c, error, "Update series error");
  }
});

seriesRoutes.delete("/series/:id", async (c) => {
  try {
    const { user, error: authError } = await requireAdmin(c.req.raw);
    if (authError) return c.json({ error: authError }, user ? 403 : 401);
    const id = c.req.param("id");
    await assertSeriesExists(id);
    const { error } = await supabaseAdmin().from("series").delete().eq("id", id);
    if (error) throw error;
    return c.json({ success: true });
  } catch (error) {
    return handleApiError(c, error, "Delete series error");
  }
});

seriesRoutes.get("/series/:id/progress", async (c) => {
  try {
    const user = await getUser(c.req.raw);
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    const seriesId = c.req.param("id");
    await assertSeriesExists(seriesId);
    return c.json({ progress: await buildProgress(user.id, seriesId) });
  } catch (error) {
    return handleApiError(c, error, "Get series progress error");
  }
});

seriesRoutes.post("/series/:id/progress", async (c) => {
  try {
    const user = await getUser(c.req.raw);
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const seriesId = c.req.param("id");
    const { messageId } = await c.req.json();
    const validatedMessageId = validateRequiredString(messageId, "messageId", 1, 255);
    await assertMessageExists(validatedMessageId);

    const { data: relation } = await supabaseAdmin()
      .from("series_messages")
      .select("message_id")
      .eq("series_id", seriesId)
      .eq("message_id", validatedMessageId)
      .maybeSingle();
    if (!relation) {
      throw new ValidationError("Le message ne fait pas partie de cette serie");
    }

    const now = new Date().toISOString();
    await supabaseAdmin().from("series_progress").upsert({
      user_id: user.id,
      series_id: seriesId,
      message_id: validatedMessageId,
      completed_at: now,
      last_accessed_at: now,
    });

    return c.json({ progress: await buildProgress(user.id, seriesId) });
  } catch (error) {
    return handleApiError(c, error, "Update series progress error");
  }
});

seriesRoutes.get("/series-progress", async (c) => {
  try {
    const user = await getUser(c.req.raw);
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const { data, error } = await supabaseAdmin().from("series_progress").select("series_id, message_id, last_accessed_at").eq("user_id", user.id);
    if (error) throw error;

    const progressMap: Record<string, { userId: string; seriesId: string; completedMessageIds: string[]; lastAccessedAt: string | null }> = {};
    for (const row of data ?? []) {
      if (!progressMap[row.series_id]) {
        progressMap[row.series_id] = { userId: user.id, seriesId: row.series_id, completedMessageIds: [], lastAccessedAt: null };
      }
      progressMap[row.series_id].completedMessageIds.push(row.message_id);
      if (!progressMap[row.series_id].lastAccessedAt || (row.last_accessed_at && row.last_accessed_at > progressMap[row.series_id].lastAccessedAt!)) {
        progressMap[row.series_id].lastAccessedAt = row.last_accessed_at;
      }
    }

    return c.json({ progress: progressMap });
  } catch (error) {
    return handleApiError(c, error, "Get all series progress error");
  }
});

seriesRoutes.get("/messages/:id/series", async (c) => {
  try {
    const messageId = c.req.param("id");
    const { data, error } = await supabaseAdmin()
      .from("series_messages")
      .select("series_id, sort_order")
      .eq("message_id", messageId)
      .order("sort_order", { ascending: true });
    if (error) throw error;
    const seriesIds = [...new Set((data ?? []).map((row: any) => row.series_id))];
    if (seriesIds.length === 0) return c.json({ series: [] });
    const { data: seriesRows, error: seriesError } = await supabaseAdmin().from("series").select("*").in("id", seriesIds);
    if (seriesError) throw seriesError;
    const series = [];
    for (const row of seriesRows ?? []) {
      series.push(mapSeries(row, await getSeriesMessageIds(row.id)));
    }
    return c.json({ series });
  } catch (error) {
    return handleApiError(c, error, "Get message series error");
  }
});
