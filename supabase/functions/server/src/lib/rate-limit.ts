import { RATE_LIMIT_ADMIN_MAX, RATE_LIMIT_AUTH_MAX, RATE_LIMIT_PUBLIC_MAX, RATE_LIMIT_WINDOW_SECONDS } from "../config.ts";
import { supabaseAdmin } from "./supabase.ts";
import { getClientIdentifier, maxForProfile, profileFor, type RateLimitSettings } from "../domain/rate-limit.ts";

export { getClientIdentifier, maxForProfile, profileFor } from "../domain/rate-limit.ts";

const defaultSettings: RateLimitSettings = {
  windowSeconds: RATE_LIMIT_WINDOW_SECONDS,
  publicMax: RATE_LIMIT_PUBLIC_MAX,
  authMax: RATE_LIMIT_AUTH_MAX,
  adminMax: RATE_LIMIT_ADMIN_MAX,
};

async function hashIdentifier(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function checkRateLimit(req: Request, settings: RateLimitSettings = defaultSettings) {
  const profile = profileFor(new URL(req.url).pathname);
  const limit = maxForProfile(profile, settings);
  const rateKey = await hashIdentifier(`${profile}:${getClientIdentifier(req)}`);
  const { data, error } = await supabaseAdmin().rpc("consume_api_rate_limit", {
    p_rate_key: rateKey,
    p_window_seconds: settings.windowSeconds,
    p_max_requests: limit,
  });

  if (error) throw new Error(`Distributed rate limiter unavailable: ${error.message}`);
  const result = Array.isArray(data) ? data[0] : data;
  if (!result || typeof result.allowed !== "boolean") {
    throw new Error("Distributed rate limiter returned an invalid response");
  }

  return {
    allowed: result.allowed,
    limit,
    remaining: Number(result.remaining),
    retryAfterSeconds: Number(result.retry_after_seconds),
  };
}
