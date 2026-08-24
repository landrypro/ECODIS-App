import { DeliveryError } from "./errors.ts";

export interface InvitationDeliveryInput {
  recipientEmail: string;
  recipientName: string;
  actionLink: string;
  idempotencyKey: string;
}

export interface InvitationDeliveryGateway {
  readonly available: boolean;
  sendInvite(input: InvitationDeliveryInput): Promise<{ accepted: true }>;
}

type Environment = Pick<typeof Deno.env, "get">;

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;",
  }[character] ?? character));
}

export function invitationEmailHtml(recipientName: string, actionLink: string): string {
  const name = escapeHtml(recipientName);
  const link = escapeHtml(actionLink);
  return `<!doctype html><html lang="fr"><body style="font-family:Arial,sans-serif;color:#152a6b;line-height:1.5"><h1>ECODIS</h1><p>Bonjour ${name},</p><p>Vous avez été invité(e) à rejoindre l'École des Disciples. Choisissez votre mot de passe en utilisant le lien sécurisé ci-dessous.</p><p><a href="${link}" style="display:inline-block;background:#152a6b;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none">Activer mon compte</a></p><p>Si vous n'attendiez pas cette invitation, vous pouvez ignorer cet e-mail.</p></body></html>`;
}

class DisabledInvitationDeliveryGateway implements InvitationDeliveryGateway {
  readonly available = false;

  async sendInvite(_input: InvitationDeliveryInput): Promise<{ accepted: true }> {
    throw new DeliveryError(
      "Le service d'e-mail est temporairement indisponible. Réessayez plus tard.",
      503,
      "unavailable",
    );
  }
}

class ResendInvitationDeliveryGateway implements InvitationDeliveryGateway {
  readonly available = true;

  constructor(
    private readonly apiKey: string,
    private readonly from: string,
    private readonly send: typeof fetch = fetch,
  ) {}

  async sendInvite(input: InvitationDeliveryInput): Promise<{ accepted: true }> {
    let response: Response;
    try {
      response = await this.send("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
          "Idempotency-Key": input.idempotencyKey,
        },
        body: JSON.stringify({
          from: this.from,
          to: [input.recipientEmail],
          subject: "Votre invitation ECODIS",
          html: invitationEmailHtml(input.recipientName, input.actionLink),
        }),
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      throw new DeliveryError(
        "Le service d'e-mail est temporairement indisponible. Réessayez plus tard.",
        503,
        "unavailable",
      );
    }

    if (response.ok) return { accepted: true };
    if (response.status === 429) {
      const retryAfterSeconds = Math.min(3600, Math.max(1, Number(response.headers.get("Retry-After")) || 60));
      throw new DeliveryError(
        "L'envoi d'e-mail est temporairement limité. Réessayez plus tard.",
        429,
        "rate_limited",
        retryAfterSeconds,
      );
    }
    throw new DeliveryError(
      "Le service d'e-mail est temporairement indisponible. Réessayez plus tard.",
      503,
      "unavailable",
    );
  }
}

export function getInvitationDeliveryGateway(env: Environment = Deno.env): InvitationDeliveryGateway {
  const provider = env.get("APP_EMAIL_PROVIDER")?.trim().toLowerCase();
  const apiKey = env.get("RESEND_API_KEY")?.trim();
  const from = env.get("APP_EMAIL_FROM")?.trim();
  if (provider !== "resend" || !apiKey || !from) return new DisabledInvitationDeliveryGateway();
  return new ResendInvitationDeliveryGateway(apiKey, from);
}
