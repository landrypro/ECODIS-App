import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import { API_PREFIX, ALLOWED_ORIGINS } from "./src/config.ts";
import { ensureStorageBucket } from "./src/lib/supabase.ts";
import { authRoutes } from "./src/routes/auth.ts";
import { messagesRoutes } from "./src/routes/messages.ts";
import { commentsRoutes } from "./src/routes/comments.ts";
import { favoritesRoutes } from "./src/routes/favorites.ts";
import { seriesRoutes } from "./src/routes/series.ts";
import { adminRoutes } from "./src/routes/admin.ts";
import { healthRoutes } from "./src/routes/health.ts";

const app = new Hono();

function isAllowedOrigin(origin: string | undefined | null): boolean {
  if (!origin) return true;
  return ALLOWED_ORIGINS.includes(origin);
}

app.use("*", logger(console.log));
app.use("/*", async (c, next) => {
  const origin = c.req.header("origin");
  if (!isAllowedOrigin(origin)) {
    return c.json({ error: "Origin not allowed" }, 403);
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
app.route(API_PREFIX, authRoutes);
app.route(API_PREFIX, messagesRoutes);
app.route(API_PREFIX, commentsRoutes);
app.route(API_PREFIX, favoritesRoutes);
app.route(API_PREFIX, seriesRoutes);
app.route(API_PREFIX, adminRoutes);

await ensureStorageBucket();

Deno.serve(app.fetch);
