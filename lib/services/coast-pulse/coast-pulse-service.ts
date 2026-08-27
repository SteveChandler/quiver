/**
 * Coast Pulse service — aggregates live surf conditions from multiple sources.
 *
 * Sources:
 * - Local buoys (cached NOAA data from our database)
 * - NDBC real-time observations
 * - CDIP buoy data from Scripps
 * - NOAA CO-OPS tide data
 * - Enhanced forecasts
 * - Daily intel (pre-computed summaries)
 * - User intel reports
 */

import { unstable_cache } from "next/cache";
import ngeohash from "ngeohash";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { SupabaseServerClient } from "@/types/supabase";
import { Database } from "@/types/database.generated";
import {
  getNearestNDBCStation,
  fetchLatestNDBCObservation,
} from "@/lib/services/ndbc-service";
import { CDIPService } from "@/lib/services/cdip";
import { CDIP_STATIONS } from "@/lib/constants/cdip-stations";
import { NOAACOOPSService } from "@/lib/services/noaa-coops";
import {
  CDIP_NDBC_OVERLAPS,
  isNDBCDuplicateOfCDIP,
  isLocalBuoyNDBCStation,
} from "@/lib/constants/buoy-mappings";
import {
  formatBuoyMessage,
  formatTideMessage,
  formatIntelMessage,
  formatIntelSourceName,
  findNearestBeachName,
  formatForecastConditions,
} from "@/lib/utils/coast-pulse-formatter";
import { getDisplayName } from "@/lib/utils/display-name-utils";
import { computeSummary } from "@/lib/utils/coast-pulse-summary";
import { haversineDistance, degreesToCardinal } from "@/lib/utils/geo-utils";
import { getDailyIntelWaveHeightLabels } from "@/lib/services/intel/wave-height-labels";
import { fetchCurrentBeachWind } from "@/lib/services/current-beach-wind";
import {
  rankBeaches,
  selectBeach,
} from "@/lib/recommendations/selection";
import { WATER_QUALITY_HOLD_PREFETCH_BUFFER } from "@/lib/recommendations/major-event-hold/water-quality";
import {
  DISTANCE,
  TIME,
  CACHE,
  PAGINATION,
  CREDIBILITY,
} from "@/lib/constants/coast-pulse";

import type {
  CoastPulseItem,
  CoastPulseResponse,
  CoastPulseParams,
  BeachCacheEntry,
} from "./coast-pulse-types";

// Re-export types for convenience
export type { CoastPulseItem, CoastPulseResponse, CoastPulseParams } from "./coast-pulse-types";

// Database row types
type BuoyRow = Database["public"]["Tables"]["buoys"]["Row"];

// Singleton CDIP service instance
const cdipService = new CDIPService();

// Singleton NOAA CO-OPS service instance (for tide data)
const coopsService = new NOAACOOPSService();

/**
 * Main entry point: generate Coast Pulse data for a location.
 * Handles caching for first-page requests and bypasses cache for pagination.
 */
export async function generateCoastPulse(
  params: CoastPulseParams
): Promise<CoastPulseResponse> {
  const { lat, lon, limit, before } = params;

  if (before) {
    // Paginated request - bypass cache
    return fetchCoastPulseData(lat, lon, limit, before);
  }

  // First page - use cache keyed by geohash
  const geohashKey = ngeohash.encode(lat, lon, 4);
  return getCachedCoastPulseData(geohashKey, limit);
}

/**
 * Fetch all Coast Pulse data for a geographic area.
 * This is the core data fetching logic.
 */
