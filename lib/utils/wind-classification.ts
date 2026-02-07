/**
 * Wind Classification Constants and Utilities
 *
 * Single source of truth for offshore/light/onshore wind direction matching.
 * Used by regional forecast scoring and aggregate wind condition labeling.
 *
 * @module lib/utils/wind-classification
 */

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
 * Classify a wind direction string into offshore, light, or onshore.
 *
 * Handles both bare compass directions ("NE", "E") and composite labels
 * like "E (offshore)" or "Light and Variable".
 */
export function classifyWindDirection(rawDirection: string): WindClassification {
  const normalized = rawDirection.toLowerCase().trim();

  if (
    OFFSHORE_DIRECTIONS.has(normalized) ||
    normalized.includes("offshore")
  ) {
    return "offshore";
  }

  if (LIGHT_WIND_KEYWORDS.some((kw) => normalized.includes(kw))) {
    return "light";
  }

  return "onshore";
}

/**
 * Get the scoring points for a wind classification.
 */
export function getWindScore(classification: WindClassification): number {
  return WIND_SCORE[classification.toUpperCase() as keyof typeof WIND_SCORE];
}
