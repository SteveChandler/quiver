"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { withServerAction, ServerActionResponse } from "@/lib/server-action-utils";
import { resolveCityFromSlug } from "@/lib/seo/city-slug-utils";

export interface CityMetadata {
  cityName: string;
  state: string;
  stateName: string;
  totalBeaches: number;
  beginnerCount: number;
  intermediateCount: number;
  advancedCount: number;
  beaches: Array<{
    name: string;
    slug: string;
    skillLevel: string | null;
  }>;
  centerLat: number;
  centerLon: number;
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
 * Returns null if city doesn't exist or has fewer than 3 beaches.
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

    // Return null if city doesn't exist or has fewer than 3 beaches
    if (!beaches || beaches.length < 3) {
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
 * Find a city by its URL slug and return full metadata.
 * Handles both simple slugs ("santa-cruz") and state-suffixed slugs ("newport-ca").
 * Returns null if city not found, ambiguous, or has fewer than 3 beaches.
 *
 * @param slug - URL slug like "santa-cruz" or "newport-ca"
 */
export async function findCityBySlug(
  slug: string
): Promise<ServerActionResponse<CityMetadata | null>> {
  return withServerAction(async () => {
    const supabase = await createSupabaseServerClient();
    const { cityPattern, stateFilter } = resolveCityFromSlug(slug);

    // Build query to find matching cities
    let query = supabase
      .from("beaches")
      .select("city, state")
      .ilike("city", `%${cityPattern}%`)
      .or("is_private.is.null,is_private.eq.false");

    if (stateFilter) {
      query = query.eq("state", stateFilter);
    }

    const { data: matches, error } = await query;

    if (error) {
      throw new Error(error.message || "Failed to find city by slug");
    }

    if (!matches || matches.length === 0) {
      return null;
    }

    // Group by city/state to find unique combinations
    const cityStates = new Map<
      string,
      { city: string; state: string; count: number }
    >();
    for (const match of matches) {
      const key = `${match.city}|${match.state}`;
      const existing = cityStates.get(key);
      if (existing) {
        existing.count++;
      } else {
        cityStates.set(key, { city: match.city, state: match.state, count: 1 });
      }
    }

    // Filter to cities with 3+ beaches
    const validCities = [...cityStates.values()].filter((c) => c.count >= 3);

    if (validCities.length === 0) {
      return null;
    }

    // If multiple valid cities and no state filter, ambiguous
    if (validCities.length > 1 && !stateFilter) {
      return null;
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
