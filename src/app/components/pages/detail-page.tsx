import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router";
import {
  fetchMessage,
  toggleFavorite,
  Message,
  fetchMessageSeries,
  fetchSeries as fetchSeriesDetail,
  markSeriesProgress,
  Series,
} from "../api";
import { useAuth } from "../auth-context";
import { useDownloads } from "../download-context";
import {
  ArrowLeft,
  Play,
  Pause,
  Heart,
  Share2,
  Clock,
  User,
  Volume2,
  VolumeX,
  SkipBack,
  SkipForward,
  Maximize,
  Mic,
  Video,
  FileText,
  Loader2,
  Download,
  CheckCircle2,
  Trash2,
  WifiOff,
  Layers,
  ChevronLeft,
  ChevronRight,
  Circle,
} from "lucide-react";
import { ImageWithFallback } from "../figma/ImageWithFallback";
import { CommentsSection } from "../comments-section";
import { toast } from "sonner";

function formatTime(seconds: number): string {
  if (isNaN(seconds)) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function DetailPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const seriesIdParam = searchParams.get("series");
  const navigate = useNavigate();
  const { accessToken, favorites, setFavorites } = useAuth();
  const {
    isDownloaded,
    getOfflineUrl,
    downloadMessage,
    removeDownload,
    activeDownloads,
  } = useDownloads();

  const [message, setMessage] = useState<Message | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isLiked, setIsLiked] = useState(false);

  // Series context
  const [seriesContext, setSeriesContext] = useState<{
    series: Series;
    messages: Message[];
    currentIndex: number;
  } | null>(null);
  const [seriesLoading, setSeriesLoading] = useState(false);
  const [isModuleCompleted, setIsModuleCompleted] = useState(false);

  const audioRef = useRef<HTMLAudioElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setSeriesContext(null);
    fetchMessage(id).then((msg) => {
      setMessage(msg);
      setLoading(false);
    });
  }, [id]);

  // Load series context
  useEffect(() => {
    if (!id) return;
    setSeriesLoading(true);

    async function loadSeriesContext() {
      try {
        // If series param is given, use that; otherwise find it
        let targetSeriesId = seriesIdParam;

        if (!targetSeriesId) {
          const seriesList = await fetchMessageSeries(id!);
          if (seriesList.length > 0) {
            targetSeriesId = seriesList[0].id;
          }
        }

        if (targetSeriesId) {
          const data = await fetchSeriesDetail(targetSeriesId);
          if (data) {
            const idx = data.messages.findIndex((m) => m.id === id);
            if (idx >= 0) {
              setSeriesContext({
                series: data.series,
                messages: data.messages,
                currentIndex: idx,
              });
            }
          }
        }
      } catch (e) {
        console.error("Load series context error:", e);
      } finally {
        setSeriesLoading(false);
      }
    }

    loadSeriesContext();
  }, [id, seriesIdParam]);

  useEffect(() => {
    if (message) {
      setIsLiked(favorites.includes(message.id));
    }
  }, [message, favorites]);

  const mediaRef = message?.type === "video" ? videoRef : audioRef;

  // Determine best media URL: offline cached or original
  const offlineUrl = message ? getOfflineUrl(message.id) : null;
  const effectiveMediaUrl = offlineUrl || message?.mediaUrl || "";
  const hasMedia = !!effectiveMediaUrl;
  const downloaded = message ? isDownloaded(message.id) : false;
  const activeDownload = message
    ? activeDownloads.find((d) => d.messageId === message.id)
    : null;

  const handlePlayPause = () => {
    const el = mediaRef.current;
    if (!el) return;
    if (isPlaying) {
      el.pause();
    } else {
      el.play().catch(console.error);
    }
    setIsPlaying(!isPlaying);
  };

  const handleTimeUpdate = () => {
    const el = mediaRef.current;
    if (el) setCurrentTime(el.currentTime);
  };

  const handleLoadedMetadata = () => {
    const el = mediaRef.current;
    if (el) setDuration(el.duration);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const el = mediaRef.current;
    if (el) {
      el.currentTime = parseFloat(e.target.value);
      setCurrentTime(el.currentTime);
    }
  };

  const handleMute = () => {
    const el = mediaRef.current;
    if (el) {
      el.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const handleSkip = (seconds: number) => {
    const el = mediaRef.current;
    if (el) {
      el.currentTime = Math.max(
        0,
        Math.min(el.duration, el.currentTime + seconds)
      );
    }
  };

  const handleToggleFavorite = async () => {
    if (!accessToken || !message) return;
    const result = await toggleFavorite(message.id, accessToken);
    setIsLiked(result);
    setFavorites((prev: string[]) =>
      result
        ? [...prev, message.id]
        : prev.filter((fId: string) => fId !== message.id)
    );
  };

  const handleShare = async () => {
    if (!message) return;
    if (navigator.share) {
      await navigator.share({
        title: message.title,
        text: `${message.title} - ${message.author} | ECODIS`,
        url: window.location.href,
      });
    }
  };

  const handleDownload = async () => {
    if (!message) return;
    try {
      await downloadMessage(message);
      toast.success("Telecharge pour lecture hors-ligne !");
    } catch (e: any) {
      toast.error(e.message || "Erreur lors du telechargement");
    }
  };

  const handleRemoveDownload = async () => {
    if (!message) return;
    await removeDownload(message.id);
    toast.success("Telechargement supprime");
  };

  const handleMarkModuleComplete = async () => {
    if (!accessToken || !seriesContext || !message) return;
    const result = await markSeriesProgress(
      seriesContext.series.id,
      message.id,
      accessToken
    );
    if (result) {
      setIsModuleCompleted(true);
      const total = seriesContext.series.totalModules;
      if (result.completedMessageIds.length === total) {
        toast.success("Felicitations ! Serie terminee !");
      } else {
        toast.success("Module marque comme termine !");
      }
    }
  };

  // Series navigation
  const prevMessage =
    seriesContext && seriesContext.currentIndex > 0
      ? seriesContext.messages[seriesContext.currentIndex - 1]
      : null;
  const nextMessage =
    seriesContext &&
    seriesContext.currentIndex < seriesContext.messages.length - 1
      ? seriesContext.messages[seriesContext.currentIndex + 1]
      : null;

  const navigateInSeries = (msgId: string) => {
    navigate(`/message/${msgId}?series=${seriesContext?.series.id}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (!message) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 px-4">
        <p className="text-muted-foreground">Message introuvable</p>
        <button
          onClick={() => navigate(-1)}
          className="text-primary text-sm"
        >
          Retour
        </button>
      </div>
    );
  }

  const typeIcon =
    message.type === "audio" ? (
      <Mic className="w-4 h-4" />
    ) : message.type === "video" ? (
      <Video className="w-4 h-4" />
    ) : (
      <FileText className="w-4 h-4" />
    );

  const typeColor =
    message.type === "audio"
      ? "bg-[#152a6b]"
      : message.type === "video"
      ? "bg-[#9b1b30]"
      : "bg-[#4a6fa5]";

  const canDownload = message.type !== "text" && !!message.mediaUrl;

  return (
    <div className="min-h-screen bg-background max-w-lg mx-auto lg:max-w-3xl lg:ml-[240px]">
      {/* Header */}
      <div className="sticky top-0 bg-white z-40 border-b border-border">
        <div className="flex items-center gap-3 px-4 h-14">
          <button
            onClick={() => navigate(-1)}
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-muted transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          <div className="flex-1 min-w-0 flex items-center gap-2">
            <p className="text-sm font-medium text-foreground truncate">
              {message.title}
            </p>
            {downloaded && (
              <WifiOff className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            )}
          </div>
          <div
            className={`w-7 h-7 rounded-full ${typeColor} flex items-center justify-center text-white`}
          >
            {typeIcon}
          </div>
        </div>
      </div>

      {/* Series Banner */}
      {seriesContext && (
        <div
          className="bg-[#152a6b]/5 border-b border-[#152a6b]/10 px-4 py-2.5 cursor-pointer active:bg-[#152a6b]/10 transition-colors"
          onClick={() => navigate(`/series/${seriesContext.series.id}`)}
        >
          <div className="flex items-center gap-2">
            <Layers className="w-3.5 h-3.5 text-[#152a6b] shrink-0" />
            <span className="text-[11px] font-medium text-[#152a6b] truncate flex-1">
              {seriesContext.series.title}
            </span>
            <span className="text-[10px] text-[#152a6b]/60 shrink-0">
              Module {seriesContext.currentIndex + 1}/
              {seriesContext.messages.length}
            </span>
          </div>
          {/* Mini progress */}
          <div className="flex gap-0.5 mt-1.5">
            {seriesContext.messages.map((_, i) => (
              <div
                key={i}
                className={`h-1 flex-1 rounded-full ${
                  i < seriesContext.currentIndex
                    ? "bg-emerald-400"
                    : i === seriesContext.currentIndex
                    ? "bg-[#152a6b]"
                    : "bg-[#152a6b]/15"
                }`}
              />
            ))}
          </div>
        </div>
      )}

      {/* Video Player */}
      {message.type === "video" && (
        <div className="relative bg-black aspect-video">
          {hasMedia ? (
            <video
              ref={videoRef}
              src={effectiveMediaUrl}
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={handleLoadedMetadata}
              onEnded={() => setIsPlaying(false)}
              className="w-full h-full object-contain"
              playsInline
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-white/60">
              {message.thumbnail ? (
                <ImageWithFallback
                  src={message.thumbnail}
                  alt={message.title}
                  className="w-full h-full object-cover absolute inset-0"
                />
              ) : null}
              <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center">
                <Video className="w-12 h-12 mb-2 text-white/50" />
                <p className="text-xs text-white/50">
                  Aucun fichier video attache
                </p>
              </div>
            </div>
          )}
          {/* Video Controls Overlay */}
          {hasMedia && (
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
              <input
                type="range"
                min={0}
                max={duration || 0}
                value={currentTime}
                onChange={handleSeek}
                className="w-full h-1 appearance-none bg-white/30 rounded-full mb-2 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full"
              />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button onClick={handlePlayPause}>
                    {isPlaying ? (
                      <Pause className="w-6 h-6 text-white" />
                    ) : (
                      <Play className="w-6 h-6 text-white" />
                    )}
                  </button>
                  <span className="text-xs text-white/80">
                    {formatTime(currentTime)} / {formatTime(duration)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={handleMute}>
                    {isMuted ? (
                      <VolumeX className="w-5 h-5 text-white" />
                    ) : (
                      <Volume2 className="w-5 h-5 text-white" />
                    )}
                  </button>
                  <button
                    onClick={() => videoRef.current?.requestFullscreen()}
                  >
                    <Maximize className="w-5 h-5 text-white" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Audio Player */}
      {message.type === "audio" && (
        <div className="bg-gradient-to-br from-[#152a6b] to-[#1e3a8a] px-6 py-8">
          {hasMedia && (
            <audio
              ref={audioRef}
              src={effectiveMediaUrl}
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={handleLoadedMetadata}
              onEnded={() => setIsPlaying(false)}
            />
          )}
          {/* Disc animation */}
          <div className="w-32 h-32 mx-auto mb-6 rounded-full bg-white/10 border-4 border-white/20 flex items-center justify-center relative">
            <div
              className={`w-24 h-24 rounded-full bg-white/10 border-2 border-white/30 flex items-center justify-center ${
                isPlaying ? "animate-spin" : ""
              }`}
              style={{ animationDuration: "3s" }}
            >
              <Mic className="w-8 h-8 text-white/80" />
            </div>
            {/* Offline badge on disc */}
            {downloaded && (
              <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-emerald-500 border-2 border-[#152a6b] flex items-center justify-center">
                <WifiOff className="w-3.5 h-3.5 text-white" />
              </div>
            )}
          </div>

          {/* Progress */}
          <div className="mb-4">
            <input
              type="range"
              min={0}
              max={duration || 0}
              value={currentTime}
              onChange={handleSeek}
              disabled={!hasMedia}
              className="w-full h-1 appearance-none bg-white/20 rounded-full [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full"
            />
            <div className="flex justify-between mt-1">
              <span className="text-xs text-white/60">
                {formatTime(currentTime)}
              </span>
              <span className="text-xs text-white/60">
                {hasMedia ? formatTime(duration) : message.duration || "0:00"}
              </span>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center justify-center gap-6">
            <button
              onClick={() => handleSkip(-15)}
              disabled={!hasMedia}
              className="text-white/60 hover:text-white transition-colors disabled:opacity-30"
            >
              <SkipBack className="w-6 h-6" />
            </button>
            <button
              onClick={handlePlayPause}
              disabled={!hasMedia}
              className="w-16 h-16 rounded-full bg-white flex items-center justify-center shadow-lg active:scale-95 transition-transform disabled:opacity-50"
            >
              {isPlaying ? (
                <Pause className="w-7 h-7 text-[#152a6b]" />
              ) : (
                <Play className="w-7 h-7 text-[#152a6b] ml-1" />
              )}
            </button>
            <button
              onClick={() => handleSkip(15)}
              disabled={!hasMedia}
              className="text-white/60 hover:text-white transition-colors disabled:opacity-30"
            >
              <SkipForward className="w-6 h-6" />
            </button>
          </div>

          {/* Volume */}
          <div className="flex items-center justify-center gap-2 mt-4">
            <button onClick={handleMute} className="text-white/60">
              {isMuted ? (
                <VolumeX className="w-4 h-4" />
              ) : (
                <Volume2 className="w-4 h-4" />
              )}
            </button>
          </div>

          {!hasMedia && (
            <p className="text-center text-xs text-white/40 mt-3">
              Aucun fichier audio attache
            </p>
          )}
        </div>
      )}

      {/* Content */}
      <div className="px-4 py-5">
        {/* Title & Meta */}
        <h1 className="text-lg font-semibold text-foreground leading-tight">
          {message.title}
        </h1>
        <div className="flex items-center gap-3 mt-2">
          <div className="flex items-center gap-1.5">
            <User className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs text-primary font-medium">
              {message.author}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">
              {new Date(message.createdAt).toLocaleDateString("fr-FR", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </span>
          </div>
        </div>

        {/* Category badge */}
        <div className="mt-3">
          <span
            className={`inline-block text-xs px-3 py-1 rounded-full text-white ${typeColor}`}
          >
            {message.category}
          </span>
          {message.duration && message.type !== "text" && (
            <span className="inline-block text-xs px-3 py-1 rounded-full bg-muted text-muted-foreground ml-2">
              {message.duration}
            </span>
          )}
        </div>

        {/* Download Button for audio/video */}
        {canDownload && (
          <div className="mt-4">
            {downloaded ? (
              <div className="flex items-center gap-2">
                <div className="flex-1 flex items-center gap-2 px-4 py-2.5 bg-emerald-50 border border-emerald-200 rounded-xl">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="text-[12px] text-emerald-700 font-medium">
                    Disponible hors-ligne
                  </span>
                </div>
                <button
                  onClick={handleRemoveDownload}
                  className="w-10 h-10 rounded-xl border border-border flex items-center justify-center text-muted-foreground hover:text-[#9b1b30] hover:border-[#9b1b30]/30 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ) : activeDownload ? (
              <div className="px-4 py-3 bg-[#152a6b]/5 border border-[#152a6b]/20 rounded-xl">
                <div className="flex items-center gap-2 mb-2">
                  <Loader2 className="w-4 h-4 text-[#152a6b] animate-spin" />
                  <span className="text-[12px] text-[#152a6b] font-medium">
                    {activeDownload.status === "error"
                      ? "Erreur de telechargement"
                      : activeDownload.status === "done"
                      ? "Telecharge !"
                      : "Telechargement en cours..."}
                  </span>
                </div>
                {activeDownload.progress >= 0 && (
                  <div className="h-1.5 bg-[#152a6b]/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#152a6b] rounded-full transition-all duration-300"
                      style={{
                        width: `${activeDownload.progress}%`,
                      }}
                    />
                  </div>
                )}
                {activeDownload.progress < 0 && (
                  <div className="h-1.5 bg-[#152a6b]/10 rounded-full overflow-hidden">
                    <div className="h-full bg-[#152a6b] rounded-full w-1/3 animate-pulse" />
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={handleDownload}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#152a6b]/10 border border-[#152a6b]/20 rounded-xl text-[#152a6b] active:scale-[0.98] transition-transform"
              >
                <Download className="w-4 h-4" />
                <span className="text-[12px] font-medium">
                  Telecharger pour ecoute hors-ligne
                </span>
              </button>
            )}
          </div>
        )}

        {/* Mark as complete (series context) */}
        {seriesContext && accessToken && (
          <div className="mt-4">
            {isModuleCompleted ? (
              <div className="flex items-center gap-2 px-4 py-2.5 bg-emerald-50 border border-emerald-200 rounded-xl">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="text-[12px] text-emerald-700 font-medium">
                  Module termine
                </span>
              </div>
            ) : (
              <button
                onClick={handleMarkModuleComplete}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 active:scale-[0.98] transition-transform hover:bg-emerald-100"
              >
                <Circle className="w-4 h-4" />
                <span className="text-[12px] font-medium">
                  Marquer ce module comme termine
                </span>
              </button>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-4 mt-5 pt-4 border-t border-border">
          <button
            onClick={handleToggleFavorite}
            disabled={!accessToken}
            className="flex items-center gap-1.5 text-sm disabled:opacity-40"
          >
            <Heart
              className={`w-5 h-5 ${
                isLiked
                  ? "fill-red-500 text-red-500"
                  : "text-muted-foreground"
              }`}
            />
            <span
              className={
                isLiked ? "text-red-500" : "text-muted-foreground"
              }
            >
              {isLiked ? "Favori" : "J'aime"}
            </span>
          </button>
          <button
            onClick={handleShare}
            className="flex items-center gap-1.5 text-sm text-muted-foreground"
          >
            <Share2 className="w-5 h-5" />
            <span>Partager</span>
          </button>
        </div>

        {/* Description / Content */}
        {message.description && (
          <div className="mt-5 pt-4 border-t border-border">
            <h3 className="text-sm font-semibold text-foreground mb-2">
              {message.type === "text" ? "Contenu" : "Description"}
            </h3>
            <div className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
              {message.description}
            </div>
          </div>
        )}

        {/* Series Navigation: Prev / Next */}
        {seriesContext && (prevMessage || nextMessage) && (
          <div className="mt-5 pt-4 border-t border-border">
            <div className="flex items-center gap-2 mb-3">
              <Layers className="w-4 h-4 text-primary" />
              <span className="text-[13px] font-semibold text-foreground">
                Navigation dans la serie
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {prevMessage ? (
                <button
                  onClick={() => navigateInSeries(prevMessage.id)}
                  className="flex items-center gap-2 p-3 bg-card rounded-xl border border-border active:bg-muted transition-colors text-left"
                >
                  <ChevronLeft className="w-4 h-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[10px] text-muted-foreground">
                      Precedent
                    </p>
                    <p className="text-[11px] text-card-foreground truncate font-medium">
                      {prevMessage.title}
                    </p>
                  </div>
                </button>
              ) : (
                <div />
              )}
              {nextMessage ? (
                <button
                  onClick={() => navigateInSeries(nextMessage.id)}
                  className="flex items-center gap-2 p-3 bg-card rounded-xl border border-border active:bg-muted transition-colors text-right"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-muted-foreground">
                      Suivant
                    </p>
                    <p className="text-[11px] text-card-foreground truncate font-medium">
                      {nextMessage.title}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                </button>
              ) : (
                <div />
              )}
            </div>
          </div>
        )}

        {/* Comments Section */}
        <CommentsSection messageId={message.id} />
      </div>
    </div>
  );
}