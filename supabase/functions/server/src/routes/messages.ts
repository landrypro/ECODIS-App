import { Hono } from "npm:hono";
import { getAppConfig } from "../lib/app-config.ts";
import { requireAdmin } from "../lib/auth.ts";
import { handleApiError } from "../lib/errors.ts";
import { assertMessageExists, attachSignedMediaUrl, fetchSeriesIdsForMessage, removeMediaFile, syncSeriesModuleCounts, uploadMediaFile } from "../lib/messages.ts";
import { mapMessage as toMessage } from "../lib/mappers.ts";
import { supabaseAdmin } from "../lib/supabase.ts";
import { normalizeStringArray, validateFileForMessage, validateMessageType, validateOptionalString, validateRequiredString } from "../lib/validation.ts";
import { logAudit } from "../lib/audit.ts";

export const messagesRoutes = new Hono();

messagesRoutes.get("/messages", async (c) => {
  try {
    const type = c.req.query("type");
    const admin = supabaseAdmin();
    let query = admin.from("messages").select("*").order("created_at", { ascending: false });
    if (type) {
      query = query.eq("type", validateMessageType(type));
    }
    const { data, error } = await query;
    if (error) throw error;
    return c.json({ messages: (data ?? []).map(toMessage) });
  } catch (error) {
    return handleApiError(c, error, "List messages error");
  }
});

messagesRoutes.get("/messages/:id", async (c) => {
  try {
    const row = await assertMessageExists(c.req.param("id"));
    const message = await attachSignedMediaUrl(toMessage(row));
    return c.json({ message });
  } catch (error) {
    return handleApiError(c, error, "Get message error");
  }
});

messagesRoutes.post("/messages", async (c) => {
  try {
    const { user, error: authError } = await requireAdmin(c.req.raw);
    if (authError) return c.json({ error: authError }, user ? 403 : 401);

    const formData = await c.req.formData();
    const title = validateRequiredString(formData.get("title"), "Titre", 2, 160);
    const type = validateMessageType(formData.get("type"));
    const author = validateRequiredString(formData.get("author"), "Auteur", 2, 120);
    const category = validateRequiredString(formData.get("category"), "Categorie", 2, 80);
    const description = validateOptionalString(formData.get("description"), "Description", 2000);
    const duration = validateOptionalString(formData.get("duration"), "Duree", 50);
    const thumbnail = validateOptionalString(formData.get("thumbnail"), "Miniature", 2048);
    const mediaEntry = formData.get("media");
    const mediaFile = mediaEntry instanceof File ? mediaEntry : null;
    const config = await getAppConfig();
    validateFileForMessage(type, mediaFile, config.maxUploadSizeMb);

    const id = crypto.randomUUID();
    const mediaPath = await uploadMediaFile(type, mediaFile, id);
    const payload = {
      id,
      type,
      title,
      author,
      category,
      description,
      duration,
      thumbnail,
      media_path: mediaPath,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      user_id: user!.id,
    };

    const { data, error } = await supabaseAdmin().from("messages").insert(payload).select("*").single();
    if (error) throw error;

    await logAudit(user!.id, user!.email || "", "create_message", `Message "${title}" cree`, { messageId: id });
    return c.json({ message: toMessage(data) });
  } catch (error) {
    return handleApiError(c, error, "Create message error");
  }
});

messagesRoutes.put("/messages/:id", async (c) => {
  try {
    const { user, error: authError } = await requireAdmin(c.req.raw);
    if (authError) return c.json({ error: authError }, user ? 403 : 401);

    const id = c.req.param("id");
    const existing = await assertMessageExists(id);
    const body = await c.req.json();
    const payload = {
      ...(body.title !== undefined ? { title: validateRequiredString(body.title, "Titre", 2, 160) } : {}),
      ...(body.type !== undefined ? { type: validateMessageType(body.type) } : {}),
      ...(body.author !== undefined ? { author: validateRequiredString(body.author, "Auteur", 2, 120) } : {}),
      ...(body.category !== undefined ? { category: validateRequiredString(body.category, "Categorie", 2, 80) } : {}),
      ...(body.description !== undefined ? { description: validateOptionalString(body.description, "Description", 2000) } : {}),
      ...(body.duration !== undefined ? { duration: validateOptionalString(body.duration, "Duree", 50) } : {}),
      ...(body.thumbnail !== undefined ? { thumbnail: validateOptionalString(body.thumbnail, "Miniature", 2048) } : {}),
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await supabaseAdmin().from("messages").update(payload).eq("id", id).select("*").single();
    if (error) throw error;

    await logAudit(user!.id, user!.email || "", "update_message", `Message "${existing.title}" mis a jour`, { messageId: id });
    return c.json({ message: toMessage(data) });
  } catch (error) {
    return handleApiError(c, error, "Update message error");
  }
});

messagesRoutes.delete("/messages/:id", async (c) => {
  try {
    const { user, error: authError } = await requireAdmin(c.req.raw);
    if (authError) return c.json({ error: authError }, user ? 403 : 401);

    const id = c.req.param("id");
    const existing = await assertMessageExists(id);
    const relatedSeriesIds = await fetchSeriesIdsForMessage(id);

    await removeMediaFile(existing.media_path);
    const { error } = await supabaseAdmin().from("messages").delete().eq("id", id);
    if (error) throw error;
    await syncSeriesModuleCounts(relatedSeriesIds);

    await logAudit(user!.id, user!.email || "", "delete_message", `Message "${existing.title}" supprime`, { messageId: id });
    return c.json({ success: true });
  } catch (error) {
    return handleApiError(c, error, "Delete message error");
  }
});
