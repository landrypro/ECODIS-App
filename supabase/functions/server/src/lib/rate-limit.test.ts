import { getClientIdentifier, maxForProfile, profileFor } from "../domain/rate-limit.ts";

Deno.test("rate limiting - classe les routes et identifie le client", () => {
  const request = new Request("https://api.example.test/auth/signup", { headers: { "x-forwarded-for": "203.0.113.10" } });
  if (profileFor(new URL(request.url).pathname) !== "auth") throw new Error("Le profil auth est attendu");
  if (profileFor("/server/api/admin/users") !== "admin") throw new Error("Le profil admin est attendu");
  if (profileFor("/server/api/messages") !== "public") throw new Error("Le profil public est attendu");
  if (getClientIdentifier(request) !== "203.0.113.10") throw new Error("L'adresse transmise doit etre retenue");
  if (maxForProfile("auth", { windowSeconds: 60, publicMax: 10, authMax: 3, adminMax: 5 }) !== 3) {
    throw new Error("La limite auth attendue est 3");
  }
});
