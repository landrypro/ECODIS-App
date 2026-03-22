import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import { Message } from "./api";

const CACHE_NAME = "ecodis-offline-media-v1";
const META_KEY = "ecodis-downloads";

export interface DownloadedMessage {
  id: string;
  title: string;
  author: string;
  type: "audio" | "video" | "text";
  category: string;
  duration: string;
  description: string;
  thumbnail: string;
  mediaUrl: string;
  createdAt: string;
  downloadedAt: string;
  fileSize: number;
}

interface DownloadProgress {
  messageId: string;
  progress: number; // 0-100
  status: "downloading" | "done" | "error";
}

interface DownloadContextType {
  downloads: DownloadedMessage[];
  activeDownloads: DownloadProgress[];
  storageUsed: number;
  storageQuota: number;
  isDownloaded: (messageId: string) => boolean;
  getOfflineUrl: (messageId: string) => string | null;
  downloadMessage: (message: Message) => Promise<void>;
  removeDownload: (messageId: string) => Promise<void>;
  clearAllDownloads: () => Promise<void>;
  refreshStorage: () => Promise<void>;
}

const DownloadContext = createContext<DownloadContextType>({
  downloads: [],
  activeDownloads: [],
  storageUsed: 0,
  storageQuota: 0,
  isDownloaded: () => false,
  getOfflineUrl: () => null,
  downloadMessage: async () => {},
  removeDownload: async () => {},
  clearAllDownloads: async () => {},
  refreshStorage: async () => {},
});

