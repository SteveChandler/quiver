/**
 * IOOS URL Builder
 *
 * Utilities for constructing ERDDAP API URLs with proper encoding and validation.
 *
 * @module ioos/url-builder
 */

import {
  IOOS_API_CONFIG,
  IOOS_ENDPOINTS,
  IOOS_WAVE_VARIABLES,
  IOOS_OBSERVATION_CONFIG,
  CanonicalVar,
} from "@/lib/constants/ioos-config";
import { isoZulu } from "./data-parser";
import { STATION_ID_PATTERN } from "./constants";

/**
 * Build observation URL dynamically based on station's variable_map
 * Uses absolute time constraints to avoid ancient data
 * Returns null if station has no wave height variable
 *
 * @param stationId - ERDDAP dataset ID
 * @param variableMap - Mapping of canonical names to ERDDAP variable names
 * @param now - Current time (for testing purposes)
 * @returns URL string or null if station lacks wave height variable
 *
 * @example
 * ```ts
 * const url = buildDynamicObservationUrl("edu_ucsd_cdip_155", {
 *   wave_height: "sea_surface_wave_significant_height",
 *   wave_period: "sea_surface_wave_peak_period"
 * });
 * // Returns: "https://erddap.sensors.ioos.us/erddap/tabledap/edu_ucsd_cdip_155.json?..."
 * ```
 */
export function buildDynamicObservationUrl(
  stationId: string,
  variableMap: Partial<Record<CanonicalVar, string>>,
  now: Date = new Date()
): string | null {
  // Bug Fix #1: Validate station ID format to prevent URL injection
  if (!STATION_ID_PATTERN.test(stationId)) {
    console.warn(`[IOOS] Invalid station ID format: ${stationId}`);
    return null;
  }

  // Bug Fix #1: Must have at least wave height to be useful (with trim check for empty strings)
  if (!variableMap.wave_height || variableMap.wave_height.trim() === "") {
    return null;
  }

  const { lookbackHours, maxFutureMinutes } = IOOS_OBSERVATION_CONFIG;
  const minTime = new Date(now.getTime() - lookbackHours * 3600_000);
  const maxTime = new Date(now.getTime() + maxFutureMinutes * 60_000);

  // Build variable list from what's available
  const vars: string[] = ["time"];
  if (variableMap.wave_height) vars.push(variableMap.wave_height);
  if (variableMap.wave_period) vars.push(variableMap.wave_period);
  if (variableMap.wave_direction) vars.push(variableMap.wave_direction);
  if (variableMap.water_temp) vars.push(variableMap.water_temp);
  if (variableMap.wind_speed) vars.push(variableMap.wind_speed);
  if (variableMap.wind_direction) vars.push(variableMap.wind_direction);

  const base = `${IOOS_API_CONFIG.baseUrl}/tabledap/${stationId}.json`;

  // Build constraints with proper URL encoding
  const constraints = [
    `time>=${isoZulu(minTime)}`,
    `time<=${isoZulu(maxTime)}`,
    `${variableMap.wave_height}!=NaN`,
    `orderByMax("time")`,
  ].map((c) => encodeURIComponent(c));

  return `${base}?${vars.join(",")}&${constraints.join("&")}`;
}

/**
 * Build URL for fetching observations (legacy format)
 * Only requests time and wave height - the most universally available variable
 * Different datasets use different variable names for period (peak vs mean)
 * which causes 400 errors if the variable doesn't exist
 *
 * @param stationId - ERDDAP dataset ID
 * @returns URL string for observation query
 */
export function buildObservationUrl(stationId: string): string {
  const waveVars = ["time", ...IOOS_WAVE_VARIABLES.waveHeight.slice(0, 1)].join(",");

  const endpoint = IOOS_ENDPOINTS.observations.replace("{datasetId}", stationId);
  // URL-encode >= as %3E= to avoid 500 errors on some ERDDAP servers
  return `${IOOS_API_CONFIG.baseUrl}${endpoint}?${waveVars}&time%3E=max(time)-1hour`;
}

/**
 * Build URL for fetching station variables from ERDDAP /info endpoint
 *
 * @param stationId - ERDDAP dataset ID
 * @returns URL string for station info query
 */
export function buildStationInfoUrl(stationId: string): string {
  return `${IOOS_API_CONFIG.baseUrl}/info/${stationId}/index.json`;
}

/**
 * Build URL for discovering all datasets
 *
 * @returns URL string for all datasets query
 */
export function buildAllDatasetsUrl(): string {
  return `${IOOS_API_CONFIG.baseUrl}${IOOS_ENDPOINTS.allDatasets}`;
}
