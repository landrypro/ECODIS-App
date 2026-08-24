import { functionsBaseUrl, publicAnonKey } from "../../../utils/supabase/info";

export const BASE = functionsBaseUrl;
export const SESSION_REJECTED_EVENT = "ecodis:session-rejected";

export class ApiError extends Error {
  constructor(message: string, public readonly status: number, public readonly retryAfterSeconds?: number) {
    super(message);
    this.name = "ApiError";
  }
}

export function getHeaders(accessToken?: string | null): HeadersInit {
  return {
    Authorization: `Bearer ${accessToken || publicAnonKey}`,
  };
}

export function jsonHeaders(accessToken?: string | null): HeadersInit {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${accessToken || publicAnonKey}`,
  };
}

export async function fetchJson<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${BASE}${path}`, init);
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    if (response.status === 401 && typeof window !== "undefined") {
      window.dispatchEvent(new Event(SESSION_REJECTED_EVENT));
    }
    const message = typeof data?.error === "string" ? data.error : `Request failed with status ${response.status}`;
    const bodyRetryAfter = Number(data?.retryAfterSeconds);
    const headerRetryAfter = Number(response.headers.get("Retry-After"));
    const retryAfterSeconds = Number.isFinite(bodyRetryAfter) && bodyRetryAfter > 0
      ? bodyRetryAfter
      : Number.isFinite(headerRetryAfter) && headerRetryAfter > 0
      ? headerRetryAfter
      : undefined;
    throw new ApiError(message, response.status, retryAfterSeconds);
  }

  return data as T;
}
