// MC-D — integration HTTP against a real, disposable local Supabase stack.
// The wrapper script provides only local URLs and keys through environment
// variables. Nothing in this test contacts the hosted project.

function required(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`Missing ${name}`);
  return value.replace(/\/$/, "");
}

const supabaseUrl = required("MC_D_SUPABASE_URL");
const functionUrl = required("MC_D_FUNCTION_URL");
const anonKey = required("MC_D_ANON_KEY");
const serviceRoleJwt = required("MC_D_SERVICE_ROLE_JWT");
const nonce = crypto.randomUUID().replaceAll("-", "");
const password = `Mcd-${nonce}-Pass!`;

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

async function json(response: Response) {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return text;
  }
}

async function expect(response: Response, status: number, label: string) {
  if (response.status === status) return json(response);
  throw new Error(`${label}: expected HTTP ${status}, got ${response.status}: ${JSON.stringify(await json(response))}`);
}

async function service(path: string, method: string, body?: unknown) {
  return fetch(`${supabaseUrl}${path}`, {
    method,
    headers: {
      // sb_secret_* is a gateway key, not a GoTrue/PostgREST Bearer JWT.
      // The wrapper generates this signed local service_role JWT from the
      // disposable stack's JWT_SECRET and keeps it out of the test output.
      apikey: anonKey,
      Authorization: `Bearer ${serviceRoleJwt}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

async function createUser(label: string) {
  const email = `mcd-${label}-${nonce}@example.invalid`;
  const body = await expect(
    await service("/auth/v1/admin/users", "POST", {
      email,
      password,
      email_confirm: true,
      user_metadata: { name: `MC-D ${label}` },
    }),
    200,
    `Create local ${label} user`,
  );
  assert(typeof body?.id === "string", `Create local ${label} user did not return an id`);

  const signIn = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: anonKey, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const session = await expect(signIn, 200, `Sign in local ${label} user`);
  assert(typeof session?.access_token === "string", `Sign in local ${label} user did not return an access token`);
  return { id: body.id as string, token: session.access_token as string };
}

async function insert(table: string, row: Record<string, unknown>) {
  const body = await expect(await service(`/rest/v1/${table}`, "POST", row), 201, `Insert ${table}`);
  assert(Array.isArray(body) && body.length === 1, `Insert ${table} did not return one row`);
  return body[0];
}

async function select(table: string, query: string) {
  return expect(await service(`/rest/v1/${table}?${query}`, "GET"), 200, `Select ${table}`);
}

async function api(path: string, token: string, method = "GET", body?: unknown) {
  return fetch(`${functionUrl}${path}`, {
    method,
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

const author = await createUser("author");
const reporter = await createUser("reporter");
const quotaReporter = await createUser("quota");
const moderator = await createUser("moderator");

await insert("user_role_assignments", {
  user_id: moderator.id,
  role: "moderator",
  assignment_reason: "MC-D local HTTP integration",
});

const message = await insert("messages", {
  type: "text",
  title: `MC-D local ${nonce}`,
  author: "MC-D test",
  category: "test",
  status: "published",
  user_id: author.id,
});
assert(typeof message?.id === "string", "Seed message did not return an id");

const initialComment = await insert("comments", {
  message_id: message.id,
  user_id: author.id,
  user_name: "MC-D author",
  user_email: "mcd-author-private@example.invalid",
  text: "Commentaire destiné au test de transaction MC-D.",
  status: "visible",
});
assert(typeof initialComment?.id === "string", "Seed comment did not return an id");

const publicList = await expect(
  await api(`/messages/${message.id}/comments`, anonKey),
  200,
  "Public comment list",
);
const publicComment = publicList?.comments?.find((comment: { id?: string }) => comment.id === initialComment.id);
assert(publicComment, "Public comment list did not contain the visible comment");
assert(!("userEmail" in publicComment) && !("version" in publicComment), "Public comment leaked a private field");

const createdReport = await expect(
  await api(`/comments/${initialComment.id}/reports`, reporter.token, "POST", { reason: "spam", detail: "MC-D local report" }),
  201,
  "Create report through HTTP API",
);
assert(typeof createdReport?.report?.id === "string" && createdReport.report.version === 1, "Report transaction response is invalid");
const reportId = createdReport.report.id as string;

const reports = await expect(
  await api(`/moderation/reports?reportStatus=open&messageId=${message.id}&limit=1`, moderator.token),
  200,
  "Read moderation reports",
);
assert(reports?.items?.length === 1 && reports.items[0].id === reportId, "Moderator could not read the paginated report");
assert(reports.items[0].comment?.userEmail === "mcd-author-private@example.invalid", "Protected report DTO is incomplete");

const deniedReports = await api("/moderation/reports", reporter.token);
await expect(deniedReports, 403, "Deny report list to non-moderator");

const hidden = await expect(
  await api(`/moderation/comments/${initialComment.id}`, moderator.token, "PUT", {
    action: "hide",
    reason: "MC-D local moderation",
    expectedVersion: 1,
  }),
  200,
  "Hide comment through transaction",
);
assert(hidden?.comment?.status === "hidden" && hidden.comment.version === 2, "Comment transaction response is invalid");

const stale = await api(`/moderation/comments/${initialComment.id}`, moderator.token, "PUT", {
  action: "delete",
  reason: "stale command",
  expectedVersion: 1,
});
await expect(stale, 409, "Expose stale comment version as conflict");

const events = await expect(
  await api(`/moderation/comments/${initialComment.id}/events?limit=10`, moderator.token),
  200,
  "Read protected moderation history",
);
const actions = new Set((events?.items ?? []).map((event: { action?: string }) => event.action));
assert(actions.has("hide") && actions.has("report_auto_resolved"), "History does not contain the atomic moderation events");

const persistedComment = await select("comments", `id=eq.${initialComment.id}&select=status,version`);
assert(persistedComment?.[0]?.status === "hidden" && persistedComment[0].version === 2, "Comment transaction was not persisted");
const persistedReport = await select("comment_reports", `id=eq.${reportId}&select=status,version,reviewed_by`);
assert(
  persistedReport?.[0]?.status === "resolved" && persistedReport[0].version === 2 && persistedReport[0].reviewed_by === moderator.id,
  "Associated report was not atomically resolved",
);

const afterHide = await expect(
  await api(`/messages/${message.id}/comments`, anonKey),
  200,
  "Public comment list after moderation",
);
assert(!afterHide?.comments?.some((comment: { id?: string }) => comment.id === initialComment.id), "Hidden comment is still public");

// A distinct account tests the persisted per-account quota independently from
// the first report. The first five reports succeed; the sixth is throttled.
const quotaComments: Array<{ id: string }> = [];
for (let index = 0; index < 6; index += 1) {
  const row = await insert("comments", {
    message_id: message.id,
    user_id: author.id,
    user_name: "MC-D author",
    user_email: "mcd-author-private@example.invalid",
    text: `Commentaire quota MC-D ${index}`,
    status: "visible",
  });
  quotaComments.push({ id: row.id as string });
}
for (const comment of quotaComments.slice(0, 5)) {
  await expect(
    await api(`/comments/${comment.id}/reports`, quotaReporter.token, "POST", { reason: "other", detail: "quota test" }),
    201,
    "Accept report before account quota",
  );
}
const throttled = await api(`/comments/${quotaComments[5].id}/reports`, quotaReporter.token, "POST", { reason: "other", detail: "quota test" });
await expect(throttled, 429, "Apply per-account report quota");
assert(Number(throttled.headers.get("Retry-After")) > 0, "Quota response has no Retry-After header");

console.log("PASS: MC-D real local HTTP/API/RPC integration");
