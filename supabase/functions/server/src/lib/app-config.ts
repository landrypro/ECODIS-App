import { DEFAULT_APP_CONFIG_ROW } from "../config.ts";
import { mapAppConfig } from "./mappers.ts";
import { supabaseAdmin } from "./supabase.ts";

export async function ensureAppConfigRow() {
  const admin = supabaseAdmin();
  const { data: existing } = await admin.from("app_config").select("*").eq("id", "global").maybeSingle();
  if (existing) return existing;
  const { data, error } = await admin.from("app_config").insert(DEFAULT_APP_CONFIG_ROW).select("*").single();
  if (error) throw error;
  return data;
}

export async function getAppConfigRow() {
  return ensureAppConfigRow();
}

export async function getAppConfig() {
  const row = await ensureAppConfigRow();
  return mapAppConfig(row);
}

export async function updateAppConfigRow(values: Record<string, unknown>, userId?: string | null) {
  await ensureAppConfigRow();
  const payload = {
    ...values,
    updated_at: new Date().toISOString(),
    updated_by: userId ?? null,
  };
  const { data, error } = await supabaseAdmin()
    .from("app_config")
    .update(payload)
    .eq("id", "global")
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function getStoredCategories(): Promise<string[]> {
  const row = await ensureAppConfigRow();
  return row.categories ?? [];
}

export async function updateStoredCategories(categories: string[], userId?: string | null) {
  return updateAppConfigRow({ categories }, userId);
}

export async function getAnnouncements() {
  const row = await ensureAppConfigRow();
  return row.announcements ?? [];
}

export async function saveAnnouncements(announcements: unknown[], userId?: string | null) {
  return updateAppConfigRow({ announcements }, userId);
}
