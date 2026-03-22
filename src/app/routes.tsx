import { lazy, Suspense, type ComponentType, type LazyExoticComponent } from "react";
import { createBrowserRouter } from "react-router";
import { Layout } from "./components/layout";
import { PageLoader } from "./components/page-loader";

function lazyPage<T>(factory: () => Promise<{ default: ComponentType<T> }>) {
  const LazyComponent: LazyExoticComponent<ComponentType<T>> = lazy(factory);
  return function WrappedPage(props: T) {
    return (
      <Suspense fallback={<PageLoader />}>
        <LazyComponent {...props} />
      </Suspense>
    );
  };
}

const HomePage = lazyPage(() => import("./components/pages/home-page").then((module) => ({ default: module.HomePage })));
const AudioPage = lazyPage(() => import("./components/pages/audio-page").then((module) => ({ default: module.AudioPage })));
const VideoPage = lazyPage(() => import("./components/pages/video-page").then((module) => ({ default: module.VideoPage })));
const TextesPage = lazyPage(() => import("./components/pages/textes-page").then((module) => ({ default: module.TextesPage })));
const ProfilPage = lazyPage(() => import("./components/pages/profil-page").then((module) => ({ default: module.ProfilPage })));
const DownloadsPage = lazyPage(() => import("./components/pages/downloads-page").then((module) => ({ default: module.DownloadsPage })));
const SeriesListPage = lazyPage(() => import("./components/pages/series-list-page").then((module) => ({ default: module.SeriesListPage })));
const LoginPage = lazyPage(() => import("./components/pages/login-page").then((module) => ({ default: module.LoginPage })));
const SignupPage = lazyPage(() => import("./components/pages/signup-page").then((module) => ({ default: module.SignupPage })));
const DetailPage = lazyPage(() => import("./components/pages/detail-page").then((module) => ({ default: module.DetailPage })));
const AdminPage = lazyPage(() => import("./components/pages/admin-page").then((module) => ({ default: module.AdminPage })));
const AdminUsersPage = lazyPage(() => import("./components/pages/admin-users-page").then((module) => ({ default: module.AdminUsersPage })));
const AdminStatsPage = lazyPage(() => import("./components/pages/admin-stats-page").then((module) => ({ default: module.AdminStatsPage })));
const AdminDashboardPage = lazyPage(() => import("./components/pages/admin-dashboard-page").then((module) => ({ default: module.AdminDashboardPage })));
const SeriesDetailPage = lazyPage(() => import("./components/pages/series-detail-page").then((module) => ({ default: module.SeriesDetailPage })));

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Layout,
    children: [
      { index: true, Component: HomePage },
      { path: "audio", Component: AudioPage },
      { path: "video", Component: VideoPage },
      { path: "textes", Component: TextesPage },
      { path: "profil", Component: ProfilPage },
      { path: "downloads", Component: DownloadsPage },
      { path: "series", Component: SeriesListPage },
    ],
  },
  { path: "/login", Component: LoginPage },
  { path: "/signup", Component: SignupPage },
  { path: "/message/:id", Component: DetailPage },
  { path: "/admin", Component: AdminPage },
  { path: "/admin/users", Component: AdminUsersPage },
  { path: "/admin/stats", Component: AdminStatsPage },
  { path: "/admin/dashboard", Component: AdminDashboardPage },
  { path: "/series/:id", Component: SeriesDetailPage },
]);
