import { BOOTSTRAP_ADMIN_EMAILS } from "../config.ts";
import { supabaseAdmin, getUser } from "./supabase.ts";

function getBootstrapRole(email?: string | null): "admin" | "user" {
  if (!email) return "user";
  return BOOTSTRAP_ADMIN_EMAILS.has(email.toLowerCase()) ? "admin" : "user";
}

export async function getUserRole(userId: string): Promise<string> {
  const { data } = await supabaseAdmin()
    .from("users_roles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();
  return data?.role ?? "user";
}

export async function ensureUserRoleRecord(user: any, fallbackName?: string) {
  const admin = supabaseAdmin();
  const { data: existing } = await admin
    .from("users_roles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  const desiredRole = existing?.role === "admin" ? "admin" : getBootstrapRole(user.email) === "admin" ? "admin" : existing?.role ?? "user";
  const payload = {
    user_id: user.id,
    email: user.email ?? "",
    name: fallbackName || user.user_metadata?.name || user.email?.split("@")[0] || "Disciple",
    role: desiredRole,
    updated_at: new Date().toISOString(),
  };

  if (!existing) {
    await admin.from("users_roles").insert({ ...payload, created_at: new Date().toISOString() });
  } else {
    await admin.from("users_roles").update(payload).eq("user_id", user.id);
  }

  return desiredRole;
}

export async function requireAdmin(req: Request) {
  const user = await getUser(req);
  if (!user) return { user: null, error: "Unauthorized" };
  const role = await ensureUserRoleRecord(user);
  if (role !== "admin") return { user, error: "Forbidden: admin role required" };
  return { user, error: null };
}
