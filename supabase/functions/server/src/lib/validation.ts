import { EMAIL_REGEX, MESSAGE_TYPES } from "../config.ts";
import { ValidationError } from "./errors.ts";

export function validateRequiredString(value: unknown, fieldName: string, minLength = 1, maxLength = 255): string {
  if (typeof value !== "string") {
    throw new ValidationError(`${fieldName} est requis`);
  }
  const normalized = value.trim();
  if (normalized.length < minLength) {
    throw new ValidationError(`${fieldName} doit contenir au moins ${minLength} caractere(s)`);
  }
  if (normalized.length > maxLength) {
    throw new ValidationError(`${fieldName} ne doit pas depasser ${maxLength} caracteres`);
  }
  return normalized;
}

export function validateOptionalString(value: unknown, fieldName: string, maxLength = 2000): string {
  if (value == null || value === "") return "";
  if (typeof value !== "string") {
    throw new ValidationError(`${fieldName} doit etre une chaine de caracteres`);
  }
  const normalized = value.trim();
  if (normalized.length > maxLength) {
    throw new ValidationError(`${fieldName} ne doit pas depasser ${maxLength} caracteres`);
  }
  return normalized;
}

export function validateEmail(email: unknown): string {
  const normalized = validateRequiredString(email, "Email", 5, 320).toLowerCase();
  if (!EMAIL_REGEX.test(normalized)) {
    throw new ValidationError("Adresse email invalide");
  }
  return normalized;
}

export function validatePassword(password: unknown): string {
  if (typeof password !== "string") {
    throw new ValidationError("Le mot de passe est requis");
  }
  if (password.length < 8) {
    throw new ValidationError("Le mot de passe doit contenir au moins 8 caracteres");
  }
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    throw new ValidationError("Le mot de passe doit contenir au moins une lettre et un chiffre");
  }
  if (password.length > 128) {
    throw new ValidationError("Le mot de passe est trop long");
  }
  return password;
}

export function validateMessageType(type: unknown): "audio" | "video" | "text" {
  if (typeof type !== "string" || !MESSAGE_TYPES.has(type)) {
    throw new ValidationError("Type de message invalide");
  }
  return type as "audio" | "video" | "text";
}

export function normalizeStringArray(value: unknown, fieldName: string, maxItems = 200): string[] {
  if (value == null) return [];
  if (!Array.isArray(value)) {
    throw new ValidationError(`${fieldName} doit etre un tableau`);
  }
  const normalized = [...new Set(value.map((item) => validateRequiredString(item, fieldName, 1, 255)))];
  if (normalized.length > maxItems) {
    throw new ValidationError(`${fieldName} ne doit pas depasser ${maxItems} elements`);
  }
  return normalized;
}

export function validateBoolean(value: unknown, fieldName: string): boolean {
  if (typeof value !== "boolean") {
    throw new ValidationError(`${fieldName} doit etre un booleen`);
  }
  return value;
}

export function validateAccountStatus(value: unknown): "active" | "suspended" {
  if (value !== "active" && value !== "suspended") {
    throw new ValidationError("Statut de compte invalide");
  }
  return value;
}

export function validateCommentText(text: unknown): string {
  return validateRequiredString(text, "Le commentaire", 1, 1000);
}

export const COMMENT_REPORT_REASONS = ["spam", "harassment", "inappropriate_content", "misinformation", "other"] as const;
export type CommentReportReason = typeof COMMENT_REPORT_REASONS[number];

export function validateCommentReportReason(value: unknown): CommentReportReason {
  if (typeof value !== "string" || !COMMENT_REPORT_REASONS.includes(value as CommentReportReason)) {
    throw new ValidationError("Motif de signalement invalide");
  }
  return value as CommentReportReason;
}

export function validateModerationAction(value: unknown): "hide" | "restore" | "delete" {
  if (value !== "hide" && value !== "restore" && value !== "delete") {
    throw new ValidationError("Action de modération invalide");
  }
  return value;
}

export function validateFileForMessage(type: "audio" | "video" | "text", mediaFile: File | null, maxUploadSizeMb: number) {
  if (type === "text") return;
  if (!mediaFile || mediaFile.size <= 0) {
    throw new ValidationError("Un fichier media est requis pour ce type de message");
  }
  const maxBytes = maxUploadSizeMb * 1024 * 1024;
  if (mediaFile.size > maxBytes) {
    throw new ValidationError(`Le fichier depasse la taille maximale de ${maxUploadSizeMb} Mo`);
  }
  const extension = mediaFile.name.split(".").pop()?.toLowerCase() ?? "";
  const allowed = type === "audio"
    ? new Map([["mp3", ["audio/mpeg", "audio/mp3"]], ["wav", ["audio/wav", "audio/x-wav"]], ["ogg", ["audio/ogg"]], ["m4a", ["audio/mp4", "audio/x-m4a"]], ["aac", ["audio/aac"]]])
    : new Map([["mp4", ["video/mp4"]], ["webm", ["video/webm"]], ["mov", ["video/quicktime"]]]);
  const acceptedMimeTypes = allowed.get(extension);
  if (!acceptedMimeTypes || !acceptedMimeTypes.includes(mediaFile.type.toLowerCase())) {
    throw new ValidationError(`Le fichier ${type} doit utiliser une extension et un type MIME autorises`);
  }
}
