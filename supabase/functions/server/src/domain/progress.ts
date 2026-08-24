import { ValidationError } from "../lib/errors.ts";

export type ProgressState = "in_progress" | "completed";
export type ProgressSource = "online" | "offline_sync" | "manual";

export interface ProgressEventInput {
  eventId: string;
  state: ProgressState;
  progressPercent: number;
  positionSeconds: number;
  durationSeconds: number;
  clientUpdatedAt: string;
  source: ProgressSource;
}

export interface ModuleProgressSnapshot {
  state: ProgressState;
  progressPercent: number;
  positionSeconds: number;
  durationSeconds: number;
  completedAt: string | null;
  clientUpdatedAt: string;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function finiteNumber(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new ValidationError(`${field} doit être un nombre valide`);
  }
  return value;
}

export function normalizeProgressEvent(value: any, now = new Date()): ProgressEventInput {
  if (!UUID_PATTERN.test(value?.eventId ?? "")) throw new ValidationError("eventId doit être un UUID valide");
  if (value?.state !== "in_progress" && value?.state !== "completed") {
    throw new ValidationError("État de progression invalide");
  }
  if (value?.source !== "online" && value?.source !== "offline_sync" && value?.source !== "manual") {
    throw new ValidationError("Source de progression invalide");
  }

  const rawPercent = finiteNumber(value.progressPercent, "progressPercent");
  const rawPosition = finiteNumber(value.positionSeconds, "positionSeconds");
  const rawDuration = finiteNumber(value.durationSeconds, "durationSeconds");
  if (rawPercent < 0 || rawPercent > 100) throw new ValidationError("progressPercent doit être compris entre 0 et 100");
  if (rawPosition < 0 || rawDuration < 0) throw new ValidationError("La position et la durée doivent être positives");

  const clientDate = new Date(value.clientUpdatedAt);
  if (!value.clientUpdatedAt || Number.isNaN(clientDate.getTime())) {
    throw new ValidationError("clientUpdatedAt doit être une date ISO valide");
  }
  if (clientDate.getTime() > now.getTime() + 5 * 60 * 1000) {
    throw new ValidationError("clientUpdatedAt ne peut pas être dans le futur");
  }

  const durationSeconds = Math.round(rawDuration * 1000) / 1000;
  const positionSeconds = Math.round(Math.min(rawPosition, durationSeconds || rawPosition) * 1000) / 1000;
  const measuredPercent = durationSeconds > 0 ? (positionSeconds / durationSeconds) * 100 : 0;
  let progressPercent = Math.round(Math.max(rawPercent, measuredPercent));
  let state: ProgressState = value.state;
  if (value.source === "manual" || state === "completed" || progressPercent >= 90) {
    state = "completed";
    progressPercent = 100;
  }

  return {
    eventId: value.eventId,
    state,
    progressPercent,
    positionSeconds,
    durationSeconds,
    clientUpdatedAt: clientDate.toISOString(),
    source: value.source,
  };
}

export function mergeProgressSnapshots(
  current: ModuleProgressSnapshot | null,
  incoming: ModuleProgressSnapshot,
): ModuleProgressSnapshot {
  const completed = current?.state === "completed" || incoming.state === "completed"
    || current?.progressPercent === 100 || incoming.progressPercent >= 90;
  const positionSeconds = Math.max(current?.positionSeconds ?? 0, incoming.positionSeconds);
  const durationSeconds = Math.max(current?.durationSeconds ?? 0, incoming.durationSeconds);
  return {
    state: completed ? "completed" : "in_progress",
    progressPercent: completed ? 100 : Math.max(current?.progressPercent ?? 0, incoming.progressPercent),
    positionSeconds,
    durationSeconds,
    completedAt: current?.completedAt ?? (completed ? incoming.completedAt : null),
    clientUpdatedAt: current && current.positionSeconds > incoming.positionSeconds
      ? current.clientUpdatedAt
      : new Date(Math.max(
        current ? new Date(current.clientUpdatedAt).getTime() : 0,
        new Date(incoming.clientUpdatedAt).getTime(),
      )).toISOString(),
  };
}
