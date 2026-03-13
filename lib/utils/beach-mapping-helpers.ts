/**
 * Shared mapping helpers used by beach transformer utilities.
 *
 * These functions are extracted from beach-to-surfspot-transformer.ts and
 * spot-data-transformer.ts to eliminate duplication.
 */

import type { SurfSpot } from "@/lib/data/surf-spots";
import { slugifyAscii } from "@/lib/utils/text-utils";

/**
 * Map database skill_level string to SurfSpot skillLevel enum.
 */
export function mapSkillLevel(
  dbSkillLevel: string | null
): SurfSpot["skillLevel"] {
  if (!dbSkillLevel) return "Intermediate";

  const normalized = dbSkillLevel.toLowerCase();

  if (normalized.includes("beginner")) return "Beginner friendly";
  if (normalized.includes("longboard")) return "Longboard friendly";
  if (normalized.includes("advanced")) return "Advanced";
  if (normalized.includes("expert")) return "Intermediate to expert";

  return "Intermediate";
}

/**
 * Map database crowd_level string to SurfSpot crowdFactor enum.
 */
export function mapCrowdFactor(
  dbCrowdLevel: string | null
): SurfSpot["crowdFactor"] {
  if (!dbCrowdLevel) return "Moderate";

  const normalized = dbCrowdLevel.toLowerCase();

  if (normalized.includes("light") || normalized.includes("low")) return "Light";
  if (normalized.includes("heavy") || normalized.includes("high")) return "Heavy";

  return "Moderate";
}

/** San Diego area city names/neighborhoods that share the "san-diego" intent page slug. */
const SAN_DIEGO_CITY_NAMES = new Set([
  "san diego",
  "la jolla",
  "ocean beach",
  "pacific beach",
  "mission beach",
  "del mar",
  "coronado",
  "encinitas",
  "carlsbad",
]);

/**
 * Infer the city slug from a city name for intent page URL generation.
 *
 * Special cases:
 * - San Diego area neighborhoods map to "san-diego" since intent pages aggregate at city level.
 * - Generic "Orange County" returns null — no county-level intent page exists.
 * - All other cities are slugified via slugifyAscii.
 *
 * Returns null when no valid slug can be produced (empty/null city, or "Orange County").
 */
export function inferCitySlug(city: string | null): string | null {
  if (!city) return null;

  const cityLower = city.toLowerCase().trim();

  if (SAN_DIEGO_CITY_NAMES.has(cityLower)) {
    return "san-diego";
  }

  // Generic "Orange County" doesn't have a valid intent page
  if (cityLower === "orange county") {
    return null;
  }

  // All other cities: generate a slug
  const slug = slugifyAscii(city);
  return slug || null;
}

/**
 * Derive a SurfSpot-compatible city slug from a city name.
 *
 * Extends inferCitySlug with additional cases needed for the SurfSpot format:
 * - "Orange County" maps to "orange-county" (used for beach grouping/map display)
 * - Unknown cities default to "san-diego" (SurfSpot.citySlug is non-nullable)
 *
 * Use this in contexts where a non-null string is always required.
 */
export function inferCitySlugForSurfSpot(city: string | null): string {
  if (!city) return "san-diego";

  const cityLower = city.toLowerCase().trim();

  if (SAN_DIEGO_CITY_NAMES.has(cityLower)) {
    return "san-diego";
  }

  // "Orange County" maps to the orange-county slug for beach grouping
  if (cityLower.includes("orange")) {
    return "orange-county";
  }

  // Default to san-diego for unrecognized cities (maintains backward compatibility)
  return "san-diego";
}
