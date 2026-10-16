import { Hono } from "npm:hono";
import { getAppConfig } from "../lib/app-config.ts";
import { requirePermission } from "../lib/auth.ts";
import { handleApiError, ValidationError } from "../lib/errors.ts";
import { assertPublishedMessage } from "../lib/messages.ts";
import { mapComment, mapCommentReport, mapModerationComment, mapModerationEvent, mapOwnerComment } from "../lib/mappers.ts";
import { logAudit } from "../lib/audit.ts";
import { checkCommentActionRateLimit } from "../lib/rate-limit.ts";
import { getUser, supabaseAdmin } from "../lib/supabase.ts";
import { validateCommentReportReason, validateCommentText, validateModerationAction, validateOptionalString } from "../lib/validation.ts";

export const commentsRoutes = new Hono();

// PostgreSQL accepts every structurally valid UUID, including legacy/imported
// values whose version nibble is 0. Do not make existing resources
// unreachable by imposing a client-side UUID-version policy.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REPORT_STATUSES = new Set(["open", "resolved", "dismissed"]);
const COMMENT_STATUSES = new Set(["visible", "hidden", "deleted_by_author", "deleted_by_moderation"]);

type Cursor = { value: string; id: string };

function requestId(c: any): string {
  const value = c.get?.("requestId");
  return typeof value === "string" && UUID.test(value) ? value : crypto.randomUUID();
}

function validateExpectedVersion(value: unknown): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    throw new ValidationError("expectedVersion est requis et doit être un entier positif");
  }
  return value;
}

function validateQueryId(value: string | undefined, field: string): string | undefined {
  if (value == null || value === "") return undefined;
  if (!UUID.test(value)) throw new ValidationError(`${field} invalide`);
  return value;
}

function validateIsoDate(value: string | undefined, field: string): string | undefined {
  if (value == null || value === "") return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime()) || !/^\d{4}-\d{2}-\d{2}T/.test(value)) {
    throw new ValidationError(`${field} doit être une date ISO UTC`);
  }
  return date.toISOString();
}

function validateModerationSearch(value: string | undefined): string | undefined {
  if (value == null || value === "") return undefined;
  const normalized = validateOptionalString(value, "Recherche", 120);
  return normalized || undefined;
}

function moderationSearchPattern(value: string): string {
  // PostgREST's `or` grammar treats these characters as operators. Escape
  // them before inserting an operator value so a search term cannot change
  // the query semantics.
  return `*${value.replace(/[\\%_*,.()]/g, "\\$&")}*`;
}

function pageRequest(c: any): { limit: number; cursor?: Cursor } {
  const rawLimit = c.req.query("limit");
  const limit = rawLimit == null || rawLimit === "" ? 25 : Number(rawLimit);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new ValidationError("limit doit être un entier entre 1 et 100");
  }
  const rawCursor = c.req.query("cursor");
  if (!rawCursor) return { limit };
  try {
    const padded = rawCursor.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - rawCursor.length % 4) % 4);
    const parsed = JSON.parse(atob(padded));
    if (typeof parsed?.value !== "string" || Number.isNaN(new Date(parsed.value).getTime()) || !UUID.test(parsed?.id)) {
      throw new Error("invalid");
    }
    return { limit, cursor: { value: new Date(parsed.value).toISOString(), id: parsed.id } };
  } catch {
    throw new ValidationError("cursor invalide");
  }
}

