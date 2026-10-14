Deno.test("progress - complète automatiquement à 90 %", async () => {
  const { normalizeProgressEvent } = await import("./progress.ts");
  const event = normalizeProgressEvent({
    eventId: "d89a8a10-4058-4d7c-9ccf-e8bdc5c56a77",
    state: "in_progress",
    progressPercent: 89,
    positionSeconds: 90,
    durationSeconds: 100,
    clientUpdatedAt: "2026-08-22T04:00:00.000Z",
    source: "online",
  }, new Date("2026-08-22T04:01:00.000Z"));
  if (event.state !== "completed" || event.progressPercent !== 100) {
    throw new Error("Le seuil de 90 % doit terminer le module");
  }
});

Deno.test("progress - le marquage manuel produit 100 %", async () => {
  const { normalizeProgressEvent } = await import("./progress.ts");
  const event = normalizeProgressEvent({
    eventId: "ac24a8a7-64e5-4e71-9fc0-e970ee4bf891",
    state: "in_progress",
    progressPercent: 0,
    positionSeconds: 0,
    durationSeconds: 0,
    clientUpdatedAt: "2026-08-22T04:00:00.000Z",
    source: "manual",
  }, new Date("2026-08-22T04:01:00.000Z"));
  if (event.state !== "completed" || event.progressPercent !== 100) {
    throw new Error("La source manuelle doit terminer le module");
  }
});

Deno.test("progress - une complétion ne régresse jamais", async () => {
  const { mergeProgressSnapshots } = await import("./progress.ts");
  const merged = mergeProgressSnapshots({
    state: "completed",
    progressPercent: 100,
    positionSeconds: 90,
    durationSeconds: 100,
    completedAt: "2026-08-22T03:00:00.000Z",
    clientUpdatedAt: "2026-08-22T03:00:00.000Z",
  }, {
    state: "in_progress",
    progressPercent: 30,
    positionSeconds: 30,
    durationSeconds: 100,
    completedAt: null,
    clientUpdatedAt: "2026-08-22T04:00:00.000Z",
  });
  if (merged.state !== "completed" || merged.progressPercent !== 100 || merged.positionSeconds !== 90) {
    throw new Error("Une synchronisation retardée ne doit pas réduire la progression");
  }
});
