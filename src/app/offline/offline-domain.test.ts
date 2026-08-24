import { describe, expect, it } from "vitest";
import { classifyOfflineDownload, type OfflineManifest } from "./offline-domain";

const manifest = {
  generatedAt: "2026-08-22T00:00:00.000Z",
  downloadsEnabled: true,
  maxOfflineStorageMb: 1024,
  messages: [{ id: "m1", contentVersion: 2 }],
} as OfflineManifest;

describe("reconciliation hors ligne", () => {
  it("conserve une version autorisee et identique", () => {
    expect(classifyOfflineDownload({ id: "m1", contentVersion: 2 }, manifest)).toBe("valid");
  });

  it("revoque un contenu absent ou les telechargements desactives", () => {
    expect(classifyOfflineDownload({ id: "absent", contentVersion: 1 }, manifest)).toBe("revoked");
    expect(classifyOfflineDownload({ id: "m1", contentVersion: 2 }, { ...manifest, downloadsEnabled: false })).toBe("revoked");
  });

  it("invalide une version locale obsolete", () => {
    expect(classifyOfflineDownload({ id: "m1", contentVersion: 1 }, manifest)).toBe("stale");
  });
});
