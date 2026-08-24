export const APP_ROLES = ["user", "content_editor", "moderator", "admin", "super_admin"] as const;
export type AppRole = typeof APP_ROLES[number];

export const PERMISSIONS = [
  "access_admin",
  "content_create_own",
  "content_edit_own",
  "content_submit_review",
  "content_publish",
  "content_manage_all",
  "comments_moderate",
  "users_manage_basic_roles",
  "users_manage_admin_roles",
  "users_delete",
  "system_manage_critical",
] as const;
export type Permission = typeof PERMISSIONS[number];

const ROLE_PERMISSIONS: Record<AppRole, Permission[]> = {
  user: [],
  content_editor: ["content_create_own", "content_edit_own", "content_submit_review"],
  moderator: ["comments_moderate"],
  admin: [
    "access_admin",
    "content_create_own",
    "content_edit_own",
    "content_submit_review",
    "content_publish",
    "content_manage_all",
    "comments_moderate",
    "users_manage_basic_roles",
    "users_delete",
  ],
  super_admin: PERMISSIONS.slice(),
};

const ROLE_PRIORITY: AppRole[] = ["super_admin", "admin", "moderator", "content_editor", "user"];

export function isAppRole(value: unknown): value is AppRole {
  return typeof value === "string" && APP_ROLES.includes(value as AppRole);
}

export function normalizeRoles(values: unknown): AppRole[] {
  const input = Array.isArray(values) ? values : [];
  if (!input.every(isAppRole)) throw new Error("Role invalide");
  return [...new Set(["user", ...input])] as AppRole[];
}

export function getPermissions(roles: AppRole[]): Permission[] {
  return [...new Set(roles.flatMap((role) => ROLE_PERMISSIONS[role]))];
}

export function hasPermission(roles: AppRole[], permission: Permission): boolean {
  return getPermissions(roles).includes(permission);
}

export function getPrimaryRole(roles: AppRole[]): AppRole {
  return ROLE_PRIORITY.find((role) => roles.includes(role)) ?? "user";
}

export function canAssignRequestedRoles(actorRoles: AppRole[], currentTargetRoles: AppRole[], requestedRoles: AppRole[]): boolean {
  const actorIsSuperAdmin = actorRoles.includes("super_admin");
  const targetIsSuperAdmin = currentTargetRoles.includes("super_admin");
  if (requestedRoles.includes("super_admin") || targetIsSuperAdmin) return false;
  if (actorIsSuperAdmin) return true;

  if (!hasPermission(actorRoles, "users_manage_basic_roles")) return false;
  const protectedRoles: AppRole[] = ["admin", "super_admin"];
  return !currentTargetRoles.some((role) => protectedRoles.includes(role))
    && !requestedRoles.some((role) => protectedRoles.includes(role));
}

export function canManageRoleAssignment(
  actorId: string,
  targetUserId: string,
  actorRoles: AppRole[],
  currentTargetRoles: AppRole[],
  requestedRoles: AppRole[],
): boolean {
  return actorId !== targetUserId && canAssignRequestedRoles(actorRoles, currentTargetRoles, requestedRoles);
}

export function canManageAccountStatus(
  actorId: string,
  targetUserId: string,
  actorRoles: AppRole[],
  targetRoles: AppRole[],
): boolean {
  if (actorId === targetUserId || targetRoles.includes("super_admin")) return false;
  if (actorRoles.includes("super_admin")) return true;
  return hasPermission(actorRoles, "users_manage_basic_roles") && !targetRoles.includes("admin");
}

export function canEditOwnedContent(roles: AppRole[], contentOwnerId: string | null | undefined, actorId: string): boolean {
  return hasPermission(roles, "content_manage_all")
    || (hasPermission(roles, "content_edit_own") && contentOwnerId === actorId);
}
