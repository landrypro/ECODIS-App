import { useNavigate } from "react-router";
import {
  useDownloads,
  formatFileSize,
  DownloadedMessage,
} from "../download-context";
import {
  Trash2,
  Mic,
  Video,
  FileText,
  HardDrive,
  AlertTriangle,
  ChevronRight,
  WifiOff,
  Loader2,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export function DownloadsPage() {
  const {
    downloads,
    storageUsed,
    storageQuota,
    removeDownload,
    clearAllDownloads,
    configuredLimit,
    isOnline,
    isPersistent,
    pendingProgress,
    syncState,
    lastSyncAt,
    synchronize,
  } = useDownloads();
  const navigate = useNavigate();
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);
  const [showConfirmClear, setShowConfirmClear] = useState(false);

  const totalDownloadSize = downloads.reduce((acc, d) => acc + d.fileSize, 0);
  const storagePercent =
    storageQuota > 0 ? Math.round((storageUsed / storageQuota) * 100) : 0;

  const handleRemove = async (id: string) => {
    setRemovingId(id);
    await removeDownload(id);
    toast.success("Telechargement supprime");
    setRemovingId(null);
  };

  const handleClearAll = async () => {
    setClearing(true);
    await clearAllDownloads();
    toast.success("Tous les telechargements ont ete supprimes");
    setClearing(false);
    setShowConfirmClear(false);
  };

  const audioDownloads = downloads.filter((d) => d.type === "audio");
  const videoDownloads = downloads.filter((d) => d.type === "video");
  const textDownloads = downloads.filter((d) => d.type === "text");

  const renderDownloadItem = (item: DownloadedMessage) => {
    const isRemoving = removingId === item.id;
    return (
      <div
        key={item.id}
        className="flex items-center gap-3 px-4 py-3 border-b border-border last:border-b-0"
      >
        <button
          onClick={() => navigate(`/message/${item.id}${item.seriesId ? `?series=${encodeURIComponent(item.seriesId)}` : ""}`)}
          className="flex items-center gap-3 flex-1 min-w-0 text-left"
        >
          <div
            className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
              item.type === "audio"
                ? "bg-[#152a6b]/10 text-[#152a6b]"
                : "bg-[#9b1b30]/10 text-[#9b1b30]"
            }`}
          >
            {item.type === "audio" ? (
              <Mic className="w-4 h-4" />
            ) : item.type === "video" ? (
              <Video className="w-4 h-4" />
            ) : <FileText className="w-4 h-4" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] text-card-foreground truncate">
              {item.title}
            </p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[11px] text-muted-foreground">
                {item.author}
              </span>
              <span className="text-[10px] text-muted-foreground">·</span>
              <span className="text-[11px] text-muted-foreground">
                {formatFileSize(item.fileSize)}
              </span>
              {item.duration && (
                <>
                  <span className="text-[10px] text-muted-foreground">·</span>
                  <span className="text-[11px] text-muted-foreground">
                    {item.duration}
                  </span>
                </>
              )}
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
        </button>
        <button
          onClick={() => handleRemove(item.id)}
          disabled={isRemoving}
          className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-muted-foreground hover:text-[#9b1b30] hover:bg-[#9b1b30]/10 transition-colors"
        >
          {isRemoving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Trash2 className="w-4 h-4" />
          )}
        </button>
      </div>
    );
  };

  return (
    <div className="pb-20 lg:pb-6">
      {/* Storage Overview */}
      <div className="px-4 lg:px-6 pt-4 mb-4">
        <div className="bg-card rounded-xl border border-border p-4 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-[#152a6b]/10 flex items-center justify-center">
              <HardDrive className="w-5 h-5 text-[#152a6b]" />
            </div>
            <div className="flex-1">
              <p className="text-[13px] font-medium text-foreground">
                Stockage utilise
              </p>
              <p className="text-[11px] text-muted-foreground">
                {downloads.length} fichier{downloads.length !== 1 ? "s" : ""} ·{" "}
                {formatFileSize(totalDownloadSize)}
              </p>
            </div>
          </div>

          {/* Storage bar */}
          <div className="h-2 bg-muted rounded-full overflow-hidden mb-1.5">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                storagePercent > 80
                  ? "bg-[#9b1b30]"
                  : storagePercent > 50
                  ? "bg-amber-500"
                  : "bg-[#152a6b]"
              }`}
              style={{ width: `${Math.max(storagePercent, 1)}%` }}
            />
          </div>
          <div className="flex justify-between">
            <span className="text-[10px] text-muted-foreground">
              {formatFileSize(storageUsed)} utilise
            </span>
            <span className="text-[10px] text-muted-foreground">
              {storageQuota > 0
                ? `${formatFileSize(storageQuota)} total`
                : "Quota inconnu"}
            </span>
          </div>

          {storagePercent > 80 && (
            <div className="flex items-center gap-2 mt-3 p-2 bg-[#9b1b30]/10 rounded-lg">
              <AlertTriangle className="w-4 h-4 text-[#9b1b30] shrink-0" />
              <p className="text-[11px] text-[#9b1b30]">
                L'espace de stockage est presque plein. Supprimez des
                telechargements pour liberer de l'espace.
              </p>
            </div>
          )}
          <div className="mt-3 pt-3 border-t border-border text-[11px] text-muted-foreground space-y-1">
            <p>Limite ECODIS : {formatFileSize(configuredLimit)} · Stockage persistant : {isPersistent ? "oui" : "non garanti"}</p>
            <p>Reseau : {isOnline ? "en ligne" : "hors ligne"} · Progressions en attente : {pendingProgress}</p>
            <div className="flex items-center justify-between gap-3">
              <span>Derniere synchronisation : {lastSyncAt ? new Date(lastSyncAt).toLocaleString("fr-FR") : "jamais"}</span>
              <button disabled={!isOnline || syncState === "syncing"} onClick={() => void synchronize()} className="text-[#152a6b] font-medium disabled:opacity-50">{syncState === "syncing" ? "Synchronisation..." : "Synchroniser"}</button>
            </div>
          </div>
        </div>
      </div>

      {/* Empty state */}
      {downloads.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 px-6">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
            <WifiOff className="w-8 h-8 text-muted-foreground/50" />
          </div>
          <h3 className="text-[15px] font-medium text-foreground mb-1">
            Aucun telechargement
          </h3>
          <p className="text-[12px] text-muted-foreground text-center max-w-[260px]">
            Telechargez des messages audio et video pour les ecouter meme sans
            connexion Internet.
          </p>
          <button
            onClick={() => navigate("/audio")}
            className="mt-4 px-5 py-2.5 bg-[#152a6b] text-white text-[13px] rounded-xl active:scale-95 transition-transform"
          >
            Explorer les messages
          </button>
        </div>
      )}

      {/* Audio downloads */}
      {audioDownloads.length > 0 && (
        <div className="px-4 mb-4">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider px-1 mb-2">
            Audio ({audioDownloads.length})
          </p>
          <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
            {audioDownloads.map(renderDownloadItem)}
          </div>
        </div>
      )}

      {/* Video downloads */}
      {videoDownloads.length > 0 && (
        <div className="px-4 mb-4">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider px-1 mb-2">
            Video ({videoDownloads.length})
          </p>
          <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
            {videoDownloads.map(renderDownloadItem)}
          </div>
        </div>
      )}

      {textDownloads.length > 0 && (
        <div className="px-4 mb-4">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider px-1 mb-2">Textes ({textDownloads.length})</p>
          <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm">{textDownloads.map(renderDownloadItem)}</div>
        </div>
      )}

      {/* Clear all */}
      {downloads.length > 0 && (
        <div className="px-4 mt-2">
          {showConfirmClear ? (
            <div className="bg-[#9b1b30]/5 border border-[#9b1b30]/20 rounded-xl p-4">
              <p className="text-[13px] text-foreground mb-3">
                Etes-vous sur de vouloir supprimer tous les telechargements ?
                Cette action est irreversible.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handleClearAll}
                  disabled={clearing}
                  className="flex-1 py-2.5 bg-[#9b1b30] text-white rounded-xl text-[13px] flex items-center justify-center gap-2"
                >
                  {clearing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                  Tout supprimer
                </button>
                <button
                  onClick={() => setShowConfirmClear(false)}
                  className="flex-1 py-2.5 bg-muted text-foreground rounded-xl text-[13px]"
                >
                  Annuler
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowConfirmClear(true)}
              className="w-full flex items-center justify-center gap-2 py-3 bg-[#9b1b30]/10 text-[#9b1b30] rounded-xl border border-[#9b1b30]/20 active:bg-[#9b1b30]/20 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              <span className="text-[13px]">
                Tout supprimer ({formatFileSize(totalDownloadSize)})
              </span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
