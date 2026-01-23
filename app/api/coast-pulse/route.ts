import { NextRequest, NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import ngeohash from "ngeohash";
import {
  createValidationError,
  handleApiError,
} from "@/lib/api-utils";
import { normalizeCoordinates } from "@/lib/types/coordinates";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { withRateLimit } from "@/lib/middleware/api-wrappers";
import { Database } from "@/types/database.generated";
import {
  getNearestNDBCStation,
  fetchLatestNDBCObservation,
} from "@/lib/services/ndbc-service";
import { CDIPService } from "@/lib/services/cdip-service";
import { CDIP_STATIONS } from "@/lib/constants/cdip-stations";
import { NOAACOOPSService } from "@/lib/services/noaa-coops-service";
import { CDIP_NDBC_OVERLAPS, isNDBCDuplicateOfCDIP } from "@/lib/constants/buoy-mappings";
import {
  formatBuoyMessage,
  formatTideMessage,
  formatIntelMessage,
  formatIntelSourceName,
  findNearestBeachName,
  formatForecastConditions,
} from "@/lib/utils/coast-pulse-formatter";
import { computeSummary } from "@/lib/utils/coast-pulse-summary";
import { haversineDistance, degreesToCardinal } from "@/lib/utils/geo-utils";
import {
  DISTANCE,
  TIME,
  CACHE,
  PAGINATION,
  CREDIBILITY,
} from "@/lib/constants/coast-pulse";

// Enable ISR with 2-minute revalidation
export const revalidate = CACHE.ISR_REVALIDATE_SECONDS;

// Singleton CDIP service instance
const cdipService = new CDIPService();

// Singleton NOAA CO-OPS service instance (for tide data)
const coopsService = new NOAACOOPSService();

// Database row types
type BuoyRow = Database["public"]["Tables"]["buoys"]["Row"];

// Types for Coast Pulse data
interface CoastPulseSource {
  name: string;
  type: "local" | "cdip" | "ndbc" | "forecast" | "intel" | "wind" | "tide" | "daily-intel";
  credibility: number; // 0-100
}

interface CoastPulseItem {
  id: string;
  source: CoastPulseSource;
  message: string;
  timestamp: Date;
  location?: {
    lat: number;
    lon: number;
    distanceKm: number;
  };
  trend?: "up" | "down" | "stable";
  photoUrl?: string;
  emoji_rating?: "fire" | "shaka" | "meh" | "thumbsdown";
}

interface CoastPulseSummary {
  waveHeight: string | null;
  heightType: 'offshore' | 'breaking' | 'forecast' | null;
  windSpeed: string | null;
  tideHeight: string | null; // e.g., "3.2ft Rising"
  waterTemp: string | null; // e.g., "64°F"
  trend: "improving" | "stable" | "declining" | null;
  confidence: number;
  lastUpdated: string;
}

interface CoastPulseResponse {
  items: CoastPulseItem[];
  summary: CoastPulseSummary;
  hasMore: boolean;
  nextCursor: string | null;
  nearbyBeachIds: string[];
}

/**
 * Fetch all Coast Pulse data for a geographic area
 * This is the core data fetching logic, cached by geohash
 */
async function fetchCoastPulseData(
  lat: number,
  lon: number,
  limit: number,
  before?: string // Pagination cursor
): Promise<CoastPulseResponse> {
  const supabase = await createSupabaseServerClient();
  const items: CoastPulseItem[] = [];

  // Pre-fetch beaches for cache (used by forecast and intel)
  const { data: beaches } = await supabase
    .from("beaches")
    .select("id, name, lat, lon, wind_offshore_deg")
    .not("lat", "is", null)
    .limit(PAGINATION.BEACHES_CACHE_LIMIT);

  const beachesCache = (beaches || []).map((b) => ({
    id: b.id,
    name: b.name,
    lat: b.lat,
    lon: b.lon,
    windOffshoreDeg: b.wind_offshore_deg,
  }));

  // If paginating (before cursor provided), only fetch intel
  if (before) {
    const intelItems = await fetchRecentIntel(supabase, lat, lon, beachesCache, {
      before,
      limit: limit + 1, // Fetch one extra to check hasMore
    });

    const hasMore = intelItems.length > limit;
    const returnItems = intelItems.slice(0, limit);
    const nextCursor = hasMore
      ? new Date(intelItems[limit].timestamp).toISOString() // Use the EXTRA item (index = limit)
      : (returnItems.length > 0
          ? new Date(returnItems[returnItems.length - 1].timestamp).toISOString()
          : null);

    return {
      items: returnItems,
      summary: {
        waveHeight: null,
        heightType: null,
        windSpeed: null,
        tideHeight: null,
        waterTemp: null,
        trend: null,
        confidence: 0,
        lastUpdated: new Date().toISOString(),
      },
      hasMore,
      nextCursor,
      nearbyBeachIds: [],
    };
  }

  // First page: fetch from all sources in parallel
  const [localBuoysResult, forecastResult, dailyIntelResult, intelResult, ndbcResult, cdipResult, tideResult] =
    await Promise.allSettled([
      fetchLocalBuoys(supabase, lat, lon),
      fetchEnhancedForecast(supabase, lat, lon, beachesCache),
      fetchDailyIntel(supabase, lat, lon, beachesCache),
      fetchRecentIntel(supabase, lat, lon, beachesCache, { limit: limit + 1 }),
      fetchLiveNDBCData(lat, lon),
      fetchLiveCDIPData(lat, lon),
      fetchTideData(lat, lon),
    ]);

  // Debug logging for each source (remove in production)
  if (process.env.NODE_ENV === "development") {
    console.log("Coast Pulse sources:", {
      localBuoys: localBuoysResult.status === "fulfilled"
        ? `${localBuoysResult.value.length} items`
        : `failed: ${(localBuoysResult as PromiseRejectedResult).reason}`,
      forecasts: forecastResult.status === "fulfilled"
        ? `${forecastResult.value.length} items`
        : `failed: ${(forecastResult as PromiseRejectedResult).reason}`,
      dailyIntel: dailyIntelResult.status === "fulfilled"
        ? (dailyIntelResult.value ? "1 item" : "null")
        : `failed: ${(dailyIntelResult as PromiseRejectedResult).reason}`,
      intel: intelResult.status === "fulfilled"
        ? `${intelResult.value.length} items`
        : `failed: ${(intelResult as PromiseRejectedResult).reason}`,
      ndbc: ndbcResult.status === "fulfilled"
        ? (ndbcResult.value ? "1 item" : "null")
        : `failed: ${(ndbcResult as PromiseRejectedResult).reason}`,
      cdip: cdipResult.status === "fulfilled"
        ? `${cdipResult.value.length} items`
        : `failed: ${(cdipResult as PromiseRejectedResult).reason}`,
      tide: tideResult.status === "fulfilled"
        ? (tideResult.value ? "1 item" : "null")
        : `failed: ${(tideResult as PromiseRejectedResult).reason}`,
    });
  }

  // Process local buoys
  if (
    localBuoysResult.status === "fulfilled" &&
    localBuoysResult.value.length > 0
  ) {
    items.push(...localBuoysResult.value);
  }

  // Process forecasts
  if (
    forecastResult.status === "fulfilled" &&
    forecastResult.value.length > 0
  ) {
    items.push(...forecastResult.value);
  }

  // Process daily intel (pre-computed summary - high credibility for surf recommendations)
  if (dailyIntelResult.status === "fulfilled" && dailyIntelResult.value) {
    items.push(dailyIntelResult.value);
  }

  // Process intel - track if we have more for pagination
  let intelHasMore = false;
  if (intelResult.status === "fulfilled" && intelResult.value.length > 0) {
    intelHasMore = intelResult.value.length > limit;
    items.push(...intelResult.value.slice(0, limit));
  }

  // If intel didn't indicate more (< limit in 24h), check if older posts exist
  if (!intelHasMore) {
    const twentyFourHoursAgo = new Date(Date.now() - TIME.TWENTY_FOUR_HOURS_MS).toISOString();
    const { count } = await supabase
      .from("intel_posts")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true)
      .lt("created_at", twentyFourHoursAgo);

    if (count && count > 0) {
      intelHasMore = true;
    }
  }

  // Process live CDIP data FIRST (higher credibility than NDBC)
  if (cdipResult.status === "fulfilled" && cdipResult.value.length > 0) {
    items.push(...cdipResult.value);
  }

  // Process live NDBC data (with deduplication check against CDIP)
  if (ndbcResult.status === "fulfilled" && ndbcResult.value) {
    const ndbcItem = ndbcResult.value;
    const ndbcStationId = ndbcItem.id.replace("ndbc-", "");

    // Check if this NDBC station overlaps with a CDIP station we already have
    const hasCDIPDuplicate =
      isNDBCDuplicateOfCDIP(ndbcStationId) &&
      items.some((item) => {
        if (item.source.type !== "cdip") return false;
        const cdipId = item.id.replace("cdip-", "");
        return CDIP_NDBC_OVERLAPS[cdipId] === ndbcStationId;
      });

    // Only add NDBC if no CDIP duplicate exists (CDIP has higher credibility)
    if (!hasCDIPDuplicate) {
      items.push(ndbcItem);
    }
  }

  // Process tide data
  if (tideResult.status === "fulfilled" && tideResult.value) {
    items.push(tideResult.value);
  }

  // Filter out items with "No current data" (tide stations without wave measurements)
  const itemsWithData = items.filter(
    (item) => item.message !== "No current data"
  );

  // Sort by timestamp (newest first), then by credibility for items within 30 min
  const sorted = itemsWithData.sort((a, b) => {
    const timeDiff =
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    if (Math.abs(timeDiff) < TIME.CREDIBILITY_GROUPING_MS) {
      // Within 30 min, sort by credibility
      return b.source.credibility - a.source.credibility;
    }
    return timeDiff;
  });

  // Compute summary from best available data
  const summary = computeSummary(sorted);
  const returnItems = sorted.slice(0, limit);

  // Always use last returned item's timestamp as cursor
  const nextCursor = returnItems.length > 0
    ? new Date(returnItems[returnItems.length - 1].timestamp).toISOString()
    : null;

  return {
    items: returnItems,
    summary,
    hasMore: intelHasMore,
    nextCursor,
    nearbyBeachIds: beachesCache.map(b => b.id),
  };
}

