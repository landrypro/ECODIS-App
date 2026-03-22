import { Hono } from "npm:hono";
import { ANNOUNCEMENT_TYPES, BUCKET_NAME } from "../config.ts";
import { clearAuditLogs, fetchAuditLogs, logAudit } from "../lib/audit.ts";
import { getAnnouncements, getAppConfig, getStoredCategories, saveAnnouncements, updateAppConfigRow, updateStoredCategories } from "../lib/app-config.ts";
import { requireAdmin } from "../lib/auth.ts";
import { handleApiError, ValidationError } from "../lib/errors.ts";
import { fetchSeriesIdsForMessage, getMessageRow, removeMediaFile, syncSeriesModuleCounts } from "../lib/messages.ts";
import { mapAppConfig, mapSeries, mapMessage } from "../lib/mappers.ts";
import { seedMessages, seedSeries } from "../lib/seed-data.ts";
import { supabaseAdmin } from "../lib/supabase.ts";
import { normalizeStringArray, validateBoolean, validateOptionalString, validateRequiredString } from "../lib/validation.ts";

export const adminRoutes = new Hono();

adminRoutes.post("/seed", async (c) => {
  try {
    const { user, error: authError } = await requireAdmin(c.req.raw);
    if (authError) return c.json({ error: authError }, user ? 403 : 401);

    const admin = supabaseAdmin();
    const { count } = await admin.from("messages").select("id", { head: true, count: "exact" });
    if ((count ?? 0) > 0) {
      return c.json({ message: "Data already seeded", count: count ?? 0 });
    }

    const now = new Date().toISOString();
    const messageRows = seedMessages.map((item) => ({
      type: item.type,
      title: item.title,
      author: item.author,
      category: item.category,
      description: item.description,
      duration: item.duration,
      thumbnail: item.thumbnail,
      media_path: item.mediaPath,
      created_at: item.createdAt,
      updated_at: now,
      user_id: user!.id,
    }));
    const { data: insertedMessages, error } = await admin.from("messages").insert(messageRows).select("*");
    if (error) throw error;
    const ids = (insertedMessages ?? []).map((row: any) => row.id);

    for (const [index, series] of seedSeries.entries()) {
      const { data: seriesRow, error: seriesError } = await admin.from("series").insert({
        title: series.title,
        description: series.description,
        cover_image: series.coverImage,
        author: series.author,
        category: series.category,
        total_modules: series.messageIndexes.length,
        created_at: now,
        updated_at: now,
      }).select("*").single();
      if (seriesError) throw seriesError;
      await admin.from("series_messages").insert(
        series.messageIndexes.map((messageIndex, sortOrder) => ({
          series_id: seriesRow.id,
          message_id: ids[messageIndex],
          sort_order: sortOrder + 1,
        })),
      );
      await syncSeriesModuleCounts([seriesRow.id]);
    }

    await logAudit(user!.id, user!.email || "", "seed_database", "Jeu de donnees de demonstration insere", { insertedMessages: ids.length });
    return c.json({ message: "Seeded successfully", count: ids.length });
  } catch (error) {
    return handleApiError(c, error, "Seed error");
  }
});

adminRoutes.get("/admin/config", async (c) => {
  try {
    const { user, error: authError } = await requireAdmin(c.req.raw);
    if (authError) return c.json({ error: authError }, user ? 403 : 401);
    return c.json({ config: await getAppConfig() });
  } catch (error) {
    return handleApiError(c, error, "Get config error");
  }
});

