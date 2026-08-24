import { createBrowserRouter } from "react-router";
import { Layout } from "./components/layout";
import { HomePage } from "./components/pages/home-page";
import { AudioPage } from "./components/pages/audio-page";
import { VideoPage } from "./components/pages/video-page";
import { TextesPage } from "./components/pages/textes-page";
import { ProfilPage } from "./components/pages/profil-page";
import { LoginPage } from "./components/pages/login-page";
import { SignupPage } from "./components/pages/signup-page";
import { ForgotPasswordPage } from "./components/pages/forgot-password-page";
import { ResetPasswordPage } from "./components/pages/reset-password-page";
import { DetailPage } from "./components/pages/detail-page";
import { AdminPage } from "./components/pages/admin-page";
import { AdminUsersPage } from "./components/pages/admin-users-page";
import { DownloadsPage } from "./components/pages/downloads-page";
import { SeriesListPage } from "./components/pages/series-list-page";
import { SeriesDetailPage } from "./components/pages/series-detail-page";
import { AdminStatsPage } from "./components/pages/admin-stats-page";
import { AdminDashboardPage } from "./components/pages/admin-dashboard-page";
import { MfaSecurityPage } from "./components/pages/mfa-security-page";

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
  { path: "/forgot-password", Component: ForgotPasswordPage },
  { path: "/reset-password", Component: ResetPasswordPage },
  { path: "/security/mfa", Component: MfaSecurityPage },
  { path: "/message/:id", Component: DetailPage },
  { path: "/admin", Component: AdminPage },
  { path: "/admin/users", Component: AdminUsersPage },
  { path: "/admin/stats", Component: AdminStatsPage },
  { path: "/admin/dashboard", Component: AdminDashboardPage },
  { path: "/series/:id", Component: SeriesDetailPage },
]);
