import { Hono } from "npm:hono";
import { getAppConfig } from "../lib/app-config.ts";
import { requirePermission } from "../lib/auth.ts";
import { handleApiError, ValidationError } from "../lib/errors.ts";
import { assertPublishedMessage } from "../lib/messages.ts";
import { mapComment, mapCommentReport } from "../lib/mappers.ts";
import { logAudit } from "../lib/audit.ts";
import { getUser, supabaseAdmin } from "../lib/supabase.ts";
import { validateCommentReportReason, validateCommentText, validateModerationAction, validateOptionalString } from "../lib/validation.ts";

export const commentsRoutes = new Hono();

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
    return c.json({ comment: mapComment(data) });
  } catch (error) {
    return handleApiError(c, error, "Add comment error");
  }
});

commentsRoutes.get("/messages/:id/comments", async (c) => {
  try {
    const messageId = c.req.param("id");
    await assertPublishedMessage(messageId);
    const { data, error } = await supabaseAdmin().from("comments").select("*")
      .eq("message_id", messageId).eq("status", "visible").order("created_at", { ascending: false });
    if (error) throw error;
    return c.json({ comments: (data ?? []).map(mapComment) });
  } catch (error) {
    return handleApiError(c, error, "Get comments error");
  }
});

commentsRoutes.delete("/comments/:messageId/:commentId", async (c) => {
  try {
    const user = await getUser(c.req.raw);
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    const admin = supabaseAdmin();
    const { data: comment, error } = await admin.from("comments").select("*")
      .eq("id", c.req.param("commentId")).eq("message_id", c.req.param("messageId")).maybeSingle();
    if (error) throw error;
    if (!comment) throw new ValidationError("Commentaire introuvable", 404);
    if (comment.user_id !== user.id) return c.json({ error: "Forbidden: you can only delete your own comments" }, 403);

    const { error: updateError } = await admin.from("comments").update({
      status: "deleted_by_author",
      moderated_at: new Date().toISOString(),
      moderated_by: user.id,
      moderation_reason: "Suppression par l'auteur",
    }).eq("id", comment.id);
    if (updateError) throw updateError;
    await logAudit(user.id, user.email || "", "comment_deleted_by_author", "Commentaire supprimé par son auteur", { commentId: comment.id });
    return c.json({ success: true });
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
    const admin = supabaseAdmin();
    const { data: comment, error } = await admin.from("comments").select("*").eq("id", c.req.param("commentId")).maybeSingle();
    if (error) throw error;
    if (!comment) throw new ValidationError("Commentaire introuvable", 404);
    if (comment.user_id === user.id) throw new ValidationError("Vous ne pouvez pas signaler votre propre commentaire", 403);
    if (comment.status !== "visible") throw new ValidationError("Ce commentaire n'est plus signalable", 409);

    const { data: existing, error: existingError } = await admin.from("comment_reports").select("id")
      .eq("comment_id", comment.id).eq("reporter_id", user.id).maybeSingle();
    if (existingError) throw existingError;
    if (existing) throw new ValidationError("Vous avez déjà signalé ce commentaire", 409);
    const { data, error: insertError } = await admin.from("comment_reports").insert({
      comment_id: comment.id,
      reporter_id: user.id,
      reason: validatedReason,
      detail: validatedDetail,
      status: "open",
      created_at: new Date().toISOString(),
    }).select("*").single();
    if (insertError) {
      if (insertError.code === "23505") throw new ValidationError("Vous avez déjà signalé ce commentaire", 409);
      throw insertError;
    }
    await logAudit(user.id, user.email || "", "comment_reported", "Commentaire signalé", { commentId: comment.id, reportId: data.id, reason: validatedReason });
    return c.json({ report: mapCommentReport(data) }, 201);
  } catch (error) {
    return handleApiError(c, error, "Report comment error");
  }
});