adminRoutes.put("/admin/config", async (c) => {
  try {
    const { user, error: authError } = await requireAdmin(c.req.raw);
    if (authError) return c.json({ error: authError }, user ? 403 : 401);
    const body = await c.req.json();
    const updatedRow = await updateAppConfigRow({
      ...(body.appName !== undefined ? { app_name: validateRequiredString(body.appName, "appName", 2, 120) } : {}),
      ...(body.appSubtitle !== undefined ? { app_subtitle: validateOptionalString(body.appSubtitle, "appSubtitle", 160) } : {}),
      ...(body.maintenanceMode !== undefined ? { maintenance_mode: validateBoolean(body.maintenanceMode, "maintenanceMode") } : {}),
      ...(body.registrationEnabled !== undefined ? { registration_enabled: validateBoolean(body.registrationEnabled, "registrationEnabled") } : {}),
      ...(body.commentsEnabled !== undefined ? { comments_enabled: validateBoolean(body.commentsEnabled, "commentsEnabled") } : {}),
      ...(body.downloadsEnabled !== undefined ? { downloads_enabled: validateBoolean(body.downloadsEnabled, "downloadsEnabled") } : {}),
      ...(body.analyticsEnabled !== undefined ? { analytics_enabled: validateBoolean(body.analyticsEnabled, "analyticsEnabled") } : {}),
      ...(body.autoSeedEnabled !== undefined ? { auto_seed_enabled: validateBoolean(body.autoSeedEnabled, "autoSeedEnabled") } : {}),
      ...(body.maxUploadSizeMb !== undefined ? { max_upload_size_mb: Number(body.maxUploadSizeMb) } : {}),
      ...(body.defaultLanguage !== undefined ? { default_language: validateOptionalString(body.defaultLanguage, "defaultLanguage", 10) || "fr" } : {}),
      ...(body.welcomeMessage !== undefined ? { welcome_message: validateOptionalString(body.welcomeMessage, "welcomeMessage", 240) } : {}),
      ...(body.welcomeVerse !== undefined ? { welcome_verse: validateOptionalString(body.welcomeVerse, "welcomeVerse", 120) } : {}),
      ...(body.primaryColor !== undefined ? { primary_color: validateOptionalString(body.primaryColor, "primaryColor", 20) } : {}),
      ...(body.accentColor !== undefined ? { accent_color: validateOptionalString(body.accentColor, "accentColor", 20) } : {}),
    }, user!.id);

    if (!Number.isFinite(updatedRow.max_upload_size_mb) || updatedRow.max_upload_size_mb < 1 || updatedRow.max_upload_size_mb > 500) {
      throw new ValidationError("maxUploadSizeMb doit etre compris entre 1 et 500");
    }
    await logAudit(user!.id, user!.email || "", "config_update", "Configuration de l'application mise a jour", body);
    return c.json({ config: mapAppConfig(updatedRow) });
  } catch (error) {
    return handleApiError(c, error, "Update config error");
  }
});

adminRoutes.get("/admin/audit-log", async (c) => {
  try {
    const { user, error: authError } = await requireAdmin(c.req.raw);
    if (authError) return c.json({ error: authError }, user ? 403 : 401);
    return c.json({ logs: await fetchAuditLogs(200) });
  } catch (error) {
    return handleApiError(c, error, "Get audit log error");
  }
});

adminRoutes.delete("/admin/audit-log", async (c) => {
  try {
    const { user, error: authError } = await requireAdmin(c.req.raw);
    if (authError) return c.json({ error: authError }, user ? 403 : 401);
    const deleted = await clearAuditLogs();
    return c.json({ success: true, deleted });
  } catch (error) {
    return handleApiError(c, error, "Clear audit log error");
  }
});