/**
 * Create a cached version of the data fetcher (first page only)
 * Paginated requests bypass cache since they're user-specific
 */
const getCachedCoastPulseData = unstable_cache(
  async (geohashKey: string, limit: number) => {
    // Decode geohash back to center coordinates
    const { latitude, longitude } = ngeohash.decode(geohashKey);
    return fetchCoastPulseData(latitude, longitude, limit);
  },
  ["coast-pulse"],
  { revalidate: CACHE.CACHE_REVALIDATE_SECONDS, tags: ["coast-pulse"] }
);

/**
 * GET /api/coast-pulse
 *
 * Aggregates live surf conditions from multiple sources:
 * - Local buoys (cached NOAA data from our database)
 * - NDBC real-time observations
 * - Enhanced forecasts
 * - User intel reports
 *
 * Query params:
 * - lat: Latitude (required)
 * - lon: Longitude (required)
 * - limit: Max items to return (default: 8, max: 15)
 * - before: ISO timestamp cursor for pagination (optional)
 */
async function coastPulseHandler(request: NextRequest) {
  try {
    // Parse and validate coordinates
    const searchParams = request.nextUrl.searchParams;
    const coords = normalizeCoordinates({
      lat: searchParams.get("lat"),
      lon: searchParams.get("lon"),
    });

    if (!coords) {
      return createValidationError("Invalid or missing lat/lon parameters");
    }

    const limit = Math.min(
      Math.max(parseInt(searchParams.get("limit") || String(PAGINATION.DEFAULT_LIMIT)), 1),
      PAGINATION.MAX_LIMIT
    );
    const before = searchParams.get("before") || undefined;

    // Validate before cursor is a valid ISO timestamp
    if (before) {
      const parsedDate = new Date(before);
      if (isNaN(parsedDate.getTime())) {
        return createValidationError("Invalid 'before' cursor: must be a valid ISO timestamp");
      }
    }

    let data;
    if (before) {
      // Paginated request - bypass cache
      data = await fetchCoastPulseData(coords.lat, coords.lon, limit, before);
    } else {
      // First page - use cache
      const geohashKey = ngeohash.encode(coords.lat, coords.lon, 4);
      data = await getCachedCoastPulseData(geohashKey, limit);
    }

    // Return with cache headers for CDN
    return NextResponse.json(
      { success: true, data, timestamp: new Date().toISOString() },
      {
        headers: {
          "Cache-Control": before
            ? "private, no-cache"
            : "public, s-maxage=120, stale-while-revalidate=300",
        },
      }
    );
  } catch (error) {
    console.error("Coast pulse error:", error);
    return handleApiError(error);
  }
}

