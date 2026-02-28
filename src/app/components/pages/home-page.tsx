import { useNavigate } from "react-router";
import { Mic, Video, FileText, ChevronRight, TrendingUp, BookOpen } from "lucide-react";
import { ImageWithFallback } from "../figma/ImageWithFallback";
import logoImg from "figma:asset/18be1bb9126bc20903a4f39ba3a8f5fa468b188c.png";

const recentItems = [
  {
    id: 1,
    type: "audio" as const,
    title: "La puissance de la prière",
    author: "Pasteur Jean",
    date: "27 Fév 2026",
  },
  {
    id: 2,
    type: "video" as const,
    title: "Marcher dans la foi au quotidien",
    author: "Pasteur Marie",
    date: "26 Fév 2026",
  },
  {
    id: 3,
    type: "text" as const,
    title: "Les fondements du discipulat",
    author: "Frère Paul",
    date: "25 Fév 2026",
  },
];

const stats = [
  { label: "Messages Audio", count: 48, icon: Mic, color: "bg-[#152a6b]/10 text-[#152a6b]" },
  { label: "Messages Vidéo", count: 23, icon: Video, color: "bg-[#9b1b30]/10 text-[#9b1b30]" },
  { label: "Messages Texte", count: 65, icon: FileText, color: "bg-[#4a6fa5]/10 text-[#4a6fa5]" },
];

export function HomePage() {
  const navigate = useNavigate();

  return (
    <div className="pb-20">
      {/* Hero Banner */}
      <div className="relative h-52 bg-[#152a6b] overflow-hidden">
        <ImageWithFallback
          src="https://images.unsplash.com/photo-1660176982561-0d9e8705877d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjaHVyY2glMjBiaWJsZSUyMHN0dWR5JTIwZ3JvdXB8ZW58MXx8fHwxNzcyMzA4MzQxfDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral"
          alt="Bible study"
          className="w-full h-full object-cover opacity-30"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#152a6b] to-[#152a6b]/40" />
        <div className="absolute top-3 right-4">
          <img src={logoImg} alt="ECODIS" className="h-12 w-auto object-contain rounded bg-white/90 p-1" />
        </div>
        <div className="absolute bottom-0 left-0 right-0 p-5">
          <div className="flex items-center gap-2 mb-1">
            <BookOpen className="w-4 h-4 text-[#9b1b30]" />
            <span className="text-[11px] text-[#e8a0a0] uppercase tracking-wider">
              Message du jour
            </span>
          </div>
          <h2 className="text-white text-[16px]">
            "Car je connais les projets que j'ai formés sur vous"
          </h2>
          <p className="text-white/60 text-[12px] mt-1">Jérémie 29:11</p>
        </div>
      </div>

      {/* Stats */}
      <div className="px-4 -mt-4 relative z-10">
        <div className="grid grid-cols-3 gap-2">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="bg-card rounded-xl p-3 shadow-sm border border-border text-center"
            >
              <div className={`w-8 h-8 rounded-full ${stat.color} flex items-center justify-center mx-auto`}>
                <stat.icon className="w-4 h-4" />
              </div>
              <p className="text-[18px] text-card-foreground mt-1">{stat.count}</p>
              <p className="text-[10px] text-muted-foreground">{stat.label.split(" ")[1]}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Access */}
      <div className="px-4 mt-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[15px] text-foreground">Accès rapide</h3>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Audio", icon: Mic, path: "/audio", gradient: "from-[#152a6b] to-[#1e3a8a]" },
            { label: "Vidéo", icon: Video, path: "/video", gradient: "from-[#9b1b30] to-[#b91c3a]" },
            { label: "Textes", icon: FileText, path: "/textes", gradient: "from-[#4a6fa5] to-[#5b82b8]" },
          ].map((item) => (
            <button
              key={item.label}
              onClick={() => navigate(item.path)}
              className={`bg-gradient-to-br ${item.gradient} rounded-xl p-4 text-white flex flex-col items-center gap-2 shadow-md active:scale-95 transition-transform`}
            >
              <item.icon className="w-6 h-6" />
              <span className="text-[12px]">{item.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Recent */}
      <div className="px-4 mt-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[15px] text-foreground flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            Récents
          </h3>
          <span className="text-[12px] text-primary">Voir tout</span>
        </div>
        <div className="space-y-3">
          {recentItems.map((item) => (
            <button
              key={item.id}
              onClick={() => navigate(`/${item.type === "text" ? "textes" : item.type}`)}
              className="w-full bg-card rounded-xl p-3 border border-border flex items-center gap-3 shadow-sm active:bg-muted transition-colors text-left"
            >
              <div
                className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
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
                <p className="text-[13px] text-card-foreground truncate">{item.title}</p>
                <p className="text-[11px] text-muted-foreground">
                  {item.author} · {item.date}
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}