adminRoutes.get("/admin/storage", async (c) => {
  try {
    const { user, error: authError } = await requireAdmin(c.req.raw);
    if (authError) return c.json({ error: authError }, user ? 403 : 401);
    const admin = supabaseAdmin();
    let files: any[] = [];
    let totalSize = 0;
    try {
      const { data } = await admin.storage.from(BUCKET_NAME).list("audio", { limit: 500 });
      if (data) files.push(...data.map((file: any) => ({ ...file, folder: "audio" })));
    } catch (error) { console.log("List audio error:", error); }
    try {
      const { data } = await admin.storage.from(BUCKET_NAME).list("video", { limit: 500 });
      if (data) files.push(...data.map((file: any) => ({ ...file, folder: "video" })));
    } catch (error) { console.log("List video error:", error); }
    files.forEach((file: any) => { totalSize += file.metadata?.size || 0; });
    const audioFiles = files.filter((file: any) => file.folder === "audio");
    const videoFiles = files.filter((file: any) => file.folder === "video");
    const audioSize = audioFiles.reduce((acc: number, file: any) => acc + (file.metadata?.size || 0), 0);
    const videoSize = videoFiles.reduce((acc: number, file: any) => acc + (file.metadata?.size || 0), 0);
    return c.json({
      storage: {
        totalFiles: files.length,
        totalSize,
        audioFiles: audioFiles.length,
        audioSize,
        videoFiles: videoFiles.length,
        videoSize,
        files: files.map((file: any) => ({
          name: file.name,
          folder: file.folder,
          size: file.metadata?.size || 0,
          mimetype: file.metadata?.mimetype || "",
          createdAt: file.created_at,
        })),
      },
    });
  } catch (error) {
    return handleApiError(c, error, "Admin storage error");
  }
});

adminRoutes.post("/admin/messages/bulk-delete", async (c) => {
  try {
    const { user, error: authError } = await requireAdmin(c.req.raw);
    if (authError) return c.json({ error: authError }, user ? 403 : 401);
    const { messageIds } = await c.req.json();
    const validatedMessageIds = normalizeStringArray(messageIds, "messageIds");
    if (validatedMessageIds.length === 0) {
      throw new ValidationError("messageIds array required");
    }

    let deleted = 0;
    const impactedSeriesIds: string[] = [];
    for (const messageId of validatedMessageIds) {
      const message = await getMessageRow(messageId);
      if (!message) continue;
      impactedSeriesIds.push(...await fetchSeriesIdsForMessage(messageId));
      await removeMediaFile(message.media_path);
      await supabaseAdmin().from("messages").delete().eq("id", messageId);
      deleted += 1;
    }
    await syncSeriesModuleCounts(impactedSeriesIds);
    await logAudit(user!.id, user!.email || "", "bulk_delete_messages", `${deleted} messages supprimes en masse`, { messageIds: validatedMessageIds });
    return c.json({ success: true, deleted });
  } catch (error) {
    return handleApiError(c, error, "Bulk delete error");
  }
});

