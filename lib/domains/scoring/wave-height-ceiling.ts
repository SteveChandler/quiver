/**
 * Wave Height Ceiling
 *
 * Returns the maximum composite score (0-100) for a given face wave height.
 * Small waves cap the score regardless of alignment, wind, or tide because
 * a surfer cannot actually ride a 1ft wave at 10/10 no matter how clean the
 * conditions are otherwise.
 *
 * This mirrors the intent of `getWaveHeightCeiling` in
 * `lib/scoring/surf-conditions-scorer.ts:562` for parity across the two
 * scoring engines. A follow-up PR will consolidate the two scorers; for now,
 * the domain engine uses a skill-agnostic step-function ceiling (documented
 * below) to stay aligned with the fix plan at
 * `~/.claude/plans/encapsulated-noodling-wadler.md` (Workstream C).
 *
 * Thresholds (skill-agnostic):
 *   <  1.0 ft -> 30   (ankle slop           -- max 3.0/10)
 *   <  1.5 ft -> 40   (knee-high            -- max 4.0/10)
 *   <  2.0 ft -> 55   (thigh-high           -- max 5.5/10)
 *   <  3.0 ft -> 75   (waist+               -- max 7.5/10)
 *   >= 3.0 ft -> 100  (chest+ -- uncapped)
 *
 * Invalid / null inputs return 100 (no cap) to preserve legacy behavior and
 * avoid regressing callers that rely on the engine skipping unknown data.
 */
export function waveHeightCeiling(
  faceHeightFt: number | null | undefined
): number {
  if (
    faceHeightFt == null ||
    !Number.isFinite(faceHeightFt) ||
    faceHeightFt < 0
  ) {
    return 100;
  }
  if (faceHeightFt < 1.0) return 30;
  if (faceHeightFt < 1.5) return 40;
  if (faceHeightFt < 2.0) return 55;
  if (faceHeightFt < 3.0) return 75;
  return 100;
}
