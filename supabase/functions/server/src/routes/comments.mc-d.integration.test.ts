// MC-D contract tests through Hono and the real supabase-js request builder.
// The PostgreSQL atomicity itself is proven by MC-C; MC-D verifies that HTTP
// only reaches its protected RPC entry points with an authenticated actor.
for (const [key, value] of Object.entries({
  APP_API_PREFIX: "server/api", APP_STORAGE_BUCKET_NAME: "media",
  APP_ALLOWED_ORIGINS: "http://localhost:5173", APP_AUTH_REDIRECT_URL: "http://localhost:5173/reset-password",
  SUPABASE_URL: "http://127.0.0.1:54321", SUPABASE_SERVICE_ROLE_KEY: "test-only-service", SUPABASE_ANON_KEY: "test-only-anon",
})) Deno.env.set(key, value);

const { commentsRoutes } = await import("./comments.ts");

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

const moderatorId = "00000000-0000-0000-0000-000000000002";
const authorId = "00000000-0000-0000-0000-000000000001";
const commentId = "20000000-0000-0000-0000-000000000001";
const reportId = "30000000-0000-0000-0000-000000000001";
const messageId = "10000000-0000-0000-0000-000000000001";
const stamp = "2026-10-14T20:00:00.000Z";

function moderationComment(id = commentId, version = 3) {
  return {
    id, message_id: messageId, user_id: authorId, user_name: "Author", user_email: "author@example.test",
    text: "Moderated text", status: "hidden", version, created_at: stamp, moderated_at: stamp,
    moderated_by: moderatorId, moderation_reason: "spam", comment_reports: [{ id: reportId, status: "open" }],
  };
}

