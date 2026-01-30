/**
 * Direction Utilities
 *
 * Pure functions for parsing and converting wind/wave direction values.
 *
 * @module lib/services/discovery/window-selector/direction-utils
 */

/**
 * Cardinal direction to degrees mapping.
 */
const CARDINAL_DIRECTIONS: Record<string, number> = {
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

/**
 * Set of known cardinal direction strings for validation.
 */
const KNOWN_CARDINALS = new Set(Object.keys(CARDINAL_DIRECTIONS));

/**
 * Parse wave direction string to degrees.
 *
 * @param dir - Cardinal direction string (e.g., "N", "NE", "SSW")
 * @returns Direction in degrees (0-360), defaults to 0 for unknown directions
 */
export function parseWaveDirection(dir: string): number {
  // Defensive: ensure we have a string before calling .toUpperCase()
  if (typeof dir !== 'string' || !dir) {
    return 0;
  }
  const v = CARDINAL_DIRECTIONS[dir.toUpperCase()];
  return v ?? 0;
}

/**
 * Prefer degree-based wind direction when present; fall back to parsing cardinal strings.
 *
 * This function handles multiple input formats:
 * - Numeric degrees (number or string)
 * - Cardinal direction strings (e.g., "N", "NE", "SSW")
 *
 * @param windDirectionDeg - Direction in degrees (number or string) or null/undefined
 * @param windDirectionText - Cardinal direction text or null/undefined
 * @returns Direction in degrees (0-360) or null if unable to parse
 */
export function getDirectionDegrees(
  windDirectionDeg: number | string | null | undefined,
  windDirectionText: string | null | undefined
): number | null {
  // Try numeric degree value first
  if (windDirectionDeg !== null && windDirectionDeg !== undefined) {
    const asNum =
      typeof windDirectionDeg === 'number' ? windDirectionDeg : Number(windDirectionDeg);
    if (Number.isFinite(asNum)) {
      return ((asNum % 360) + 360) % 360;
    }
  }

  // Fall back to text parsing
  // Defensive: ensure we have a string before calling .trim()
  if (!windDirectionText || typeof windDirectionText !== 'string') return null;
  const trimmed = windDirectionText.trim();
  if (!trimmed) return null;

  // Try parsing as numeric string
  const asNum = Number(trimmed);
  if (Number.isFinite(asNum)) {
    return ((asNum % 360) + 360) % 360;
  }

  // Try parsing as cardinal direction
  const upper = trimmed.toUpperCase();
  if (!KNOWN_CARDINALS.has(upper)) return null;
  return parseWaveDirection(upper);
}