adminRoutes.get("/admin/stats", async (c) => {
  try {
    const { user, error: authError } = await requireAdmin(c.req.raw);
    if (authError) return c.json({ error: authError }, user ? 403 : 401);
    const admin = supabaseAdmin();

    const [
      authUsers,
      messagesRes,
      favoritesRes,
      commentsRes,
      seriesRes,
      progressRes,
    ] = await Promise.all([
      admin.auth.admin.listUsers(),
      admin.from("messages").select("*"),
      admin.from("favorites").select("message_id, user_id, created_at"),
      admin.from("comments").select("message_id, user_id, user_name, created_at"),
      admin.from("series").select("*"),
      admin.from("series_progress").select("series_id, user_id, message_id, completed_at, last_accessed_at"),
    ]);

    const allMessages = messagesRes.data ?? [];
    const allFavorites = favoritesRes.data ?? [];
    const allComments = commentsRes.data ?? [];
    const allSeries = seriesRes.data ?? [];
    const allProgress = progressRes.data ?? [];
    const totalUsers = authUsers.data.users?.length ?? 0;
    const totalMessages = allMessages.length;
    const totalComments = allComments.length;
    const totalFavorites = allFavorites.length;
    const totalSeriesCount = allSeries.length;

    const messageMap = new Map(allMessages.map((row: any) => [row.id, row]));

    const messagesByType: Record<string, number> = {};
    const messagesByCategory: Record<string, number> = {};
    const messagesByDay: Record<string, number> = {};
    for (const message of allMessages) {
      messagesByType[message.type] = (messagesByType[message.type] || 0) + 1;
      messagesByCategory[message.category] = (messagesByCategory[message.category] || 0) + 1;
      const day = String(message.created_at).slice(0, 10);
      messagesByDay[day] = (messagesByDay[day] || 0) + 1;
    }

    const favoriteCounts: Record<string, number> = {};
    const favoritesTimeline: Record<string, number> = {};
    for (const favorite of allFavorites) {
      favoriteCounts[favorite.message_id] = (favoriteCounts[favorite.message_id] || 0) + 1;
      const day = String(favorite.created_at).slice(0, 10);
      favoritesTimeline[day] = (favoritesTimeline[day] || 0) + 1;
    }

    const commentCounts: Record<string, number> = {};
    const commentsTimeline: Record<string, number> = {};
    const commenterCounts: Record<string, { count: number; name: string }> = {};
    for (const comment of allComments) {
      commentCounts[comment.message_id] = (commentCounts[comment.message_id] || 0) + 1;
      const day = String(comment.created_at).slice(0, 10);
      commentsTimeline[day] = (commentsTimeline[day] || 0) + 1;
      if (!commenterCounts[comment.user_id]) {
        commenterCounts[comment.user_id] = { count: 0, name: comment.user_name || "Anonyme" };
      }
      commenterCounts[comment.user_id].count += 1;
    }

    const signupsTimeline: Record<string, number> = {};
    for (const authUser of authUsers.data.users ?? []) {
      const day = String(authUser.created_at).slice(0, 10);
      signupsTimeline[day] = (signupsTimeline[day] || 0) + 1;
    }

    const timelineDays = [...new Set([...Object.keys(commentsTimeline), ...Object.keys(favoritesTimeline), ...Object.keys(signupsTimeline)])].sort();
    const activityTimeline = timelineDays.map((date) => ({
      date,
      comments: commentsTimeline[date] || 0,
      favorites: favoritesTimeline[date] || 0,
      signups: signupsTimeline[date] || 0,
    }));

    const topFavorited = Object.entries(favoriteCounts)
      .sort(([, a], [, b]) => Number(b) - Number(a))
      .slice(0, 5)
      .map(([messageId, favoriteCount]) => {
        const message = messageMap.get(messageId);
        return {
          messageId,
          title: message?.title || "Message supprime",
          author: message?.author || "",
          type: message?.type || "text",
          favoriteCount: Number(favoriteCount),
        };
      });

    const topCommented = Object.entries(commentCounts)
      .sort(([, a], [, b]) => Number(b) - Number(a))
      .slice(0, 5)
      .map(([messageId, commentCount]) => {
        const message = messageMap.get(messageId);
        return {
          messageId,
          title: message?.title || "Message supprime",
          author: message?.author || "",
          type: message?.type || "text",
          commentCount: Number(commentCount),
        };
      });

    const authorCounts: Record<string, number> = {};
    for (const message of allMessages) {
      authorCounts[message.author] = (authorCounts[message.author] || 0) + 1;
    }
    const topAuthors = Object.entries(authorCounts)
      .sort(([, a], [, b]) => Number(b) - Number(a))
      .slice(0, 5)
      .map(([author, messageCount]) => ({ author, messageCount: Number(messageCount) }));

    const topCommenters = Object.entries(commenterCounts)
      .sort(([, a], [, b]) => b.count - a.count)
      .slice(0, 5)
      .map(([userId, entry]) => ({ userId, name: entry.name, commentCount: entry.count }));

    const seriesStats = [];
    for (const series of allSeries) {
      const enrolledUsers = new Set(allProgress.filter((row: any) => row.series_id === series.id).map((row: any) => row.user_id));
      const messageIds = new Set((await admin.from("series_messages").select("message_id").eq("series_id", series.id)).data?.map((row: any) => row.message_id) ?? []);
      const completionByUser: Record<string, Set<string>> = {};
      for (const row of allProgress.filter((item: any) => item.series_id === series.id)) {
        completionByUser[row.user_id] ??= new Set();
        completionByUser[row.user_id].add(row.message_id);
      }
      const completed = Object.values(completionByUser).filter((completedSet) => completedSet.size >= messageIds.size && messageIds.size > 0).length;
      seriesStats.push({
        seriesId: series.id,
        title: series.title,
        totalModules: series.total_modules,
        enrolled: enrolledUsers.size,
        completed,
      });
    }

    const uniqueCommenters = new Set(allComments.map((row: any) => row.user_id)).size;
    const uniqueFavoriters = new Set(allFavorites.map((row: any) => row.user_id)).size;
    const engagementRate = totalUsers > 0 ? Math.round(((uniqueCommenters + uniqueFavoriters) / (totalUsers * 2)) * 100) : 0;

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
  } catch (error) {
    return handleApiError(c, error, "Admin stats error");
  }
});

