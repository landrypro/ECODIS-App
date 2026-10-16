import { fetchJson, getHeaders, jsonHeaders } from "./http";
import { createClient } from "@supabase/supabase-js";
import type { EditorialStatus, Message } from "./types";
import { publicAnonKey, supabaseUrl } from "../../../utils/supabase/info";

const storageClient = createClient(supabaseUrl, publicAnonKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

interface SignedMediaUpload {
  bucket: string;
  path: string;
  token: string;
}

async function uploadMediaDirectly(file: File, type: "audio" | "video", accessToken: string): Promise<string> {
  const { upload } = await fetchJson<{ upload: SignedMediaUpload }>("/messages/media-upload-url", {
    method: "POST",
    headers: jsonHeaders(accessToken),
    body: JSON.stringify({ type, fileName: file.name, contentType: file.type, size: file.size }),
  });

  const { error } = await storageClient.storage
    .from(upload.bucket)
    .uploadToSignedUrl(upload.path, upload.token, file, { contentType: file.type, upsert: false });
  if (error) throw error;
  return upload.path;
}

export async function fetchMessages(type?: string): Promise<Message[]> {
  try {
    const suffix = type ? `/messages?type=${encodeURIComponent(type)}` : "/messages";
    const data = await fetchJson<{ messages?: Message[] }>(suffix, { headers: getHeaders() });
    return data.messages ?? [];
  } catch (error) {
    console.error("Fetch messages error:", error);
    return [];
  }
}

export async function fetchAdminMessages(accessToken: string): Promise<Message[]> {
  const data = await fetchJson<{ messages?: Message[] }>("/admin/messages", { headers: getHeaders(accessToken) });
  return data.messages ?? [];
}

export async function fetchMessage(id: string, accessToken?: string | null): Promise<Message | null> {
  try {
    const data = await fetchJson<{ message: Message }>(`/messages/${id}`, {
      headers: getHeaders(accessToken),
    });
    return data.message;
  } catch (error) {
    console.error("Fetch message error:", error);
    return null;
  }
}

export async function createMessage(formData: FormData, accessToken: string): Promise<Message | null> {
  try {
    const type = formData.get("type");
    const mediaFile = formData.get("media");
    if (mediaFile instanceof File) {
      if (type !== "audio" && type !== "video") throw new Error("Le fichier media doit etre associe a un contenu audio ou video.");
      // Le binaire ne traverse jamais l'Edge Function : elle ne reçoit ensuite
      // que son chemin Storage, ce qui évite les limites mémoire/CPU de 546.
      const mediaPath = await uploadMediaDirectly(mediaFile, type, accessToken);
      formData.delete("media");
      formData.set("mediaPath", mediaPath);
    }
    const res = await fetchJson<{ message: Message }>("/messages", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: formData,
    });
    return res.message;
  } catch (error) {
    console.error("Create message error:", error);
    throw error;
  }
}

export async function updateMessage(id: string, updates: Partial<Message>, accessToken: string): Promise<Message | null> {
  try {
    const data = await fetchJson<{ message: Message }>(`/messages/${id}`, {
      method: "PUT",
      headers: jsonHeaders(accessToken),
      body: JSON.stringify(updates),
    });
    return data.message;
  } catch (error) {
    console.error("Update message error:", error);
    throw error;
  }
}

export async function deleteMessage(id: string, accessToken: string): Promise<boolean> {
  try {
    const data = await fetchJson<{ success: boolean }>(`/messages/${id}`, {
      method: "DELETE",
      headers: getHeaders(accessToken),
    });
    return data.success === true;
  } catch (error) {
    console.error("Delete message error:", error);
    return false;
  }
}

export async function transitionMessage(
  id: string,
  status: EditorialStatus,
  accessToken: string,
  scheduledAt?: string,
): Promise<Message> {
  const data = await fetchJson<{ message: Message }>(`/messages/${id}/transitions`, {
    method: "POST",
    headers: jsonHeaders(accessToken),
    body: JSON.stringify({ status, scheduledAt }),
  });
  return data.message;
}
