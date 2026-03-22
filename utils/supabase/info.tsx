const readRequiredEnv = (name: string): string => {
  const value = import.meta.env[name as keyof ImportMetaEnv];
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value.trim();
};

export const supabaseUrl = readRequiredEnv("VITE_SUPABASE_URL");
export const publicAnonKey = readRequiredEnv("VITE_SUPABASE_ANON_KEY");
export const functionsBaseUrl = readRequiredEnv("VITE_SUPABASE_FUNCTIONS_BASE_URL");

export const projectId = (() => {
  const hostname = new URL(supabaseUrl).hostname;
  return hostname.split(".")[0] ?? "";
})();
