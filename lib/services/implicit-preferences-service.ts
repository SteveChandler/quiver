/**
 * Implicit Preferences Service
 *
 * Provides functions to fetch and work with user implicit preferences
 * for personalized beach recommendations.
 *
 * This service handles:
 * - Fetching user implicit preferences from the database
 * - Matching forecasts against inferred wave ranges
 * - Matching break types against learned preferences
 * - Checking if beaches are within travel radius
 * - Calculating implicit bonus points for recommendations
 *
 * @see docs/IMPLICIT_PREFERENCE_LEARNING.md for architecture details
 */

import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import type { UserImplicitPreferences } from "@/types/implicit-preferences";

/**
 * Forecast data for matching
 */
export interface ForecastData {
  wave_height_ft: number | null;
  wave_period_s: number;
  wind_speed_mph: number;
}

/**
 * Implicit bonus calculation result
 */
export interface ImplicitBonusResult {
  total: number;
  breakdown: {
    waveRange: number;
    breakType: number;
    topEngaged: number;
  };
}

/**
 * Bonus point values
 */
const BONUS_VALUES = {
  WAVE_RANGE: 10, // Scaled by implicitWeight
  BREAK_TYPE: 8, // Scaled by implicitWeight
  TOP_ENGAGED: 2, // Flat, always applies
} as const;

/**
 * Break type weight threshold for matching
 */
const BREAK_TYPE_THRESHOLD = 0.2;

/**
 * Fetches user's implicit preferences from the database
 *
 * @param userId - The user ID to fetch preferences for
 * @returns The user's implicit preferences, or null if not found
 * @throws Error if database query fails (excluding not found)
 */
export async function getImplicitPreferences(
  userId: string
): Promise<UserImplicitPreferences | null> {
  const supabase = createSupabaseServiceRoleClient();

  const { data, error } = await supabase
    .from("user_implicit_preferences")
    .select("*")
    .eq("user_id", userId)
    .single();

  // Handle "not found" as null, not an error
  if (error) {
    if (error.code === "PGRST116") {
      // No rows found
      return null;
    }
    throw new Error(error.message);
  }

  return data as UserImplicitPreferences;
}

/**
 * Checks if a forecast's wave height matches the user's inferred wave range
 *
 * @param forecast - The forecast data to check
 * @param preferences - The user's implicit preferences
 * @returns True if wave height is within inferred range (inclusive)
 */
export function matchesInferredWaveRange(
  forecast: ForecastData,
  preferences: UserImplicitPreferences
): boolean {
  // Validate wave height exists
  if (
    forecast.wave_height_ft === null ||
    forecast.wave_height_ft === undefined
  ) {
    return false;
  }

  // Validate preferences have wave range data
  if (
    preferences.inferred_wave_min_ft === null ||
    preferences.inferred_wave_max_ft === null
  ) {
    return false;
  }

  // Check if within range (inclusive)
  return (
    forecast.wave_height_ft >= preferences.inferred_wave_min_ft &&
    forecast.wave_height_ft <= preferences.inferred_wave_max_ft
  );
}

/**
 * Checks if a break type matches the user's learned preferences
 *
 * A break type matches if its weight is >= 0.2 threshold
 *
 * @param breakType - The break type to check (e.g., "beach", "reef", "point")
 * @param preferences - The user's implicit preferences
 * @returns True if break type weight is >= 0.2
 */
export function matchesInferredBreakType(
  breakType: string | null | undefined,
  preferences: UserImplicitPreferences
): boolean {
  // Validate break type exists
  if (!breakType) {
    return false;
  }

  // Check if weight exists and meets threshold
  const weight = preferences.break_type_weights[breakType];
  return weight !== undefined && weight >= BREAK_TYPE_THRESHOLD;
}

/**
 * Checks if a beach is within the user's travel radius using Haversine formula
 *
 * User location comes from preferences.location_centroid_lat/lon
 * Travel radius comes from preferences.typical_travel_radius_miles
 *
 * @param beachLat - Beach latitude
 * @param beachLon - Beach longitude
 * @param prefs - The user's implicit preferences (containing location centroid)
 * @returns True if beach is within travel radius
 */
export function isWithinTravelRadius(
  beachLat: number,
  beachLon: number,
  prefs: UserImplicitPreferences
): boolean {
  // Validate preferences have location data
  if (
    prefs.location_centroid_lat === null ||
    prefs.location_centroid_lon === null ||
    prefs.typical_travel_radius_miles === null
  ) {
    return false;
  }

  // Calculate distance using Haversine formula
  const distance = haversineDistance(
    beachLat,
    beachLon,
    prefs.location_centroid_lat,
    prefs.location_centroid_lon
  );

  // Check if within radius
  return distance <= prefs.typical_travel_radius_miles;
}

/**
 * Checks if a beach is in the user's top engaged beaches list
 *
 * @param beachId - The beach ID to check
 * @param preferences - The user's implicit preferences
 * @returns True if beach is in top engaged list
 */
export function isTopEngagedBeach(
  beachId: string | null | undefined,
  preferences: UserImplicitPreferences
): boolean {
  // Validate beach ID exists
  if (!beachId) {
    return false;
  }

  // Check if in top engaged list
  return preferences.top_engaged_beach_ids.includes(beachId);
}

/**
 * Calculates implicit bonus points for a beach based on user preferences
 *
 * Bonus structure:
 * - Wave range match: 10 * implicitWeight
 * - Break type match: 8 * implicitWeight
 * - Top engaged beach: 2 (flat, always applies)
 *
 * @param forecast - The forecast data to evaluate
 * @param breakType - The beach's break type
 * @param isTopEngaged - Whether beach is in user's top engaged list
 * @param prefs - The user's implicit preferences
 * @param implicitWeight - The weight to apply to scaled bonuses (0-1)
 * @returns Object with total bonus and breakdown
 */
export function calculateImplicitBonus(
  forecast: ForecastData,
  breakType: string | null | undefined,
  isTopEngaged: boolean,
  prefs: UserImplicitPreferences,
  implicitWeight: number
): ImplicitBonusResult {
  let waveRangeBonus = 0;
  let breakTypeBonus = 0;
  let topEngagedBonus = 0;

  // Wave range bonus (scaled by implicitWeight)
  if (matchesInferredWaveRange(forecast, prefs)) {
    waveRangeBonus = BONUS_VALUES.WAVE_RANGE * implicitWeight;
  }

  // Break type bonus (scaled by implicitWeight)
  if (matchesInferredBreakType(breakType, prefs)) {
    breakTypeBonus = BONUS_VALUES.BREAK_TYPE * implicitWeight;
  }

  // Top engaged bonus (flat, always applies if beach is in list)
  if (isTopEngaged) {
    topEngagedBonus = BONUS_VALUES.TOP_ENGAGED;
  }

  // Calculate total
  const total = waveRangeBonus + breakTypeBonus + topEngagedBonus;

  return {
    total,
    breakdown: {
      waveRange: waveRangeBonus,
      breakType: breakTypeBonus,
      topEngaged: topEngagedBonus,
    },
  };
}

/**
 * Calculates the great-circle distance between two points using Haversine formula
 *
 * @param lat1 - Latitude of first point (degrees)
 * @param lon1 - Longitude of first point (degrees)
 * @param lat2 - Latitude of second point (degrees)
 * @param lon2 - Longitude of second point (degrees)
 * @returns Distance in miles
 */
function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 3958.8; // Earth's radius in miles

  // Convert to radians
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  // Haversine formula
  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}
