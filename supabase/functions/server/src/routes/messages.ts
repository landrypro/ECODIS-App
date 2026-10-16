import { Hono } from "npm:hono";
import { BUCKET_NAME, STORAGE_MAX_UPLOAD_SIZE_MB, VIDEO_COMPRESSION_ENABLED } from "../config.ts";
import { getAppConfig } from "../lib/app-config.ts";
import { canEditContent, requireAdmin, requirePermission } from "../lib/auth.ts";
import { handleApiError, ValidationError } from "../lib/errors.ts";
import { assertMessageCanBeDeleted, assertMessageExists, attachSignedMediaUrl, buildPendingMediaPath, finalizeDirectMediaUpload, fetchSeriesIdsForMessage, removeMediaFile, syncSeriesModuleCounts } from "../lib/messages.ts";
import { mapMessage as toMessage } from "../lib/mappers.ts";
import { supabaseAdmin } from "../lib/supabase.ts";
import { normalizeStringArray, validateBoolean, validateMediaUploadMetadata, validateMessageType, validateOptionalString, validateRequiredString } from "../lib/validation.ts";
import { logAudit } from "../lib/audit.ts";
import { buildEditorialTransition, validateEditorialStatus } from "../domain/editorial.ts";

export const messagesRoutes = new Hono();

function uploadCapabilities(maxUploadSizeMb: number) {
  const effectiveMaxUploadSizeMb = Math.min(maxUploadSizeMb, STORAGE_MAX_UPLOAD_SIZE_MB);
  return {
    limits: {
      effectiveMaxBytes: effectiveMaxUploadSizeMb * 1024 * 1024,
      appMaxBytes: maxUploadSizeMb * 1024 * 1024,
      storageMaxBytes: STORAGE_MAX_UPLOAD_SIZE_MB * 1024 * 1024,
      allowOriginalUpload: effectiveMaxUploadSizeMb >= maxUploadSizeMb,
    },
    features: { videoCompression: VIDEO_COMPRESSION_ENABLED },
  };
}

messagesRoutes.get("/messages/media-upload-capabilities", async (c) => {
  try {
    const { user, error: authError } = await requirePermission(c.req.raw, "content_create_own");
    if (authError) return c.json({ error: authError }, user ? 403 : 401);
    const config = await getAppConfig();
    return c.json(uploadCapabilities(config.maxUploadSizeMb));
  } catch (error) {
    return handleApiError(c, error, "Get media upload capabilities error");
  }
});

messagesRoutes.post("/messages/media-upload-url", async (c) => {
  try {
    const { user, error: authError } = await requirePermission(c.req.raw, "content_create_own");
    if (authError) return c.json({ error: authError }, user ? 403 : 401);

    const body = await c.req.json();
    const type = validateMessageType(body.type);
    if (type === "text") throw new ValidationError("Les contenus texte ne necessitent pas de fichier media");
    const config = await getAppConfig();
    const capabilities = uploadCapabilities(config.maxUploadSizeMb);
    validateMediaUploadMetadata(type, body.fileName, body.contentType, body.size, capabilities.limits.effectiveMaxBytes / (1024 * 1024));

    const path = buildPendingMediaPath(type, user!.id, crypto.randomUUID(), body.fileName);
    const { data, error } = await supabaseAdmin().storage.from(BUCKET_NAME).createSignedUploadUrl(path);
    if (error || !data?.token) throw error ?? new Error("L'URL d'upload n'a pas pu etre creee");
    return c.json({ upload: { bucket: BUCKET_NAME, path, token: data.token }, ...capabilities });
  } catch (error) {
    return handleApiError(c, error, "Create media upload URL error");
  }
});

