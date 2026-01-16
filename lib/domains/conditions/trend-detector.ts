/**
 * Trend Detector
 *
 * Detects trends (improving/stable/degrading) across time windows.
 * This enables scoring to prefer improving conditions and penalize degrading ones.
 *
 * Key concepts:
 * - Uses linear regression to detect trend direction
 * - Computes variance for stability assessment
 * - Combines multiple metrics into overall trend
 */

import type {
  ConditionsSnapshot,
  ConditionsWindow,
  TrendDirection,
} from './types';
import { CONDITIONS_CONSTANTS } from './types';

/**
 * Analyzes an array of condition snapshots to create a ConditionsWindow.
 *
 * @param snapshots - Array of condition snapshots (will be sorted by time)
 * @returns ConditionsWindow with trend analysis
 * @throws Error if snapshots array is empty
 */
export function analyzeConditionsWindow(
  snapshots: ConditionsSnapshot[]
): ConditionsWindow {
  if (snapshots.length === 0) {
    throw new Error('Cannot analyze empty snapshots array');
  }

  // Sort by timestamp
  const sorted = [...snapshots].sort(
    (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
  );

  const start = sorted[0].timestamp;
  const end = sorted[sorted.length - 1].timestamp;
  const durationHours =
    (end.getTime() - start.getTime()) / (1000 * 60 * 60);

  // Extract metric arrays
  const waveHeights = sorted.map((s) => s.waveHeight);
  const windSpeeds = sorted.map((s) => s.wind.speedMph);
  const tideHeights = sorted.map((s) => s.tide.heightFt);
  const confidences = sorted.map((s) => s.confidence);

  // Detect trends
  // Wave height: building is generally good (more waves)
  const waveHeightTrend = detectTrend(waveHeights, true);

  // Wind speed: decreasing is good (cleaning up)
  const windSpeedTrend = detectTrend(windSpeeds, false);

  // Tide: rising is generally good (default preference)
  // Note: actual preference depends on beach, handled by scorer
  const tideTrend = detectTrend(tideHeights, true);

  // Overall trend: majority vote
  const overallTrend = determineOverallTrend(
    waveHeightTrend,
    windSpeedTrend,
    tideTrend
  );

  // Compute variance
  const waveHeightVariance = computeStandardDeviation(waveHeights);
  const windVariance = computeStandardDeviation(windSpeeds);

  // Stability check
  const isStable =
    waveHeightVariance < CONDITIONS_CONSTANTS.STABLE_WAVE_VARIANCE_THRESHOLD &&
    windVariance < CONDITIONS_CONSTANTS.STABLE_WIND_VARIANCE_THRESHOLD;

  // Compute averages
  const avgWaveHeight = computeMean(waveHeights);
  const avgWindSpeed = computeMean(windSpeeds);
  const avgConfidence = computeMean(confidences);

  return {
    start,
    end,
    durationHours,
    snapshots: sorted,
    waveHeightTrend,
    windSpeedTrend,
    tideTrend,
    overallTrend,
    waveHeightVariance,
    windVariance,
    isStable,
    avgWaveHeight,
    avgWindSpeed,
    avgConfidence,
  };
}

/**
 * Detects trend direction from a series of values.
 * Uses linear regression slope to determine direction.
 *
 * @param values - Array of numeric values over time
 * @param higherIsBetter - If true, increasing trend is "improving"
 * @returns TrendDirection
 */
export function detectTrend(
  values: number[],
  higherIsBetter: boolean
): TrendDirection {
  if (values.length < 2) {
    return 'stable';
  }

  const slope = computeLinearRegressionSlope(values);

  // Normalize slope by value range to get percentage change
  const range = Math.max(...values) - Math.min(...values);
  const normalizedSlope = range > 0 ? slope / range : 0;

  // Check if trend is significant
  if (Math.abs(normalizedSlope) < CONDITIONS_CONSTANTS.TREND_SIGNIFICANCE_THRESHOLD) {
    return 'stable';
  }

  const isIncreasing = normalizedSlope > 0;
  return isIncreasing === higherIsBetter ? 'improving' : 'degrading';
}

/**
 * Computes linear regression slope using least squares method.
 * X values are assumed to be evenly spaced (0, 1, 2, ...).
 */
function computeLinearRegressionSlope(values: number[]): number {
  const n = values.length;
  if (n < 2) return 0;

  // For evenly spaced x values 0, 1, 2, ..., n-1:
  // sumX = n(n-1)/2
  // sumX2 = n(n-1)(2n-1)/6
  const sumX = (n * (n - 1)) / 2;
  const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6;
  const sumY = values.reduce((a, b) => a + b, 0);
  const sumXY = values.reduce((sum, y, i) => sum + i * y, 0);

  // Slope = (n*sumXY - sumX*sumY) / (n*sumX2 - sumX*sumX)
  const denominator = n * sumX2 - sumX * sumX;
  if (denominator === 0) return 0;

  return (n * sumXY - sumX * sumY) / denominator;
}

/**
 * Determines overall trend from individual metric trends.
 * Uses majority vote.
 */
function determineOverallTrend(
  waveHeightTrend: TrendDirection,
  windSpeedTrend: TrendDirection,
  tideTrend: TrendDirection
): TrendDirection {
  const trends = [waveHeightTrend, windSpeedTrend, tideTrend];

  const improvingCount = trends.filter((t) => t === 'improving').length;
  const degradingCount = trends.filter((t) => t === 'degrading').length;

  if (improvingCount > degradingCount) {
    return 'improving';
  } else if (degradingCount > improvingCount) {
    return 'degrading';
  }
  return 'stable';
}

/**
 * Computes mean (average) of an array.
 */
function computeMean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/**
 * Computes standard deviation of an array.
 */
function computeStandardDeviation(values: number[]): number {
  if (values.length < 2) return 0;

  const mean = computeMean(values);
  const squaredDiffs = values.map((v) => Math.pow(v - mean, 2));
  const variance = computeMean(squaredDiffs);

  return Math.sqrt(variance);
}

/**
 * Computes variance of an array.
 */
export function computeVariance(values: number[]): number {
  if (values.length < 2) return 0;

  const mean = computeMean(values);
  const squaredDiffs = values.map((v) => Math.pow(v - mean, 2));
  return computeMean(squaredDiffs);
}

/**
 * Checks if a window has improving conditions.
 */
export function isWindowImproving(window: ConditionsWindow): boolean {
  return window.overallTrend === 'improving';
}

/**
 * Checks if a window has degrading conditions.
 */
export function isWindowDegrading(window: ConditionsWindow): boolean {
  return window.overallTrend === 'degrading';
}

/**
 * Checks if a window has stable conditions (low variance).
 */
export function isWindowStable(window: ConditionsWindow): boolean {
  return window.isStable;
}

/**
 * Gets a human-readable description of window stability.
 */
export function describeWindowStability(window: ConditionsWindow): string {
  if (window.isStable && window.overallTrend === 'improving') {
    return 'Stable and improving conditions';
  } else if (window.isStable && window.overallTrend === 'degrading') {
    return 'Stable but degrading conditions';
  } else if (window.isStable) {
    return 'Stable, consistent conditions';
  } else if (window.overallTrend === 'improving') {
    return 'Variable but improving conditions';
  } else if (window.overallTrend === 'degrading') {
    return 'Variable and degrading conditions';
  }
  return 'Variable conditions';
}
