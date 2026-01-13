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
import {
  CDIP_NDBC_OVERLAPS,
  isNDBCDuplicateOfCDIP,
} from "@/lib/constants/buoy-mappings";

// Enable ISR with 2-minute revalidation
export const revalidate = 120;

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
}

/**
 * Fetch all Coast Pulse data for a geographic area
 * This is the core data fetching logic, cached by geohash
 */
async function fetchCoastPulseData(
  lat: number,
  lon: number,
  limit: number
): Promise<CoastPulseResponse> {
  const supabase = await createSupabaseServerClient();
  const items: CoastPulseItem[] = [];

  // Fetch from all sources in parallel (including live external sources)
  // Hybrid approach: Use beach_daily_intel (pre-computed) alongside live data
  const [localBuoysResult, forecastResult, dailyIntelResult, intelResult, ndbcResult, cdipResult, tideResult] =
    await Promise.allSettled([
      fetchLocalBuoys(supabase, lat, lon),
      fetchEnhancedForecast(supabase, lat, lon),
      fetchDailyIntel(supabase, lat, lon),  // NEW: Pre-computed daily intel
      fetchRecentIntel(supabase, lat, lon),
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

  // Process intel
  if (intelResult.status === "fulfilled" && intelResult.value.length > 0) {
    items.push(...intelResult.value);
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
    if (Math.abs(timeDiff) < 30 * 60 * 1000) {
      // Within 30 min, sort by credibility
      return b.source.credibility - a.source.credibility;
    }
    return timeDiff;
  });

  // Compute summary from best available data
  const summary = computeSummary(sorted);

  return {
    items: sorted.slice(0, limit),
    summary,
  };
}

/**
 * Create a cached version of the data fetcher
 * Cache key is geohash (precision 4 = ~20km areas) + limit
 */
const getCachedCoastPulseData = unstable_cache(
  async (geohashKey: string, limit: number) => {
    // Decode geohash back to center coordinates
    const { latitude, longitude } = ngeohash.decode(geohashKey);
    return fetchCoastPulseData(latitude, longitude, limit);
  },
  ["coast-pulse"],
  { revalidate: 300, tags: ["coast-pulse"] } // 5-minute cache
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
      Math.max(parseInt(searchParams.get("limit") || "8"), 1),
      15
    );

    // Create geohash key for caching (precision 4 = ~20km areas)
    const geohashKey = ngeohash.encode(coords.lat, coords.lon, 4);

    // Fetch data using cached function
    const data = await getCachedCoastPulseData(geohashKey, limit);

    // Return with cache headers for CDN
    return NextResponse.json(
      { success: true, data, timestamp: new Date().toISOString() },
      {
        headers: {
          "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300",
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
    // Use PostGIS to find buoys within 200km (200000 meters)
    const { data: buoys, error } = await supabase.rpc("get_nearby_buoys", {
      target_lat: lat,
      target_lng: lon,
      max_distance_m: 200000,
      result_limit: 5,
    });

    if (error) {
      console.error("Error fetching local buoys:", error);
      // Fallback: try simple query without PostGIS
      const { data: fallbackBuoys } = await supabase
        .from("buoys")
        .select("*")
        .eq("active", true)
        .not("wave_height", "is", null)
        .limit(5);

      if (!fallbackBuoys?.length) return [];

      return fallbackBuoys.map((buoy: BuoyRow) => ({
        id: `local-${buoy.buoy_uuid}`,
        source: {
          name: buoy.buoy_name || `Buoy ${buoy.buoy_uuid}`,
          type: "local" as const,
          credibility: 85,
        },
        message: formatBuoyConditions(buoy),
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
        credibility: 85,
      },
      message: formatBuoyConditions(buoy),
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
  lon: number
): Promise<CoastPulseItem[]> {
  try {
    // Find nearest beach first
    const { data: beaches } = await supabase
      .from("beaches")
      .select("id, name, lat, lon")
      .not("lat", "is", null)
      .limit(100);

    if (!beaches?.length) return [];

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

    if (minDist > 100) return []; // Too far, no relevant forecast

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
              credibility: 70,
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
          credibility: 70,
        },
        message: formatForecastConditions(forecast),
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
  lon: number
): Promise<CoastPulseItem | null> {
  try {
    // Find nearest beach first
    const { data: beaches } = await supabase
      .from("beaches")
      .select("id, name, lat, lon")
      .not("lat", "is", null)
      .limit(100);

    if (!beaches?.length) return null;

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

    if (minDist > 100) return null; // Too far, no relevant data

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
        credibility: 75, // Pre-computed from multiple sources
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
 * Fetch recent user intel posts
 */
async function fetchRecentIntel(
  supabase: SupabaseClient,
  lat: number,
  lon: number
): Promise<CoastPulseItem[]> {
  try {
    // Fetch intel from last 24 hours (was 2 hours - extended for more content)
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data: posts } = await supabase
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
        profiles:user_id (
          full_name
        )
      `
      )
      .eq("is_active", true)
      .gte("created_at", twentyFourHoursAgo)
      .order("created_at", { ascending: false })
      .limit(10);

    if (!posts?.length) return [];

    // Filter to nearby posts using the post's own coordinates
    const nearbyPosts = posts.filter((post: any) => {
      if (post.latitude == null || post.longitude == null) return false;
      const dist = haversineDistance(lat, lon, post.latitude, post.longitude);
      return dist <= 50; // Within 50km
    });

    return nearbyPosts.slice(0, 5).map((post: any) => {
      // Get surfer name from joined profile, fallback to "Local Surfer"
      const surferName = post.profiles?.full_name || "Local Surfer";

      return {
        id: `intel-${post.id}`,
        source: {
          name: surferName,
          type: "intel" as const,
          credibility: 50 + Math.min(post.confirmations_count || 0, 20) * 2, // Boost credibility with confirmations
        },
        message: truncateText(post.description || post.title, 100),
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
    // Find nearest NDBC station within 100km
    const station = await getNearestNDBCStation(lat, lon, 100);
    if (!station) return null;

    // Fetch latest observation
    const observation = await fetchLatestNDBCObservation(station.id);
    if (!observation) return null;

    // Check if we have actual wave data
    if (observation.wave_height_m == null && observation.wind_speed_ms == null) {
      return null;
    }

    // Format the message
    const parts: string[] = [];
    if (observation.wave_height_m != null) {
      const heightFt = observation.wave_height_m * 3.28084;
      parts.push(`${heightFt.toFixed(1)}ft`);
    }
    if (observation.wave_period_s != null) {
      parts.push(`@ ${observation.wave_period_s.toFixed(0)}s`);
    }
    if (observation.wind_speed_ms != null) {
      const windKt = observation.wind_speed_ms * 1.94384;
      const windDir = observation.wind_direction_deg
        ? ` ${degreesToCardinal(observation.wind_direction_deg)}`
        : "";
      parts.push(`${windKt.toFixed(0)}kt${windDir}`);
    }
    // Add water temperature if available (convert C to F)
    if (observation.water_temp_c != null) {
      const tempF = (observation.water_temp_c * 9 / 5) + 32;
      parts.push(`${Math.round(tempF)}°F`);
    }

    const message = parts.length > 0 ? parts.join(", ") : "Live data available";

    return {
      id: `ndbc-${station.id}`,
      source: {
        name: station.name,
        type: "ndbc" as const,
        credibility: 90, // Higher credibility for live data
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

    // Find all CDIP stations within 100km (~62 miles)
    const nearbyStations: Array<{ id: string; distance: number; name: string }> = [];
    for (const [id, station] of Object.entries(CDIP_STATIONS)) {
      const distance = haversineDistance(lat, lon, station.latitude, station.longitude);
      if (distance <= 100) {
        nearbyStations.push({ id, distance, name: station.name });
      }
    }

    // Debug: log nearby stations found
    if (process.env.NODE_ENV === "development") {
      console.log(`🌊 CDIP: Found ${nearbyStations.length} stations within 100km:`,
        nearbyStations.map(s => `${s.name} (${s.id}) - ${s.distance.toFixed(1)}km`).join(", "));
    }

    // Sort by distance and take up to 6 nearest (some may not have data)
    nearbyStations.sort((a, b) => a.distance - b.distance);
    const stationsToFetch = nearbyStations.slice(0, 6);

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

        // Format the message
        const parts: string[] = [];
        if (latest.significantWaveHeight != null) {
          parts.push(`${latest.significantWaveHeight.toFixed(1)}ft`);
        }
        if (latest.peakWavePeriod != null) {
          parts.push(`@ ${latest.peakWavePeriod.toFixed(0)}s`);
        }
        if (latest.peakWaveDirection != null) {
          parts.push(`${degreesToCardinal(latest.peakWaveDirection)} swell`);
        }

        const message = parts.length > 0 ? parts.join(", ") : "Live CDIP data";

        // Get station location from config
        const stationConfig = CDIP_STATIONS[stationId];
        const stationLat = stationConfig?.latitude || lat;
        const stationLon = stationConfig?.longitude || lon;

        items.push({
          id: `cdip-${stationId}`,
          source: {
            name: buoyData.stationName,
            type: "cdip" as const,
            credibility: 95, // CDIP is highest credibility for wave data
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
    const timeStr = hoursUntil > 0 ? `${hoursUntil}h ${minsUntil}m` : `${minsUntil}m`;

    // Format current height status
    const heightStr = currentHeight != null
      ? `Now: ${currentHeight.toFixed(1)}ft ${tideStatus}`
      : tideStatus;

    // Build message: "High Tide in 2h 15m @ 5.2ft. Now: 3.1ft Rising"
    const message = `${nextTide.name} in ${timeStr} @ ${nextTide.height.toFixed(1)}ft. ${heightStr}`;

    return {
      id: `tide-${stationId}`,
      source: {
        name: tideData.station_name,
        type: "tide" as const,
        credibility: 95, // Official NOAA predictions
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
 * Format forecast conditions into a human-readable message
 */
function formatForecastConditions(forecast: any): string {
  const parts: string[] = [];

  // Helper to safely convert to number
  const toNum = (val: unknown): number | null => {
    if (val == null) return null;
    const num = Number(val);
    return isNaN(num) ? null : num;
  };

  const minHeight = toNum(forecast.min_wave_height);
  const maxHeight = toNum(forecast.max_wave_height);
  const waveHeight = toNum(forecast.wave_height);
  const wavePeriod = toNum(forecast.wave_period);
  const windSpeed = toNum(forecast.wind_speed);
  const windDirection = toNum(forecast.wind_direction);
  const surfRating = toNum(forecast.surf_rating);

  if (minHeight != null && maxHeight != null) {
    parts.push(`${minHeight}-${maxHeight}ft`);
  } else if (waveHeight != null) {
    parts.push(`${waveHeight.toFixed(1)}ft`);
  }

  if (wavePeriod != null) {
    parts.push(`@ ${wavePeriod.toFixed(0)}s`);
  }

  if (windSpeed != null) {
    const windDir = windDirection != null
      ? ` ${degreesToCardinal(windDirection)}`
      : "";
    parts.push(`${windSpeed.toFixed(0)}kt${windDir}`);
  }

  if (surfRating != null) {
    parts.push(`Rating: ${surfRating}/10`);
  }

  return parts.length > 0 ? parts.join(", ") : "Forecast available";
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

/**
 * Calculate confidence score based on data freshness and source credibility
 */
function calculateConfidence(items: CoastPulseItem[]): number {
  if (items.length === 0) return 0;

  const now = Date.now();
  let totalScore = 0;
  let count = 0;

  for (const item of items.slice(0, 3)) {
    // Only consider top 3 items
    const ageMs = now - new Date(item.timestamp).getTime();
    const ageHours = ageMs / (1000 * 60 * 60);

    // Freshness penalty: -10 points per hour old
    const freshnessPenalty = Math.min(50, ageHours * 10);
    const itemScore = Math.max(0, item.source.credibility - freshnessPenalty);

    totalScore += itemScore;
    count++;
  }

  return count > 0 ? Math.round(totalScore / count) : 0;
}

/**
 * Compute summary from available items
 * Priority: Recent Intel (breaking) > Forecast (estimated) > Buoy (offshore)
 */
function computeSummary(items: CoastPulseItem[]): CoastPulseSummary {
  let waveHeight: string | null = null;
  let heightType: "offshore" | "breaking" | "forecast" | null = null;

  // Priority 1: Recent intel (user-reported breaking wave height, <2hrs old)
  const recentIntel = items.find(
    (i) =>
      i.source.type === "intel" &&
      Date.now() - new Date(i.timestamp).getTime() < 2 * 60 * 60 * 1000
  );

  if (recentIntel) {
    const match = recentIntel.message.match(/(\d+\.?\d*(?:-\d+\.?\d*)?)(?:ft|')/i);
    if (match) {
      waveHeight = `${match[1]} ft`;
      heightType = "breaking";
    }
  }

  // Priority 2: Daily Intel or Forecast (estimated surf height)
  if (!waveHeight) {
    // Prefer daily-intel as it's a pre-computed summary
    const dailyIntelItem = items.find((i) => i.source.type === "daily-intel");
    const forecastItem = items.find((i) => i.source.type === "forecast");
    const summaryItem = dailyIntelItem || forecastItem;

    if (summaryItem) {
      const match = summaryItem.message.match(/(\d+\.?\d*(?:-\d+\.?\d*)?)ft/);
      if (match) {
        waveHeight = `${match[1]} ft`;
        heightType = "forecast";
      }
    }
  }

  // Priority 3: Buoy data (offshore swell - CDIP > NDBC > local)
  if (!waveHeight) {
    const buoyItem =
      items.find((i) => i.source.type === "cdip") ||
      items.find((i) => i.source.type === "ndbc") ||
      items.find((i) => i.source.type === "local");
    if (buoyItem) {
      const match = buoyItem.message.match(/(\d+\.?\d*)ft/);
      if (match) {
        waveHeight = `${match[1]} ft (offshore)`;
        heightType = "offshore";
      }
    }
  }

  // Extract wind from any available source (buoy preferred for accuracy)
  const windSource =
    items.find((i) => i.source.type === "cdip" || i.source.type === "ndbc") ||
    items.find((i) => i.source.type === "forecast");
  const windMatch = windSource?.message.match(/(\d+)kt\s*(\w+)?/);
  const windSpeed = windMatch
    ? `${windMatch[1]} kt${windMatch[2] ? ` ${windMatch[2]}` : ""}`
    : null;

  // Determine overall trend
  const trends = items.map((i) => i.trend).filter(Boolean);
  let overallTrend: "improving" | "stable" | "declining" | null = null;
  if (trends.includes("up")) overallTrend = "improving";
  else if (trends.includes("down")) overallTrend = "declining";
  else if (trends.length > 0) overallTrend = "stable";

  // Calculate confidence based on data freshness
  const confidence = calculateConfidence(items);

  // Extract tide height from tide item
  const tideItem = items.find((i) => i.source.type === "tide");
  let tideHeight: string | null = null;
  if (tideItem) {
    // Extract "Now: X.Xft Rising/Falling" pattern from message
    const match = tideItem.message.match(/Now:\s*(\d+\.?\d*)ft\s*(\w+)/);
    if (match) {
      tideHeight = `${match[1]}ft ${match[2]}`;
    }
  }

  // Extract water temp from NDBC item (format: "XXX°F" in message)
  const ndbcItem = items.find((i) => i.source.type === "ndbc");
  let waterTemp: string | null = null;
  if (ndbcItem) {
    const match = ndbcItem.message.match(/(\d+)°F/);
    if (match) {
      waterTemp = `${match[1]}°F`;
    }
  }

  return {
    waveHeight,
    heightType,
    windSpeed,
    tideHeight,
    waterTemp,
    trend: overallTrend,
    confidence,
    lastUpdated: new Date().toISOString(),
  };
}

/**
 * Haversine distance between two points in km
 */
function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Convert degrees to cardinal direction
 */
function degreesToCardinal(degrees: number): string {
  const directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  const index = Math.round(degrees / 45) % 8;
  return directions[index];
}

/**
 * Truncate text to max length
 */
function truncateText(text: string, maxLength: number): string {
  if (!text) return "";
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + "...";
}

// Apply rate limiting protection
export const GET = withRateLimit(coastPulseHandler, "public-default");