// Type for Supabase client
type SupabaseClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

/**
 * Fetch nearby buoys from local database with their conditions
 */
async function fetchLocalBuoys(
  supabase: SupabaseClient,
  lat: number,
  lon: number
): Promise<CoastPulseItem[]> {
  try {
    // Use PostGIS to find buoys within 200km
    const { data: buoys, error } = await supabase.rpc("get_nearby_buoys", {
      target_lat: lat,
      target_lng: lon,
      max_distance_m: DISTANCE.BUOY_MAX_METERS,
      result_limit: PAGINATION.LOCAL_BUOYS_LIMIT,
    });

    if (error) {
      console.error("Error fetching local buoys:", error);
      // Fallback: try simple query without PostGIS
      const { data: fallbackBuoys } = await supabase
        .from("buoys")
        .select("*")
        .eq("active", true)
        .not("wave_height", "is", null)
        .limit(PAGINATION.LOCAL_BUOYS_LIMIT);

      if (!fallbackBuoys?.length) return [];

      return fallbackBuoys.map((buoy: BuoyRow) => ({
        id: `local-${buoy.buoy_uuid}`,
        source: {
          name: buoy.buoy_name || `Buoy ${buoy.buoy_uuid}`,
          type: "local" as const,
          credibility: CREDIBILITY.LOCAL_BUOY,
        },
        message: buoy.wave_height != null && buoy.wave_period != null
          ? formatBuoyMessage({
              heightFt: buoy.wave_height,
              periodS: buoy.wave_period,
              direction: null,  // LOCAL buoys don't have swell direction
              waterTempF: buoy.water_temperature != null
                ? buoy.water_temperature  // Already in Fahrenheit from DB
                : null,
              lat,
              lon,
            })
          : formatBuoyConditions(buoy),
        timestamp: new Date(buoy.updated_at),
        trend: "stable" as const,
      }));
    }

    if (!buoys?.length) return [];

    return buoys.map((buoy: any) => ({
      id: `local-${buoy.buoy_uuid}`,
      source: {
        name: buoy.buoy_name || `Buoy ${buoy.buoy_uuid}`,
        type: "local" as const,
        credibility: CREDIBILITY.LOCAL_BUOY,
      },
      message: buoy.wave_height != null && buoy.wave_period != null
        ? formatBuoyMessage({
            heightFt: buoy.wave_height,
            periodS: buoy.wave_period,
            direction: null,  // LOCAL buoys don't have swell direction
            waterTempF: buoy.water_temperature != null
              ? buoy.water_temperature  // Already in Fahrenheit from DB
              : null,
            lat,
            lon,
          })
        : formatBuoyConditions(buoy),
      timestamp: new Date(buoy.updated_at),
      location: {
        lat: lat,
        lon: lon,
        distanceKm: buoy.distance_meters ? buoy.distance_meters / 1000 : 0,
      },
      trend: "stable" as const,
    }));
  } catch (err) {
    console.error("Local buoys fetch error:", err);
    return [];
  }
}

