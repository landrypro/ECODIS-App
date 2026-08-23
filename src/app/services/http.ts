import { functionsBaseUrl, publicAnonKey } from "../../../utils/supabase/info";

export const BASE = functionsBaseUrl;

export class ApiError extends Error {
  constructor(message: string, public readonly status: number) {
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
    const message = typeof data?.error === "string" ? data.error : `Request failed with status ${response.status}`;
    throw new ApiError(message, response.status);
  }

  return data as T;
}
