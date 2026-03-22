import { Hono } from "npm:hono";
import { getAppConfig } from "../lib/app-config.ts";
import { getUserRole } from "../lib/auth.ts";
import { handleApiError, ValidationError } from "../lib/errors.ts";
import { assertMessageExists } from "../lib/messages.ts";
import { mapComment } from "../lib/mappers.ts";
import { getUser, supabaseAdmin } from "../lib/supabase.ts";
import { validateCommentText } from "../lib/validation.ts";

export const commentsRoutes = new Hono();

commentsRoutes.post("/messages/:id/comments", async (c) => {
  try {
    const user = await getUser(c.req.raw);
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const config = await getAppConfig();
    if (!config.commentsEnabled) {
      return c.json({ error: "Les commentaires sont actuellement desactives" }, 403);
    }

    const messageId = c.req.param("id");
    await assertMessageExists(messageId);
    const { text } = await c.req.json();
    const validatedText = validateCommentText(text);

    const payload = {
      message_id: messageId,
      user_id: user.id,
      user_name: user.user_metadata?.name || user.email?.split("@")[0] || "Disciple",
      user_email: user.email ?? "",
      text: validatedText,
      created_at: new Date().toISOString(),
    };

    const { data, error } = await supabaseAdmin().from("comments").insert(payload).select("*").single();
    if (error) throw error;
    return c.json({ comment: mapComment(data) });
  } catch (error) {
    return handleApiError(c, error, "Add comment error");
  }
});

commentsRoutes.get("/messages/:id/comments", async (c) => {
  try {
    const messageId = c.req.param("id");
    const { data, error } = await supabaseAdmin()
      .from("comments")
      .select("*")
      .eq("message_id", messageId)
      .order("created_at", { ascending: false });
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

    const messageId = c.req.param("messageId");
    const commentId = c.req.param("commentId");
    const admin = supabaseAdmin();
    const { data: comment, error } = await admin
      .from("comments")
      .select("*")
      .eq("id", commentId)
      .eq("message_id", messageId)
      .maybeSingle();
    if (error) throw error;
    if (!comment) throw new ValidationError("Comment not found", 404);

    const role = await getUserRole(user.id);
    if (comment.user_id !== user.id && role !== "admin") {
      return c.json({ error: "Forbidden: you can only delete your own comments" }, 403);
    }

    const { error: deleteError } = await admin.from("comments").delete().eq("id", commentId).eq("message_id", messageId);
    if (deleteError) throw deleteError;
    return c.json({ success: true });
  } catch (error) {
    return handleApiError(c, error, "Delete comment error");
  }
});

commentsRoutes.get("/comments/counts", async (c) => {
  try {
    const { data, error } = await supabaseAdmin().from("comments").select("message_id");
    if (error) throw error;
    const counts: Record<string, number> = {};
    for (const row of data ?? []) {
      counts[row.message_id] = (counts[row.message_id] || 0) + 1;
    }
    return c.json({ counts });
  } catch (error) {
    return handleApiError(c, error, "Get comment counts error");
  }
});
