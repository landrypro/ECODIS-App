import { BUCKET_NAME, SIGNED_URL_TTL_SECONDS } from "../config.ts";
import { ValidationError } from "./errors.ts";
import { mapMessage } from "./mappers.ts";
import { supabaseAdmin } from "./supabase.ts";

export async function getMessageRow(id: string) {
  const { data, error } = await supabaseAdmin().from("messages").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function assertMessageExists(messageId: string) {
  const message = await getMessageRow(messageId);
  if (!message) {
    throw new ValidationError("Message introuvable", 404);
  }
  return message;
}

export async function assertPublishedMessage(messageId: string) {
  const message = await assertMessageExists(messageId);
  if (message.status !== "published") {
    throw new ValidationError("Contenu non disponible", 404);
  }
  return message;
}

export async function assertMessageCanBeDeleted(messageId: string) {
  const admin = supabaseAdmin();
  const [favorites, comments, progress, seriesLinks] = await Promise.all([
    admin.from("favorites").select("message_id", { count: "exact", head: true }).eq("message_id", messageId),
    admin.from("comments").select("message_id", { count: "exact", head: true }).eq("message_id", messageId),
    admin.from("series_progress").select("message_id", { count: "exact", head: true }).eq("message_id", messageId),
    admin.from("series_messages").select("message_id", { count: "exact", head: true }).eq("message_id", messageId),
  ]);
  for (const result of [favorites, comments, progress, seriesLinks]) {
    if (result.error) throw result.error;
  }
  if ([favorites, comments, progress, seriesLinks].some((result) => (result.count ?? 0) > 0)) {
    throw new ValidationError("Ce brouillon est lie a des interactions ou a une serie et doit etre archive", 409);
  }
}

export async function fetchMessagesByIds(messageIds: string[], publishedOnly = false) {
  if (messageIds.length === 0) return [];
  let query = supabaseAdmin().from("messages").select("*").in("id", messageIds);
  if (publishedOnly) query = query.eq("status", "published");
  const { data, error } = await query;
  if (error) throw error;
  const map = new Map((data ?? []).map((row: any) => [row.id, row]));
  return messageIds.map((id) => map.get(id)).filter(Boolean).map(mapMessage);
}

export async function uploadMediaFile(type: "audio" | "video" | "text", mediaFile: File | null, messageId: string) {
  if (!mediaFile || mediaFile.size <= 0 || type === "text") {
    return "";
  }
  const ext = mediaFile.name.split(".").pop()?.toLowerCase() || "bin";
  const mediaPath = `${type}/${messageId}.${ext}`;
  const buffer = await mediaFile.arrayBuffer();
  const { error } = await supabaseAdmin().storage.from(BUCKET_NAME).upload(mediaPath, buffer, {
    contentType: mediaFile.type,
    upsert: false,
  });
  if (error) throw error;
  return mediaPath;
}

export function buildPendingMediaPath(type: "audio" | "video", userId: string, uploadId: string, fileName: string) {
  const ext = fileName.split(".").pop()?.toLowerCase() || "bin";
  return `pending/${userId}/${type}/${uploadId}.${ext}`;
}

export async function finalizeDirectMediaUpload(type: "audio" | "video" | "text", pendingPath: unknown, messageId: string, userId: string) {
  if (type === "text") return "";
  if (typeof pendingPath !== "string") {
    throw new ValidationError("Le fichier media doit etre charge avant la creation du brouillon");
  }

  const prefix = `pending/${userId}/${type}/`;
  const fileName = pendingPath.slice(prefix.length);
  const allowedExtensions = type === "audio" ? "mp3|wav|ogg|m4a|aac" : "mp4|webm|mov";
  if (!pendingPath.startsWith(prefix) || !new RegExp(`^[0-9a-f-]{36}\\.(${allowedExtensions})$`, "i").test(fileName)) {
    throw new ValidationError("Chemin de fichier media invalide", 400);
  }

  const admin = supabaseAdmin();
  const { data: files, error: listError } = await admin.storage.from(BUCKET_NAME).list(prefix.slice(0, -1), { search: fileName });
  if (listError) throw listError;
  if (!files?.some((file: { name: string }) => file.name === fileName)) {
    throw new ValidationError("Le fichier media charge est introuvable", 404);
  }

  const mediaPath = `${type}/${messageId}.${fileName.split(".").pop()!.toLowerCase()}`;
  const { error: moveError } = await admin.storage.from(BUCKET_NAME).move(pendingPath, mediaPath);
  if (moveError) throw moveError;
  return mediaPath;
}

export async function removeMediaFile(mediaPath?: string | null) {
  if (!mediaPath) return;
  await supabaseAdmin().storage.from(BUCKET_NAME).remove([mediaPath]);
}

export async function attachSignedMediaUrl(message: any) {
  if (!message?.mediaPath) return message;
  const { data } = await supabaseAdmin().storage.from(BUCKET_NAME).createSignedUrl(message.mediaPath, SIGNED_URL_TTL_SECONDS);
  return { ...message, mediaUrl: data?.signedUrl ?? undefined };
}

export async function syncSeriesModuleCounts(seriesIds: string[]) {
  const uniqueSeriesIds = [...new Set(seriesIds.filter(Boolean))];
  for (const seriesId of uniqueSeriesIds) {
    const { count } = await supabaseAdmin().from("series_messages").select("message_id", { count: "exact", head: true }).eq("series_id", seriesId);
    await supabaseAdmin().from("series").update({ total_modules: count ?? 0, updated_at: new Date().toISOString() }).eq("id", seriesId);
  }
}

export async function fetchSeriesIdsForMessage(messageId: string) {
  const { data, error } = await supabaseAdmin().from("series_messages").select("series_id").eq("message_id", messageId);
  if (error) throw error;
  return (data ?? []).map((row: any) => row.series_id);
}
