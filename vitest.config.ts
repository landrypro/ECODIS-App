import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.ts", "src/**/*.test.tsx", "src/**/*.integration.test.ts"],
    // Un seul worker thread évite les délais de démarrage des processus forks sous Windows/OneDrive.
    pool: "threads",
    maxWorkers: 1,
    isolate: false,
    clearMocks: true,
    restoreMocks: true,
  },
});
