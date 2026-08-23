import { Hono } from "npm:hono";
import { canEditContent, requireAdmin, requirePermission } from "../lib/auth.ts";
import { handleApiError, ValidationError } from "../lib/errors.ts";
import { assertMessageExists, assertPublishedMessage, fetchMessagesByIds, syncSeriesModuleCounts } from "../lib/messages.ts";
import { mapModuleProgress, mapSeries } from "../lib/mappers.ts";
import { getUser, supabaseAdmin } from "../lib/supabase.ts";
import { normalizeStringArray, validateOptionalString, validateRequiredString } from "../lib/validation.ts";
import { buildEditorialTransition, validateEditorialStatus } from "../domain/editorial.ts";
import { logAudit } from "../lib/audit.ts";
import { normalizeProgressEvent, type ProgressEventInput } from "../domain/progress.ts";

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

async function assertPublishedSeries(seriesId: string) {
  const series = await assertSeriesExists(seriesId);
  if (series.status !== "published") {
    throw new ValidationError("Serie non disponible", 404);
  }
  return series;
}

async function assertSeriesCanBeDeleted(seriesId: string) {
  const { count, error } = await supabaseAdmin()
    .from("series_progress")
    .select("series_id", { count: "exact", head: true })
    .eq("series_id", seriesId);
  if (error) throw error;
  if ((count ?? 0) > 0) {
    throw new ValidationError("Cette serie contient une progression utilisateur et doit etre archivee", 409);
  }
}

async function validateMessageIds(messageIds: string[]) {
  for (const messageId of messageIds) {
    await assertMessageExists(messageId);
  }
}

function formatProgress(userId: string, seriesId: string, activeMessageIds: string[], rows: any[]) {
  const activeSet = new Set(activeMessageIds);
  const activeRows = rows.filter((row: any) => activeSet.has(row.message_id));
  const modules = Object.fromEntries(activeRows.map((row: any) => [row.message_id, mapModuleProgress(row)]));
  const completedMessageIds = activeRows.filter((row: any) => row.state === "completed").map((row: any) => row.message_id);
  const lastAccessedAt = rows.map((row: any) => row.last_accessed_at).filter(Boolean).sort().at(-1) ?? null;
  const totalModules = activeMessageIds.length;
  const progressPercent = totalModules > 0 ? Math.round((completedMessageIds.length / totalModules) * 100) : 0;
  const nextMessageId = activeMessageIds.find((messageId) => !completedMessageIds.includes(messageId)) ?? null;
  return {
    userId,
    seriesId,
    modules,
    completedMessageIds,
    totalModules,
    progressPercent,
    nextMessageId,
    isCompleted: totalModules > 0 && completedMessageIds.length === totalModules,
    lastAccessedAt,
  };
}

async function buildProgress(userId: string, seriesId: string) {
  const admin = supabaseAdmin();
  const messageIds = await getSeriesMessageIds(seriesId);
  const { data: publishedMessages, error: messagesError } = messageIds.length === 0
    ? { data: [], error: null }
    : await admin.from("messages").select("id").in("id", messageIds).eq("status", "published");
  if (messagesError) throw messagesError;
  const publishedSet = new Set((publishedMessages ?? []).map((row: any) => row.id));
  const activeMessageIds = messageIds.filter((messageId) => publishedSet.has(messageId));
  const { data, error } = await admin
    .from("series_progress")
    .select("*")
    .eq("user_id", userId)
    .eq("series_id", seriesId);
  if (error) throw error;
  return formatProgress(userId, seriesId, activeMessageIds, data ?? []);
}

async function applyProgressEvent(user: any, seriesId: string, messageId: string, event: ProgressEventInput) {
  await assertPublishedSeries(seriesId);
  const message = await assertPublishedMessage(messageId);
  const { data: relation, error: relationError } = await supabaseAdmin()
    .from("series_messages")
    .select("message_id")
    .eq("series_id", seriesId)
    .eq("message_id", messageId)
    .maybeSingle();
  if (relationError) throw relationError;
  if (!relation) throw new ValidationError("Le message ne fait pas partie de cette série");
  if (message.type === "text" && (event.positionSeconds !== 0 || event.durationSeconds !== 0)) {
    throw new ValidationError("Un texte ne possède pas de position de lecture");
  }

  const { data, error } = await supabaseAdmin().rpc("apply_progress_event", {
    p_event_id: event.eventId,
    p_user_id: user.id,
    p_series_id: seriesId,
    p_message_id: messageId,
    p_state: event.state,
    p_progress_percent: event.progressPercent,
    p_position_seconds: event.positionSeconds,
    p_duration_seconds: event.durationSeconds,
    p_client_updated_at: event.clientUpdatedAt,
    p_source: event.source,
  });
  if (error) {
    if (error.message?.includes("PROGRESS_EVENT_ID_CONFLICT")) {
      throw new ValidationError("Cet eventId est déjà associé à une autre progression", 409);
    }
    if (error.message?.includes("PROGRESS_CONTENT_NOT_AVAILABLE")) {
      throw new ValidationError("Contenu de progression non disponible", 404);
    }
    throw error;
  }
  return { ...(data ?? {}), progress: await buildProgress(user.id, seriesId) };
}

