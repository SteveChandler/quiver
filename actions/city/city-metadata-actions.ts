"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { withServerAction, ServerActionResponse } from "@/lib/server-action-utils";
import { resolveCityFromSlug } from "@/lib/seo/city-slug-utils";

// CityMetadata is defined in @/types/location; re-export for backward compatibility
import type { CityMetadata } from "@/types/location";
export type { CityMetadata } from "@/types/location";

/**
 * Result from find_cities_by_pattern RPC function.
 * Used for city slug resolution with exact match preference.
 */
interface CityPatternMatch {
  city: string;
  state: string;
  beach_count: number;
  /** True if city name exactly matches search pattern (not substring) */
  is_exact_match?: boolean;
}

const STATE_NAMES: Record<string, string> = {
  CA: "California",
  HI: "Hawaii",
  OR: "Oregon",
  WA: "Washington",
  FL: "Florida",
  NC: "North Carolina",
  SC: "South Carolina",
  NJ: "New Jersey",
  NY: "New York",
  TX: "Texas",
  MA: "Massachusetts",
  ME: "Maine",
  RI: "Rhode Island",
  NH: "New Hampshire",
  GA: "Georgia",
  PR: "Puerto Rico",
};

/**
 * Categorize a skill level string into beginner, intermediate, or advanced.
 * - Beginner: includes "beginner" or "longboard" in the string
 * - Advanced: includes "advanced" or "expert" in the string
 * - Intermediate: everything else (including null)
 */
function categorizeSkillLevel(
  skillLevel: string | null
): "beginner" | "intermediate" | "advanced" {
  if (!skillLevel) return "intermediate";
  const lower = skillLevel.toLowerCase();
  if (lower.includes("beginner") || lower.includes("longboard")) return "beginner";
  if (lower.includes("advanced") || lower.includes("expert")) return "advanced";
  return "intermediate";
}

/**
 * Get metadata for a city including beach counts and names.
 * Returns null if city doesn't exist or has no beaches.
 *
 * @param cityName - The city name (e.g., "Santa Cruz")
 * @param state - The state code (e.g., "CA")
 */
export async function getCityMetadata(
  cityName: string,
  state: string
): Promise<ServerActionResponse<CityMetadata | null>> {
  return withServerAction(async () => {
    const supabase = await createSupabaseServerClient();
    const normalizedState = state.toUpperCase();

    const { data: beaches, error } = await supabase
      .from("beaches")
      .select("id, name, slug, skill_level, lat, lon")
      .ilike("city", cityName)
      .eq("state", normalizedState)
      .or("is_private.is.null,is_private.eq.false")
      .order("name");

    if (error) {
      throw new Error(error.message || "Failed to fetch city beaches");
    }

    // Return null if city doesn't exist or has no beaches
    if (!beaches || beaches.length < 1) {
      return null;
    }

    // Calculate skill level counts
    let beginnerCount = 0;
    let intermediateCount = 0;
    let advancedCount = 0;

    for (const beach of beaches) {
      const category = categorizeSkillLevel(beach.skill_level);
      if (category === "beginner") beginnerCount++;
      else if (category === "intermediate") intermediateCount++;
      else advancedCount++;
    }

    // Calculate center coordinates (average of all beaches with valid coordinates)
    const validCoords = beaches.filter(
      (b) => b.lat != null && b.lon != null
    );
    const centerLat =
      validCoords.length > 0
        ? validCoords.reduce((sum, b) => sum + (b.lat ?? 0), 0) / validCoords.length
        : 0;
    const centerLon =
      validCoords.length > 0
        ? validCoords.reduce((sum, b) => sum + (b.lon ?? 0), 0) / validCoords.length
        : 0;

    return {
      cityName,
      state: normalizedState,
      stateName: STATE_NAMES[normalizedState] || normalizedState,
      totalBeaches: beaches.length,
      beginnerCount,
      intermediateCount,
      advancedCount,
      beaches: beaches.map((b) => ({
        name: b.name,
        slug: b.slug,
        skillLevel: b.skill_level,
      })),
      centerLat,
      centerLon,
    };
  });
}

/**
 * Find cities matching a pattern across all states.
 * Used for batch city resolution to avoid N database queries.
 *
 * @param cityPattern - City name pattern (e.g., "belmar")
 * @returns Array of matching cities with state and beach count
 */
export async function findCitiesMatchingPattern(
  cityPattern: string
): Promise<ServerActionResponse<CityPatternMatch[]>> {
  return withServerAction(async () => {
    const supabase = await createSupabaseServerClient();

    // Call RPC without state filter to get all matching cities
    const { data: matches, error } = await supabase.rpc("find_cities_by_pattern", {
      search_pattern: cityPattern,
      state_filter: null,
    });

    if (error) {
      throw new Error(error.message || "Failed to find cities by pattern");
    }

    if (!matches || matches.length === 0) {
      return [];
    }

    // Filter to cities with at least 1 beach
    const validCities = (matches as CityPatternMatch[]).filter(
      (c) => c.beach_count >= 1
    );

    return validCities;
  });
}

/**
 * Find a city by its URL slug and return full metadata.
 * Handles both simple slugs ("santa-cruz") and state-suffixed slugs ("newport-ca").
 * Returns null if city not found, ambiguous, or has no beaches.
 *
 * @param slug - URL slug like "santa-cruz" or "newport-ca"
 */
export async function findCityBySlug(
  slug: string
): Promise<ServerActionResponse<CityMetadata | null>> {
  return withServerAction(async () => {
    const supabase = await createSupabaseServerClient();
    const { cityPattern, stateFilter } = resolveCityFromSlug(slug);

    // Use RPC function for accent-insensitive and hyphen-normalized matching
    // This handles cases like:
    //   - "rincon" matching "Rincón" (accent normalization)
    //   - "cardiff by the sea" matching "Cardiff-by-the-Sea" (hyphen normalization)
    const { data: matches, error } = await supabase.rpc("find_cities_by_pattern", {
      search_pattern: cityPattern,
      state_filter: stateFilter,
    });

    if (error) {
      throw new Error(error.message || "Failed to find city by slug");
    }

    if (!matches || matches.length === 0) {
      return null;
    }

    // Filter to cities with at least 1 beach (RPC returns beach_count)
    const validCities = (matches as CityPatternMatch[]).filter(
      (c) => c.beach_count >= 1
    );

    if (validCities.length === 0) {
      return null;
    }

    // Handle multiple matches by preferring exact matches
    // This prevents substring collisions like "koloa" matching "waikoloa"
    if (validCities.length > 1) {
      const exactMatches = validCities.filter(
        (c) => c.is_exact_match === true
      );

      // If exactly one exact match, use it (even without state filter)
      if (exactMatches.length === 1) {
        const { city, state } = exactMatches[0];
        const metadataResult = await getCityMetadata(city, state);
        return metadataResult.success && metadataResult.data ? metadataResult.data : null;
      }

      // If no state filter and multiple (or zero) exact matches, ambiguous
      if (!stateFilter) {
        return null;
      }

      // With state filter, prefer exact matches if available
      if (exactMatches.length > 0) {
        validCities.splice(0, validCities.length, ...exactMatches);
      }
    }

    // Use first valid city (or only match with state filter)
    const { city, state } = validCities[0];

    // Get full metadata using existing function
    const metadataResult = await getCityMetadata(city, state);
    if (!metadataResult.success || !metadataResult.data) {
      return null;
    }
    return metadataResult.data;
  });
}
