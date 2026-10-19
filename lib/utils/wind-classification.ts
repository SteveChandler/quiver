/**
 * Wind Classification Constants and Utilities
 *
 * Single source of truth for offshore/light/onshore wind direction matching.
 * Used by regional forecast scoring and aggregate wind condition labeling.
 *
 * @module lib/utils/wind-classification
 */

import {
  CARDINAL_TO_DEGREES,
  angleDifference,
} from "@/lib/domains/shared/angle-utils";

/** Keywords indicating light/favorable wind conditions */
export const LIGHT_WIND_KEYWORDS = ["light", "calm", "variable", "glassy"];

/** Wind scoring point values */
export const WIND_SCORE = {
  OFFSHORE: 25,
  LIGHT: 15,
  ONSHORE: 0,
} as const;

/** "unknown" means the beach has no orientation or the direction is unreadable; callers must not render a relation. */
export type WindClassification = "offshore" | "light" | "onshore" | "unknown";

/**
 * Extract the leading cardinal direction token from a raw wind string.
 * Handles bare directions ("E"), composite labels ("E (offshore)"),
 * and multi-word strings ("NE 15mph").
 */
function parseCardinalPrefix(normalized: string): string {
  // Try the full string first (bare cardinal like "e", "ne")
  if (CARDINAL_TO_DEGREES[normalized] != null) return normalized;
  // Extract first whitespace/paren-delimited token
  const match = normalized.match(/^([a-z]+)/);
  if (match && CARDINAL_TO_DEGREES[match[1]] != null) return match[1];
  return "";
}

/**
 * Classify a wind direction string into offshore, light, or onshore.
 *
 * Handles both bare compass directions ("NE", "E") and composite labels
 * like "E (offshore)" or "Light and Variable".
 *
 * @param rawDirection - Wind direction string (e.g., "NE", "Light and Variable")
 * @param windOffshoreDeg - Beach offshore direction in degrees (resolve it with
 *                           `resolveOffshoreDeg`). Without it only the direction-independent
 *                           light keywords classify; everything else is "unknown", because east
 *                           is offshore on the West Coast and onshore on the East Coast.
 */
export function classifyWindDirection(
  rawDirection: string,
  windOffshoreDeg?: number | null,
): WindClassification {
  const normalized = rawDirection.toLowerCase().trim();

  // Light/calm/variable keywords are direction-independent
  if (LIGHT_WIND_KEYWORDS.some((kw) => normalized.includes(kw))) {
    return "light";
  }

  if (windOffshoreDeg == null || !Number.isFinite(windOffshoreDeg)) return "unknown";

  const cardinal = parseCardinalPrefix(normalized);
  const windDeg = cardinal ? CARDINAL_TO_DEGREES[cardinal] : undefined;
  if (windDeg != null) {
    const diff = angleDifference(windDeg, windOffshoreDeg);
    // Within 45° of offshore direction → offshore; everything else → onshore
    // (cross-shore is conservatively treated as onshore for display purposes)
    return diff <= 45 ? "offshore" : "onshore";
  }
  // Unparseable cardinal — only an explicit relation keyword is usable
  if (normalized.includes("offshore")) return "offshore";
  if (normalized.includes("onshore")) return "onshore";
  return "unknown";
}
