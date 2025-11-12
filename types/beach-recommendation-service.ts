/**
 * Service types and interfaces for Beach Recommendation Service
 *
 * This service layer extracts the complex business logic from the server action
 * into a testable, maintainable service architecture following SOLID principles.
 *
 * @module beach-recommendation-service
 */

import type { Beach, Profile } from "./database";
import type { BeachRecommendation } from "./beach-recommendations";

// ============================================================================
// Branded Types for Type Safety
// ============================================================================

/**
 * Branded type for Beach IDs to prevent mixing with other string IDs
 * @example
 * const beachId: BeachId = '123e4567-e89b-12d3-a456-426614174000' as BeachId;
 */
export type BeachId = string & { readonly __brand: 'BeachId' };

/**
 * Branded type for User IDs to prevent mixing with other string IDs
 * @example
 * const userId: UserId = '123e4567-e89b-12d3-a456-426614174001' as UserId;
 */
export type UserId = string & { readonly __brand: 'UserId' };

// ============================================================================
// Location Types
// ============================================================================

/**
 * GPS coordinates for location-based searches
 * Latitude must be between -90 and 90, longitude between -180 and 180
 */
export interface Coordinates {
  /** Latitude in decimal degrees (-90 to 90) */
  lat: number;
  /** Longitude in decimal degrees (-180 to 180) */
  lon: number;
}

/**
 * Source of the search location
 */
export type LocationSource = 'gps' | 'home-beach';

/**
 * Search location determined from GPS or home beach
 */
export interface SearchLocation {
  /** Latitude in decimal degrees */
  lat: number;
  /** Longitude in decimal degrees */
  lon: number;
  /** Source of the location (GPS or user's home beach) */
  source: LocationSource;
  /** Name of home beach if using home beach location */
  homeBeachName?: string | null;
}

// ============================================================================
// Beach and Forecast Types
// ============================================================================

/**
 * Tide status values from forecast data
 */
export type TideStatus = 'Rising' | 'Falling' | 'High' | 'Low' | 'Steady';

/**
 * Confidence levels for intel data
 */
export type ConfidenceLevel = 'high' | 'medium' | 'low';

/**
 * Nearby beach result from database query
 */
export interface NearbyBeach {
  /** Unique beach identifier */
  id: string;
  /** Beach name */
  name: string;
  /** Location description (often city name) */
  location: string | null;
  /** City name */
  city?: string | null;
  /** Distance from search location in meters */
  distance_meters: number | null;
  /** Whether beach is private (excluded from recommendations) */
  is_private?: boolean | null;
}

/**
 * Forecast snapshot for a specific time
 * Data comes from enhanced_forecasts table
 */
export interface ForecastSnapshot {
  /** Beach identifier */
  beach_id: string;
  /** Forecast time in HH:MM:SS format */
  forecast_time: string | null;
  /** Wave height (e.g., "3-5 ft") */
  wave_height: string | null;
  /** Wave direction in degrees or cardinal direction */
  wave_direction: string | null;
  /** Wind speed with units (e.g., "10 mph") */
  wind_speed: string | null;
  /** Wind direction in degrees or cardinal direction */
  wind_direction: string | null;
  /** Tide height with units (e.g., "3.2 ft") */
  tide_height: string | null;
  /** Tide status (Rising, Falling, High, Low, Steady) */
  tide_status: string | null;
}

/**
 * Morning intel snapshot with AI-generated conditions
 * Data comes from beach_daily_intel table
 */
export interface IntelSnapshot {
  /** Beach identifier */
  beach_id: string;
  /** Overall conditions score (0-100) */
  conditions_score: number | null;
  /** Confidence level of the intel (high, medium, low) */
  confidence: string | null;
  /** Minimum surf height in feet */
  surf_min_ft: number | null;
  /** Maximum surf height in feet */
  surf_max_ft: number | null;
  /** Human-readable surf description */
  surf_description: string | null;
  /** Current tide height in feet */
  tide_height_ft: number | null;
  /** Tide status */
  tide_status: string | null;
  /** Wind speed in miles per hour */
  wind_speed_mph: number | null;
  /** Wind direction in degrees (0-360) */
  wind_direction_deg: number | null;
  /** Wind direction as text (N, NE, E, etc.) */
  wind_direction_text: string | null;
  /** Human-readable wind description */
  wind_description: string | null;
  /** Primary swell direction in degrees (0-360) */
  primary_swell_direction_deg: number | null;
  /** Primary swell direction as text (N, NE, E, etc.) */
  primary_swell_direction_text: string | null;
}

// ============================================================================
// User Profile Types
// ============================================================================

/**
 * User profile subset needed for recommendations
 * Only includes fields relevant to beach scoring and personalization
 */
export interface UserProfile {
  /** User's designated home beach ID */
  home_beach_id: string | null;
  /** User's surfing experience level (Beginner, Intermediate, Advanced, Expert) */
  experience_level: string | null;
}

// ============================================================================
// Service Result Types (Discriminated Union)
// ============================================================================

/**
 * Metadata about the search location used
 */
