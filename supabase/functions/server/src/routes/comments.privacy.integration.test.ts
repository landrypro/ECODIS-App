// HTTP route + real Supabase client serialization, with a fake transport.
// No real credentials, remote access or database mutation. SQL/RLS tests belong to MC-C/D.
for (const [key, value] of Object.entries({
  APP_API_PREFIX: "server/api", APP_STORAGE_BUCKET_NAME: "media",
  APP_ALLOWED_ORIGINS: "http://localhost:5173", APP_AUTH_REDIRECT_URL: "http://localhost:5173/reset-password",
  SUPABASE_URL: "http://127.0.0.1:54321", SUPABASE_SERVICE_ROLE_KEY: "test-only-service",
  SUPABASE_ANON_KEY: "test-only-anon",
})) Deno.env.set(key, value);

const { commentsRoutes } = await import("./comments.ts");

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

Deno.test("MC-B - public comments, counts and reports privacy contracts", async (t) => {
  const originalFetch = globalThis.fetch;
  let parentStatus = "published";
  let commentStatus = "visible";
  let owner = "author";
  let missing = false;
  let duplicate = false;
  let failRead = false;
  let writes = 0;
  const base = {
    id: "comment", message_id: "message", user_id: "author", user_name: "Author",
    user_email: "private@example.test", text: "visible text", status: "visible",
    created_at: "2026-10-14T12:00:00Z", moderation_reason: "private reason",
  };
  const calls: URL[] = [];
  globalThis.fetch = async (input, init) => {
    const request = new Request(input, init);
    const url = new URL(request.url);
    calls.push(url);
    assert(url.origin === "http://127.0.0.1:54321", "Unexpected transport destination");
    if (url.pathname === "/auth/v1/user") return Response.json({ id: "reporter", email: "reporter@example.test" });
    if (url.pathname.endsWith("/rpc/consume_api_rate_limit")) {
      return Response.json({ allowed: true, remaining: 4, retry_after_seconds: 60 });
    }
    if (url.pathname.endsWith("/rpc/create_comment_report_transaction")) {
      if (missing || parentStatus !== "published") return Response.json({ code: "PT404", message: "Comment unavailable" }, { status: 404 });
      if (commentStatus !== "visible" || duplicate) return Response.json({ code: "PT409", message: "Comment unavailable" }, { status: 409 });
      if (owner === "reporter") return Response.json({ code: "PT403", message: "Cannot report own comment" }, { status: 403 });
      writes++;
      return Response.json({ id: "report", comment_id: "comment", reporter_id: "reporter", reason: "spam", detail: "test", status: "open", version: 1, created_at: "2026-10-14T12:00:00Z" }, { status: 201 });
    }
    const table = url.pathname.split("/").at(-1);
    if (request.method === "POST") {
      writes++;
      assert(table === "comment_reports" || table === "audit_logs", "Unexpected write");
      const body = await request.json();
      return Response.json({ ...body, id: "report" }, { status: 201 });
    }
    if (table === "user_account_status") return Response.json([]);
    if (table === "messages") return Response.json(missing ? [] : [{ id: "message", status: parentStatus }]);
    if (table === "comment_reports") return Response.json(duplicate ? [{ id: "existing" }] : []);
    assert(table === "comments", "Unexpected table");
    if (failRead) return Response.json({ message: "database unavailable" }, { status: 500 });
    if (url.searchParams.has("id")) {
      return Response.json(missing ? [] : [{ ...base, user_id: owner, status: commentStatus }]);
    }
    assert(url.searchParams.get("status") === "eq.visible", "Missing comment visibility filter");
    assert(url.searchParams.get("messages.status") === "eq.published", "Missing parent visibility filter");
    assert(url.searchParams.get("select")?.includes("messages!inner(status)"), "Parent must be an inner join");
    const select = url.searchParams.get("select")!;
    assert(!select.includes("*") && !select.includes("user_email"), "Public query selects private data");
    // Deliberately return extra columns to verify the response allowlist too.
    return Response.json(parentStatus === "published" ? [base, { ...base, id: "second" }] : []);
  };
  const report = () => commentsRoutes.request("/comments/comment/reports", {
    method: "POST", headers: { Authorization: "Bearer test-user", "Content-Type": "application/json" },
    body: JSON.stringify({ reason: "spam", detail: "test" }),
  });
  try {
    for (const authenticated of [false, true]) {
      await t.step(`public list without private fields (${authenticated ? "member" : "anonymous"})`, async () => {
        const response = await commentsRoutes.request("/messages/message/comments", {
          headers: authenticated ? { Authorization: "Bearer test-user" } : {},
        });
        assert(response.status === 200, "List must succeed");
        const body = await response.json();
        assert(body.comments.length === 2, "Visible comments missing");
        const keys = ["id", "messageId", "userId", "userName", "text", "status", "createdAt"].sort();
        for (const item of body.comments) {
          assert(JSON.stringify(Object.keys(item).sort()) === JSON.stringify(keys), "Unexpected public field");
        }
      });
    }
    await t.step("counts expose only published visible entries", async () => {
      const response = await commentsRoutes.request("/comments/counts");
      assert(response.status === 200, "Counts must succeed");
      assert(JSON.stringify(await response.json()) === JSON.stringify({ counts: { message: 2 } }), "Counts regression");
    });
    for (const state of ["draft", "in_review", "scheduled", "archived"]) {
      await t.step(`unpublished parent ${state}: list, counts and reporting denied`, async () => {
        parentStatus = state;
        const before = writes;
        const list = await commentsRoutes.request("/messages/message/comments");
        assert(list.status === 404, "Nonpublic parent must be hidden");
        assert(!(await list.text()).includes("visible text"), "Text leaked in error");
        const counts = await commentsRoutes.request("/comments/counts");
        assert(JSON.stringify(await counts.json()) === '{"counts":{}}', "Nonpublic count leaked");
        const response = await report();
        assert(response.status === 404, "Nonpublic parent remains reportable");
        await response.body?.cancel();
        assert(writes === before, "Rejected report must not write");
      });
    }
    parentStatus = "published";
    for (const state of ["hidden", "deleted_by_author", "deleted_by_moderation"]) {
      await t.step(`report rejects ${state}`, async () => {
        commentStatus = state;
        const before = writes;
        const response = await report();
        assert(response.status === 409, "Nonvisible comment remains reportable");
        await response.body?.cancel();
        assert(writes === before, "Rejected report must not write");
      });
    }
    commentStatus = "visible";
    await t.step("self-report and duplicate protections remain", async () => {
      const before = writes;
      owner = "reporter";
      const own = await report();
      assert(own.status === 403, "Self report accepted");
      await own.body?.cancel();
      owner = "author";
      duplicate = true;
      const repeated = await report();
      assert(repeated.status === 409, "Duplicate accepted");
      await repeated.body?.cancel();
      duplicate = false;
      assert(writes === before, "Rejected report must not write");
    });
    await t.step("visible published comment can still be reported", async () => {
      const response = await report();
      assert(response.status === 201, "Valid report rejected");
      await response.body?.cancel();
    });
    await t.step("missing parent returns 404", async () => {
      missing = true;
      const response = await commentsRoutes.request("/messages/missing/comments");
      assert(response.status === 404, "Missing parent accepted");
      await response.body?.cancel();
      missing = false;
    });
    await t.step("database failure is not reported as a successful empty count", async () => {
      failRead = true;
      const response = await commentsRoutes.request("/comments/counts");
      assert(response.status === 500, "Read failure hidden");
      await response.body?.cancel();
      failRead = false;
    });
    assert(calls.length > 0, "No backend calls exercised");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
