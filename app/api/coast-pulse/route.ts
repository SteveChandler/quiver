import { NextRequest } from "next/server";
import {
  createSuccessResponse,
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

export const dynamic = "force-dynamic";

// Singleton CDIP service instance
const cdipService = new CDIPService();

// Database row types
type BuoyRow = Database["public"]["Tables"]["buoys"]["Row"];

// Types for Coast Pulse data
interface CoastPulseSource {
  name: string;
  type: "local" | "cdip" | "ndbc" | "forecast" | "intel" | "wind";
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
}

interface CoastPulseSummary {
  waveHeight: string | null;
  windSpeed: string | null;
  trend: "improving" | "stable" | "declining" | null;
  lastUpdated: string;
}

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

    const supabase = await createSupabaseServerClient();
    const items: CoastPulseItem[] = [];

    // Fetch from all sources in parallel (including live external sources)
    const [localBuoysResult, forecastResult, intelResult, ndbcResult, cdipResult] =
      await Promise.allSettled([
        fetchLocalBuoys(supabase, coords.lat, coords.lon),
        fetchEnhancedForecast(supabase, coords.lat, coords.lon),
        fetchRecentIntel(supabase, coords.lat, coords.lon),
        fetchLiveNDBCData(coords.lat, coords.lon),
        fetchLiveCDIPData(coords.lat, coords.lon),
      ]);

    // Debug logging for each source
    console.log("Coast Pulse sources:", {
      localBuoys: localBuoysResult.status === "fulfilled"
        ? `${localBuoysResult.value.length} items`
        : `failed: ${(localBuoysResult as PromiseRejectedResult).reason}`,
      forecasts: forecastResult.status === "fulfilled"
        ? `${forecastResult.value.length} items`
        : `failed: ${(forecastResult as PromiseRejectedResult).reason}`,
      intel: intelResult.status === "fulfilled"
        ? `${intelResult.value.length} items`
        : `failed: ${(intelResult as PromiseRejectedResult).reason}`,
      ndbc: ndbcResult.status === "fulfilled"
        ? (ndbcResult.value ? "1 item" : "null")
        : `failed: ${(ndbcResult as PromiseRejectedResult).reason}`,
      cdip: cdipResult.status === "fulfilled"
        ? `${cdipResult.value.length} items`
        : `failed: ${(cdipResult as PromiseRejectedResult).reason}`,
    });

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

    // Process intel
    if (intelResult.status === "fulfilled" && intelResult.value.length > 0) {
      items.push(...intelResult.value);
    }

    // Process live NDBC data
    if (ndbcResult.status === "fulfilled" && ndbcResult.value) {
      items.push(ndbcResult.value);
    }

    // Process live CDIP data (now returns array)
    if (cdipResult.status === "fulfilled" && cdipResult.value.length > 0) {
      items.push(...cdipResult.value);
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

    return createSuccessResponse({
      items: sorted.slice(0, limit),
      summary,
    });
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

    if (!forecast) return [];

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
        content,
        created_at,
        photo_url,
        beach:beaches(id, name, lat, lon)
      `
      )
      .gte("created_at", twentyFourHoursAgo)
      .order("created_at", { ascending: false })
      .limit(10);

    if (!posts?.length) return [];

    // Filter to nearby posts
    const nearbyPosts = posts.filter((post: any) => {
      if (!post.beach?.lat || !post.beach?.lon) return false;
      const dist = haversineDistance(lat, lon, post.beach.lat, post.beach.lon);
      return dist <= 50; // Within 50km
    });

    return nearbyPosts.slice(0, 3).map((post: any) => ({
      id: `intel-${post.id}`,
      source: {
        name: post.beach?.name || "Local Beach",
        type: "intel" as const,
        credibility: 50,
      },
      message: truncateText(post.content, 100),
      timestamp: new Date(post.created_at),
      location: post.beach
        ? {
            lat: post.beach.lat,
            lon: post.beach.lon,
            distanceKm: haversineDistance(
              lat,
              lon,
              post.beach.lat,
              post.beach.lon
            ),
          }
        : undefined,
      photoUrl: post.photo_url || undefined,
    }));
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

    // Find all CDIP stations within 300km (expanded for better coverage)
    const nearbyStations: Array<{ id: string; distance: number }> = [];
    for (const [id, station] of Object.entries(CDIP_STATIONS)) {
      const distance = haversineDistance(lat, lon, station.latitude, station.longitude);
      if (distance <= 300) {
        nearbyStations.push({ id, distance });
      }
    }

    // Sort by distance and take up to 5 nearest
    nearbyStations.sort((a, b) => a.distance - b.distance);
    const stationsToFetch = nearbyStations.slice(0, 5);

    if (stationsToFetch.length === 0) return [];

    // Fetch data from each station
    for (const { id: stationId, distance } of stationsToFetch) {
      try {
        const buoyData = await cdipService.fetchBuoyData(stationId);
        if (!buoyData || buoyData.data.length === 0) continue;

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

  if (forecast.min_wave_height != null && forecast.max_wave_height != null) {
    parts.push(`${forecast.min_wave_height}-${forecast.max_wave_height}ft`);
  } else if (forecast.wave_height != null) {
    parts.push(`${forecast.wave_height.toFixed(1)}ft`);
  }

  if (forecast.wave_period != null) {
    parts.push(`@ ${forecast.wave_period.toFixed(0)}s`);
  }

  if (forecast.wind_speed != null) {
    const windDir = forecast.wind_direction
      ? ` ${degreesToCardinal(forecast.wind_direction)}`
      : "";
    parts.push(`${forecast.wind_speed.toFixed(0)}kt${windDir}`);
  }

  if (forecast.surf_rating != null) {
    parts.push(`Rating: ${forecast.surf_rating}/10`);
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
 * Compute summary from available items
 */
function computeSummary(items: CoastPulseItem[]): CoastPulseSummary {
  // Find most credible buoy/forecast data for wave height (CDIP > NDBC > local > forecast)
  const cdipItem = items.find((i) => i.source.type === "cdip");
  const ndbcItem = items.find((i) => i.source.type === "ndbc");
  const buoyItem = cdipItem || ndbcItem || items.find((i) => i.source.type === "local");
  const forecastItem = items.find((i) => i.source.type === "forecast");

  // Extract wave height from message (simple parsing)
  const waveHeightMatch = (buoyItem?.message || forecastItem?.message || "").match(
    /(\d+\.?\d*(?:-\d+\.?\d*)?)ft/
  );
  const waveHeight = waveHeightMatch ? `${waveHeightMatch[1]} ft` : null;

  // Extract wind from message
  const windMatch = (buoyItem?.message || forecastItem?.message || "").match(
    /(\d+)kt\s*(\w+)?/
  );
  const windSpeed = windMatch
    ? `${windMatch[1]} kt${windMatch[2] ? ` ${windMatch[2]}` : ""}`
    : null;

  // Determine overall trend
  const trends = items.map((i) => i.trend).filter(Boolean);
  let overallTrend: "improving" | "stable" | "declining" | null = null;
  if (trends.includes("up")) overallTrend = "improving";
  else if (trends.includes("down")) overallTrend = "declining";
  else if (trends.length > 0) overallTrend = "stable";

  return {
    waveHeight,
    windSpeed,
    trend: overallTrend,
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
