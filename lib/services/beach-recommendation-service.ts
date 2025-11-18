/**
 * Beach Recommendation Service
 *
 * Extracts the complex business logic from getBestBeachesNearHome server action
 * into a clean, testable service layer following SOLID principles.
 *
 * Responsibilities:
 * - Location resolution (GPS vs home beach)
 * - Data fetching from Supabase (beaches, photos, intel, forecasts)
 * - Beach scoring and ranking based on conditions
 * - Recommendation generation
 *
 * @class BeachRecommendationService
 * @implements {IBeachRecommendationService}
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { withNonDeleted } from "@/lib/supabase/query-builders";
import { scoreRecommendation } from "@/lib/utils/recommendation-scorer";
import type { BeachPhotoFeatured } from "@/types/database";
import {
  getCrowdLevel,
  getDirectionAbbrev,
  getWindDescription,
} from "@/lib/utils/beach-conditions-utils";
import {
  parseNumericValue,
  parseDirectionDegrees,
  timeStringToMinutes,
  formatSurfHeight,
} from "@/lib/utils/forecast-data-utils";
import { calculateDistance } from "@/lib/utils/distance-utils";
import { BEACH_SEARCH_CONFIG } from "@/lib/constants/beach-search-config";
import { scoreBeachForUser, scoreBeachesForUser } from "@/lib/services/personalized-scoring-service";
import {
  generateOperationId,
  trackPerformance,
  trackError,
  trackUsage,
  createPerformanceTimer,
  monitoredOperation,
  updateHealthMetrics,
  OPERATIONS,
} from "@/lib/utils/beach-recommendation-monitoring";
import type {
  IBeachRecommendationService,
  Coordinates,
  SearchLocation,
  NearbyBeach,
  ForecastSnapshot,
  IntelSnapshot,
  UserProfile,
  ServiceResult,
} from "@/types/beach-recommendation-service";
import type { Beach } from "@/types/database";
import type { BeachRecommendation } from "@/types/beach-recommendations";

// Type for session media with nested session relation
interface SessionMediaWithBeach {
  session_id: string;
  public_url: string;
  media_type: string;
  created_at: string;
  session: {
    beach_id: string;
  };
}

// Cache for recommendation results
interface CacheEntry {
  data: BeachRecommendation[];
  metadata: ServiceResult<BeachRecommendation[]>['metadata'];
  timestamp: number;
}

// In-memory cache with 5-minute TTL
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const recommendationCache = new Map<string, CacheEntry>();

/**
 * Generate cache key from user ID and coordinates
 */
function getCacheKey(userId: string, coords: Coordinates | null | undefined): string {
  if (coords?.lat && coords?.lon) {
    // Round to 2 decimal places to allow cache hits for nearby locations
    const lat = Math.round(coords.lat * 100) / 100;
    const lon = Math.round(coords.lon * 100) / 100;
    return `${userId}:${lat},${lon}`;
  }
  return `${userId}:home`;
}

/**
 * Check if cache entry is still valid
 */
function isCacheValid(entry: CacheEntry): boolean {
  return Date.now() - entry.timestamp < CACHE_TTL_MS;
}

/**
 * Clean up expired cache entries
 * Called periodically to prevent memory leaks
 */
function cleanExpiredCache(): void {
  const now = Date.now();
  for (const [key, entry] of recommendationCache.entries()) {
    if (now - entry.timestamp >= CACHE_TTL_MS) {
      recommendationCache.delete(key);
    }
  }
}

/**
 * Implementation of the Beach Recommendation Service
 */
export class BeachRecommendationService implements IBeachRecommendationService {
  /**
   * Determines the search location from GPS coordinates or user's home beach
   *
   * This method implements a priority-based location resolution strategy:
   * 1. First, check if GPS coordinates are provided and valid
   * 2. If not, fall back to the user's home beach coordinates
   * 3. If neither is available, throw an error
   */
  async determineSearchLocation(
    userId: string,
    coords?: Coordinates | null
  ): Promise<SearchLocation> {
    const supabase = await createSupabaseServerClient();

    // Priority 1: Use provided GPS coordinates if valid
    // GPS coordinates take precedence because they represent the user's current location
    if (coords?.lat && coords?.lon) {
      return {
        lat: coords.lat,
        lon: coords.lon,
        source: 'gps',
      };
    }

    // Priority 2: Fallback to home beach coordinates
    // If no GPS coords provided, try to use the user's designated home beach
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("home_beach_id")
      .eq("id", userId)
      .maybeSingle();

    if (profileError) {
      throw new Error(`Failed to load profile: ${profileError.message}`);
    }

    // IMPORTANT: Null check must happen before accessing properties
    // maybeSingle() returns null if no profile exists
    if (!profile) {
      throw new Error("No GPS coordinates provided and user has no home beach set");
    }

    // Check if user has actually set a home beach
    if (!profile.home_beach_id) {
      throw new Error("No GPS coordinates provided and user has no home beach set");
    }

    // Fetch the home beach details including coordinates
    const { data: homeBeach, error: homeBeachError } = await supabase
      .from("beaches")
      .select("id, name, lat, lon")
      .eq("id", profile.home_beach_id)
      .maybeSingle();

    if (homeBeachError) {
      throw new Error(`Failed to load home beach: ${homeBeachError.message}`);
    }

    // Validate that the home beach has valid coordinates
    // Some beaches may not have coordinates in the database
    if (!homeBeach || homeBeach.lat === null || homeBeach.lon === null) {
      throw new Error("Home beach has no valid coordinates");
    }

    return {
      lat: homeBeach.lat,
      lon: homeBeach.lon,
      source: 'home-beach',
      homeBeachName: homeBeach.name,
    };
  }

