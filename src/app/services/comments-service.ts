import { fetchJson, getHeaders, jsonHeaders } from "./http";
import type { Comment } from "./types";

export async function fetchComments(messageId: string): Promise<Comment[]> {
  try {
    const data = await fetchJson<{ comments?: Comment[] }>(`/messages/${messageId}/comments`, {
      headers: getHeaders(),
    });
    return data.comments ?? [];
  } catch (error) {
    console.error("Fetch comments error:", error);
    return [];
  }
}

export async function addComment(messageId: string, text: string, accessToken: string): Promise<Comment | null> {
  try {
    const data = await fetchJson<{ comment: Comment }>(`/messages/${messageId}/comments`, {
      method: "POST",
      headers: jsonHeaders(accessToken),
      body: JSON.stringify({ text }),
    });
    return data.comment;
  } catch (error) {
    console.error("Add comment error:", error);
    throw error;
  }
}

export async function deleteComment(messageId: string, commentId: string, accessToken: string): Promise<boolean> {
  try {
    const data = await fetchJson<{ success: boolean }>(`/comments/${messageId}/${commentId}`, {
      method: "DELETE",
      headers: getHeaders(accessToken),
    });
    return data.success === true;
  } catch (error) {
    console.error("Delete comment error:", error);
    throw error;
  }
}

export async function fetchCommentCounts(): Promise<Record<string, number>> {
  try {
    const data = await fetchJson<{ counts?: Record<string, number> }>("/comments/counts", {
      headers: getHeaders(),
    });
    return data.counts ?? {};
  } catch (error) {
    console.error("Fetch comment counts error:", error);
    return {};
  }
}