async function fetchCoastPulseData(
  lat: number,
  lon: number,
  limit: number,
  before?: string
): Promise<CoastPulseResponse> {
  const supabase = await createSupabaseServerClient();
  const items: CoastPulseItem[] = [];

  // Pre-fetch beaches for cache (used by forecast and intel)
  const { data: beaches } = await supabase
    .from("beaches")
    .select("id, name, lat, lon, wind_offshore_deg, timezone")
    .not("lat", "is", null)
    .limit(PAGINATION.BEACHES_CACHE_LIMIT + WATER_QUALITY_HOLD_PREFETCH_BUFFER);

  const beachesCache: BeachCacheEntry[] = await rankBeaches(
    (beaches || []).map((b) => ({
      id: b.id,
      name: b.name,
      lat: b.lat ?? 0,
      lon: b.lon ?? 0,
      windOffshoreDeg: b.wind_offshore_deg,
      timezone: b.timezone,
    })),
    {
      compare: (left, right) =>
        haversineDistance(lat, lon, left.lat, left.lon) -
        haversineDistance(lat, lon, right.lat, right.lon),
    },
  );

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
      : returnItems.length > 0
        ? new Date(returnItems[returnItems.length - 1].timestamp).toISOString()
        : null;

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
  const [
    localBuoysResult,
    forecastResult,
    dailyIntelResult,
    intelResult,
    ndbcResult,
    cdipResult,
    tideResult,
  ] = await Promise.allSettled([
    fetchLocalBuoys(supabase, lat, lon),
    fetchEnhancedForecast(supabase, lat, lon, beachesCache),
    fetchDailyIntel(supabase, lat, lon, beachesCache),
    fetchRecentIntel(supabase, lat, lon, beachesCache, { limit: limit + 1 }),
    fetchLiveNDBCData(lat, lon),
    fetchLiveCDIPData(lat, lon),
    fetchTideData(lat, lon),
  ]);

  // Debug logging for each source
  if (process.env.NODE_ENV === "development") {
    console.log("Coast Pulse sources:", {
      localBuoys:
        localBuoysResult.status === "fulfilled"
          ? `${localBuoysResult.value.length} items`
          : `failed: ${(localBuoysResult as PromiseRejectedResult).reason}`,
      forecasts:
        forecastResult.status === "fulfilled"
          ? `${forecastResult.value.length} items`
          : `failed: ${(forecastResult as PromiseRejectedResult).reason}`,
      dailyIntel:
        dailyIntelResult.status === "fulfilled"
          ? dailyIntelResult.value
            ? "1 item"
            : "null"
          : `failed: ${(dailyIntelResult as PromiseRejectedResult).reason}`,
      intel:
        intelResult.status === "fulfilled"
          ? `${intelResult.value.length} items`
          : `failed: ${(intelResult as PromiseRejectedResult).reason}`,
      ndbc:
        ndbcResult.status === "fulfilled"
          ? ndbcResult.value
            ? "1 item"
            : "null"
          : `failed: ${(ndbcResult as PromiseRejectedResult).reason}`,
      cdip:
        cdipResult.status === "fulfilled"
          ? `${cdipResult.value.length} items`
          : `failed: ${(cdipResult as PromiseRejectedResult).reason}`,
      tide:
        tideResult.status === "fulfilled"
          ? tideResult.value
            ? "1 item"
            : "null"
          : `failed: ${(tideResult as PromiseRejectedResult).reason}`,
    });
  }

  // Process local buoys (with dedup against CDIP/NDBC)
  if (
    localBuoysResult.status === "fulfilled" &&
    localBuoysResult.value.length > 0
  ) {
    for (const localItem of localBuoysResult.value) {
      const localUuid = localItem.id.replace("local-", "");
      // Skip if this is an NDBC station ID that overlaps with a CDIP station
      if (isLocalBuoyNDBCStation(localUuid) && isNDBCDuplicateOfCDIP(localUuid)) {
        continue;
      }
      items.push(localItem);
    }
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

  // If intel didn't indicate more (< limit in 24h), check if nearby older posts exist within 7 days
  if (!intelHasMore) {
    const twentyFourHoursAgo = new Date(
      Date.now() - TIME.TWENTY_FOUR_HOURS_MS
    ).toISOString();
    const maxAge = new Date(Date.now() - TIME.MAX_INTEL_AGE_MS).toISOString();
    // Approximate bounding box for INTEL_MAX_KM (~50km)
    const latDelta = DISTANCE.INTEL_MAX_KM / 111;
    const lonDelta =
      DISTANCE.INTEL_MAX_KM / (111 * Math.cos((lat * Math.PI) / 180));
    const { count } = await supabase
      .from("intel_posts")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true)
      .lt("created_at", twentyFourHoursAgo)
      .gte("created_at", maxAge)
      .gte("latitude", lat - latDelta)
      .lte("latitude", lat + latDelta)
      .gte("longitude", lon - lonDelta)
      .lte("longitude", lon + lonDelta);

    if (count && count > 0) {
      intelHasMore = true;
    }
  }

  // Process live CDIP data FIRST (higher credibility than NDBC)
  if (cdipResult.status === "fulfilled" && cdipResult.value.length > 0) {
    items.push(...cdipResult.value);
  }

  // Process live NDBC data (with deduplication check against CDIP and LOCAL)
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

    // Check if we already have the same station as a LOCAL buoy
    const hasLocalDuplicate = items.some(
      (item) =>
        item.source.type === "local" &&
        item.id.replace("local-", "") === ndbcStationId
    );

    // Only add NDBC if no CDIP or LOCAL duplicate exists
    if (!hasCDIPDuplicate && !hasLocalDuplicate) {
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

  // Filter out stale buoy/sensor data (older than 6 hours)
  const now = Date.now();
  const sensorTypes = new Set(["local", "cdip", "ndbc", "tide"]);
  const freshItems = itemsWithData.filter((item) => {
    // Only apply age filter to sensor sources (not intel or forecast)
    if (!sensorTypes.has(item.source.type)) return true;
    return now - new Date(item.timestamp).getTime() <= TIME.MAX_BUOY_AGE_MS;
  });

  // Proximity-based dedup for buoy sources (catches geographic overlap even when station IDs don't match)
  const deduped = deduplicateBuoyItems(freshItems);

  // Sort by timestamp (newest first), then by credibility for items within 30 min
  const sorted = deduped.sort((a, b) => {
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
  const nextCursor =
    returnItems.length > 0
      ? new Date(returnItems[returnItems.length - 1].timestamp).toISOString()
      : null;

  return {
    items: returnItems,
    summary,
    hasMore: intelHasMore,
    nextCursor,
    nearbyBeachIds: beachesCache.map((b) => b.id),
  };
}

/**
 * Create a cached version of the data fetcher (first page only).
 * Paginated requests bypass cache since they're user-specific.
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

// ---------------------------------------------------------------------------
// Individual data source fetchers
// ---------------------------------------------------------------------------

/**
 * Fetch nearby buoys from local database with their conditions
 */
async function fetchLocalBuoys(
  supabase: SupabaseServerClient,
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
        message:
          buoy.wave_height != null && buoy.wave_period != null
            ? formatBuoyMessage({
                heightFt: buoy.wave_height,
                periodS: buoy.wave_period,
                direction: null, // LOCAL buoys don't have swell direction
                waterTempF:
                  buoy.water_temperature != null
                    ? buoy.water_temperature // Already in Fahrenheit from DB
                    : null,
                lat,
                lon,
              })
            : formatBuoyConditions(buoy),
        timestamp: new Date(buoy.updated_at),
        windSpeedMph:
          buoy.wind_speed == null ? null : Number(buoy.wind_speed) * 1.15078,
        windDirection:
          buoy.wind_direction == null
            ? null
            : degreesToCardinal(Number(buoy.wind_direction)),
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
      message:
        buoy.wave_height != null && buoy.wave_period != null
          ? formatBuoyMessage({
              heightFt: buoy.wave_height,
              periodS: buoy.wave_period,
              direction: null, // LOCAL buoys don't have swell direction
              waterTempF:
                buoy.water_temperature != null
                  ? buoy.water_temperature // Already in Fahrenheit from DB
                  : null,
              lat,
              lon,
            })
          : formatBuoyConditions(buoy),
      timestamp: new Date(buoy.updated_at),
      windSpeedMph:
        buoy.wind_speed == null ? null : Number(buoy.wind_speed) * 1.15078,
      windDirection:
        buoy.wind_direction == null
          ? null
          : degreesToCardinal(Number(buoy.wind_direction)),
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
  supabase: SupabaseServerClient,
  lat: number,
  lon: number,
  beachesCache: BeachCacheEntry[] = []
): Promise<CoastPulseItem[]> {
  try {
    const beaches = beachesCache.length > 0 ? beachesCache : [];
    if (!beaches.length) return [];

    // Find closest beach
    const rankedBeaches = await rankBeaches(beaches, {
      compare: (left, right) =>
        haversineDistance(lat, lon, left.lat, left.lon) -
        haversineDistance(lat, lon, right.lat, right.lon),
    });
    const closestBeach = rankedBeaches[0];
    if (!closestBeach) return [];
    const minDist = haversineDistance(lat, lon, closestBeach.lat, closestBeach.lon);

    if (minDist > DISTANCE.FORECAST_MAX_KM) return []; // Too far, no relevant forecast

    // Get current forecast for this beach
    const now = new Date();
    const [forecastResult, currentWind] = await Promise.all([
      supabase
        .from("enhanced_forecasts")
        .select("*")
        .eq("beach_id", closestBeach.id)
        .gte("forecast_at", `${now.toISOString().split("T")[0]}T00:00:00Z`)
        .lte("forecast_at", now.toISOString())
        .order("forecast_at", { ascending: false })
        .limit(1)
        .single(),
      fetchCurrentBeachWind(supabase, closestBeach.id),
    ]);
    const forecast = forecastResult.data;

    if (!forecast) {
      if (currentWind) {
        return [
          {
            id: `wind-${closestBeach.id}-${currentWind.observedAt}`,
            source: {
              name: `${closestBeach.name} wind`,
              type: "wind" as const,
              credibility: CREDIBILITY.RTMA,
            },
            message: `${Math.round(currentWind.windSpeedMph)} mph${
              currentWind.windDirection ? ` ${currentWind.windDirection}` : ""
            }`,
            timestamp: new Date(currentWind.observedAt),
            windSpeedMph: currentWind.windSpeedMph,
            windDirection: currentWind.windDirection,
            windObservedAt: currentWind.observedAt,
            windSource: currentWind.source,
            location: {
              lat: closestBeach.lat,
              lon: closestBeach.lon,
              distanceKm: minDist,
            },
            trend: "stable" as const,
          },
        ];
      }
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

    const forecastWithCurrentWind = currentWind
      ? {
          ...forecast,
          wind_speed: `${currentWind.windSpeedMph} mph`,
          wind_direction: currentWind.windDirection,
          wind_source: currentWind.source,
        }
      : forecast;

    return [
      {
        id: `forecast-${closestBeach.id}`,
        source: {
          name: closestBeach.name,
          type: "forecast" as const,
          credibility: CREDIBILITY.FORECAST,
        },
        message: formatForecastConditions(
          forecastWithCurrentWind,
          (closestBeach as any).windOffshoreDeg
        ),
        timestamp: new Date(forecast.updated_at || now),
        windSpeedMph:
          currentWind?.windSpeedMph ??
          (forecast.wind_speed == null
            ? null
            : Number.parseFloat(String(forecast.wind_speed))),
        windDirection: currentWind
          ? currentWind.windDirection
          : forecast.wind_direction,
        windObservedAt: currentWind?.observedAt ?? null,
        windSource: currentWind?.source ?? forecast.wind_source,
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
 * Fetch pre-computed daily intel for nearby beaches.
 * Computed 3x daily (6am, 10am, 2pm PT) and provides
 * summarized surf conditions without hitting external APIs.
 */
async function fetchDailyIntel(
  supabase: SupabaseServerClient,
  lat: number,
  lon: number,
  beachesCache: BeachCacheEntry[] = []
): Promise<CoastPulseItem | null> {
  try {
    const beaches = beachesCache.length > 0 ? beachesCache : [];
    if (!beaches.length) return null;

    // Find closest beach
    const rankedBeaches = await rankBeaches(beaches, {
      compare: (left, right) =>
        haversineDistance(lat, lon, left.lat, left.lon) -
        haversineDistance(lat, lon, right.lat, right.lon),
    });
    const closestBeach = rankedBeaches[0];
    if (!closestBeach) return null;
    const minDist = haversineDistance(lat, lon, closestBeach.lat, closestBeach.lon);

    if (minDist > DISTANCE.DAILY_INTEL_MAX_KM) return null; // Too far

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

    const waveLabels = await getDailyIntelWaveHeightLabels(
      supabase,
      closestBeach.id,
      today,
      {
        bestWindowStart: intel.best_window_start,
        bestWindowEnd: intel.best_window_end,
      },
      closestBeach.timezone
    );

    if (waveLabels.current_wave_height_label) {
      parts.push(waveLabels.current_wave_height_label);
    } else if (intel.surf_min_ft != null && intel.surf_max_ft != null) {
      parts.push(`${intel.surf_min_ft}-${intel.surf_max_ft}ft`);
    }

    if (intel.primary_swell_period_s != null) {
      parts.push(`@ ${intel.primary_swell_period_s}s`);
    }

    if (intel.wind_speed_mph != null && intel.wind_direction_text) {
      parts.push(`${intel.wind_speed_mph}mph ${intel.wind_direction_text}`);
    }

    if (intel.best_window_description) {
      parts.push(`Best: ${intel.best_window_description}`);
    }

    const message =
      parts.length > 0
        ? parts.join(", ")
        : intel.recommendation || "Daily conditions summary";

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
      trend:
        intel.conditions_score != null && intel.conditions_score > 60
          ? "up"
          : intel.conditions_score != null && intel.conditions_score < 40
            ? "down"
            : "stable",
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
  supabase: SupabaseServerClient,
  lat: number,
  lon: number,
  beachesCache: BeachCacheEntry[] = [],
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
          id,
          name
        )
      `
      )
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(limit + 1); // Fetch one extra to check if more exist

    if (before) {
      // Paginated request - fetch posts older than cursor, but not older than 7 days
      const maxAge = new Date(Date.now() - TIME.MAX_INTEL_AGE_MS).toISOString();
      query = query.lt("created_at", before).gte("created_at", maxAge);
    } else {
      // First page - fetch recent posts (last 24 hours)
      const twentyFourHoursAgo = new Date(
        Date.now() - TIME.TWENTY_FOUR_HOURS_MS
      ).toISOString();
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

    const safePosts = (
      await Promise.all(
        nearbyPosts.map(async (post: any) => {
          if (
            post.beaches?.id &&
            !(await selectBeach({
              id: post.beaches.id,
              name: post.beaches.name,
            }))
          ) {
            return null;
          }
          return post;
        }),
      )
    ).filter((post): post is any => post !== null);

    return safePosts.slice(0, limit).map((post: any) => {
      const rawName = post.profiles?.full_name || "Local Surfer";
      const surferName = getDisplayName(rawName, post.id);

      // Get beach name from join or nearest lookup
      const beachName =
        post.beaches?.name ||
        findNearestBeachName(post.latitude, post.longitude, beachesCache);

      return {
        id: `intel-${post.id}`,
        source: {
          name: formatIntelSourceName(surferName, beachName),
          type: "intel" as const,
          credibility:
            CREDIBILITY.INTEL_BASE +
            Math.min(
              post.confirmations_count || 0,
              CREDIBILITY.INTEL_CONFIRMATION_MAX
            ) *
              CREDIBILITY.INTEL_CONFIRMATION_MULTIPLIER,
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
          distanceKm: haversineDistance(
            lat,
            lon,
            post.latitude,
            post.longitude
          ),
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
    if (
      observation.wave_height_m == null &&
      observation.wind_speed_ms == null
    ) {
      return null;
    }

    // Format the message using enhanced formatter
    const heightFt =
      observation.wave_height_m != null
        ? observation.wave_height_m * 3.28084
        : null;
    const periodS = observation.wave_period_s ?? null;
    const waterTempF =
      observation.water_temp_c != null
        ? (observation.water_temp_c * 9) / 5 + 32
        : null;
    const direction =
      observation.wave_direction_deg != null
        ? degreesToCardinal(observation.wave_direction_deg)
        : null;

    const message =
      heightFt != null && periodS != null
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
      windSpeedMph:
        observation.wind_speed_ms == null
          ? null
          : observation.wind_speed_ms * 2.236936,
      windDirection:
        observation.wind_direction_deg == null
          ? null
          : degreesToCardinal(observation.wind_direction_deg),
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
 * Fetch live CDIP buoy data directly from Scripps.
 * Returns multiple nearby stations for better coverage.
 */
async function fetchLiveCDIPData(
  lat: number,
  lon: number
): Promise<CoastPulseItem[]> {
  try {
    const items: CoastPulseItem[] = [];

    // Find all CDIP stations within range
    const nearbyStations: Array<{
      id: string;
      distance: number;
      name: string;
    }> = [];
    for (const [id, station] of Object.entries(CDIP_STATIONS)) {
      const distance = haversineDistance(
        lat,
        lon,
        station.latitude,
        station.longitude
      );
      if (distance <= DISTANCE.CDIP_MAX_KM) {
        nearbyStations.push({ id, distance, name: station.name });
      }
    }

    // Debug: log nearby stations found
    if (process.env.NODE_ENV === "development") {
      console.log(
        `CDIP: Found ${nearbyStations.length} stations within 100km:`,
        nearbyStations
          .map(
            (s) => `${s.name} (${s.id}) - ${s.distance.toFixed(1)}km`
          )
          .join(", ")
      );
    }

    // Sort by distance and take nearest stations
    nearbyStations.sort((a, b) => a.distance - b.distance);
    const stationsToFetch = nearbyStations.slice(
      0,
      PAGINATION.CDIP_STATIONS_LIMIT
    );

    if (stationsToFetch.length === 0) return [];

    // Fetch data from each station
    for (const { id: stationId, distance, name } of stationsToFetch) {
      try {
        const buoyData = await cdipService.fetchBuoyData(stationId);
        if (!buoyData || buoyData.data.length === 0) {
          if (process.env.NODE_ENV === "development") {
            console.log(`CDIP: No data from ${name} (${stationId})`);
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
        const message =
          latest.significantWaveHeight != null &&
          latest.peakWavePeriod != null
            ? formatBuoyMessage({
                heightFt: latest.significantWaveHeight,
                periodS: latest.peakWavePeriod,
                direction:
                  latest.peakWaveDirection != null
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
    const msUntil = nextTide.time * 1000 - now.getTime();
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
      trend:
        tideStatus === "Rising"
          ? "up"
          : tideStatus === "Falling"
            ? "down"
            : "stable",
    };
  } catch (err) {
    console.error("Tide data fetch error:", err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

/**
 * Deduplicate buoy items that are geographically close.
 * When two buoy sources (local/cdip/ndbc) are within 5km,
 * keep only the highest-credibility one.
 */
function deduplicateBuoyItems(items: CoastPulseItem[]): CoastPulseItem[] {
  const buoyTypes = new Set(["local", "cdip", "ndbc"]);
  const buoyItems = items.filter(
    (i) => buoyTypes.has(i.source.type) && i.location
  );
  const nonBuoyItems = items.filter(
    (i) => !buoyTypes.has(i.source.type) || !i.location
  );

  // Sort buoys by credibility (highest first) so we keep the best
  buoyItems.sort((a, b) => b.source.credibility - a.source.credibility);

  const kept: CoastPulseItem[] = [];
  for (const item of buoyItems) {
    const isDuplicate = kept.some((k) => {
      if (!k.location || !item.location) return false;
      const dist = haversineDistance(
        k.location.lat,
        k.location.lon,
        item.location.lat,
        item.location.lon
      );
      return dist < 5; // 5km threshold
    });
    if (!isDuplicate) {
      kept.push(item);
    }
  }

  return [...nonBuoyItems, ...kept];
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
function determineTrend(forecast: any): "up" | "down" | "stable" {
  if (forecast.trend_direction === "increasing") return "up";
  if (forecast.trend_direction === "decreasing") return "down";
  return "stable";
}