  /**
   * Fetches nearby beaches within specified distance
   *
   * This method uses a two-tier approach for resilience:
   * 1. Attempt PostGIS RPC function for efficient spatial queries (preferred)
   * 2. Fall back to client-side distance calculation if RPC fails
   */
  async fetchNearbyBeaches(
    lat: number,
    lon: number,
    maxDistanceMeters: number
  ): Promise<NearbyBeach[]> {
    const supabase = await createSupabaseServerClient();

    // TIER 1: Try PostGIS RPC function first (most efficient)
    // This uses database-level spatial indexing for fast geographic queries
    let nearbyBeachesResult = await supabase.rpc("get_nearby_beaches", {
      input_lat: lat,
      input_lng: lon,
      max_distance_meters: maxDistanceMeters,
      limit_count: BEACH_SEARCH_CONFIG.NEARBY_LIMIT,
    });

    // TIER 2: Fallback to direct query + client-side distance calculation if RPC fails
    // This happens when the RPC function doesn't exist or PostGIS extension is not available
    if (nearbyBeachesResult.error) {
      console.warn(
        "[BeachRecommendationService] RPC failed, falling back to direct query",
        nearbyBeachesResult.error
      );

      // Fetch a larger set of beaches (we'll filter by distance client-side)
      const fallbackResult = await supabase
        .from("beaches")
        .select("id, name, city, lat, lon, is_private")
        .not("lat", "is", null)
        .not("lon", "is", null)
        .limit(BEACH_SEARCH_CONFIG.FALLBACK_LIMIT);

      if (fallbackResult.error) {
        throw new Error(`Failed to fetch beaches: ${fallbackResult.error.message}`);
      }

      // Calculate distances client-side using haversine formula
      const filteredFallback = (fallbackResult.data as any[] | null)?.map(
        (beach) => {
          // Validate coordinates before calculating distance
          if (
            beach?.lat == null ||
            beach?.lon == null ||
            typeof beach.lat !== "number" ||
            typeof beach.lon !== "number"
          ) {
            return {
              ...beach,
              distance_meters: null,
            };
          }

          // Calculate great-circle distance using haversine formula
          const distance = calculateDistance(
            lat,
            lon,
            beach.lat,
            beach.lon,
            "meters"
          );

          return {
            ...beach,
            location: beach.city,
            distance_meters: distance,
          };
        }
      );

      // Filter to only beaches within the specified radius
      // Also exclude private beaches and beaches with invalid distances
      nearbyBeachesResult = {
        data: filteredFallback?.filter(
          (beach) =>
            beach &&
            !beach.is_private &&
            typeof beach.distance_meters === "number" &&
            beach.distance_meters <= maxDistanceMeters
        ),
        error: null,
      };
    }

    // Type-safe array validation
    const data = nearbyBeachesResult.data;
    if (!data || !Array.isArray(data)) {
      return [];
    }

    // Final filter to ensure no private beaches slip through
    // (belt-and-suspenders approach for data quality)
    const nearbyBeaches = (data as NearbyBeach[]).filter(
      (beach) => !beach.is_private
    );

    return nearbyBeaches;
  }

