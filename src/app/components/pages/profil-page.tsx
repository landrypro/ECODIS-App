import {
  User,
  Heart,
  Download,
  Settings,
  HelpCircle,
  LogOut,
  ChevronRight,
  Bell,
  Shield,
} from "lucide-react";

const menuItems = [
  { icon: Heart, label: "Mes favoris", count: 12 },
  { icon: Download, label: "Téléchargements", count: 8 },
  { icon: Bell, label: "Notifications" },
  { icon: Shield, label: "Confidentialité" },
  { icon: Settings, label: "Paramètres" },
  { icon: HelpCircle, label: "Aide & Support" },
];

export function ProfilPage() {
  return (
    <div className="pb-20">
      {/* Profile Header */}
      <div className="bg-[#152a6b] px-4 pt-6 pb-10">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-white/20 border-2 border-[#9b1b30] flex items-center justify-center">
            <User className="w-8 h-8 text-white" />
          </div>
          <div>
            <h2 className="text-white text-[16px]">Disciple</h2>
            <p className="text-white/60 text-[12px]">disciple@ecodis.org</p>
          </div>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="px-4 -mt-5 relative z-10 mb-4">
        <div className="bg-card rounded-xl border border-border shadow-sm grid grid-cols-3 divide-x divide-border">
          {[
            { label: "Audio écoutés", value: "24" },
            { label: "Vidéos vues", value: "15" },
            { label: "Textes lus", value: "38" },
          ].map((stat) => (
            <div key={stat.label} className="text-center py-3">
              <p className="text-[18px] text-primary">{stat.value}</p>
              <p className="text-[10px] text-muted-foreground">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Menu */}
      <div className="px-4">
        <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
          {menuItems.map((item, i) => (
            <button
              key={item.label}
              className={`w-full flex items-center gap-3 px-4 py-3.5 text-left active:bg-muted transition-colors ${
                i !== menuItems.length - 1 ? "border-b border-border" : ""
              }`}
            >
              <item.icon className="w-5 h-5 text-primary" />
              <span className="flex-1 text-[13px] text-card-foreground">{item.label}</span>
              {item.count && (
                <span className="bg-primary/10 text-primary text-[11px] px-2 py-0.5 rounded-full">
                  {item.count}
                </span>
              )}
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </button>
          ))}
        </div>

        {/* Logout */}
        <button className="w-full mt-4 flex items-center justify-center gap-2 py-3 bg-[#9b1b30]/10 text-[#9b1b30] rounded-xl border border-[#9b1b30]/20 active:bg-[#9b1b30]/20 transition-colors">
          <LogOut className="w-4 h-4" />
          <span className="text-[13px]">Se déconnecter</span>
        </button>

        {/* App version */}
        <p className="text-center text-[11px] text-muted-foreground mt-6">
          ECODIS v1.0.0 - Ecole des Disciples
        </p>
      </div>
    </div>
  );
}