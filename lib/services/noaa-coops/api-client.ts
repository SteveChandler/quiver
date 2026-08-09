/**
 * NOAA CO-OPS API Client
 *
 * Handles HTTP requests to the NOAA Center for Operational
 * Oceanographic Products and Services (CO-OPS) API.
 */

import type { TideData, TideExtreme, StationInfo } from "./types";
import { parseCOOPSTimestampToUnixSecondsUTC } from "./tide-analysis";

/** NOAA CO-OPS API base URL */
const COOPS_BASE_URL =
  "https://api.tidesandcurrents.noaa.gov/api/prod/datagetter";

/** NOAA Metadata API base URL */
const COOPS_METADATA_URL =
  "https://api.tidesandcurrents.noaa.gov/mdapi/prod/webapi/stations";

/** User agent for API requests */
const USER_AGENT = "quiver-surf-app (contact@quiver.com)";

/** Timeout for optional API calls (water level, station info) */
const OPTIONAL_REQUEST_TIMEOUT_MS = 5000;

/**
 * Options for API client logging
 */
export interface ApiClientOptions {
  verbose?: boolean;
  logger?: {
    debug: (message: string, ...args: unknown[]) => void;
    warn: (message: string, ...args: unknown[]) => void;
    error: (message: string, ...args: unknown[]) => void;
  };
}

/**
 * Format a Date to YYYYMMDD for CO-OPS API
 */
export function formatDateForApi(date: Date): string {
  return date.toISOString().split("T")[0].replace(/-/g, "");
}

/**
 * Build the CO-OPS API URL for tide predictions
 */
export function buildPredictionsUrl(
  stationId: string,
  beginDate: string,
  endDate: string
): string {
  const url = new URL(COOPS_BASE_URL);
  url.searchParams.set("application", "quiver-surf-app");
  url.searchParams.set("station", stationId);
  url.searchParams.set("begin_date", beginDate);
  url.searchParams.set("end_date", endDate);
  url.searchParams.set("product", "predictions");
  url.searchParams.set("datum", "MLLW"); // Mean Lower Low Water
  url.searchParams.set("units", "english");
  url.searchParams.set("time_zone", "gmt"); // UTC timestamps
  url.searchParams.set("interval", "hilo"); // High and low tides only
  url.searchParams.set("format", "json");
  return url.toString();
}

/**
 * Build the CO-OPS API URL for water level
 */
function buildWaterLevelUrl(stationId: string): string {
  const url = new URL(COOPS_BASE_URL);
  url.searchParams.set("application", "quiver-surf-app");
  url.searchParams.set("station", stationId);
  url.searchParams.set("range", "1"); // Last 1 hour of data
  url.searchParams.set("product", "water_level");
  url.searchParams.set("datum", "MLLW");
  url.searchParams.set("units", "english");
  url.searchParams.set("time_zone", "gmt");
  url.searchParams.set("format", "json");
  return url.toString();
}

/**
 * Build the CO-OPS API URL for water temperature
 */
function buildWaterTemperatureUrl(stationId: string): string {
  const url = new URL(COOPS_BASE_URL);
  url.searchParams.set("application", "quiver-surf-app");
  url.searchParams.set("station", stationId);
  url.searchParams.set("range", "24"); // Last 24 hours
  url.searchParams.set("product", "water_temperature");
  url.searchParams.set("units", "metric");
  url.searchParams.set("time_zone", "gmt");
  url.searchParams.set("format", "json");
  return url.toString();
}

/**
 * Build the station metadata URL
 */
function buildStationInfoUrl(stationId: string): string {
  return `${COOPS_METADATA_URL}/${stationId}.json`;
}

/**
 * Create an AbortSignal with timeout if supported
 */
function createTimeoutSignal(timeoutMs: number): AbortSignal | undefined {
  if (
    typeof AbortSignal !== "undefined" &&
    "timeout" in AbortSignal &&
    typeof AbortSignal.timeout === "function"
  ) {
    return AbortSignal.timeout(timeoutMs);
  }
  return undefined;
}

/**
 * Fetch tide predictions (high/low tides) from CO-OPS API
 *
 * @param stationId - CO-OPS station ID
 * @param beginDate - Start date (YYYYMMDD)
 * @param endDate - End date (YYYYMMDD)
 * @param options - Optional logging configuration
 * @returns Array of tide data, or an empty array when NOAA is unavailable
 */
async function fetchTidePredictions(
  stationId: string,
  beginDate: string,
  endDate: string,
  options?: ApiClientOptions
): Promise<TideData[]> {
  try {
    const url = buildPredictionsUrl(stationId, beginDate, endDate);

    if (options?.verbose && options?.logger) {
      options.logger.debug(`Fetching NOAA CO-OPS tide data from: ${url}`);
    }

    const response = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
      },
    });

    if (!response.ok) {
      options?.logger?.error(
        `CO-OPS tide API error: ${response.status} - ${response.statusText}`
      );
      const errorText = await response.text();
      options?.logger?.error(`Error response: ${errorText}`);
      throw new Error(`CO-OPS tide API error: ${response.status}`);
    }

    const data = await response.json();

    if (options?.verbose && options?.logger) {
      options.logger.debug(`Received tide data for station ${stationId}:`, data);
    }

    if (!data.predictions) {
      options?.logger?.warn("No tide predictions data returned");
      return [];
    }

    const tideData = data.predictions.map((prediction: TideExtreme) => ({
      time:
        parseCOOPSTimestampToUnixSecondsUTC(prediction.t) ??
        Math.floor(new Date(prediction.t).getTime() / 1000),
      height: parseFloat(prediction.v),
      name: prediction.type === "H" ? "High Tide" : "Low Tide",
      type: prediction.type === "H" ? "high" : "low",
    }));

    if (options?.verbose && options?.logger) {
      options.logger.debug(
        `Parsed ${tideData.length} tide predictions for station ${stationId}`
      );
    }

    return tideData;
  } catch (error) {
    options?.logger?.error("Error fetching tide predictions:", error);
    return [];
  }
}

