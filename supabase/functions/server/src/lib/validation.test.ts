Deno.env.set("APP_API_PREFIX", "server/api");
Deno.env.set("APP_STORAGE_BUCKET_NAME", "media");
Deno.env.set("APP_ALLOWED_ORIGINS", "http://localhost:5173");

const validation = await import("./validation.ts");
const { ValidationError } = await import("./errors.ts");

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function assertThrows(action: () => unknown, expectedMessage: string) {
  try {
    action();
  } catch (error) {
    assert(error instanceof ValidationError, "La validation doit retourner une ValidationError");
    assert(error.message.includes(expectedMessage), `Message attendu : ${expectedMessage}`);
    return;
  }
  throw new Error("Une erreur de validation etait attendue");
}

Deno.test("validation - normalise les chaines et les emails", () => {
  assert(validation.validateRequiredString("  ECODIS  ", "Nom") === "ECODIS", "La chaine doit etre normalisee");
  assert(validation.validateEmail("  TEST@EXAMPLE.COM ") === "test@example.com", "L'email doit etre normalise");
  assertThrows(() => validation.validateEmail("invalide"), "Adresse email invalide");
});

Deno.test("validation - refuse les mots de passe et types invalides", () => {
  assertThrows(() => validation.validatePassword("courte1"), "au moins 8");
  assertThrows(() => validation.validatePassword("motdepasse"), "lettre et un chiffre");
  assertThrows(() => validation.validateMessageType("pdf"), "Type de message invalide");
});

Deno.test("validation - controle le type de fichier media", () => {
  const audio = new File(["audio"], "message.mp3", { type: "audio/mpeg" });
  validation.validateFileForMessage("audio", audio, 1);

  const image = new File(["image"], "image.png", { type: "image/png" });
  assertThrows(() => validation.validateFileForMessage("audio", image, 1), "MIME autorises");

  const renamedImage = new File(["image"], "image.mp3", { type: "image/png" });
  assertThrows(() => validation.validateFileForMessage("audio", renamedImage, 1), "MIME autorises");
});

Deno.test("validation - encadre le signalement et la modération", () => {
  assert(validation.validateCommentReportReason("spam") === "spam", "Le motif spam doit être accepté");
  assert(validation.validateModerationAction("hide") === "hide", "L'action hide doit être acceptée");
  assertThrows(() => validation.validateCommentReportReason("invalid"), "Motif de signalement invalide");
  assertThrows(() => validation.validateModerationAction("publish"), "Action de modération invalide");
  assert(validation.validateAccountStatus("suspended") === "suspended", "Le statut suspended doit être accepté");
  assertThrows(() => validation.validateAccountStatus("disabled"), "Statut de compte invalide");
});
