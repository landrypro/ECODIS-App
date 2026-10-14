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

function resendEnvironment() {
  const values: Record<string, string> = {
    APP_EMAIL_PROVIDER: "resend",
    RESEND_API_KEY: "re_test_secret",
    APP_EMAIL_FROM: "ECODIS <invitation@example.test>",
  };
  return { get: (name: string) => values[name] };
}

Deno.test("invitation delivery - envoie sans exposer le secret et avec idempotence", async () => {
  let capturedUrl = "";
  let capturedInit: RequestInit | undefined;
  const send = (async (input: string | URL | Request, init?: RequestInit) => {
    capturedUrl = String(input);
    capturedInit = init;
    return new Response(JSON.stringify({ id: "email-1" }), { status: 200 });
  }) as typeof fetch;
  const gateway = getInvitationDeliveryGateway(resendEnvironment(), send);

  const result = await gateway.sendInvite({
    recipientEmail: "invite@example.test",
    recipientName: "Disciple ECODIS",
    actionLink: "https://project.supabase.co/auth/v1/verify?token=secret",
    idempotencyKey: "request-123",
  });

  const headers = new Headers(capturedInit?.headers);
  const body = JSON.parse(String(capturedInit?.body)) as Record<string, unknown>;
  assert(result.accepted, "Le fournisseur doit confirmer l'acceptation");
  assert(capturedUrl === "https://api.resend.com/emails", "Seule l'API Resend doit être appelée");
  assert(headers.get("Authorization") === "Bearer re_test_secret", "La clé doit rester dans l'en-tête serveur");
  assert(headers.get("Idempotency-Key") === "request-123", "La clé d'idempotence doit être transmise");
  assert(!JSON.stringify(result).includes("secret"), "La réponse applicative ne doit contenir ni clé ni lien");
  assert(String(body.html).includes("token=secret"), "Le lien doit uniquement être placé dans le message fournisseur");
});

Deno.test("invitation delivery - traduit le quota Resend en 429", async () => {
  const send = (async () => new Response("quota", {
    status: 429,
    headers: { "Retry-After": "90" },
  })) as typeof fetch;
  const gateway = getInvitationDeliveryGateway(resendEnvironment(), send);

  await gateway.sendInvite({
    recipientEmail: "invite@example.test",
    recipientName: "Disciple",
    actionLink: "https://project.supabase.co/auth/v1/verify?token=secret",
    idempotencyKey: "request-429",
  }).then(() => {
    throw new Error("Le quota fournisseur doit refuser l'envoi");
  }).catch((error) => {
    assert(error.status === 429, "Le quota doit être traduit en HTTP 429");
    assert(error.retryAfterSeconds === 90, "Retry-After doit être conservé");
    assert(!error.message.includes("quota"), "Le corps brut du fournisseur ne doit pas être exposé");
  });
});

Deno.test("invitation delivery - refuse un lien non HTTPS avant tout envoi", async () => {
  let called = false;
  const send = (async () => {
    called = true;
    return new Response(null, { status: 200 });
  }) as typeof fetch;
  const gateway = getInvitationDeliveryGateway(resendEnvironment(), send);

  await gateway.sendInvite({
    recipientEmail: "invite@example.test",
    recipientName: "Disciple",
    actionLink: "http://example.test/insecure",
    idempotencyKey: "request-insecure",
  }).then(() => {
    throw new Error("Un lien non sécurisé doit être refusé");
  }).catch((error) => assert(error.status === 503, "Le refus public doit rester neutre"));
  assert(!called, "Le fournisseur ne doit pas être appelé avec un lien non sécurisé");
});

Deno.test("invitation delivery - refuse une configuration expéditeur contenant un saut de ligne", () => {
  const values: Record<string, string> = {
    APP_EMAIL_PROVIDER: "resend",
    RESEND_API_KEY: "re_test_secret",
    APP_EMAIL_FROM: "ECODIS <invitation@example.test>\r\nBcc: attacker@example.test",
  };
  const gateway = getInvitationDeliveryGateway({ get: (name: string) => values[name] });
  assert(!gateway.available, "Une configuration d'expéditeur ambiguë doit désactiver le fournisseur");
});
