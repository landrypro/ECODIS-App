import { fetchJson, getHeaders, jsonHeaders } from "./http";
import type { Comment, CommentReport, CommentReportReason } from "./types";

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

export async function reportComment(
  commentId: string,
  reason: CommentReportReason,
  detail: string,
  accessToken: string,
): Promise<CommentReport> {
  const data = await fetchJson<{ report: CommentReport }>(`/comments/${commentId}/reports`, {
    method: "POST",
    headers: jsonHeaders(accessToken),
    body: JSON.stringify({ reason, detail }),
  });
  return data.report;
}

export async function fetchModerationReports(
  accessToken: string,
  status: CommentReport["status"] = "open",
): Promise<CommentReport[]> {
  const data = await fetchJson<{ reports?: CommentReport[] }>(`/moderation/reports?status=${status}`, {
    headers: getHeaders(accessToken),
  });
  return data.reports ?? [];
}

export async function moderateComment(
  commentId: string,
  action: "hide" | "restore" | "delete",
  reason: string,
  accessToken: string,
): Promise<Comment> {
  const data = await fetchJson<{ comment: Comment }>(`/moderation/comments/${commentId}`, {
    method: "PUT",
    headers: jsonHeaders(accessToken),
    body: JSON.stringify({ action, reason }),
  });
  return data.comment;
}

export async function resolveCommentReport(
  reportId: string,
  status: "resolved" | "dismissed",
  note: string,
  accessToken: string,
): Promise<CommentReport> {
  const data = await fetchJson<{ report: CommentReport }>(`/moderation/reports/${reportId}`, {
    method: "PUT",
    headers: jsonHeaders(accessToken),
    body: JSON.stringify({ status, note }),
  });
  return data.report;
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
