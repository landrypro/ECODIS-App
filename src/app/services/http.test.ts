import { afterEach, describe, expect, it, vi } from "vitest";
import { BASE, fetchJson, getHeaders, jsonHeaders, SESSION_REJECTED_EVENT } from "./http";

describe("service HTTP", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("utilise la cle publique lorsque aucun jeton n'est fourni", () => {
    expect(new Headers(getHeaders()).get("Authorization")).toMatch(/^Bearer /);
    expect(new Headers(jsonHeaders()).get("Content-Type")).toBe("application/json");
  });

  it("retourne la reponse JSON d'une API reussie", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ messages: [] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchJson<{ messages: unknown[] }>("/messages")).resolves.toEqual({ messages: [] });
    expect(fetchMock).toHaveBeenCalledWith(`${BASE}/messages`, {});
  });

  it("propage le message d'erreur de l'API", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "Acces refuse" }), { status: 403 })));

    await expect(fetchJson("/admin")).rejects.toThrow("Acces refuse");
  });

  it("signale globalement une session refusée", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })));
    const listener = vi.fn();
    window.addEventListener(SESSION_REJECTED_EVENT, listener, { once: true });

    await expect(fetchJson("/users/me/role")).rejects.toThrow("Unauthorized");
    expect(listener).toHaveBeenCalledOnce();
  });
});
