import { Hono } from "npm:hono";
import { AUTH_REDIRECT_URL, INVITATION_RESEND_COOLDOWN_SECONDS } from "../config.ts";
import { getAppConfig } from "../lib/app-config.ts";
import {
  ensureUserRoleRecord,
  getUserRoles,
  isMfaLevelTwo,
  replaceUserRoles,
  requireAdmin,
  requirePermission,
} from "../lib/auth.ts";
import { DeliveryError, handleApiError, handleDeliveryApiError, mapAuthDeliveryError, ValidationError } from "../lib/errors.ts";
import { logAudit } from "../lib/audit.ts";
import { getInvitationDeliveryGateway } from "../lib/invitation-delivery.ts";
import { getUser, supabaseAdmin, supabasePublic, supabasePublicForRequest } from "../lib/supabase.ts";
import { validateAccountStatus, validateEmail, validateOptionalString, validatePassword, validateRequiredString } from "../lib/validation.ts";
import { canManageAccountStatus, canManageRoleAssignment, getPermissions, getPrimaryRole, normalizeRoles } from "../domain/authorization.ts";
import type { AppEnv } from "../app-env.ts";

export const authRoutes = new Hono<AppEnv>();

async function claimInvitationDeliveryAttempt(targetUserId: string, actorUserId: string, idempotencyKey: string) {
  const { data, error } = await supabaseAdmin().rpc("claim_invitation_delivery_attempt", {
    p_target_user_id: targetUserId,
    p_actor_user_id: actorUserId,
    p_cooldown_seconds: INVITATION_RESEND_COOLDOWN_SECONDS,
    p_idempotency_key: idempotencyKey,
  }).single();
  if (error) throw error;
  const attempt = data as { accepted?: boolean; retry_after_seconds?: number } | null;
  if (!attempt?.accepted) {
    throw new DeliveryError(
      "L'envoi d'e-mail est temporairement limité. Réessayez plus tard.",
      429,
      "rate_limited",
      Math.max(1, Number(attempt?.retry_after_seconds) || INVITATION_RESEND_COOLDOWN_SECONDS),
    );
  }
}

async function updateInvitationDeliveryStatus(targetUserId: string, status: "accepted" | "throttled" | "failed", retryAfterSeconds = 0) {
  // Une erreur de journalisation technique ne doit jamais masquer le résultat e-mail.
  const update: Record<string, unknown> = { last_status: status, updated_at: new Date().toISOString() };
  if (retryAfterSeconds > 0) {
    update.next_allowed_at = new Date(Date.now() + retryAfterSeconds * 1000).toISOString();
  }
  await supabaseAdmin().from("invitation_delivery_attempts")
    .update(update)
    .eq("target_user_id", targetUserId)
    .eq("delivery_type", "invite");
}

async function auditInvitationDeliveryFailure(
  actor: { id: string; email?: string | null },
  targetUserId: string,
  targetEmailDomain: string,
  error: unknown,
  requestId: string | undefined,
) {
  const mapped = mapAuthDeliveryError(error);
  if (mapped.status === 429) {
    await updateInvitationDeliveryStatus(targetUserId, "throttled", mapped.retryAfterSeconds);
    await logAudit(actor.id, actor.email || "", "user_invitation_resend_throttled", "Renvoi d'invitation temporairement limité", {
      targetUserId,
      targetEmailDomain,
      retryAfterSeconds: mapped.retryAfterSeconds,
      requestId,
    });
  } else {
    await updateInvitationDeliveryStatus(targetUserId, "failed");
    await logAudit(actor.id, actor.email || "", "user_invitation_delivery_failed", "Échec technique du renvoi d'invitation", {
      targetUserId,
      targetEmailDomain,
      category: mapped.category,
      requestId,
    });
  }
}

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

    // Lorsque la confirmation d'email est active, Supabase masque un compte
    // déjà confirmé en renvoyant un utilisateur obfusqué sans identité.
    // Ne jamais provisionner cet identifiant factice dans les tables métier.
    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      throw new ValidationError("Un compte avec cet email existe deja.", 409);
    }

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

