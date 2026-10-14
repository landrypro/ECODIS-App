export interface Message {
  id: string;
  type: "audio" | "video" | "text";
  title: string;
  author: string;
  category: string;
  description: string;
  duration: string;
  thumbnail: string;
  mediaPath: string;
  mediaUrl?: string;
  offlineDownloadable: boolean;
  contentVersion: number;
  status: EditorialStatus;
  publishedAt: string | null;
  scheduledAt: string | null;
  createdAt: string;
  updatedAt?: string;
  userId: string | null;
}

export type EditorialStatus = "draft" | "in_review" | "scheduled" | "published" | "archived";

export type AppRole = "user" | "content_editor" | "moderator" | "admin" | "super_admin";

export interface AppUser {
  id: string;
  email: string;
  name: string;
  role: AppRole;
  roles: AppRole[];
  permissions?: string[];
  createdAt: string;
  lastSignIn: string | null;
  emailConfirmedAt?: string | null;
  invitedAt?: string | null;
  accountStatus?: "active" | "suspended";
  suspensionReason?: string | null;
  suspendedAt?: string | null;
  suspensionExpiresAt?: string | null;
}

export interface Comment {
  id: string;
  messageId: string;
  userId: string;
  userName: string;
  userEmail: string;
  text: string;
  status: "visible" | "hidden" | "deleted_by_author" | "deleted_by_moderation";
  createdAt: string;
}

export type CommentReportReason = "spam" | "harassment" | "inappropriate_content" | "misinformation" | "other";

export interface CommentReport {
  id: string;
  commentId: string;
  reporterId: string;
  reason: CommentReportReason;
  detail: string;
  status: "open" | "resolved" | "dismissed";
  reviewedAt: string | null;
  reviewedBy: string | null;
  resolutionNote: string;
  createdAt: string;
  comment: Comment | null;
}

export interface Series {
  id: string;
  title: string;
  description: string;
  coverImage: string;
  author: string;
  category: string;
  messageIds: string[];
  totalModules: number;
  contentVersion: number;
  status: EditorialStatus;
  publishedAt: string | null;
  scheduledAt: string | null;
  createdAt: string;
  updatedAt: string;
  userId: string | null;
}

export interface SeriesProgress {
  userId: string;
  seriesId: string;
  modules: Record<string, ModuleProgress>;
  completedMessageIds: string[];
  totalModules: number;
  progressPercent: number;
  nextMessageId: string | null;
  isCompleted: boolean;
  lastAccessedAt: string | null;
}

export type ProgressState = "in_progress" | "completed";
export type ProgressSource = "online" | "offline_sync" | "manual";

export interface ModuleProgress {
  messageId: string;
  state: ProgressState;
  progressPercent: number;
  positionSeconds: number;
  durationSeconds: number;
  startedAt: string;
  completedAt: string | null;
  lastAccessedAt: string;
  clientUpdatedAt: string;
  serverUpdatedAt: string;
  source: ProgressSource;
}

export interface ProgressEvent {
  eventId: string;
  state: ProgressState;
  progressPercent: number;
  positionSeconds: number;
  durationSeconds: number;
  clientUpdatedAt: string;
  source: ProgressSource;
}

export interface ProgressUpdateResult {
  eventId: string;
  replayed: boolean;
  module: ModuleProgress;
  progress: SeriesProgress;
}

export interface AdminStats {
  totals: {
    users: number;
    messages: number;
    comments: number;
    favorites: number;
    series: number;
  };
  messagesByType: Record<string, number>;
  messagesByCategory: Record<string, number>;
  topFavorited: {
    messageId: string;
    title: string;
    author: string;
    type: string;
    favoriteCount: number;
  }[];
  topCommented: {
    messageId: string;
    title: string;
    author: string;
    type: string;
    commentCount: number;
  }[];
  topAuthors: { author: string; messageCount: number }[];
  topCommenters: { userId: string; name: string; commentCount: number }[];
  activityTimeline: {
    date: string;
    comments: number;
    favorites: number;
    signups: number;
  }[];
  messagesByDay: Record<string, number>;
  engagementRate: number;
  uniqueCommenters: number;
  uniqueFavoriters: number;
  seriesStats: {
    seriesId: string;
    title: string;
    totalModules: number;
    enrolled: number;
    completed: number;
  }[];
}

export interface AppConfig {
  appName: string;
  appSubtitle: string;
  maintenanceMode: boolean;
  registrationEnabled: boolean;
  commentsEnabled: boolean;
  downloadsEnabled: boolean;
  maxUploadSizeMb: number;
  maxOfflineStorageMb: number;
  defaultLanguage: string;
  welcomeMessage: string;
  welcomeVerse: string;
  primaryColor: string;
  accentColor: string;
  analyticsEnabled: boolean;
  autoSeedEnabled: boolean;
  updatedAt?: string;
  updatedBy?: string | null;
}

export interface AuditLog {
  id: string;
  userId: string | null;
  userEmail: string;
  action: string;
  description: string;
  metadata: unknown;
  createdAt: string;
}

export interface StorageStats {
  totalFiles: number;
  totalSize: number;
  audioFiles: number;
  audioSize: number;
  videoFiles: number;
  videoSize: number;
  files: { name: string; folder: string; size: number; mimetype: string; createdAt: string }[];
}

export interface Announcement {
  id: string;
  title: string;
  message: string;
  type: "info" | "warning" | "success" | "error";
  active: boolean;
  createdAt: string;
  expiresAt: string | null;
}

export interface SystemHealth {
  status: "healthy" | "degraded" | "down";
  uptime: string;
  serverVersion: string;
  dbConnected: boolean;
  storageConnected: boolean;
  authServiceUp: boolean;
  lastChecked: string;
  memoryUsage: number;
  kvEntries: number;
}
