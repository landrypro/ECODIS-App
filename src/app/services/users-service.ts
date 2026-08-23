import { fetchJson, getHeaders, jsonHeaders } from "./http";
import type { AppRole, AppUser } from "./types";

export interface UserAuthorization {
  role: AppRole;
  roles: AppRole[];
  permissions: string[];
}

export async function fetchUserRole(accessToken: string): Promise<string> {
  try {
    const data = await fetchJson<{ role?: string }>("/users/me/role", {
      headers: getHeaders(accessToken),
    });
    return data.role ?? "user";
  } catch (error) {
    console.error("Fetch role error:", error);
    return "user";
  }
}

export async function fetchUserAuthorization(accessToken: string): Promise<UserAuthorization> {
  try {
    const data = await fetchJson<Partial<UserAuthorization>>("/users/me/role", { headers: getHeaders(accessToken) });
    return {
      role: data.role ?? "user",
      roles: data.roles ?? ["user"],
      permissions: data.permissions ?? [],
    };
  } catch (error) {
    console.error("Fetch authorization error:", error);
    return { role: "user", roles: ["user"], permissions: [] };
  }
}

export async function fetchAllUsers(accessToken: string): Promise<AppUser[]> {
  try {
    const data = await fetchJson<{ users?: AppUser[] }>("/users", {
      headers: getHeaders(accessToken),
    });
    return data.users ?? [];
  } catch (error) {
    console.error("Fetch users error:", error);
    return [];
  }
}

export async function updateUserRole(userId: string, role: string, accessToken: string): Promise<boolean> {
  try {
    const data = await fetchJson<{ success: boolean }>(`/users/${userId}/role`, {
      method: "PUT",
      headers: jsonHeaders(accessToken),
      body: JSON.stringify({ role }),
    });
    return data.success === true;
  } catch (error) {
    console.error("Update role error:", error);
    throw error;
  }
}

export async function updateUserRoles(userId: string, roles: AppRole[], reason: string, accessToken: string): Promise<UserAuthorization> {
  const data = await fetchJson<UserAuthorization>(`/users/${userId}/roles`, {
    method: "PUT",
    headers: jsonHeaders(accessToken),
    body: JSON.stringify({ roles, reason }),
  });
  return data;
}

export async function deleteUser(userId: string, accessToken: string): Promise<boolean> {
  try {
    const data = await fetchJson<{ success: boolean }>(`/users/${userId}`, {
      method: "DELETE",
      headers: getHeaders(accessToken),
    });
    return data.success === true;
  } catch (error) {
    console.error("Delete user error:", error);
    throw error;
  }
}
