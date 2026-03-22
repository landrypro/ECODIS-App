import { BUCKET_NAME } from "../config.ts";
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

export async function fetchMessagesByIds(messageIds: string[]) {
  if (messageIds.length === 0) return [];
  const { data, error } = await supabaseAdmin().from("messages").select("*").in("id", messageIds);
  if (error) throw error;
  const map = new Map((data ?? []).map((row: any) => [row.id, row]));
  return messageIds.map((id) => map.get(id)).filter(Boolean).map(mapMessage);
}

export async function uploadMediaFile(type: "audio" | "video" | "text", mediaFile: File | null, messageId: string) {
  if (!mediaFile || mediaFile.size <= 0 || type === "text") {
    return "";
  }
  const ext = mediaFile.name.split(".").pop() || "bin";
  const mediaPath = `${type}/${messageId}.${ext}`;
  const buffer = await mediaFile.arrayBuffer();
  const { error } = await supabaseAdmin().storage.from(BUCKET_NAME).upload(mediaPath, buffer, {
    contentType: mediaFile.type,
    upsert: true,
  });
  if (error) throw error;
  return mediaPath;
}

export async function removeMediaFile(mediaPath?: string | null) {
  if (!mediaPath) return;
  await supabaseAdmin().storage.from(BUCKET_NAME).remove([mediaPath]);
}

export async function attachSignedMediaUrl(message: any) {
  if (!message?.mediaPath) return message;
  const { data } = await supabaseAdmin().storage.from(BUCKET_NAME).createSignedUrl(message.mediaPath, 3600);
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