/**
 * Fetch current enhanced forecast for nearby beaches
 */
async function fetchEnhancedForecast(
  supabase: SupabaseClient,
  lat: number,
  lon: number,
  beachesCache: Array<{ id: string; name: string; lat: number; lon: number; windOffshoreDeg?: number | null }> = []
): Promise<CoastPulseItem[]> {
  try {
    // Use provided cache or empty array
    const beaches = beachesCache.length > 0 ? beachesCache : [];

    if (!beaches.length) return [];

    // Find closest beach
    let closestBeach = beaches[0];
    let minDist = Infinity;
    for (const beach of beaches) {
      const dist = haversineDistance(lat, lon, beach.lat, beach.lon);
      if (dist < minDist) {
        minDist = dist;
        closestBeach = beach;
      }
    }

    if (minDist > DISTANCE.FORECAST_MAX_KM) return []; // Too far, no relevant forecast

    // Get current forecast for this beach
    const now = new Date();
    const { data: forecast } = await supabase
      .from("enhanced_forecasts")
      .select("*")
      .eq("beach_id", closestBeach.id)
      .gte("forecast_date", now.toISOString().split("T")[0])
      .order("forecast_date", { ascending: true })
      .limit(1)
      .single();

    if (!forecast) {
      // Development fallback: return mock forecast when database is empty
      if (process.env.NODE_ENV === "development") {
        return [
          {
            id: `forecast-mock-${closestBeach.id}`,
            source: {
              name: `${closestBeach.name} (mock)`,
              type: "forecast" as const,
              credibility: CREDIBILITY.FORECAST,
            },
            message: "3-4ft @ 12s, 8kt NW",
            timestamp: new Date(),
            location: {
              lat: closestBeach.lat,
              lon: closestBeach.lon,
              distanceKm: minDist,
            },
            trend: "stable" as const,
          },
        ];
      }
      return [];
    }

    return [
      {
        id: `forecast-${closestBeach.id}`,
        source: {
          name: closestBeach.name,
          type: "forecast" as const,
          credibility: CREDIBILITY.FORECAST,
        },
        message: formatForecastConditions(forecast, (closestBeach as any).windOffshoreDeg),
        timestamp: new Date(forecast.updated_at || now),
        location: {
          lat: closestBeach.lat,
          lon: closestBeach.lon,
          distanceKm: minDist,
        },
        trend: determineTrend(forecast),
      },
    ];
  } catch (err) {
    console.error("Forecast fetch error:", err);
    return [];
  }
}

