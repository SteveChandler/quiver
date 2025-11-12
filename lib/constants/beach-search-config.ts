/**
 * Configuration constants for beach search and recommendations
 * Centralized to avoid magic numbers throughout the codebase
 */

export const BEACH_SEARCH_CONFIG = {
  /**
   * Maximum search distance in miles from the user's location
   */
  MAX_DISTANCE_MILES: 10,

  /**
   * Maximum search distance in meters (10 miles = 16093 meters)
   */
  MAX_DISTANCE_METERS: 16093,

  /**
   * Maximum number of nearby beaches to query from database
   * This limits the initial result set before scoring and filtering
   */
  NEARBY_LIMIT: 25,

  /**
   * Fallback limit for beaches when RPC function fails
   * Used when direct query is needed instead of get_nearby_beaches RPC
   */
  FALLBACK_LIMIT: 50,

  /**
   * Hours per day (24-hour format)
   * Used for forecast time calculations
   */
  HOURS_PER_DAY: 24,

  /**
   * Minimum score threshold for a beach to be considered a "hidden gem"
   * Hidden gems are high-scoring beaches that are also uncrowded
   */
  HIDDEN_GEM_SCORE_THRESHOLD: 70,

  /**
   * Maximum number of recommendations to return to the user
   * After scoring all beaches, only top N are returned
   */
  MAX_RECOMMENDATIONS: 3,

  /**
   * Conversion factor from miles per hour to knots
   * 1 mph = 0.868976 knots
   */
  MPH_TO_KNOTS: 0.868976,

  /**
   * Meters per mile constant
   * Used for distance conversions
   */
  METERS_PER_MILE: 1609.34,
} as const;

/**
 * Type-safe access to beach search configuration
 */
export type BeachSearchConfig = typeof BEACH_SEARCH_CONFIG;
