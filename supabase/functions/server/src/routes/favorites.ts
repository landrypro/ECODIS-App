import { Hono } from "npm:hono";
import { handleApiError } from "../lib/errors.ts";
import { assertPublishedMessage } from "../lib/messages.ts";
import { getUser, supabaseAdmin } from "../lib/supabase.ts";
import { validateRequiredString } from "../lib/validation.ts";

export const favoritesRoutes = new Hono();

favoritesRoutes.post("/favorites/toggle", async (c) => {
  try {
    const user = await getUser(c.req.raw);
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const { messageId } = await c.req.json();
    const validatedMessageId = validateRequiredString(messageId, "messageId", 1, 255);
    await assertPublishedMessage(validatedMessageId);

    const admin = supabaseAdmin();
    const { data: existing } = await admin
      .from("favorites")
      .select("message_id")
      .eq("user_id", user.id)
      .eq("message_id", validatedMessageId)
      .maybeSingle();

    if (existing) {
      await admin.from("favorites").delete().eq("user_id", user.id).eq("message_id", validatedMessageId);
      return c.json({ favorited: false });
    }

    await admin.from("favorites").insert({
      user_id: user.id,
      message_id: validatedMessageId,
      created_at: new Date().toISOString(),
    });
    return c.json({ favorited: true });
  } catch (error) {
    return handleApiError(c, error, "Toggle favorite error");
  }
});

favoritesRoutes.get("/favorites", async (c) => {
  try {
    const user = await getUser(c.req.raw);
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const { data, error } = await supabaseAdmin().from("favorites").select("message_id").eq("user_id", user.id);
    if (error) throw error;
    return c.json({ favorites: (data ?? []).map((item: any) => item.message_id) });
  } catch (error) {
    return handleApiError(c, error, "Get favorites error");
  }
});
