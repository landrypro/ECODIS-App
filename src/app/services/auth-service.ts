import { fetchJson, jsonHeaders } from "./http";

export async function signupUser(email: string, password: string, name: string) {
  return fetchJson<{ user: unknown; role: string; session: unknown }>("/auth/signup", {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify({ email, password, name }),
  });
}
