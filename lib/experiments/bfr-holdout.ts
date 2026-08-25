import type { BfrHoldoutAssignmentRecord } from "@/types/beach-follow";

const MAX_ISO_INSTANT_LENGTH = 35;
const ISO_INSTANT_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?(?:Z|([+-])(\d{2}):(\d{2}))$/;

function normalizeBoundedIsoInstant(value: unknown): string | null {
  if (
    typeof value !== "string" ||
    value.length > MAX_ISO_INSTANT_LENGTH ||
    !ISO_INSTANT_PATTERN.test(value)
  ) {
    return null;
  }

  const match = ISO_INSTANT_PATTERN.exec(value);
  if (!match) return null;
  const [, year, month, day, hour, minute, second] = match
    .slice(0, 7)
    .map(Number);
  const offsetHour = match[8] === undefined ? null : Number(match[8]);
  const offsetMinute = match[9] === undefined ? null : Number(match[9]);
  if (
    offsetHour !== null
    && offsetMinute !== null
    && (
      offsetHour > 14
      || offsetMinute > 59
      || (offsetHour === 14 && offsetMinute !== 0)
    )
  ) {
    return null;
  }
  const calendar = new Date(0);
  calendar.setUTCHours(0, 0, 0, 0);
  calendar.setUTCFullYear(year, month - 1, day);
  calendar.setUTCHours(hour, minute, second, 0);
  if (
    calendar.getUTCFullYear() !== year
    || calendar.getUTCMonth() !== month - 1
    || calendar.getUTCDate() !== day
    || calendar.getUTCHours() !== hour
    || calendar.getUTCMinutes() !== minute
    || calendar.getUTCSeconds() !== second
  ) {
    return null;
  }

  const millis = Date.parse(value);
  return Number.isFinite(millis) ? new Date(millis).toISOString() : null;
}

export const BFR_HOLDOUT_EXPERIMENT_KEY = "bfr-follow-holdout-v1" as const;
export const BFR_HOLDOUT_ASSIGNMENT_VERSION = 1 as const;

function fnv1a32(value: string): number {
  let hash = 0x811c9dc5;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return hash >>> 0;
}

export function bfrHoldoutAssignment(
  subjectId: string,
  assignedAt: string
): BfrHoldoutAssignmentRecord {
  if (
    subjectId.length === 0 ||
    subjectId.length > 200 ||
    /[\u0000-\u001F\u007F]/.test(subjectId)
  ) {
    throw new Error("Invalid BFR holdout subject");
  }
  const normalizedAssignedAt = normalizeBoundedIsoInstant(assignedAt);
  if (!normalizedAssignedAt) {
    throw new Error("Invalid BFR holdout assignment time");
  }

  const hash = fnv1a32(`${subjectId}:${BFR_HOLDOUT_EXPERIMENT_KEY}`);
  return {
    subjectId,
    experimentKey: BFR_HOLDOUT_EXPERIMENT_KEY,
    arm: (hash & 1) === 0 ? "holdout" : "treatment",
    assignedAt: normalizedAssignedAt,
    version: BFR_HOLDOUT_ASSIGNMENT_VERSION,
  };
}
