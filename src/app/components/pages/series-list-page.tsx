import { useMemo } from "react";
import { useNavigate } from "react-router";
import { BookOpen, User, Layers, Trophy, Sparkles, Loader2 } from "lucide-react";
import { ImageWithFallback } from "../figma/ImageWithFallback";
import { useAuth } from "../auth-context";
import { useAllSeries, useAllSeriesProgress } from "../../hooks/use-series-data";
import type { Series, SeriesProgress } from "../api";

export function SeriesListPage() {
  const navigate = useNavigate();
  const { accessToken, user } = useAuth();
  const { data: series = [], isLoading: seriesLoading } = useAllSeries();
  const { data: progress = {}, isLoading: progressLoading } = useAllSeriesProgress(accessToken, user?.id);
  const loading = seriesLoading || progressLoading;

  const categorized = useMemo(
    () =>
      series.map((item) => {
        const entry = progress[item.id];
        const completed = entry?.completedMessageIds?.length || 0;
        const total = item.totalModules;
        const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
        return { ...item, completed, pct };
      }),
    [series, progress],
  );

  const inProgress = categorized.filter((item) => item.completed > 0 && item.pct < 100);
  const notStarted = categorized.filter((item) => item.completed === 0);
  const completedSeries = categorized.filter((item) => item.pct === 100);
  const recommended = notStarted[0] || inProgress[0] || null;

  if (loading) {
    return <div className="pb-20 flex justify-center py-16"><Loader2 className="w-7 h-7 text-primary animate-spin" /></div>;
  }

  return (
    <div className="pb-20 lg:pb-6">
      <div className="px-4 lg:px-6 pt-4 pb-2">
        <div className="flex items-center gap-2 mb-1"><Layers className="w-5 h-5 text-primary" /><h2 className="text-[16px] font-semibold text-foreground">Series & Programmes</h2></div>
        <p className="text-[12px] text-muted-foreground">Suivez des programmes d'etude structures pour approfondir votre foi</p>
      </div>

      {recommended && (
        <div className="px-4 mt-3">
          <div className="flex items-center gap-1.5 mb-2"><Sparkles className="w-4 h-4 text-amber-500" /><span className="text-[11px] font-semibold text-amber-600 uppercase tracking-wider">Recommande pour vous</span></div>
          <button onClick={() => navigate(`/series/${recommended.id}`)} className="w-full bg-gradient-to-br from-[#152a6b] to-[#1e3a8a] rounded-2xl overflow-hidden shadow-lg active:scale-[0.99] transition-transform text-left">
            <div className="relative h-36">
              {recommended.coverImage ? <ImageWithFallback src={recommended.coverImage} alt={recommended.title} className="w-full h-full object-cover opacity-40" /> : <div className="w-full h-full bg-[#152a6b]" />}
              <div className="absolute inset-0 bg-gradient-to-t from-[#152a6b] to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-4">
                <span className="inline-block text-[10px] px-2 py-0.5 bg-amber-400/20 text-amber-300 rounded-full mb-2 border border-amber-400/30">{recommended.category} · {recommended.totalModules} modules</span>
                <h3 className="text-white text-[15px] font-semibold leading-tight">{recommended.title}</h3>
                <p className="text-white/60 text-[11px] mt-1 flex items-center gap-1"><User className="w-3 h-3" />{recommended.author}</p>
              </div>
            </div>
          </button>
        </div>
      )}

      {inProgress.length > 0 && <Section title="En cours" icon={<BookOpen className="w-4 h-4 text-[#152a6b]" />} items={inProgress} onSelect={(id) => navigate(`/series/${id}`)} />}
      {notStarted.length > 0 && <Section title="A decouvrir" icon={<Layers className="w-4 h-4 text-[#4a6fa5]" />} items={notStarted} onSelect={(id) => navigate(`/series/${id}`)} />}
      {completedSeries.length > 0 && <Section title="Terminees" icon={<Trophy className="w-4 h-4 text-amber-500" />} items={completedSeries} onSelect={(id) => navigate(`/series/${id}`)} />}

      {series.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 px-6">
          <Layers className="w-12 h-12 text-muted-foreground/30 mb-3" />
          <p className="text-[14px] font-medium text-foreground">Aucune serie disponible</p>
          <p className="text-[12px] text-muted-foreground text-center mt-1">Les series seront bientot ajoutees par l'equipe</p>
        </div>
      )}
    </div>
  );
}

function Section({ title, icon, items, onSelect }: { title: string; icon: React.ReactNode; items: (Series & { completed: number; pct: number })[]; onSelect: (id: string) => void; }) {
  return (
    <div className="px-4 mt-5">
      <div className="flex items-center gap-1.5 mb-3">{icon}<h3 className="text-[13px] font-semibold text-foreground">{title}</h3><span className="text-[11px] text-muted-foreground ml-1">({items.length})</span></div>
      <div className="space-y-3">{items.map((series) => <SeriesCard key={series.id} series={series} onSelect={onSelect} />)}</div>
    </div>
  );
}

function SeriesCard({ series, onSelect }: { series: Series & { completed: number; pct: number }; onSelect: (id: string) => void; }) {
  return (
    <button onClick={() => onSelect(series.id)} className="w-full bg-card rounded-xl border border-border overflow-hidden shadow-sm flex active:bg-muted transition-colors text-left">
      <div className="w-24 h-24 shrink-0 bg-muted relative">
        {series.coverImage ? <ImageWithFallback src={series.coverImage} alt={series.title} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-[#152a6b]/10 flex items-center justify-center"><Layers className="w-6 h-6 text-[#152a6b]/30" /></div>}
        {series.pct === 100 && <div className="absolute inset-0 bg-emerald-500/20 flex items-center justify-center"><Trophy className="w-6 h-6 text-emerald-600" /></div>}
      </div>
      <div className="flex-1 p-3 min-w-0 flex flex-col justify-between">
        <div>
          <p className="text-[13px] font-semibold text-foreground line-clamp-1">{series.title}</p>
          <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">{series.description}</p>
        </div>
        <div className="mt-2">
          <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1"><span>{series.completed}/{series.totalModules} modules</span><span>{series.pct}%</span></div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden"><div className="h-full bg-[#152a6b] rounded-full" style={{ width: `${series.pct}%` }} /></div>
        </div>
      </div>
    </button>
  );
}
