import { Play, Pause, Clock, Heart, Share2, MoreVertical } from "lucide-react";
import { useState } from "react";
import { ImageWithFallback } from "./figma/ImageWithFallback";

interface MessageCardProps {
  type: "audio" | "video" | "text";
  title: string;
  author: string;
  date: string;
  duration?: string;
  description?: string;
  thumbnail?: string;
  liked?: boolean;
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
}: MessageCardProps) {
  const [isLiked, setIsLiked] = useState(liked);
  const [isPlaying, setIsPlaying] = useState(false);

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
      {type === "video" && thumbnail && (
        <div className="relative aspect-video bg-muted">
          <ImageWithFallback
            src={thumbnail}
            alt={title}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
            <button
              onClick={() => setIsPlaying(!isPlaying)}
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
        </div>
      )}

      {type === "audio" && (
        <div className="px-4 pt-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsPlaying(!isPlaying)}
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
        </div>

        {type === "text" && description && (
          <p className="mt-2 text-[13px] text-muted-foreground line-clamp-3">
            {description}
          </p>
        )}

        <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
          <button
            onClick={() => setIsLiked(!isLiked)}
            className="flex items-center gap-1.5 text-muted-foreground hover:text-red-500 transition-colors"
          >
            <Heart
              className={`w-4 h-4 ${isLiked ? "fill-red-500 text-red-500" : ""}`}
            />
            <span className="text-[11px]">J'aime</span>
          </button>
          <button className="flex items-center gap-1.5 text-muted-foreground hover:text-primary transition-colors">
            <Share2 className="w-4 h-4" />
            <span className="text-[11px]">Partager</span>
          </button>
          <button className="text-muted-foreground hover:text-primary transition-colors">
            <MoreVertical className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
