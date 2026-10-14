import { Hono } from "npm:hono";
import { handleApiError, ValidationError } from "../lib/errors.ts";
import { sanitizeErrorMessage, writeLog } from "../lib/observability.ts";
import { supabaseAdmin } from "../lib/supabase.ts";
import type { AppEnv } from "../app-env.ts";

export const observabilityRoutes = new Hono<AppEnv>();

observabilityRoutes.post("/observability/client-errors", async (c) => {
  try {
    const body = await c.req.json();
    const message = sanitizeErrorMessage(body?.message);
    if (!message || message === "undefined" || message === "null") {
      throw new ValidationError("Message d'erreur invalide");
    }
    const source = typeof body?.source === "string" ? body.source.slice(0, 160) : "window";
    const requestId = c.get("requestId");
    const { error } = await supabaseAdmin().from("client_error_logs").insert({
      message,
      source,
      path: typeof body?.path === "string" ? body.path.slice(0, 512) : "",
      user_agent: c.req.header("user-agent")?.slice(0, 512) ?? "",
      request_id: requestId,
    });
    if (error) throw error;
    writeLog("warn", "frontend_error_reported", { requestId, source });
    return c.json({ accepted: true, requestId }, 202);
  } catch (error) {
    return handleApiError(c, error, "Client error report");
  }
});
