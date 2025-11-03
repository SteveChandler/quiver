// Lookup table for 16-point compass rose
// Each direction covers 22.5 degrees (360° / 16)
const COMPASS_DIRECTIONS = [
  "N",   // 348.75 - 11.25
  "NNE", // 11.25 - 33.75
  "NE",  // 33.75 - 56.25
  "ENE", // 56.25 - 78.75
  "E",   // 78.75 - 101.25
  "ESE", // 101.25 - 123.75
  "SE",  // 123.75 - 146.25
  "SSE", // 146.25 - 168.75
  "S",   // 168.75 - 191.25
  "SSW", // 191.25 - 213.75
  "SW",  // 213.75 - 236.25
  "WSW", // 236.25 - 258.75
  "W",   // 258.75 - 281.25
  "WNW", // 281.25 - 303.75
  "NW",  // 303.75 - 326.25
  "NNW", // 326.25 - 348.75
] as const;

const DEGREES_PER_DIRECTION = 22.5;
const OFFSET = 11.25;
// Small epsilon to handle inclusive upper boundary conditions (<=)
const EPSILON = 0.001;

/**
 * Convert wind direction degrees to compass direction name
 * @param degrees Wind direction in degrees (0-360)
 * @returns Compass direction string (e.g., "N", "NE", "SW") or null if invalid
 */
export function getWindDirectionName(degrees: number | null): string | null {
  if (degrees === null || degrees === undefined) return null;

  // Handle invalid ranges
  if (degrees < 0 || degrees > 360) return null;

  // Normalize degrees by adding offset to align with compass directions
  // Subtract epsilon to handle inclusive upper boundaries (x <= 11.25 should be N, not NNE)
  const normalized = (degrees + OFFSET - EPSILON) % 360;

  // Calculate index into lookup table
  const index = Math.floor(normalized / DEGREES_PER_DIRECTION) % COMPASS_DIRECTIONS.length;

  return COMPASS_DIRECTIONS[index];
}
