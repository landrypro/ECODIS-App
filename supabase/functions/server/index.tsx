import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { API_PREFIX, ALLOWED_ORIGINS } from "./src/config.ts";
import { ensureStorageBucket } from "./src/lib/supabase.ts";
import { checkRateLimit } from "./src/lib/rate-limit.ts";
import { createRequestId, writeLog } from "./src/lib/observability.ts";
import { authRoutes } from "./src/routes/auth.ts";
import { messagesRoutes } from "./src/routes/messages.ts";
import { commentsRoutes } from "./src/routes/comments.ts";
import { favoritesRoutes } from "./src/routes/favorites.ts";
import { seriesRoutes } from "./src/routes/series.ts";
import { adminRoutes } from "./src/routes/admin.ts";
import { healthRoutes } from "./src/routes/health.ts";
import { observabilityRoutes } from "./src/routes/observability.ts";
import { offlineRoutes } from "./src/routes/offline.ts";
import type { AppEnv } from "./src/app-env.ts";

const app = new Hono<AppEnv>();

function isAllowedOrigin(origin: string | undefined | null): boolean {
  if (!origin) return true;
  return ALLOWED_ORIGINS.includes(origin);
}

app.use("*", async (c, next) => {
  const providedRequestId = c.req.header("x-request-id");
  const requestId = providedRequestId && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(providedRequestId)
    ? providedRequestId
    : createRequestId();
  const startedAt = performance.now();
  c.set("requestId", requestId);
  c.header("X-Request-Id", requestId);
  await next();
  writeLog("info", "http_request", {
    requestId,
    method: c.req.method,
    path: new URL(c.req.url).pathname,
    status: c.res.status,
    durationMs: Math.round(performance.now() - startedAt),
  });
});
app.use("/*", async (c, next) => {
  const origin = c.req.header("origin");
  if (!isAllowedOrigin(origin)) {
    return c.json({ error: "Origin not allowed" }, 403);
  }
  await next();
});
app.use("/*", async (c, next) => {
  let result;
  try {
    result = await checkRateLimit(c.req.raw);
  } catch (error) {
    writeLog("error", "rate_limit_unavailable", {
      requestId: c.get("requestId"),
      path: new URL(c.req.url).pathname,
      error: error instanceof Error ? error.message : "Unknown rate limit error",
    });
    return c.json({ error: "Service de protection temporairement indisponible." }, 503);
  }
  c.header("X-RateLimit-Limit", String(result.limit));
  c.header("X-RateLimit-Remaining", String(result.remaining));
  if (!result.allowed) {
    c.header("Retry-After", String(result.retryAfterSeconds));
    writeLog("warn", "rate_limit_exceeded", { requestId: c.get("requestId"), path: new URL(c.req.url).pathname });
    return c.json({ error: "Trop de requetes. Reessayez plus tard." }, 429);
  }
  await next();
});
app.use(
  "/*",
  cors({
    origin: (origin) => (isAllowedOrigin(origin) ? origin : ""),
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

app.route(API_PREFIX, healthRoutes);
app.route(API_PREFIX, observabilityRoutes);
app.route(API_PREFIX, authRoutes);
app.route(API_PREFIX, messagesRoutes);
app.route(API_PREFIX, commentsRoutes);
app.route(API_PREFIX, favoritesRoutes);
app.route(API_PREFIX, seriesRoutes);
app.route(API_PREFIX, adminRoutes);
app.route(API_PREFIX, offlineRoutes);

await ensureStorageBucket();

Deno.serve(app.fetch);
