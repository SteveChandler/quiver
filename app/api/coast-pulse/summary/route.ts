import { NextRequest, NextResponse } from "next/server";
import { createValidationError, handleApiError } from "@/lib/api-utils";
import { normalizeCoordinates } from "@/lib/types/coordinates";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { withRateLimit } from "@/lib/middleware/api-wrappers";
import {
  getNearestNDBCStation,
  fetchLatestNDBCObservation,
} from "@/lib/services/ndbc-service";
import { CDIPService } from "@/lib/services/cdip-service";
import { CDIP_STATIONS } from "@/lib/constants/cdip-stations";
import { NOAACOOPSService } from "@/lib/services/noaa-coops-service";
import { isNDBCDuplicateOfCDIP } from "@/lib/constants/buoy-mappings";
import {
  formatBuoyMessage,
  formatTideMessage,
  formatForecastConditions,
} from "@/lib/utils/coast-pulse-formatter";
import { computeSummary, CoastPulseSummaryItem } from "@/lib/utils/coast-pulse-summary";
import { haversineDistance, degreesToCardinal } from "@/lib/utils/geo-utils";
import {
  DISTANCE,
  PAGINATION,
  CACHE,
  CREDIBILITY,
} from "@/lib/constants/coast-pulse";

const cdipService = new CDIPService();
const coopsService = new NOAACOOPSService();

/**
 * GET /api/coast-pulse/summary
 *
 * Lightweight endpoint that fetches only buoy/forecast/tide data
 * and returns a computed summary. Used by realtime hook when conditions change.
 */