  /**
   * Loads beach photos from session media and featured photos
   *
   * Uses a two-tier priority system:
   * 1. User-uploaded session photos (more authentic, recent)
   * 2. Featured beach photos (curated, always available)
   */
  async loadBeachPhotos(beachIds: string[]): Promise<Map<string, string>> {
    if (beachIds.length === 0) {
      return new Map();
    }

    const supabase = await createSupabaseServerClient();
    const beachPhotoMap = new Map<string, string>();

    try {
      // OPTIMIZED: Load both session photos and featured photos in parallel
      // This reduces total loading time by ~50ms compared to sequential loading
      const [sessionPhotosResult, featuredPhotosResult] = await Promise.all([
        // PRIORITY 1: User-uploaded session photos (more authentic, show real conditions)
        supabase
          .from("session_media")
          .select(
            `
            session_id,
            public_url,
            media_type,
            created_at,
            session:sessions!inner(beach_id)
          `
          )
          .in("media_type", ["photo", "image"])
          .in("session.beach_id", beachIds)
          .order("created_at", { ascending: false }),

        // PRIORITY 2: Featured photos (curated fallback)
        withNonDeleted(
          supabase
            .from("beach_photos_featured")
            .select("beach_id, image_url, deleted_at")
            .in("beach_id", beachIds)
        ).limit(beachIds.length),
      ]);

      // Process session photos first (higher priority)
      if (sessionPhotosResult.error) {
        console.error(
          "[BeachRecommendationService] Failed to load session photos",
          sessionPhotosResult.error
        );
      } else {
        for (const row of sessionPhotosResult.data ?? []) {
          const typedRow = row as SessionMediaWithBeach;
          const beachId = typedRow?.session?.beach_id;
          const imageUrl = typedRow?.public_url;
          if (!beachId || !imageUrl || beachPhotoMap.has(beachId)) continue;
          beachPhotoMap.set(beachId, imageUrl);
        }
      }

      // Process featured photos for beaches without session photos
      if (featuredPhotosResult.error) {
        console.error(
          "[BeachRecommendationService] Failed to load featured beach photos",
          featuredPhotosResult.error
        );
      } else {
        for (const row of featuredPhotosResult.data ?? []) {
          const typedRow = row as BeachPhotoFeatured;
          const beachId = typedRow?.beach_id;
          const imageUrl = typedRow?.image_url;
          // Only use featured photo if beach doesn't have a session photo
          if (!beachId || !imageUrl || beachPhotoMap.has(beachId)) continue;
          beachPhotoMap.set(beachId, imageUrl);
        }
      }
    } catch (photoError) {
      // Non-fatal error - missing photos won't break recommendations
      console.error(
        "[BeachRecommendationService] Unexpected error loading beach photos",
        photoError
      );
    }

    return beachPhotoMap;
  }

  /**
   * Loads detailed beach information including preferences
   */
  async loadBeachDetails(beachIds: string[]): Promise<Beach[]> {
    const supabase = await createSupabaseServerClient();

    const { data: beachDetails, error: beachDetailsError } = await supabase
      .from("beaches")
      .select(
        "id, name, slug, city, state, skill_level, wind_offshore_deg, wind_offshore_tol_deg, wind_onshore_bad_kt, wind_cross_shore_ok_kt, preferred_tide_ft_min, preferred_tide_ft_max"
      )
      .in("id", beachIds);

    if (beachDetailsError) {
      throw new Error(`Failed to load beach details: ${beachDetailsError.message}`);
    }

    return beachDetails as Beach[];
  }

  /**
   * Loads morning intel data for beaches
   */
  async loadIntelData(beachIds: string[]): Promise<Map<string, IntelSnapshot>> {
    const supabase = await createSupabaseServerClient();
    const intelByBeach = new Map<string, IntelSnapshot>();

    const { data: intelRows, error: intelError } = await supabase
      .from("beach_daily_intel")
      .select(
        "beach_id, conditions_score, confidence, surf_min_ft, surf_max_ft, surf_description, tide_height_ft, tide_status, wind_speed_mph, wind_direction_deg, wind_direction_text, wind_description, primary_swell_direction_deg, primary_swell_direction_text"
      )
      .in("beach_id", beachIds)
      .order("generated_at", { ascending: false });

    if (intelError) {
      console.warn(
        "[BeachRecommendationService] Failed to load intel rows",
        intelError
      );
      return intelByBeach;
    }

    for (const row of (intelRows as IntelSnapshot[] | null) ?? []) {
      if (!intelByBeach.has(row.beach_id)) {
        intelByBeach.set(row.beach_id, row);
      }
    }

    return intelByBeach;
  }

