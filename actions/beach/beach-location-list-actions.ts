/**
 * Beach Location List Server Actions
 *
 * Server actions for fetching beaches by location with ranking scores.
 * Part of the AllTrails-style location browsing feature.
 *
 * Supports both individual city pages and metro area aggregates.
 */

"use server";

import { withDatabaseOperation, withServerAction, withPublicDatabaseOperation } from "@/lib/server-action-utils";
import type {
  LocationPageData,
  LocationStats,
  LocationIdentifier,
  BeachWithMetrics,
} from "@/types/location";
import {
  parseLocationFromSlug,
  normalizeCountry,
  normalizeState,
} from "@/lib/utils/location-slug";
import {
  isMetroArea,
  getMetroConfig,
  getAllMetroSlugs,
} from "@/lib/constants/metro-areas";
import { slugifyAscii } from "@/lib/utils/text-utils";
import {
  parseHiIslandCitySlug,
  getHiIslandDisplayName,
} from "@/lib/utils/beach-url-utils";
import { rankBeaches } from "@/lib/recommendations/selection";

/**
 * Resolve a city slug to the exact city name stored in the database.
 *
 * The URL slug may differ from the DB value due to:
 * - Diacritics (e.g., "rincon" → "Rincón")
 * - Hyphenated city names (e.g., "cardiff-by-the-sea" → "Cardiff-by-the-Sea")
 *
 * This function fetches all known locations and matches by normalized slug.
 *
 * @param citySlug - The incoming URL slug (e.g., "cardiff-by-the-sea")
 * @param stateSlug - The state slug (e.g., "ca")
 * @param countrySlug - The country slug (e.g., "usa")
 * @param supabase - Supabase client
 * @returns The exact city name from DB, or null if not found
 */
async function resolveCitySlugToDbCity(
  citySlug: string,
  stateSlug: string,
  countrySlug: string,
  supabase: any
): Promise<string | null> {
  const { data: locations, error } = await supabase.rpc("get_all_beach_locations");

  if (error || !locations || locations.length === 0) {
    return null;
  }

  const normalizedInputSlug = slugifyAscii(citySlug);
  const normalizedStateSlug = slugifyAscii(stateSlug);
  const normalizedCountrySlug = slugifyAscii(countrySlug);

  // Find a location where normalized slugs match
  const match = locations.find((loc: { city: string; state: string; country: string }) => {
    const locCitySlug = slugifyAscii(loc.city);
    const locStateSlug = slugifyAscii(loc.state);
    const locCountrySlug = slugifyAscii(loc.country);

    return (
      locCitySlug === normalizedInputSlug &&
      locStateSlug === normalizedStateSlug &&
      locCountrySlug === normalizedCountrySlug
    );
  });

  return match?.city ?? null;
}

/**
 * Get complete data for a location listing page
 * Now supports both individual cities and metro areas
 *
 * @param citySlug - URL slug for city or metro (e.g., "la-jolla" or "san-diego")
 * @param stateSlug - URL slug for state (e.g., "ca")
 * @param countrySlug - URL slug for country (e.g., "usa")
 * @returns Location page data with stats and ranked beaches
 */
