import {
  getDirectionAbbrev,
  getWindDirectionDegrees,
} from "./beach-conditions-utils";

/**
 * Safely converts an unknown value to a number or null.
 * Extracts numeric values from strings using regex.
 *
 * @param value - Value to convert (can be number, string, null, undefined)
 * @returns Parsed number or null if conversion fails
 *
 * @example
 * parseNumericValue(42) // 42
 * parseNumericValue("3.5") // 3.5
 * parseNumericValue("Wave: 4-6 ft") // 4
 * parseNumericValue(null) // null
 */
export function parseNumericValue(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "string") {
    const match = value.match(/-?\d+(?:\.\d+)?/);
    if (!match) return null;
    const parsed = Number.parseFloat(match[0]);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/**
 * Converts a value to direction degrees (0-359).
 * Handles both numeric values and directional text (e.g., "NW", "North").
 *
 * @param value - Direction value (number, text, or null)
 * @returns Direction in degrees or null
 *
 * @example
 * parseDirectionDegrees(180) // 180
 * parseDirectionDegrees("NW") // 315
 * parseDirectionDegrees("North") // 0
 */
export function parseDirectionDegrees(value: unknown): number | null {
  const numeric = parseNumericValue(value);
  if (numeric !== null) return numeric;
  if (typeof value === "string") {
    const abbrev = getDirectionAbbrev(value);
    return getWindDirectionDegrees(abbrev);
  }
  return null;
}

/**
 * Converts a time string (HH:MM) to total minutes since midnight.
 *
 * @param time - Time string in format "HH:MM"
 * @returns Total minutes or null if invalid
 *
 * @example
 * timeStringToMinutes("14:30") // 870 (14*60 + 30)
 * timeStringToMinutes("00:00") // 0
 * timeStringToMinutes("invalid") // null
 */
export function timeStringToMinutes(
  time: string | null | undefined
): number | null {
  if (!time) return null;
  const parts = time.split(":");
  if (parts.length < 2) return null;
  const hours = Number(parts[0]);
  const minutes = Number(parts[1]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return hours * 60 + minutes;
}

/**
 * Formats surf height into a human-readable string with fallbacks.
 * Handles min/max ranges, single values, and text descriptions.
 *
 * @param minFt - Minimum wave height in feet
 * @param maxFt - Maximum wave height in feet
 * @param description - Optional text description
 * @param fallback - Fallback text if all else fails
 * @returns Formatted surf height string
 *
 * @example
 * formatSurfHeight(4, 6) // "4-6 ft"
 * formatSurfHeight(3, 3.2) // "3 ft" (values within 0.25 are averaged)
 * formatSurfHeight(null, null, "Knee-high") // "Knee-high"
 * formatSurfHeight(null, null, null, "N/A") // "N/A"
 */
export function formatSurfHeight(
  minFt: number | null | undefined,
  maxFt: number | null | undefined,
  description?: string | null,
  fallback?: string | null
): string {
  const formatValue = (value: number) => {
    const rounded = Math.round(value * 10) / 10;
    return Number.isInteger(rounded)
      ? `${rounded.toFixed(0)}`
      : `${rounded}`;
  };

  if (minFt != null && maxFt != null) {
    if (Math.abs(maxFt - minFt) < 0.25) {
      return `${formatValue((minFt + maxFt) / 2)} ft`;
    }
    return `${formatValue(minFt)}-${formatValue(maxFt)} ft`;
  }

  const value = minFt ?? maxFt;
  if (value != null) {
    return `${formatValue(value)} ft`;
  }

  if (description && description.trim().length > 0) {
    return description;
  }

  return fallback ?? "N/A";
}
