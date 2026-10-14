export function createRequestId(): string {
  return crypto.randomUUID();
}

export function writeLog(level: "info" | "warn" | "error", event: string, fields: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ timestamp: new Date().toISOString(), level, event, ...fields }));
}

export function sanitizeErrorMessage(value: unknown): string {
  const message = value instanceof Error ? value.message : String(value);
  return message
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [redacted]")
    .replace(/(access_token|refresh_token|token|apikey)=([^\s&]+)/gi, "$1=[redacted]")
    .slice(0, 1000);
}
