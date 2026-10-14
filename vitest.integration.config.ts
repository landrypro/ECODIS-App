import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// Les intégrations frontend sont isolées des tests unitaires. Vitest retourne
// toujours un code non nul si aucun fichier correspondant n'est découvert.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.integration.test.ts", "src/**/*.integration.test.tsx"],
    pool: "threads",
    maxWorkers: 1,
    isolate: false,
    clearMocks: true,
    restoreMocks: true,
  },
});
