import { fetchJson, getHeaders, jsonHeaders } from "./http";
import type { Message } from "./types";

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

export async function fetchMessage(id: string): Promise<Message | null> {
  try {
    const data = await fetchJson<{ message: Message }>(`/messages/${id}`, {
      headers: getHeaders(),
    });
    return data.message;
  } catch (error) {
    console.error("Fetch message error:", error);
    return null;
  }
}

export async function createMessage(formData: FormData, accessToken: string): Promise<Message | null> {
  try {
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
