import { createHash } from "crypto";

export type ExperimentKey =
  | "t3-quicklog-v1"
  | "t10-freegrowth-v1"
  | "t2a-swellwatch-v1";

export const EXPERIMENT_KEYS: readonly ExperimentKey[] = [
  "t3-quicklog-v1",
  "t10-freegrowth-v1",
  "t2a-swellwatch-v1",
];

export type ExperimentArm = 0 | 1;

export const BFR_HOLDOUT_EXPERIMENT_KEY = 'bfr-follow-holdout-v1' as const;
export type BfrHoldoutArm = 'holdout' | 'treatment';
export interface BfrHoldoutAssignment {
  experimentKey: typeof BFR_HOLDOUT_EXPERIMENT_KEY;
  arm: BfrHoldoutArm;
}

/**
 * arm = first byte (big-endian, index 0) of SHA-256(UTF-8(userId ':' key)) mod 2.
 * userId is normalized to canonical lowercase UUID to match Postgres uuid::text.
 * Must stay byte-identical to public.experiment_arm() in
 * supabase/migrations/20260804090000_create_experiment_assignments.sql.
 */
export function experimentArm(userId: string, experimentKey: string): ExperimentArm {
  const digest = createHash("sha256")
    .update(Buffer.from(`${userId.toLowerCase()}:${experimentKey}`, "utf8"))
    .digest();

  return (digest[0] % 2) as ExperimentArm;
}

/** Stable for signed-in UUIDs and anonymous visitor identifiers alike. */
export function bfrHoldoutAssignment(subjectId: string): BfrHoldoutAssignment {
  const arm = experimentArm(subjectId, BFR_HOLDOUT_EXPERIMENT_KEY);
  return {
    experimentKey: BFR_HOLDOUT_EXPERIMENT_KEY,
    arm: arm === 0 ? 'holdout' : 'treatment',
  };
}
