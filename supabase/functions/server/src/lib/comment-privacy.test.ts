import { mapComment, mapCommentReport, mapModerationComment } from "./mappers.ts";

Deno.test("comment privacy - public DTO is an exact allowlist, internal DTO stays separate", () => {
  const row = {
    id: "c1", message_id: "m1", user_id: "u1", user_name: "Author",
    user_email: "private@example.test", text: "Public text", status: "visible",
    created_at: "2026-10-14T12:00:00Z", moderation_reason: "private reason",
    moderated_by: "moderator", messages: { status: "published" }, extra_secret: "secret",
  };
  const publicComment = mapComment(row);
  const expected = ["id", "messageId", "userId", "userName", "text", "status", "createdAt"].sort();
  if (JSON.stringify(Object.keys(publicComment).sort()) !== JSON.stringify(expected)) {
    throw new Error("Public comment fields changed");
  }
  if (JSON.stringify(publicComment).includes("private") || JSON.stringify(publicComment).includes("secret")) {
    throw new Error("Private data exposed");
  }
  if (mapModerationComment(row).userEmail !== row.user_email) throw new Error("Internal DTO regression");
  if (mapCommentReport({ comments: row }).comment?.userEmail !== row.user_email) {
    throw new Error("Moderation report must use its internal DTO");
  }
});