function getStoredMeta(): DownloadedMessage[] {
  try {
    const raw = localStorage.getItem(META_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function setStoredMeta(data: DownloadedMessage[]) {
  localStorage.setItem(META_KEY, JSON.stringify(data));
}

export function DownloadProvider({ children }: { children: ReactNode }) {
  const [downloads, setDownloads] = useState<DownloadedMessage[]>([]);
  const [activeDownloads, setActiveDownloads] = useState<DownloadProgress[]>(
    []
  );
  const [storageUsed, setStorageUsed] = useState(0);
  const [storageQuota, setStorageQuota] = useState(0);
  // Map of messageId -> object URL for cached media
  const [offlineUrls, setOfflineUrls] = useState<Record<string, string>>({});

  // Load metadata on mount
  useEffect(() => {
    setDownloads(getStoredMeta());
    refreshStorage();
  }, []);

  const refreshStorage = useCallback(async () => {
    try {
      if (navigator.storage && navigator.storage.estimate) {
        const estimate = await navigator.storage.estimate();
        setStorageUsed(estimate.usage || 0);
        setStorageQuota(estimate.quota || 0);
      }
    } catch (e) {
      console.log("Storage estimate error:", e);
    }
  }, []);

  const isDownloaded = useCallback(
    (messageId: string) => {
      return downloads.some((d) => d.id === messageId);
    },
    [downloads]
  );

  const getOfflineUrl = useCallback(
    (messageId: string) => {
      return offlineUrls[messageId] || null;
    },
    [offlineUrls]
  );

  const downloadMessage = useCallback(
    async (message: Message) => {
      if (!message.mediaUrl) {
        throw new Error("Aucun fichier media a telecharger");
      }

      if (isDownloaded(message.id)) {
        return; // Already downloaded
      }

      // Set progress
      setActiveDownloads((prev) => [
        ...prev,
        { messageId: message.id, progress: 0, status: "downloading" },
      ]);

      try {
        // Fetch with progress tracking
        const response = await fetch(message.mediaUrl);
        if (!response.ok) {
          throw new Error(`Erreur HTTP: ${response.status}`);
        }

        const contentLength = response.headers.get("content-length");
        const total = contentLength ? parseInt(contentLength, 10) : 0;

        let loaded = 0;
        const reader = response.body?.getReader();
        const chunks: Uint8Array[] = [];

        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
            loaded += value.length;

            if (total > 0) {
              const progress = Math.round((loaded / total) * 100);
              setActiveDownloads((prev) =>
                prev.map((d) =>
                  d.messageId === message.id
                    ? { ...d, progress }
                    : d
                )
              );
            } else {
              // Indeterminate - show pulsing
              setActiveDownloads((prev) =>
                prev.map((d) =>
                  d.messageId === message.id
                    ? { ...d, progress: -1 }
                    : d
                )
              );
            }
          }
        }

        // Reconstruct response and store in cache
        const blob = new Blob(chunks);
        const fileSize = blob.size;
        const cacheResponse = new Response(blob, {
          headers: {
            "Content-Type":
              response.headers.get("content-type") || "application/octet-stream",
          },
        });

        const cache = await caches.open(CACHE_NAME);
        const cacheKey = `offline-media-${message.id}`;
        await cache.put(cacheKey, cacheResponse);

        // Create object URL for playback
        const cachedResp = await cache.match(cacheKey);
        if (cachedResp) {
          const cachedBlob = await cachedResp.blob();
          const objectUrl = URL.createObjectURL(cachedBlob);
          setOfflineUrls((prev) => ({ ...prev, [message.id]: objectUrl }));
        }

        // Save metadata
        const meta: DownloadedMessage = {
          id: message.id,
          title: message.title,
          author: message.author,
          type: message.type,
          category: message.category,
          duration: message.duration,
          description: message.description,
          thumbnail: message.thumbnail,
          mediaUrl: message.mediaUrl,
          createdAt: message.createdAt,
          downloadedAt: new Date().toISOString(),
          fileSize,
        };

        setDownloads((prev) => {
          const updated = [...prev, meta];
          setStoredMeta(updated);
          return updated;
        });

        // Mark as done
        setActiveDownloads((prev) =>
          prev.map((d) =>
            d.messageId === message.id
              ? { ...d, progress: 100, status: "done" }
              : d
          )
        );

        // Remove from active after a moment
        setTimeout(() => {
          setActiveDownloads((prev) =>
            prev.filter((d) => d.messageId !== message.id)
          );
        }, 1500);

        await refreshStorage();
      } catch (e) {
        console.error("Download error:", e);
        setActiveDownloads((prev) =>
          prev.map((d) =>
            d.messageId === message.id
              ? { ...d, progress: 0, status: "error" }
              : d
          )
        );
        setTimeout(() => {
          setActiveDownloads((prev) =>
            prev.filter((d) => d.messageId !== message.id)
          );
        }, 3000);
        throw e;
      }
    },
    [isDownloaded, refreshStorage]
  );

  const removeDownload = useCallback(
    async (messageId: string) => {
      try {
        const cache = await caches.open(CACHE_NAME);
        await cache.delete(`offline-media-${messageId}`);

        // Revoke object URL
        if (offlineUrls[messageId]) {
          URL.revokeObjectURL(offlineUrls[messageId]);
          setOfflineUrls((prev) => {
            const copy = { ...prev };
            delete copy[messageId];
            return copy;
          });
        }

        setDownloads((prev) => {
          const updated = prev.filter((d) => d.id !== messageId);
          setStoredMeta(updated);
          return updated;
        });

        await refreshStorage();
      } catch (e) {
        console.error("Remove download error:", e);
      }
    },
    [offlineUrls, refreshStorage]
  );

  const clearAllDownloads = useCallback(async () => {
    try {
      await caches.delete(CACHE_NAME);

      // Revoke all object URLs
      Object.values(offlineUrls).forEach((url) => URL.revokeObjectURL(url));
      setOfflineUrls({});

      setDownloads([]);
      setStoredMeta([]);
      await refreshStorage();
    } catch (e) {
      console.error("Clear downloads error:", e);
    }
  }, [offlineUrls, refreshStorage]);

  // On mount, restore object URLs from cache for all downloads
  useEffect(() => {
    async function restoreUrls() {
      try {
        const cache = await caches.open(CACHE_NAME);
        const meta = getStoredMeta();
        const urls: Record<string, string> = {};
        const validMeta: DownloadedMessage[] = [];

        for (const item of meta) {
          const resp = await cache.match(`offline-media-${item.id}`);
          if (resp) {
            const blob = await resp.blob();
            urls[item.id] = URL.createObjectURL(blob);
            validMeta.push(item);
          }
        }

        // Clean up metadata for items no longer in cache
        if (validMeta.length !== meta.length) {
          setStoredMeta(validMeta);
          setDownloads(validMeta);
        }

        setOfflineUrls(urls);
      } catch (e) {
        console.log("Restore offline URLs error:", e);
      }
    }
    restoreUrls();
  }, []);

  return (
    <DownloadContext.Provider
      value={{
        downloads,
        activeDownloads,
        storageUsed,
        storageQuota,
        isDownloaded,
        getOfflineUrl,
        downloadMessage,
        removeDownload,
        clearAllDownloads,
        refreshStorage,
      }}
    >
      {children}
    </DownloadContext.Provider>
  );
}

export function useDownloads() {
  return useContext(DownloadContext);
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 o";
  const units = ["o", "Ko", "Mo", "Go"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}
