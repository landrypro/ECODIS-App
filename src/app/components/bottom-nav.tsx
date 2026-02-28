import { NavLink } from "react-router";
import { Home, Mic, Video, FileText, User } from "lucide-react";

const navItems = [
  { to: "/", icon: Home, label: "Accueil" },
  { to: "/audio", icon: Mic, label: "Audio" },
  { to: "/video", icon: Video, label: "Vidéo" },
  { to: "/textes", icon: FileText, label: "Textes" },
  { to: "/profil", icon: User, label: "Profil" },
];

export function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#152a6b]/10 z-50 safe-area-bottom shadow-[0_-2px_10px_rgba(21,42,107,0.06)]">
      <div className="max-w-lg mx-auto flex justify-around items-center h-16">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg transition-colors ${
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-primary/70"
              }`
            }
          >
            {({ isActive }) => (
              <>
                <item.icon className={`w-5 h-5 ${isActive ? "stroke-[2.5]" : ""}`} />
                <span className={`text-[10px] ${isActive ? "text-primary" : ""}`}>
                  {item.label}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}