import { X, Download, Smartphone } from "lucide-react";
import { usePlatform } from "./platform-utils";

export function PwaInstallBanner() {
  const { showInstallBanner, installApp, dismissInstall, platform } = usePlatform();

  if (!showInstallBanner) return null;

  return (
    <div className="fixed bottom-20 lg:bottom-4 left-4 right-4 max-w-lg mx-auto z-[60] animate-in slide-in-from-bottom-4 fade-in duration-500">
      <div className="bg-gradient-to-r from-[#152a6b] to-[#1e3a8a] rounded-2xl p-4 shadow-2xl shadow-[#152a6b]/30 border border-white/10">
        <button
          onClick={dismissInstall}
          className="absolute top-3 right-3 w-6 h-6 rounded-full bg-white/20 flex items-center justify-center"
        >
          <X className="w-3.5 h-3.5 text-white" />
        </button>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
            <Smartphone className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1 min-w-0 pr-4">
            <p className="text-white text-[13px] font-semibold">
              Installer ECODIS
            </p>
            <p className="text-white/70 text-[11px] mt-0.5">
              {platform === "ios"
                ? "Ajoutez l'app a votre ecran d'accueil depuis Safari"
                : "Installez l'app pour un acces rapide et hors-ligne"}
            </p>
          </div>
        </div>
        {platform !== "ios" && (
          <button
            onClick={installApp}
            className="w-full mt-3 py-2.5 bg-white text-[#152a6b] rounded-xl text-[13px] font-semibold flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
          >
            <Download className="w-4 h-4" />
            Installer maintenant
          </button>
        )}
        {platform === "ios" && (
          <div className="mt-3 px-3 py-2.5 bg-white/10 rounded-xl">
            <p className="text-white/80 text-[11px] text-center">
              Appuyez sur{" "}
              <span className="inline-flex items-center px-1.5 py-0.5 bg-white/20 rounded text-[10px]">
                Partager
              </span>{" "}
              puis{" "}
              <span className="inline-flex items-center px-1.5 py-0.5 bg-white/20 rounded text-[10px]">
                Sur l'ecran d'accueil
              </span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
