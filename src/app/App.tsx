import { RouterProvider } from "react-router";
import { router } from "./routes";
import { AuthProvider } from "./components/auth-context";
import { DownloadProvider } from "./components/download-context";
import { PlatformProvider } from "./components/platform-utils";
import { Toaster } from "sonner";

export default function App() {
  return (
    <PlatformProvider>
      <AuthProvider>
        <DownloadProvider>
          <RouterProvider router={router} />
          <Toaster position="top-center" richColors />
        </DownloadProvider>
      </AuthProvider>
    </PlatformProvider>
  );
}
