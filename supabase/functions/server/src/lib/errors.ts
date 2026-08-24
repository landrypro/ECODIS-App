export class ValidationError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
    this.name = "ValidationError";
  }
}

import { sanitizeErrorMessage, writeLog } from "./observability.ts";

export type DeliveryErrorCategory = "rate_limited" | "unavailable" | "unexpected";

export class DeliveryError extends Error {
  constructor(
    public readonly publicMessage: string,
    public readonly status: 429 | 503 | 500,
    public readonly category: DeliveryErrorCategory,
    public readonly retryAfterSeconds?: number,
  ) {
    super(publicMessage);
    this.name = "DeliveryError";
  }
}

function errorProperty(error: unknown, property: string): unknown {
  return error && typeof error === "object" ? (error as Record<string, unknown>)[property] : undefined;
}

function getRetryAfterSeconds(error: unknown, fallback = 60): number {
  const value = Number(errorProperty(error, "retryAfterSeconds"));
  return Number.isFinite(value) && value > 0 ? Math.min(3600, Math.ceil(value)) : fallback;
}

/**
 * Traduit les erreurs de livraison Auth/fournisseur en réponses publiques
 * stables. Les messages bruts ne traversent jamais la frontière HTTP.
 */
export function mapAuthDeliveryError(error: unknown): DeliveryError {
  if (error instanceof DeliveryError) return error;

  const code = String(errorProperty(error, "code") ?? "").toLowerCase();
  const status = Number(errorProperty(error, "status") ?? errorProperty(error, "statusCode"));
  const message = sanitizeErrorMessage(error).toLowerCase();
  const isRateLimited = status === 429 || code === "over_email_send_rate_limit" ||
    code.includes("rate_limit") || message.includes("rate limit") || message.includes("too many requests");
  if (isRateLimited) {
    return new DeliveryError(
      "L'envoi d'e-mail est temporairement limité. Réessayez plus tard.",
      429,
      "rate_limited",
      getRetryAfterSeconds(error),
    );
  }

  const isUnavailable = status === 502 || status === 503 || status === 504 || error instanceof TypeError ||
    message.includes("fetch failed") || message.includes("network") || message.includes("timeout");
  if (isUnavailable) {
    return new DeliveryError(
      "Le service d'e-mail est temporairement indisponible. Réessayez plus tard.",
      503,
      "unavailable",
    );
  }

  return new DeliveryError("Une erreur interne est survenue. Reessayez plus tard.", 500, "unexpected");
}

export function handleDeliveryApiError(c: any, error: unknown, label: string) {
  const mapped = mapAuthDeliveryError(error);
  const requestId = c.get?.("requestId");
  const logFields = { requestId, label, status: mapped.status, category: mapped.category };
  writeLog(mapped.status === 500 ? "error" : "warn", "email_delivery_error", {
    ...logFields,
    ...(mapped.status === 500 ? { message: sanitizeErrorMessage(error) } : {}),
  });
  if (mapped.status === 429 && mapped.retryAfterSeconds) {
    c.header("Retry-After", String(mapped.retryAfterSeconds));
  }
  return c.json({
    error: mapped.publicMessage,
    ...(mapped.retryAfterSeconds ? { retryAfterSeconds: mapped.retryAfterSeconds } : {}),
    ...(mapped.status === 500 ? { requestId } : {}),
  }, mapped.status);
}

export function handleApiError(c: any, error: unknown, label: string) {
  if (error instanceof ValidationError) {
    return c.json({ error: error.message }, error.status);
  }
  writeLog("error", "api_error", {
    requestId: c.get?.("requestId"),
    label,
    message: sanitizeErrorMessage(error),
  });
  return c.json({ error: "Une erreur interne est survenue. Reessayez plus tard.", requestId: c.get?.("requestId") }, 500);
}
