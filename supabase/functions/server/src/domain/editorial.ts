import { ValidationError } from "../lib/errors.ts";

export const EDITORIAL_STATUSES = ["draft", "in_review", "scheduled", "published", "archived"] as const;
export type EditorialStatus = typeof EDITORIAL_STATUSES[number];

const TRANSITIONS: Record<EditorialStatus, EditorialStatus[]> = {
  draft: ["in_review", "archived"],
  in_review: ["draft", "scheduled", "published", "archived"],
  scheduled: ["draft", "in_review", "published", "archived"],
  published: ["draft", "archived"],
  archived: ["draft"],
};

export function validateEditorialStatus(value: unknown): EditorialStatus {
  if (typeof value !== "string" || !EDITORIAL_STATUSES.includes(value as EditorialStatus)) {
    throw new ValidationError("Statut editorial invalide");
  }
  return value as EditorialStatus;
}

export function assertEditorialTransition(current: EditorialStatus, next: EditorialStatus): void {
  if (!TRANSITIONS[current].includes(next)) {
    throw new ValidationError(`Transition invalide : ${current} vers ${next}`);
  }
}

export function parseFutureSchedule(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new ValidationError("Une date de planification est requise");
  }
  const scheduledAt = new Date(value);
  if (Number.isNaN(scheduledAt.getTime()) || scheduledAt.getTime() <= Date.now()) {
    throw new ValidationError("La date de planification doit etre dans le futur");
  }
  return scheduledAt.toISOString();
}

export function buildEditorialTransition(
  current: EditorialStatus,
  next: EditorialStatus,
  actorId: string,
  scheduleInput: unknown,
  now = new Date().toISOString(),
  existingPublishedAt: string | null = null,
) {
  assertEditorialTransition(current, next);
  const payload: Record<string, unknown> = { status: next, updated_at: now };

  if (next === "scheduled") {
    payload.scheduled_at = parseFutureSchedule(scheduleInput);
  } else {
    payload.scheduled_at = null;
  }

  if (next === "published") {
    payload.published_at = existingPublishedAt ?? now;
    payload.reviewed_at = now;
    payload.reviewed_by = actorId;
  }

  return payload;
}
