/**
 * Circular Direction Math Utilities
 *
 * CRITICAL: These functions handle the 0 deg / 360 deg boundary correctly.
 * Standard subtraction FAILS at this boundary. For example:
 * - Standard: 350 - 10 = 340 degrees (WRONG)
 * - Circular:  350 - 10 = 20 degrees (CORRECT)
 *
 * This module provides mathematically correct circular angle operations
 * essential for accurate wind and swell direction analysis.
 *
 * @module magic-hour/direction-utils
 */

import { normalizeAngle } from "@/lib/domains/shared/angle-utils";

export { normalizeAngle };

/**
 * Calculates the circular angular difference between two directions.
 *
 * Standard subtraction FAILS at 0 deg/360 deg boundary. This formula correctly
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

/**
 * Performs circular interpolation between two angles.
 *
 * Takes the shortest path around the circle, correctly handling
 * the 0/360 boundary. Used for interpolating wind and swell directions
 * between forecast slots.
 *
 * @param angleA - Starting angle in degrees
 * @param angleB - Ending angle in degrees
 * @param ratio - Interpolation ratio (0-1)
 * @returns Interpolated angle in 0-360 range
 *
 * @example
 * interpolateAngle(350, 10, 0.5) // Returns 0 (midpoint going through 0)
 * interpolateAngle(90, 270, 0.5) // Returns 180 (midpoint going CW)
 */
export function interpolateAngle(
  angleA: number,
  angleB: number,
  ratio: number
): number {
  // Check if we should go the "short way" around
  if (Math.abs(angleB - angleA) <= 180) {
    // Direct interpolation is fine
    return angleA + ratio * (angleB - angleA);
  } else {
    // Need to go around the 0/360 boundary
    return normalizeAngle(angleA + ratio * normalizeAngle(angleB - angleA));
  }
}
