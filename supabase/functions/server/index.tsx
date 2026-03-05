import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import { createClient } from "jsr:@supabase/supabase-js@2.49.8";
import * as kv from "./kv_store.tsx";

const app = new Hono();
const BUCKET_NAME = "make-1c1fff69-media";
const PREFIX = "/make-server-1c1fff69";

const supabaseAdmin = () =>
  createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

// Init storage bucket
(async () => {
  try {
    const sb = supabaseAdmin();
    const { data: buckets } = await sb.storage.listBuckets();
    const exists = buckets?.some((b: any) => b.name === BUCKET_NAME);
    if (!exists) {
      await sb.storage.createBucket(BUCKET_NAME, { public: false });
      console.log("Bucket created:", BUCKET_NAME);
    }
  } catch (e) {
    console.log("Bucket init error:", e);
  }
})();

app.use("*", logger(console.log));
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  })
);

// Helper: get user from token
async function getUser(req: Request) {
  const token = req.headers.get("Authorization")?.split(" ")[1];
  if (!token) return null;
  const sb = supabaseAdmin();
  const {
    data: { user },
    error,
  } = await sb.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

// Helper: get user role
async function getUserRole(userId: string): Promise<string> {
  const roleData = await kv.get(`role:${userId}`);
  return roleData?.role || "user";
}

// Helper: require admin
async function requireAdmin(req: Request) {
  const user = await getUser(req);
  if (!user) return { user: null, error: "Unauthorized" };
  const role = await getUserRole(user.id);
  if (role !== "admin") return { user, error: "Forbidden: admin role required" };
  return { user, error: null };
}

// ===================== AUTH =====================

app.post(`${PREFIX}/auth/signup`, async (c) => {
  try {
    const { email, password, name } = await c.req.json();
    const sb = supabaseAdmin();
    const { data, error } = await sb.auth.admin.createUser({
      email,
      password,
      user_metadata: { name: name || "Disciple" },
      email_confirm: true,
    });
    if (error) return c.json({ error: `Signup error: ${error.message}` }, 400);

    // Check if this is the first user — make them admin
    const existingRoles = await kv.getByPrefix("role:");
    const role = existingRoles.length === 0 ? "admin" : "user";
    await kv.set(`role:${data.user.id}`, {
      userId: data.user.id,
      role,
      email: data.user.email,
      name: name || "Disciple",
      updatedAt: new Date().toISOString(),
    });

    return c.json({ user: data.user, role });
  } catch (e) {
    console.log("Signup error:", e);
    return c.json({ error: `Signup server error: ${e}` }, 500);
  }
});

// ===================== ROLES =====================

// Get current user's role
app.get(`${PREFIX}/users/me/role`, async (c) => {
  try {
    const user = await getUser(c.req.raw);
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    const role = await getUserRole(user.id);

    // If no role record exists yet, create one as "user" (for users created before role system)
    const roleData = await kv.get(`role:${user.id}`);
    if (!roleData) {
      // Check if this is the very first role ever
      const existingRoles = await kv.getByPrefix("role:");
      const defaultRole = existingRoles.length === 0 ? "admin" : "user";
      await kv.set(`role:${user.id}`, {
        userId: user.id,
        role: defaultRole,
        email: user.email,
        name: user.user_metadata?.name || user.email?.split("@")[0] || "Disciple",
        updatedAt: new Date().toISOString(),
      });
      return c.json({ role: defaultRole });
    }

    return c.json({ role });
  } catch (e) {
    console.log("Get role error:", e);
    return c.json({ error: `Get role error: ${e}` }, 500);
  }
});

// List all users (admin only)
app.get(`${PREFIX}/users`, async (c) => {
  try {
    const { user, error: authError } = await requireAdmin(c.req.raw);
    if (authError) return c.json({ error: authError }, user ? 403 : 401);

    const sb = supabaseAdmin();
    const { data: { users }, error } = await sb.auth.admin.listUsers();
    if (error) return c.json({ error: `List users error: ${error.message}` }, 500);

    // Get all roles
    const roles = await kv.getByPrefix("role:");
    const roleMap: Record<string, string> = {};
    roles.forEach((r: any) => { roleMap[r.userId] = r.role; });

    const result = users.map((u: any) => ({
      id: u.id,
      email: u.email,
      name: u.user_metadata?.name || u.email?.split("@")[0] || "Disciple",
      role: roleMap[u.id] || "user",
      createdAt: u.created_at,
      lastSignIn: u.last_sign_in_at,
    }));

    return c.json({ users: result });
  } catch (e) {
    console.log("List users error:", e);
    return c.json({ error: `List users error: ${e}` }, 500);
  }
});

// Update user role (admin only)
app.put(`${PREFIX}/users/:id/role`, async (c) => {
  try {
    const { user, error: authError } = await requireAdmin(c.req.raw);
    if (authError) return c.json({ error: authError }, user ? 403 : 401);

    const targetUserId = c.req.param("id");
    const { role } = await c.req.json();

    if (!["admin", "user"].includes(role)) {
      return c.json({ error: "Invalid role. Must be 'admin' or 'user'" }, 400);
    }

    // Prevent removing own admin role
    if (targetUserId === user!.id && role !== "admin") {
      return c.json({ error: "Vous ne pouvez pas retirer votre propre role admin" }, 400);
    }

    // Get target user info
    const sb = supabaseAdmin();
    const { data: { user: targetUser } } = await sb.auth.admin.getUserById(targetUserId);

    await kv.set(`role:${targetUserId}`, {
      userId: targetUserId,
      role,
      email: targetUser?.email || "",
      name: targetUser?.user_metadata?.name || targetUser?.email?.split("@")[0] || "Disciple",
      updatedAt: new Date().toISOString(),
    });

    return c.json({ success: true, role });
  } catch (e) {
    console.log("Update role error:", e);
    return c.json({ error: `Update role error: ${e}` }, 500);
  }
});

// Delete user (admin only)
app.delete(`${PREFIX}/users/:id`, async (c) => {
  try {
    const { user, error: authError } = await requireAdmin(c.req.raw);
    if (authError) return c.json({ error: authError }, user ? 403 : 401);

    const targetUserId = c.req.param("id");

    // Prevent self-deletion
    if (targetUserId === user!.id) {
      return c.json({ error: "Vous ne pouvez pas supprimer votre propre compte" }, 400);
    }

    const sb = supabaseAdmin();
    const { error } = await sb.auth.admin.deleteUser(targetUserId);
    if (error) return c.json({ error: `Delete user error: ${error.message}` }, 500);

    // Delete role record
    await kv.del(`role:${targetUserId}`);

    // Delete user's favorites
    const favs = await kv.getByPrefix(`fav:${targetUserId}:`);
    if (favs.length > 0) {
      const favKeys = favs.map((f: any) => `fav:${targetUserId}:${f.messageId}`);
      await kv.mdel(favKeys);
    }

    return c.json({ success: true });
  } catch (e) {
    console.log("Delete user error:", e);
    return c.json({ error: `Delete user error: ${e}` }, 500);
  }
});

// ===================== MESSAGES =====================

// List messages (optionally filtered by type)
app.get(`${PREFIX}/messages`, async (c) => {
  try {
    const type = c.req.query("type");
    const all = await kv.getByPrefix("msg:");
    let messages = all.sort(
      (a: any, b: any) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    if (type) {
      messages = messages.filter((m: any) => m.type === type);
    }
    return c.json({ messages });
  } catch (e) {
    console.log("List messages error:", e);
    return c.json({ error: `List messages error: ${e}` }, 500);
  }
});

// Get single message
app.get(`${PREFIX}/messages/:id`, async (c) => {
  try {
    const id = c.req.param("id");
    const msg = await kv.get(`msg:${id}`);
    if (!msg) return c.json({ error: "Message not found" }, 404);

    // If there's a media file, generate signed URL
    if (msg.mediaPath) {
      const sb = supabaseAdmin();
      const { data } = await sb.storage
        .from(BUCKET_NAME)
        .createSignedUrl(msg.mediaPath, 3600);
      if (data?.signedUrl) {
        msg.mediaUrl = data.signedUrl;
      }
    }
    return c.json({ message: msg });
  } catch (e) {
    console.log("Get message error:", e);
    return c.json({ error: `Get message error: ${e}` }, 500);
  }
});

// Create message (admin only - requires auth)
app.post(`${PREFIX}/messages`, async (c) => {
  try {
    const { user, error: authError } = await requireAdmin(c.req.raw);
    if (authError) return c.json({ error: authError }, user ? 403 : 401);

    const formData = await c.req.formData();
    const title = formData.get("title") as string;
    const type = formData.get("type") as string;
    const author = formData.get("author") as string;
    const category = formData.get("category") as string;
    const description = formData.get("description") as string;
    const duration = formData.get("duration") as string;
    const thumbnail = formData.get("thumbnail") as string;
    const mediaFile = formData.get("media") as File | null;

    // Generate unique ID
    let counter = (await kv.get("msg_counter")) || 0;
    counter++;
    await kv.set("msg_counter", counter);
    const id = `${Date.now()}-${counter}`;

    let mediaPath = "";
    if (mediaFile && mediaFile.size > 0) {
      const ext = mediaFile.name.split(".").pop() || "bin";
      mediaPath = `${type}/${id}.${ext}`;
      const sb = supabaseAdmin();
      const buffer = await mediaFile.arrayBuffer();
      const { error: uploadError } = await sb.storage
        .from(BUCKET_NAME)
        .upload(mediaPath, buffer, {
          contentType: mediaFile.type,
          upsert: true,
        });
      if (uploadError) {
        console.log("Upload error:", uploadError);
        return c.json(
          { error: `File upload error: ${uploadError.message}` },
          500
        );
      }
    }

    const message = {
      id,
      type,
      title,
      author,
      category,
      description: description || "",
      duration: duration || "",
      thumbnail: thumbnail || "",
      mediaPath,
      createdAt: new Date().toISOString(),
      userId: user.id,
    };

    await kv.set(`msg:${id}`, message);
    return c.json({ message });
  } catch (e) {
    console.log("Create message error:", e);
    return c.json({ error: `Create message error: ${e}` }, 500);
  }
});

// Delete message (admin)
app.delete(`${PREFIX}/messages/:id`, async (c) => {
  try {
    const { user, error: authError } = await requireAdmin(c.req.raw);
    if (authError) return c.json({ error: authError }, user ? 403 : 401);

    const id = c.req.param("id");
    const msg = await kv.get(`msg:${id}`);
    if (!msg) return c.json({ error: "Message not found" }, 404);

    // Delete media file if exists
    if (msg.mediaPath) {
      const sb = supabaseAdmin();
      await sb.storage.from(BUCKET_NAME).remove([msg.mediaPath]);
    }

    await kv.del(`msg:${id}`);
    // Also delete associated favorites
    const favs = await kv.getByPrefix(`fav:`);
    // We just delete the message, favs reference by msgId
    return c.json({ success: true });
  } catch (e) {
    console.log("Delete message error:", e);
    return c.json({ error: `Delete message error: ${e}` }, 500);
  }
});

// ===================== FAVORITES =====================

// Toggle favorite
app.post(`${PREFIX}/favorites/toggle`, async (c) => {
  try {
    const user = await getUser(c.req.raw);
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const { messageId } = await c.req.json();
    const key = `fav:${user.id}:${messageId}`;
    const existing = await kv.get(key);

    if (existing) {
      await kv.del(key);
      return c.json({ favorited: false });
    } else {
      await kv.set(key, {
        userId: user.id,
        messageId,
        createdAt: new Date().toISOString(),
      });
      return c.json({ favorited: true });
    }
  } catch (e) {
    console.log("Toggle favorite error:", e);
    return c.json({ error: `Toggle favorite error: ${e}` }, 500);
  }
});

// Get user favorites
app.get(`${PREFIX}/favorites`, async (c) => {
  try {
    const user = await getUser(c.req.raw);
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const favs = await kv.getByPrefix(`fav:${user.id}:`);
    const messageIds = favs.map((f: any) => f.messageId);
    return c.json({ favorites: messageIds });
  } catch (e) {
    console.log("Get favorites error:", e);
    return c.json({ error: `Get favorites error: ${e}` }, 500);
  }
});

// ===================== COMMENTS =====================

// Add a comment to a message (requires auth)
app.post(`${PREFIX}/messages/:id/comments`, async (c) => {
  try {
    const user = await getUser(c.req.raw);
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const messageId = c.req.param("id");
    const { text } = await c.req.json();
    if (!text || !text.trim()) return c.json({ error: "Comment text is required" }, 400);

    const msg = await kv.get(`msg:${messageId}`);
    if (!msg) return c.json({ error: "Message not found" }, 404);

    let counter = (await kv.get("comment_counter")) || 0;
    counter++;
    await kv.set("comment_counter", counter);
    const commentId = `${Date.now()}-${counter}`;

    const comment = {
      id: commentId,
      messageId,
      userId: user.id,
      userName: user.user_metadata?.name || user.email?.split("@")[0] || "Disciple",
      userEmail: user.email,
      text: text.trim(),
      createdAt: new Date().toISOString(),
    };

    await kv.set(`cmt:${messageId}:${commentId}`, comment);
    return c.json({ comment });
  } catch (e) {
    console.log("Add comment error:", e);
    return c.json({ error: `Add comment error: ${e}` }, 500);
  }
});

// Get comments for a message (public)
app.get(`${PREFIX}/messages/:id/comments`, async (c) => {
  try {
    const messageId = c.req.param("id");
    const comments = await kv.getByPrefix(`cmt:${messageId}:`);
    const sorted = comments.sort(
      (a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    return c.json({ comments: sorted });
  } catch (e) {
    console.log("Get comments error:", e);
    return c.json({ error: `Get comments error: ${e}` }, 500);
  }
});

// Delete a comment (own comment or admin)
app.delete(`${PREFIX}/comments/:messageId/:commentId`, async (c) => {
  try {
    const user = await getUser(c.req.raw);
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const messageId = c.req.param("messageId");
    const commentId = c.req.param("commentId");
    const key = `cmt:${messageId}:${commentId}`;
    const comment = await kv.get(key);
    if (!comment) return c.json({ error: "Comment not found" }, 404);

    const role = await getUserRole(user.id);
    if (comment.userId !== user.id && role !== "admin") {
      return c.json({ error: "Forbidden: you can only delete your own comments" }, 403);
    }

    await kv.del(key);
    return c.json({ success: true });
  } catch (e) {
    console.log("Delete comment error:", e);
    return c.json({ error: `Delete comment error: ${e}` }, 500);
  }
});

// Get comment counts for all messages (public, for cards)
app.get(`${PREFIX}/comments/counts`, async (c) => {
  try {
    const allComments = await kv.getByPrefix("cmt:");
    const counts: Record<string, number> = {};
    allComments.forEach((cmt: any) => {
      if (cmt.messageId) {
        counts[cmt.messageId] = (counts[cmt.messageId] || 0) + 1;
      }
    });
    return c.json({ counts });
  } catch (e) {
    console.log("Get comment counts error:", e);
    return c.json({ error: `Get comment counts error: ${e}` }, 500);
  }
});

// ===================== SERIES =====================

// List all series (public)
app.get(`${PREFIX}/series`, async (c) => {
  try {
    const all = await kv.getByPrefix("series:");
    const series = all.sort(
      (a: any, b: any) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    return c.json({ series });
  } catch (e) {
    console.log("List series error:", e);
    return c.json({ error: `List series error: ${e}` }, 500);
  }
});

// Get single series with message details
app.get(`${PREFIX}/series/:id`, async (c) => {
  try {
    const id = c.req.param("id");
    const series = await kv.get(`series:${id}`);
    if (!series) return c.json({ error: "Series not found" }, 404);

    // Fetch all messages in the series
    const messageIds = series.messageIds || [];
    const messages: any[] = [];
    for (const msgId of messageIds) {
      const msg = await kv.get(`msg:${msgId}`);
      if (msg) messages.push(msg);
    }

    return c.json({ series, messages });
  } catch (e) {
    console.log("Get series error:", e);
    return c.json({ error: `Get series error: ${e}` }, 500);
  }
});

// Create series (admin only)
app.post(`${PREFIX}/series`, async (c) => {
  try {
    const { user, error: authError } = await requireAdmin(c.req.raw);
    if (authError) return c.json({ error: authError }, user ? 403 : 401);

    const body = await c.req.json();
    let counter = (await kv.get("series_counter")) || 0;
    counter++;
    await kv.set("series_counter", counter);
    const id = `series-${Date.now()}-${counter}`;

    const series = {
      id,
      title: body.title,
      description: body.description || "",
      coverImage: body.coverImage || "",
      author: body.author || "",
      category: body.category || "",
      messageIds: body.messageIds || [],
      totalModules: (body.messageIds || []).length,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await kv.set(`series:${id}`, series);
    return c.json({ series });
  } catch (e) {
    console.log("Create series error:", e);
    return c.json({ error: `Create series error: ${e}` }, 500);
  }
});

// Update series (admin only)
app.put(`${PREFIX}/series/:id`, async (c) => {
  try {
    const { user, error: authError } = await requireAdmin(c.req.raw);
    if (authError) return c.json({ error: authError }, user ? 403 : 401);

    const id = c.req.param("id");
    const existing = await kv.get(`series:${id}`);
    if (!existing) return c.json({ error: "Series not found" }, 404);

    const body = await c.req.json();
    const updated = {
      ...existing,
      ...body,
      id, // prevent id change
      totalModules: (body.messageIds || existing.messageIds || []).length,
      updatedAt: new Date().toISOString(),
    };

    await kv.set(`series:${id}`, updated);
    return c.json({ series: updated });
  } catch (e) {
    console.log("Update series error:", e);
    return c.json({ error: `Update series error: ${e}` }, 500);
  }
});

// Delete series (admin only)
app.delete(`${PREFIX}/series/:id`, async (c) => {
  try {
    const { user, error: authError } = await requireAdmin(c.req.raw);
    if (authError) return c.json({ error: authError }, user ? 403 : 401);

    const id = c.req.param("id");
    await kv.del(`series:${id}`);
    // Also delete all progress records for this series
    const allProgress = await kv.getByPrefix("sprogress:");
    const toDelete = allProgress
      .filter((p: any) => p.seriesId === id)
      .map((p: any) => `sprogress:${p.userId}:${p.seriesId}`);
    if (toDelete.length > 0) await kv.mdel(toDelete);
    return c.json({ success: true });
  } catch (e) {
    console.log("Delete series error:", e);
    return c.json({ error: `Delete series error: ${e}` }, 500);
  }
});

// Get user progress for a series
app.get(`${PREFIX}/series/:id/progress`, async (c) => {
  try {
    const user = await getUser(c.req.raw);
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const seriesId = c.req.param("id");
    const progress = await kv.get(`sprogress:${user.id}:${seriesId}`);
    return c.json({
      progress: progress || {
        userId: user.id,
        seriesId,
        completedMessageIds: [],
        lastAccessedAt: null,
      },
    });
  } catch (e) {
    console.log("Get series progress error:", e);
    return c.json({ error: `Get series progress error: ${e}` }, 500);
  }
});

// Update user progress — mark a message as completed in a series
app.post(`${PREFIX}/series/:id/progress`, async (c) => {
  try {
    const user = await getUser(c.req.raw);
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const seriesId = c.req.param("id");
    const { messageId } = await c.req.json();
    const key = `sprogress:${user.id}:${seriesId}`;
    const existing = await kv.get(key);

    const completedIds: string[] = existing?.completedMessageIds || [];
    if (!completedIds.includes(messageId)) {
      completedIds.push(messageId);
    }

    const progress = {
      userId: user.id,
      seriesId,
      completedMessageIds: completedIds,
      lastAccessedAt: new Date().toISOString(),
    };

    await kv.set(key, progress);
    return c.json({ progress });
  } catch (e) {
    console.log("Update series progress error:", e);
    return c.json({ error: `Update series progress error: ${e}` }, 500);
  }
});

// Get all user progress (for listing)
app.get(`${PREFIX}/series-progress`, async (c) => {
  try {
    const user = await getUser(c.req.raw);
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const allProgress = await kv.getByPrefix(`sprogress:${user.id}:`);
    const progressMap: Record<string, any> = {};
    allProgress.forEach((p: any) => {
      progressMap[p.seriesId] = p;
    });
    return c.json({ progress: progressMap });
  } catch (e) {
    console.log("Get all series progress error:", e);
    return c.json({ error: `Get all series progress error: ${e}` }, 500);
  }
});

// Find which series a message belongs to
app.get(`${PREFIX}/messages/:id/series`, async (c) => {
  try {
    const msgId = c.req.param("id");
    const allSeries = await kv.getByPrefix("series:");
    const found = allSeries.filter((s: any) =>
      (s.messageIds || []).includes(msgId)
    );
    return c.json({ series: found });
  } catch (e) {
    console.log("Get message series error:", e);
    return c.json({ error: `Get message series error: ${e}` }, 500);
  }
});

// ===================== SEED =====================

app.post(`${PREFIX}/seed`, async (c) => {
  try {
    const existing = await kv.getByPrefix("msg:");
    if (existing.length > 0) {
      // Seed series if not yet created
      const existingSeries = await kv.getByPrefix("series:");
      if (existingSeries.length === 0) {
        const seedSeries = [
          {
            id: "series-1",
            title: "Formation des leaders",
            description: "Un programme complet de formation pour les leaders d'eglise couvrant la vision, la mission, la gestion d'equipe et le leadership serviteur. Chaque module vous equipe pour servir efficacement.",
            coverImage: "https://images.unsplash.com/photo-1629141647559-70bc6c13c7fe?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxiaWJsZSUyMHN0dWR5JTIwZ3JvdXAlMjBjaHVyY2glMjBsZWFkZXJzaGlwfGVufDF8fHx8MTc3MjMxNzI1Mnww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
            author: "Frere Paul",
            category: "Formation",
            messageIds: ["seed-9", "seed-8", "seed-10"],
            totalModules: 3,
            createdAt: "2026-02-10T10:00:00Z",
            updatedAt: "2026-02-10T10:00:00Z",
          },
          {
            id: "series-2",
            title: "Fondements de la foi chretienne",
            description: "Decouvrez les bases essentielles de la foi chretienne a travers cette serie d'enseignements audio. De la priere a l'etude biblique, en passant par les dons spirituels, cette serie est ideale pour les nouveaux croyants et ceux qui veulent affermir leur foi.",
            coverImage: "https://images.unsplash.com/photo-1729714625765-6ad07c70038e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjaHJpc3RpYW4lMjBmYWl0aCUyMHByYXllciUyMGhhbmRzfGVufDF8fHx8MTc3MjMxNzI1M3ww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
            author: "Pasteur Jean",
            category: "Enseignement",
            messageIds: ["seed-1", "seed-5", "seed-2", "seed-6"],
            totalModules: 4,
            createdAt: "2026-02-05T10:00:00Z",
            updatedAt: "2026-02-05T10:00:00Z",
          },
          {
            id: "series-3",
            title: "Etudes bibliques essentielles",
            description: "Plongez dans les Ecritures avec cette collection d'etudes bibliques approfondies. Des beatitudes aux Actes des apotres, chaque module vous guide dans une comprehension plus profonde de la Parole de Dieu.",
            coverImage: "https://images.unsplash.com/photo-1766145549011-2eccae0bf7ca?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxvcGVuJTIwYmlibGUlMjBzdHVkeSUyMG5vdGVzJTIwZGVza3xlbnwxfHx8fDE3NzIzMTcyNTN8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
            author: "Pasteur Jean",
            category: "Etude biblique",
            messageIds: ["seed-11", "seed-16", "seed-13", "seed-15"],
            totalModules: 4,
            createdAt: "2026-01-20T10:00:00Z",
            updatedAt: "2026-01-20T10:00:00Z",
          },
        ];

        const seriesKeys = seedSeries.map((s) => `series:${s.id}`);
        await kv.mset(seriesKeys, seedSeries);
        await kv.set("series_counter", seedSeries.length);
      }

      return c.json({ message: "Data already seeded", count: existing.length });
    }

    const seedMessages = [
      {
        id: "seed-1", type: "audio", title: "La puissance de la priere dans la vie du disciple",
        author: "Pasteur Jean", category: "Predications", duration: "45:30",
        description: "Un enseignement profond sur l'importance de la priere quotidienne dans la vie de tout disciple de Jesus-Christ.",
        thumbnail: "", mediaPath: "", createdAt: "2026-02-27T10:00:00Z", userId: "system",
      },
      {
        id: "seed-2", type: "audio", title: "Comment etudier la Bible efficacement",
        author: "Pasteur Marie", category: "Enseignements", duration: "32:15",
        description: "Des methodes pratiques pour approfondir votre comprehension des Ecritures.",
        thumbnail: "", mediaPath: "", createdAt: "2026-02-25T10:00:00Z", userId: "system",
      },
      {
        id: "seed-3", type: "audio", title: "Louange et adoration : une arme spirituelle",
        author: "Frere David", category: "Louanges", duration: "28:45",
        description: "Decouvrez comment la louange et l'adoration sont des armes puissantes dans le combat spirituel.",
        thumbnail: "", mediaPath: "", createdAt: "2026-02-23T10:00:00Z", userId: "system",
      },
      {
        id: "seed-4", type: "audio", title: "Mon temoignage de conversion",
        author: "Soeur Ruth", category: "Temoignages", duration: "18:20",
        description: "Un temoignage inspirant de la transformation operee par la grace de Dieu.",
        thumbnail: "", mediaPath: "", createdAt: "2026-02-20T10:00:00Z", userId: "system",
      },
      {
        id: "seed-5", type: "audio", title: "La foi qui deplace les montagnes",
        author: "Pasteur Jean", category: "Predications", duration: "52:10",
        description: "La foi est la substance de ce qu'on espere. Apprenons a exercer notre foi avec puissance.",
        thumbnail: "", mediaPath: "", createdAt: "2026-02-18T10:00:00Z", userId: "system",
      },
      {
        id: "seed-6", type: "audio", title: "Les dons du Saint-Esprit",
        author: "Pasteur Esther", category: "Enseignements", duration: "40:05",
        description: "Un tour d'horizon complet des dons spirituels selon 1 Corinthiens 12.",
        thumbnail: "", mediaPath: "", createdAt: "2026-02-15T10:00:00Z", userId: "system",
      },
      {
        id: "seed-7", type: "video", title: "Culte dominical - Marcher dans la foi",
        author: "Pasteur Jean", category: "Cultes", duration: "1:25:30",
        description: "Culte complet avec louange et predication sur la marche par la foi.",
        thumbnail: "https://images.unsplash.com/photo-1624499843552-7347d9f6d285?w=600",
        mediaPath: "", createdAt: "2026-02-27T08:00:00Z", userId: "system",
      },
      {
        id: "seed-8", type: "video", title: "Seminaire sur le discipulat - Session 1",
        author: "Pasteur Marie", category: "Seminaires", duration: "58:15",
        description: "Premiere session du seminaire sur les fondements du discipulat chretien.",
        thumbnail: "https://images.unsplash.com/photo-1760367120345-2b96c53de838?w=600",
        mediaPath: "", createdAt: "2026-02-24T08:00:00Z", userId: "system",
      },
      {
        id: "seed-9", type: "video", title: "Formation des leaders - Module 3",
        author: "Frere Paul", category: "Formations", duration: "1:10:45",
        description: "Module 3 de la formation des leaders: la vision et la mission.",
        thumbnail: "https://images.unsplash.com/photo-1660176982561-0d9e8705877d?w=600",
        mediaPath: "", createdAt: "2026-02-20T08:00:00Z", userId: "system",
      },
      {
        id: "seed-10", type: "video", title: "Conference annuelle - L'appel de Dieu",
        author: "Evangeliste Samuel", category: "Conferences", duration: "2:05:00",
        description: "Conference annuelle sur le theme de l'appel de Dieu pour chaque croyant.",
        thumbnail: "https://images.unsplash.com/photo-1624499843552-7347d9f6d285?w=600",
        mediaPath: "", createdAt: "2026-02-15T08:00:00Z", userId: "system",
      },
      {
        id: "seed-11", type: "text", title: "Les beatitudes : un chemin de bonheur",
        author: "Pasteur Jean", category: "Etudes bibliques", duration: "",
        description: "Les beatitudes sont au coeur du sermon sur la montagne. Jesus nous montre un chemin de bonheur qui passe par l'humilite, la douceur et la justice. Decouvrons ensemble comment appliquer ces principes dans notre vie quotidienne de disciples. Chaque beatitude represente une etape dans notre croissance spirituelle.",
        thumbnail: "", mediaPath: "", createdAt: "2026-02-28T10:00:00Z", userId: "system",
      },
      {
        id: "seed-12", type: "text", title: "Meditation du matin : Psaume 23",
        author: "Soeur Ruth", category: "Meditations", duration: "",
        description: "L'Eternel est mon berger, je ne manquerai de rien. Cette declaration puissante du roi David nous rappelle que Dieu pourvoit a tous nos besoins. Prenons le temps ce matin de mediter sur la fidelite de notre Pere celeste et sur sa provision constante dans nos vies.",
        thumbnail: "", mediaPath: "", createdAt: "2026-02-27T06:00:00Z", userId: "system",
      },
      {
        id: "seed-13", type: "text", title: "Comment devenir un disciple engage",
        author: "Pasteur Marie", category: "Articles", duration: "",
        description: "Le discipulat n'est pas simplement une activite, c'est un mode de vie. Dans cet article, nous explorons les caracteristiques d'un vrai disciple de Jesus-Christ et les etapes pratiques pour grandir dans notre engagement. La cle est la constance et l'obeissance a la Parole.",
        thumbnail: "", mediaPath: "", createdAt: "2026-02-25T10:00:00Z", userId: "system",
      },
      {
        id: "seed-14", type: "text", title: "Notes : La grace suffisante de Dieu",
        author: "Frere Paul", category: "Notes de predication", duration: "",
        description: "Resume de la predication du dimanche sur 2 Corinthiens 12:9. La grace de Dieu est suffisante pour nous dans toutes nos faiblesses. Points cles et versets a retenir pour la semaine. Ma grace te suffit, car ma puissance s'accomplit dans la faiblesse.",
        thumbnail: "", mediaPath: "", createdAt: "2026-02-23T10:00:00Z", userId: "system",
      },
      {
        id: "seed-15", type: "text", title: "L'importance de la communion fraternelle",
        author: "Pasteur Esther", category: "Articles", duration: "",
        description: "La vie chretienne n'est pas faite pour etre vecue seul. Dieu nous a places dans une communaute pour que nous puissions nous encourager, nous soutenir et grandir ensemble dans la foi. Hebreux 10:25 nous exhorte a ne pas abandonner nos assemblees.",
        thumbnail: "", mediaPath: "", createdAt: "2026-02-20T10:00:00Z", userId: "system",
      },
      {
        id: "seed-16", type: "text", title: "Etude : Le livre des Actes - Chapitre 2",
        author: "Pasteur Jean", category: "Etudes bibliques", duration: "",
        description: "Le jour de la Pentecote, le Saint-Esprit est descendu sur les disciples. Cet evenement a change le cours de l'histoire. Etudions ensemble ce chapitre fondamental pour comprendre la mission de l'Eglise et la puissance du Saint-Esprit dans notre vie.",
        thumbnail: "", mediaPath: "", createdAt: "2026-02-18T10:00:00Z", userId: "system",
      },
    ];

    const keys = seedMessages.map((m) => `msg:${m.id}`);
    await kv.mset(keys, seedMessages);
    await kv.set("msg_counter", seedMessages.length);

    // Seed series
    const seedSeries = [
      {
        id: "series-1",
        title: "Formation des leaders",
        description: "Un programme complet de formation pour les leaders d'eglise couvrant la vision, la mission, la gestion d'equipe et le leadership serviteur. Chaque module vous equipe pour servir efficacement.",
        coverImage: "https://images.unsplash.com/photo-1629141647559-70bc6c13c7fe?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxiaWJsZSUyMHN0dWR5JTIwZ3JvdXAlMjBjaHVyY2glMjBsZWFkZXJzaGlwfGVufDF8fHx8MTc3MjMxNzI1Mnww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
        author: "Frere Paul",
        category: "Formation",
        messageIds: ["seed-9", "seed-8", "seed-10"],
        totalModules: 3,
        createdAt: "2026-02-10T10:00:00Z",
        updatedAt: "2026-02-10T10:00:00Z",
      },
      {
        id: "series-2",
        title: "Fondements de la foi chretienne",
        description: "Decouvrez les bases essentielles de la foi chretienne a travers cette serie d'enseignements audio. De la priere a l'etude biblique, en passant par les dons spirituels, cette serie est ideale pour les nouveaux croyants et ceux qui veulent affermir leur foi.",
        coverImage: "https://images.unsplash.com/photo-1729714625765-6ad07c70038e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjaHJpc3RpYW4lMjBmYWl0aCUyMHByYXllciUyMGhhbmRzfGVufDF8fHx8MTc3MjMxNzI1M3ww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
        author: "Pasteur Jean",
        category: "Enseignement",
        messageIds: ["seed-1", "seed-5", "seed-2", "seed-6"],
        totalModules: 4,
        createdAt: "2026-02-05T10:00:00Z",
        updatedAt: "2026-02-05T10:00:00Z",
      },
      {
        id: "series-3",
        title: "Etudes bibliques essentielles",
        description: "Plongez dans les Ecritures avec cette collection d'etudes bibliques approfondies. Des beatitudes aux Actes des apotres, chaque module vous guide dans une comprehension plus profonde de la Parole de Dieu.",
        coverImage: "https://images.unsplash.com/photo-1766145549011-2eccae0bf7ca?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxvcGVuJTIwYmlibGUlMjBzdHVkeSUyMG5vdGVzJTIwZGVza3xlbnwxfHx8fDE3NzIzMTcyNTN8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
        author: "Pasteur Jean",
        category: "Etude biblique",
        messageIds: ["seed-11", "seed-16", "seed-13", "seed-15"],
        totalModules: 4,
        createdAt: "2026-01-20T10:00:00Z",
        updatedAt: "2026-01-20T10:00:00Z",
      },
    ];

    const seriesKeys = seedSeries.map((s) => `series:${s.id}`);
    await kv.mset(seriesKeys, seedSeries);
    await kv.set("series_counter", seedSeries.length);

    return c.json({ message: "Seeded successfully", count: seedMessages.length });
  } catch (e) {
    console.log("Seed error:", e);
    return c.json({ error: `Seed error: ${e}` }, 500);
  }
});

// Health check
app.get(`${PREFIX}/health`, (c) => c.json({ status: "ok" }));

// ===================== ADMIN CONFIG =====================

// Get app configuration
app.get(`${PREFIX}/admin/config`, async (c) => {
  try {
    const { user, error: authError } = await requireAdmin(c.req.raw);
    if (authError) return c.json({ error: authError }, user ? 403 : 401);
    const config = await kv.get("config:app") || {
      appName: "ECODIS",
      appSubtitle: "Ecole des Disciples",
      maintenanceMode: false,
      registrationEnabled: true,
      commentsEnabled: true,
      downloadsEnabled: true,
      maxUploadSizeMb: 100,
      defaultLanguage: "fr",
      welcomeMessage: "Car je connais les projets que j'ai formes sur vous",
      welcomeVerse: "Jeremie 29:11",
      primaryColor: "#152a6b",
      accentColor: "#9b1b30",
      analyticsEnabled: true,
      autoSeedEnabled: true,
    };
    return c.json({ config });
  } catch (e) {
    console.log("Get config error:", e);
    return c.json({ error: `Get config error: ${e}` }, 500);
  }
});

// Update app configuration
app.put(`${PREFIX}/admin/config`, async (c) => {
  try {
    const { user, error: authError } = await requireAdmin(c.req.raw);
    if (authError) return c.json({ error: authError }, user ? 403 : 401);
    const body = await c.req.json();
    const existing = await kv.get("config:app") || {};
    const updated = { ...existing, ...body, updatedAt: new Date().toISOString(), updatedBy: user!.id };
    await kv.set("config:app", updated);
    // Log audit
    await logAudit(user!.id, user!.email || "", "config_update", "Configuration de l'application mise a jour", body);
    return c.json({ config: updated });
  } catch (e) {
    console.log("Update config error:", e);
    return c.json({ error: `Update config error: ${e}` }, 500);
  }
});

// ===================== AUDIT LOG =====================

async function logAudit(userId: string, userEmail: string, action: string, description: string, metadata?: any) {
  try {
    let counter = (await kv.get("audit_counter")) || 0;
    counter++;
    await kv.set("audit_counter", counter);
    const id = `${Date.now()}-${counter}`;
    await kv.set(`audit:${id}`, {
      id,
      userId,
      userEmail,
      action,
      description,
      metadata: metadata || {},
      createdAt: new Date().toISOString(),
    });
  } catch (e) {
    console.log("Audit log error:", e);
  }
}

// Get audit logs (admin only)
app.get(`${PREFIX}/admin/audit-log`, async (c) => {
  try {
    const { user, error: authError } = await requireAdmin(c.req.raw);
    if (authError) return c.json({ error: authError }, user ? 403 : 401);
    const logs = await kv.getByPrefix("audit:");
    const sorted = logs.sort((a: any, b: any) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    return c.json({ logs: sorted.slice(0, 200) });
  } catch (e) {
    console.log("Get audit log error:", e);
    return c.json({ error: `Get audit log error: ${e}` }, 500);
  }
});

// Clear audit logs (admin only)
app.delete(`${PREFIX}/admin/audit-log`, async (c) => {
  try {
    const { user, error: authError } = await requireAdmin(c.req.raw);
    if (authError) return c.json({ error: authError }, user ? 403 : 401);
    const logs = await kv.getByPrefix("audit:");
    if (logs.length > 0) {
      const keys = logs.map((l: any) => `audit:${l.id}`);
      await kv.mdel(keys);
    }
    await kv.set("audit_counter", 0);
    return c.json({ success: true, deleted: logs.length });
  } catch (e) {
    console.log("Clear audit log error:", e);
    return c.json({ error: `Clear audit log error: ${e}` }, 500);
  }
});

// ===================== ADMIN STORAGE STATS =====================

app.get(`${PREFIX}/admin/storage`, async (c) => {
  try {
    const { user, error: authError } = await requireAdmin(c.req.raw);
    if (authError) return c.json({ error: authError }, user ? 403 : 401);
    const sb = supabaseAdmin();
    let files: any[] = [];
    let totalSize = 0;
    try {
      const { data } = await sb.storage.from(BUCKET_NAME).list("audio", { limit: 500 });
      if (data) files.push(...data.map((f: any) => ({ ...f, folder: "audio" })));
    } catch (e) { console.log("List audio error:", e); }
    try {
      const { data } = await sb.storage.from(BUCKET_NAME).list("video", { limit: 500 });
      if (data) files.push(...data.map((f: any) => ({ ...f, folder: "video" })));
    } catch (e) { console.log("List video error:", e); }
    files.forEach((f: any) => { totalSize += f.metadata?.size || 0; });
    const audioFiles = files.filter((f: any) => f.folder === "audio");
    const videoFiles = files.filter((f: any) => f.folder === "video");
    const audioSize = audioFiles.reduce((a: number, f: any) => a + (f.metadata?.size || 0), 0);
    const videoSize = videoFiles.reduce((a: number, f: any) => a + (f.metadata?.size || 0), 0);
    return c.json({
      storage: {
        totalFiles: files.length,
        totalSize,
        audioFiles: audioFiles.length,
        audioSize,
        videoFiles: videoFiles.length,
        videoSize,
        files: files.map((f: any) => ({
          name: f.name,
          folder: f.folder,
          size: f.metadata?.size || 0,
          mimetype: f.metadata?.mimetype || "",
          createdAt: f.created_at,
        })),
      },
    });
  } catch (e) {
    console.log("Admin storage error:", e);
    return c.json({ error: `Admin storage error: ${e}` }, 500);
  }
});

// ===================== ADMIN BULK OPERATIONS =====================

// Bulk delete messages (admin only)
app.post(`${PREFIX}/admin/messages/bulk-delete`, async (c) => {
  try {
    const { user, error: authError } = await requireAdmin(c.req.raw);
    if (authError) return c.json({ error: authError }, user ? 403 : 401);
    const { messageIds } = await c.req.json();
    if (!Array.isArray(messageIds) || messageIds.length === 0) {
      return c.json({ error: "messageIds array required" }, 400);
    }
    const sb = supabaseAdmin();
    let deleted = 0;
    for (const id of messageIds) {
      const msg = await kv.get(`msg:${id}`);
      if (msg) {
        if (msg.mediaPath) {
          await sb.storage.from(BUCKET_NAME).remove([msg.mediaPath]);
        }
        await kv.del(`msg:${id}`);
        deleted++;
      }
    }
    await logAudit(user!.id, user!.email || "", "bulk_delete_messages", `${deleted} messages supprimes en masse`, { messageIds });
    return c.json({ success: true, deleted });
  } catch (e) {
    console.log("Bulk delete error:", e);
    return c.json({ error: `Bulk delete error: ${e}` }, 500);
  }
});

// Update message (admin only)
app.put(`${PREFIX}/messages/:id`, async (c) => {
  try {
    const { user, error: authError } = await requireAdmin(c.req.raw);
    if (authError) return c.json({ error: authError }, user ? 403 : 401);
    const id = c.req.param("id");
    const existing = await kv.get(`msg:${id}`);
    if (!existing) return c.json({ error: "Message not found" }, 404);
    const body = await c.req.json();
    const updated = { ...existing, ...body, id, updatedAt: new Date().toISOString() };
    await kv.set(`msg:${id}`, updated);
    await logAudit(user!.id, user!.email || "", "update_message", `Message "${updated.title}" mis a jour`, { messageId: id });
    return c.json({ message: updated });
  } catch (e) {
    console.log("Update message error:", e);
    return c.json({ error: `Update message error: ${e}` }, 500);
  }
});

// ===================== ADMIN STATS =====================

app.get(`${PREFIX}/admin/stats`, async (c) => {
  try {
    const { user, error: authError } = await requireAdmin(c.req.raw);
    if (authError) return c.json({ error: authError }, user ? 403 : 401);

    // Fetch all data in parallel
    const [allMessages, allFavorites, allComments, allRoles, allSeries, allProgress] = await Promise.all([
      kv.getByPrefix("msg:"),
      kv.getByPrefix("fav:"),
      kv.getByPrefix("cmt:"),
      kv.getByPrefix("role:"),
      kv.getByPrefix("series:"),
      kv.getByPrefix("sprogress:"),
    ]);

    // Also get user count from Supabase Auth
    const sb = supabaseAdmin();
    let totalUsers = 0;
    let recentSignups: any[] = [];
    try {
      const { data: { users } } = await sb.auth.admin.listUsers();
      totalUsers = users?.length || 0;
      recentSignups = (users || []).map((u: any) => ({
        id: u.id,
        email: u.email,
        name: u.user_metadata?.name || u.email?.split("@")[0] || "Disciple",
        createdAt: u.created_at,
        lastSignIn: u.last_sign_in_at,
      }));
    } catch (e) {
      console.log("Stats: listUsers error:", e);
      totalUsers = allRoles.length;
    }

    // ---- KPI totals ----
    const totalMessages = allMessages.length;
    const totalComments = allComments.length;
    const totalFavorites = allFavorites.length;
    const totalSeriesCount = allSeries.length;

    // Messages by type
    const messagesByType: Record<string, number> = { audio: 0, video: 0, text: 0 };
    allMessages.forEach((m: any) => {
      if (m.type) messagesByType[m.type] = (messagesByType[m.type] || 0) + 1;
    });

    // Messages by category
    const messagesByCategory: Record<string, number> = {};
    allMessages.forEach((m: any) => {
      if (m.category) messagesByCategory[m.category] = (messagesByCategory[m.category] || 0) + 1;
    });

    // ---- Top messages by favorites ----
    const favCountByMsg: Record<string, number> = {};
    allFavorites.forEach((f: any) => {
      if (f.messageId) favCountByMsg[f.messageId] = (favCountByMsg[f.messageId] || 0) + 1;
    });

    const topFavorited = Object.entries(favCountByMsg)
      .sort(([, a], [, b]) => (b as number) - (a as number))
      .slice(0, 10)
      .map(([msgId, count]) => {
        const msg = allMessages.find((m: any) => m.id === msgId);
        return {
          messageId: msgId,
          title: msg?.title || "Inconnu",
          author: msg?.author || "",
          type: msg?.type || "",
          favoriteCount: count,
        };
      });

    // ---- Top messages by comments ----
    const cmtCountByMsg: Record<string, number> = {};
    allComments.forEach((c: any) => {
      if (c.messageId) cmtCountByMsg[c.messageId] = (cmtCountByMsg[c.messageId] || 0) + 1;
    });

    const topCommented = Object.entries(cmtCountByMsg)
      .sort(([, a], [, b]) => (b as number) - (a as number))
      .slice(0, 10)
      .map(([msgId, count]) => {
        const msg = allMessages.find((m: any) => m.id === msgId);
        return {
          messageId: msgId,
          title: msg?.title || "Inconnu",
          author: msg?.author || "",
          type: msg?.type || "",
          commentCount: count,
        };
      });

    // ---- Activity over time (comments by day, last 30 days) ----
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const activityByDay: Record<string, { comments: number; favorites: number; signups: number }> = {};

    // Init last 30 days
    for (let i = 0; i < 30; i++) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const key = d.toISOString().slice(0, 10);
      activityByDay[key] = { comments: 0, favorites: 0, signups: 0 };
    }

    allComments.forEach((c: any) => {
      if (c.createdAt) {
        const d = new Date(c.createdAt);
        if (d >= thirtyDaysAgo) {
          const key = d.toISOString().slice(0, 10);
          if (activityByDay[key]) activityByDay[key].comments++;
        }
      }
    });

    allFavorites.forEach((f: any) => {
      if (f.createdAt) {
        const d = new Date(f.createdAt);
        if (d >= thirtyDaysAgo) {
          const key = d.toISOString().slice(0, 10);
          if (activityByDay[key]) activityByDay[key].favorites++;
        }
      }
    });

    recentSignups.forEach((u: any) => {
      if (u.createdAt) {
        const d = new Date(u.createdAt);
        if (d >= thirtyDaysAgo) {
          const key = d.toISOString().slice(0, 10);
          if (activityByDay[key]) activityByDay[key].signups++;
        }
      }
    });

    const activityTimeline = Object.entries(activityByDay)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, data]) => ({ date, ...data }));

    // ---- Messages created over time (last 30 days) ----
    const messagesByDay: Record<string, number> = {};
    allMessages.forEach((m: any) => {
      if (m.createdAt) {
        const d = new Date(m.createdAt);
        if (d >= thirtyDaysAgo) {
          const key = d.toISOString().slice(0, 10);
          messagesByDay[key] = (messagesByDay[key] || 0) + 1;
        }
      }
    });

    // ---- Engagement metrics ----
    const uniqueCommenters = new Set(allComments.map((c: any) => c.userId)).size;
    const uniqueFavoriters = new Set(allFavorites.map((f: any) => f.userId)).size;
    const engagementRate = totalUsers > 0
      ? Math.round(((uniqueCommenters + uniqueFavoriters) / (totalUsers * 2)) * 100)
      : 0;

    // ---- Top authors ----
    const authorCounts: Record<string, number> = {};
    allMessages.forEach((m: any) => {
      if (m.author) authorCounts[m.author] = (authorCounts[m.author] || 0) + 1;
    });

    const topAuthors = Object.entries(authorCounts)
      .sort(([, a], [, b]) => (b as number) - (a as number))
      .slice(0, 5)
      .map(([author, count]) => ({ author, messageCount: count }));

    // ---- Series progress stats ----
    const seriesStats = allSeries.map((s: any) => {
      const progressRecords = allProgress.filter((p: any) => p.seriesId === s.id);
      const totalEnrolled = progressRecords.length;
      const completedCount = progressRecords.filter(
        (p: any) => (p.completedMessageIds?.length || 0) >= (s.totalModules || 1)
      ).length;
      return {
        seriesId: s.id,
        title: s.title,
        totalModules: s.totalModules,
        enrolled: totalEnrolled,
        completed: completedCount,
      };
    });

    // ---- Top active commenters ----
    const commenterCounts: Record<string, { count: number; name: string }> = {};
    allComments.forEach((c: any) => {
      if (c.userId) {
        if (!commenterCounts[c.userId]) {
          commenterCounts[c.userId] = { count: 0, name: c.userName || "Anonyme" };
        }
        commenterCounts[c.userId].count++;
      }
    });

    const topCommenters = Object.entries(commenterCounts)
      .sort(([, a], [, b]) => b.count - a.count)
      .slice(0, 5)
      .map(([userId, data]) => ({ userId, name: data.name, commentCount: data.count }));

    return c.json({
      stats: {
        totals: {
          users: totalUsers,
          messages: totalMessages,
          comments: totalComments,
          favorites: totalFavorites,
          series: totalSeriesCount,
        },
        messagesByType,
        messagesByCategory,
        topFavorited,
        topCommented,
        topAuthors,
        topCommenters,
        activityTimeline,
        messagesByDay,
        engagementRate,
        uniqueCommenters,
        uniqueFavoriters,
        seriesStats,
      },
    });
  } catch (e) {
    console.log("Admin stats error:", e);
    return c.json({ error: `Admin stats error: ${e}` }, 500);
  }
});

// ===================== ADMIN SYSTEM HEALTH =====================

app.get(`${PREFIX}/admin/health`, async (c) => {
  try {
    const { user, error: authError } = await requireAdmin(c.req.raw);
    if (authError) return c.json({ error: authError }, user ? 403 : 401);

    const sb = supabaseAdmin();
    let dbConnected = true;
    let authServiceUp = true;
    let storageConnected = true;
    let kvEntries = 0;

    try {
      const allKeys = await kv.getByPrefix("msg:");
      const allRoles = await kv.getByPrefix("role:");
      const allComments = await kv.getByPrefix("cmt:");
      const allFavs = await kv.getByPrefix("fav:");
      const allSeries = await kv.getByPrefix("series:");
      const allAudit = await kv.getByPrefix("audit:");
      kvEntries = allKeys.length + allRoles.length + allComments.length + allFavs.length + allSeries.length + allAudit.length;
    } catch (e) { dbConnected = false; }

    try { await sb.auth.admin.listUsers({ page: 1, perPage: 1 }); } catch (e) { authServiceUp = false; }

    try {
      const { data: buckets } = await sb.storage.listBuckets();
      storageConnected = !!buckets;
    } catch (e) { storageConnected = false; }

    const overall = dbConnected && authServiceUp && storageConnected ? "healthy" : (!dbConnected ? "down" : "degraded");

    return c.json({
      health: {
        status: overall,
        uptime: "N/A",
        serverVersion: "3.0.0",
        dbConnected,
        storageConnected,
        authServiceUp,
        lastChecked: new Date().toISOString(),
        memoryUsage: 0,
        kvEntries,
      },
    });
  } catch (e) {
    console.log("Admin health error:", e);
    return c.json({ error: `Admin health error: ${e}` }, 500);
  }
});

// ===================== ADMIN CATEGORIES =====================

app.get(`${PREFIX}/admin/categories`, async (c) => {
  try {
    const { user, error: authError } = await requireAdmin(c.req.raw);
    if (authError) return c.json({ error: authError }, user ? 403 : 401);

    const allMessages = await kv.getByPrefix("msg:");
    const fromMessages = [...new Set(allMessages.map((m: any) => m.category).filter(Boolean))];
    const stored = await kv.get("config:categories");
    const custom: string[] = stored?.categories || [];
    const merged = [...new Set([...fromMessages, ...custom])].sort();
    return c.json({ categories: merged });
  } catch (e) {
    console.log("Get categories error:", e);
    return c.json({ error: `Get categories error: ${e}` }, 500);
  }
});

app.put(`${PREFIX}/admin/categories`, async (c) => {
  try {
    const { user, error: authError } = await requireAdmin(c.req.raw);
    if (authError) return c.json({ error: authError }, user ? 403 : 401);
    const { categories } = await c.req.json();
    await kv.set("config:categories", { categories, updatedAt: new Date().toISOString() });
    await logAudit(user!.id, user!.email || "", "categories_update", `Categories mises a jour (${categories.length})`, { categories });
    return c.json({ success: true });
  } catch (e) {
    console.log("Update categories error:", e);
    return c.json({ error: `Update categories error: ${e}` }, 500);
  }
});

// ===================== ADMIN ANNOUNCEMENTS =====================

app.get(`${PREFIX}/admin/announcements`, async (c) => {
  try {
    const { user, error: authError } = await requireAdmin(c.req.raw);
    if (authError) return c.json({ error: authError }, user ? 403 : 401);
    const all = await kv.getByPrefix("announce:");
    const sorted = all.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return c.json({ announcements: sorted });
  } catch (e) {
    console.log("Get announcements error:", e);
    return c.json({ error: `Get announcements error: ${e}` }, 500);
  }
});

app.post(`${PREFIX}/admin/announcements`, async (c) => {
  try {
    const { user, error: authError } = await requireAdmin(c.req.raw);
    if (authError) return c.json({ error: authError }, user ? 403 : 401);
    const body = await c.req.json();
    let counter = (await kv.get("announce_counter")) || 0;
    counter++;
    await kv.set("announce_counter", counter);
    const id = `${Date.now()}-${counter}`;
    const announcement = {
      id,
      title: body.title || "",
      message: body.message || "",
      type: body.type || "info",
      active: body.active !== false,
      createdAt: new Date().toISOString(),
      expiresAt: body.expiresAt || null,
    };
    await kv.set(`announce:${id}`, announcement);
    await logAudit(user!.id, user!.email || "", "create_announcement", `Annonce "${announcement.title}" creee`, { id });
    return c.json({ announcement });
  } catch (e) {
    console.log("Create announcement error:", e);
    return c.json({ error: `Create announcement error: ${e}` }, 500);
  }
});

app.delete(`${PREFIX}/admin/announcements/:id`, async (c) => {
  try {
    const { user, error: authError } = await requireAdmin(c.req.raw);
    if (authError) return c.json({ error: authError }, user ? 403 : 401);
    const id = c.req.param("id");
    await kv.del(`announce:${id}`);
    await logAudit(user!.id, user!.email || "", "delete_announcement", `Annonce supprimee`, { id });
    return c.json({ success: true });
  } catch (e) {
    console.log("Delete announcement error:", e);
    return c.json({ error: `Delete announcement error: ${e}` }, 500);
  }
});

// ===================== ADMIN EXPORT =====================

app.get(`${PREFIX}/admin/export`, async (c) => {
  try {
    const { user, error: authError } = await requireAdmin(c.req.raw);
    if (authError) return c.json({ error: authError }, user ? 403 : 401);
    const type = c.req.query("type") || "all";
    const result: any = { exportedAt: new Date().toISOString(), type };

    if (type === "messages" || type === "all") {
      result.messages = await kv.getByPrefix("msg:");
    }
    if (type === "users" || type === "all") {
      const sb = supabaseAdmin();
      try {
        const { data: { users } } = await sb.auth.admin.listUsers();
        const roles = await kv.getByPrefix("role:");
        const roleMap: Record<string, string> = {};
        roles.forEach((r: any) => { roleMap[r.userId] = r.role; });
        result.users = (users || []).map((u: any) => ({
          id: u.id, email: u.email,
          name: u.user_metadata?.name || u.email?.split("@")[0],
          role: roleMap[u.id] || "user",
          createdAt: u.created_at,
        }));
      } catch (e) { result.users = []; }
    }
    if (type === "all") {
      result.series = await kv.getByPrefix("series:");
      result.comments = await kv.getByPrefix("cmt:");
      result.favorites = await kv.getByPrefix("fav:");
      result.config = await kv.get("config:app");
    }

    await logAudit(user!.id, user!.email || "", "data_export", `Export de donnees (${type})`, { type });
    return c.json(result);
  } catch (e) {
    console.log("Admin export error:", e);
    return c.json({ error: `Admin export error: ${e}` }, 500);
  }
});

Deno.serve(app.fetch);