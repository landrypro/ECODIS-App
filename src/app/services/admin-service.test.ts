import { afterEach, describe, expect, it, vi } from "vitest";
import { BASE } from "./http";
import { fetchAppConfig, updateAppConfig } from "./admin-service";

const config = {
  appName: "ECODIS",
  appSubtitle: "École des Disciples",
  maintenanceMode: false,
  registrationEnabled: true,
  commentsEnabled: true,
  downloadsEnabled: true,
  maxUploadSizeMb: 150,
  maxOfflineStorageMb: 1024,
  defaultLanguage: "fr",
  welcomeMessage: "Bienvenue",
  welcomeVerse: "Jérémie 29:13",
  primaryColor: "#152a6b",
  accentColor: "#9b1b30",
  analyticsEnabled: true,
  autoSeedEnabled: false,
};

describe("service de configuration administrateur", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("charge la configuration depuis la route protégée", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ config }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchAppConfig("admin-token")).resolves.toEqual(config);
    expect(fetchMock).toHaveBeenCalledWith(`${BASE}/admin/config`, expect.objectContaining({
      headers: { Authorization: "Bearer admin-token" },
    }));
  });

  it("enregistre les modifications via PUT et retourne la valeur persistée", async () => {
    const updatedConfig = { ...config, appName: "ECODIS Connectée" };
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ config: updatedConfig }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(updateAppConfig({ appName: updatedConfig.appName }, "admin-token")).resolves.toEqual(updatedConfig);
    expect(fetchMock).toHaveBeenCalledWith(`${BASE}/admin/config`, expect.objectContaining({
      method: "PUT",
      headers: expect.objectContaining({
        "Content-Type": "application/json",
        Authorization: "Bearer admin-token",
      }),
      body: JSON.stringify({ appName: updatedConfig.appName }),
    }));
  });

  it("propage une erreur du backend afin que le formulaire puisse la signaler", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "Accès administrateur requis" }), { status: 403 })));

    await expect(fetchAppConfig("invalid-token")).rejects.toThrow("Accès administrateur requis");
  });
});
