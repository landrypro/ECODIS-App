import { fetchJson, getHeaders, jsonHeaders } from "./http";
import type {
  Comment,
  CommentModerationEvent,
  CommentReport,
  CommentReportReason,
  ModerationCommentFilters,
  ModerationQueueComment,
  ModerationReportFilters,
  PaginatedResult,
} from "./types";

function moderationQuery(filters: object): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if ((typeof value === "string" || typeof value === "number") && value !== "") params.set(key, String(value));
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}

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

export async function deleteComment(messageId: string, commentId: string, expectedVersion: number, accessToken: string): Promise<boolean> {
  try {
    const data = await fetchJson<{ success: boolean }>(`/comments/${messageId}/${commentId}?expectedVersion=${encodeURIComponent(expectedVersion)}`, {
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
  filters: ModerationReportFilters = {},
): Promise<PaginatedResult<CommentReport>> {
  return fetchJson<PaginatedResult<CommentReport>>(`/moderation/reports${moderationQuery({
    reportStatus: filters.reportStatus ?? "open",
    authorId: filters.authorId,
    messageId: filters.messageId,
    from: filters.from,
    to: filters.to,
    limit: filters.limit,
    cursor: filters.cursor,
    search: filters.search,
  })}`, {
    headers: getHeaders(accessToken),
  });
}

export async function moderateComment(
  commentId: string,
  action: "hide" | "restore" | "delete",
  reason: string,
  expectedVersion: number,
  accessToken: string,
): Promise<Comment> {
  const data = await fetchJson<{ comment: Comment }>(`/moderation/comments/${commentId}`, {
    method: "PUT",
    headers: jsonHeaders(accessToken),
    body: JSON.stringify({ action, reason, expectedVersion }),
  });
  return data.comment;
}

export async function resolveCommentReport(
  reportId: string,
  status: "resolved" | "dismissed",
  note: string,
  expectedVersion: number,
  accessToken: string,
): Promise<CommentReport> {
  const data = await fetchJson<{ report: CommentReport }>(`/moderation/reports/${reportId}`, {
    method: "PUT",
    headers: jsonHeaders(accessToken),
    body: JSON.stringify({ status, note, expectedVersion }),
  });
  return data.report;
}

export async function fetchModerationComments(
  accessToken: string,
  filters: ModerationCommentFilters | string = {},
): Promise<PaginatedResult<ModerationQueueComment>> {
  const query = typeof filters === "string"
    ? (filters ? `?${filters}` : "")
    : moderationQuery(filters);
  return fetchJson<PaginatedResult<ModerationQueueComment>>(`/moderation/comments${query}`, {
    headers: getHeaders(accessToken),
  });
}

export async function fetchCommentModerationEvents(
  commentId: string,
  accessToken: string,
  query = "",
): Promise<PaginatedResult<CommentModerationEvent>> {
  return fetchJson<PaginatedResult<CommentModerationEvent>>(`/moderation/comments/${commentId}/events${query ? `?${query}` : ""}`, {
    headers: getHeaders(accessToken),
  });
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