  /**
   * Loads hourly forecasts for today
   *
   * OPTIMIZATION: Only loads 6 hours of forecast data (current + next 5 hours)
   * instead of all 24 hours, reducing data transfer by ~75%
   */
  async loadForecasts(
    beachIds: string[],
    date: string
  ): Promise<Map<string, ForecastSnapshot[]>> {
    const supabase = await createSupabaseServerClient();
    const forecastsByBeach = new Map<string, ForecastSnapshot[]>();

    // Calculate current hour to only fetch relevant forecasts
    const now = new Date();
    const currentHour = now.getHours();
    const startTime = `${String(currentHour).padStart(2, '0')}:00:00`;

    // Only fetch next 6 hours of forecasts (current + 5 more)
    // This is enough for "best conditions right now" recommendations
    const hoursToFetch = 6;

    const { data: forecastRows, error: forecastError } = await supabase
      .from("enhanced_forecasts")
      .select(
        "beach_id, forecast_time, wave_height, wave_direction, wind_speed, wind_direction, tide_height, tide_status"
      )
      .eq("forecast_date", date)
      .in("beach_id", beachIds)
      .gte("forecast_time", startTime) // Only future forecasts
      .order("forecast_time", { ascending: true })
      .limit(beachIds.length * hoursToFetch); // Much smaller limit (6 hours vs 24 hours)

    if (forecastError) {
      console.warn(
        "[BeachRecommendationService] Failed to load forecast rows",
        forecastError
      );
      return forecastsByBeach;
    }

    for (const row of (forecastRows as ForecastSnapshot[] | null) ?? []) {
      const list = forecastsByBeach.get(row.beach_id) ?? [];
      list.push(row);
      forecastsByBeach.set(row.beach_id, list);
    }

    // Sort forecasts by time
    for (const list of forecastsByBeach.values()) {
      list.sort((a, b) => {
        const aMinutes = timeStringToMinutes(a.forecast_time) ?? Number.POSITIVE_INFINITY;
        const bMinutes = timeStringToMinutes(b.forecast_time) ?? Number.POSITIVE_INFINITY;
        return aMinutes - bMinutes;
      });
    }

    return forecastsByBeach;
  }

  /**
   * Picks the forecast snapshot closest to a target time
   *
   * This is used to find the most relevant forecast for "right now" recommendations.
   * We prefer forecasts closest to the current time to show users what conditions
   * are like at this moment, not hours from now.
   *
   * @param forecasts - Array of forecast snapshots for a beach
   * @param targetMinutes - Target time in minutes since midnight (e.g., 14:30 = 870)
   * @returns The forecast closest to the target time, or the first forecast if no match
   */
  private pickBestForecast(
    forecasts: ForecastSnapshot[] | undefined,
    targetMinutes: number
  ): ForecastSnapshot | null {
    if (!forecasts || forecasts.length === 0) return null;

    let best: ForecastSnapshot | null = null;
    let bestDiff = Number.POSITIVE_INFINITY;

    // Find the forecast with minimum time difference from target
    for (const forecast of forecasts) {
      const minutes = timeStringToMinutes(forecast.forecast_time);
      if (minutes === null) continue; // Skip invalid times

      const diff = Math.abs(minutes - targetMinutes);
      if (diff < bestDiff) {
        best = forecast;
        bestDiff = diff;
      }
    }

    // Fall back to first forecast if no valid time found
    return best ?? forecasts[0] ?? null;
  }

