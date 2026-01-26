/**
 * Condition Checker Functions
 *
 * Functions to check if surf conditions match beach preferences:
 * - Swell direction in optimal window
 * - Wind direction and quality (offshore/onshore)
 * - Tide height in preferred range
 *
 * @module magic-hour/condition-checkers
 */

import type { WindQualityResult } from "./types";
import { circularAngleDiff } from "./direction-utils";

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
 * isSwellInWindow(315, 270, 45) // true - within 45 deg window
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
      quality: "perfect",
    };
  } else if (diff <= toleranceDeg) {
    return {
      isOffshore: true,
      quality: "acceptable",
    };
  } else if (diff <= 90) {
    return {
      isOffshore: false,
      quality: "cross",
    };
  } else {
    return {
      isOffshore: false,
      quality: "onshore",
    };
  }
}

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
