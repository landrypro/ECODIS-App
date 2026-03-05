import { NavLink, useLocation } from "react-router";
import { Home, Mic, Video, FileText, User } from "lucide-react";

const navItems = [
  { to: "/", icon: Home, label: "Accueil" },
  { to: "/audio", icon: Mic, label: "Audio" },
  { to: "/video", icon: Video, label: "Video" },
  { to: "/textes", icon: FileText, label: "Textes" },
  { to: "/profil", icon: User, label: "Profil" },
];

export function BottomNav() {
  const location = useLocation();

  // Find active index for indicator position
  const activeIndex = navItems.findIndex((item) =>
    item.to === "/" ? location.pathname === "/" : location.pathname.startsWith(item.to)
  );

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-lg border-t border-[#152a6b]/8 z-50 shadow-[0_-4px_20px_rgba(21,42,107,0.06)]">
      <div className="max-w-lg mx-auto relative">
        {/* Animated active indicator */}
        {activeIndex >= 0 && (
          <div
            className="absolute top-0 h-[2.5px] bg-[#152a6b] rounded-full transition-all duration-300 ease-out"
            style={{
              width: `${100 / navItems.length}%`,
              left: `${(activeIndex * 100) / navItems.length}%`,
            }}
          />
        )}

        <div className="flex justify-around items-center h-16 pb-[env(safe-area-inset-bottom)]">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all duration-200 ${
                  isActive
                    ? "text-[#152a6b]"
                    : "text-[#6b7194] active:scale-90"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <div
                    className={`transition-transform duration-200 ${
                      isActive ? "scale-110" : ""
                    }`}
                  >
                    <item.icon
                      className={`w-5 h-5 transition-all ${
                        isActive ? "stroke-[2.5]" : "stroke-[1.8]"
                      }`}
                    />
                  </div>
                  <span
                    className={`text-[10px] transition-all ${
                      isActive ? "font-semibold text-[#152a6b]" : "font-normal"
                    }`}
                  >
                    {item.label}
                  </span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </div>
    </nav>
  );
}