/**
 * Fetch pre-computed daily intel for nearby beaches
 * This is computed 3x daily (6am, 10am, 2pm PT) and provides
 * summarized surf conditions without hitting external APIs
 */
async function fetchDailyIntel(
  supabase: SupabaseClient,
  lat: number,
  lon: number,
  beachesCache: Array<{ id: string; name: string; lat: number; lon: number }> = []
): Promise<CoastPulseItem | null> {
  try {
    // Use provided cache or empty array
    const beaches = beachesCache.length > 0 ? beachesCache : [];

    if (!beaches.length) return null;

    // Find closest beach
    let closestBeach = beaches[0];
    let minDist = Infinity;
    for (const beach of beaches) {
      const dist = haversineDistance(lat, lon, beach.lat, beach.lon);
      if (dist < minDist) {
        minDist = dist;
        closestBeach = beach;
      }
    }

    if (minDist > DISTANCE.DAILY_INTEL_MAX_KM) return null; // Too far, no relevant data

    // Get today's intel for this beach (most recent generation)
    const today = new Date().toISOString().split("T")[0];
    const { data: intel } = await supabase
      .from("beach_daily_intel")
      .select("*")
      .eq("beach_id", closestBeach.id)
      .eq("forecast_date", today)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (!intel) return null;

    // Format message from pre-computed intel
    const parts: string[] = [];

    if (intel.surf_min_ft != null && intel.surf_max_ft != null) {
      parts.push(`${intel.surf_min_ft}-${intel.surf_max_ft}ft`);
    }

    if (intel.swell_period_s != null) {
      parts.push(`@ ${intel.swell_period_s}s`);
    }

    if (intel.wind_speed_mph != null && intel.wind_direction_text) {
      parts.push(`${intel.wind_speed_mph}mph ${intel.wind_direction_text}`);
    }

    if (intel.best_window_description) {
      parts.push(`Best: ${intel.best_window_description}`);
    }

    const message = parts.length > 0 ? parts.join(", ") : intel.recommendation || "Daily conditions summary";

    return {
      id: `daily-intel-${closestBeach.id}`,
      source: {
        name: `${closestBeach.name} Daily`,
        type: "daily-intel" as const,
        credibility: CREDIBILITY.DAILY_INTEL,
      },
      message,
      timestamp: new Date(intel.created_at),
      location: {
        lat: closestBeach.lat,
        lon: closestBeach.lon,
        distanceKm: minDist,
      },
      trend: intel.conditions_score != null && intel.conditions_score > 60 ? "up" :
             intel.conditions_score != null && intel.conditions_score < 40 ? "down" : "stable",
    };
  } catch (err) {
    console.error("Daily intel fetch error:", err);
    return null;
  }
}

