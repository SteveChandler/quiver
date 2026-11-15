/**
 * NOAA CO-OPS API Client
 *
 * Handles HTTP requests to the NOAA Center for Operational
 * Oceanographic Products and Services (CO-OPS) API.
 */

import { buildDatagetterUrl, fetchDatagetter, NoaaTideRequestError } from "./datagetter";
import type { TideData, TideExtreme, StationInfo } from "./types";
import { parseCOOPSTimestampToUnixSecondsUTC } from "./tide-analysis";

/** NOAA Metadata API base URL */
const COOPS_METADATA_URL =
  "https://api.tidesandcurrents.noaa.gov/mdapi/prod/webapi/stations";

/** User agent for API requests */
const USER_AGENT = "quiver-surf-app (contact@quiver.com)";

/** Timeout for optional API calls (water level, station info) */
const OPTIONAL_REQUEST_TIMEOUT_MS = 5000;

// Tide tables leave out the 2026 marine-heat-wave sea-level rise; real water runs this far above
// them. Measured Nov 1 2026, 72 h observed minus predicted: San Diego +1.56, LA +1.47,
// Santa Barbara +1.46, Port San Luis +1.37, San Francisco +1.41 ft.
// ponytail: hand-set constant. seaside fetch-trusted-forecasts flags when WaveCast's sea-level
// advisory drifts 4 in from this or disappears; runbook: seaside docs/sea-level-offset-watch.md.
// Change seaside QUIVER_SEA_LEVEL_OFFSET_IN with it.
const CALIFORNIA_SEA_LEVEL_OFFSET_FT = 1.5;

// Subordinate stations whose ids do not start with 941 but whose NOAA table is a 941* reference
// station's table plus offsets, so their water carries the same anomaly. From NOAA mdapi
// stations.json?type=tidepredictions (reference_id), Nov 14 2026; matches tide_stations.
const SUBORDINATES_OF_CALIFORNIA_REFERENCE = new Set([
  // 9410170 San Diego
  "TWC0379", "TWC0381", "TWC0383", "TWC0385", "TWC0387", "TWC0389", "TWC0399", "TWC0401",
  "TWC0403", "TWC0405", "TWC0413", "TWC0419",
  // 9410660 Los Angeles
  "TWC0427", "TWC0439", "TWC0445", "TWC0463",
  // 9412110 Port San Luis
  "TWC0473",
  // 9414290 San Francisco
  "TWC0547", "TWC0649",
  // 9416841 Arena Cove
  "TWC0771", "TWC0777",
  // 9419750 Crescent City
  "9430104", "9435362", "9435385", "9436031", "9436101", "9437262", "9437331", "9437581",
  "9437815", "9437908", "TWC0817", "TWC0857", "TWC0863", "TWC0865",
]);

/**
 * Feet to add to predicted tide heights at a CO-OPS station: California ids start with 941, and a
 * subordinate station takes its 941* reference station's adjustment (Steven, Nov 11 2026).
 */
export function seaLevelOffsetFt(stationId: string): number {
  return stationId.startsWith("941") || SUBORDINATES_OF_CALIFORNIA_REFERENCE.has(stationId)
    ? CALIFORNIA_SEA_LEVEL_OFFSET_FT
    : 0;
}

/**
 * Options for API client logging
 */
interface ApiClientOptions {
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
  const params = new URLSearchParams();
  params.set("station", stationId);
  params.set("begin_date", beginDate);
  params.set("end_date", endDate);
  params.set("product", "predictions");
  params.set("datum", "MLLW"); // Mean Lower Low Water
  params.set("units", "english");
  params.set("time_zone", "gmt"); // UTC timestamps
  params.set("interval", "hilo"); // High and low tides only
  params.set("format", "json");
  return buildDatagetterUrl(params);
}

/**
 * Build the CO-OPS API URL for water level
 */
function buildWaterLevelUrl(stationId: string): string {
  const params = new URLSearchParams();
  params.set("station", stationId);
  params.set("range", "1"); // Last 1 hour of data
  params.set("product", "water_level");
  params.set("datum", "MLLW");
  params.set("units", "english");
  params.set("time_zone", "gmt");
  params.set("format", "json");
  return buildDatagetterUrl(params);
}

/**
 * Build the CO-OPS API URL for water temperature
 */
function buildWaterTemperatureUrl(stationId: string): string {
  const params = new URLSearchParams();
  params.set("station", stationId);
  params.set("range", "24"); // Last 24 hours
  params.set("product", "water_temperature");
  params.set("units", "metric");
  params.set("time_zone", "gmt");
  params.set("format", "json");
  return buildDatagetterUrl(params);
}

/**
 * Build the station metadata URL
 */
function buildStationInfoUrl(stationId: string): string {
  return `${COOPS_METADATA_URL}/${stationId}.json`;
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

    const data = await fetchDatagetter(url);

    if (options?.verbose && options?.logger) {
      options.logger.debug(`Received tide data for station ${stationId}:`, data);
    }

    if (!data.predictions) {
      // NOAA explains an empty answer in `error.message`; keep it so a run says why.
      const noaaMessage = typeof data?.error?.message === "string" ? data.error.message.trim() : "";
      const detail = noaaMessage ? `: ${noaaMessage.slice(0, 300)}` : "";
      options?.logger?.warn(`No tide predictions data returned for station ${stationId}${detail}`);
      return [];
    }

    const offsetFt = seaLevelOffsetFt(stationId);
    const tideData = data.predictions.map((prediction: TideExtreme): TideData => ({
      time:
        parseCOOPSTimestampToUnixSecondsUTC(prediction.t) ??
        Math.floor(new Date(prediction.t).getTime() / 1000),
      height: Math.round((parseFloat(prediction.v) + offsetFt) * 1000) / 1000,
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
    const message = error instanceof Error ? error.message : String(error);
    const transient = error instanceof NoaaTideRequestError &&
      (error.status === undefined || error.status === 403 || error.status === 404 || error.status === 429 || error.status >= 500);
    if (transient) {
      options?.logger?.warn(`Network error fetching tide predictions for station ${stationId}: ${message}`);
    } else {
      options?.logger?.error(`Error fetching tide predictions for station ${stationId}:`, error);
    }
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

    const data = await fetchDatagetter(url, OPTIONAL_REQUEST_TIMEOUT_MS);

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

    const data = await fetchDatagetter(url, OPTIONAL_REQUEST_TIMEOUT_MS);

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

    const response = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
      },
      signal: AbortSignal.timeout(OPTIONAL_REQUEST_TIMEOUT_MS),
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