export interface SearchMetadata {
  /** Source of the location (GPS or home beach) */
  locationSource: LocationSource;
  /** Name of home beach if home beach was used */
  homeBeachName?: string | null;
}

/**
 * Successful service result
 */
export interface ServiceSuccess<T> {
  /** Indicates operation success */
  success: true;
  /** Result data */
  data: T;
  /** Optional metadata about the operation */
  metadata?: SearchMetadata;
}

/**
 * Failed service result
 */
export interface ServiceFailure<T> {
  /** Indicates operation failure */
  success: false;
  /** Empty data array for failures */
  data: T;
  /** Error message describing the failure */
  error: string;
  /** Metadata may be undefined on errors */
  metadata?: undefined;
}

/**
 * Service result wrapper with discriminated union for type-safe error handling
 *
 * Use the `success` field to narrow the type:
 * @example
 * ```typescript
 * const result = await service.getBestBeaches(userId, coords);
 * if (result.success) {
 *   // TypeScript knows result.data is available and error is not
 *   console.log(result.data);
 * } else {
 *   // TypeScript knows result.error is available
 *   console.error(result.error);
 * }
 * ```
 */
export type ServiceResult<T> = ServiceSuccess<T> | ServiceFailure<T>;

// ============================================================================
// Service Interface
// ============================================================================

/**
 * Beach Recommendation Service Interface
 *
 * Defines the contract for the beach recommendation service,
 * enabling testability through dependency injection and mocking.
 *
 * This service encapsulates all business logic for:
 * - Location resolution (GPS vs home beach)
 * - Data fetching from Supabase
 * - Beach scoring and ranking
 * - Recommendation generation
 *
 * @interface IBeachRecommendationService
 */
export interface IBeachRecommendationService {
  /**
   * Determines the search location from GPS coordinates or user's home beach
   *
   * Priority order:
   * 1. Use provided GPS coordinates if valid
   * 2. Fall back to user's home beach coordinates
   *
   * @param userId - User ID to fetch profile for home beach fallback
   * @param coords - Optional GPS coordinates from browser geolocation
   * @returns Search location with source metadata
   * @throws {Error} If profile fetch fails
   * @throws {Error} If user has no GPS coords and no home beach set
   * @throws {Error} If home beach fetch fails
   * @throws {Error} If home beach has no valid coordinates
   *
   * @example
   * ```typescript
   * // Using GPS coordinates
   * const location = await service.determineSearchLocation(userId, {
   *   lat: 33.7701,
   *   lon: -118.1937
   * });
   * console.log(location.source); // 'gps'
   *
   * // Using home beach fallback
   * const location = await service.determineSearchLocation(userId, null);
   * console.log(location.source); // 'home-beach'
   * console.log(location.homeBeachName); // 'Huntington Beach'
   * ```
   */
  determineSearchLocation(
    userId: string,
    coords?: Coordinates | null
  ): Promise<SearchLocation>;

  /**
   * Fetches nearby beaches within specified distance
   *
   * Uses PostGIS RPC function for efficient spatial queries.
   * Falls back to client-side distance calculation if RPC fails.
   * Filters out private beaches automatically.
   *
   * @param lat - Latitude of search center in decimal degrees
   * @param lon - Longitude of search center in decimal degrees
   * @param maxDistanceMeters - Maximum search radius in meters
   * @returns Array of nearby beaches sorted by distance (closest first)
   * @throws {Error} If database query fails completely
   *
   * @example
   * ```typescript
   * const beaches = await service.fetchNearbyBeaches(
   *   33.7701,
   *   -118.1937,
   *   16093 // 10 miles in meters
   * );
   * console.log(beaches.length); // Up to 25 beaches
   * console.log(beaches[0].distance_meters); // Distance to nearest beach
   * ```
   */
  fetchNearbyBeaches(
    lat: number,
    lon: number,
    maxDistanceMeters: number
  ): Promise<NearbyBeach[]>;

  /**
   * Loads beach photos from session media and featured photos
   *
   * Priority order:
   * 1. User-uploaded session photos (most recent)
   * 2. Featured beach photos
   *
   * Returns at most one photo per beach.
   *
   * @param beachIds - Array of beach IDs to load photos for
   * @returns Map of beach ID to photo URL (public URLs only)
   *
   * @example
   * ```typescript
   * const photos = await service.loadBeachPhotos(['beach-1', 'beach-2']);
   * const beachPhoto = photos.get('beach-1');
   * if (beachPhoto) {
   *   console.log(`Photo URL: ${beachPhoto}`);
   * }
   * ```
   */
  loadBeachPhotos(beachIds: string[]): Promise<Map<string, string>>;

  /**
   * Loads detailed beach information including wind and tide preferences
   *
   * Includes fields used for scoring:
   * - Skill level (Beginner, Intermediate, Advanced, Expert)
   * - Wind preferences (offshore direction, tolerance, speed thresholds)
   * - Tide preferences (min/max height in feet)
   *
   * @param beachIds - Array of beach IDs
   * @returns Array of beach details
   * @throws {Error} If database query fails
   *
   * @example
   * ```typescript
   * const details = await service.loadBeachDetails(['beach-1', 'beach-2']);
   * const beach = details.find(b => b.id === 'beach-1');
   * console.log(beach.skill_level); // 'Intermediate'
   * console.log(beach.wind_offshore_deg); // 270
   * ```
   */
  loadBeachDetails(beachIds: string[]): Promise<Beach[]>;