/**
 * Fetch recent user intel posts with optional pagination
 */
async function fetchRecentIntel(
  supabase: SupabaseClient,
  lat: number,
  lon: number,
  beachesCache: Array<{ id: string; name: string; lat: number; lon: number }> = [],
  options?: {
    before?: string; // ISO timestamp cursor for pagination
    limit?: number;
  }
): Promise<CoastPulseItem[]> {
  try {
    const limit = options?.limit || 10;
    const before = options?.before;

    let query = supabase
      .from("intel_posts")
      .select(
        `
        id,
        title,
        description,
        emoji_rating,
        created_at,
        photo_url,
        latitude,
        longitude,
        confirmations_count,
        surf_conditions,
        profiles:user_id (
          full_name
        ),
        beaches:beach_id (
          name
        )
      `
      )
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(limit + 1); // Fetch one extra to check if more exist

    if (before) {
      // Paginated request - fetch posts older than cursor
      query = query.lt("created_at", before);
    } else {
      // First page - fetch recent posts (last 24 hours)
      const twentyFourHoursAgo = new Date(Date.now() - TIME.TWENTY_FOUR_HOURS_MS).toISOString();
      query = query.gte("created_at", twentyFourHoursAgo);
    }

    const { data: posts } = await query;

    if (!posts?.length) return [];

    // Filter to nearby posts using the post's own coordinates
    const nearbyPosts = posts.filter((post: any) => {
      if (post.latitude == null || post.longitude == null) return false;
      const dist = haversineDistance(lat, lon, post.latitude, post.longitude);
      return dist <= DISTANCE.INTEL_MAX_KM;
    });

    return nearbyPosts.slice(0, limit).map((post: any) => {
      const surferName = post.profiles?.full_name || "Local Surfer";

      // Get beach name from join or nearest lookup
      const beachName =
        post.beaches?.name ||
        findNearestBeachName(post.latitude, post.longitude, beachesCache);

      return {
        id: `intel-${post.id}`,
        source: {
          name: formatIntelSourceName(surferName, beachName),
          type: "intel" as const,
          credibility: CREDIBILITY.INTEL_BASE + Math.min(post.confirmations_count || 0, CREDIBILITY.INTEL_CONFIRMATION_MAX) * CREDIBILITY.INTEL_CONFIRMATION_MULTIPLIER,
        },
        message: formatIntelMessage({
          emoji_rating: post.emoji_rating,
          surf_conditions: post.surf_conditions as any,
          description: post.description || post.title,
        }),
        timestamp: new Date(post.created_at),
        location: {
          lat: post.latitude,
          lon: post.longitude,
          distanceKm: haversineDistance(lat, lon, post.latitude, post.longitude),
        },
        photoUrl: post.photo_url || undefined,
        emoji_rating: post.emoji_rating || undefined,
      };
    });
  } catch (err) {
    console.error("Intel fetch error:", err);
    return [];
  }
}