export async function getLocationPageData(
  citySlug: string,
  stateSlug: string,
  countrySlug: string = "usa"
) {
  return withServerAction(() =>
    withPublicDatabaseOperation(async (supabase) => {
      // Check if this is a metro area request
      const metroConfig = isMetroArea(citySlug) ? getMetroConfig(citySlug) : null;

      if (metroConfig) {
        // METRO AREA LOGIC: Aggregate beaches from multiple cities
        const state = normalizeState(metroConfig.state);
        const country = normalizeCountry(metroConfig.country);

        // Fetch beaches across all cities in the metro using new function
        const { data: beaches, error: beachesError } = await supabase.rpc(
          "get_beaches_by_metro_with_scores",
          {
            p_cities: metroConfig.cities,
            p_state: state,
            p_country: country,
          }
        );

        if (beachesError) {
          console.error("Error fetching metro beaches:", beachesError);
          throw new Error(`Failed to fetch beaches: ${beachesError.message}`);
        }

        const visibleBeaches = (await rankBeaches(
          (beaches ?? []).map((beach: any, index: number) => ({
            id: beach.id,
            beach,
            index,
          })),
          { compare: (left, right) => left.index - right.index },
        )).map(({ beach }) => beach);
        if (visibleBeaches.length === 0) {
          console.warn(`[getLocationPageData] No beaches found for metro area, but metro config exists:`, {
            city: metroConfig.cities,
            state,
            country,
          });
          throw new Error("CITY_EXISTS_NO_DATA");
        }

        // Fetch metro stats
        const { data: stats, error: statsError } = await supabase.rpc(
          "get_metro_stats",
          {
            p_cities: metroConfig.cities,
            p_state: state,
            p_country: country,
          }
        );

        if (statsError) {
          console.error("Error fetching metro stats:", statsError);
          throw new Error(`Failed to fetch metro stats: ${statsError.message}`);
        }

        // Add rank to each beach (global ranking across all neighborhoods)
        const rankedBeaches: BeachWithMetrics[] = visibleBeaches.map(
          (beach: any, index: number) => ({
            ...beach,
            rank: index + 1,
          })
        );

        // Build location identifiers for metro
        const location: LocationIdentifier = {
          country,
          state,
          city: metroConfig.displayName, // Use metro display name
        };

        // Build location stats for metro
        const locationStats: LocationStats = {
          locationName: metroConfig.displayName,
          stateName: state,
          countryName: country,
          totalBeaches: stats[0]?.total_beaches || beaches.length,
          averageRating: parseFloat(String(stats[0]?.average_rating ?? 0)),
          totalReviews: stats[0]?.total_reviews || 0,
          topBeaches: stats[0]?.top_beaches || 0,
        };

        const result: LocationPageData = {
          location,
          stats: locationStats,
          beaches: rankedBeaches,
        };

        return result;
      } else {
        // SINGLE-CITY LOGIC with slug→DB-city resolution
        const state = normalizeState(parseLocationFromSlug(stateSlug));
        const country = normalizeCountry(parseLocationFromSlug(countrySlug));

        // Hawaii: handle island-suffixed city slugs (Waimea-only to start)
        const hiParsed =
          stateSlug?.toLowerCase() === "hi" ? parseHiIslandCitySlug(citySlug) : null;
        const citySlugForDb =
          hiParsed?.islandSlug != null ? hiParsed.baseCitySlug : citySlug;

        // First, try parsing the city directly from the slug
        let city = parseLocationFromSlug(citySlugForDb);

        // Fetch beaches with metrics using database function
        let { data: beachesData, error: beachesError } = await supabase.rpc(
          "get_beaches_by_location_with_scores",
          {
            p_city: city,
            p_state: state,
            p_country: country,
          }
        );

        let beaches = beachesData;

        if (beachesError) {
          // If the RPC fails (e.g. schema mismatch), treat as no data so we check for existence below
          console.error("Error fetching beaches by location (RPC):", beachesError);
          beaches = [];
        }

        // If no beaches found, attempt to resolve the city slug to the exact DB city name
        // This handles cases like:
        // - "cardiff-by-the-sea" → "Cardiff-by-the-Sea" (hyphenated)
        // - "rincon" → "Rincón" (diacritics)
        if (!beaches || beaches.length === 0) {
          const resolvedCity = await resolveCitySlugToDbCity(
            citySlugForDb,
            stateSlug,
            countrySlug,
            supabase
          );

          if (resolvedCity && resolvedCity !== city) {
            // Retry the RPC with the resolved city name
            city = resolvedCity;
            const retryResult = await supabase.rpc(
              "get_beaches_by_location_with_scores",
              {
                p_city: city,
                p_state: state,
                p_country: country,
              }
            );

            if (!retryResult.error) {
              beaches = retryResult.data;
              beachesError = null;
            }
          }
        }

        // If this is an island-specific HI city page, filter beaches to the island.
        if (hiParsed?.islandSlug && beaches && beaches.length > 0) {
          const islandName = getHiIslandDisplayName(hiParsed.islandSlug);
          const islandSlug = slugifyAscii(islandName);

          // Ensure `region` is available for filtering. Some RPCs may not return it reliably.
          // We enrich by fetching region from the beaches table for the current results.
          try {
            const ids = beaches.map((b: any) => b?.id).filter(Boolean);
            if (ids.length > 0) {
              const { data: regionRows, error: regionError } = await supabase
                .from("beaches")
                .select("id, region")
                .in("id", ids);

              if (!regionError && Array.isArray(regionRows)) {
                const regionById = new Map<string, string | null>(
                  regionRows.map((r: any) => [r.id, r.region ?? null])
                );
                beaches = beaches.map((b: any) => ({
                  ...b,
                  region: regionById.get(b.id) ?? b.region ?? null,
                }));
              }
            }
          } catch {
            // Non-fatal: if enrichment fails, we still attempt filtering with available fields.
          }

          beaches = beaches.filter((b: any) => {
            const region = typeof b?.region === "string" ? b.region : "";
            return slugifyAscii(region) === islandSlug;
          });
        }

        if (!beaches || beaches.length === 0) {
          // Check if the city actually exists in the database to differentiate
          // between "valid city with no ranked data" vs "invalid location"

          // Use exact case-insensitive match for city to avoid partial matches (e.g. "la" matching "la jolla")
          const { count } = await supabase
            .from("beaches")
            .select("*", { count: "exact", head: true })
            .ilike("city", city)
            .ilike("state", state) // Use ilike for state too just in case
            .limit(1);

          if (count && count > 0) {
            // City exists, but no data returned from the scoring function (or scoring function failed)
            // This signals the UI to redirect to the map view
            throw new Error("CITY_EXISTS_NO_DATA");
          }

          if (beachesError) {
            // If we had an error AND the city doesn't exist, rethrow the original error
            // (though likely it's just an invalid city if count is 0)
            throw new Error(`Failed to fetch beaches: ${beachesError.message}`);
          }

          console.error(`[getLocationPageData] No beaches found for location:`, {
            city,
            state,
            country,
            queryParams: { p_city: city, p_state: state, p_country: country },
          });
          throw new Error("No beaches found for this location");
        }

        const visibleBeaches = (await rankBeaches(
          (beaches ?? []).map((beach: any, index: number) => ({
            id: beach.id,
            beach,
            index,
          })),
          { compare: (left, right) => left.index - right.index },
        )).map(({ beach }) => beach);

        if (visibleBeaches.length === 0) {
          throw new Error("CITY_EXISTS_NO_DATA");
        }

        // Add rank to each beach
        const rankedBeaches: BeachWithMetrics[] = visibleBeaches.map(
          (beach: any, index: number) => ({
            ...beach,
            rank: index + 1,
          })
        );

        // Build location identifiers
        const location: LocationIdentifier = {
          country,
          state,
          city,
        };

        // Build location stats
        // Note: For HI island-suffixed pages, compute stats from the filtered list
        // (DB RPC stats are city-wide and would include other islands).
        let averageRating = 0;
        let totalReviews = 0;
        let topBeaches = 0;

        if (hiParsed?.islandSlug) {
          totalReviews = rankedBeaches.reduce(
            (sum, b) => sum + (b.review_count ?? 0),
            0
          );

          const weightedRatingSum = rankedBeaches.reduce((sum, b) => {
            const r = typeof b.average_rating === "number" ? b.average_rating : 0;
            const c = b.review_count ?? 0;
            return sum + r * c;
          }, 0);

          averageRating = totalReviews > 0 ? weightedRatingSum / totalReviews : 0;
          topBeaches = rankedBeaches.filter(
            (b) => typeof b.compositeScore === "number" && b.compositeScore >= 0.8
          ).length;
        } else {
          // Fetch location stats (standard city pages)
          const { data: stats, error: statsError } = await supabase.rpc(
            "get_location_stats",
            {
              p_city: city,
              p_state: state,
              p_country: country,
            }
          );

          if (statsError) {
            console.error("Error fetching location stats:", statsError);
            throw new Error(
              `Failed to fetch location stats: ${statsError.message}`
            );
          }

          averageRating = parseFloat(String(stats[0]?.average_rating ?? 0));
          totalReviews = stats[0]?.total_reviews || 0;
          topBeaches = stats[0]?.top_beaches || 0;
        }

        const locationStats: LocationStats = {
          locationName: city,
          stateName: state,
          countryName: country,
          totalBeaches: rankedBeaches.length,
          averageRating,
          totalReviews,
          topBeaches,
        };

        const result: LocationPageData = {
          location,
          stats: locationStats,
          beaches: rankedBeaches,
        };

        return result;
      }
    })
  );
}