messagesRoutes.get("/messages", async (c) => {
  try {
    const type = c.req.query("type");
    const admin = supabaseAdmin();
    let query = admin.from("messages").select("*").eq("status", "published").order("published_at", { ascending: false });
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

messagesRoutes.get("/admin/messages", async (c) => {
  try {
    const { user, error: authError } = await requireAdmin(c.req.raw);
    if (authError) return c.json({ error: authError }, user ? 403 : 401);
    const { data, error } = await supabaseAdmin().from("messages").select("*").order("updated_at", { ascending: false });
    if (error) throw error;
    return c.json({ messages: (data ?? []).map(toMessage) });
  } catch (error) {
    return handleApiError(c, error, "List admin messages error");
  }
});

messagesRoutes.get("/messages/:id", async (c) => {
  try {
    const row = await assertMessageExists(c.req.param("id"));
    if (row.status !== "published") {
      const { user, authorization, error: authError } = await requirePermission(c.req.raw, "content_edit_own");
      if (authError) return c.json({ error: authError }, user ? 403 : 401);
      if (!canEditContent(authorization!, row.user_id, user!.id)) return c.json({ error: "Forbidden: content owner required" }, 403);
    }
    const message = await attachSignedMediaUrl(toMessage(row));
    return c.json({ message });
  } catch (error) {
    return handleApiError(c, error, "Get message error");
  }
});

messagesRoutes.post("/messages", async (c) => {
  try {
    const { user, error: authError } = await requirePermission(c.req.raw, "content_create_own");
    if (authError) return c.json({ error: authError }, user ? 403 : 401);

    const formData = await c.req.formData();
    const title = validateRequiredString(formData.get("title"), "Titre", 2, 160);
    const type = validateMessageType(formData.get("type"));
    const author = validateRequiredString(formData.get("author"), "Auteur", 2, 120);
    const category = validateRequiredString(formData.get("category"), "Categorie", 2, 80);
    const description = validateOptionalString(formData.get("description"), "Description", 2000);
    const duration = validateOptionalString(formData.get("duration"), "Duree", 50);
    const thumbnail = validateOptionalString(formData.get("thumbnail"), "Miniature", 2048);
    if (formData.get("media") instanceof File) {
      throw new ValidationError("Le fichier media doit etre charge directement avant de creer le brouillon", 413);
    }

    const id = crypto.randomUUID();
    const mediaPath = await finalizeDirectMediaUpload(type, formData.get("mediaPath"), id, user!.id);
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
      status: "draft",
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

messagesRoutes.post("/messages/:id/transitions", async (c) => {
  try {
    const id = c.req.param("id");
    const existing = await assertMessageExists(id);
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
    const { data, error } = await supabaseAdmin().from("messages").update(payload).eq("id", id).select("*").single();
    if (error) throw error;

    await logAudit(user!.id, user!.email || "", "transition_message", `Message "${existing.title}" : ${existing.status} vers ${nextStatus}`, {
      messageId: id,
      previousStatus: existing.status,
      nextStatus,
      scheduledAt: payload.scheduled_at ?? null,
    });
    return c.json({ message: toMessage(data) });
  } catch (error) {
    return handleApiError(c, error, "Transition message error");
  }
});

messagesRoutes.put("/messages/:id", async (c) => {
  try {
    const { user, authorization, error: authError } = await requirePermission(c.req.raw, "content_edit_own");
    if (authError) return c.json({ error: authError }, user ? 403 : 401);

    const id = c.req.param("id");
    const existing = await assertMessageExists(id);
    if (!canEditContent(authorization!, existing.user_id, user!.id)) return c.json({ error: "Forbidden: content owner required" }, 403);
    const body = await c.req.json();
    const payload = {
      ...(body.title !== undefined ? { title: validateRequiredString(body.title, "Titre", 2, 160) } : {}),
      ...(body.type !== undefined ? { type: validateMessageType(body.type) } : {}),
      ...(body.author !== undefined ? { author: validateRequiredString(body.author, "Auteur", 2, 120) } : {}),
      ...(body.category !== undefined ? { category: validateRequiredString(body.category, "Categorie", 2, 80) } : {}),
      ...(body.description !== undefined ? { description: validateOptionalString(body.description, "Description", 2000) } : {}),
      ...(body.duration !== undefined ? { duration: validateOptionalString(body.duration, "Duree", 50) } : {}),
      ...(body.thumbnail !== undefined ? { thumbnail: validateOptionalString(body.thumbnail, "Miniature", 2048) } : {}),
      ...(body.offlineDownloadable !== undefined ? { offline_downloadable: validateBoolean(body.offlineDownloadable, "offlineDownloadable") } : {}),
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
    const { user, authorization, error: authError } = await requirePermission(c.req.raw, "content_edit_own");
    if (authError) return c.json({ error: authError }, user ? 403 : 401);

    const id = c.req.param("id");
    const existing = await assertMessageExists(id);
    if (!canEditContent(authorization!, existing.user_id, user!.id)) return c.json({ error: "Forbidden: content owner required" }, 403);
    if (existing.status !== "draft") {
      throw new ValidationError("Seuls les brouillons peuvent etre supprimes. Archivez le contenu publie.", 409);
    }
    await assertMessageCanBeDeleted(id);
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
