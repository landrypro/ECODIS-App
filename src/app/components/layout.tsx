import { Outlet, useLocation } from "react-router";
import { BottomNav } from "./bottom-nav";
import { AppHeader } from "./app-header";
import { SidebarNav } from "./sidebar-nav";
import { PwaInstallBanner } from "./pwa-install-banner";

const pageTitles: Record<string, string> = {
  "/audio": "Messages Audio",
  "/video": "Messages Video",
  "/textes": "Messages Texte",
  "/profil": "Mon Profil",
  "/downloads": "Telechargements",
  "/series": "Series & Programmes",
};

export function Layout() {
  const location = useLocation();
  const title = pageTitles[location.pathname];

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop sidebar */}
      <SidebarNav />

      {/* Main content area */}
      <div className="lg:pl-[240px]">
        <div className="max-w-lg mx-auto lg:max-w-3xl relative">
          {/* Mobile header (hidden on desktop as sidebar has logo) */}
          <AppHeader title={title} />

          <main className="min-h-[calc(100vh-56px)]">
            <Outlet />
          </main>

          {/* Mobile bottom nav */}
          <BottomNav />

          {/* PWA install banner */}
          <PwaInstallBanner />
        </div>
      </div>
    </div>
  );
}
