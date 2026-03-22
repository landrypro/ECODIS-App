import { RouterProvider } from "react-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { router } from "./routes";
import { queryClient } from "./query-client";
import { AuthProvider } from "./components/auth-context";
import { DownloadProvider } from "./components/download-context";
import { PlatformProvider } from "./components/platform-utils";
import { Toaster } from "sonner";

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <PlatformProvider>
        <AuthProvider>
          <DownloadProvider>
            <RouterProvider router={router} />
            <Toaster position="top-center" richColors />
          </DownloadProvider>
        </AuthProvider>
      </PlatformProvider>
    </QueryClientProvider>
  );
}
