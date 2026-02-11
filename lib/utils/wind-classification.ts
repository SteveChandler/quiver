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

/** Exact compass directions considered offshore (east-facing, blowing seaward on west-coast beaches) */
export const OFFSHORE_DIRECTIONS = new Set([
  "offshore",
  "e",
  "ne",
  "se",
  "ene",
  "ese",
]);

/** Keywords indicating light/favorable wind conditions */
export const LIGHT_WIND_KEYWORDS = ["light", "calm", "variable", "glassy"];

/** Wind scoring point values */
export const WIND_SCORE = {
  OFFSHORE: 25,
  LIGHT: 15,
  ONSHORE: 0,
} as const;

export type WindClassification = "offshore" | "light" | "onshore";

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
 * @param windOffshoreDeg - Optional beach offshore direction in degrees.
 *                           When provided: uses angular difference (beach-aware).
 *                           When omitted: uses CA-centric cardinal matching (legacy).
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

  // Beach-aware classification using angular difference
  if (windOffshoreDeg != null) {
    const cardinal = parseCardinalPrefix(normalized);
    const windDeg = cardinal ? CARDINAL_TO_DEGREES[cardinal] : undefined;
    if (windDeg != null) {
      const diff = angleDifference(windDeg, windOffshoreDeg);
      // Within 45° of offshore direction → offshore; everything else → onshore
      // (cross-shore is conservatively treated as onshore for display purposes)
      return diff <= 45 ? "offshore" : "onshore";
    }
    // Unparseable cardinal — check for explicit "offshore" keyword
    if (normalized.includes("offshore")) return "offshore";
    return "onshore";
  }

  // Fallback: California-centric cardinal direction matching
  if (
    OFFSHORE_DIRECTIONS.has(normalized) ||
    normalized.includes("offshore")
  ) {
    return "offshore";
  }

  return "onshore";
}

/**
 * Get the scoring points for a wind classification.
 */
export function getWindScore(classification: WindClassification): number {
  return WIND_SCORE[classification.toUpperCase() as keyof typeof WIND_SCORE];
}
