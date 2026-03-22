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
  createdAt: string;
  updatedAt?: string;
  userId: string | null;
}

export interface AppUser {
  id: string;
  email: string;
  name: string;
  role: string;
  createdAt: string;
  lastSignIn: string | null;
}

export interface Comment {
  id: string;
  messageId: string;
  userId: string;
  userName: string;
  userEmail: string;
  text: string;
  createdAt: string;
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
  createdAt: string;
  updatedAt: string;
}

export interface SeriesProgress {
  userId: string;
  seriesId: string;
  completedMessageIds: string[];
  lastAccessedAt: string | null;
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
