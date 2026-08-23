import { describe, expect, it, vi } from "vitest";

const http = vi.hoisted(() => ({
  fetchJson: vi.fn(),
  getHeaders: vi.fn(() => ({ Authorization: "Bearer public" })),
}));

vi.mock("./http", () => http);

import { fetchMessage, fetchMessages } from "./messages-service";

describe("integration service des messages", () => {
  it("construit la requete filtree et extrait les messages", async () => {
    http.fetchJson.mockResolvedValue({ messages: [{ id: "message-1", title: "Audio de recette" }] });

    await expect(fetchMessages("audio")).resolves.toEqual([{ id: "message-1", title: "Audio de recette" }]);
    expect(http.fetchJson).toHaveBeenCalledWith("/messages?type=audio", { headers: { Authorization: "Bearer public" } });
  });

  it("retourne null si le detail n'est pas disponible", async () => {
    http.fetchJson.mockRejectedValue(new Error("indisponible"));

    await expect(fetchMessage("absent")).resolves.toBeNull();
  });
});
