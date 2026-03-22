import { Hono } from "npm:hono";
import { getAppConfig } from "../lib/app-config.ts";
import { ensureUserRoleRecord, requireAdmin } from "../lib/auth.ts";
import { handleApiError, ValidationError } from "../lib/errors.ts";
import { getUser, supabaseAdmin, supabasePublic } from "../lib/supabase.ts";
import { validateEmail, validateOptionalString, validatePassword } from "../lib/validation.ts";

export const authRoutes = new Hono();

authRoutes.post("/auth/signup", async (c) => {
  try {
    const config = await getAppConfig();
    if (!config.registrationEnabled) {
      return c.json({ error: "Les inscriptions sont actuellement desactivees" }, 403);
    }

    const { email, password, name } = await c.req.json();
    const validatedEmail = validateEmail(email);
    const validatedPassword = validatePassword(password);
    const validatedName = validateOptionalString(name, "Nom", 120) || validatedEmail.split("@")[0];

    const { data, error } = await supabasePublic().auth.signUp({
      email: validatedEmail,
      password: validatedPassword,
      options: { data: { name: validatedName } },
    });

    if (error) {
      return c.json({ error: `Signup error: ${error.message}` }, 400);
    }

    if (data.user) {
      await ensureUserRoleRecord(data.user, validatedName);
    }

    return c.json({
      user: data.user,
      role: data.user ? await ensureUserRoleRecord(data.user, validatedName) : "user",
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
    const role = await ensureUserRoleRecord(user);
    return c.json({ role });
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

    const { data: roles } = await admin.from("users_roles").select("*");
    const roleMap = new Map((roles ?? []).map((row: any) => [row.user_id, row.role]));
    const nameMap = new Map((roles ?? []).map((row: any) => [row.user_id, row.name]));

    const users = (authData.users ?? []).map((item: any) => ({
      id: item.id,
      email: item.email ?? "",
      name: nameMap.get(item.id) || item.user_metadata?.name || item.email?.split("@")[0] || "Disciple",
      role: roleMap.get(item.id) || "user",
      createdAt: item.created_at,
      lastSignIn: item.last_sign_in_at,
    }));

    return c.json({ users });
  } catch (error) {
    return handleApiError(c, error, "List users error");
  }
});

authRoutes.put("/users/:id/role", async (c) => {
  try {
    const { user, error: authError } = await requireAdmin(c.req.raw);
    if (authError) return c.json({ error: authError }, user ? 403 : 401);

    const targetUserId = c.req.param("id");
    const { role } = await c.req.json();
    if (!["admin", "user"].includes(role)) {
      throw new ValidationError("Invalid role. Must be 'admin' or 'user'");
    }
    if (targetUserId === user!.id && role !== "admin") {
      throw new ValidationError("Vous ne pouvez pas retirer votre propre role admin");
    }

    const admin = supabaseAdmin();
    const { data: target } = await admin.auth.admin.getUserById(targetUserId);
    await admin.from("users_roles").upsert({
      user_id: targetUserId,
      email: target.user?.email ?? "",
      name: target.user?.user_metadata?.name || target.user?.email?.split("@")[0] || "Disciple",
      role,
      updated_at: new Date().toISOString(),
    });

    return c.json({ success: true, role });
  } catch (error) {
    return handleApiError(c, error, "Update role error");
  }
});

authRoutes.delete("/users/:id", async (c) => {
  try {
    const { user, error: authError } = await requireAdmin(c.req.raw);
    if (authError) return c.json({ error: authError }, user ? 403 : 401);

    const targetUserId = c.req.param("id");
    if (targetUserId === user!.id) {
      throw new ValidationError("Vous ne pouvez pas supprimer votre propre compte");
    }

    const { error } = await supabaseAdmin().auth.admin.deleteUser(targetUserId);
    if (error) return c.json({ error: `Delete user error: ${error.message}` }, 500);

    return c.json({ success: true });
  } catch (error) {
    return handleApiError(c, error, "Delete user error");
  }
});