  /**
   * Loads morning intel data for beaches
   *
   * Intel data includes AI-generated surf forecasts with:
   * - Overall conditions score (0-100)
   * - Confidence level (high, medium, low)
   * - Wave, wind, and tide conditions
   *
   * Returns the most recent intel for each beach.
   *
   * @param beachIds - Array of beach IDs
   * @returns Map of beach ID to latest intel snapshot
   *
   * @example
   * ```typescript
   * const intel = await service.loadIntelData(['beach-1']);
   * const beachIntel = intel.get('beach-1');
   * if (beachIntel) {
   *   console.log(`Score: ${beachIntel.conditions_score}/100`);
   *   console.log(`Confidence: ${beachIntel.confidence}`);
   * }
   * ```
   */
  loadIntelData(beachIds: string[]): Promise<Map<string, IntelSnapshot>>;

  /**
   * Loads hourly forecasts for a specific date
   *
   * Returns up to 24 forecast snapshots per beach (one per hour).
   * Forecasts include wave height, direction, wind, and tide data.
   *
   * @param beachIds - Array of beach IDs
   * @param date - Date in YYYY-MM-DD format (ISO 8601)
   * @returns Map of beach ID to array of forecast snapshots (sorted by time)
   *
   * @example
   * ```typescript
   * const today = new Date().toISOString().split('T')[0];
   * const forecasts = await service.loadForecasts(['beach-1'], today);
   * const beachForecasts = forecasts.get('beach-1');
   * if (beachForecasts) {
   *   console.log(`${beachForecasts.length} hourly forecasts available`);
   *   console.log(`Next hour: ${beachForecasts[0].wave_height}`);
   * }
   * ```
   */
  loadForecasts(
    beachIds: string[],
    date: string
  ): Promise<Map<string, ForecastSnapshot[]>>;

  /**
   * Scores and ranks beaches based on conditions and user preferences
   *
   * Scoring factors:
   * - Wave direction alignment with beach orientation
   * - Wind conditions (offshore is best, onshore is worst)
   * - Tide height within beach's preferred range
   * - User skill level matching beach difficulty
   * - Intel confidence and conditions score
   *
   * Returns beaches sorted by score (highest first).
   *
   * @param beaches - Nearby beaches to score
   * @param intel - Intel data by beach ID (from loadIntelData)
   * @param forecasts - Forecast data by beach ID (from loadForecasts)
   * @param details - Beach detail data (from loadBeachDetails)
   * @param profile - User profile for personalization (can be null)
   * @returns Sorted array of beach recommendations with scores and metadata
   *
   * @example
   * ```typescript
   * const recommendations = service.scoreAndRankBeaches(
   *   nearbyBeaches,
   *   intelData,
   *   forecastData,
   *   beachDetails,
   *   userProfile
   * );
   *
   * const topBeach = recommendations[0];
   * console.log(`${topBeach.name}: ${topBeach.score}/100`);
   * console.log(`Wave height: ${topBeach.wave_height}`);
   * console.log(`Wind: ${topBeach.wind_description}`);
   * console.log(`Hidden gem: ${topBeach.is_hidden_gem}`);
   * ```
   */
  scoreAndRankBeaches(
    beaches: NearbyBeach[],
    intel: Map<string, IntelSnapshot>,
    forecasts: Map<string, ForecastSnapshot[]>,
    details: Beach[],
    profile: UserProfile | null
  ): BeachRecommendation[];

  /**
   * Main orchestration method - gets best beach recommendations
   *
   * This is the primary entry point for the service. It orchestrates:
   * 1. Location resolution (GPS or home beach)
   * 2. Nearby beach fetching
   * 3. Parallel data loading (photos, details, intel, forecasts)
   * 4. Beach scoring and ranking
   * 5. Top N recommendations with photos
   *
   * Returns up to 3 recommendations with complete metadata.
   *
   * @param userId - User ID for personalization and home beach lookup
   * @param coords - Optional GPS coordinates from browser geolocation
   * @returns Service result with top beach recommendations (discriminated union)
   *
   * @example
   * ```typescript
   * // With GPS coordinates
   * const result = await service.getBestBeaches(userId, {
   *   lat: 33.7701,
   *   lon: -118.1937
   * });
   *
   * if (result.success) {
   *   console.log(`Found ${result.data.length} beaches`);
   *   console.log(`Location source: ${result.metadata?.locationSource}`);
   *   result.data.forEach(beach => {
   *     console.log(`${beach.name}: ${beach.score}/100`);
   *   });
   * } else {
   *   console.error(`Error: ${result.error}`);
   * }
   *
   * // Without GPS (uses home beach)
   * const result = await service.getBestBeaches(userId, null);
   * ```
   */
  getBestBeaches(
    userId: string,
    coords?: Coordinates | null
  ): Promise<ServiceResult<BeachRecommendation[]>>;
}
