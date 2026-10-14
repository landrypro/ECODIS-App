import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { Message } from "./api";
import { useAuth } from "./auth-context";
import { classifyOfflineDownload, type OfflineManifest } from "../offline/offline-domain";
import { discardLegacyOfflineData, offlineRepository, type DownloadRecord } from "../offline/offline-repository";
import { fetchOfflineManifest, synchronizeProgressOutbox } from "../services/offline-service";

const CACHE_NAME = "ecodis-offline-media-v2";
const LEGACY_MIGRATION_KEY = "ecodis-offline-v2-migrated";

export interface DownloadedMessage extends Omit<Message, "mediaUrl"> {
  ownerId: string;
  downloadedAt: string;
  fileSize: number;
  seriesId?: string | null;
}

interface DownloadProgress {
  messageId: string;
  progress: number;
  status: "downloading" | "done" | "error" | "cancelled";
}

interface DownloadContextType {
  downloads: DownloadedMessage[];
  activeDownloads: DownloadProgress[];
  storageUsed: number;
  storageQuota: number;
  configuredLimit: number;
  isOnline: boolean;
  isPersistent: boolean;
  pendingProgress: number;
  syncState: "idle" | "syncing" | "error";
  lastSyncAt: string | null;
  isDownloaded: (messageId: string) => boolean;
  getOfflineUrl: (messageId: string) => string | null;
  getOfflineMessage: (messageId: string) => Promise<Message | null>;
  cacheMessage: (message: Message) => Promise<void>;
  downloadMessage: (message: Message, seriesId?: string | null) => Promise<void>;
  cancelDownload: (messageId: string) => void;
  removeDownload: (messageId: string) => Promise<void>;
  clearAllDownloads: () => Promise<void>;
  refreshStorage: () => Promise<void>;
  synchronize: () => Promise<void>;
}

const DownloadContext = createContext<DownloadContextType>({
  downloads: [], activeDownloads: [], storageUsed: 0, storageQuota: 0, configuredLimit: 1024 ** 3,
  isOnline: true, isPersistent: false, pendingProgress: 0, syncState: "idle", lastSyncAt: null,
  isDownloaded: () => false, getOfflineUrl: () => null, getOfflineMessage: async () => null,
  cacheMessage: async () => {}, downloadMessage: async () => {}, cancelDownload: () => {}, removeDownload: async () => {},
  clearAllDownloads: async () => {}, refreshStorage: async () => {}, synchronize: async () => {},
});

function toDownloaded(record: DownloadRecord): DownloadedMessage {
  return { ...record.message, ownerId: record.ownerId, downloadedAt: record.downloadedAt, fileSize: record.fileSize, seriesId: record.seriesId };
}

function withoutSignedUrl(message: Message): Message {
  const { mediaUrl: _mediaUrl, ...safe } = message;
  return safe;
}

