import { afterEach, describe, expect, it, vi } from "vitest";
import { BASE } from "./http";
import { inviteUser, requestUserPasswordReset, resendUserInvitation, updateOwnProfile, updateUserAccountStatus, verifyCurrentAccountAccess } from "./users-service";

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

  it("vérifie l'accès du compte courant via l'API protégée", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ role: "user" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(verifyCurrentAccountAccess("token-user")).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith(`${BASE}/users/me/role`, expect.objectContaining({
      headers: expect.any(Object),
    }));
  });

  it("met à jour uniquement le nom du profil courant via la route dédiée", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ user: { id: "user-42", name: "Marie ECODIS" } }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(updateOwnProfile("Marie ECODIS", "token-user")).resolves.toMatchObject({ user: { name: "Marie ECODIS" } });
    expect(fetchMock).toHaveBeenCalledWith(`${BASE}/users/me/profile`, expect.objectContaining({
      method: "PUT",
      body: JSON.stringify({ name: "Marie ECODIS" }),
    }));
  });
});
