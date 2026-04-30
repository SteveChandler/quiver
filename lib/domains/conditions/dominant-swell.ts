/**
 * Dominant swell partition picker.
 *
 * Single source of truth for "which of the three NOAA partitions
 * (swell_1 / swell_2 / wind_wave) defines the surf right now?"
 *
 * Selection rule: tallest height wins; on ties (within 20% of max
 * height) the longer-period component wins, since surfers feel longer
 * periods more strongly even at similar heights.
 *
 * Both `lib/services/forecast/forecast-builder.ts` (which writes
 * `wave_period` / `wave_direction` to `enhanced_forecasts`) and
 * `lib/domains/scoring/discovery-adapter.ts` (which builds the
 * scoring snapshot) consume this helper so the dominant identity
 * stays consistent across the pipeline.
 */

export interface SwellPartition {
  readonly height: number;
  readonly period: number;
  readonly direction: number;
}

export type DominantSource = 'swell_1' | 'swell_2' | 'wind_wave';

export interface DominantSwell extends SwellPartition {
  readonly source: DominantSource;
}

export interface SwellPartitions {
  readonly swell_1: SwellPartition | null;
  readonly swell_2: SwellPartition | null;
  readonly wind_wave: SwellPartition | null;
}

/** Within this fraction of max height, longer period wins the tiebreak. */
const HEIGHT_TIEBREAK_FRACTION = 0.8;

function isMaterial(p: SwellPartition | null): p is SwellPartition {
  return p != null && p.height > 0 && p.period > 0;
}

/**
 * Pick the dominant partition from a set of swell components.
 * Returns `null` when no partition has a positive height + period.
 */
export function pickDominantSwell(parts: SwellPartitions): DominantSwell | null {
  const candidates: DominantSwell[] = [];

  if (isMaterial(parts.swell_1)) candidates.push({ ...parts.swell_1, source: 'swell_1' });
  if (isMaterial(parts.swell_2)) candidates.push({ ...parts.swell_2, source: 'swell_2' });
  if (isMaterial(parts.wind_wave)) candidates.push({ ...parts.wind_wave, source: 'wind_wave' });

  if (candidates.length === 0) return null;

  const maxHeight = Math.max(...candidates.map((c) => c.height));
  const sorted = candidates
    .filter((c) => c.height >= maxHeight * HEIGHT_TIEBREAK_FRACTION)
    .sort((a, b) => b.period - a.period);

  return sorted[0];
}

/**
 * Pick the next-most-energetic partition after the dominant.
 * Energy = height² × period, matching `createSwellComponent`.
 * Returns `null` when only one material partition exists.
 */
export function pickSecondarySwell(parts: SwellPartitions, dominant: DominantSource): DominantSwell | null {
  const others: DominantSwell[] = [];

  if (dominant !== 'swell_1' && isMaterial(parts.swell_1)) others.push({ ...parts.swell_1, source: 'swell_1' });
  if (dominant !== 'swell_2' && isMaterial(parts.swell_2)) others.push({ ...parts.swell_2, source: 'swell_2' });
  if (dominant !== 'wind_wave' && isMaterial(parts.wind_wave)) others.push({ ...parts.wind_wave, source: 'wind_wave' });

  if (others.length === 0) return null;

  return others.sort((a, b) => (b.height * b.height * b.period) - (a.height * a.height * a.period))[0];
}