/**
 * Fetch current water level from CO-OPS API
 *
 * This is optional data - failures are handled silently.
 *
 * @param stationId - CO-OPS station ID
 * @returns Current water level in feet, or null on error
 */
async function fetchCurrentWaterLevel(
  stationId: string
): Promise<number | null> {
  try {
    const url = buildWaterLevelUrl(stationId);
    const timeoutSignal = createTimeoutSignal(OPTIONAL_REQUEST_TIMEOUT_MS);

    const response = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
      },
      ...(timeoutSignal ? { signal: timeoutSignal } : {}),
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();

    if (!data.data || data.data.length === 0) {
      return null;
    }

    // Return the most recent water level reading
    const latestReading = data.data[data.data.length - 1];
    return parseFloat(latestReading.v);
  } catch {
    // Silently fail - water level is optional enhancement
    return null;
  }
}

/**
 * Fetch latest water temperature from CO-OPS API
 *
 * Returns the most recent reading from the last 24 hours.
 * Silent failure — returns null on any error.
 *
 * @param stationId - CO-OPS station ID (e.g., "8720218")
 * @returns Temperature in Celsius with observation timestamp, or null
 */
export async function fetchWaterTemperature(
  stationId: string
): Promise<{ tempC: number; observedAt: string } | null> {
  try {
    const url = buildWaterTemperatureUrl(stationId);
    const timeoutSignal = createTimeoutSignal(OPTIONAL_REQUEST_TIMEOUT_MS);

    const response = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
      },
      ...(timeoutSignal ? { signal: timeoutSignal } : {}),
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();

    if (!data.data || data.data.length === 0) {
      return null;
    }

    // Use the most recent reading
    const latest = data.data[data.data.length - 1];
    const tempC = parseFloat(latest.v);

    if (!isFinite(tempC)) {
      return null;
    }

    // CO-OPS timestamps are GMT but lack timezone indicator — append Z for UTC
    const observedAt = latest.t.replace(" ", "T") + "Z";

    return { tempC, observedAt };
  } catch {
    // Silent failure — water temperature is optional enhancement
    return null;
  }
}

/**
 * Fetch station information from NOAA metadata API
 *
 * This is optional metadata - failures are handled silently.
 *
 * @param stationId - CO-OPS station ID
 * @returns Station info or null on error
 */
async function fetchStationInfo(
  stationId: string
): Promise<StationInfo | null> {
  try {
    const url = buildStationInfoUrl(stationId);
    const timeoutSignal = createTimeoutSignal(OPTIONAL_REQUEST_TIMEOUT_MS);

    const response = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
      },
      ...(timeoutSignal ? { signal: timeoutSignal } : {}),
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    // New API returns { stations: [{ name: "La Jolla" }] }
    const station = data.stations?.[0];
    return {
      name: station?.name || `Station ${stationId}`,
    };
  } catch {
    // Silently fail - station info is optional metadata
    return null;
  }
}

/**
 * Fetch all tide data for a station (predictions, water level, station info)
 *
 * Uses Promise.allSettled to fetch in parallel and handle partial failures.
 *
 * @param stationId - CO-OPS station ID
 * @param days - Number of days to fetch (default: 10)
 * @param options - Optional logging configuration
 * @returns Object with tideData, waterLevel, and stationInfo
 */
export async function fetchAllStationData(
  stationId: string,
  days: number = 10,
  options?: ApiClientOptions
): Promise<{
  tideData: TideData[];
  waterLevel: number | null;
  stationInfo: StationInfo | null;
}> {
  const now = new Date();
  const endDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

  const beginDateStr = formatDateForApi(now);
  const endDateStr = formatDateForApi(endDate);

  const [tideResult, waterLevelResult, stationInfoResult] =
    await Promise.allSettled([
      fetchTidePredictions(stationId, beginDateStr, endDateStr, options),
      fetchCurrentWaterLevel(stationId),
      fetchStationInfo(stationId),
    ]);

  // Do not fabricate tide observations when NOAA fails.
  const tideData =
    tideResult.status === "fulfilled"
      ? tideResult.value
      : [];

  const waterLevel =
    waterLevelResult.status === "fulfilled" ? waterLevelResult.value : null;

  const stationInfo =
    stationInfoResult.status === "fulfilled" ? stationInfoResult.value : null;

  // Log any failures for debugging (but don't block)
  if (tideResult.status === "rejected") {
    options?.logger?.warn(
      `Tide predictions failed for station ${stationId}`
    );
  }
  if (waterLevelResult.status === "rejected") {
    if (options?.verbose && options?.logger) {
      options.logger.debug(
        `Water level not available for station ${stationId} (optional)`
      );
    }
  }
  if (stationInfoResult.status === "rejected") {
    if (options?.verbose && options?.logger) {
      options.logger.debug(
        `Station info not available for station ${stationId} (optional)`
      );
    }
  }

  return { tideData, waterLevel, stationInfo };
}