commentsRoutes.get("/moderation/reports", async (c) => {
  try {
    const { user, error: authError } = await requirePermission(c.req.raw, "comments_moderate");
    if (authError) return c.json({ error: authError }, user ? 403 : 401);
    const status = c.req.query("status") ?? "open";
    if (!['open', 'resolved', 'dismissed'].includes(status)) throw new ValidationError("Statut de signalement invalide");
    const { data, error } = await supabaseAdmin().from("comment_reports")
      .select("*, comments(*)").eq("status", status).order("created_at", { ascending: false }).limit(200);
    if (error) throw error;
    return c.json({ reports: (data ?? []).map(mapCommentReport) });
  } catch (error) {
    return handleApiError(c, error, "List moderation reports error");
  }
});

commentsRoutes.put("/moderation/comments/:commentId", async (c) => {
  try {
    const { user, error: authError } = await requirePermission(c.req.raw, "comments_moderate");
    if (authError) return c.json({ error: authError }, user ? 403 : 401);
    const { action, reason } = await c.req.json();
    const validatedAction = validateModerationAction(action);
    const validatedReason = validateOptionalString(reason, "Motif", 500);
    if ((validatedAction === "hide" || validatedAction === "delete") && !validatedReason) {
      throw new ValidationError("Un motif est requis pour cette action de modération");
    }
    const admin = supabaseAdmin();
    const { data: comment, error } = await admin.from("comments").select("*").eq("id", c.req.param("commentId")).maybeSingle();
    if (error) throw error;
    if (!comment) throw new ValidationError("Commentaire introuvable", 404);
    if (comment.status === "deleted_by_author") {
      throw new ValidationError("Un commentaire supprimé par son auteur ne peut pas être modéré", 409);
    }
    const nextStatus = validatedAction === "hide" ? "hidden" : validatedAction === "delete" ? "deleted_by_moderation" : "visible";
    const { data: updated, error: updateError } = await admin.from("comments").update({
      status: nextStatus,
      moderated_at: new Date().toISOString(),
      moderated_by: user!.id,
      moderation_reason: validatedReason,
    }).eq("id", comment.id).select("*").single();
    if (updateError) throw updateError;
    if (validatedAction !== "restore") {
      const { error: reportsError } = await admin.from("comment_reports").update({
        status: "resolved", reviewed_at: new Date().toISOString(), reviewed_by: user!.id, resolution_note: validatedReason,
      }).eq("comment_id", comment.id).eq("status", "open");
      if (reportsError) throw reportsError;
    }
    await logAudit(user!.id, user!.email || "", `comment_moderation_${validatedAction}`, "Décision de modération appliquée", {
      commentId: comment.id, previousStatus: comment.status, nextStatus, reason: validatedReason,
    });
    return c.json({ comment: mapComment(updated) });
  } catch (error) {
    return handleApiError(c, error, "Moderate comment error");
  }
});

commentsRoutes.put("/moderation/reports/:reportId", async (c) => {
  try {
    const { user, error: authError } = await requirePermission(c.req.raw, "comments_moderate");
    if (authError) return c.json({ error: authError }, user ? 403 : 401);
    const { status, note } = await c.req.json();
    if (status !== "resolved" && status !== "dismissed") throw new ValidationError("Décision de signalement invalide");
    const validatedNote = validateOptionalString(note, "Note", 500);
    const { data, error } = await supabaseAdmin().from("comment_reports").update({
      status, reviewed_at: new Date().toISOString(), reviewed_by: user!.id, resolution_note: validatedNote,
    }).eq("id", c.req.param("reportId")).eq("status", "open").select("*, comments(*)").maybeSingle();
    if (error) throw error;
    if (!data) throw new ValidationError("Signalement déjà traité ou introuvable", 409);
    await logAudit(user!.id, user!.email || "", `comment_report_${status}`, "Signalement traité", { reportId: data.id, note: validatedNote });
    return c.json({ report: mapCommentReport(data) });
  } catch (error) {
    return handleApiError(c, error, "Resolve report error");
  }
});

commentsRoutes.get("/comments/counts", async (c) => {
  try {
    const { data, error } = await supabaseAdmin().from("comments").select("message_id").eq("status", "visible");
    if (error) throw error;
    const counts: Record<string, number> = {};
    for (const row of data ?? []) counts[row.message_id] = (counts[row.message_id] || 0) + 1;
    return c.json({ counts });
  } catch (error) {
    return handleApiError(c, error, "Get comment counts error");
  }
});
