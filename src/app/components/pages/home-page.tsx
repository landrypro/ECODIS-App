import { useNavigate } from "react-router";
import { useState, useEffect } from "react";
import {
  Mic,
  Video,
  FileText,
  ChevronRight,
  TrendingUp,
  BookOpen,
  Loader2,
  Search,
  Layers,
  Smartphone,
  Globe,
  Download,
} from "lucide-react";
import { ImageWithFallback } from "../figma/ImageWithFallback";
import logoImg from "/src/assets/logoECODIS.jpg";
import { fetchMessages, seedData, Message, fetchAllSeries, Series } from "../api";
import { SearchOverlay } from "../search-overlay";
import { usePlatform } from "../platform-utils";

export function HomePage() {
  const navigate = useNavigate();
  const { platform, standalone, canInstall, installApp } = usePlatform();
  const [messages, setMessages] = useState<Message[]>([]);
  const [series, setSeries] = useState<Series[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSearch, setShowSearch] = useState(false);

  useEffect(() => {
    async function init() {
      await seedData();
      const [all, allSeries] = await Promise.all([
        fetchMessages(),
        fetchAllSeries(),
      ]);
      setMessages(all);
      setSeries(allSeries);
      setLoading(false);
    }
    init();
  }, []);

  const audioCount = messages.filter((m) => m.type === "audio").length;
  const videoCount = messages.filter((m) => m.type === "video").length;
  const textCount = messages.filter((m) => m.type === "text").length;
  const recentItems = messages.slice(0, 4);

  const stats = [
    {
      label: "Audio",
      count: audioCount,
      icon: Mic,
      color: "bg-[#152a6b]/10 text-[#152a6b]",
      gradient: "from-[#152a6b]/5 to-[#152a6b]/0",
    },
    {
      label: "Video",
      count: videoCount,
      icon: Video,
      color: "bg-[#9b1b30]/10 text-[#9b1b30]",
      gradient: "from-[#9b1b30]/5 to-[#9b1b30]/0",
    },
    {
      label: "Textes",
      count: textCount,
      icon: FileText,
      color: "bg-[#4a6fa5]/10 text-[#4a6fa5]",
      gradient: "from-[#4a6fa5]/5 to-[#4a6fa5]/0",
    },
  ];

  return (
    <div className="pb-20 lg:pb-6">
      {/* Hero Banner */}
      <div className="relative h-56 lg:h-64 bg-[#152a6b] overflow-hidden">
        <ImageWithFallback
          src="https://images.unsplash.com/photo-1505427214476-47e71e07abfe?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjaHJpc3RpYW4lMjB3b3JzaGlwJTIwY2h1cmNoJTIwY29uZ3JlZ2F0aW9ufGVufDF8fHx8MTc3MjU5Mzg1NXww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral"
          alt="Worship"
          className="w-full h-full object-cover opacity-25"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0d1a42] via-[#152a6b]/60 to-[#152a6b]/30" />

        {/* Logo overlay - desktop */}
        <div className="absolute top-4 right-5 lg:hidden">
          <img
            src={logoImg}
            alt="ECODIS"
            className="h-12 w-auto object-contain rounded-lg bg-white/90 p-1 shadow-lg"
          />
        </div>

        {/* Platform indicator pill */}
        <div className="absolute top-4 left-5">
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-white/15 backdrop-blur-sm rounded-full border border-white/10">
            {platform === "ios" ? (
              <Smartphone className="w-3 h-3 text-white/80" />
            ) : platform === "android" ? (
              <Smartphone className="w-3 h-3 text-white/80" />
            ) : (
              <Globe className="w-3 h-3 text-white/80" />
            )}
            <span className="text-[10px] text-white/80 font-medium">
              {standalone ? "App" : platform === "ios" ? "iOS" : platform === "android" ? "Android" : "Web"}
            </span>
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-5 lg:p-7">
          <div className="flex items-center gap-2 mb-1.5">
            <BookOpen className="w-4 h-4 text-[#e8a0a0]" />
            <span className="text-[11px] text-[#e8a0a0] uppercase tracking-[0.15em] font-medium">
              Message du jour
            </span>
          </div>
          <h2 className="text-white text-[17px] lg:text-[20px] font-semibold leading-snug">
            "Car je connais les projets que j'ai formes sur vous"
          </h2>
          <p className="text-white/50 text-[12px] mt-1.5 font-medium">
            Jeremie 29:11
          </p>
        </div>
      </div>

      {/* Search Bar */}
      <div className="px-4 lg:px-6 -mt-5 relative z-20 mb-2">
        <button
          onClick={() => setShowSearch(true)}
          className="w-full flex items-center gap-3 px-4 py-3.5 bg-white rounded-2xl shadow-lg shadow-[#152a6b]/8 border border-border text-left active:scale-[0.99] transition-transform"
        >
          <Search className="w-4.5 h-4.5 text-muted-foreground" />
          <span className="flex-1 text-[13px] text-muted-foreground/60">
            Rechercher un message, auteur...
          </span>
          <div className="flex items-center gap-1">
            <span className="text-[9px] text-muted-foreground/40 bg-muted px-2 py-0.5 rounded-full font-mono font-medium">
              {messages.length}
            </span>
          </div>
        </button>
      </div>

      {/* Stats */}
      <div className="px-4 lg:px-6 mt-2 relative z-10">
        <div className="grid grid-cols-3 gap-2.5">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className={`bg-card rounded-2xl p-3.5 shadow-sm border border-border text-center bg-gradient-to-b ${stat.gradient}`}
            >
              <div
                className={`w-9 h-9 rounded-xl ${stat.color} flex items-center justify-center mx-auto`}
              >
                <stat.icon className="w-4.5 h-4.5" />
              </div>
              <p className="text-[20px] font-bold text-card-foreground mt-1.5 tracking-tight">
                {loading ? "-" : stat.count}
              </p>
              <p className="text-[10px] text-muted-foreground font-medium">
                {stat.label}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Access */}
      <div className="px-4 lg:px-6 mt-7">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[15px] font-semibold text-foreground">Acces rapide</h3>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[
            {
              label: "Audio",
              icon: Mic,
              path: "/audio",
              gradient: "from-[#152a6b] to-[#1e3a8a]",
              shadow: "shadow-[#152a6b]/25",
            },
            {
              label: "Video",
              icon: Video,
              path: "/video",
              gradient: "from-[#9b1b30] to-[#b91c3a]",
              shadow: "shadow-[#9b1b30]/25",
            },
            {
              label: "Textes",
              icon: FileText,
              path: "/textes",
              gradient: "from-[#4a6fa5] to-[#5b82b8]",
              shadow: "shadow-[#4a6fa5]/25",
            },
          ].map((item) => (
            <button
              key={item.label}
              onClick={() => navigate(item.path)}
              className={`bg-gradient-to-br ${item.gradient} rounded-2xl p-4 text-white flex flex-col items-center gap-2.5 shadow-lg ${item.shadow} active:scale-95 transition-transform`}
            >
              <item.icon className="w-6 h-6" />
              <span className="text-[12px] font-semibold">{item.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Install CTA (only if not standalone and can install) */}
      {canInstall && !standalone && (
        <div className="px-4 lg:px-6 mt-6">
          <button
            onClick={installApp}
            className="w-full flex items-center gap-3 p-4 bg-gradient-to-r from-[#152a6b]/5 to-[#9b1b30]/5 rounded-2xl border border-[#152a6b]/10 active:scale-[0.99] transition-transform"
          >
            <div className="w-10 h-10 rounded-xl bg-[#152a6b]/10 flex items-center justify-center shrink-0">
              <Download className="w-5 h-5 text-[#152a6b]" />
            </div>
            <div className="flex-1 text-left">
              <p className="text-[13px] font-semibold text-foreground">
                Installer l'application
              </p>
              <p className="text-[11px] text-muted-foreground">
                Acces rapide depuis votre ecran d'accueil
              </p>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
      )}

      {/* Series Preview */}
      {!loading && series.length > 0 && (
        <div className="px-4 lg:px-6 mt-7">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[15px] font-semibold text-foreground flex items-center gap-2">
              <Layers className="w-4 h-4 text-primary" />
              Series & Programmes
            </h3>
            <button
              onClick={() => navigate("/series")}
              className="text-[11px] text-primary font-semibold flex items-center gap-0.5"
            >
              Voir tout
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4 lg:-mx-6 lg:px-6">
            {series.slice(0, 4).map((s) => (
              <button
                key={s.id}
                onClick={() => navigate(`/series/${s.id}`)}
                className="shrink-0 w-48 bg-card rounded-2xl border border-border overflow-hidden shadow-sm active:scale-[0.98] transition-transform text-left"
              >
                <div className="h-24 bg-muted relative">
                  {s.coverImage ? (
                    <ImageWithFallback
                      src={s.coverImage}
                      alt={s.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-[#152a6b]/10 flex items-center justify-center">
                      <Layers className="w-6 h-6 text-[#152a6b]/30" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                  <span className="absolute bottom-1.5 left-2 text-[9px] px-2 py-0.5 bg-white/95 text-[#152a6b] rounded-full font-semibold shadow-sm">
                    {s.totalModules} modules
                  </span>
                </div>
                <div className="p-3">
                  <p className="text-[12px] font-semibold text-card-foreground line-clamp-1">
                    {s.title}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {s.author}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Recent */}
      <div className="px-4 lg:px-6 mt-7">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[15px] font-semibold text-foreground flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            Recents
          </h3>
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
          </div>
        ) : (
          <div className="space-y-2.5">
            {recentItems.map((item) => (
              <button
                key={item.id}
                onClick={() => navigate(`/message/${item.id}`)}
                className="w-full bg-card rounded-2xl p-3.5 border border-border flex items-center gap-3 shadow-sm active:scale-[0.99] transition-all text-left hover:shadow-md"
              >
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    item.type === "audio"
                      ? "bg-[#152a6b]/10 text-[#152a6b]"
                      : item.type === "video"
                      ? "bg-[#9b1b30]/10 text-[#9b1b30]"
                      : "bg-[#4a6fa5]/10 text-[#4a6fa5]"
                  }`}
                >
                  {item.type === "audio" && <Mic className="w-4 h-4" />}
                  {item.type === "video" && <Video className="w-4 h-4" />}
                  {item.type === "text" && <FileText className="w-4 h-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-card-foreground truncate">
                    {item.title}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {item.author} ·{" "}
                    {new Date(item.createdAt).toLocaleDateString("fr-FR", {
                      day: "numeric",
                      month: "short",
                    })}
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Search Overlay */}
      {showSearch && (
        <SearchOverlay
          messages={messages}
          onClose={() => setShowSearch(false)}
        />
      )}
    </div>
  );
}
