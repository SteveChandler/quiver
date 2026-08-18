/**
 * Wetsuit recommendation utilities based on water temperature
 *
 * Temperature ranges based on common surfing industry standards
 */

export { formatWaterTemp } from "@/lib/formatters/surf-data";

export interface WetsuitRecommendation {
  thickness: string;
  description: string;
  extras: string[];
}

/**
 * Get wetsuit recommendation based on water temperature in Fahrenheit
 *
 * Temperature ranges:
 * - 72°F+: Boardshorts/bikini
 * - 66-71°F: Spring suit (2mm)
 * - 62-65°F: 3/2mm fullsuit
 * - 58-61°F: 3/2mm sealed fullsuit
 * - 54-57°F: 4/3mm fullsuit
 * - 48-53°F: 5/4mm fullsuit with accessories
 * - <48°F: 6/5mm fullsuit with full accessories
 */
export function getWetsuitRecommendation(tempF: number): WetsuitRecommendation {
  if (tempF >= 72) {
    return {
      thickness: "Boardshorts",
      description: "Warm enough for boardshorts or a bikini",
      extras: [],
    };
  }

  if (tempF >= 66) {
    return {
      thickness: "Spring suit (2mm)",
      description: "A spring suit or shorty wetsuit is ideal",
      extras: [],
    };
  }

  if (tempF >= 62) {
    return {
      thickness: "3/2mm fullsuit",
      description: "Standard fullsuit for mild conditions",
      extras: [],
    };
  }

  if (tempF >= 58) {
    return {
      thickness: "3/2mm sealed",
      description: "Sealed seams recommended for cooler water",
      extras: ["booties optional"],
    };
  }

  if (tempF >= 54) {
    return {
      thickness: "4/3mm fullsuit",
      description: "Thicker suit needed for cold water",
      extras: ["booties recommended"],
    };
  }

  if (tempF >= 48) {
    return {
      thickness: "5/4mm fullsuit",
      description: "Heavy-duty suit with accessories required",
      extras: ["booties", "gloves", "hood optional"],
    };
  }

  // Below 48°F
  return {
    thickness: "6/5mm fullsuit",
    description: "Maximum protection for frigid conditions",
    extras: ["booties", "gloves", "hood"],
  };
}

/**
 * Upper bound for a believable sea-surface reading. Warmest open ocean on record
 * is in the mid-90s F; anything above this is a unit error or a sentinel value.
 */
const MAX_PLAUSIBLE_WATER_TEMP_F = 100;

/**
 * Parse water temperature from various string formats
 *
 * Handles formats like:
 * - "65°F"
 * - "65"
 * - "65 F"
 * - null/undefined
 *
 * @returns Temperature in Fahrenheit or null if parsing fails
 */
export function parseWaterTempF(raw: string | null | undefined): number | null {
  if (raw === null || raw === undefined) {
    return null;
  }

  // Remove degree symbols, F, and whitespace, then parse
  const cleaned = raw.replace(/[°Ff\s]/g, "");

  const parsed = parseFloat(cleaned);

  if (isNaN(parsed)) {
    return null;
  }

  // Sanity check catches unit errors and sentinels, not warm water. The old 90°F
  // ceiling rejected real Gulf Coast summer readings (91-92°F observed at 10 TX
  // and FL beaches), which made their water-temp pages flap in and out of
  // noindex as the latest forecast row crossed the bound.
  if (parsed < 30 || parsed > MAX_PLAUSIBLE_WATER_TEMP_F) {
    return null;
  }

  return parsed;
}

