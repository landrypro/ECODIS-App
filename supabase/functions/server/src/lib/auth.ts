import { BOOTSTRAP_ADMIN_EMAILS, BOOTSTRAP_SUPER_ADMIN_EMAILS, REQUIRE_ADMIN_MFA } from "../config.ts";
import {
  type AppRole,
  type Permission,
  canEditOwnedContent,
  getPermissions,
  getPrimaryRole,
  hasPermission,
  normalizeRoles,
} from "../domain/authorization.ts";
import { supabaseAdmin, getUser } from "./supabase.ts";

export interface Authorization {
  roles: AppRole[];
  permissions: Permission[];
  primaryRole: AppRole;
}

function bootstrapRoles(email?: string | null): AppRole[] {
  const normalizedEmail = email?.toLowerCase() ?? "";
  if (BOOTSTRAP_SUPER_ADMIN_EMAILS.has(normalizedEmail)) return ["user", "super_admin"];
  if (BOOTSTRAP_ADMIN_EMAILS.has(normalizedEmail)) return ["user", "admin"];
  return ["user"];
}

function authorizationFromRoles(roles: AppRole[]): Authorization {
  const normalized = normalizeRoles(roles);
  return { roles: normalized, permissions: getPermissions(normalized), primaryRole: getPrimaryRole(normalized) };
}

export async function getUserRoles(userId: string): Promise<AppRole[]> {
  const { data, error } = await supabaseAdmin().from("user_role_assignments").select("role").eq("user_id", userId);
  if (error) throw error;
  return normalizeRoles((data ?? []).map((row: { role: string }) => row.role));
}

export async function ensureUserRoleRecord(user: any, fallbackName?: string): Promise<Authorization> {
  const admin = supabaseAdmin();
  const { data: legacy, error: legacyError } = await admin.from("users_roles").select("*").eq("user_id", user.id).maybeSingle();
  if (legacyError) throw legacyError;

  const { data: assignments, error: assignmentsError } = await admin.from("user_role_assignments").select("role").eq("user_id", user.id);
  if (assignmentsError) throw assignmentsError;

  const roles = normalizeRoles([
    ...(assignments ?? []).map((assignment: { role: string }) => assignment.role),
    ...(legacy?.role === "admin" ? ["admin"] : []),
    ...bootstrapRoles(user.email),
  ]);
  const now = new Date().toISOString();
  const existingRoles = new Set((assignments ?? []).map((assignment: { role: string }) => assignment.role));
  const missingRoles = roles.filter((role) => !existingRoles.has(role));
  if (missingRoles.length > 0) {
    const { error } = await admin.from("user_role_assignments").insert(
      missingRoles.map((role) => ({ user_id: user.id, role, assignment_reason: "bootstrap_or_migration", created_at: now })),
    );
    if (error) throw error;
  }

  const primaryRole = getPrimaryRole(roles);
  const legacyRole = primaryRole === "admin" || primaryRole === "super_admin" ? "admin" : "user";
  const payload = {
    user_id: user.id,
    email: user.email ?? "",
    name: fallbackName || legacy?.name || user.user_metadata?.name || user.email?.split("@")[0] || "Disciple",
    role: legacyRole,
    updated_at: now,
  };
  const { error: roleError } = await admin.from("users_roles").upsert(
    legacy ? payload : { ...payload, created_at: now },
    { onConflict: "user_id" },
  );
  if (roleError) throw roleError;
  return authorizationFromRoles(roles);
}

export async function getUserAuthorization(user: any): Promise<Authorization> {
  return ensureUserRoleRecord(user);
}

export async function getUserRole(userId: string): Promise<AppRole> {
  return getPrimaryRole(await getUserRoles(userId));
}

export async function replaceUserRoles(
  targetUser: { id: string; email?: string | null; user_metadata?: { name?: string } },
  roles: AppRole[],
  actorId: string,
  reason: string,
): Promise<Authorization> {
  const normalizedRoles = normalizeRoles(roles);
  const admin = supabaseAdmin();
  const { data: existingAssignments, error: existingAssignmentsError } = await admin
    .from("user_role_assignments")
    .select("role")
    .eq("user_id", targetUser.id);
  if (existingAssignmentsError) throw existingAssignmentsError;
  const persistedRoles = (existingAssignments ?? []).map((assignment: { role: AppRole }) => assignment.role);
  const rolesToAdd = normalizedRoles.filter((role) => !persistedRoles.includes(role));
  const rolesToRemove = persistedRoles.filter((role) => !normalizedRoles.includes(role));
  if (rolesToAdd.length > 0) {
    const { error: insertError } = await admin.from("user_role_assignments").insert(
      rolesToAdd.map((role) => ({ user_id: targetUser.id, role, assigned_by: actorId, assignment_reason: reason, created_at: new Date().toISOString() })),
    );
    if (insertError) throw insertError;
  }
  if (rolesToRemove.length > 0) {
    const { error: deleteError } = await admin.from("user_role_assignments").delete().eq("user_id", targetUser.id).in("role", rolesToRemove);
    if (deleteError) throw deleteError;
  }

  const authorization = authorizationFromRoles(normalizedRoles);
  const legacyRole = authorization.primaryRole === "admin" || authorization.primaryRole === "super_admin" ? "admin" : "user";
  const { error: legacyError } = await admin.from("users_roles").upsert({
    user_id: targetUser.id,
    email: targetUser.email ?? "",
    name: targetUser.user_metadata?.name || targetUser.email?.split("@")[0] || "Disciple",
    role: legacyRole,
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id" });
  if (legacyError) throw legacyError;
  return authorization;
}

export async function requirePermission(req: Request, permission: Permission) {
  const user = await getUser(req);
  if (!user) return { user: null, authorization: null, error: "Unauthorized" };
  const authorization = await ensureUserRoleRecord(user);
  if (!hasPermission(authorization.roles, permission)) {
    return { user, authorization, error: `Forbidden: permission ${permission} required` };
  }
  if (REQUIRE_ADMIN_MFA && authorization.roles.some((role) => role === "admin" || role === "super_admin") && getAssuranceLevel(req) !== "aal2") {
    return { user, authorization, error: "MFA required for administrator access" };
  }
  return { user, authorization, error: null };
}

export async function requireAdmin(req: Request) {
  return requirePermission(req, "access_admin");
}

export function canEditContent(authorization: Authorization, contentOwnerId: string | null | undefined, actorId: string): boolean {
  return canEditOwnedContent(authorization.roles, contentOwnerId, actorId);
}

export function isMfaLevelTwo(req: Request): boolean {
  return getAssuranceLevel(req) === "aal2";
}

function getAssuranceLevel(req: Request): string | null {
  const token = req.headers.get("Authorization")?.split(" ")[1];
  if (!token) return null;
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const decoded = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
    return typeof decoded.aal === "string" ? decoded.aal : null;
  } catch {
    return null;
  }
}