/**
 * Fetch live NDBC buoy data directly from NOAA
 */
async function fetchLiveNDBCData(
  lat: number,
  lon: number
): Promise<CoastPulseItem | null> {
  try {
    // Find nearest NDBC station
    const station = await getNearestNDBCStation(lat, lon, DISTANCE.BUOY_MAX_KM);
    if (!station) return null;

    // Fetch latest observation
    const observation = await fetchLatestNDBCObservation(station.id);
    if (!observation) return null;

    // Check if we have actual wave data
    if (observation.wave_height_m == null && observation.wind_speed_ms == null) {
      return null;
    }

    // Format the message using enhanced formatter
    const heightFt = observation.wave_height_m != null
      ? observation.wave_height_m * 3.28084
      : null;
    const periodS = observation.wave_period_s ?? null;
    const waterTempF = observation.water_temp_c != null
      ? (observation.water_temp_c * 9 / 5) + 32
      : null;
    const direction = observation.wave_direction_deg != null
      ? degreesToCardinal(observation.wave_direction_deg)
      : null;

    const message = heightFt != null && periodS != null
      ? formatBuoyMessage({
          heightFt,
          periodS,
          direction,
          waterTempF,
          lat: station.lat,
          lon: station.lon,
        })
      : "Live data available";

    return {
      id: `ndbc-${station.id}`,
      source: {
        name: station.name,
        type: "ndbc" as const,
        credibility: CREDIBILITY.NDBC,
      },
      message,
      timestamp: new Date(observation.ts),
      location: {
        lat: station.lat,
        lon: station.lon,
        distanceKm: haversineDistance(lat, lon, station.lat, station.lon),
      },
      trend: "stable" as const,
    };
  } catch (err) {
    console.error("Live NDBC fetch error:", err);
    return null;
  }
}

/**
 * Fetch live CDIP buoy data directly from Scripps
 * Returns multiple nearby stations for better coverage
 */
async function fetchLiveCDIPData(
  lat: number,
  lon: number
): Promise<CoastPulseItem[]> {
  try {
    const items: CoastPulseItem[] = [];

    // Find all CDIP stations within range
    const nearbyStations: Array<{ id: string; distance: number; name: string }> = [];
    for (const [id, station] of Object.entries(CDIP_STATIONS)) {
      const distance = haversineDistance(lat, lon, station.latitude, station.longitude);
      if (distance <= DISTANCE.CDIP_MAX_KM) {
        nearbyStations.push({ id, distance, name: station.name });
      }
    }

    // Debug: log nearby stations found
    if (process.env.NODE_ENV === "development") {
      console.log(`🌊 CDIP: Found ${nearbyStations.length} stations within 100km:`,
        nearbyStations.map(s => `${s.name} (${s.id}) - ${s.distance.toFixed(1)}km`).join(", "));
    }

    // Sort by distance and take nearest stations
    nearbyStations.sort((a, b) => a.distance - b.distance);
    const stationsToFetch = nearbyStations.slice(0, PAGINATION.CDIP_STATIONS_LIMIT);

    if (stationsToFetch.length === 0) return [];

    // Fetch data from each station
    for (const { id: stationId, distance, name } of stationsToFetch) {
      try {
        const buoyData = await cdipService.fetchBuoyData(stationId);
        if (!buoyData || buoyData.data.length === 0) {
          if (process.env.NODE_ENV === "development") {
            console.log(`⚠️ CDIP: No data from ${name} (${stationId})`);
          }
          continue;
        }

        // Get the most recent data point
        const latest = buoyData.data[0]; // Data is sorted newest first

        // Get station location from config
        const stationConfig = CDIP_STATIONS[stationId];
        const stationLat = stationConfig?.latitude || lat;
        const stationLon = stationConfig?.longitude || lon;

        // Format the message using enhanced formatter
        const message = latest.significantWaveHeight != null && latest.peakWavePeriod != null
          ? formatBuoyMessage({
              heightFt: latest.significantWaveHeight,
              periodS: latest.peakWavePeriod,
              direction: latest.peakWaveDirection != null
                ? degreesToCardinal(latest.peakWaveDirection)
                : null,
              waterTempF: null, // CDIP doesn't provide water temp
              lat: stationLat,
              lon: stationLon,
            })
          : "Live CDIP data";

        items.push({
          id: `cdip-${stationId}`,
          source: {
            name: buoyData.stationName,
            type: "cdip" as const,
            credibility: CREDIBILITY.CDIP,
          },
          message,
          timestamp: new Date(latest.timestamp),
          location: {
            lat: stationLat,
            lon: stationLon,
            distanceKm: distance,
          },
          trend: "stable" as const,
        });
      } catch (stationErr) {
        console.error(`CDIP station ${stationId} fetch error:`, stationErr);
        // Continue with other stations
      }
    }

    return items;
  } catch (err) {
    console.error("Live CDIP fetch error:", err);
    return [];
  }
}