function makeCursor(row: any, field: string): string {
  const payload = JSON.stringify({ value: row[field], id: row.id });
  return btoa(payload).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function applyCursor(query: any, cursor: Cursor | undefined, field: string): any {
  if (!cursor) return query;
  return query.or(`${field}.lt.${cursor.value},and(${field}.eq.${cursor.value},id.lt.${cursor.id})`);
}

function paginated(rows: any[], limit: number, field: string) {
  const items = rows.slice(0, limit);
  const hasMore = rows.length > limit;
  return {
    items,
    hasMore,
    nextCursor: hasMore && items.length > 0 ? makeCursor(items.at(-1), field) : null,
  };
}

function transactionError(error: any): Error {
  const code = String(error?.code ?? "");
  const status = code === "PT400" ? 400 : code === "PT403" ? 403 : code === "PT404" ? 404 : code === "PT409" || code === "23505" ? 409 : null;
  if (!status) return error;
  const fallback = status === 400 ? "Requête de modération invalide" : status === 403 ? "Action non autorisée" : status === 404
    ? "Ressource introuvable" : "Conflit de modération";
  return new ValidationError(typeof error?.message === "string" && error.message.length <= 200 ? error.message : fallback, status);
}

async function requireCommentQuota(c: any, userId: string, kind: "comment_create" | "comment_report") {
  const result = await checkCommentActionRateLimit(userId, kind);
  if (result.allowed) return null;
  c.header("Retry-After", String(result.retryAfterSeconds));
  return c.json({ error: "Trop de requêtes. Réessayez plus tard.", retryAfterSeconds: result.retryAfterSeconds }, 429);
}

function mapModerationQueueComment(row: any) {
  const reports = Array.isArray(row.comment_reports) ? row.comment_reports : [];
  return {
    ...mapModerationComment(row),
    reportCount: reports.length,
    openReportCount: reports.filter((report: any) => report.status === "open").length,
    lastDecisionAt: row.moderated_at ?? null,
  };
}

commentsRoutes.post("/messages/:id/comments", async (c) => {
  try {
    const user = await getUser(c.req.raw);
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    const config = await getAppConfig();
    if (!config.commentsEnabled) return c.json({ error: "Les commentaires sont actuellement desactives" }, 403);
    const messageId = c.req.param("id");
    await assertPublishedMessage(messageId);
    const { text } = await c.req.json();
    const validatedText = validateCommentText(text);
    const limited = await requireCommentQuota(c, user.id, "comment_create");
    if (limited) return limited;
    const { data, error } = await supabaseAdmin().from("comments").insert({
      message_id: messageId,
      user_id: user.id,
      user_name: user.user_metadata?.name || user.email?.split("@")[0] || "Disciple",
      user_email: user.email ?? "",
      text: validatedText,
      status: "visible",
      created_at: new Date().toISOString(),
    }).select("*").single();
    if (error) throw error;
    return c.json({ comment: mapOwnerComment(data) });
  } catch (error) {
    return handleApiError(c, error, "Add comment error");
  }
});

commentsRoutes.get("/messages/:id/comments", async (c) => {
  try {
    const messageId = c.req.param("id");
    await assertPublishedMessage(messageId);
    const user = await getUser(c.req.raw);
    const { data, error } = await supabaseAdmin().from("comments")
      .select("id,message_id,user_id,user_name,text,status,version,created_at,messages!inner(status)")
      .eq("message_id", messageId).eq("status", "visible").eq("messages.status", "published")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return c.json({ comments: (data ?? []).map((row: any) => row.user_id === user?.id ? mapOwnerComment(row) : mapComment(row)) });
  } catch (error) {
    return handleApiError(c, error, "Get comments error");
  }
});

commentsRoutes.delete("/comments/:messageId/:commentId", async (c) => {
  try {
    const user = await getUser(c.req.raw);
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    const expectedVersion = validateExpectedVersion(Number(c.req.query("expectedVersion")));
    // The legacy URL contains the message id. Validate it before the
    // transaction so a correct comment id paired with a wrong message id can
    // never cause a deletion followed by a misleading 404 response.
    const { data: location, error: locationError } = await supabaseAdmin().from("comments")
      .select("message_id").eq("id", c.req.param("commentId")).maybeSingle();
    if (locationError) throw locationError;
    if (!location || location.message_id !== c.req.param("messageId")) throw new ValidationError("Commentaire introuvable", 404);
    const { data, error } = await supabaseAdmin().rpc("moderate_comment_transaction", {
      p_comment_id: c.req.param("commentId"), p_actor_id: user.id, p_action: "author_delete",
      p_expected_version: expectedVersion, p_reason: "Suppression par l'auteur", p_request_id: requestId(c),
    }).single();
    if (error) throw transactionError(error);
    const deletedComment = data as any;
    await logAudit(user.id, user.email || "", "comment_deleted_by_author", "Commentaire supprimé par son auteur", { commentId: deletedComment.id });
    return c.json({ success: true, comment: mapOwnerComment(deletedComment) });
  } catch (error) {
    return handleApiError(c, error, "Delete comment error");
  }
});

commentsRoutes.post("/comments/:commentId/reports", async (c) => {
  try {
    const user = await getUser(c.req.raw);
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    const { reason, detail } = await c.req.json();
    const validatedReason = validateCommentReportReason(reason);
    const validatedDetail = validateOptionalString(detail, "Détail", 500);
    const limited = await requireCommentQuota(c, user.id, "comment_report");
    if (limited) return limited;
    const { data, error } = await supabaseAdmin().rpc("create_comment_report_transaction", {
      p_comment_id: c.req.param("commentId"), p_actor_id: user.id, p_reason: validatedReason,
      p_detail: validatedDetail, p_request_id: requestId(c),
    }).single();
    if (error) throw transactionError(error);
    const createdReport = data as any;
    await logAudit(user.id, user.email || "", "comment_reported", "Commentaire signalé", { commentId: createdReport.comment_id, reportId: createdReport.id, reason: validatedReason });
    return c.json({ report: mapCommentReport(createdReport) }, 201);
  } catch (error) {
    return handleApiError(c, error, "Report comment error");
  }
});

commentsRoutes.get("/moderation/reports", async (c) => {
  try {
    const { user, error: authError } = await requirePermission(c.req.raw, "comments_moderate");
    if (authError) return c.json({ error: authError }, user ? 403 : 401);
    const reportStatus = c.req.query("reportStatus") ?? c.req.query("status") ?? "open";
    if (reportStatus !== "all" && !REPORT_STATUSES.has(reportStatus)) throw new ValidationError("Statut de signalement invalide");
    const authorId = validateQueryId(c.req.query("authorId"), "authorId");
    const messageId = validateQueryId(c.req.query("messageId"), "messageId");
    const from = validateIsoDate(c.req.query("from"), "from");
    const to = validateIsoDate(c.req.query("to"), "to");
    const search = validateModerationSearch(c.req.query("search"));
    if (from && to && from > to) throw new ValidationError("from doit précéder to");
    const { limit, cursor } = pageRequest(c);
    let query: any = supabaseAdmin().from("comment_reports").select("*,comments!inner(*)")
      .order("created_at", { ascending: false }).order("id", { ascending: false }).limit(limit + 1);
    if (reportStatus !== "all") query = query.eq("status", reportStatus);
    if (authorId) query = query.eq("comments.user_id", authorId);
    if (messageId) query = query.eq("comments.message_id", messageId);
    if (search) query = query.or(`user_name.ilike.${moderationSearchPattern(search)},text.ilike.${moderationSearchPattern(search)}`, { foreignTable: "comments" });
    if (from) query = query.gte("created_at", from);
    if (to) query = query.lte("created_at", to);
    const { data, error } = await applyCursor(query, cursor, "created_at");
    if (error) throw error;
    const page = paginated(data ?? [], limit, "created_at");
    return c.json({ ...page, items: page.items.map(mapCommentReport) });
  } catch (error) {
    return handleApiError(c, error, "List moderation reports error");
  }
});

commentsRoutes.get("/moderation/comments", async (c) => {
  try {
    const { user, error: authError } = await requirePermission(c.req.raw, "comments_moderate");
    if (authError) return c.json({ error: authError }, user ? 403 : 401);
    const commentStatus = c.req.query("commentStatus") ?? "all";
    if (commentStatus !== "all" && !COMMENT_STATUSES.has(commentStatus)) throw new ValidationError("Statut de commentaire invalide");
    const authorId = validateQueryId(c.req.query("authorId"), "authorId");
    const messageId = validateQueryId(c.req.query("messageId"), "messageId");
    const from = validateIsoDate(c.req.query("from"), "from");
    const to = validateIsoDate(c.req.query("to"), "to");
    const search = validateModerationSearch(c.req.query("search"));
    if (from && to && from > to) throw new ValidationError("from doit précéder to");
    const processed = commentStatus !== "all" && commentStatus !== "visible";
    const dateColumn = processed ? "moderated_at" : "created_at";
    const { limit, cursor } = pageRequest(c);
    let query: any = supabaseAdmin().from("comments").select("*,comment_reports(id,status,created_at)")
      .order(dateColumn, { ascending: false }).order("id", { ascending: false }).limit(limit + 1);
    if (commentStatus !== "all") query = query.eq("status", commentStatus);
    if (authorId) query = query.eq("user_id", authorId);
    if (messageId) query = query.eq("message_id", messageId);
    if (search) query = query.or(`user_name.ilike.${moderationSearchPattern(search)},text.ilike.${moderationSearchPattern(search)}`);
    if (from) query = query.gte(dateColumn, from);
    if (to) query = query.lte(dateColumn, to);
    const { data, error } = await applyCursor(query, cursor, dateColumn);
    if (error) throw error;
    const page = paginated(data ?? [], limit, dateColumn);
    return c.json({ ...page, items: page.items.map(mapModerationQueueComment), dateFilterField: processed ? "lastDecisionAt" : "createdAt" });
  } catch (error) {
    return handleApiError(c, error, "List moderation comments error");
  }
});

commentsRoutes.get("/moderation/comments/:commentId/events", async (c) => {
  try {
    const { user, error: authError } = await requirePermission(c.req.raw, "comments_moderate");
    if (authError) return c.json({ error: authError }, user ? 403 : 401);
    const { limit, cursor } = pageRequest(c);
    let query: any = supabaseAdmin().from("comment_moderation_events")
      .select("id,comment_id,report_id,actor_id,action,previous_status,next_status,previous_version,next_version,reason,request_id,created_at")
      .eq("comment_id", c.req.param("commentId"))
      .order("created_at", { ascending: false }).order("id", { ascending: false }).limit(limit + 1);
    const { data, error } = await applyCursor(query, cursor, "created_at");
    if (error) throw error;
    const page = paginated(data ?? [], limit, "created_at");
    return c.json({ ...page, items: page.items.map(mapModerationEvent) });
  } catch (error) {
    return handleApiError(c, error, "List moderation events error");
  }
});

commentsRoutes.put("/moderation/comments/:commentId", async (c) => {
  try {
    const { user, error: authError } = await requirePermission(c.req.raw, "comments_moderate");
    if (authError) return c.json({ error: authError }, user ? 403 : 401);
    const { action, reason, expectedVersion } = await c.req.json();
    const validatedAction = validateModerationAction(action);
    const validatedReason = validateOptionalString(reason, "Motif", 500);
    const version = validateExpectedVersion(expectedVersion);
    if ((validatedAction === "hide" || validatedAction === "delete") && !validatedReason) {
      throw new ValidationError("Un motif est requis pour cette action de modération");
    }
    const { data, error } = await supabaseAdmin().rpc("moderate_comment_transaction", {
      p_comment_id: c.req.param("commentId"), p_actor_id: user!.id, p_action: validatedAction,
      p_expected_version: version, p_reason: validatedReason, p_request_id: requestId(c),
    }).single();
    if (error) throw transactionError(error);
    const moderatedComment = data as any;
    await logAudit(user!.id, user!.email || "", `comment_moderation_${validatedAction}`, "Décision de modération appliquée", {
      commentId: moderatedComment.id, nextStatus: moderatedComment.status, version: moderatedComment.version, reason: validatedReason,
    });
    return c.json({ comment: mapModerationComment(moderatedComment) });
  } catch (error) {
    return handleApiError(c, error, "Moderate comment error");
  }
});

commentsRoutes.put("/moderation/reports/:reportId", async (c) => {
  try {
    const { user, error: authError } = await requirePermission(c.req.raw, "comments_moderate");
    if (authError) return c.json({ error: authError }, user ? 403 : 401);
    const { status, note, expectedVersion } = await c.req.json();
    if (status !== "resolved" && status !== "dismissed") throw new ValidationError("Décision de signalement invalide");
    const validatedNote = validateOptionalString(note, "Note", 500);
    const version = validateExpectedVersion(expectedVersion);
    const { data, error } = await supabaseAdmin().rpc("resolve_comment_report_transaction", {
      p_report_id: c.req.param("reportId"), p_actor_id: user!.id, p_status: status,
      p_expected_version: version, p_note: validatedNote, p_request_id: requestId(c),
    }).single();
    if (error) throw transactionError(error);
    const resolvedReport = data as any;
    await logAudit(user!.id, user!.email || "", `comment_report_${status}`, "Signalement traité", { reportId: resolvedReport.id, version: resolvedReport.version, note: validatedNote });
    return c.json({ report: mapCommentReport(resolvedReport) });
  } catch (error) {
    return handleApiError(c, error, "Resolve report error");
  }
});

commentsRoutes.get("/comments/counts", async (c) => {
  try {
    const { data, error } = await supabaseAdmin().from("comments")
      .select("message_id,messages!inner(status)")
      .eq("status", "visible").eq("messages.status", "published");
    if (error) throw error;
    const counts: Record<string, number> = {};
    for (const row of data ?? []) counts[row.message_id] = (counts[row.message_id] || 0) + 1;
    return c.json({ counts });
  } catch (error) {
    return handleApiError(c, error, "Get comment counts error");
  }
});
