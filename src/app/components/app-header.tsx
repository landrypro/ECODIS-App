import { useNavigate } from "react-router";
import { useAuth } from "./auth-context";
import { User, LogIn, Crown } from "lucide-react";
import logoImg from "@/assets/18be1bb9126bc20903a4f39ba3a8f5fa468b188c.png";

export function AppHeader({ title }: { title?: string }) {
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();

  return (
    <header className="lg:hidden sticky top-0 bg-[#152a6b] text-white z-40">
      <div className="max-w-lg mx-auto flex items-center gap-3 px-4 h-14 pt-[env(safe-area-inset-top)]">
        <img
          src={logoImg}
          alt="ECODIS Logo"
          className="h-9 w-auto object-contain rounded bg-white/90 px-1 cursor-pointer active:scale-95 transition-transform"
          onClick={() => navigate("/")}
        />
        <div className="flex-1">
          {title ? (
            <h1 className="text-[15px] text-white tracking-wide font-medium">{title}</h1>
          ) : (
            <>
              <h1 className="text-[15px] text-white tracking-wide font-bold">
                ECO<span className="text-[#9b1b30]">DIS</span>
              </h1>
              <p className="text-[10px] text-white/70 -mt-0.5">
                Ecole des Disciples
              </p>
            </>
          )}
        </div>
        {user ? (
          <div className="flex items-center gap-2">
            {isAdmin && (
              <span className="flex items-center gap-1 px-2 py-1 bg-amber-400/20 rounded-full text-[10px] text-amber-300 border border-amber-400/30">
                <Crown className="w-3 h-3" />
                Admin
              </span>
            )}
            <button
              onClick={() => navigate("/profil")}
              className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center active:scale-90 transition-transform"
            >
              <User className="w-4 h-4 text-white" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => navigate("/login")}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white/20 rounded-full text-xs active:scale-95 transition-transform"
          >
            <LogIn className="w-3.5 h-3.5" />
            Connexion
          </button>
        )}
      </div>
    </header>
  );
}
