export function mapMessage(row: any) {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    author: row.author,
    category: row.category,
    description: row.description ?? "",
    duration: row.duration ?? "",
    thumbnail: row.thumbnail ?? "",
    mediaPath: row.media_path ?? "",
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? null,
    userId: row.user_id ?? null,
  };
}

export function mapComment(row: any) {
  return {
    id: row.id,
    messageId: row.message_id,
    userId: row.user_id,
    userName: row.user_name,
    userEmail: row.user_email,
    text: row.text,
    createdAt: row.created_at,
  };
}

export function mapSeries(row: any, messageIds: string[] = []) {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? "",
    coverImage: row.cover_image ?? "",
    author: row.author ?? "",
    category: row.category ?? "",
    messageIds,
    totalModules: row.total_modules ?? messageIds.length,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapRoleRow(row: any) {
  return {
    userId: row.user_id,
    email: row.email ?? "",
    name: row.name ?? "",
    role: row.role ?? "user",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapAppConfig(row: any) {
  return {
    appName: row.app_name,
    appSubtitle: row.app_subtitle,
    maintenanceMode: row.maintenance_mode,
    registrationEnabled: row.registration_enabled,
    commentsEnabled: row.comments_enabled,
    downloadsEnabled: row.downloads_enabled,
    maxUploadSizeMb: row.max_upload_size_mb,
    defaultLanguage: row.default_language,
    welcomeMessage: row.welcome_message,
    welcomeVerse: row.welcome_verse,
    primaryColor: row.primary_color,
    accentColor: row.accent_color,
    analyticsEnabled: row.analytics_enabled,
    autoSeedEnabled: row.auto_seed_enabled,
    updatedAt: row.updated_at,
    updatedBy: row.updated_by ?? null,
  };
}

export function mapAuditLog(row: any) {
  return {
    id: row.id,
    userId: row.user_id ?? null,
    userEmail: row.user_email ?? "",
    action: row.action,
    description: row.description,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
  };
}
