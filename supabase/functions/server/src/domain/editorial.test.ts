Deno.env.set("APP_API_PREFIX", "server/api");
Deno.env.set("APP_STORAGE_BUCKET_NAME", "media");
Deno.env.set("APP_ALLOWED_ORIGINS", "http://localhost:5173");

const { assertEditorialTransition, buildEditorialTransition } = await import("./editorial.ts");

Deno.test("editorial - n'autorise que les transitions definies", () => {
  assertEditorialTransition("draft", "in_review");
  assertEditorialTransition("in_review", "published");
  assertEditorialTransition("published", "archived");
  try {
    assertEditorialTransition("draft", "published");
    throw new Error("La publication directe depuis draft doit etre refusee");
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes("Transition invalide")) throw error;
  }
});

Deno.test("editorial - prepare la publication et la planification", () => {
  const initialPublication = "2026-08-21T12:00:00.000Z";
  const published = buildEditorialTransition("in_review", "published", "actor", undefined, "2026-08-22T12:00:00.000Z", initialPublication);
  if (published.status !== "published" || published.published_at !== initialPublication) {
    throw new Error("Les metadonnees de publication sont attendues");
  }

  const future = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const scheduled = buildEditorialTransition("in_review", "scheduled", "actor", future, "2026-08-21T12:00:00.000Z");
  if (scheduled.status !== "scheduled" || scheduled.scheduled_at !== future) {
    throw new Error("La planification doit conserver une date ISO");
  }
});
