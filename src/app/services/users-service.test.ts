import { afterEach, describe, expect, it, vi } from "vitest";
import { BASE } from "./http";
import { inviteUser, requestUserPasswordReset, resendUserInvitation, updateUserAccountStatus } from "./users-service";

describe("services de comptes administrés", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("envoie une invitation sans mot de passe", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ accepted: true, message: "Invitation envoyée" }), { status: 202 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(inviteUser("disciple@example.com", "Disciple ECODIS", "token-admin")).resolves.toMatchObject({ accepted: true });
    expect(fetchMock).toHaveBeenCalledWith(`${BASE}/users/invitations`, expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ email: "disciple@example.com", name: "Disciple ECODIS" }),
    }));
  });

  it("utilise les routes dédiées pour le renvoi et la récupération", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ accepted: true, message: "Accepté" }), { status: 202 }));
    vi.stubGlobal("fetch", fetchMock);

    await resendUserInvitation("user-42", "token-admin");
    await requestUserPasswordReset("user-42", "token-admin");

    expect(fetchMock).toHaveBeenNthCalledWith(1, `${BASE}/users/user-42/invitation`, expect.objectContaining({ method: "POST" }));
    expect(fetchMock).toHaveBeenNthCalledWith(2, `${BASE}/users/user-42/password-reset`, expect.objectContaining({ method: "POST" }));
  });

  it("transmet le statut et le motif de suspension sans donnée sensible", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: "suspended", message: "Suspendu" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await updateUserAccountStatus("user-42", "suspended", "Non-respect répété de la charte", "token-admin");

    expect(fetchMock).toHaveBeenCalledWith(`${BASE}/users/user-42/status`, expect.objectContaining({
      method: "PUT",
      body: JSON.stringify({ status: "suspended", reason: "Non-respect répété de la charte" }),
    }));
  });
});
