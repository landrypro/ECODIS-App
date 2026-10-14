import { offlineRepository, type ProgressOutboxRecord } from "../offline/offline-repository";
import type { OfflineManifest } from "../offline/offline-domain";
import { ApiError, fetchJson, getHeaders } from "./http";
import { updateSeriesProgress } from "./series-service";
import type { ProgressEvent, ProgressUpdateResult } from "./types";

export async function fetchOfflineManifest(accessToken: string): Promise<OfflineManifest> {
  return fetchJson<OfflineManifest>("/offline/manifest", { headers: getHeaders(accessToken) });
}

export async function submitOrQueueProgress(args: {
  ownerId: string;
  seriesId: string;
  messageId: string;
  event: ProgressEvent;
  accessToken: string;
  keepalive?: boolean;
}): Promise<ProgressUpdateResult | null> {
  try {
    if (!navigator.onLine) throw new TypeError("offline");
    return await updateSeriesProgress(args.seriesId, args.messageId, args.event, args.accessToken, args.keepalive);
  } catch (error) {
    if (error instanceof ApiError && error.status >= 400 && error.status < 500 && error.status !== 408 && error.status !== 429) throw error;
    const record: ProgressOutboxRecord = {
      eventId: args.event.eventId,
      ownerId: args.ownerId,
      seriesId: args.seriesId,
      messageId: args.messageId,
      event: { ...args.event, source: "offline_sync" },
      attempts: 0,
      lastError: error instanceof Error ? error.message : "Network error",
      createdAt: new Date().toISOString(),
    };
    await offlineRepository.putOutbox(record);
    window.dispatchEvent(new CustomEvent("ecodis:outbox-changed", { detail: { ownerId: args.ownerId } }));
    return null;
  }
}

export async function synchronizeProgressOutbox(ownerId: string, accessToken: string) {
  const records = (await offlineRepository.listOutbox(ownerId)).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  let synchronized = 0;
  for (const record of records) {
    try {
      await updateSeriesProgress(record.seriesId, record.messageId, record.event, accessToken);
      await offlineRepository.deleteOutbox(record.eventId);
      synchronized += 1;
    } catch (error) {
      if (error instanceof ApiError && error.status >= 400 && error.status < 500 && error.status !== 408 && error.status !== 429) {
        await offlineRepository.deleteOutbox(record.eventId);
        continue;
      }
      await offlineRepository.putOutbox({ ...record, attempts: record.attempts + 1, lastError: error instanceof Error ? error.message : "Network error" });
      break;
    }
  }
  window.dispatchEvent(new CustomEvent("ecodis:outbox-changed", { detail: { ownerId } }));
  return { synchronized, pending: (await offlineRepository.listOutbox(ownerId)).length };
}