  /**
   * Scores and ranks beaches based on conditions and user preferences
   *
   * This method combines data from multiple sources to produce a comprehensive
   * beach recommendation with a 0-100 score. It handles missing data gracefully
   * and prioritizes AI-generated intel scores over calculated scores when available.
   *
   * OPTIMIZATION: Uses batch personalization to reduce database queries from N*3 to 3 total
   */
  async scoreAndRankBeaches(
    beaches: NearbyBeach[],
    intel: Map<string, IntelSnapshot>,
    forecasts: Map<string, ForecastSnapshot[]>,
    details: Beach[],
    profile: UserProfile | null,
    userId: string | null,
    affinityMap: Map<string, any>
  ): Promise<BeachRecommendation[]> {
    const recommendations: BeachRecommendation[] = [];
    const now = new Date();
    // Convert current time to minutes since midnight for forecast matching
    const targetMinutes = now.getHours() * 60 + now.getMinutes();

    // Prepare data for batch personalization
    const beachesForPersonalization: Array<{
      beachId: string;
      forecast: any;
      baseScore: number;
      beachData: {
        nearby: NearbyBeach;
        beachDetails: Beach;
        intelData: IntelSnapshot | null;
        forecast: ForecastSnapshot | null;
        waveHeight: string;
        waveDirection: string;
        windSpeedMph: number | null;
        windDirectionText: string | null;
        tideHeight: number | null;
        tideStatus: string;
        windDescription: string;
        finalScore: number;
        reasonsWithIntel: string[];
      };
    }> = [];

    // PHASE 1: Calculate base scores and prepare forecast data for all beaches
    for (const nearby of beaches) {
      // Match beach with its detailed information
      const beachDetails = details.find((beach) => beach.id === nearby.id);
      if (!beachDetails) continue; // Skip if no details available

      // Get intel and forecast data for this beach
      const intelData = intel.get(nearby.id) ?? null;
      const forecast = this.pickBestForecast(forecasts.get(nearby.id), targetMinutes);

      // Skip beaches with no data at all
      // (need either intel or forecast to make a recommendation)
      if (!intelData && !forecast) {
        continue;
      }

      // === DATA AGGREGATION ===
      // We prioritize AI intel data over forecast data when available
      // because intel includes human-readable descriptions and higher-quality analysis

      // Wave height: Prefer intel min/max/description, fall back to forecast
      const waveHeight = intelData
        ? formatSurfHeight(
            intelData.surf_min_ft,
            intelData.surf_max_ft,
            intelData.surf_description,
            forecast?.wave_height ?? null
          )
        : formatSurfHeight(null, null, null, forecast?.wave_height ?? null);

      // Wave direction: Try intel text → intel degrees → forecast
      const waveDirection =
        intelData?.primary_swell_direction_text ||
        (intelData?.primary_swell_direction_deg != null
          ? getDirectionAbbrev(String(intelData.primary_swell_direction_deg))
          : null) ||
        (forecast?.wave_direction ? getDirectionAbbrev(forecast.wave_direction) : "—");

      // Wind speed: Prefer intel MPH, fall back to parsed forecast
      const windSpeedMph =
        intelData?.wind_speed_mph ?? parseNumericValue(forecast?.wind_speed);

      // Wind direction: Try intel text → intel degrees → forecast
      const windDirectionText =
        intelData?.wind_direction_text ||
        (intelData?.wind_direction_deg != null
          ? getDirectionAbbrev(String(intelData.wind_direction_deg))
          : null) ||
        (forecast?.wind_direction ? getDirectionAbbrev(forecast.wind_direction) : null);

      // Tide: Prefer intel height, fall back to forecast
      const tideHeight =
        intelData?.tide_height_ft ?? parseNumericValue(forecast?.tide_height);
      const tideStatus = intelData?.tide_status || forecast?.tide_status || "Steady";

      // Wind description: Use intel description if available, otherwise generate it
      const windDescription =
        intelData?.wind_description ||
        (windSpeedMph != null && windDirectionText
          ? getWindDescription(
              windSpeedMph,
              windDirectionText,
              beachDetails.wind_offshore_deg
            )
          : "Calm");

      // === SCORE CALCULATION ===
      // Convert data to numeric format for scoring algorithm
      const waveDirectionDeg =
        intelData?.primary_swell_direction_deg ??
        parseDirectionDegrees(forecast?.wave_direction);

      const windDirectionDeg =
        intelData?.wind_direction_deg ??
        parseDirectionDegrees(forecast?.wind_direction);

      // Convert wind speed to knots (standard unit for surf forecasting)
      const windSpeedKts =
        windSpeedMph != null ? windSpeedMph * BEACH_SEARCH_CONFIG.MPH_TO_KNOTS : null;

      const tideFt = tideHeight ?? null;

      // Calculate score using physics-based algorithm
      // This considers wave/wind alignment, tide preferences, and user skill
      const { score, reasons } = scoreRecommendation(beachDetails, {
        wave_direction_deg: waveDirectionDeg ?? undefined,
        wind_direction_deg: windDirectionDeg ?? undefined,
        wind_speed_kts: windSpeedKts ?? undefined,
        tide_ft: tideFt ?? undefined,
        user_skill: profile?.experience_level ?? null,
      });

      // IMPORTANT: Prefer AI-generated intel score over calculated score
      // Intel scores are more accurate because they consider additional factors
      // like local knowledge, recent reports, and complex interactions
      const intelScore =
        intelData?.conditions_score != null && Number.isFinite(intelData.conditions_score)
          ? Number(intelData.conditions_score)
          : null;

      const finalScore = intelScore ?? score;

      // Track which scoring method was used (for debugging and transparency)
      const reasonsWithIntel = [...reasons];
      if (intelScore != null) {
        reasonsWithIntel.push("intel_score");
        if (intelData?.confidence) {
          reasonsWithIntel.push(
            `intel_confidence_${intelData.confidence.toLowerCase()}`
          );
        }
      }

      // Prepare for batch personalization (only if we have a forecast)
      if (userId && forecast) {
        // Convert forecast to format expected by scoreBeachesForUser
        const forecastForScoring = {
          wave_height: waveHeight,
          wave_period: null, // Not available in current forecast snapshot
          wind_speed: windSpeedMph,
          wind_direction: windDirectionText,
          tide_status: tideStatus,
        };

        beachesForPersonalization.push({
          beachId: nearby.id,
          forecast: forecastForScoring,
          baseScore: finalScore,
          beachData: {
            nearby,
            beachDetails,
            intelData,
            forecast,
            waveHeight,
            waveDirection,
            windSpeedMph,
            windDirectionText,
            tideHeight,
            tideStatus,
            windDescription,
            finalScore,
            reasonsWithIntel,
          },
        });
      } else {
        // No personalization for this beach - add recommendation with base score
        const crowdLevel = getCrowdLevel(beachDetails.name);
        const roundedTide = tideHeight != null ? Math.round(tideHeight * 10) / 10 : 0;
        const distanceMiles =
          nearby.distance_meters && Number.isFinite(nearby.distance_meters)
            ? (nearby.distance_meters / BEACH_SEARCH_CONFIG.METERS_PER_MILE).toFixed(1)
            : "0.0";

        recommendations.push({
          id: nearby.id,
          name: beachDetails.name,
          location: beachDetails.city ?? nearby.city ?? "",
          distance_miles: distanceMiles,
          score: Math.round(finalScore),
          reasons: reasonsWithIntel,
          image_url: null,
          slug: beachDetails.slug ?? null,
          city: beachDetails.city ?? null,
          state: beachDetails.state ?? null,
          wave_height: waveHeight,
          wave_direction: waveDirection,
          wind_speed: windSpeedMph != null ? Math.round(windSpeedMph) : 0,
          wind_description: windDescription,
          tide_status: tideStatus,
          tide_height: roundedTide,
          skill_level: beachDetails.skill_level || "Intermediate",
          crowd_level: crowdLevel,
          is_hidden_gem:
            finalScore >= BEACH_SEARCH_CONFIG.HIDDEN_GEM_SCORE_THRESHOLD &&
            crowdLevel === "Uncrowded",
        });
      }
    }

    // PHASE 2: Batch personalization (if user is authenticated)
    if (userId && beachesForPersonalization.length > 0) {
      try {
        const personalizedScores = await scoreBeachesForUser(
          userId,
          beachesForPersonalization,
          affinityMap
        );

        // Create recommendations with personalized scores
        for (const { beachId, beachData } of beachesForPersonalization) {
          const personalizedResult = personalizedScores.get(beachId);
          if (!personalizedResult) continue; // Shouldn't happen, but handle gracefully

          const {
            nearby,
            beachDetails,
            waveHeight,
            waveDirection,
            windSpeedMph,
            tideHeight,
            tideStatus,
            windDescription,
            finalScore,
            reasonsWithIntel,
          } = beachData;

          const crowdLevel = getCrowdLevel(beachDetails.name);
          const roundedTide = tideHeight != null ? Math.round(tideHeight * 10) / 10 : 0;
          const distanceMiles =
            nearby.distance_meters && Number.isFinite(nearby.distance_meters)
              ? (nearby.distance_meters / BEACH_SEARCH_CONFIG.METERS_PER_MILE).toFixed(1)
              : "0.0";

          // Add affinity data if available
          let affinityData: BeachRecommendation['affinityData'];
          const affinity = affinityMap.get(beachId);
          if (affinity) {
            affinityData = {
              sessionCount: affinity.session_count,
              lastSurfed: affinity.last_surfed_at,
              score: affinity.affinity_score
            };
          }

          const recommendation: BeachRecommendation = {
            id: beachId,
            name: beachDetails.name,
            location: beachDetails.city ?? nearby.city ?? "",
            distance_miles: distanceMiles,
            score: personalizedResult.score,
            reasons: reasonsWithIntel,
            image_url: null, // Will be populated later
            slug: beachDetails.slug ?? null,
            city: beachDetails.city ?? null,
            state: beachDetails.state ?? null,
            wave_height: waveHeight,
            wave_direction: waveDirection,
            wind_speed: windSpeedMph != null ? Math.round(windSpeedMph) : 0,
            wind_description: windDescription,
            tide_status: tideStatus,
            tide_height: roundedTide,
            skill_level: beachDetails.skill_level || "Intermediate",
            crowd_level: crowdLevel,
            is_hidden_gem:
              personalizedResult.score >= BEACH_SEARCH_CONFIG.HIDDEN_GEM_SCORE_THRESHOLD &&
              crowdLevel === "Uncrowded",
            // Personalization fields (only present if personalized)
            ...(personalizedResult.personalized && {
              baseScore: finalScore,
              personalizedScore: personalizedResult.score,
              personalized: true,
              scoreBreakdown: personalizedResult.breakdown,
              affinityData,
            }),
          };

          recommendations.push(recommendation);
        }
      } catch (error) {
        console.error('[BeachRecommendationService] Batch personalization failed:', error);
        // Fallback: Add recommendations with base scores
        for (const { beachId, baseScore, beachData } of beachesForPersonalization) {
          const {
            nearby,
            beachDetails,
            waveHeight,
            waveDirection,
            windSpeedMph,
            tideHeight,
            tideStatus,
            windDescription,
            reasonsWithIntel,
          } = beachData;

          const crowdLevel = getCrowdLevel(beachDetails.name);
          const roundedTide = tideHeight != null ? Math.round(tideHeight * 10) / 10 : 0;
          const distanceMiles =
            nearby.distance_meters && Number.isFinite(nearby.distance_meters)
              ? (nearby.distance_meters / BEACH_SEARCH_CONFIG.METERS_PER_MILE).toFixed(1)
              : "0.0";

          recommendations.push({
            id: beachId,
            name: beachDetails.name,
            location: beachDetails.city ?? nearby.city ?? "",
            distance_miles: distanceMiles,
            score: Math.round(baseScore),
            reasons: reasonsWithIntel,
            image_url: null,
            slug: beachDetails.slug ?? null,
            city: beachDetails.city ?? null,
            state: beachDetails.state ?? null,
            wave_height: waveHeight,
            wave_direction: waveDirection,
            wind_speed: windSpeedMph != null ? Math.round(windSpeedMph) : 0,
            wind_description: windDescription,
            tide_status: tideStatus,
            tide_height: roundedTide,
            skill_level: beachDetails.skill_level || "Intermediate",
            crowd_level: crowdLevel,
            is_hidden_gem:
              baseScore >= BEACH_SEARCH_CONFIG.HIDDEN_GEM_SCORE_THRESHOLD &&
              crowdLevel === "Uncrowded",
          });
        }
      }
    }

    // Sort by score descending
    recommendations.sort((a, b) => b.score - a.score);

    return recommendations;
  }

