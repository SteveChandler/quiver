/**
 * Magic Hour Finder Service
 *
 * Interpolates between 3-hour forecast blocks to find the exact optimal surf window
 * ("Magic Hour") based on multi-metric weighted scoring (tide, wind, swell).
 *
 * This service enables sophisticated surf condition analysis by:
 * - Using circular direction math for accurate wind/swell analysis at 0°/360° boundary
 * - Linear interpolation to find exact peak conditions between forecast slots
 * - Multi-metric weighted scoring (tide 40%, wind 35%, swell 25%)
 * - Guard against division by zero during slack tide periods
 *
 * @module lib/services/magic-hour-finder
 */

import { getLocalHour } from "@/lib/utils/timezone-utils";

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Forecast slot representing a single 3-hour forecast block.
 * Extracted from EnhancedForecastEntity for interpolation.
 */
export interface ForecastSlot {
  forecast_date: string;
  forecast_time: string;
  local_time: Date;
  tide_height_ft: number;
  wind_speed_mph: number;
  wind_direction_deg: number;
  wave_height_ft: number;
  wave_period_s: number;
  wave_direction_deg: number;
}

/**
 * Beach metadata with surf condition preferences.
 * Subset of beach table columns used for optimal window calculation.
 */
export interface BeachMetadata {
  id: string;
  name: string;
  slug: string;
  skill_level: string | null;
  swell_window_center_deg: number | null;
  swell_window_halfwidth_deg: number | null;
  wind_offshore_deg: number | null;
  wind_offshore_tol_deg: number | null;
  preferred_tide_ft_min: number | null;
  preferred_tide_ft_max: number | null;
  /** IANA timezone identifier for the beach location */
  timezone?: string;
}

/**
 * Enhanced forecast entity from database.
 * Matches EnhancedForecastEntity interface from types/forecast.ts
 */
