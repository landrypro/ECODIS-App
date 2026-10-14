import { healthRoutes } from "./health.ts";

Deno.test("integration health - retourne un statut operationnel", async () => {
  const response = await healthRoutes.request("http://localhost/health");
  const body = await response.json();

  if (response.status !== 200) throw new Error(`Statut HTTP inattendu : ${response.status}`);
  if (body.status !== "ok") throw new Error("Le health check doit retourner le statut ok");
});
