
import { createRoot } from "react-dom/client";
import App from "./app/App";
import { installFrontendMonitoring } from "./app/monitoring";
import "./styles/index.css";

installFrontendMonitoring();
createRoot(document.getElementById("root")!).render(<App />);

if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    void navigator.serviceWorker.register("/sw.js").catch((error) => console.error("Service worker registration failed:", error));
  });
}
