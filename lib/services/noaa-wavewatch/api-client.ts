/**
 * HTTP client for NOAA WaveWatch III API endpoints
 *
 * Handles all external API requests to NOAA NWS and Open-Meteo services.
 *
 * @module noaa-wavewatch/api-client
 */

import { createContextLogger } from "@/lib/logger";
import { API_ENDPOINTS, FORECAST_CONFIG, HTTP_CONFIG } from "./constants";
import { getOceanGridPoint } from "./grid-utils";
import type { NOAAWavePoint, NOAAGridData, OpenMeteoMarineResponse } from "./types";

const log = createContextLogger("NOAAWaveWatch:APIClient");

/**
 * In-memory cache of resolved NOAA grid points, keyed by original beach
 * coordinate. NOAA grids are stable over 24h+, and a single beach may
 * fetch forecasts many times a day across the web + cron pipelines — caching
 * the resolved `NOAAWavePoint` avoids repeated `/points/{lat},{lon}` calls.
 */
const POINT_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h
const pointCache = new Map<
  string,
  { value: NOAAWavePoint; expiresAt: number }
>();

function cacheKey(lat: number, lon: number): string {
  // Round to 4 decimals (~11m) so tiny floating-point drift on repeat
  // callers still hits the same cache entry.
  return `${lat.toFixed(4)},${lon.toFixed(4)}`;
}

/**
 * Fetch NOAA NWS grid point data for a location.
 *
 * Before hitting the NWS `/points/{lat},{lon}` endpoint, we shift coastal
 * beach coordinates ~0.05° toward deeper water via `getOceanGridPoint` so
 * the resolved grid sits over the ocean — inland / coastal-land grid points
 * return zeroed `primarySwellHeight` / `secondarySwellHeight` / `wavePeriod2`
 * partitions even when the offshore neighbor grid carries real values.
 *
 * Results are cached per original beach coordinate for 24h.
 *
 * @param latitude - Latitude in decimal degrees (beach coordinate)
 * @param longitude - Longitude in decimal degrees (beach coordinate)
 * @returns Grid point information or null if unavailable
 */
export async function fetchNOAAPointData(
  latitude: number,
  longitude: number
): Promise<NOAAWavePoint | null> {
  const key = cacheKey(latitude, longitude);
  const cached = pointCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  try {
    const { lat: oceanLat, lon: oceanLon } = getOceanGridPoint(
      latitude,
      longitude
    );
    const pointsUrl = `${API_ENDPOINTS.NWS_POINTS_BASE}/${oceanLat},${oceanLon}`;
    log.debug(`Fetching NOAA NWS grid point data from: ${pointsUrl}`);

    const response = await fetch(pointsUrl, {
      headers: {
        "User-Agent": HTTP_CONFIG.USER_AGENT,
        ...HTTP_CONFIG.DEFAULT_HEADERS,
      },
    });

    if (!response.ok) {
      log.debug(
        `NOAA Point API failed with ${response.status}: ${response.statusText}`
      );
      return null;
    }

    const data: NOAAWavePoint = await response.json();

    if (!data?.properties) {
      log.debug(
        `NOAA Point API returned missing properties for ${latitude}, ${longitude}`
      );
      return null;
    }

    log.debug(`Got NOAA NWS grid point data:`, {
      gridId: data.properties.gridId,
      gridX: data.properties.gridX,
      gridY: data.properties.gridY,
      forecastGridData: data.properties.forecastGridData,
    });

    pointCache.set(key, { value: data, expiresAt: Date.now() + POINT_CACHE_TTL_MS });
    return data;
  } catch (error) {
    log.error("Error fetching NOAA point data:", error);
    return null;
  }
}

/**
 * Fetch NOAA NWS grid forecast data
 *
 * @param gridUrl - URL to the grid forecast endpoint
 * @returns Grid forecast data or null if unavailable
 */
