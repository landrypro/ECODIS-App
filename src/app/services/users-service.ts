import { fetchJson, getHeaders, jsonHeaders } from "./http";
import type { AppUser } from "./types";

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
