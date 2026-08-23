import { Hono } from "npm:hono";
import { getAppConfig } from "../lib/app-config.ts";
import {
  ensureUserRoleRecord,
  getUserRoles,
  isMfaLevelTwo,
  replaceUserRoles,
  requireAdmin,
  requirePermission,
} from "../lib/auth.ts";
import { handleApiError, ValidationError } from "../lib/errors.ts";
import { logAudit } from "../lib/audit.ts";
import { getUser, supabaseAdmin, supabasePublicForRequest } from "../lib/supabase.ts";
import { validateEmail, validateOptionalString, validatePassword } from "../lib/validation.ts";
import { canAssignRequestedRoles, getPrimaryRole, normalizeRoles } from "../domain/authorization.ts";

export const authRoutes = new Hono();

authRoutes.post("/auth/signup", async (c) => {
  try {
    const config = await getAppConfig();
    if (!config.registrationEnabled) return c.json({ error: "Les inscriptions sont actuellement desactivees" }, 403);

    const { email, password, name } = await c.req.json();
    const validatedEmail = validateEmail(email);
    const validatedPassword = validatePassword(password);
    const validatedName = validateOptionalString(name, "Nom", 120) || validatedEmail.split("@")[0];
    const { data, error } = await supabasePublicForRequest(c.req.raw).auth.signUp({
      email: validatedEmail,
      password: validatedPassword,
      options: { data: { name: validatedName } },
    });
    if (error) return c.json({ error: `Signup error: ${error.message}` }, 400);

    const authorization = data.user ? await ensureUserRoleRecord(data.user, validatedName) : null;
    return c.json({
      user: data.user,
      role: authorization?.primaryRole ?? "user",
      roles: authorization?.roles ?? ["user"],
      session: data.session,
    });
  } catch (error) {
    return handleApiError(c, error, "Signup server error");
  }
});

authRoutes.get("/users/me/role", async (c) => {
  try {
    const user = await getUser(c.req.raw);
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    const authorization = await ensureUserRoleRecord(user);
    return c.json({ role: authorization.primaryRole, roles: authorization.roles, permissions: authorization.permissions });
  } catch (error) {
    return handleApiError(c, error, "Get role error");
  }
});

authRoutes.get("/users", async (c) => {
  try {
    const { user, error: authError } = await requireAdmin(c.req.raw);
    if (authError) return c.json({ error: authError }, user ? 403 : 401);

    const admin = supabaseAdmin();
    const { data: authData, error } = await admin.auth.admin.listUsers();
    if (error) return c.json({ error: `List users error: ${error.message}` }, 500);

    const [{ data: legacyRows, error: legacyError }, { data: assignmentRows, error: assignmentError }] = await Promise.all([
      admin.from("users_roles").select("*"),
      admin.from("user_role_assignments").select("user_id, role"),
    ]);
    if (legacyError) throw legacyError;
    if (assignmentError) throw assignmentError;
    const legacyByUser = new Map((legacyRows ?? []).map((row: any) => [row.user_id, row]));
    const rolesByUser = new Map<string, string[]>();
    for (const assignment of assignmentRows ?? []) {
      const roles = rolesByUser.get(assignment.user_id) ?? [];
      roles.push(assignment.role);
      rolesByUser.set(assignment.user_id, roles);
    }

    const users = (authData.users ?? []).map((item: any) => {
      const roles = normalizeRoles(rolesByUser.get(item.id) ?? (legacyByUser.get(item.id)?.role === "admin" ? ["admin"] : []));
      const legacy = legacyByUser.get(item.id);
      return {
        id: item.id,
        email: item.email ?? "",
        name: legacy?.name || item.user_metadata?.name || item.email?.split("@")[0] || "Disciple",
        role: getPrimaryRole(roles),
        roles,
        createdAt: item.created_at,
        lastSignIn: item.last_sign_in_at,
      };
    });
    return c.json({ users });
  } catch (error) {
    return handleApiError(c, error, "List users error");
  }
});