/**
 * Fetch live tide data from NOAA CO-OPS
 */
async function fetchTideData(
  lat: number,
  lon: number
): Promise<CoastPulseItem | null> {
  try {
    // Find nearest tide station using coordinates
    const stationId = coopsService.getStationForLocation("", lat, lon);

    // Fetch tide data (uses 30-min internal cache)
    const tideData = await coopsService.fetchCOOPSData(stationId, 2);
    if (!tideData?.tides?.length) return null;

    const now = new Date();
    const currentHeight = coopsService.getCurrentTideHeight(tideData.tides);
    const tideStatus = coopsService.getTideStatusAtTime(tideData.tides, now);
    const nextTide = coopsService.getNextTide(tideData.tides);

    if (!nextTide) return null;

    // Format time until next tide
    const msUntil = (nextTide.time * 1000) - now.getTime();
    const hoursUntil = Math.floor(msUntil / 3600000);
    const minsUntil = Math.floor((msUntil % 3600000) / 60000);

    // Format message using enhanced formatter
    const message = formatTideMessage({
      nextTideName: nextTide.name,
      nextTideHeight: nextTide.height,
      hoursUntil,
      minsUntil,
      currentHeight: currentHeight ?? 0,
      status: tideStatus,
    });

    return {
      id: `tide-${stationId}`,
      source: {
        name: tideData.station_name,
        type: "tide" as const,
        credibility: CREDIBILITY.TIDE,
      },
      message,
      timestamp: new Date(),
      location: { lat, lon, distanceKm: 0 },
      trend: tideStatus === "Rising" ? "up" : tideStatus === "Falling" ? "down" : "stable",
    };
  } catch (err) {
    console.error("Tide data fetch error:", err);
    return null;
  }
}

/**
 * Format buoy conditions into a human-readable message
 */
function formatBuoyConditions(buoy: any): string {
  const parts: string[] = [];

  if (buoy.wave_height != null) {
    parts.push(`${buoy.wave_height.toFixed(1)}ft`);
  }

  if (buoy.wave_period != null) {
    parts.push(`@ ${buoy.wave_period.toFixed(0)}s`);
  }

  if (buoy.wind_speed != null) {
    const windDir = buoy.wind_direction
      ? ` ${degreesToCardinal(buoy.wind_direction)}`
      : "";
    parts.push(`${buoy.wind_speed.toFixed(0)}kt${windDir}`);
  }

  return parts.length > 0 ? parts.join(", ") : "No current data";
}

/**
 * Determine trend from forecast data
 */
function determineTrend(
  forecast: any
): "up" | "down" | "stable" {
  // Simple trend based on swell direction or rating change
  if (forecast.trend_direction === "increasing") return "up";
  if (forecast.trend_direction === "decreasing") return "down";
  return "stable";
}

// Apply rate limiting protection
export const GET = withRateLimit(coastPulseHandler, "public-default");