export async function fetchNOAAGridData(
  gridUrl: string
): Promise<NOAAGridData | null> {
  try {
    log.debug(`Fetching NOAA NWS grid data from: ${gridUrl}`);

    const response = await fetch(gridUrl, {
      headers: {
        "User-Agent": HTTP_CONFIG.USER_AGENT,
        ...HTTP_CONFIG.DEFAULT_HEADERS,
      },
    });

    if (!response.ok) {
      log.debug(
        `NOAA Grid API failed with ${response.status}: ${response.statusText}`
      );
      return null;
    }

    const data: NOAAGridData = await response.json();
    log.debug(`Got NOAA NWS grid data with properties:`, Object.keys(data.properties));

    return data;
  } catch (error) {
    log.error("Error fetching NOAA grid data:", error);
    return null;
  }
}

/**
 * Construct grid URL from point data
 *
 * Some NWS points return a null/empty `forecastGridData` URL.
 * This function reconstructs the URL from gridId/gridX/gridY when needed.
 *
 * @param pointData - NOAA point data response
 * @returns Grid forecast URL or null if cannot be constructed
 */
export function constructGridUrl(pointData: NOAAWavePoint): string | null {
  const gridUrl =
    pointData.properties.forecastGridData ||
    (pointData.properties.gridId &&
    typeof pointData.properties.gridX === "number" &&
    typeof pointData.properties.gridY === "number"
      ? `${API_ENDPOINTS.NWS_POINT_FORECAST_BASE}/${pointData.properties.gridId}/${pointData.properties.gridX},${pointData.properties.gridY}`
      : null);

  if (!gridUrl || typeof gridUrl !== "string") {
    log.debug(`Could not construct grid URL`, {
      forecastGridData: pointData.properties.forecastGridData,
      gridId: pointData.properties.gridId,
      gridX: pointData.properties.gridX,
      gridY: pointData.properties.gridY,
    });
    return null;
  }

  return gridUrl;
}

/**
 * Fetch Open-Meteo marine forecast data
 *
 * @param latitude - Latitude in decimal degrees
 * @param longitude - Longitude in decimal degrees
 * @param days - Number of forecast days (capped to FORECAST_CONFIG.OPEN_METEO_API_LIMIT)
 * @returns Marine forecast data or null if unavailable
 */
export async function fetchOpenMeteoData(
  latitude: number,
  longitude: number,
  days: number
): Promise<OpenMeteoMarineResponse | null> {
  try {
    log.debug(`Fetching Open-Meteo marine data for ${latitude}, ${longitude}`);

    const params = new URLSearchParams({
      latitude: latitude.toString(),
      longitude: longitude.toString(),
      hourly: [
        "wave_height",
        "wave_direction",
        "wave_period",
        "wave_peak_period",
        "swell_wave_height",
        "swell_wave_direction",
        "swell_wave_period",
        "swell_wave_peak_period",
        "wind_wave_height",
        "wind_wave_direction",
        "wind_wave_period",
        "wind_wave_peak_period",
        "secondary_swell_wave_height",
        "secondary_swell_wave_period",
        "secondary_swell_wave_direction",
        "tertiary_swell_wave_height",
        "tertiary_swell_wave_period",
        "tertiary_swell_wave_direction",
      ].join(","),
      timezone: "America/Los_Angeles",
      forecast_days: Math.min(days, FORECAST_CONFIG.OPEN_METEO_API_LIMIT).toString(),
    });

    const url = `${API_ENDPOINTS.OPEN_METEO_MARINE_BASE}?${params.toString()}`;
    log.debug(`Fetching Open-Meteo data from: ${url}`);

    const response = await fetch(url, {
      headers: {
        "User-Agent": HTTP_CONFIG.USER_AGENT,
      },
    });

    if (!response.ok) {
      log.debug(
        `Open-Meteo API failed with ${response.status}: ${response.statusText}`
      );
      return null;
    }

    const data: OpenMeteoMarineResponse = await response.json();
    log.debug(
      `Got Open-Meteo data with ${data.hourly?.time?.length || 0} hourly forecasts`
    );

    return data;
  } catch (error) {
    log.error("Error fetching Open-Meteo data:", error);
    return null;
  }
}
