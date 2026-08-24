import type { Message, ProgressEvent, Series } from "../services/types";

const DB_NAME = "ecodis-offline-v1";
const DB_VERSION = 1;
const DOWNLOADS = "downloads";
const OUTBOX = "progress_outbox";
const APP_CACHE = "app_cache";

export interface DownloadRecord {
  key: string;
  ownerId: string;
  id: string;
  message: Message;
  contentVersion: number;
  downloadedAt: string;
  fileSize: number;
  cacheKey: string | null;
  seriesId?: string | null;
}

export interface ProgressOutboxRecord {
  eventId: string;
  ownerId: string;
  seriesId: string;
  messageId: string;
  event: ProgressEvent;
  attempts: number;
  lastError: string;
  createdAt: string;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(DOWNLOADS)) db.createObjectStore(DOWNLOADS, { keyPath: "key" }).createIndex("ownerId", "ownerId");
      if (!db.objectStoreNames.contains(OUTBOX)) db.createObjectStore(OUTBOX, { keyPath: "eventId" }).createIndex("ownerId", "ownerId");
      if (!db.objectStoreNames.contains(APP_CACHE)) db.createObjectStore(APP_CACHE, { keyPath: "key" }).createIndex("ownerId", "ownerId");
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function transact<T>(storeName: string, mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, mode);
    const request = action(transaction.objectStore(storeName));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => db.close();
    transaction.onerror = () => reject(transaction.error);
  });
}

async function listByOwner<T>(storeName: string, ownerId: string): Promise<T[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, "readonly");
    const request = transaction.objectStore(storeName).index("ownerId").getAll(ownerId);
    request.onsuccess = () => resolve(request.result as T[]);
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => db.close();
  });
}

export const offlineRepository = {
  listDownloads: (ownerId: string) => listByOwner<DownloadRecord>(DOWNLOADS, ownerId),
  putDownload: (record: DownloadRecord) => transact(DOWNLOADS, "readwrite", (store) => store.put(record)),
  deleteDownload: (ownerId: string, id: string) => transact(DOWNLOADS, "readwrite", (store) => store.delete(`${ownerId}:${id}`)),
  listOutbox: (ownerId: string) => listByOwner<ProgressOutboxRecord>(OUTBOX, ownerId),
  putOutbox: (record: ProgressOutboxRecord) => transact(OUTBOX, "readwrite", (store) => store.put(record)),
  deleteOutbox: (eventId: string) => transact(OUTBOX, "readwrite", (store) => store.delete(eventId)),
  putCachedMessage: (ownerId: string, message: Message) => transact(APP_CACHE, "readwrite", (store) => store.put({ key: `${ownerId}:${message.id}`, ownerId, kind: "message", message, cachedAt: new Date().toISOString() })),
  listCachedMessages: async (ownerId: string): Promise<Message[]> => (await listByOwner<any>(APP_CACHE, ownerId)).filter((record) => record.kind === "message").map((record) => record.message),
  getCachedMessage: async (ownerId: string, id: string): Promise<Message | null> => {
    const result = await transact<any>(APP_CACHE, "readonly", (store) => store.get(`${ownerId}:${id}`));
    return result?.message ?? null;
  },
  deleteCachedMessage: (ownerId: string, id: string) => transact(APP_CACHE, "readwrite", (store) => store.delete(`${ownerId}:${id}`)),
  putSeriesContext: (ownerId: string, series: Series, messages: Message[]) => transact(APP_CACHE, "readwrite", (store) => store.put({ key: `${ownerId}:series:${series.id}`, ownerId, kind: "series", series, messages: messages.map(({ mediaUrl: _mediaUrl, ...message }) => message), cachedAt: new Date().toISOString() })),
  getSeriesContext: async (ownerId: string, seriesId: string): Promise<{ series: Series; messages: Message[] } | null> => {
    const result = await transact<any>(APP_CACHE, "readonly", (store) => store.get(`${ownerId}:series:${seriesId}`));
    return result?.series ? { series: result.series, messages: result.messages ?? [] } : null;
  },
};

export function discardLegacyOfflineData() {
  localStorage.removeItem("ecodis-downloads");
  void caches.delete("ecodis-offline-media-v1");
}
