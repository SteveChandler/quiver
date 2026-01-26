/**
 * Interpolation Logic for Magic Hour Finder
 *
 * Provides linear and circular interpolation between 3-hour forecast blocks
 * to find exact optimal surf window times.
 *
 * CRITICAL: Guards against division by zero during slack tide periods.
 *
 * @module magic-hour/interpolation
 */

import type {
  ForecastSlot,
  BeachMetadata,
  OptimalWindow,
} from "./types";
import {
  SLACK_TIDE_THRESHOLD_FT,
  WINDOW_HALF_SIZE_MS,
} from "./constants";
import { normalizeAngle, interpolateAngle } from "./direction-utils";
import { isSwellInWindow, checkWindOffshore, isTideInRange } from "./condition-checkers";

/**
 * Calculates optimal surf window between two forecast slots using linear interpolation.
 *
 * Finds the exact peak time where tide is in optimal range by interpolating
 * between forecast blocks. Builds a +/-30 minute window around the peak.
 *
 * **CRITICAL**: Guards against division by zero during slack tide periods
 * when totalTideChange is approximately 0.
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
  if (Math.abs(totalTideChange) < SLACK_TIDE_THRESHOLD_FT) {
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
 *
 * @internal
 */
export function buildWindowResult(
  peakTime: Date,
  slotA: ForecastSlot,
  slotB: ForecastSlot,
  beach: BeachMetadata
): OptimalWindow {
  // Build +/-30 minute window around peak
  const windowStart = new Date(peakTime.getTime() - WINDOW_HALF_SIZE_MS);
  const windowEnd = new Date(peakTime.getTime() + WINDOW_HALF_SIZE_MS);

  // Interpolate conditions at peak time for quality assessment
  const ratio =
    (peakTime.getTime() - slotA.local_time.getTime()) /
    (slotB.local_time.getTime() - slotA.local_time.getTime());

  const peakTide =
    slotA.tide_height_ft + ratio * (slotB.tide_height_ft - slotA.tide_height_ft);
  const peakWindSpeed =
    slotA.wind_speed_mph + ratio * (slotB.wind_speed_mph - slotA.wind_speed_mph);

  // Use circular interpolation for directions
  const peakWindDir = interpolateAngle(
    slotA.wind_direction_deg,
    slotB.wind_direction_deg,
    ratio
  );

  const peakSwellDir = interpolateAngle(
    slotA.wave_direction_deg,
    slotB.wave_direction_deg,
    ratio
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
      : "acceptable"; // No wind preference = acceptable

  const tideInRange = isTideInRange(
    peakTide,
    beach.preferred_tide_ft_min,
    beach.preferred_tide_ft_max
  );

  // Calculate confidence based on condition quality
  let confidence = 0;
  if (swellMatch) confidence += 0.3;
  if (windQuality === "perfect") confidence += 0.4;
  else if (windQuality === "acceptable") confidence += 0.2;
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
 * Formats time as "8:30 AM" or "9:00 AM".
 */
export function formatTime(date: Date): string {
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}