authRoutes.put("/users/me/profile", async (c) => {
  try {
    const user = await getUser(c.req.raw);
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const { name } = await c.req.json();
    const validatedName = validateRequiredString(name, "Nom", 2, 120);
    const { data, error } = await supabaseAdmin().auth.admin.updateUserById(user.id, {
      user_metadata: { ...(user.user_metadata ?? {}), name: validatedName },
    });
    if (error) throw error;

    await ensureUserRoleRecord(data.user ?? user, validatedName);
    await logAudit(user.id, user.email || "", "profile_updated", "Profil personnel mis à jour", {
      fields: ["name"],
    });

    return c.json({ user: { id: user.id, name: validatedName } });
  } catch (error) {
    return handleApiError(c, error, "Update own profile error");
  }
});

authRoutes.get("/users", async (c) => {
  try {
    const { user, error: authError } = await requireAdmin(c.req.raw);
    if (authError) return c.json({ error: authError }, user ? 403 : 401);

    const admin = supabaseAdmin();
    const { data: authData, error } = await admin.auth.admin.listUsers();
    if (error) return c.json({ error: `List users error: ${error.message}` }, 500);

    const [{ data: legacyRows, error: legacyError }, { data: assignmentRows, error: assignmentError }, { data: statusRows, error: statusError }] = await Promise.all([
      admin.from("users_roles").select("*"),
      admin.from("user_role_assignments").select("user_id, role"),
      admin.from("user_account_status").select("user_id, status, suspension_reason, suspended_at, suspension_expires_at"),
    ]);
    if (legacyError) throw legacyError;
    if (assignmentError) throw assignmentError;
    if (statusError) throw statusError;
    const legacyByUser = new Map((legacyRows ?? []).map((row: any) => [row.user_id, row]));
    const rolesByUser = new Map<string, string[]>();
    for (const assignment of assignmentRows ?? []) {
      const roles = rolesByUser.get(assignment.user_id) ?? [];
      roles.push(assignment.role);
      rolesByUser.set(assignment.user_id, roles);
    }
    const statusByUser = new Map((statusRows ?? []).map((row: any) => [row.user_id, row]));

    const users = (authData.users ?? []).map((item: any) => {
      const roles = normalizeRoles(rolesByUser.get(item.id) ?? (legacyByUser.get(item.id)?.role === "admin" ? ["admin"] : []));
      const legacy = legacyByUser.get(item.id);
      const accountStatus = statusByUser.get(item.id);
      return {
        id: item.id,
        email: item.email ?? "",
        name: legacy?.name || item.user_metadata?.name || item.email?.split("@")[0] || "Disciple",
        role: getPrimaryRole(roles),
        roles,
        permissions: getPermissions(roles),
        createdAt: item.created_at,
        lastSignIn: item.last_sign_in_at,
        emailConfirmedAt: item.email_confirmed_at ?? null,
        invitedAt: item.invited_at ?? null,
        accountStatus: accountStatus?.status === "suspended" ? "suspended" : "active",
        suspensionReason: accountStatus?.suspension_reason ?? null,
        suspendedAt: accountStatus?.suspended_at ?? null,
        suspensionExpiresAt: accountStatus?.suspension_expires_at ?? null,
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
    const validatedReason = validateRequiredString(reason, "Motif", 10, 500);
    const admin = supabaseAdmin();
    const { data: target } = await admin.auth.admin.getUserById(targetUserId);
    if (!target.user) throw new ValidationError("Utilisateur introuvable", 404);
    const currentRoles = await getUserRoles(targetUserId);

    if (!canManageRoleAssignment(user!.id, targetUserId, authorization!.roles, currentRoles, requestedRoles)) {
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
    if (!canManageRoleAssignment(user!.id, targetUserId, authorization!.roles, currentRoles, requestedRoles)) {
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

authRoutes.put("/users/:id/status", async (c) => {
  try {
    const { user, authorization, error: authError } = await requirePermission(c.req.raw, "users_manage_basic_roles");
    if (authError) return c.json({ error: authError }, user ? 403 : 401);
    const targetUserId = c.req.param("id");
    const { status: requestedStatus, reason } = await c.req.json();
    const status = validateAccountStatus(requestedStatus);
    const validatedReason = validateRequiredString(reason, "Motif", 10, 500);
    const admin = supabaseAdmin();
    const { data: target } = await admin.auth.admin.getUserById(targetUserId);
    if (!target.user) throw new ValidationError("Utilisateur introuvable", 404);
    const targetRoles = await getUserRoles(targetUserId);
    if (!canManageAccountStatus(user!.id, targetUserId, authorization!.roles, targetRoles)) {
      throw new ValidationError("Cette modification de statut n'est pas autorisée", 403);
    }

    if (status === "suspended") {
      const { error: banError } = await admin.auth.admin.updateUserById(targetUserId, { ban_duration: "876000h" });
      if (banError) throw banError;
      const { error: statusError } = await admin.from("user_account_status").upsert({
        user_id: targetUserId,
        status: "suspended",
        suspension_reason: validatedReason,
        suspended_at: new Date().toISOString(),
        suspended_by: user!.id,
        suspension_expires_at: null,
        reactivated_at: null,
        reactivated_by: null,
        reactivation_reason: null,
      }, { onConflict: "user_id" });
      if (statusError) throw statusError;
      const { error: revokeError } = await admin.rpc("revoke_user_sessions", { p_user_id: targetUserId });
      if (revokeError) throw revokeError;
      await logAudit(user!.id, user!.email || "", "user_suspended", "Utilisateur suspendu", { targetUserId, reason: validatedReason });
      return c.json({ status: "suspended", message: "Le compte est suspendu et ses sessions ont été révoquées." });
    }

    const { error: unbanError } = await admin.auth.admin.updateUserById(targetUserId, { ban_duration: "none" });
    if (unbanError) throw unbanError;
    const { error: statusError } = await admin.from("user_account_status").upsert({
      user_id: targetUserId,
      status: "active",
      suspension_reason: null,
      suspended_at: null,
      suspended_by: null,
      suspension_expires_at: null,
      reactivated_at: new Date().toISOString(),
      reactivated_by: user!.id,
      reactivation_reason: validatedReason,
    }, { onConflict: "user_id" });
    if (statusError) throw statusError;
    await logAudit(user!.id, user!.email || "", "user_reactivated", "Utilisateur réactivé", { targetUserId, reason: validatedReason });
    return c.json({ status: "active", message: "Le compte est réactivé. Le titulaire devra se reconnecter." });
  } catch (error) {
    return handleApiError(c, error, "Update account status error");
  }
});

authRoutes.post("/users/invitations", async (c) => {
  try {
    const { user, error: authError } = await requirePermission(c.req.raw, "users_manage_basic_roles");
    if (authError) return c.json({ error: authError }, user ? 403 : 401);
    const { email, name } = await c.req.json();
    const validatedEmail = validateEmail(email);
    const validatedName = validateRequiredString(name, "Nom", 2, 120);
    const admin = supabaseAdmin();
    const { data: existing } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const existingUser = existing.users?.find((item) => item.email?.toLowerCase() === validatedEmail);
    if (existingUser) {
      throw new ValidationError(existingUser.email_confirmed_at
        ? "Un compte confirmé existe déjà pour cette adresse. Utilisez le lien de réinitialisation."
        : "Une invitation est déjà en attente pour cette adresse. Utilisez « Renvoyer l'invitation »." , 409);
    }
    const { data, error } = await admin.auth.admin.inviteUserByEmail(validatedEmail, {
      data: { name: validatedName },
      redirectTo: AUTH_REDIRECT_URL,
    });
    if (error) throw error;
    if (data.user) await ensureUserRoleRecord(data.user, validatedName);
    await logAudit(user!.id, user!.email || "", "user_invitation_sent", "Invitation utilisateur envoyée", {
      targetUserId: data.user?.id ?? null,
      targetEmailDomain: validatedEmail.split("@")[1],
    });
    return c.json({ accepted: true, message: "L'invitation a été envoyée à l'adresse indiquée." }, 202);
  } catch (error) {
    return error instanceof ValidationError
      ? handleApiError(c, error, "Send invitation error")
      : handleDeliveryApiError(c, error, "Send invitation error");
  }
});

authRoutes.post("/users/:id/invitation", async (c) => {
  let actor: { id: string; email?: string | null } | null = null;
  let targetUserId = "";
  let targetEmailDomain = "";
  let claimedAttempt = false;
  try {
    const { user, error: authError } = await requirePermission(c.req.raw, "users_manage_basic_roles");
    if (authError) return c.json({ error: authError }, user ? 403 : 401);
    actor = user!;
    targetUserId = c.req.param("id");
    const admin = supabaseAdmin();
    const { data: target } = await admin.auth.admin.getUserById(targetUserId);
    if (!target.user) throw new ValidationError("Utilisateur introuvable", 404);
    const targetRoles = await getUserRoles(targetUserId);
    if (targetRoles.includes("super_admin")) {
      throw new ValidationError("L'invitation d'un super-administrateur suit la procédure de gouvernance.", 403);
    }
    if (target.user.email_confirmed_at) throw new ValidationError("Ce compte est déjà confirmé. Utilisez le lien de réinitialisation.", 409);
    if (!target.user.email) throw new ValidationError("Adresse e-mail utilisateur indisponible", 409);
    targetEmailDomain = target.user.email.split("@")[1] || "";
    const { data: accountStatus, error: accountStatusError } = await admin.from("user_account_status")
      .select("status")
      .eq("user_id", targetUserId)
      .maybeSingle();
    if (accountStatusError) throw accountStatusError;
    if (accountStatus?.status === "suspended") {
      throw new ValidationError("Le compte est suspendu. Réactivez-le avant de renvoyer une invitation.", 409);
    }

    const deliveryGateway = getInvitationDeliveryGateway();
    if (!deliveryGateway.available) {
      throw new DeliveryError("Le service d'e-mail est temporairement indisponible. Réessayez plus tard.", 503, "unavailable");
    }

    const idempotencyKey = crypto.randomUUID();
    await claimInvitationDeliveryAttempt(targetUserId, user!.id, idempotencyKey);
    claimedAttempt = true;
    const { data: generatedLink, error: generateError } = await admin.auth.admin.generateLink({
      type: "invite",
      email: target.user.email,
      options: { redirectTo: AUTH_REDIRECT_URL },
    });
    if (generateError) throw generateError;
    const actionLink = generatedLink.properties?.action_link;
    if (!actionLink) throw new DeliveryError("Le service d'e-mail est temporairement indisponible. Réessayez plus tard.", 503, "unavailable");
    await deliveryGateway.sendInvite({
      recipientEmail: target.user.email,
      recipientName: target.user.user_metadata?.name || target.user.email.split("@")[0],
      actionLink,
      idempotencyKey,
    });
    await updateInvitationDeliveryStatus(targetUserId, "accepted");
    await logAudit(user!.id, user!.email || "", "user_invitation_resent", "Invitation utilisateur renvoyée", {
      targetUserId,
      targetEmailDomain,
    });
    return c.json({ accepted: true, message: "La demande d'invitation a été prise en compte." }, 202);
  } catch (error) {
    if (actor && targetUserId && (claimedAttempt || error instanceof DeliveryError)) {
      await auditInvitationDeliveryFailure(actor, targetUserId, targetEmailDomain, error, c.get("requestId"));
    }
    return error instanceof ValidationError
      ? handleApiError(c, error, "Resend invitation error")
      : handleDeliveryApiError(c, error, "Resend invitation error");
  }
});

authRoutes.post("/users/:id/password-reset", async (c) => {
  try {
    const { user, error: authError } = await requirePermission(c.req.raw, "users_manage_basic_roles");
    if (authError) return c.json({ error: authError }, user ? 403 : 401);
    const targetUserId = c.req.param("id");
    const admin = supabaseAdmin();
    const { data: target } = await admin.auth.admin.getUserById(targetUserId);
    if (!target.user?.email) throw new ValidationError("Utilisateur introuvable", 404);
    const targetRoles = await getUserRoles(targetUserId);
    if (targetRoles.includes("super_admin")) {
      throw new ValidationError("La récupération d'un super-administrateur suit la procédure de gouvernance.", 403);
    }
    const { error } = await supabasePublic().auth.resetPasswordForEmail(target.user.email, { redirectTo: AUTH_REDIRECT_URL });
    if (error) throw error;
    await logAudit(user!.id, user!.email || "", "password_reset_requested", "Lien de réinitialisation demandé", {
      targetUserId,
      targetEmailDomain: target.user.email.split("@")[1],
    });
    return c.json({ accepted: true, message: "Si le compte est éligible, un lien sécurisé a été envoyé à son titulaire." }, 202);
  } catch (error) {
    return error instanceof ValidationError
      ? handleApiError(c, error, "Admin password reset error")
      : handleDeliveryApiError(c, error, "Admin password reset error");
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
