import { useNavigate } from "react-router";
import { useMemo, useState } from "react";
import { Mic, Video, FileText, ChevronRight, BookOpen, Loader2, Search, Layers, Smartphone, Globe, Download, TrendingUp } from "lucide-react";
import { ImageWithFallback } from "../figma/ImageWithFallback";
import logoImg from "@/assets/18be1bb9126bc20903a4f39ba3a8f5fa468b188c.png";
import { SearchOverlay } from "../search-overlay";
import { usePlatform } from "../platform-utils";
import { useHomeData } from "../../hooks/use-home-data";

export function HomePage() {
  const navigate = useNavigate();
  const { platform, standalone, canInstall, installApp } = usePlatform();
  const [showSearch, setShowSearch] = useState(false);
  const { data, isLoading } = useHomeData();

  const messages = data?.messages ?? [];
  const series = data?.series ?? [];
  const audioCount = messages.filter((message) => message.type === "audio").length;
  const videoCount = messages.filter((message) => message.type === "video").length;
  const textCount = messages.filter((message) => message.type === "text").length;
  const recentItems = messages.slice(0, 4);

  const stats = useMemo(
    () => [
      { label: "Audio", count: audioCount, icon: Mic, color: "bg-[#152a6b]/10 text-[#152a6b]", gradient: "from-[#152a6b]/5 to-[#152a6b]/0" },
      { label: "Video", count: videoCount, icon: Video, color: "bg-[#9b1b30]/10 text-[#9b1b30]", gradient: "from-[#9b1b30]/5 to-[#9b1b30]/0" },
      { label: "Textes", count: textCount, icon: FileText, color: "bg-[#4a6fa5]/10 text-[#4a6fa5]", gradient: "from-[#4a6fa5]/5 to-[#4a6fa5]/0" },
    ],
    [audioCount, videoCount, textCount],
  );

  return (
    <div className="pb-20 lg:pb-6">
      <div className="relative h-56 lg:h-64 bg-[#152a6b] overflow-hidden">
        <ImageWithFallback
          src="https://images.unsplash.com/photo-1505427214476-47e71e07abfe?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjaHJpc3RpYW4lMjB3b3JzaGlwJTIwY2h1cmNoJTIwY29uZ3JlZ2F0aW9ufGVufDF8fHx8MTc3MjU5Mzg1NXww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral"
          alt="Worship"
          className="w-full h-full object-cover opacity-25"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0d1a42] via-[#152a6b]/60 to-[#152a6b]/30" />
        <div className="absolute top-4 right-5 lg:hidden">
          <img src={logoImg} alt="ECODIS" className="h-12 w-auto object-contain rounded-lg bg-white/90 p-1 shadow-lg" />
        </div>
        <div className="absolute top-4 left-5">
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-white/15 backdrop-blur-sm rounded-full border border-white/10">
            {platform === "ios" || platform === "android" ? <Smartphone className="w-3 h-3 text-white/80" /> : <Globe className="w-3 h-3 text-white/80" />}
            <span className="text-[10px] text-white/80 font-medium">{standalone ? "App" : platform === "ios" ? "iOS" : platform === "android" ? "Android" : "Web"}</span>
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 p-5 lg:p-7">
          <div className="flex items-center gap-2 mb-1.5">
            <BookOpen className="w-4 h-4 text-[#e8a0a0]" />
            <span className="text-[11px] text-[#e8a0a0] uppercase tracking-[0.15em] font-medium">Message du jour</span>
          </div>
          <h2 className="text-white text-[17px] lg:text-[20px] font-semibold leading-snug">"Car je connais les projets que j'ai formes sur vous"</h2>
          <p className="text-white/50 text-[12px] mt-1.5 font-medium">Jeremie 29:11</p>
        </div>
      </div>

      <div className="px-4 lg:px-6 -mt-5 relative z-20 mb-2">
        <button onClick={() => setShowSearch(true)} className="w-full flex items-center gap-3 px-4 py-3.5 bg-white rounded-2xl shadow-lg shadow-[#152a6b]/8 border border-border text-left active:scale-[0.99] transition-transform">
          <Search className="w-4.5 h-4.5 text-muted-foreground" />
          <span className="flex-1 text-[13px] text-muted-foreground/60">Rechercher un message, auteur...</span>
          <span className="text-[9px] text-muted-foreground/40 bg-muted px-2 py-0.5 rounded-full font-mono font-medium">{messages.length}</span>
        </button>
      </div>

      <div className="px-4 lg:px-6 mt-2 relative z-10">
        <div className="grid grid-cols-3 gap-2.5">
          {stats.map((stat) => (
            <div key={stat.label} className={`bg-card rounded-2xl p-3.5 shadow-sm border border-border text-center bg-gradient-to-b ${stat.gradient}`}>
              <div className={`w-9 h-9 rounded-xl ${stat.color} flex items-center justify-center mx-auto`}>
                <stat.icon className="w-4.5 h-4.5" />
              </div>
              <p className="text-[20px] font-bold text-card-foreground mt-1.5 tracking-tight">{isLoading ? "-" : stat.count}</p>
              <p className="text-[10px] text-muted-foreground font-medium">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="px-4 lg:px-6 mt-7">
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Audio", icon: Mic, path: "/audio", gradient: "from-[#152a6b] to-[#1e3a8a]", shadow: "shadow-[#152a6b]/25" },
            { label: "Video", icon: Video, path: "/video", gradient: "from-[#9b1b30] to-[#b91c3a]", shadow: "shadow-[#9b1b30]/25" },
            { label: "Textes", icon: FileText, path: "/textes", gradient: "from-[#4a6fa5] to-[#5b82b8]", shadow: "shadow-[#4a6fa5]/25" },
          ].map((item) => (
            <button key={item.label} onClick={() => navigate(item.path)} className={`bg-gradient-to-br ${item.gradient} rounded-2xl p-4 text-white flex flex-col items-center gap-2.5 shadow-lg ${item.shadow} active:scale-95 transition-transform`}>
              <item.icon className="w-6 h-6" />
              <span className="text-[12px] font-semibold">{item.label}</span>
            </button>
          ))}
        </div>
      </div>

      {canInstall && !standalone && (
        <div className="px-4 lg:px-6 mt-6">
          <button onClick={installApp} className="w-full flex items-center gap-3 p-4 bg-gradient-to-r from-[#152a6b]/5 to-[#9b1b30]/5 rounded-2xl border border-[#152a6b]/10 active:scale-[0.99] transition-transform">
            <div className="w-10 h-10 rounded-xl bg-[#152a6b]/10 flex items-center justify-center shrink-0"><Download className="w-5 h-5 text-[#152a6b]" /></div>
            <div className="flex-1 text-left">
              <p className="text-[13px] font-semibold text-foreground">Installer l'application</p>
              <p className="text-[11px] text-muted-foreground">Acces rapide depuis votre ecran d'accueil</p>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
      )}

      {!isLoading && series.length > 0 && (
        <div className="px-4 lg:px-6 mt-7">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[15px] font-semibold text-foreground flex items-center gap-2"><Layers className="w-4 h-4 text-primary" />Series & programmes</h3>
            <button onClick={() => navigate("/series")} className="text-[12px] text-primary flex items-center gap-1">Voir tout <ChevronRight className="w-4 h-4" /></button>
          </div>
          <div className="space-y-3">
            {series.slice(0, 3).map((item) => (
              <button key={item.id} onClick={() => navigate(`/series/${item.id}`)} className="w-full bg-card rounded-2xl border border-border overflow-hidden shadow-sm flex text-left">
                <div className="w-24 h-24 bg-muted shrink-0">
                  {item.coverImage ? <ImageWithFallback src={item.coverImage} alt={item.title} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-[#152a6b]/10 flex items-center justify-center"><Layers className="w-6 h-6 text-[#152a6b]/30" /></div>}
                </div>
                <div className="flex-1 p-3 min-w-0">
                  <span className="inline-flex items-center gap-1 text-[10px] rounded-full bg-primary/10 text-primary px-2 py-0.5"><TrendingUp className="w-3 h-3" />{item.category}</span>
                  <p className="text-[13px] font-semibold text-foreground mt-1 line-clamp-1">{item.title}</p>
                  <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">{item.description}</p>
                  <p className="text-[10px] text-muted-foreground mt-2">{item.totalModules} modules · {item.author}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="px-4 lg:px-6 mt-7">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[15px] font-semibold text-foreground">Recents</h3>
        </div>
        {isLoading ? (
          <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
        ) : (
          <div className="space-y-3">
            {recentItems.map((item) => (
              <button key={item.id} onClick={() => navigate(`/message/${item.id}`)} className="w-full bg-card rounded-2xl border border-border p-4 text-left shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-foreground line-clamp-1">{item.title}</p>
                    <p className="text-[11px] text-muted-foreground mt-1">{item.author} · {item.category}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <SearchOverlay open={showSearch} onOpenChange={setShowSearch} messages={messages} />
    </div>
  );
}
