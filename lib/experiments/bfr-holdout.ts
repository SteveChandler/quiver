import type { BfrHoldoutAssignmentRecord } from "@/types/beach-follow";

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
  if (!Number.isFinite(Date.parse(assignedAt))) {
    throw new Error("Invalid BFR holdout assignment time");
  }

  const hash = fnv1a32(`${subjectId}:${BFR_HOLDOUT_EXPERIMENT_KEY}`);
  return {
    subjectId,
    experimentKey: BFR_HOLDOUT_EXPERIMENT_KEY,
    arm: (hash & 1) === 0 ? "holdout" : "treatment",
    assignedAt,
    version: BFR_HOLDOUT_ASSIGNMENT_VERSION,
  };
}