seriesRoutes.get("/series", async (c) => {
  try {
    const { data, error } = await supabaseAdmin().from("series").select("*").eq("status", "published").order("published_at", { ascending: false });
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

seriesRoutes.get("/admin/series", async (c) => {
  try {
    const { user, error: authError } = await requireAdmin(c.req.raw);
    if (authError) return c.json({ error: authError }, user ? 403 : 401);
    const { data, error } = await supabaseAdmin().from("series").select("*").order("updated_at", { ascending: false });
    if (error) throw error;
    const allSeries = [];
    for (const row of data ?? []) allSeries.push(mapSeries(row, await getSeriesMessageIds(row.id)));
    return c.json({ series: allSeries });
  } catch (error) {
    return handleApiError(c, error, "List admin series error");
  }
});

seriesRoutes.get("/series/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const row = await assertSeriesExists(id);
    if (row.status !== "published") {
      const { user, authorization, error: authError } = await requirePermission(c.req.raw, "content_edit_own");
      if (authError) return c.json({ error: authError }, user ? 403 : 401);
      if (!canEditContent(authorization!, row.user_id, user!.id)) return c.json({ error: "Forbidden: content owner required" }, 403);
    }
    const messageIds = await getSeriesMessageIds(id);
    const messages = await fetchMessagesByIds(messageIds, row.status === "published");
    return c.json({ series: mapSeries(row, messageIds), messages });
  } catch (error) {
    return handleApiError(c, error, "Get series error");
  }
});

seriesRoutes.post("/series", async (c) => {
  try {
    const { user, error: authError } = await requirePermission(c.req.raw, "content_create_own");
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
      status: "draft",
      user_id: user!.id,
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
    await logAudit(user!.id, user!.email || "", "create_series", `Serie \"${title}\" creee`, { seriesId: seriesRow.id });
    return c.json({ series: mapSeries(seriesRow, messageIds) });
  } catch (error) {
    return handleApiError(c, error, "Create series error");
  }
});

seriesRoutes.post("/series/:id/transitions", async (c) => {
  try {
    const id = c.req.param("id");
    const existing = await assertSeriesExists(id);
    const body = await c.req.json();
    const nextStatus = validateEditorialStatus(body.status);
    const requiredPermission = ["scheduled", "published", "archived"].includes(nextStatus)
      ? "content_publish"
      : nextStatus === "in_review" ? "content_submit_review" : "content_edit_own";
    const { user, authorization, error: authError } = await requirePermission(c.req.raw, requiredPermission);
    if (authError) return c.json({ error: authError }, user ? 403 : 401);
    if (!canEditContent(authorization!, existing.user_id, user!.id)) return c.json({ error: "Forbidden: content owner required" }, 403);
    const payload = buildEditorialTransition(
      existing.status ?? "published",
      nextStatus,
      user!.id,
      body.scheduledAt,
      undefined,
      existing.published_at ?? null,
    );
    const { data, error } = await supabaseAdmin().from("series").update(payload).eq("id", id).select("*").single();
    if (error) throw error;

    const messageIds = await getSeriesMessageIds(id);
    await logAudit(user!.id, user!.email || "", "transition_series", `Serie "${existing.title}" : ${existing.status} vers ${nextStatus}`, {
      seriesId: id,
      previousStatus: existing.status,
      nextStatus,
      scheduledAt: payload.scheduled_at ?? null,
    });
    return c.json({ series: mapSeries(data, messageIds) });
  } catch (error) {
    return handleApiError(c, error, "Transition series error");
  }
});

seriesRoutes.put("/series/:id", async (c) => {
  try {
    const { user, authorization, error: authError } = await requirePermission(c.req.raw, "content_edit_own");
    if (authError) return c.json({ error: authError }, user ? 403 : 401);

    const id = c.req.param("id");
    const existing = await assertSeriesExists(id);
    if (!canEditContent(authorization!, existing.user_id, user!.id)) return c.json({ error: "Forbidden: content owner required" }, 403);
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
    const { user, authorization, error: authError } = await requirePermission(c.req.raw, "content_edit_own");
    if (authError) return c.json({ error: authError }, user ? 403 : 401);
    const id = c.req.param("id");
    const existing = await assertSeriesExists(id);
    if (!canEditContent(authorization!, existing.user_id, user!.id)) return c.json({ error: "Forbidden: content owner required" }, 403);
    if (existing.status !== "draft") {
      throw new ValidationError("Seuls les brouillons peuvent etre supprimes. Archivez la serie publiee.", 409);
    }
    await assertSeriesCanBeDeleted(id);
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
    await assertPublishedSeries(seriesId);
    return c.json({ progress: await buildProgress(user.id, seriesId) });
  } catch (error) {
    return handleApiError(c, error, "Get series progress error");
  }
});

seriesRoutes.put("/series/:id/progress/:messageId", async (c) => {
  try {
    const user = await getUser(c.req.raw);
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    const seriesId = c.req.param("id");
    const messageId = validateRequiredString(c.req.param("messageId"), "messageId", 1, 255);
    const event = normalizeProgressEvent(await c.req.json());
    return c.json(await applyProgressEvent(user, seriesId, messageId, event));
  } catch (error) {
    return handleApiError(c, error, "Update series progress error");
  }
});

// Compatibilité temporaire : l'ancien endpoint marque manuellement un module terminé.
seriesRoutes.post("/series/:id/progress", async (c) => {
  try {
    const user = await getUser(c.req.raw);
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    const seriesId = c.req.param("id");
    const { messageId } = await c.req.json();
    const validatedMessageId = validateRequiredString(messageId, "messageId", 1, 255);
    const event = normalizeProgressEvent({
      eventId: crypto.randomUUID(),
      state: "completed",
      progressPercent: 100,
      positionSeconds: 0,
      durationSeconds: 0,
      clientUpdatedAt: new Date().toISOString(),
      source: "manual",
    });
    const result = await applyProgressEvent(user, seriesId, validatedMessageId, event);
    return c.json({ progress: result.progress, eventId: result.eventId, replayed: result.replayed, module: result.module });
  } catch (error) {
    return handleApiError(c, error, "Complete series module error");
  }
});

seriesRoutes.get("/series-progress", async (c) => {
  try {
    const user = await getUser(c.req.raw);
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const { data, error } = await supabaseAdmin().from("series").select("id").eq("status", "published");
    if (error) throw error;
    const seriesIds = (data ?? []).map((row: any) => row.id);
    if (seriesIds.length === 0) return c.json({ progress: {} });
    const admin = supabaseAdmin();
    const [{ data: relations, error: relationsError }, { data: progressRows, error: progressError }] = await Promise.all([
      admin.from("series_messages").select("series_id, message_id, sort_order").in("series_id", seriesIds).order("sort_order", { ascending: true }),
      admin.from("series_progress").select("*").eq("user_id", user.id).in("series_id", seriesIds),
    ]);
    if (relationsError) throw relationsError;
    if (progressError) throw progressError;
    const relatedMessageIds = [...new Set((relations ?? []).map((row: any) => row.message_id))];
    const { data: publishedMessages, error: messagesError } = relatedMessageIds.length === 0
      ? { data: [], error: null }
      : await admin.from("messages").select("id").in("id", relatedMessageIds).eq("status", "published");
    if (messagesError) throw messagesError;
    const publishedSet = new Set((publishedMessages ?? []).map((row: any) => row.id));
    const progressMap = Object.fromEntries(seriesIds.map((seriesId: string) => {
      const activeMessageIds = (relations ?? [])
        .filter((row: any) => row.series_id === seriesId && publishedSet.has(row.message_id))
        .map((row: any) => row.message_id);
      const rows = (progressRows ?? []).filter((row: any) => row.series_id === seriesId);
      return [seriesId, formatProgress(user.id, seriesId, activeMessageIds, rows)];
    }));
    return c.json({ progress: progressMap });
  } catch (error) {
    return handleApiError(c, error, "Get all series progress error");
  }
});

seriesRoutes.get("/messages/:id/series", async (c) => {
  try {
    const messageId = c.req.param("id");
    await assertPublishedMessage(messageId);
    const { data, error } = await supabaseAdmin()
      .from("series_messages")
      .select("series_id, sort_order")
      .eq("message_id", messageId)
      .order("sort_order", { ascending: true });
    if (error) throw error;
    const seriesIds = [...new Set((data ?? []).map((row: any) => row.series_id))];
    if (seriesIds.length === 0) return c.json({ series: [] });
    const { data: seriesRows, error: seriesError } = await supabaseAdmin().from("series").select("*").in("id", seriesIds).eq("status", "published");
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
