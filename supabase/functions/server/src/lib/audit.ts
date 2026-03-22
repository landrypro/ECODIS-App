import { mapAuditLog } from "./mappers.ts";
import { supabaseAdmin } from "./supabase.ts";

export async function logAudit(userId: string | null, userEmail: string, action: string, description: string, metadata: unknown = {}) {
  try {
    await supabaseAdmin().from("audit_logs").insert({
      user_id: userId,
      user_email: userEmail ?? "",
      action,
      description,
      metadata,
      created_at: new Date().toISOString(),
    });
  } catch (error) {
    console.log("Audit log error:", error);
  }
}

export async function fetchAuditLogs(limit = 200) {
  const { data, error } = await supabaseAdmin()
    .from("audit_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map(mapAuditLog);
}

export async function clearAuditLogs() {
  const admin = supabaseAdmin();
  const { count } = await admin.from("audit_logs").select("id", { count: "exact", head: true });
  const { error } = await admin.from("audit_logs").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  if (error) throw error;
  return count ?? 0;
}
