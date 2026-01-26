/**
 * Multi-Metric Weighted Scoring for Magic Hour Finder
 *
 * Scores forecast slots based on:
 * - Tide match (40% weight): How close tide is to preferred range
 * - Wind quality (35% weight): Offshore > cross-shore > onshore
 * - Swell match (25% weight): Within optimal swell window
 *
 * @module magic-hour/scoring
 */

import type {
  ForecastSlot,
  BeachMetadata,
  OptimalWindow,
  WeightConfig,
} from "./types";
import { DEFAULT_WEIGHTS, WINDOW_HALF_SIZE_MS } from "./constants";
import { circularAngleDiff } from "./direction-utils";
import { isSwellInWindow, checkWindOffshore, isTideInRange } from "./condition-checkers";
import { formatTime } from "./interpolation";

/**
 * Finds the weighted peak across all forecast slots using multi-metric scoring.
 *
 * Scores each slot based on:
 * - Tide match (40% weight): How close tide is to preferred range
 * - Wind quality (35% weight): Offshore > cross-shore > onshore
 * - Swell match (25% weight): Within optimal swell window
 *
 * @param slots - Array of forecast slots to evaluate
 * @param beach - Beach metadata with preferences
 * @param weights - Optional custom weights (defaults: tide 40%, wind 35%, swell 25%)
 * @returns Best optimal window found, or null result if none
 *
 * @example
 * const peak = findWeightedPeak(slots, beach);
 * if (peak.found) {
 *   console.log(`Best surf at ${peak.peakTime}`);
 *   console.log(`Window: ${peak.windowStart} - ${peak.windowEnd}`);
 * }
 */
export function findWeightedPeak(
  slots: ForecastSlot[],
  beach: BeachMetadata,
  weights: WeightConfig = DEFAULT_WEIGHTS
): OptimalWindow | null {
  if (slots.length === 0) return null;

  let bestSlot: ForecastSlot | null = null;
  let bestScore = -Infinity;

  for (const slot of slots) {
    let score = 0;

    // Tide score (0-1)
    const tideScore = calculateTideScore(
      slot.tide_height_ft,
      beach.preferred_tide_ft_min,
      beach.preferred_tide_ft_max
    );
    score += tideScore * weights.tide;

    // Wind score (0-1)
    const windScore = calculateWindScore(
      slot.wind_direction_deg,
      beach.wind_offshore_deg,
      beach.wind_offshore_tol_deg
    );
    score += windScore * weights.wind;

    // Swell score (0-1)
    const swellScore = calculateSwellScore(
      slot.wave_direction_deg,
      beach.swell_window_center_deg,
      beach.swell_window_halfwidth_deg
    );
    score += swellScore * weights.swell;

    if (score > bestScore) {
      bestScore = score;
      bestSlot = slot;
    }
  }

  if (!bestSlot) return null;

  // Build optimal window around best slot
  const peakTime = bestSlot.local_time;
  const windowStart = new Date(peakTime.getTime() - WINDOW_HALF_SIZE_MS);
  const windowEnd = new Date(peakTime.getTime() + WINDOW_HALF_SIZE_MS);

  const swellMatch =
    beach.swell_window_center_deg !== null && beach.swell_window_halfwidth_deg !== null
      ? isSwellInWindow(
          bestSlot.wave_direction_deg,
          beach.swell_window_center_deg,
          beach.swell_window_halfwidth_deg
        )
      : true;

  const windQuality =
    beach.wind_offshore_deg !== null && beach.wind_offshore_tol_deg !== null
      ? checkWindOffshore(
          bestSlot.wind_direction_deg,
          beach.wind_offshore_deg,
          beach.wind_offshore_tol_deg
        ).quality
      : "acceptable";

  const tideInRange = isTideInRange(
    bestSlot.tide_height_ft,
    beach.preferred_tide_ft_min,
    beach.preferred_tide_ft_max
  );

  return {
    peakTime,
    windowStart: formatTime(windowStart),
    windowEnd: formatTime(windowEnd),
    confidence: bestScore, // Normalized 0-1 score
    swellMatch,
    windQuality,
    tideInRange,
  };
}

/**
 * Calculates tide score (0-1) based on proximity to preferred range.
 * @internal Exported for testing
 */
export function calculateTideScore(
  tideHeight: number,
  minTide: number | null,
  maxTide: number | null
): number {
  if (minTide === null && maxTide === null) return 1; // No preference = perfect

  const targetTide =
    minTide !== null && maxTide !== null
      ? (minTide + maxTide) / 2
      : minTide ?? maxTide ?? 0;

  const range = maxTide !== null && minTide !== null ? (maxTide - minTide) / 2 : 2; // Default 2ft tolerance

  const diff = Math.abs(tideHeight - targetTide);
  return Math.max(0, 1 - diff / range);
}

/**
 * Calculates wind score (0-1) based on offshore quality.
 * @internal Exported for testing
 */
export function calculateWindScore(
  windDir: number,
  offshoreDeg: number | null,
  toleranceDeg: number | null
): number {
  if (offshoreDeg === null || toleranceDeg === null) return 0.7; // No preference = acceptable

  const diff = circularAngleDiff(windDir, offshoreDeg);

  if (diff <= toleranceDeg) return 1; // Perfect offshore
  if (diff <= toleranceDeg * 2) return 0.7; // Acceptable offshore
  if (diff <= 90) return 0.4; // Cross-shore
  return 0.1; // Onshore
}

/**
 * Calculates swell score (0-1) based on window match.
 * @internal Exported for testing
 */
export function calculateSwellScore(
  swellDir: number,
  centerDeg: number | null,
  halfwidthDeg: number | null
): number {
  if (centerDeg === null || halfwidthDeg === null) return 1; // No preference = perfect

  const diff = circularAngleDiff(swellDir, centerDeg);

  if (diff <= halfwidthDeg) return 1; // Perfect match
  if (diff <= halfwidthDeg * 1.5) return 0.6; // Close
  return 0.2; // Outside window
}
