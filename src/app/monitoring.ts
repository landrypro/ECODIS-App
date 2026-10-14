import { BASE, getHeaders } from "./services/http";

let installed = false;

function safeMessage(value: unknown): string {
  const message = value instanceof Error ? value.message : String(value);
  return message
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [redacted]")
    .replace(/(access_token|refresh_token|token|apikey)=([^\s&]+)/gi, "$1=[redacted]")
    .slice(0, 1000);
}

function report(message: string, source: string) {
  void fetch(`${BASE}/observability/client-errors`, {
    method: "POST",
    headers: { ...getHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ message: safeMessage(message), source, path: window.location.pathname }),
    keepalive: true,
  }).catch(() => undefined);
}

export function installFrontendMonitoring() {
  if (installed || import.meta.env.DEV) return;
  installed = true;
  window.addEventListener("error", (event) => report(event.error ?? event.message, "window.error"));
  window.addEventListener("unhandledrejection", (event) => report(event.reason, "window.unhandledrejection"));
}
