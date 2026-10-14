import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// Les unités sont isolées des intégrations sans dépendre d'un glob transmis
// par le shell ; le script reste donc portable sous PowerShell et CI.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    exclude: ["src/**/*.integration.test.ts", "src/**/*.integration.test.tsx"],
    pool: "threads",
    maxWorkers: 1,
    isolate: false,
    clearMocks: true,
    restoreMocks: true,
  },
});