Deno.test("MC-D - protected transactional moderation API contracts", async () => {
  const originalFetch = globalThis.fetch;
  let quotaAllowed = true;
  let conflict = false;
  let activeUserId = moderatorId;
  const rpcBodies: Array<{ name: string; body: any }> = [];
  const urls: URL[] = [];
  globalThis.fetch = async (input, init) => {
    const request = new Request(input, init);
    const url = new URL(request.url);
    urls.push(url);
    if (url.pathname === "/auth/v1/user") return Response.json({ id: activeUserId, email: "moderator@example.test", user_metadata: { name: "Moderator" } });
    const table = url.pathname.split("/").at(-1)!;
    if (table === "user_account_status") return Response.json([]);
    if (table === "users_roles") return Response.json([{ user_id: activeUserId, email: "moderator@example.test", name: "Moderator", role: "user" }]);
    if (table === "user_role_assignments") return Response.json([{ role: activeUserId === moderatorId ? "moderator" : "user" }]);
    if (table === "audit_logs") return Response.json({ id: crypto.randomUUID() }, { status: 201 });
    if (url.pathname.endsWith("/rpc/consume_api_rate_limit")) {
      return Response.json({ allowed: quotaAllowed, remaining: quotaAllowed ? 4 : 0, retry_after_seconds: 37 });
    }
    if (url.pathname.includes("/rpc/")) {
      const body = await request.json();
      const name = url.pathname.split("/").at(-1)!;
      rpcBodies.push({ name, body });
      if (conflict) return Response.json({ code: "PT409", message: "Version conflict" }, { status: 409 });
      if (name === "moderate_comment_transaction") return Response.json(moderationComment(commentId, body.p_expected_version + 1));
      if (name === "resolve_comment_report_transaction") return Response.json({
        id: reportId, comment_id: commentId, reporter_id: authorId, reason: "spam", detail: "", status: body.p_status,
        reviewed_at: stamp, reviewed_by: moderatorId, resolution_note: body.p_note, created_at: stamp, version: body.p_expected_version + 1,
      });
      if (name === "create_comment_report_transaction") return Response.json({
        id: reportId, comment_id: commentId, reporter_id: moderatorId, reason: body.p_reason, detail: body.p_detail,
        status: "open", created_at: stamp, version: 1,
      }, { status: 201 });
    }
    if (table === "comment_moderation_events") return Response.json([
      { id: "40000000-0000-0000-0000-000000000002", comment_id: commentId, report_id: reportId, actor_id: moderatorId, action: "hide", previous_status: "visible", next_status: "hidden", previous_version: 2, next_version: 3, reason: "spam", request_id: "50000000-0000-4000-8000-000000000001", created_at: stamp },
      { id: "40000000-0000-0000-0000-000000000001", comment_id: commentId, report_id: null, actor_id: authorId, action: "report_created", previous_status: null, next_status: "open", previous_version: null, next_version: 1, reason: "spam", request_id: "50000000-0000-4000-8000-000000000002", created_at: "2026-10-14T19:00:00.000Z" },
    ]);
    if (table === "comment_reports") return Response.json([
      { id: reportId, comment_id: commentId, reporter_id: authorId, reason: "spam", detail: "detail", status: "open", created_at: stamp, version: 3, comments: moderationComment() },
      { id: "30000000-0000-0000-0000-000000000002", comment_id: "20000000-0000-0000-0000-000000000002", reporter_id: authorId, reason: "other", detail: "", status: "open", created_at: "2026-10-14T19:00:00.000Z", version: 1, comments: moderationComment("20000000-0000-0000-0000-000000000002") },
    ]);
    if (table === "comments" && url.searchParams.get("select") === "message_id") return Response.json([{ message_id: messageId }]);
    if (table === "comments") return Response.json([moderationComment(), moderationComment("20000000-0000-0000-0000-000000000002")]);
    return Response.json({ id: crypto.randomUUID() }, { status: 201 });
  };

  const headers = { Authorization: "Bearer moderator-token", "Content-Type": "application/json" };
  try {
    const reports = await commentsRoutes.request(`/moderation/reports?reportStatus=open&authorId=${authorId}&messageId=${messageId}&limit=1`, { headers });
    if (reports.status !== 200) {
      throw new Error(`Moderation reports must be readable by moderator (HTTP ${reports.status}): ${await reports.text()}`);
    }
    const reportPage = await reports.json();
    assert(reportPage.items.length === 1 && reportPage.hasMore && reportPage.nextCursor, "Reports must be cursor paginated");
    assert(reportPage.items[0].version === 3 && reportPage.items[0].comment.userEmail === "author@example.test", "Internal report DTO incomplete");

    const queue = await commentsRoutes.request(`/moderation/comments?commentStatus=hidden&limit=1&from=2026-10-01T00:00:00Z`, { headers });
    assert(queue.status === 200, "Moderation queue must be readable");
    const queuePage = await queue.json();
    assert(queuePage.dateFilterField === "lastDecisionAt" && queuePage.items[0].openReportCount === 1, "Queue counters/date contract invalid");

    const events = await commentsRoutes.request(`/moderation/comments/${commentId}/events?limit=1`, { headers });
    assert(events.status === 200, "Protected history must be readable");
    const eventPage = await events.json();
    assert(eventPage.items.length === 1 && eventPage.hasMore && eventPage.items[0].nextVersion === 3, "Event pagination invalid");

    const moderate = await commentsRoutes.request(`/moderation/comments/${commentId}`, {
      method: "PUT", headers, body: JSON.stringify({ action: "hide", reason: "spam", expectedVersion: 3 }),
    });
    assert(moderate.status === 200, "Transactional moderation rejected");
    const report = await commentsRoutes.request(`/moderation/reports/${reportId}`, {
      method: "PUT", headers, body: JSON.stringify({ status: "dismissed", note: "noted", expectedVersion: 3 }),
    });
    assert(report.status === 200, "Transactional report resolution rejected");
    activeUserId = authorId;
    const deletion = await commentsRoutes.request(`/comments/${messageId}/${commentId}?expectedVersion=3`, {
      method: "DELETE", headers,
    });
    assert(deletion.status === 200, "Author deletion must use the transaction route");
    activeUserId = moderatorId;
    const mutationBodies = rpcBodies.filter((entry) => entry.name !== "consume_api_rate_limit");
    assert(mutationBodies.length === 3, "Mutation did not use the three protected RPCs");
    assert(mutationBodies[0].body.p_actor_id === moderatorId && mutationBodies[1].body.p_actor_id === moderatorId && mutationBodies[2].body.p_actor_id === authorId, "Actor must come from the current verified session");
    assert(mutationBodies.every((entry) => Number.isInteger(entry.body.p_expected_version)), "Mutation version missing");

    const missingVersion = await commentsRoutes.request(`/moderation/comments/${commentId}`, {
      method: "PUT", headers, body: JSON.stringify({ action: "hide", reason: "spam" }),
    });
    assert(missingVersion.status === 400, "Missing expectedVersion must be rejected");
    conflict = true;
    const stale = await commentsRoutes.request(`/moderation/comments/${commentId}`, {
      method: "PUT", headers, body: JSON.stringify({ action: "hide", reason: "spam", expectedVersion: 1 }),
    });
    assert(stale.status === 409, "Database version conflict must be exposed as 409");
    conflict = false;
    quotaAllowed = false;
    const throttled = await commentsRoutes.request(`/comments/${commentId}/reports`, {
      method: "POST", headers, body: JSON.stringify({ reason: "spam", detail: "" }),
    });
    assert(throttled.status === 429 && throttled.headers.get("Retry-After") === "37", "Account report quota must return Retry-After");
    assert(urls.some((url) => url.pathname.endsWith("/rpc/consume_api_rate_limit")), "Quota must use the shared database limiter");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
