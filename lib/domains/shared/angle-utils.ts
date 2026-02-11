/**
 * Shared Angle and Direction Utilities
 *
 * Single source of truth for all angular calculations and direction formatting.
 * Used by spot-profile, conditions, and scoring domains.
 */

/** Cardinal direction string to degrees mapping (lowercase keys for parsing) */
export const CARDINAL_TO_DEGREES: Record<string, number> = {
  n: 0,
  nne: 22.5,
  ne: 45,
  ene: 67.5,
  e: 90,
  ese: 112.5,
  se: 135,
  sse: 157.5,
  s: 180,
  ssw: 202.5,
  sw: 225,
  wsw: 247.5,
  w: 270,
  wnw: 292.5,
  nw: 315,
  nnw: 337.5,
};

/** 16-point cardinal directions for angle formatting */
const CARDINAL_DIRECTIONS = [
  'N',
  'NNE',
  'NE',
  'ENE',
  'E',
  'ESE',
  'SE',
  'SSE',
  'S',
  'SSW',
  'SW',
  'WSW',
  'W',
  'WNW',
  'NW',
  'NNW',
] as const;

/**
 * Normalizes an angle to the 0-360 degree range.
 *
 * @param deg - Angle in degrees (can be negative or > 360)
 * @returns Normalized angle between 0 and 360
 *
 * @example
 * normalizeAngle(-90)  // 270
 * normalizeAngle(450)  // 90
 * normalizeAngle(180)  // 180
 */
export function normalizeAngle(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

/**
 * Calculates the angular difference between two directions.
 * Always returns the shorter arc (0-180 degrees).
 *
 * @param deg1 - First angle in degrees
 * @param deg2 - Second angle in degrees
 * @returns Angular difference between 0 and 180 degrees
 *
 * @example
 * angleDifference(10, 350)   // 20 (not 340)
 * angleDifference(90, 270)   // 180
 * angleDifference(0, 180)    // 180
 */
export function angleDifference(deg1: number, deg2: number): number {
  const diff = Math.abs(normalizeAngle(deg1) - normalizeAngle(deg2));
  return diff > 180 ? 360 - diff : diff;
}

/**
 * Converts degrees to a 16-point cardinal direction name.
 *
 * Each cardinal point spans 22.5 degrees:
 * - N:   348.75 - 11.25
 * - NNE: 11.25 - 33.75
 * - NE:  33.75 - 56.25
 * - etc.
 *
 * @param degrees - Direction in degrees (0 = North, 90 = East), or null/undefined
 * @returns Cardinal direction name (e.g., 'N', 'NE', 'SW'), or 'Unknown' if invalid
 *
 * @example
 * directionName(0)    // 'N'
 * directionName(90)   // 'E'
 * directionName(225)  // 'SW'
 * directionName(350)  // 'N'
 * directionName(NaN)  // 'Unknown'
 * directionName(null) // 'Unknown'
 */
export function directionName(degrees: number | null | undefined): string {
  if (degrees == null || !Number.isFinite(degrees)) {
    return 'Unknown';
  }
  const normalized = normalizeAngle(degrees);
  const index = Math.round(normalized / 22.5) % 16;
  return CARDINAL_DIRECTIONS[index];
}
