import { createClient } from "npm:@supabase/supabase-js@2.98.0";
import { BUCKET_NAME, getRequiredEnv } from "../config.ts";

const supabaseUrl = getRequiredEnv("SUPABASE_URL");
const supabaseAnonKey = getRequiredEnv("SUPABASE_ANON_KEY");
const supabaseServiceRoleKey = getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY");

const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey);
const publicClient = createClient(supabaseUrl, supabaseAnonKey);

export function supabaseAdmin() {
  return adminClient;
}

export function supabasePublic() {
  return publicClient;
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