/**
 * Get all beach locations for static generation
 * Now includes metro areas in addition to individual cities
 *
 * @returns Array of location identifiers with beach counts
 */
export async function getAllBeachLocations() {
  return withServerAction(() =>
    withPublicDatabaseOperation(async (supabase) => {
      const { data, error } = await supabase.rpc("get_all_beach_locations");

      if (error) {
        console.error("Error fetching all beach locations:", error);
        throw new Error(`Failed to fetch locations: ${error.message}`);
      }

      if (!data || data.length === 0) {
        return [];
      }

      // Map to consistent format
      const locations = (data as any[]).map((loc: any) => ({
        country: loc.country,
        state: loc.state,
        city: loc.city,
        beachCount: loc.beach_count,
      }));

      // Add metro areas to the list for static generation
      const metroSlugs = getAllMetroSlugs();
      const metroLocations = metroSlugs.map((slug) => {
        const config = getMetroConfig(slug);
        if (!config) return null;

        return {
          country: config.country,
          state: config.state,
          city: config.displayName,
          beachCount: 0, // Will be calculated at runtime from constituent cities
          isMetro: true,
        };
      }).filter(Boolean) as Array<{
        country: string;
        state: string;
        city: string;
        beachCount: number;
        isMetro: boolean;
      }>;

      return [...locations, ...metroLocations];
    })
  );
}
