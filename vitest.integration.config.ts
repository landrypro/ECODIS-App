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
    // Les workers threads échouent parfois avant même d'exécuter un fichier
    // sous Windows. Un seul fork conserve la même isolation de processus sans
    // masquer les tests d'intégration.
    pool: "forks",
    maxWorkers: 1,
    isolate: false,
    // Le premier rendu JSDOM/Vite peut dépasser les 5 s par défaut sur le
    // poste Windows. Les assertions restent inchangées : ce délai évite
    // seulement qu'un test asynchrone soit interrompu avant sa propre attente.
    testTimeout: 15_000,
    clearMocks: true,
    restoreMocks: true,
  },
});
