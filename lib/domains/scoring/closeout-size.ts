import { sandBeachSizeCapFt } from "@/lib/data/sand-beach-size-caps";
import type { ScoringDecisionEffect } from "./types";

/** Under 40 so the canonical decision reads "no" (`applyVerdictCeiling`). */
export const CLOSEOUT_SIZE_VERDICT_CEILING = 39;

/** Effect for a capped sand beach whose face height is above its cap; null otherwise. */
export function closeoutSizeEffect(
  beachId: string | null | undefined,
  faceHeightFt: number | null | undefined,
): ScoringDecisionEffect | null {
  const cap = sandBeachSizeCapFt(beachId);
  if (cap === null || faceHeightFt == null || !Number.isFinite(faceHeightFt)) return null;
  if (faceHeightFt <= cap) return null;
  return {
    code: "closeout_size",
    severity: "severe",
    verdictCeiling: CLOSEOUT_SIZE_VERDICT_CEILING,
    message: "Likely closing out at this size",
  };
}