adminRoutes.get("/admin/health", async (c) => {
  try {
    const { user, error: authError } = await requireAdmin(c.req.raw);
    if (authError) return c.json({ error: authError }, user ? 403 : 401);

    const admin = supabaseAdmin();
    let dbConnected = true;
    let authServiceUp = true;
    let storageConnected = true;
    let kvEntries = 0;

    try {
      const [{ count: messagesCount }, { count: commentsCount }, { count: favoritesCount }, { count: seriesCount }, { count: auditCount }] = await Promise.all([
        admin.from("messages").select("id", { count: "exact", head: true }),
        admin.from("comments").select("id", { count: "exact", head: true }),
        admin.from("favorites").select("message_id", { count: "exact", head: true }),
        admin.from("series").select("id", { count: "exact", head: true }),
        admin.from("audit_logs").select("id", { count: "exact", head: true }),
      ]);
      kvEntries = (messagesCount ?? 0) + (commentsCount ?? 0) + (favoritesCount ?? 0) + (seriesCount ?? 0) + (auditCount ?? 0);
    } catch {
      dbConnected = false;
    }

    try {
      await admin.auth.admin.listUsers({ page: 1, perPage: 1 });
    } catch {
      authServiceUp = false;
    }

    try {
      const { data } = await admin.storage.listBuckets();
      storageConnected = !!data;
    } catch {
      storageConnected = false;
    }

    const overall = dbConnected && authServiceUp && storageConnected ? "healthy" : (!dbConnected ? "down" : "degraded");
    return c.json({
      health: {
        status: overall,
        uptime: "N/A",
        serverVersion: "4.0.0",
        dbConnected,
        storageConnected,
        authServiceUp,
        lastChecked: new Date().toISOString(),
        memoryUsage: 0,
        kvEntries,
      },
    });
  } catch (error) {
    return handleApiError(c, error, "Admin health error");
  }
});

adminRoutes.get("/admin/categories", async (c) => {
  try {
    const { user, error: authError } = await requireAdmin(c.req.raw);
    if (authError) return c.json({ error: authError }, user ? 403 : 401);
    const { data, error } = await supabaseAdmin().from("messages").select("category");
    if (error) throw error;
    const fromMessages = [...new Set((data ?? []).map((row: any) => row.category).filter(Boolean))];
    const custom = await getStoredCategories();
    return c.json({ categories: [...new Set([...fromMessages, ...custom])].sort() });
  } catch (error) {
    return handleApiError(c, error, "Get categories error");
  }
});

adminRoutes.put("/admin/categories", async (c) => {
  try {
    const { user, error: authError } = await requireAdmin(c.req.raw);
    if (authError) return c.json({ error: authError }, user ? 403 : 401);
    const { categories } = await c.req.json();
    const normalizedCategories = normalizeStringArray(categories, "categories", 200);
    await updateStoredCategories(normalizedCategories, user!.id);
    await logAudit(user!.id, user!.email || "", "categories_update", `Categories mises a jour (${normalizedCategories.length})`, { categories: normalizedCategories });
    return c.json({ success: true });
  } catch (error) {
    return handleApiError(c, error, "Update categories error");
  }
});

adminRoutes.get("/admin/announcements", async (c) => {
  try {
    const { user, error: authError } = await requireAdmin(c.req.raw);
    if (authError) return c.json({ error: authError }, user ? 403 : 401);
    const announcements = await getAnnouncements();
    const sorted = [...announcements].sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return c.json({ announcements: sorted });
  } catch (error) {
    return handleApiError(c, error, "Get announcements error");
  }
});

