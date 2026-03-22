import { Play, Pause, Clock, Heart, Share2, MoreVertical, MessageCircle, WifiOff } from "lucide-react";
import { useState } from "react";
import { ImageWithFallback } from "./figma/ImageWithFallback";
import { useAuth } from "./auth-context";
import { useDownloads } from "./download-context";
import { toggleFavorite } from "./api";

interface MessageCardProps {
  type: "audio" | "video" | "text";
  title: string;
  author: string;
  date: string;
  duration?: string;
  description?: string;
  thumbnail?: string;
  liked?: boolean;
  messageId?: string;
  commentCount?: number;
}

export function MessageCard({
  type,
  title,
  author,
  date,
  duration,
  description,
  thumbnail,
  liked = false,
  messageId,
  commentCount = 0,
}: MessageCardProps) {
  const [isLiked, setIsLiked] = useState(liked);
  const [isPlaying, setIsPlaying] = useState(false);
  const { accessToken, setFavorites } = useAuth();
  const { isDownloaded } = useDownloads();

  const downloaded = messageId ? isDownloaded(messageId) : false;

  const handleLike = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!accessToken || !messageId) return;
    const result = await toggleFavorite(messageId, accessToken);
    setIsLiked(result);
    setFavorites((prev: string[]) =>
      result
        ? [...prev, messageId]
        : prev.filter((id: string) => id !== messageId)
    );
  };

  const handlePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsPlaying(!isPlaying);
  };

  const handleShare = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (navigator.share) {
      navigator.share({
        title,
        text: `${title} - ${author} | ECODIS`,
        url: window.location.href,
      });
    }
  };

  return (
    <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm hover:shadow-md transition-shadow">
      {type === "video" && thumbnail && (
        <div className="relative aspect-video bg-muted">
          <ImageWithFallback
            src={thumbnail}
            alt={title}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
            <button
              onClick={handlePlay}
              className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center shadow-lg"
            >
              {isPlaying ? (
                <Pause className="w-5 h-5 text-primary" />
              ) : (
                <Play className="w-5 h-5 text-primary ml-0.5" />
              )}
            </button>
          </div>
          {duration && (
            <span className="absolute bottom-2 right-2 bg-black/70 text-white text-[11px] px-2 py-0.5 rounded">
              {duration}
            </span>
          )}
          {downloaded && (
            <span className="absolute top-2 left-2 flex items-center gap-1 bg-emerald-500/90 text-white text-[10px] px-2 py-0.5 rounded-full">
              <WifiOff className="w-2.5 h-2.5" />
              Hors-ligne
            </span>
          )}
        </div>
      )}

      {type === "audio" && (
        <div className="px-4 pt-4">
          <div className="flex items-center gap-3">
            <button
              onClick={handlePlay}
              className="w-10 h-10 rounded-full bg-primary flex items-center justify-center shrink-0"
            >
              {isPlaying ? (
                <Pause className="w-4 h-4 text-white" />
              ) : (
                <Play className="w-4 h-4 text-white ml-0.5" />
              )}
            </button>
            <div className="flex-1">
              <div className="h-1 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all"
                  style={{ width: isPlaying ? "45%" : "0%" }}
                />
              </div>
              {duration && (
                <div className="flex justify-between mt-1">
                  <span className="text-[10px] text-muted-foreground">
                    {isPlaying ? "2:34" : "0:00"}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {duration}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="p-4">
        <h3 className="text-[14px] text-card-foreground line-clamp-2">
          {title}
        </h3>
        <div className="flex items-center gap-2 mt-1.5">
          <span className="text-[12px] text-primary">{author}</span>
          <span className="text-muted-foreground text-[10px]">-</span>
          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <Clock className="w-3 h-3" />
            {date}
          </span>
          {downloaded && (
            <span className="flex items-center gap-0.5 text-[10px] text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full">
              <WifiOff className="w-2.5 h-2.5" />
              Hors-ligne
            </span>
          )}
        </div>

        {type === "text" && description && (
          <p className="mt-2 text-[13px] text-muted-foreground line-clamp-3">
            {description}
          </p>
        )}

        <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
          <button
            onClick={handleLike}
            className="flex items-center gap-1.5 text-muted-foreground hover:text-red-500 transition-colors"
          >
            <Heart
              className={`w-4 h-4 ${
                isLiked ? "fill-red-500 text-red-500" : ""
              }`}
            />
            <span className="text-[11px]">
              {isLiked ? "Favori" : "J'aime"}
            </span>
          </button>
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <MessageCircle className="w-4 h-4" />
            <span className="text-[11px]">{commentCount}</span>
          </div>
          <button
            onClick={handleShare}
            className="flex items-center gap-1.5 text-muted-foreground hover:text-primary transition-colors"
          >
            <Share2 className="w-4 h-4" />
            <span className="text-[11px]">Partager</span>
          </button>
        </div>
      </div>
    </div>
  );
}