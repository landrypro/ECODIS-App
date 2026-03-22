import { useParams, useNavigate } from "react-router";
import { ArrowLeft, Play, CheckCircle2, Mic, Video, FileText, User, Loader2, Layers, ChevronRight, Trophy } from "lucide-react";
import { ImageWithFallback } from "../figma/ImageWithFallback";
import { useAuth } from "../auth-context";
import { useMarkSeriesProgress, useSeriesDetail, useSeriesProgress } from "../../hooks/use-series-data";
import { toast } from "sonner";

export function SeriesDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { accessToken, user } = useAuth();
  const { data, isLoading } = useSeriesDetail(id);
  const { data: progress } = useSeriesProgress(id, accessToken, user?.id);
  const markProgress = useMarkSeriesProgress(accessToken, user?.id);

  const series = data?.series ?? null;
  const messages = data?.messages ?? [];
  const completedIds = progress?.completedMessageIds || [];
  const totalModules = series?.totalModules || 0;
  const completedCount = completedIds.length;
  const pct = totalModules > 0 ? Math.round((completedCount / totalModules) * 100) : 0;
  const isCompleted = pct === 100;
  const nextUncompletedIndex = messages.findIndex((message) => !completedIds.includes(message.id));
  const nextMessage = nextUncompletedIndex >= 0 ? messages[nextUncompletedIndex] : null;

  const handleMarkComplete = async (messageId: string) => {
    if (!accessToken || !series) {
      toast.error("Connectez-vous pour suivre votre progression");
      return;
    }
    const result = await markProgress.mutateAsync({ seriesId: series.id, messageId });
    if (result) {
      if (result.completedMessageIds.length === totalModules) {
        toast.success("Felicitations ! Vous avez termine cette serie !");
      } else {
        toast.success("Module marque comme termine !");
      }
    }
  };

  if (isLoading) {
    return <div className="min-h-screen bg-background max-w-lg mx-auto flex items-center justify-center"><Loader2 className="w-8 h-8 text-primary animate-spin" /></div>;
  }

  if (!series) {
    return <div className="min-h-screen bg-background max-w-lg mx-auto flex flex-col items-center justify-center gap-4 px-4"><p className="text-muted-foreground">Serie introuvable</p><button onClick={() => navigate(-1)} className="text-primary text-sm">Retour</button></div>;
  }

  const typeIcon = (type: string) => type === "audio" ? <Mic className="w-4 h-4" /> : type === "video" ? <Video className="w-4 h-4" /> : <FileText className="w-4 h-4" />;
  const typeStyle = (type: string) => type === "audio" ? "bg-[#152a6b]/10 text-[#152a6b]" : type === "video" ? "bg-[#9b1b30]/10 text-[#9b1b30]" : "bg-[#4a6fa5]/10 text-[#4a6fa5]";

  return (
    <div className="min-h-screen bg-background max-w-lg mx-auto">
      <div className="relative h-56 bg-[#152a6b]">
        {series.coverImage && <ImageWithFallback src={series.coverImage} alt={series.title} className="w-full h-full object-cover opacity-30" />}
        <div className="absolute inset-0 bg-gradient-to-t from-[#152a6b] via-[#152a6b]/60 to-transparent" />
        <div className="absolute top-0 left-0 right-0 flex items-center gap-3 px-4 h-14">
          <button onClick={() => navigate(-1)} className="w-8 h-8 rounded-full bg-black/20 flex items-center justify-center"><ArrowLeft className="w-5 h-5 text-white" /></button>
          <span className="flex-1" />
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-white/10 rounded-full"><Layers className="w-3.5 h-3.5 text-white/70" /><span className="text-[10px] text-white/70">Serie</span></div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 p-5">
          <span className="inline-block text-[10px] px-2 py-0.5 bg-white/10 text-white/80 rounded-full mb-2 border border-white/20">{series.category} · {totalModules} modules</span>
          <h1 className="text-white text-[18px] font-bold leading-tight">{series.title}</h1>
          <p className="text-white/60 text-[12px] mt-1 flex items-center gap-1"><User className="w-3 h-3" />{series.author}</p>
        </div>
      </div>

      <div className="px-4 -mt-3 relative z-10">
        <div className="bg-card rounded-xl border border-border shadow-sm p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[12px] font-medium text-foreground">Progression</span>
            {isCompleted ? <span className="flex items-center gap-1 text-[11px] text-emerald-600 font-medium"><Trophy className="w-3.5 h-3.5" />Terminee !</span> : <span className="text-[12px] font-semibold text-primary">{pct}%</span>}
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden"><div className={`h-full rounded-full transition-all duration-500 ${isCompleted ? "bg-emerald-500" : "bg-[#152a6b]"}`} style={{ width: `${pct}%` }} /></div>
          <p className="text-[11px] text-muted-foreground mt-1.5">{completedCount} sur {totalModules} module{totalModules > 1 ? "s" : ""} termine{completedCount > 1 ? "s" : ""}</p>
        </div>
      </div>

      {series.description && <div className="px-4 mt-4"><p className="text-[13px] text-muted-foreground leading-relaxed">{series.description}</p></div>}

      {nextMessage && (
        <div className="px-4 mt-4">
          <button onClick={() => navigate(`/message/${nextMessage.id}?series=${series.id}`)} className="w-full flex items-center gap-3 px-4 py-3.5 bg-[#152a6b] text-white rounded-xl shadow-md active:scale-[0.99] transition-transform">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center shrink-0"><Play className="w-5 h-5 text-white ml-0.5" /></div>
            <div className="flex-1 text-left min-w-0"><p className="text-[12px] text-white/60">{completedCount === 0 ? "Commencer" : "Continuer"}</p><p className="text-[13px] text-white font-medium truncate">Module {nextUncompletedIndex + 1} : {nextMessage.title}</p></div>
            <ChevronRight className="w-5 h-5 text-white/60 shrink-0" />
          </button>
        </div>
      )}

      <div className="px-4 mt-6 pb-8">
        <h3 className="text-[13px] font-semibold text-foreground mb-3">Modules ({totalModules})</h3>
        <div className="space-y-2">
          {messages.map((message, index) => {
            const done = completedIds.includes(message.id);
            return (
              <div key={message.id} className={`bg-card rounded-xl border overflow-hidden shadow-sm ${done ? "border-emerald-200 bg-emerald-50/50" : "border-border"}`}>
                <div className="flex items-center gap-3 p-3">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center ${done ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground"}`}>{done ? <CheckCircle2 className="w-4 h-4" /> : <span className="text-[11px] font-medium">{index + 1}</span>}</div>
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${typeStyle(message.type)}`}>{typeIcon(message.type)}</div>
                  <div className="flex-1 min-w-0"><p className="text-[13px] font-medium text-card-foreground line-clamp-1">{message.title}</p><p className="text-[10px] text-muted-foreground mt-0.5">{message.author}</p></div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => navigate(`/message/${message.id}?series=${series.id}`)} className="px-3 py-1.5 rounded-lg bg-muted text-[11px]">Ouvrir</button>
                    {!done && <button onClick={() => handleMarkComplete(message.id)} className="px-3 py-1.5 rounded-lg bg-[#152a6b] text-white text-[11px]" disabled={markProgress.isPending}>Terminer</button>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
