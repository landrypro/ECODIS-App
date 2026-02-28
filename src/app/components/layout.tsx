import { Outlet, useLocation } from "react-router";
import { BottomNav } from "./bottom-nav";
import { AppHeader } from "./app-header";

const pageTitles: Record<string, string> = {
  "/audio": "Messages Audio",
  "/video": "Messages Vidéo",
  "/textes": "Messages Texte",
  "/profil": "Mon Profil",
};

export function Layout() {
  const location = useLocation();
  const title = pageTitles[location.pathname];

  return (
    <div className="min-h-screen bg-background max-w-lg mx-auto relative">
      <AppHeader title={title} />
      <main>
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}
