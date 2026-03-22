import { NavLink, useNavigate } from "react-router";
import { Home, Mic, Video, FileText, User, Download, Layers, Crown, BarChart3, Users, Plus, LayoutDashboard } from "lucide-react";
import { useAuth } from "./auth-context";
import logoImg from "@/assets/18be1bb9126bc20903a4f39ba3a8f5fa468b188c.png";

const mainNav = [
  { to: "/", icon: Home, label: "Accueil" },
  { to: "/audio", icon: Mic, label: "Audio" },
  { to: "/video", icon: Video, label: "Video" },
  { to: "/textes", icon: FileText, label: "Textes" },
  { to: "/series", icon: Layers, label: "Series" },
  { to: "/downloads", icon: Download, label: "Hors-ligne" },
];

const adminNav = [
  { to: "/admin/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/admin", icon: Plus, label: "Ajouter" },
  { to: "/admin/users", icon: Users, label: "Utilisateurs" },
  { to: "/admin/stats", icon: BarChart3, label: "Statistiques" },
];

export function SidebarNav() {
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();

  return (
    <aside className="hidden lg:flex fixed left-0 top-0 bottom-0 w-[240px] bg-white border-r border-border flex-col z-50">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-border">
        <button onClick={() => navigate("/")} className="flex items-center gap-3">
          <img
            src={logoImg}
            alt="ECODIS"
            className="h-10 w-auto object-contain rounded bg-white px-1"
          />
          <div>
            <h1 className="text-[15px] font-bold text-[#152a6b] leading-tight">
              ECO<span className="text-[#9b1b30]">DIS</span>
            </h1>
            <p className="text-[10px] text-muted-foreground -mt-0.5">
              Ecole des Disciples
            </p>
          </div>
        </button>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-3 mb-2">
          Navigation
        </p>
        {mainNav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] transition-all ${
                isActive
                  ? "bg-[#152a6b] text-white shadow-md shadow-[#152a6b]/20"
                  : "text-foreground hover:bg-muted"
              }`
            }
          >
            <item.icon className="w-[18px] h-[18px]" />
            {item.label}
          </NavLink>
        ))}

        {/* Admin section */}
        {isAdmin && (
          <>
            <div className="pt-4 pb-1">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-3 mb-2 flex items-center gap-1.5">
                <Crown className="w-3 h-3 text-amber-500" />
                Administration
              </p>
            </div>
            {adminNav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] transition-all ${
                    isActive
                      ? "bg-[#9b1b30] text-white shadow-md shadow-[#9b1b30]/20"
                      : "text-foreground hover:bg-muted"
                  }`
                }
              >
                <item.icon className="w-[18px] h-[18px]" />
                {item.label}
              </NavLink>
            ))}
          </>
        )}
      </nav>

      {/* User section */}
      <div className="px-3 py-4 border-t border-border">
        {user ? (
          <NavLink
            to="/profil"
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] transition-all ${
                isActive
                  ? "bg-[#152a6b] text-white shadow-md"
                  : "text-foreground hover:bg-muted"
              }`
            }
          >
            <div className="w-8 h-8 rounded-full bg-[#152a6b]/10 flex items-center justify-center shrink-0">
              <User className="w-4 h-4 text-[#152a6b]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-medium truncate">
                {user.user_metadata?.name || user.email?.split("@")[0]}
              </p>
              <p className="text-[10px] opacity-60 truncate">{user.email}</p>
            </div>
          </NavLink>
        ) : (
          <button
            onClick={() => navigate("/login")}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 bg-[#152a6b] text-white rounded-xl text-[13px]"
          >
            <User className="w-4 h-4" />
            Se connecter
          </button>
        )}
        <p className="text-center text-[10px] text-muted-foreground mt-3">
          ECODIS v3.0.0
        </p>
      </div>
    </aside>
  );
}