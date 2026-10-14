import { useState, useEffect, createContext, useContext, ReactNode } from "react";

// ============ Platform Detection ============

export type Platform = "ios" | "android" | "web";

export function detectPlatform(): Platform {
  const ua = navigator.userAgent || "";
  if (/iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)) {
    return "ios";
  }
  if (/android/i.test(ua)) {
    return "android";
  }
  return "web";
}

export function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as any).standalone === true
  );
}

// ============ PWA Install Prompt ============

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

interface PlatformContextType {
  platform: Platform;
  standalone: boolean;
  canInstall: boolean;
  installApp: () => Promise<void>;
  dismissInstall: () => void;
  showInstallBanner: boolean;
}

const PlatformContext = createContext<PlatformContextType>({
  platform: "web",
  standalone: false,
  canInstall: false,
  installApp: async () => {},
  dismissInstall: () => {},
  showInstallBanner: false,
});

const INSTALL_DISMISSED_KEY = "ecodis-install-dismissed";

export function PlatformProvider({ children }: { children: ReactNode }) {
  const [platform] = useState<Platform>(() => detectPlatform());
  const [standalone] = useState(() => isStandalone());
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(INSTALL_DISMISSED_KEY) === "true";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const canInstall = !!deferredPrompt && !standalone;

  const installApp = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === "accepted") {
      setDeferredPrompt(null);
    }
  };

  const dismissInstall = () => {
    setDismissed(true);
    try {
      localStorage.setItem(INSTALL_DISMISSED_KEY, "true");
    } catch {
      // localStorage can be unavailable in restricted browser contexts.
    }
  };

  const showInstallBanner = canInstall && !dismissed;

  return (
    <PlatformContext.Provider
      value={{ platform, standalone, canInstall, installApp, dismissInstall, showInstallBanner }}
    >
      {children}
    </PlatformContext.Provider>
  );
}

export function usePlatform() {
  return useContext(PlatformContext);
}

// ============ Platform-specific style helpers ============

export function getPlatformLabel(platform: Platform): string {
  switch (platform) {
    case "ios": return "iOS";
    case "android": return "Android";
    default: return "Web";
  }
}

export function getPlatformIcon(platform: Platform): string {
  switch (platform) {
    case "ios": return "\uF8FF"; // Apple symbol
    case "android": return "\uD83E\uDD16"; // Robot
    default: return "\uD83C\uDF10"; // Globe
  }
}
