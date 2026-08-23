import { createClient } from "npm:@supabase/supabase-js@2.98.0";
import { BUCKET_NAME, getRequiredEnv } from "../config.ts";

const supabaseUrl = getRequiredEnv("SUPABASE_URL");
const supabaseServiceRoleKey = getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY");

function getSupabasePublishableKey(): string {
  const publishableKeys = Deno.env.get("SUPABASE_PUBLISHABLE_KEYS")?.trim();
  if (publishableKeys) {
    try {
      const defaultKey = JSON.parse(publishableKeys).default;
      if (typeof defaultKey === "string" && defaultKey.trim()) return defaultKey.trim();
    } catch {
      // Le repli legacy ci-dessous est nécessaire pour les environnements locaux.
    }
  }
  return getRequiredEnv("SUPABASE_ANON_KEY");
}

const supabaseAnonKey = getSupabasePublishableKey();

const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey);
const publicClient = createClient(supabaseUrl, supabaseAnonKey);

export function supabaseAdmin() {
  return adminClient;
}

export function supabasePublic() {
  return publicClient;
}

/**
 * Utilise la clé publique effectivement fournie par le client pour les routes
 * publiques. Cela évite de dépendre d'une ancienne clé anonyme conservée dans
 * l'environnement de l'Edge Function lors d'une rotation de clés Supabase.
 */
export function supabasePublicForRequest(req: Request) {
  const authorization = req.headers.get("Authorization");
  const accessToken = authorization?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  if (!accessToken) return publicClient;

  return createClient(supabaseUrl, accessToken, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function getUser(req: Request) {
  const token = req.headers.get("Authorization")?.split(" ")[1];
  if (!token) return null;
  const { data: { user }, error } = await adminClient.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

export async function ensureStorageBucket() {
  try {
    const { data: buckets } = await adminClient.storage.listBuckets();
    const exists = buckets?.some((bucket: any) => bucket.name === BUCKET_NAME);
    if (!exists) {
      await adminClient.storage.createBucket(BUCKET_NAME, { public: false });
      console.log("Bucket created:", BUCKET_NAME);
    }
  } catch (error) {
    console.log("Bucket init error:", error);
  }
}
