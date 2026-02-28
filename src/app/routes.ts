import { createBrowserRouter } from "react-router";
import { Layout } from "./components/layout";
import { HomePage } from "./components/pages/home-page";
import { AudioPage } from "./components/pages/audio-page";
import { VideoPage } from "./components/pages/video-page";
import { TextesPage } from "./components/pages/textes-page";
import { ProfilPage } from "./components/pages/profil-page";

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
    ],
  },
]);
