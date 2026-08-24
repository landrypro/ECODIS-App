import { Hono } from "npm:hono";
import { getAppConfig } from "../lib/app-config.ts";
import { handleApiError } from "../lib/errors.ts";
import { mapMessage } from "../lib/mappers.ts";
import { getUser, supabaseAdmin } from "../lib/supabase.ts";

export const offlineRoutes = new Hono();

offlineRoutes.get("/offline/manifest", async (c) => {
  try {
    const user = await getUser(c.req.raw);
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const [{ data, error }, config] = await Promise.all([
      supabaseAdmin()
        .from("messages")
        .select("id,type,title,author,category,description,duration,thumbnail,media_path,status,published_at,created_at,updated_at,user_id,offline_downloadable,content_version")
        .eq("status", "published")
        .eq("offline_downloadable", true)
        .order("updated_at", { ascending: false }),
      getAppConfig(),
    ]);
    if (error) throw error;

    return c.json({
      generatedAt: new Date().toISOString(),
      downloadsEnabled: config.downloadsEnabled,
      maxOfflineStorageMb: config.maxOfflineStorageMb,
      messages: (data ?? []).map((row: any) => ({ ...mapMessage(row), hasMedia: Boolean(row.media_path) })),
    });
  } catch (error) {
    return handleApiError(c, error, "Offline manifest error");
  }
});
