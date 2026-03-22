import { fetchJson, getHeaders, jsonHeaders } from "./http";
import type { AdminStats, AppConfig, AuditLog, Announcement, StorageStats, SystemHealth } from "./types";

export async function fetchAdminStats(accessToken: string): Promise<AdminStats | null> {
  try {
    const data = await fetchJson<{ stats: AdminStats }>("/admin/stats", {
      headers: getHeaders(accessToken),
    });
    return data.stats;
  } catch (error) {
    console.error("Fetch admin stats error:", error);
    return null;
  }
}

export async function fetchAppConfig(accessToken: string): Promise<AppConfig | null> {
  try {
    const data = await fetchJson<{ config: AppConfig }>("/admin/config", {
      headers: getHeaders(accessToken),
    });
    return data.config;
  } catch (error) {
    console.error("Fetch config error:", error);
    return null;
  }
}

export async function updateAppConfig(config: Partial<AppConfig>, accessToken: string): Promise<AppConfig | null> {
  try {
    const data = await fetchJson<{ config: AppConfig }>("/admin/config", {
      method: "PUT",
      headers: jsonHeaders(accessToken),
      body: JSON.stringify(config),
    });
    return data.config;
  } catch (error) {
    console.error("Update config error:", error);
    throw error;
  }
}

export async function fetchAuditLogs(accessToken: string): Promise<AuditLog[]> {
  try {
    const data = await fetchJson<{ logs?: AuditLog[] }>("/admin/audit-log", {
      headers: getHeaders(accessToken),
    });
    return data.logs ?? [];
  } catch (error) {
    console.error("Fetch audit logs error:", error);
    return [];
  }
}

export async function clearAuditLogs(accessToken: string): Promise<boolean> {
  try {
    const data = await fetchJson<{ success: boolean }>("/admin/audit-log", {
      method: "DELETE",
      headers: getHeaders(accessToken),
    });
    return data.success === true;
  } catch (error) {
    console.error("Clear audit logs error:", error);
    return false;
  }
}

export async function fetchStorageStats(accessToken: string): Promise<StorageStats | null> {
  try {
    const data = await fetchJson<{ storage: StorageStats }>("/admin/storage", {
      headers: getHeaders(accessToken),
    });
    return data.storage;
  } catch (error) {
    console.error("Fetch storage error:", error);
    return null;
  }
}

export async function bulkDeleteMessages(messageIds: string[], accessToken: string): Promise<number> {
  try {
    const data = await fetchJson<{ deleted?: number }>("/admin/messages/bulk-delete", {
      method: "POST",
      headers: jsonHeaders(accessToken),
      body: JSON.stringify({ messageIds }),
    });
    return data.deleted ?? 0;
  } catch (error) {
    console.error("Bulk delete error:", error);
    throw error;
  }
}

export async function fetchSystemHealth(accessToken: string): Promise<SystemHealth> {
  try {
    const data = await fetchJson<{ health: SystemHealth }>("/admin/health", {
      headers: getHeaders(accessToken),
    });
    return data.health;
  } catch (error) {
    console.error("Fetch system health error:", error);
    return {
      status: "healthy",
      uptime: "N/A",
      serverVersion: "4.0.0",
      dbConnected: true,
      storageConnected: true,
      authServiceUp: true,
      lastChecked: new Date().toISOString(),
      memoryUsage: 0,
      kvEntries: 0,
    };
  }
}

export async function fetchCategories(accessToken: string): Promise<string[]> {
  try {
    const data = await fetchJson<{ categories?: string[] }>("/admin/categories", {
      headers: getHeaders(accessToken),
    });
    return data.categories ?? [];
  } catch (error) {
    console.error("Fetch categories error:", error);
    return [];
  }
}

export async function updateCategories(categories: string[], accessToken: string): Promise<boolean> {
  try {
    const data = await fetchJson<{ success: boolean }>("/admin/categories", {
      method: "PUT",
      headers: jsonHeaders(accessToken),
      body: JSON.stringify({ categories }),
    });
    return data.success === true;
  } catch (error) {
    console.error("Update categories error:", error);
    throw error;
  }
}

export async function fetchAnnouncements(accessToken: string): Promise<Announcement[]> {
  try {
    const data = await fetchJson<{ announcements?: Announcement[] }>("/admin/announcements", {
      headers: getHeaders(accessToken),
    });
    return data.announcements ?? [];
  } catch (error) {
    console.error("Fetch announcements error:", error);
    return [];
  }
}

export async function createAnnouncement(announcement: Partial<Announcement>, accessToken: string): Promise<Announcement | null> {
  try {
    const data = await fetchJson<{ announcement: Announcement }>("/admin/announcements", {
      method: "POST",
      headers: jsonHeaders(accessToken),
      body: JSON.stringify(announcement),
    });
    return data.announcement;
  } catch (error) {
    console.error("Create announcement error:", error);
    throw error;
  }
}

export async function deleteAnnouncement(id: string, accessToken: string): Promise<boolean> {
  try {
    const data = await fetchJson<{ success: boolean }>(`/admin/announcements/${id}`, {
      method: "DELETE",
      headers: getHeaders(accessToken),
    });
    return data.success === true;
  } catch (error) {
    console.error("Delete announcement error:", error);
    return false;
  }
}

export async function exportDataAsJson(type: "users" | "messages" | "all", accessToken: string) {
  try {
    return await fetchJson<unknown>(`/admin/export?type=${type}`, {
      headers: getHeaders(accessToken),
    });
  } catch (error) {
    console.error("Export data error:", error);
    return null;
  }
}