async function summaryHandler(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const coords = normalizeCoordinates({
      lat: searchParams.get("lat"),
      lon: searchParams.get("lon"),
    });

    if (!coords) {
      return createValidationError("Invalid or missing lat/lon parameters");
    }

    const { lat, lon } = coords;
    const supabase = await createSupabaseServerClient();
    const items: CoastPulseSummaryItem[] = [];

    // Fetch beaches for forecast lookup
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

    // Find closest beach for forecast
    let closestBeach = beachesCache[0];
    let minDist = Infinity;
    for (const beach of beachesCache) {
      const dist = haversineDistance(lat, lon, beach.lat, beach.lon);
      if (dist < minDist) {
        minDist = dist;
        closestBeach = beach;
      }
    }

    // Fetch forecast, NDBC, CDIP, and tide in parallel
    const [forecastResult, ndbcResult, cdipResult, tideResult] = await Promise.allSettled([
      // Forecast
      (async () => {
        if (!closestBeach || minDist > DISTANCE.FORECAST_MAX_KM) return null;
        const now = new Date();
        const { data: forecast } = await supabase
          .from("enhanced_forecasts")
          .select("*")
          .eq("beach_id", closestBeach.id)
          .gte("forecast_date", now.toISOString().split("T")[0])
          .order("forecast_date", { ascending: true })
          .limit(1)
          .single();
        if (!forecast) return null;
        return {
          source: { type: "forecast" as const, credibility: CREDIBILITY.FORECAST },
          message: formatForecastConditions(forecast, closestBeach.windOffshoreDeg),
          timestamp: new Date(forecast.updated_at || now),
          trend: "stable" as const,
        };
      })(),
      // NDBC
      (async () => {
        const station = await getNearestNDBCStation(lat, lon, DISTANCE.BUOY_MAX_KM);
        if (!station) return null;
        const observation = await fetchLatestNDBCObservation(station.id);
        if (!observation || (observation.wave_height_m == null && observation.wind_speed_ms == null)) return null;
        const heightFt = observation.wave_height_m != null ? observation.wave_height_m * 3.28084 : null;
        const periodS = observation.wave_period_s ?? null;
        const waterTempF = observation.water_temp_c != null ? (observation.water_temp_c * 9 / 5) + 32 : null;
        const direction = observation.wave_direction_deg != null ? degreesToCardinal(observation.wave_direction_deg) : null;
        const message = heightFt != null && periodS != null
          ? formatBuoyMessage({ heightFt, periodS, direction, waterTempF, lat: station.lat, lon: station.lon })
          : "Live data available";
        return {
          id: `ndbc-${station.id}`,
          source: { type: "ndbc" as const, credibility: CREDIBILITY.NDBC },
          message,
          timestamp: new Date(observation.ts),
          trend: "stable" as const,
        };
      })(),
      // CDIP
      (async () => {
        const cdipItems: CoastPulseSummaryItem[] = [];
        const nearbyStations: Array<{ id: string; distance: number }> = [];
        for (const [id, station] of Object.entries(CDIP_STATIONS)) {
          const distance = haversineDistance(lat, lon, station.latitude, station.longitude);
          if (distance <= DISTANCE.CDIP_MAX_KM) nearbyStations.push({ id, distance });
        }
        nearbyStations.sort((a, b) => a.distance - b.distance);
        for (const { id: stationId } of nearbyStations.slice(0, PAGINATION.CDIP_STATIONS_LIMIT)) {
          try {
            const buoyData = await cdipService.fetchBuoyData(stationId);
            if (!buoyData || buoyData.data.length === 0) continue;
            const latest = buoyData.data[0];
            const stationConfig = CDIP_STATIONS[stationId];
            const message = latest.significantWaveHeight != null && latest.peakWavePeriod != null
              ? formatBuoyMessage({
                  heightFt: latest.significantWaveHeight,
                  periodS: latest.peakWavePeriod,
                  direction: latest.peakWaveDirection != null ? degreesToCardinal(latest.peakWaveDirection) : null,
                  waterTempF: null,
                  lat: stationConfig?.latitude || lat,
                  lon: stationConfig?.longitude || lon,
                })
              : "Live CDIP data";
            cdipItems.push({
              source: { type: "cdip", credibility: CREDIBILITY.CDIP },
              message,
              timestamp: new Date(latest.timestamp),
              trend: "stable",
            });
          } catch { /* skip station */ }
        }
        return cdipItems;
      })(),
      // Tide
      (async () => {
        const stationId = coopsService.getStationForLocation("", lat, lon);
        const tideData = await coopsService.fetchCOOPSData(stationId, 2);
        if (!tideData?.tides?.length) return null;
        const now = new Date();
        const currentHeight = coopsService.getCurrentTideHeight(tideData.tides);
        const tideStatus = coopsService.getTideStatusAtTime(tideData.tides, now);
        const nextTide = coopsService.getNextTide(tideData.tides);
        if (!nextTide) return null;
        const msUntil = (nextTide.time * 1000) - now.getTime();
        const hoursUntil = Math.floor(msUntil / 3600000);
        const minsUntil = Math.floor((msUntil % 3600000) / 60000);
        const message = formatTideMessage({
          nextTideName: nextTide.name,
          nextTideHeight: nextTide.height,
          hoursUntil,
          minsUntil,
          currentHeight: currentHeight ?? 0,
          status: tideStatus,
        });
        return {
          source: { type: "tide" as const, credibility: CREDIBILITY.TIDE },
          message,
          timestamp: new Date(),
          trend: (tideStatus === "Rising" ? "up" : tideStatus === "Falling" ? "down" : "stable") as "up" | "down" | "stable",
        };
      })(),
    ]);

    // Collect CDIP items first (highest credibility)
    if (cdipResult.status === "fulfilled" && cdipResult.value.length > 0) {
      items.push(...cdipResult.value);
    }

    // Add NDBC (with dedup against CDIP)
    if (ndbcResult.status === "fulfilled" && ndbcResult.value) {
      const ndbcItem = ndbcResult.value;
      const ndbcStationId = (ndbcItem as any).id?.replace("ndbc-", "") || "";
      const hasCDIPDuplicate =
        isNDBCDuplicateOfCDIP(ndbcStationId) &&
        items.some((item) => item.source.type === "cdip");
      if (!hasCDIPDuplicate) {
        items.push(ndbcItem);
      }
    }

    // Add forecast
    if (forecastResult.status === "fulfilled" && forecastResult.value) {
      items.push(forecastResult.value);
    }

    // Add tide
    if (tideResult.status === "fulfilled" && tideResult.value) {
      items.push(tideResult.value);
    }

    const summary = computeSummary(items);

    return NextResponse.json(
      { success: true, summary },
      {
        headers: {
          "Cache-Control": `private, max-age=${CACHE.SUMMARY_CACHE_SECONDS}`,
        },
      }
    );
  } catch (error) {
    console.error("Coast pulse summary error:", error);
    return handleApiError(error);
  }
}

export const GET = withRateLimit(summaryHandler, "public-default");
