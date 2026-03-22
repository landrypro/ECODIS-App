export const queryKeys = {
  messages: (type?: string) => ["messages", type ?? "all"] as const,
  message: (id?: string) => ["message", id ?? "unknown"] as const,
  comments: (messageId?: string) => ["comments", messageId ?? "unknown"] as const,
  commentCounts: () => ["comment-counts"] as const,
  series: () => ["series"] as const,
  seriesDetail: (id?: string) => ["series-detail", id ?? "unknown"] as const,
  seriesProgress: (seriesId?: string, userId?: string | null) => ["series-progress", seriesId ?? "unknown", userId ?? "anon"] as const,
  allSeriesProgress: (userId?: string | null) => ["series-progress-all", userId ?? "anon"] as const,
  users: (userId?: string | null) => ["users", userId ?? "anon"] as const,
  adminStats: (userId?: string | null) => ["admin-stats", userId ?? "anon"] as const,
  home: () => ["home"] as const,
};
