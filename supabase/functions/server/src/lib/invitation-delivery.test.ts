import { getInvitationDeliveryGateway, invitationEmailHtml } from "./invitation-delivery.ts";
import { mapAuthDeliveryError } from "./errors.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test("invitation delivery - classe les quotas et indisponibilités e-mail", () => {
  const quota = mapAuthDeliveryError({ code: "over_email_send_rate_limit", status: 429 });
  assert(quota.status === 429 && quota.retryAfterSeconds === 60, "Le quota Auth doit devenir une réponse 429");
  const unavailable = mapAuthDeliveryError(new TypeError("fetch failed"));
  assert(unavailable.status === 503, "Une indisponibilité réseau doit devenir une réponse 503");
});

Deno.test("invitation delivery - reste désactivé sans secrets Resend", async () => {
  const gateway = getInvitationDeliveryGateway({ get: () => undefined });
  assert(!gateway.available, "Le fournisseur ne doit pas être actif sans configuration");
  await gateway.sendInvite({ recipientEmail: "test@example.com", recipientName: "Test", actionLink: "https://example.test", idempotencyKey: "test" })
    .then(() => { throw new Error("Un fournisseur désactivé doit refuser l'envoi"); })
    .catch((error) => assert(error.status === 503, "Le refus doit être explicite et temporaire"));
});

Deno.test("invitation delivery - échappe les valeurs du gabarit", () => {
  const html = invitationEmailHtml("<script>", "https://example.test/?a=1&b=2");
  assert(!html.includes("<script>"), "Le nom ne doit pas être injecté dans le HTML");
  assert(html.includes("&amp;"), "Le lien doit être échappé dans le HTML");
});