export interface EnhancedForecastEntity {
  id: string;
  beach_id: string;
  forecast_date: string;
  forecast_time: string;
  wave_height: string | null;
  wave_period?: string | null;
  wave_direction?: string | null;
  wind_direction_deg?: number | null;
  wind_speed?: string | null;
  tide_height?: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Result of Magic Hour calculation.
 */
export interface MagicHourResult {
  found: boolean;
  peakTime: Date | null;
  windowStart: string | null; // "8:30 AM"
  windowEnd: string | null; // "9:30 AM"
  confidence: number; // 0-1
  swellMatch: boolean;
  windQuality: 'perfect' | 'acceptable' | 'cross' | 'onshore' | null;
  tideInRange: boolean;
}

/**
 * Optimal window found between two forecast slots.
 */
export interface OptimalWindow {
  peakTime: Date;
  windowStart: string;
  windowEnd: string;
  confidence: number;
  swellMatch: boolean;
  windQuality: 'perfect' | 'acceptable' | 'cross' | 'onshore';
  tideInRange: boolean;
}

/**
 * Weight configuration for multi-metric scoring.
 */
export interface WeightConfig {
  tide: number; // default 0.4
  wind: number; // default 0.35
  swell: number; // default 0.25
}

/**
 * Wind quality assessment result.
 */
export interface WindQualityResult {
  isOffshore: boolean;
  quality: 'perfect' | 'acceptable' | 'cross' | 'onshore';
}

// ============================================================================
// Circular Direction Math (CRITICAL)
// ============================================================================

/**
 * Calculates the circular angular difference between two directions.
 *
 * Standard subtraction FAILS at 0°/360° boundary. This formula correctly
 * handles the circular nature of compass directions.
 *
 * @param angle1 - First angle in degrees (0-360)
 * @param angle2 - Second angle in degrees (0-360)
 * @returns Absolute angular difference (0-180)
 *
 * @example
 * circularAngleDiff(350, 10) // Returns 20 (not 340!)
 * circularAngleDiff(10, 350) // Returns 20
 * circularAngleDiff(90, 270) // Returns 180
 */
export function circularAngleDiff(angle1: number, angle2: number): number {
  const diff = Math.abs(angle1 - angle2);
  return diff > 180 ? 360 - diff : diff;
}

// ============================================================================
// Swell Window Analysis
// ============================================================================

/**
 * Checks if swell direction is within beach's optimal swell window.
 *
 * Uses circular direction math to correctly handle boundary cases.
 *
 * @param swellDir - Swell direction in degrees (0-360)
 * @param centerDeg - Center of optimal swell window (0-360)
 * @param halfwidthDeg - Half-width of acceptable window in degrees
 * @returns True if swell is in optimal window
 *
 * @example
 * isSwellInWindow(270, 270, 45) // true - exact match
 * isSwellInWindow(315, 270, 45) // true - within 45° window
 * isSwellInWindow(10, 350, 30) // true - handles boundary
 * isSwellInWindow(180, 270, 45) // false - outside window
 */
export function isSwellInWindow(
  swellDir: number,
  centerDeg: number,
  halfwidthDeg: number
): boolean {
  const diff = circularAngleDiff(swellDir, centerDeg);
  return diff <= halfwidthDeg;
}

// ============================================================================
// Wind Quality Analysis
// ============================================================================

/**
 * Checks if wind is offshore and assesses quality for surfing.
 *
 * Wind quality categories:
 * - perfect: Directly offshore within tolerance
 * - acceptable: Offshore but not ideal direction
 * - cross: Cross-shore (light winds still rideable)
 * - onshore: Onshore (poor surf conditions)
 *
 * @param windDir - Wind direction in degrees (0-360)
 * @param offshoreDeg - Ideal offshore wind direction (0-360)
 * @param toleranceDeg - Acceptable deviation from ideal (degrees)
 * @returns Wind quality assessment
 *
 * @example
 * checkWindOffshore(90, 90, 20)
 * // { isOffshore: true, quality: 'perfect' }
 *
 * checkWindOffshore(110, 90, 20)
 * // { isOffshore: true, quality: 'acceptable' }
 *
 * checkWindOffshore(270, 90, 20)
 * // { isOffshore: false, quality: 'onshore' }
 */
export function checkWindOffshore(
  windDir: number,
  offshoreDeg: number,
  toleranceDeg: number
): WindQualityResult {
  const diff = circularAngleDiff(windDir, offshoreDeg);

  if (diff <= toleranceDeg / 2) {
    return {
      isOffshore: true,
      quality: 'perfect',
    };
  } else if (diff <= toleranceDeg) {
    return {
      isOffshore: true,
      quality: 'acceptable',
    };
  } else if (diff <= 90) {
    return {
      isOffshore: false,
      quality: 'cross',
    };
  } else {
    return {
      isOffshore: false,
      quality: 'onshore',
    };
  }
}

// ============================================================================
// Tide Range Check
// ============================================================================

/**
 * Checks if tide height is within beach's preferred range.
 *
 * @param tideHeight - Current tide height in feet
 * @param minTide - Minimum preferred tide (null = no minimum)
 * @param maxTide - Maximum preferred tide (null = no maximum)
 * @returns True if tide is in acceptable range
 */
export function isTideInRange(
  tideHeight: number,
  minTide: number | null,
  maxTide: number | null
): boolean {
  if (minTide !== null && tideHeight < minTide) return false;
  if (maxTide !== null && tideHeight > maxTide) return false;
  return true;
}

// ============================================================================
// Optimal Window Calculation (Linear Interpolation)
// ============================================================================

/**
 * Calculates optimal surf window between two forecast slots using linear interpolation.
 *
 * Finds the exact peak time where tide is in optimal range by interpolating
 * between forecast blocks. Builds a ±30 minute window around the peak.
 *
 * **CRITICAL**: Guards against division by zero during slack tide periods
 * when totalTideChange ≈ 0.
 *
 * @param slotA - Earlier forecast slot
 * @param slotB - Later forecast slot
 * @param beach - Beach metadata with preferences
 * @returns Optimal window with peak time, or null if no optimal window found
 *
 * @example
 * const window = calculateOptimalWindow(
 *   { local_time: new Date('2025-01-07T09:00:00'), tide_height_ft: 2.0, ... },
 *   { local_time: new Date('2025-01-07T12:00:00'), tide_height_ft: 4.5, ... },
 *   { preferred_tide_ft_min: 3.0, preferred_tide_ft_max: 4.0, ... }
 * );
 * // { peakTime: Date('2025-01-07T10:24:00'), windowStart: '9:54 AM', windowEnd: '10:54 AM' }
 */
export function calculateOptimalWindow(
  slotA: ForecastSlot,
  slotB: ForecastSlot,
  beach: BeachMetadata
): OptimalWindow | null {
  const { preferred_tide_ft_min, preferred_tide_ft_max } = beach;

  // If no tide preferences, return null (no optimal window to calculate)
  if (preferred_tide_ft_min === null && preferred_tide_ft_max === null) {
    return null;
  }

  const targetTide =
    preferred_tide_ft_min !== null && preferred_tide_ft_max !== null
      ? (preferred_tide_ft_min + preferred_tide_ft_max) / 2
      : preferred_tide_ft_min ?? preferred_tide_ft_max ?? 0;

  const tideA = slotA.tide_height_ft;
  const tideB = slotB.tide_height_ft;
  const totalTideChange = tideB - tideA;

  // CRITICAL: Guard against division by zero during slack tide
  if (Math.abs(totalTideChange) < 0.01) {
    // Tide is basically flat - use middle of time window
    const timeA = slotA.local_time.getTime();
    const timeB = slotB.local_time.getTime();
    const midTime = new Date((timeA + timeB) / 2);

    return buildWindowResult(midTime, slotA, slotB, beach);
  }

  // Calculate interpolation ratio (0-1)
  const tideRatio = (targetTide - tideA) / totalTideChange;

  // Clamp ratio to [0, 1] to stay within slot bounds
  const clampedRatio = Math.max(0, Math.min(1, tideRatio));

  // Linear interpolation for time
  const timeA = slotA.local_time.getTime();
  const timeB = slotB.local_time.getTime();
  const peakTime = new Date(timeA + clampedRatio * (timeB - timeA));

  return buildWindowResult(peakTime, slotA, slotB, beach);
}

/**
 * Helper to build OptimalWindow result with formatted times.
 */
function buildWindowResult(
  peakTime: Date,
  slotA: ForecastSlot,
  slotB: ForecastSlot,
  beach: BeachMetadata
): OptimalWindow {
  // Build ±30 minute window around peak
  const windowStart = new Date(peakTime.getTime() - 30 * 60 * 1000);
  const windowEnd = new Date(peakTime.getTime() + 30 * 60 * 1000);

  // Interpolate conditions at peak time for quality assessment
  const ratio =
    (peakTime.getTime() - slotA.local_time.getTime()) /
    (slotB.local_time.getTime() - slotA.local_time.getTime());

  const peakTide =
    slotA.tide_height_ft + ratio * (slotB.tide_height_ft - slotA.tide_height_ft);
  const peakWindSpeed =
    slotA.wind_speed_mph + ratio * (slotB.wind_speed_mph - slotA.wind_speed_mph);

  // Use circular interpolation for directions (simple averaging for now)
  const peakWindDir =
    Math.abs(slotB.wind_direction_deg - slotA.wind_direction_deg) <= 180
      ? slotA.wind_direction_deg +
        ratio * (slotB.wind_direction_deg - slotA.wind_direction_deg)
      : normalizeAngle(
          slotA.wind_direction_deg +
            ratio * normalizeAngle(slotB.wind_direction_deg - slotA.wind_direction_deg)
        );

  const peakSwellDir =
    Math.abs(slotB.wave_direction_deg - slotA.wave_direction_deg) <= 180
      ? slotA.wave_direction_deg +
        ratio * (slotB.wave_direction_deg - slotA.wave_direction_deg)
      : normalizeAngle(
          slotA.wave_direction_deg +
            ratio * normalizeAngle(slotB.wave_direction_deg - slotA.wave_direction_deg)
        );

  // Assess conditions
  const swellMatch =
    beach.swell_window_center_deg !== null && beach.swell_window_halfwidth_deg !== null
      ? isSwellInWindow(
          peakSwellDir,
          beach.swell_window_center_deg,
          beach.swell_window_halfwidth_deg
        )
      : true; // No swell preference = always match

  const windQuality =
    beach.wind_offshore_deg !== null && beach.wind_offshore_tol_deg !== null
      ? checkWindOffshore(peakWindDir, beach.wind_offshore_deg, beach.wind_offshore_tol_deg)
          .quality
      : 'acceptable'; // No wind preference = acceptable

  const tideInRange = isTideInRange(
    peakTide,
    beach.preferred_tide_ft_min,
    beach.preferred_tide_ft_max
  );

  // Calculate confidence based on condition quality
  let confidence = 0;
  if (swellMatch) confidence += 0.3;
  if (windQuality === 'perfect') confidence += 0.4;
  else if (windQuality === 'acceptable') confidence += 0.2;
  if (tideInRange) confidence += 0.3;

  return {
    peakTime,
    windowStart: formatTime(windowStart),
    windowEnd: formatTime(windowEnd),
    confidence,
    swellMatch,
    windQuality,
    tideInRange,
  };
}

/**
 * Normalizes angle to 0-360 range.
 */
function normalizeAngle(angle: number): number {
  return ((angle % 360) + 360) % 360;
}

/**
 * Formats time as "8:30 AM" or "9:00 AM".
 */
function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

// ============================================================================
// Multi-Metric Weighted Scoring
// ============================================================================

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
  weights: WeightConfig = { tide: 0.4, wind: 0.35, swell: 0.25 }
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
  const windowStart = new Date(peakTime.getTime() - 30 * 60 * 1000);
  const windowEnd = new Date(peakTime.getTime() + 30 * 60 * 1000);

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
      : 'acceptable';

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

// ============================================================================
// Main Entry Point
// ============================================================================

/**
 * Finds the "Magic Hour" - optimal surf window for a beach within forecast period.
 *
 * This is the main entry point that orchestrates:
 * 1. Forecast slot conversion from EnhancedForecastEntity
 * 2. Time window filtering (next 48 hours by default)
 * 3. Multi-metric weighted peak finding
 * 4. Optional interpolation for exact peak time
 *
 * @param forecasts - Array of enhanced forecast entities
 * @param beach - Beach metadata with surf preferences
 * @param options - Optional configuration (weights, target date)
 * @returns Magic Hour result with peak time and quality assessment
 *
 * @example
 * const result = findMagicHour(forecasts, beach);
 * if (result.found) {
 *   console.log(`Magic Hour: ${result.windowStart} - ${result.windowEnd}`);
 *   console.log(`Confidence: ${Math.round(result.confidence * 100)}%`);
 *   console.log(`Swell match: ${result.swellMatch}`);
 *   console.log(`Wind quality: ${result.windQuality}`);
 * } else {
 *   console.log('No optimal surf window found');
 * }
 */
export function findMagicHour(
  forecasts: EnhancedForecastEntity[],
  beach: BeachMetadata,
  options: { weights?: WeightConfig; targetDate?: Date } = {}
): MagicHourResult {
  // Convert to forecast slots
  const slots = convertToSlots(forecasts);

  if (slots.length === 0) {
    return nullResult();
  }

  // Filter to next 48 hours (or target date window)
  const now = options.targetDate ?? new Date();
  const windowEnd = new Date(now.getTime() + 48 * 60 * 60 * 1000);

  const windowedSlots = slots.filter(
    (slot) => slot.local_time >= now && slot.local_time <= windowEnd
  );

  if (windowedSlots.length === 0) {
    return nullResult();
  }

  // Filter to daylight hours only (6 AM - 8 PM) in the beach's local timezone
  // Peak surf times should only be during reasonable daylight hours
  const beachTimezone = beach.timezone || "America/Los_Angeles";
  const daylightSlots = windowedSlots.filter((slot) => {
    // Use timezone-aware hour conversion for accurate daylight filtering
    const localHour = getLocalHour(slot.local_time, beachTimezone);
    return localHour >= 6 && localHour < 20;
  });

  // If no daylight slots available, fall back to windowed slots
  // but this shouldn't happen in normal conditions
  const slotsToEvaluate = daylightSlots.length > 0 ? daylightSlots : windowedSlots;

  // Find weighted peak from daylight-filtered slots
  const peak = findWeightedPeak(slotsToEvaluate, beach, options.weights);

  if (!peak) {
    return nullResult();
  }

  return {
    found: true,
    peakTime: peak.peakTime,
    windowStart: peak.windowStart,
    windowEnd: peak.windowEnd,
    confidence: peak.confidence,
    swellMatch: peak.swellMatch,
    windQuality: peak.windQuality,
    tideInRange: peak.tideInRange,
  };
}

/**
 * Converts EnhancedForecastEntity array to ForecastSlot array.
 */
function convertToSlots(forecasts: EnhancedForecastEntity[]): ForecastSlot[] {
  return forecasts
    .map((f) => {
      try {
        return {
          forecast_date: f.forecast_date,
          forecast_time: f.forecast_time,
          // Forecast timestamps are stored in UTC (same convention as discovery service).
          // Parse explicitly as UTC to avoid local-machine timezone drift (e.g. +8h in PST vs UTC).
          local_time: new Date(`${f.forecast_date}T${f.forecast_time}Z`),
          tide_height_ft: parseFloat(f.tide_height ?? '0'),
          wind_speed_mph: parseFloat(f.wind_speed ?? '0'),
          wind_direction_deg: f.wind_direction_deg ?? 0,
          wave_height_ft: parseFloat(f.wave_height ?? '0'),
          wave_period_s: parseFloat(f.wave_period ?? '0'),
          wave_direction_deg: parseWindDirection(f.wave_direction ?? 'N'),
        };
      } catch (error) {
        console.warn('Failed to convert forecast to slot:', error);
        return null;
      }
    })
    .filter((slot): slot is ForecastSlot => slot !== null);
}

/**
 * Parses cardinal direction to degrees.
 */
function parseWindDirection(dir: string): number {
  const dirMap: Record<string, number> = {
    N: 0,
    NNE: 22.5,
    NE: 45,
    ENE: 67.5,
    E: 90,
    ESE: 112.5,
    SE: 135,
    SSE: 157.5,
    S: 180,
    SSW: 202.5,
    SW: 225,
    WSW: 247.5,
    W: 270,
    WNW: 292.5,
    NW: 315,
    NNW: 337.5,
  };

  return dirMap[dir.toUpperCase()] ?? 0;
}

/**
 * Returns null result when no Magic Hour is found.
 */
function nullResult(): MagicHourResult {
  return {
    found: false,
    peakTime: null,
    windowStart: null,
    windowEnd: null,
    confidence: 0,
    swellMatch: false,
    windQuality: null,
    tideInRange: false,
  };
}