  /**
   * Main orchestration method - gets best beach recommendations
   *
   * OPTIMIZATION: Implements 5-minute result caching to avoid redundant database queries
   */
  async getBestBeaches(
    userId: string,
    coords?: Coordinates | null
  ): Promise<ServiceResult<BeachRecommendation[]>> {
    // Check cache first
    const cacheKey = getCacheKey(userId, coords);
    const cachedEntry = recommendationCache.get(cacheKey);

    if (cachedEntry && isCacheValid(cachedEntry)) {
      // Return cached result
      return {
        success: true,
        data: cachedEntry.data,
        metadata: cachedEntry.metadata,
      };
    }

    // Clean up expired cache entries every 50 requests
    // (probabilistic cleanup to avoid checking on every request)
    if (Math.random() < 0.02) { // 2% chance = ~1 in 50 requests
      cleanExpiredCache();
    }

    // Generate unique operation ID for tracking
    const operationId = generateOperationId();
    const operationTimer = createPerformanceTimer(
      OPERATIONS.GET_BEST_BEACHES,
      operationId
    );

    try {
      const supabase = await createSupabaseServerClient();

      // Step 1: Determine search location with monitoring
      let searchLocation: SearchLocation;
      try {
        searchLocation = await monitoredOperation(
          OPERATIONS.DETERMINE_LOCATION,
          operationId,
          () => this.determineSearchLocation(userId, coords),
          { hasCoords: !!coords }
        );
      } catch (error) {
        // No valid location found - track and return empty results
        trackError({
          operationId,
          operation: OPERATIONS.DETERMINE_LOCATION,
          error: error instanceof Error ? error : new Error(String(error)),
          metadata: { userId, hasCoords: !!coords },
        });

        operationTimer.finish(true, {
          reason: "no_location",
          hasCoords: !!coords,
        });

        return {
          success: true,
          data: [],
          metadata: undefined,
        };
      }

      // Fetch user profile for personalization
      let profile: UserProfile | null = null;
      const { data: profileData } = await supabase
        .from("profiles")
        .select("home_beach_id, experience_level")
        .eq("id", userId)
        .maybeSingle();
      profile = profileData;

      // Step 2: Fetch nearby beaches with monitoring
      const nearbyBeaches = await monitoredOperation(
        OPERATIONS.FETCH_NEARBY_BEACHES,
        operationId,
        () =>
          this.fetchNearbyBeaches(
            searchLocation.lat,
            searchLocation.lon,
            BEACH_SEARCH_CONFIG.MAX_DISTANCE_METERS
          ),
        {
          lat: searchLocation.lat,
          lon: searchLocation.lon,
          locationSource: searchLocation.source,
        }
      );

      if (nearbyBeaches.length === 0) {
        trackUsage({
          operationId,
          locationSource: searchLocation.source,
          userId,
          resultCount: 0,
          metadata: { reason: "no_beaches_found" },
        });

        operationTimer.finish(true, {
          locationSource: searchLocation.source,
          resultCount: 0,
        });

        return {
          success: true,
          data: [],
          metadata: {
            locationSource: searchLocation.source,
            homeBeachName: searchLocation.homeBeachName,
          },
        };
      }

      const beachIds = nearbyBeaches.map((beach) => beach.id);

      // Step 3: Load all data in parallel with monitoring
      const now = new Date();
      const currentDate = now.toISOString().split("T")[0];

      const dataLoadTimer = createPerformanceTimer(
        "load_all_data",
        operationId
      );

      // Load affinity data if user is authenticated
      let affinityMap = new Map<string, any>();
      if (userId) {
        try {
          const { data: affinities } = await supabase
            .from('user_beach_affinity')
            .select('beach_id, affinity_score, session_count, last_surfed_at')
            .eq('user_id', userId)
            .in('beach_id', beachIds);

          if (affinities) {
            for (const aff of affinities) {
              affinityMap.set(aff.beach_id, aff);
            }
          }
        } catch (error) {
          console.error('[BeachRecommendationService] Failed to load affinity data:', error);
        }
      }

      const [beachPhotos, beachDetails, intelData, forecasts] =
        await Promise.all([
          monitoredOperation(
            OPERATIONS.LOAD_BEACH_PHOTOS,
            operationId,
            () => this.loadBeachPhotos(beachIds),
            { beachCount: beachIds.length }
          ),
          monitoredOperation(
            OPERATIONS.LOAD_BEACH_DETAILS,
            operationId,
            () => this.loadBeachDetails(beachIds),
            { beachCount: beachIds.length }
          ),
          monitoredOperation(
            OPERATIONS.LOAD_INTEL_DATA,
            operationId,
            () => this.loadIntelData(beachIds),
            { beachCount: beachIds.length }
          ),
          monitoredOperation(
            OPERATIONS.LOAD_FORECASTS,
            operationId,
            () => this.loadForecasts(beachIds, currentDate),
            { beachCount: beachIds.length, date: currentDate }
          ),
        ]);

      dataLoadTimer.finish(true, {
        photosLoaded: beachPhotos.size,
        intelLoaded: intelData.size,
        forecastsLoaded: forecasts.size,
      });

      // Step 4: Score and rank beaches
      const scoringTimer = createPerformanceTimer(
        OPERATIONS.SCORE_AND_RANK,
        operationId
      );

      const recommendations = await this.scoreAndRankBeaches(
        nearbyBeaches,
        intelData,
        forecasts,
        beachDetails,
        profile,
        userId,
        affinityMap
      );

      scoringTimer.finish(true, {
        beachesScored: recommendations.length,
      });

      // Step 5: Add photos to top recommendations
      const topRecommendations = recommendations
        .slice(0, BEACH_SEARCH_CONFIG.MAX_RECOMMENDATIONS)
        .map((rec) => ({
          ...rec,
          image_url: beachPhotos.get(rec.id) ?? null,
        }));

      // Track successful completion
      trackUsage({
        operationId,
        locationSource: searchLocation.source,
        userId,
        resultCount: topRecommendations.length,
        metadata: {
          homeBeachName: searchLocation.homeBeachName,
          nearbyBeachesFound: nearbyBeaches.length,
          recommendationsGenerated: recommendations.length,
        },
      });

      operationTimer.finish(true, {
        locationSource: searchLocation.source,
        resultCount: topRecommendations.length,
      });

      // Update health metrics
      updateHealthMetrics(operationTimer.getElapsed(), true);

      // Cache the result
      const result: ServiceResult<BeachRecommendation[]> = {
        success: true,
        data: topRecommendations,
        metadata: {
          locationSource: searchLocation.source,
          homeBeachName: searchLocation.homeBeachName,
        },
      };

      recommendationCache.set(cacheKey, {
        data: topRecommendations,
        metadata: result.metadata,
        timestamp: Date.now(),
      });

      return result;
    } catch (error) {
      const errorInstance =
        error instanceof Error ? error : new Error(String(error));

      // Track error
      trackError({
        operationId,
        operation: OPERATIONS.GET_BEST_BEACHES,
        error: errorInstance,
        metadata: { userId, hasCoords: !!coords },
      });

      operationTimer.finish(false, {
        errorMessage: errorInstance.message,
      });

      // Update health metrics
      updateHealthMetrics(operationTimer.getElapsed(), false, errorInstance);

      console.error("[BeachRecommendationService] Unexpected error:", error);
      return {
        success: false,
        error: String(error),
        data: [],
        metadata: undefined,
      };
    }
  }
}
