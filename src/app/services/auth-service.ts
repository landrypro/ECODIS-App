import { fetchJson, jsonHeaders } from "./http";

interface SignupUser {
  id: string;
  email?: string | null;
}

interface SignupResponse {
  user: SignupUser | null;
  role: "user" | "content_editor" | "moderator" | "admin" | "super_admin";
  roles: Array<"user" | "content_editor" | "moderator" | "admin" | "super_admin">;
  session: unknown;
}

export async function signupUser(email: string, password: string, name: string) {
  return fetchJson<SignupResponse>("/auth/signup", {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify({ email, password, name }),
  });
}
