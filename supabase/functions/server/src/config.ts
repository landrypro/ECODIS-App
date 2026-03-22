export function getRequiredEnv(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function toPrefixedRoute(prefix: string): string {
  return prefix.startsWith("/") ? prefix : `/${prefix}`;
}

export const API_PREFIX = toPrefixedRoute(getRequiredEnv("APP_API_PREFIX"));
export const BUCKET_NAME = getRequiredEnv("APP_STORAGE_BUCKET_NAME");
export const ALLOWED_ORIGINS = getRequiredEnv("APP_ALLOWED_ORIGINS")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
export const BOOTSTRAP_ADMIN_EMAILS = new Set(
  (Deno.env.get("APP_BOOTSTRAP_ADMIN_EMAILS") ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean),
);
export const MESSAGE_TYPES = new Set(["audio", "video", "text"]);
export const ANNOUNCEMENT_TYPES = new Set(["info", "warning", "success", "error"]);
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const DEFAULT_APP_CONFIG_ROW = {
  id: "global",
  app_name: "ECODIS",
  app_subtitle: "Ecole des Disciples",
  maintenance_mode: false,
  registration_enabled: true,
  comments_enabled: true,
  downloads_enabled: true,
  max_upload_size_mb: 100,
  default_language: "fr",
  welcome_message: "Car je connais les projets que j'ai formes sur vous",
  welcome_verse: "Jeremie 29:11",
  primary_color: "#152a6b",
  accent_color: "#9b1b30",
  analytics_enabled: true,
  auto_seed_enabled: false,
  categories: [],
  announcements: [],
};
