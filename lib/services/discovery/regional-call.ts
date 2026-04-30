/**
 * Regional Call Generation
 *
 * Produces a one-line regional conditions synthesis from ranked recommendations.
 * Deterministic template — no LLM.
 *
 * Template: "{swell} {aspect} · {wind_trend}"
 *
 * @module lib/services/discovery/regional-call
 */

import type { SurfDiscoveryRecommendation } from '@/types/personalization';

// ============================================================================
// Options
// ============================================================================

export interface WindSnapshot {
  speed: string;
  direction: string;
}

export interface RegionalCallOptions {
  dawnWind?: WindSnapshot;
  middayWind?: WindSnapshot;
}

// ============================================================================
// Helpers
// ============================================================================

/** Most frequent string in an array. Returns undefined when array is empty. */
function mode(arr: string[]): string | undefined {
  if (arr.length === 0) return undefined;
  const counts = new Map<string, number>();
  for (const val of arr) {
    counts.set(val, (counts.get(val) ?? 0) + 1);
  }
  let best: string | undefined;
  let bestCount = 0;
  for (const [val, count] of counts) {
    if (count > bestCount) {
      best = val;
      bestCount = count;
    }
  }
  return best;
}

/** Median of a numeric array. Returns undefined when array is empty. */
function median(arr: number[]): number | undefined {
  if (arr.length === 0) return undefined;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

/**
 * Circular mean of compass degrees.
 * Returns a value in [0, 360).
 */
function circularMean(degrees: number[]): number {
  if (degrees.length === 0) return 0;
  const rad = Math.PI / 180;
  const sinSum = degrees.reduce((s, d) => s + Math.sin(d * rad), 0);
  const cosSum = degrees.reduce((s, d) => s + Math.cos(d * rad), 0);
  const mean = Math.atan2(sinSum, cosSum) / rad;
  return (mean + 360) % 360;
}

/**
 * Converts compass degrees (0=N, 90=E, 180=S, 270=W) to a cardinal direction name.
 * Returns the facing direction for a beach (e.g. aspect_deg 180 → "south-facing").
 */
function aspectToFacing(deg: number): string {
  const normalized = ((deg % 360) + 360) % 360;
  if (normalized >= 337.5 || normalized < 22.5) return 'north';
  if (normalized < 67.5) return 'northeast';
  if (normalized < 112.5) return 'east';
  if (normalized < 157.5) return 'southeast';
  if (normalized < 202.5) return 'south';
  if (normalized < 247.5) return 'southwest';
  if (normalized < 292.5) return 'west';
  return 'northwest';
}

/** True if speed string starts with "0" (e.g. "0 mph", "0"). */
function isCalm(speed: string): boolean {
  return speed.trimStart().startsWith('0');
}

/** Extracts the leading number from a speed string (e.g. "10 mph" → 10). */
function parseSpeed(speed: string): number {
  const match = speed.match(/\d+(\.\d+)?/);
  return match ? parseFloat(match[0]) : 0;
}

// ============================================================================
// Swell clause
// ============================================================================

function buildSwellClause(recs: SurfDiscoveryRecommendation[]): string | null {
  const top5 = recs.slice(0, 5);
  // Prefer wave_direction / wave_period — already the dominant partition per
  // forecast-builder. swell_1_* is the legacy fallback for rows that predate
  // the dominant-write path. Reading raw swell_1 here would surface a
  // background SSW groundswell direction in the regional call while scoring
  // (and the per-beach displayed swell description) used the dominant 6s W.
  const directions = top5
    .map(r => r.forecast.wave_direction ?? r.forecast.swell_1_direction)
    .filter((d): d is string => d !== null && d !== undefined && d.trim() !== '');

  if (directions.length === 0) return null;

  const dominantDir = mode(directions);
  if (!dominantDir) return null;

  // Anchor period to the top rec so a reshuffle of the remaining top-5
  // (which can happen between refreshes as scores oscillate by fractions)
  // does not flicker the displayed period between 10s / 11s / 12s. If the
  // top rec has no period, fall back to the median of what we do have so
  // we never silently drop the number.
  const topPeriodRaw = top5[0]?.forecast.wave_period ?? top5[0]?.forecast.swell_1_period;
  const topPeriod = typeof topPeriodRaw === 'string' && topPeriodRaw.trim() !== ''
    ? parseFloat(topPeriodRaw)
    : NaN;

  let period: number | undefined;
  if (!isNaN(topPeriod) && topPeriod > 0) {
    period = topPeriod;
  } else {
    const periods = top5
      .map(r => r.forecast.wave_period ?? r.forecast.swell_1_period)
      .filter((p): p is string => p !== null && p !== undefined && p.trim() !== '')
      .map(p => parseFloat(p))
      .filter(p => !isNaN(p) && p > 0);
    period = median(periods);
  }

  if (period === undefined) return dominantDir;

  return `${dominantDir} ${Math.round(period)}s`;
}

// ============================================================================
// Aspect clause
// ============================================================================

function buildAspectClause(recs: SurfDiscoveryRecommendation[]): string | null {
  const top5 = recs.slice(0, 5);
  const aspects = top5
    .map(r => r.beach.aspect_deg)
    .filter((d): d is number => typeof d === 'number' && !isNaN(d));

  if (aspects.length === 0) return null;

  // Check if aspects cluster within 45°
  const mean = circularMean(aspects);
  const allClose = aspects.every(a => {
    const diff = Math.abs(((a - mean + 540) % 360) - 180);
    return diff <= 22.5; // ±22.5° from mean = 45° window
  });

  if (!allClose) return null;

  return `${aspectToFacing(mean)}-facing`;
}

// ============================================================================
// Wind trend clause
// ============================================================================

function buildWindTrendClause(options: RegionalCallOptions): string | null {
  const { dawnWind, middayWind } = options;

  if (!dawnWind && !middayWind) return null;

  const dawnCalm = dawnWind ? isCalm(dawnWind.speed) : false;
  const middayCalm = middayWind ? isCalm(middayWind.speed) : false;

  // Glassy at dawn, onshore by midday
  if (dawnWind && middayWind && dawnCalm && !middayCalm) {
    return `Glassy at dawn, onshore by midday`;
  }

  // Both calm
  if (dawnCalm && middayCalm) return 'Light winds';
  if (!dawnWind && middayCalm) return 'Light winds';
  if (!middayWind && dawnCalm) return 'Light winds';

  // Dawn wind present but no midday to compare
  if (dawnWind && !middayWind) {
    return dawnCalm ? 'Light winds' : null;
  }

  // Midday wind only
  if (!dawnWind && middayWind) {
    return middayCalm ? 'Light winds' : null;
  }

  // Both present, neither calm — no notable trend to report
  return null;
}

// ============================================================================
// Main export
// ============================================================================

/**
 * Generates a one-line regional conditions synthesis from ranked recommendations.
 *
 * Returns a non-empty string always — falls back to "Small surf, pick your spot for fun."
 */
export function generateRegionalCall(
  recs: SurfDiscoveryRecommendation[],
  options: RegionalCallOptions = {},
): string {
  const swellClause = buildSwellClause(recs);
  const aspectClause = buildAspectClause(recs);
  const windTrendClause = buildWindTrendClause(options);

  // Prepend "hits " to the aspect clause only when there's no wind trend
  // clause to append. With a wind trend the "·"-joined result becomes three
  // segments ("<swell> · <aspect> · <wind>"), and the extra verb in the
  // middle segment reads busy. Keeping the aspect segment as just
  // "<dir>-facing" keeps the three-segment read scannable.
  const decoratedAspect =
    aspectClause && !windTrendClause ? `hits ${aspectClause}` : aspectClause;

  const parts: string[] = [];
  if (swellClause) parts.push(swellClause);
  if (decoratedAspect) parts.push(decoratedAspect);
  if (windTrendClause) parts.push(windTrendClause);

  if (parts.length === 0) return 'Small surf, pick your spot for fun.';

  return parts.join(' · ');
}
