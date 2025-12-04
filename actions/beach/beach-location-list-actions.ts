/**
 * Beach Location List Server Actions
 *
 * Server actions for fetching beaches by location with ranking scores.
 * Part of the AllTrails-style location browsing feature.
 *
 * Supports both individual city pages and metro area aggregates.
 */

"use server";

import { withDatabaseOperation } from "@/lib/server-action-utils";
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
  return withDatabaseOperation(async (supabase) => {
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

      if (!beaches || beaches.length === 0) {
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
      const rankedBeaches: BeachWithMetrics[] = beaches.map((beach: any, index: number) => ({
        ...beach,
        rank: index + 1,
      }));

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
        averageRating: parseFloat(stats[0]?.average_rating || "0"),
        totalReviews: stats[0]?.total_reviews || 0,
        topBeaches: stats[0]?.top_beaches || 0,
      };

      const result: LocationPageData = {
        location,
        stats: locationStats,
        beaches: rankedBeaches,
      };

      return { data: result, error: null };
    } else {
      // EXISTING SINGLE-CITY LOGIC (unchanged)
      const city = parseLocationFromSlug(citySlug);
      const state = normalizeState(parseLocationFromSlug(stateSlug));
      const country = normalizeCountry(parseLocationFromSlug(countrySlug));

      // Fetch beaches with metrics using database function
      const { data: beachesData, error: beachesError } = await supabase.rpc(
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

      // Fetch location stats
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
        throw new Error(`Failed to fetch location stats: ${statsError.message}`);
      }

      // Add rank to each beach
      const rankedBeaches: BeachWithMetrics[] = beaches.map((beach: any, index: number) => ({
        ...beach,
        rank: index + 1,
      }));

      // Build location identifiers
      const location: LocationIdentifier = {
        country,
        state,
        city,
      };

      // Build location stats
      const locationStats: LocationStats = {
        locationName: city,
        stateName: state,
        countryName: country,
        totalBeaches: stats[0]?.total_beaches || beaches.length,
        averageRating: parseFloat(stats[0]?.average_rating || "0"),
        totalReviews: stats[0]?.total_reviews || 0,
        topBeaches: stats[0]?.top_beaches || 0,
      };

      const result: LocationPageData = {
        location,
        stats: locationStats,
        beaches: rankedBeaches,
      };

      return { data: result, error: null };
    }
  });
}

/**
 * Get all beach locations for static generation
 * Now includes metro areas in addition to individual cities
 *
 * @returns Array of location identifiers with beach counts
 */
export async function getAllBeachLocations() {
  return withDatabaseOperation(async (supabase) => {
    const { data, error } = await supabase.rpc("get_all_beach_locations");

    if (error) {
      console.error("Error fetching all beach locations:", error);
      throw new Error(`Failed to fetch locations: ${error.message}`);
    }

    if (!data || data.length === 0) {
      return { data: [], error: null };
    }

    // Map to consistent format
    const locations = data.map((loc: any) => ({
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

    return { data: [...locations, ...metroLocations], error: null };
  });
}