export function DownloadProvider({ children }: { children: ReactNode }) {
  const { user, accessToken } = useAuth();
  const ownerId = user?.id ?? null;
  const [records, setRecords] = useState<DownloadRecord[]>([]);
  const [activeDownloads, setActiveDownloads] = useState<DownloadProgress[]>([]);
  const [storageUsed, setStorageUsed] = useState(0);
  const [storageQuota, setStorageQuota] = useState(0);
  const [configuredLimit, setConfiguredLimit] = useState(1024 ** 3);
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const [isPersistent, setIsPersistent] = useState(false);
  const [pendingProgress, setPendingProgress] = useState(0);
  const [syncState, setSyncState] = useState<"idle" | "syncing" | "error">("idle");
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [offlineUrls, setOfflineUrls] = useState<Record<string, string>>({});
  const abortControllers = useRef(new Map<string, AbortController>());
  const synchronizationInFlight = useRef(false);

  const refreshStorage = useCallback(async () => {
    const estimate = await navigator.storage?.estimate?.();
    setStorageUsed(estimate?.usage ?? 0);
    setStorageQuota(estimate?.quota ?? 0);
  }, []);

  const deleteRecord = useCallback(async (record: DownloadRecord) => {
    if (record.cacheKey) await (await caches.open(CACHE_NAME)).delete(record.cacheKey);
    await offlineRepository.deleteDownload(record.ownerId, record.id);
    await offlineRepository.deleteCachedMessage(record.ownerId, record.id);
    const url = offlineUrls[record.id];
    if (url) URL.revokeObjectURL(url);
    setOfflineUrls((previous) => { const next = { ...previous }; delete next[record.id]; return next; });
    setRecords((previous) => previous.filter((item) => item.key !== record.key));
  }, [offlineUrls]);

  const loadOwnerDownloads = useCallback(async () => {
    setOfflineUrls((previous) => {
      Object.values(previous).forEach(URL.revokeObjectURL);
      return {};
    });
    if (!ownerId) { setRecords([]); setPendingProgress(0); return; }
    const loaded = await offlineRepository.listDownloads(ownerId);
    const cache = await caches.open(CACHE_NAME);
    const urls: Record<string, string> = {};
    const valid: DownloadRecord[] = [];
    for (const record of loaded) {
      if (!record.cacheKey) { valid.push(record); continue; }
      const response = await cache.match(record.cacheKey);
      if (response) { urls[record.id] = URL.createObjectURL(await response.blob()); valid.push(record); }
      else await offlineRepository.deleteDownload(ownerId, record.id);
    }
    setRecords(valid);
    setOfflineUrls(urls);
    setPendingProgress((await offlineRepository.listOutbox(ownerId)).length);
  }, [ownerId]);

  const reconcile = useCallback(async (manifest: OfflineManifest) => {
    for (const record of records) if (classifyOfflineDownload(record, manifest) !== "valid") await deleteRecord(record);
    if (ownerId) {
      for (const cached of await offlineRepository.listCachedMessages(ownerId)) {
        const remote = manifest.messages.find((message) => message.id === cached.id);
        if (!remote || remote.contentVersion !== cached.contentVersion) await offlineRepository.deleteCachedMessage(ownerId, cached.id);
      }
    }
  }, [deleteRecord, ownerId, records]);

  const synchronize = useCallback(async () => {
    if (!ownerId || !accessToken || !navigator.onLine || synchronizationInFlight.current) return;
    synchronizationInFlight.current = true;
    setSyncState("syncing");
    try {
      const manifest = await fetchOfflineManifest(accessToken);
      setConfiguredLimit(manifest.maxOfflineStorageMb * 1024 ** 2);
      await reconcile(manifest);
      const result = await synchronizeProgressOutbox(ownerId, accessToken);
      setPendingProgress(result.pending);
      setLastSyncAt(new Date().toISOString());
      setSyncState("idle");
    } catch (error) {
      console.error("Offline synchronization error:", error);
      setSyncState("error");
    } finally {
      synchronizationInFlight.current = false;
    }
  }, [accessToken, ownerId, reconcile]);

  useEffect(() => {
    if (!localStorage.getItem(LEGACY_MIGRATION_KEY)) {
      discardLegacyOfflineData();
      localStorage.setItem(LEGACY_MIGRATION_KEY, "true");
    }
    void loadOwnerDownloads();
    void refreshStorage();
    void navigator.storage?.persist?.().then(setIsPersistent).catch(() => setIsPersistent(false));
  }, [loadOwnerDownloads, refreshStorage]);

  useEffect(() => {
    const online = () => { setIsOnline(true); void synchronize(); };
    const offline = () => setIsOnline(false);
    window.addEventListener("online", online); window.addEventListener("offline", offline);
    return () => { window.removeEventListener("online", online); window.removeEventListener("offline", offline); };
  }, [synchronize]);
  useEffect(() => {
    const updatePending = () => { if (ownerId) void offlineRepository.listOutbox(ownerId).then((items) => setPendingProgress(items.length)); };
    window.addEventListener("ecodis:outbox-changed", updatePending);
    return () => window.removeEventListener("ecodis:outbox-changed", updatePending);
  }, [ownerId]);
  useEffect(() => { if (ownerId && accessToken && navigator.onLine) void synchronize(); }, [ownerId, accessToken, synchronize]);

  const cacheMessage = useCallback(async (message: Message) => {
    if (ownerId) await offlineRepository.putCachedMessage(ownerId, withoutSignedUrl(message));
  }, [ownerId]);
  const getOfflineMessage = useCallback((messageId: string) => ownerId ? offlineRepository.getCachedMessage(ownerId, messageId) : Promise.resolve(null), [ownerId]);
  const isDownloaded = useCallback((messageId: string) => records.some((record) => record.id === messageId), [records]);
  const getOfflineUrl = useCallback((messageId: string) => offlineUrls[messageId] ?? null, [offlineUrls]);

  const downloadMessage = useCallback(async (message: Message, seriesId?: string | null) => {
    if (!ownerId || !accessToken) throw new Error("Connectez-vous pour telecharger ce contenu.");
    if (!navigator.onLine) throw new Error("Une connexion est necessaire pour lancer le telechargement.");
    if (isDownloaded(message.id)) return;
    const manifest = await fetchOfflineManifest(accessToken);
    const allowed = manifest.messages.find((item) => item.id === message.id);
    if (!manifest.downloadsEnabled || !allowed) throw new Error("Ce contenu n'est pas autorise hors ligne.");
    const limit = manifest.maxOfflineStorageMb * 1024 ** 2;
    setConfiguredLimit(limit);
    const used = records.reduce((sum, record) => sum + record.fileSize, 0);
    const controller = new AbortController();
    abortControllers.current.set(message.id, controller);
    setActiveDownloads((previous) => [...previous.filter((item) => item.messageId !== message.id), { messageId: message.id, progress: 0, status: "downloading" }]);
    try {
      let fileSize = 0;
      let cacheKey: string | null = null;
      if (message.type !== "text") {
        if (!message.mediaUrl) throw new Error("Aucun media disponible.");
        const response = await fetch(message.mediaUrl, { signal: controller.signal });
        if (!response.ok) throw new Error(`Telechargement impossible (HTTP ${response.status}).`);
        const announced = Number(response.headers.get("content-length") ?? 0);
        if (announced > 0 && used + announced > limit) throw new Error("Le quota hors ligne configure serait depasse.");
        const chunks: BlobPart[] = [];
        let received = 0;
        if (response.body) {
          const reader = response.body.getReader();
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            received += value.byteLength;
            if (used + received > limit) {
              await reader.cancel();
              throw new Error("Le quota hors ligne configure est depasse.");
            }
            chunks.push(value);
            setActiveDownloads((previous) => previous.map((item) => item.messageId === message.id
              ? { ...item, progress: announced > 0 ? Math.min(99, Math.round((received / announced) * 100)) : -1 }
              : item));
          }
        }
        const blob = response.body
          ? new Blob(chunks, { type: response.headers.get("content-type") ?? "application/octet-stream" })
          : await response.blob();
        fileSize = blob.size;
        if (used + fileSize > limit) throw new Error("Le quota hors ligne configure est depasse.");
        cacheKey = `${location.origin}/__ecodis_offline__/${encodeURIComponent(ownerId)}/${encodeURIComponent(message.id)}`;
        await (await caches.open(CACHE_NAME)).put(cacheKey, new Response(blob, { headers: { "Content-Type": response.headers.get("content-type") ?? "application/octet-stream" } }));
        setOfflineUrls((previous) => ({ ...previous, [message.id]: URL.createObjectURL(blob) }));
      }
      const safeMessage = withoutSignedUrl({ ...message, ...allowed });
      const record: DownloadRecord = { key: `${ownerId}:${message.id}`, ownerId, id: message.id, message: safeMessage, contentVersion: allowed.contentVersion, downloadedAt: new Date().toISOString(), fileSize, cacheKey, seriesId };
      await offlineRepository.putDownload(record);
      await offlineRepository.putCachedMessage(ownerId, safeMessage);
      setRecords((previous) => [...previous, record]);
      setActiveDownloads((previous) => previous.map((item) => item.messageId === message.id ? { ...item, progress: 100, status: "done" } : item));
      setTimeout(() => setActiveDownloads((previous) => previous.filter((item) => item.messageId !== message.id)), 1500);
      await refreshStorage();
    } catch (error) {
      const cancelled = error instanceof DOMException && error.name === "AbortError";
      setActiveDownloads((previous) => previous.map((item) => item.messageId === message.id ? { ...item, progress: 0, status: cancelled ? "cancelled" : "error" } : item));
      setTimeout(() => setActiveDownloads((previous) => previous.filter((item) => item.messageId !== message.id)), 2500);
      if (!cancelled) throw error;
    } finally { abortControllers.current.delete(message.id); }
  }, [accessToken, isDownloaded, ownerId, records, refreshStorage]);

  const cancelDownload = useCallback((messageId: string) => abortControllers.current.get(messageId)?.abort(), []);
  const removeDownload = useCallback(async (messageId: string) => {
    const record = records.find((item) => item.id === messageId);
    if (record) await deleteRecord(record);
    await refreshStorage();
  }, [deleteRecord, records, refreshStorage]);
  const clearAllDownloads = useCallback(async () => {
    for (const record of [...records]) await deleteRecord(record);
    await refreshStorage();
  }, [deleteRecord, records, refreshStorage]);

  return <DownloadContext.Provider value={{ downloads: records.map(toDownloaded), activeDownloads, storageUsed, storageQuota,
    configuredLimit, isOnline, isPersistent, pendingProgress, syncState, lastSyncAt, isDownloaded, getOfflineUrl,
    getOfflineMessage, cacheMessage, downloadMessage, cancelDownload, removeDownload, clearAllDownloads, refreshStorage, synchronize,
  }}>{children}</DownloadContext.Provider>;
}

export function useDownloads() { return useContext(DownloadContext); }
export function formatFileSize(bytes: number): string {
  if (!bytes) return "0 o";
  const units = ["o", "Ko", "Mo", "Go"];
  const index = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / 1024 ** index).toFixed(index ? 1 : 0)} ${units[index]}`;
}
