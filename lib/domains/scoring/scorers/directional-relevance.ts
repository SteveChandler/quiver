/**
 * Directional relevance multiplier for direction-only scorers.
 *
 * Direction-only scorers (`swellAlignment`, `swellInterference`) measure
 * geometry — does the swell hit the beach at a workable angle, do swells
 * cross? Geometry is meaningless when the dominant wave train carries no
 * usable energy: a 6s W "in the swell window" is wind chop, regardless of
 * how perfectly it lines up with the break.
 *
 * Apply this multiplier to those scorers' geometric scores so a short-period
 * dominant train can no longer carry the composite into the "good" band on
 * direction alignment alone.
 *
 * Curve (monotonic — stronger period never lowers the multiplier):
 * - missing/invalid period → 1.0  (preserve existing behavior)
 * - <  6s                  → 0.30
 * - 6 → 8s                 → 0.30 → 0.65 ramp
 * - 8 → 10s                → 0.65 → 1.00 ramp
 * - ≥ 10s                  → 1.00  (groundswell, full credit)
 *
 * `dominantKind` is reserved for future tightening (e.g. extra attenuation
 * when the dominant component is wind_wave even at 8–9s). Defaults to
 * treating swell and wind_wave the same.
 */

const SHORT_PERIOD_FLOOR = 0.30;
const SHORT_PERIOD_CEIL_AT_8S = 0.65;
const FULL_CREDIT_PERIOD_S = 10;
const SHORT_PERIOD_CUTOFF_S = 6;
const MID_PERIOD_BOUNDARY_S = 8;

export type DominantKind = 'swell' | 'windWave';

export function getDirectionalRelevance(
  periodS: number | null | undefined,
  _dominantKind: DominantKind = 'swell'
): number {
  if (periodS == null || !Number.isFinite(periodS) || periodS <= 0) return 1;
  if (periodS >= FULL_CREDIT_PERIOD_S) return 1;

  if (periodS >= MID_PERIOD_BOUNDARY_S) {
    const t = (periodS - MID_PERIOD_BOUNDARY_S) / (FULL_CREDIT_PERIOD_S - MID_PERIOD_BOUNDARY_S);
    return SHORT_PERIOD_CEIL_AT_8S + t * (1 - SHORT_PERIOD_CEIL_AT_8S);
  }

  if (periodS >= SHORT_PERIOD_CUTOFF_S) {
    const t = (periodS - SHORT_PERIOD_CUTOFF_S) / (MID_PERIOD_BOUNDARY_S - SHORT_PERIOD_CUTOFF_S);
    return SHORT_PERIOD_FLOOR + t * (SHORT_PERIOD_CEIL_AT_8S - SHORT_PERIOD_FLOOR);
  }

  return SHORT_PERIOD_FLOOR;
}