adminRoutes.post("/admin/announcements", async (c) => {
  try {
    const { user, error: authError } = await requireAdmin(c.req.raw);
    if (authError) return c.json({ error: authError }, user ? 403 : 401);
    const body = await c.req.json();
    const title = validateRequiredString(body.title, "Titre", 2, 160);
    const message = validateRequiredString(body.message, "Message", 2, 2000);
    const type = body.type ? validateRequiredString(body.type, "Type", 2, 20) : "info";
    if (!ANNOUNCEMENT_TYPES.has(type)) {
      throw new ValidationError("Type d'annonce invalide");
    }
    const active = body.active === undefined ? true : validateBoolean(body.active, "active");
    const expiresAt = body.expiresAt ? validateOptionalString(body.expiresAt, "expiresAt", 64) : null;
    const announcements = await getAnnouncements();
    const announcement = {
      id: crypto.randomUUID(),
      title,
      message,
      type,
      active,
      createdAt: new Date().toISOString(),
      expiresAt,
    };
    announcements.push(announcement);
    await saveAnnouncements(announcements, user!.id);
    await logAudit(user!.id, user!.email || "", "create_announcement", `Annonce "${announcement.title}" creee`, { id: announcement.id });
    return c.json({ announcement });
  } catch (error) {
    return handleApiError(c, error, "Create announcement error");
  }
});

adminRoutes.delete("/admin/announcements/:id", async (c) => {
  try {
    const { user, error: authError } = await requireAdmin(c.req.raw);
    if (authError) return c.json({ error: authError }, user ? 403 : 401);
    const id = c.req.param("id");
    const announcements = (await getAnnouncements()).filter((announcement: any) => announcement.id !== id);
    await saveAnnouncements(announcements, user!.id);
    await logAudit(user!.id, user!.email || "", "delete_announcement", "Annonce supprimee", { id });
    return c.json({ success: true });
  } catch (error) {
    return handleApiError(c, error, "Delete announcement error");
  }
});

adminRoutes.get("/admin/export", async (c) => {
  try {
    const { user, error: authError } = await requireAdmin(c.req.raw);
    if (authError) return c.json({ error: authError }, user ? 403 : 401);

    const admin = supabaseAdmin();
    const type = c.req.query("type") || "all";
    const result: any = { exportedAt: new Date().toISOString(), type };

    if (type === "messages" || type === "all") {
      const { data } = await admin.from("messages").select("*").order("created_at", { ascending: false });
      result.messages = (data ?? []).map(mapMessage);
    }
    if (type === "users" || type === "all") {
      const authUsers = await admin.auth.admin.listUsers();
      const { data: roles } = await admin.from("users_roles").select("*");
      const roleMap = new Map((roles ?? []).map((row: any) => [row.user_id, row.role]));
      const nameMap = new Map((roles ?? []).map((row: any) => [row.user_id, row.name]));
      result.users = (authUsers.data.users ?? []).map((authUser: any) => ({
        id: authUser.id,
        email: authUser.email,
        name: nameMap.get(authUser.id) || authUser.user_metadata?.name || authUser.email?.split("@")[0],
        role: roleMap.get(authUser.id) || "user",
        createdAt: authUser.created_at,
      }));
    }
    if (type === "all") {
      const { data: seriesRows } = await admin.from("series").select("*");
      result.series = [];
      for (const row of seriesRows ?? []) {
        const { data: links } = await admin.from("series_messages").select("message_id, sort_order").eq("series_id", row.id).order("sort_order", { ascending: true });
        result.series.push(mapSeries(row, (links ?? []).map((link: any) => link.message_id)));
      }
      const { data: comments } = await admin.from("comments").select("*");
      const { data: favorites } = await admin.from("favorites").select("*");
      result.comments = comments ?? [];
      result.favorites = favorites ?? [];
      result.config = await getAppConfig();
    }

    await logAudit(user!.id, user!.email || "", "data_export", `Export de donnees (${type})`, { type });
    return c.json(result);
  } catch (error) {
    return handleApiError(c, error, "Admin export error");
  }
});
