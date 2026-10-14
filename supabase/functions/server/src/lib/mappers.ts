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
    offlineDownloadable: row.offline_downloadable ?? true,
    contentVersion: row.content_version ?? 1,
    status: row.status ?? "published",
    publishedAt: row.published_at ?? null,
    scheduledAt: row.scheduled_at ?? null,
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
    status: row.status ?? "visible",
    createdAt: row.created_at,
  };
}

export function mapCommentReport(row: any) {
  return {
    id: row.id,
    commentId: row.comment_id,
    reporterId: row.reporter_id,
    reason: row.reason,
    detail: row.detail ?? "",
    status: row.status,
    reviewedAt: row.reviewed_at ?? null,
    reviewedBy: row.reviewed_by ?? null,
    resolutionNote: row.resolution_note ?? "",
    createdAt: row.created_at,
    comment: row.comments ? mapComment(row.comments) : null,
  };
}

export function mapModuleProgress(row: any) {
  return {
    messageId: row.message_id,
    state: row.state,
    progressPercent: row.progress_percent,
    positionSeconds: row.position_seconds,
    durationSeconds: row.duration_seconds,
    startedAt: row.started_at,
    completedAt: row.completed_at ?? null,
    lastAccessedAt: row.last_accessed_at,
    clientUpdatedAt: row.client_updated_at,
    serverUpdatedAt: row.server_updated_at,
    source: row.source,
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
    contentVersion: row.content_version ?? 1,
    status: row.status ?? "published",
    publishedAt: row.published_at ?? null,
    scheduledAt: row.scheduled_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    userId: row.user_id ?? null,
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
    maxOfflineStorageMb: row.max_offline_storage_mb ?? 1024,
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
