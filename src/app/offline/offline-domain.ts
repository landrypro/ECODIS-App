import type { Message } from "../services/types";

export interface OfflineManifest {
  generatedAt: string;
  downloadsEnabled: boolean;
  maxOfflineStorageMb: number;
  messages: Array<Message & { hasMedia: boolean }>;
}

export function classifyOfflineDownload(
  local: { id: string; contentVersion: number },
  manifest: OfflineManifest,
): "valid" | "revoked" | "stale" {
  if (!manifest.downloadsEnabled) return "revoked";
  const remote = manifest.messages.find((message) => message.id === local.id);
  if (!remote) return "revoked";
  return remote.contentVersion === local.contentVersion ? "valid" : "stale";
}
