"use server";

import { createPublicReadClient } from "@/lib/supabase/server";
import { calculateDistanceInMiles } from "@/lib/utils/distance-utils";
import { slugifyAscii } from "@/lib/utils/text-utils";
import { stateToSlug } from "@/lib/utils/beach-url-utils";
import type { Beach } from "@/types/database";

export async function getNearbyBeaches(
  latitude: number,
  longitude: number,
  radiusMiles = 50
) {
  // Note: return shape is intentionally simple for server + client callers:
  // - success: boolean
  // - data?: Beach[]
  // - error?: string
  // - fallbackUsed?: boolean (true when RPC path fails and we fall back to client-side filtering)
  const supabase = createPublicReadClient();

  try {
    // Convert miles to meters for the PostGIS function (round to integer)
    const radiusMeters = Math.round(radiusMiles * 1609.34);

    // Use the optimized database function instead of client-side filtering
    const { data: nearbyBeaches, error } = await supabase.rpc(
      "get_nearby_beaches",
      {
        input_lat: latitude,
        input_lng: longitude,
        max_distance_meters: radiusMeters,
        limit_count: 50,
      }
    );

    if (error) {
      console.warn(
        "Spatial function failed, falling back to client-side filtering:",
        error
      );

      // Fallback to original method if spatial function fails
      const { data: allBeaches, error: fallbackError } = await supabase
        .from("beaches")
        .select("*");

      if (fallbackError) {
        throw fallbackError;
      }

      if (!allBeaches || allBeaches.length === 0) {
        return { success: true, data: [] };
      }

      // Calculate distances and filter beaches within radius
      const filteredBeaches = allBeaches
        .map((beach: Beach) => {
          // Normalize nullable coordinates to numbers; invalid coordinates become NaN
          const lat2 = beach.lat ?? Number.NaN;
          const lon2 = beach.lon ?? Number.NaN;

          const distance = calculateDistanceInMiles(
            { lat: latitude, lon: longitude },
            { lat: lat2, lon: lon2 }
          );

          return {
            ...beach,
            distance,
          };
        })
        .filter(
          (beach: Beach & { distance: number }) =>
            Number.isFinite(beach.distance) && beach.distance <= radiusMiles
        )
        .sort(
          (a: Beach & { distance: number }, b: Beach & { distance: number }) =>
            a.distance - b.distance
        );

      return {
        success: true,
        data: filteredBeaches as Beach[],
        fallbackUsed: true,
      };
    }

    // Success with spatial function
    return {
      success: true,
      data: nearbyBeaches as unknown as Beach[],
      fallbackUsed: false,
    };
  } catch (error) {
    console.error("Error getting nearby beaches:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// Do not re-export non-async utility values from a "use server" module; this
// causes Next.js to error in production builds. Import from
// "@/lib/utils/distance-utils" directly where needed.

export interface CityWithBeachCount {
  city: string;
  state: string;
  country: string | null;
  beachCount: number;
}

/**
 * Get all cities that have at least N beaches.
 * Used for generating intent pages for cities with sufficient content.
 *
 * @param minBeaches - Minimum number of beaches required (default: 1)
 */
async function getAllCitiesWithBeaches(minBeaches: number = 1) {
  try {
    const supabase = createPublicReadClient();

    const { data, error } = await supabase
      .from("beaches")
      .select("city, state, country")
      .or("is_private.is.null,is_private.eq.false")
      .not("city", "is", null)
      .not("state", "is", null)
      .is("deleted_at", null);

    if (error) throw error;

    // Aggregate by city/state/country
    const cityMap = new Map<string, CityWithBeachCount>();

    for (const beach of data || []) {
      const key = `${beach.city}|${beach.state}|${beach.country || "USA"}`;
      const existing = cityMap.get(key);

      if (existing) {
        existing.beachCount++;
      } else {
        cityMap.set(key, {
          city: beach.city ?? "",
          state: beach.state ?? "",
          country: beach.country || "USA",
          beachCount: 1,
        });
      }
    }

    // Filter by minimum beach count and sort
    const cities = [...cityMap.values()]
      .filter((c) => c.beachCount >= minBeaches)
      .sort((a, b) => a.city.localeCompare(b.city));

    return {
      success: true,
      data: cities,
    };
  } catch (error) {
    console.error("Error getting cities with beaches:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export interface CityWithSkillCategories {
  city: string;
  state: string;
  country: string | null;
  beachCount: number;
  hasBeginnerBeaches: boolean;
  hasAdvancedBeaches: boolean;
  hasLeastCrowdedBeaches: boolean;
  /** TRUE when >= 2 beaches have description + at least one of crowd_tips/wave_tips/best_conditions_prose */
  hasEditorialContent: boolean;
}

/**
 * Get all cities with beach counts AND skill-level flags.
 * Used by sitemap and generateStaticParams to filter skill-based intent URLs
 * (beginner/longboard only for cities with beginner beaches, etc.)
 *
 * Uses database-side aggregation via RPC for better performance.
 *
 * @param minBeaches - Minimum number of beaches required (default: 1)
 */
export async function getAllCitiesWithBeachSkills(minBeaches: number = 1) {
  try {
    const supabase = createPublicReadClient();

    // Use RPC for database-side aggregation (much faster than full table scan)
    const { data, error } = await supabase.rpc("get_cities_with_beach_skills", {
      min_beaches: minBeaches,
    });

    if (error) {
      // Fallback to client-side aggregation if RPC fails (e.g., not deployed yet)
      console.warn("RPC get_cities_with_beach_skills failed, using fallback:", error.message);
      return getAllCitiesWithBeachSkillsFallback(minBeaches);
    }

    // Transform RPC response to expected format.
    // Cast through unknown because the Supabase-generated type for this RPC may not yet
    // include has_least_crowded if the DB function hasn't been updated on all envs.
    type RpcRow = {
      city: string;
      state: string;
      country: string | null;
      beach_count: number;
      has_beginner: boolean;
      has_advanced: boolean;
      has_editorial: boolean;
      has_least_crowded?: boolean;
    };
    const cities: CityWithSkillCategories[] = ((data || []) as unknown as RpcRow[]).map((row) => ({
      city: row.city,
      state: row.state,
      country: row.country,
      beachCount: Number(row.beach_count),
      hasBeginnerBeaches: row.has_beginner,
      hasAdvancedBeaches: row.has_advanced,
      hasLeastCrowdedBeaches: row.has_least_crowded ?? false,
      hasEditorialContent: row.has_editorial ?? false,
    }));

    return {
      success: true,
      data: cities,
    };
  } catch (error) {
    console.error("Error getting cities with beach skills:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Fallback implementation using client-side aggregation.
 * Used when RPC is not available (e.g., during migrations).
 */
async function getAllCitiesWithBeachSkillsFallback(minBeaches: number = 1) {
  try {
    const supabase = createPublicReadClient();

    const { data, error } = await supabase
      .from("beaches")
      .select("city, state, country, skill_level, crowd_level, description, crowd_tips, wave_tips, best_conditions_prose")
      .or("is_private.is.null,is_private.eq.false")
      .not("city", "is", null)
      .not("state", "is", null)
      .is("deleted_at", null);

    if (error) throw error;

    // Aggregate by city/state/country with skill flags and editorial quality counts
    const cityMap = new Map<string, CityWithSkillCategories & { editorialCount: number }>();

    for (const beach of data || []) {
      const key = `${beach.city}|${beach.state}|${beach.country || "USA"}`;
      const existing = cityMap.get(key);

      const skill = (beach.skill_level || "").toLowerCase();
      const isBeginner =
        skill.includes("beginner") ||
        skill.includes("longboard");
      const isAdvanced = skill.includes("advanced") || skill.includes("expert");
      const isLeastCrowded = ['light', 'moderate'].includes((beach as any).crowd_level?.toLowerCase() || '');
      const hasDescription = !!(beach as any).description?.trim();
      const hasEditorialField =
        !!(beach as any).crowd_tips?.trim() ||
        !!(beach as any).wave_tips?.trim() ||
        !!(beach as any).best_conditions_prose?.trim();
      const isQualityBeach = hasDescription && hasEditorialField;

      if (existing) {
        existing.beachCount++;
        if (isBeginner) existing.hasBeginnerBeaches = true;
        if (isAdvanced) existing.hasAdvancedBeaches = true;
        if (isLeastCrowded) existing.hasLeastCrowdedBeaches = true;
        if (isQualityBeach) existing.editorialCount++;
      } else {
        cityMap.set(key, {
          city: beach.city ?? "",
          state: beach.state ?? "",
          country: beach.country || "USA",
          beachCount: 1,
          hasBeginnerBeaches: isBeginner,
          hasAdvancedBeaches: isAdvanced,
          hasLeastCrowdedBeaches: isLeastCrowded,
          hasEditorialContent: false, // computed after aggregation
          editorialCount: isQualityBeach ? 1 : 0,
        });
      }
    }

    // Resolve hasEditorialContent after full aggregation (requires >= 2 quality beaches)
    for (const city of cityMap.values()) {
      city.hasEditorialContent = city.editorialCount >= 2;
    }

    // Filter by minimum beach count and sort; strip internal editorialCount field
    const cities: CityWithSkillCategories[] = [...cityMap.values()]
      .filter((c) => c.beachCount >= minBeaches)
      .sort((a, b) => a.city.localeCompare(b.city))
      .map(({ editorialCount: _ec, ...rest }) => rest);

    return {
      success: true,
      data: cities,
    };
  } catch (error) {
    console.error("Error in fallback getAllCitiesWithBeachSkills:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// ============================================================================
// City Lookup Functions (for redirect handling)
// ============================================================================

export interface CityLookupResult {
  slug: string;
  cityName: string;
  stateSlug: string;
  stateName: string;
  country: string;
}

/**
 * Look up a city by its URL slug.
 * Used for redirect handling when we only have a city slug.
 *
 * @param citySlug - The URL slug of the city (e.g., "san-diego")
 * @returns City data if found, null otherwise
 */
export async function lookupCityBySlug(
  citySlug: string
): Promise<CityLookupResult | null> {
  try {
    const citiesResult = await getAllCitiesWithBeaches(1);
    if (!citiesResult.success || !citiesResult.data) return null;

    for (const cityRecord of citiesResult.data) {
      const slug = slugifyAscii(cityRecord.city);
      if (slug === citySlug) {
        return {
          slug,
          cityName: cityRecord.city,
          stateSlug: stateToSlug(cityRecord.state),
          stateName: cityRecord.state,
          country: cityRecord.country || "USA",
        };
      }
    }

    return null;
  } catch (error) {
    console.error("Error looking up city by slug:", error);
    return null;
  }
}

/**
 * Look up a city by city slug + state slug.
 * Used for redirect handling of collision-aware slugs like "oceanside-ca".
 *
 * @param citySlug - The URL slug of the city (e.g., "oceanside")
 * @param stateSlug - The URL slug of the state (e.g., "ca")
 * @returns City data if found, null otherwise
 */
export async function lookupCityByCityAndStateSlug(
  citySlug: string,
  stateSlug: string
): Promise<CityLookupResult | null> {
  try {
    const citiesResult = await getAllCitiesWithBeaches(1);
    if (!citiesResult.success || !citiesResult.data) return null;

    for (const cityRecord of citiesResult.data) {
      const slug = slugifyAscii(cityRecord.city);
      const state = stateToSlug(cityRecord.state);

      if (slug === citySlug && state === stateSlug) {
        return {
          slug,
          cityName: cityRecord.city,
          stateSlug: state,
          stateName: cityRecord.state,
          country: cityRecord.country || "USA",
        };
      }
    }

    return null;
  } catch (error) {
    console.error("Error looking up city by city+state:", error);
    return null;
  }
}

// ============================================================================
// State-Level City Functions (for intent page linking)
// ============================================================================

export interface TopCityInState {
  slug: string;
  name: string;
  beachCount: number;
}

/**
 * Get the top cities in a state by beach count.
 * Used to populate PopularCitiesForIntent on state intent pages.
 *
 * @param stateSlug - 2-letter state slug (e.g., "ca", "fl")
 * @param limit - Maximum number of cities to return (default: 8)
 * @returns Array of cities sorted by beach count (descending)
 */
export async function getTopCitiesInState(
  stateSlug: string,
  limit = 8
): Promise<TopCityInState[]> {
  try {
    // Get all cities with at least 1 beach
    const citiesResult = await getAllCitiesWithBeaches(1);
    if (!citiesResult.success || !citiesResult.data) return [];

    // Normalize the state slug for comparison
    const normalizedStateSlug = stateSlug.toLowerCase();

    // Filter to cities in this state
    const citiesInState = citiesResult.data.filter((city) => {
      const cityStateSlug = stateToSlug(city.state);
      return cityStateSlug === normalizedStateSlug;
    });

    // Sort by beach count (descending) and take top N
    const sortedCities = citiesInState
      .sort((a, b) => b.beachCount - a.beachCount)
      .slice(0, limit);

    // Use static collision map for consistency with sitemap canonical URLs
    const { buildCitySlug } = await import("@/lib/seo/city-slug-utils");
    const { COLLISION_CITY_MAP } = await import("@/lib/seo/city-collision-list");
    const collisionMap = COLLISION_CITY_MAP;

    // Transform to TopCityInState format
    return sortedCities.map((city) => ({
      slug: buildCitySlug(city.city, city.state, collisionMap),
      name: city.city,
      beachCount: city.beachCount,
    }));
  } catch (error) {
    console.error("Error getting top cities in state:", error);
    return [];
  }
}
