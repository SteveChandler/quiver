/**
 * Beach Location List Server Actions
 *
 * Server actions for fetching beaches by location with ranking scores.
 * Part of the AllTrails-style location browsing feature.
 *
 * Supports both individual city pages and metro area aggregates.
 */

"use server";

import { createServerClient } from "@/lib/supabase/server";
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
        console.error(`[getLocationPageData] No beaches found for metro area:`, {
          city,
          state,
          country,
          metroConfig,
          queryParams: { p_cities: metroConfig.cities, p_state: state, p_country: country },
        });
        throw new Error("No beaches found for this metro area");
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
      const rankedBeaches: BeachWithMetrics[] = beaches.map((beach, index) => ({
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
      const { data: beaches, error: beachesError } = await supabase.rpc(
        "get_beaches_by_location_with_scores",
        {
          p_city: city,
          p_state: state,
          p_country: country,
        }
      );

      if (beachesError) {
        console.error("Error fetching beaches by location:", beachesError);
        throw new Error(`Failed to fetch beaches: ${beachesError.message}`);
      }

      if (!beaches || beaches.length === 0) {
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
      const rankedBeaches: BeachWithMetrics[] = beaches.map((beach, index) => ({
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
    const locations = data.map((loc) => ({
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

/**
 * Get statistics for a specific location
 *
 * @param city - City name
 * @param state - State abbreviation or name
 * @param country - Country name (defaults to "USA")
 * @returns Location statistics
 */
export async function getLocationStats(
  city: string,
  state: string,
  country: string = "USA"
) {
  return withDatabaseOperation(async (supabase) => {
    const { data, error } = await supabase.rpc("get_location_stats", {
      p_city: city,
      p_state: normalizeState(state),
      p_country: country,
    });

    if (error) {
      console.error("Error fetching location stats:", error);
      throw new Error(`Failed to fetch stats: ${error.message}`);
    }

    if (!data || data.length === 0) {
      throw new Error("No statistics available for this location");
    }

    const stats: LocationStats = {
      locationName: city,
      stateName: state,
      countryName: country,
      totalBeaches: data[0].total_beaches,
      averageRating: parseFloat(data[0].average_rating || "0"),
      totalReviews: data[0].total_reviews,
      topBeaches: data[0].top_beaches,
    };

    return { data: stats, error: null };
  });
}
