/**
 * Parse NOAA forecast text fields to numeric values.
 */

const FEET_TO_METERS = 0.3048;
const MPH_TO_MS = 0.44704;
const KTS_TO_MS = 0.514444;

/**
 * Parse wave height text to meters.
 *
 * Handles various NOAA formats:
 * - "3-4ft", "3 to 4 ft", "3-4 ft plus"
 * - "3ft", "3 ft"
 * - "Flat", "flat"
 */
export function parseWaveHeight(text: string | null | undefined): number | null {
  if (!text || text.toLowerCase().includes('flat')) {
    return 0.15;
  }

  // Clean text: remove non-digits except hyphens and dots
  const clean = text.replace(/[^\d\-.]/g, ' ').trim();

  // Find all numbers
  const nums = clean.match(/\d*\.?\d+/g);

  if (!nums || nums.length === 0) {
    return null;
  }

  const values = nums.map(Number).filter((n) => !isNaN(n));

  if (values.length === 2) {
    // Range: take midpoint
    return ((values[0] + values[1]) / 2) * FEET_TO_METERS;
  } else if (values.length === 1) {
    return values[0] * FEET_TO_METERS;
  }

  return null;
}

/**
 * Parse wind speed text to m/s.
 */
export function parseWindSpeed(text: string | null | undefined): number | null {
  if (!text) {
    return null;
  }

  const match = text.match(/(\d+\.?\d*)/);
  if (!match) {
    return null;
  }

  const value = parseFloat(match[1]);
  const textLower = text.toLowerCase();

  if (textLower.includes('kts') || textLower.includes('knot')) {
    return value * KTS_TO_MS;
  } else if (textLower.includes('mph')) {
    return value * MPH_TO_MS;
  }

  // Assume m/s if no unit
  return value;
}