authRoutes.put("/users/:id/roles", async (c) => {
  try {
    const { user, authorization, error: authError } = await requirePermission(c.req.raw, "users_manage_basic_roles");
    if (authError) return c.json({ error: authError }, user ? 403 : 401);

    const targetUserId = c.req.param("id");
    const { roles: requestedRolesInput, reason } = await c.req.json();
    const requestedRoles = normalizeRoles(requestedRolesInput);
    const validatedReason = validateOptionalString(reason, "Motif", 500) || "Affectation de rôle P4.2";
    const admin = supabaseAdmin();
    const { data: target } = await admin.auth.admin.getUserById(targetUserId);
    if (!target.user) throw new ValidationError("Utilisateur introuvable", 404);
    const currentRoles = await getUserRoles(targetUserId);

    if (!canAssignRequestedRoles(authorization!.roles, currentRoles, requestedRoles)) {
      throw new ValidationError("Cette affectation de rôle n'est pas autorisée", 403);
    }
    if (requestedRoles.includes("admin") && !isMfaLevelTwo(c.req.raw)) {
      throw new ValidationError("Une session MFA AAL2 est requise pour attribuer le rôle administrateur", 403);
    }

    const updated = await replaceUserRoles(target.user, requestedRoles, user!.id, validatedReason);
    await logAudit(user!.id, user!.email || "", "role_assignments_update", "Rôles utilisateur mis à jour", {
      targetUserId,
      previousRoles: currentRoles,
      roles: updated.roles,
      reason: validatedReason,
    });
    return c.json({ success: true, role: updated.primaryRole, roles: updated.roles });
  } catch (error) {
    return handleApiError(c, error, "Update roles error");
  }
});

// Compatibilité temporaire avec le client P0-P3. Les rôles privilégiés restent protégés.
authRoutes.put("/users/:id/role", async (c) => {
  try {
    const { role } = await c.req.json();
    if (role !== "user" && role !== "admin") throw new ValidationError("Utilisez le point d'entrée /users/:id/roles");
    const { user, authorization, error: authError } = await requirePermission(c.req.raw, "users_manage_basic_roles");
    if (authError) return c.json({ error: authError }, user ? 403 : 401);
    const targetUserId = c.req.param("id");
    const admin = supabaseAdmin();
    const { data: target } = await admin.auth.admin.getUserById(targetUserId);
    if (!target.user) throw new ValidationError("Utilisateur introuvable", 404);
    const currentRoles = await getUserRoles(targetUserId);
    const requestedRoles = normalizeRoles(role === "admin" ? ["admin"] : []);
    if (!canAssignRequestedRoles(authorization!.roles, currentRoles, requestedRoles)) {
      throw new ValidationError("Cette affectation de rôle n'est pas autorisée", 403);
    }
    if (role === "admin" && !isMfaLevelTwo(c.req.raw)) {
      throw new ValidationError("Une session MFA AAL2 est requise pour attribuer le rôle administrateur", 403);
    }
    const updated = await replaceUserRoles(target.user, requestedRoles, user!.id, "Compatibilité rôle unique");
    await logAudit(user!.id, user!.email || "", "role_assignments_update", "Rôle utilisateur mis à jour", { targetUserId, roles: updated.roles });
    return c.json({ success: true, role: updated.primaryRole, roles: updated.roles });
  } catch (error) {
    return handleApiError(c, error, "Update role error");
  }
});

authRoutes.delete("/users/:id", async (c) => {
  try {
    const { user, authorization, error: authError } = await requirePermission(c.req.raw, "users_delete");
    if (authError) return c.json({ error: authError }, user ? 403 : 401);
    const targetUserId = c.req.param("id");
    if (targetUserId === user!.id) throw new ValidationError("Vous ne pouvez pas supprimer votre propre compte");
    const targetRoles = await getUserRoles(targetUserId);
    if (targetRoles.some((role) => role === "admin" || role === "super_admin") && !authorization!.roles.includes("super_admin")) {
      throw new ValidationError("Seul un super-administrateur peut supprimer un compte privilégié", 403);
    }
    if (targetRoles.includes("super_admin")) {
      throw new ValidationError("Un super-administrateur est géré par la procédure de gouvernance", 403);
    }
    const { error } = await supabaseAdmin().auth.admin.deleteUser(targetUserId);
    if (error) return c.json({ error: `Delete user error: ${error.message}` }, 500);
    await logAudit(user!.id, user!.email || "", "delete_user", "Utilisateur supprimé", { targetUserId });
    return c.json({ success: true });
  } catch (error) {
    return handleApiError(c, error, "Delete user error");
  }
});
