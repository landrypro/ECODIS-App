export class ValidationError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
    this.name = "ValidationError";
  }
}

import { sanitizeErrorMessage, writeLog } from "./observability.ts";

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
