/**
 * IOOS Data Parser
 *
 * Utilities for parsing ERDDAP API responses and converting data formats.
 *
 * @module ioos/data-parser
 */

import {
  IOOS_WAVE_VARIABLES,
  IOOS_QUALITY_THRESHOLDS,
  IOOS_VARIABLE_ALIASES,
  CanonicalVar,
} from "@/lib/constants/ioos-config";
import { IOOSObservation, IOOSNetwork } from "@/types/ioos";
import { ParsedObservation } from "./types";
import { NETWORK_PATTERNS } from "./constants";

/**
 * Format date as ISO Zulu string without milliseconds (ERDDAP format)
 *
 * @param d - Date to format
 * @returns ISO 8601 string in Zulu time (e.g., "2024-01-01T12:00:00Z")
 */
export function isoZulu(d: Date): string {
  return d.toISOString().replace(/\.\d{3}Z$/, "Z");
}

/**
 * Safely convert value to number, returning null for invalid values
 *
 * @param x - Value to convert
 * @returns Number or null if conversion fails
 */
function toNumber(x: unknown): number | null {
  if (x === null || x === undefined) return null;
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}

/**
 * Build a variable map by matching available ERDDAP variables to canonical names
 * Uses alias priority: first match in the alias list wins
 *
 * @param availableVars - List of variable names from ERDDAP /info endpoint
 * @returns Mapping of canonical names to ERDDAP variable names
 *
 * @example
 * ```ts
 * const vars = ["sea_surface_wave_significant_height", "sea_surface_wave_peak_period"];
 * const map = buildVariableMap(vars);
 * // Returns: { wave_height: "sea_surface_wave_significant_height", wave_period: "sea_surface_wave_peak_period" }
 * ```
 */
export function buildVariableMap(
  availableVars: string[]
): Partial<Record<CanonicalVar, string>> {
  const varSet = new Set(availableVars);
  const result: Partial<Record<CanonicalVar, string>> = {};

  for (const [canonical, aliases] of Object.entries(IOOS_VARIABLE_ALIASES)) {
    for (const alias of aliases) {
      if (varSet.has(alias)) {
        result[canonical as CanonicalVar] = alias;
        break; // First match wins
      }
    }
  }

  return result;
}

/**
 * Parse an ERDDAP response row into a canonical observation
 * Uses the station's variable_map to find the right columns
 *
 * @param row - Row object from ERDDAP response (column name -> value)
 * @param variableMap - Mapping of canonical names to ERDDAP variable names
 * @returns Parsed observation or null if time field is missing
 *
 * @example
 * ```ts
 * const row = {
 *   time: "2024-01-01T12:00:00Z",
 *   sea_surface_wave_significant_height: 1.5,
 *   sea_surface_wave_peak_period: 10.2
 * };
 * const varMap = {
 *   wave_height: "sea_surface_wave_significant_height",
 *   wave_period: "sea_surface_wave_peak_period"
 * };
 * const obs = parseObservationRow(row, varMap);
 * // Returns: { observedAt: "2024-01-01T12:00:00Z", waveHeightM: 1.5, wavePeriodS: 10.2, ... }
 * ```
 */
export function parseObservationRow(
  row: Record<string, unknown>,
  variableMap: Partial<Record<CanonicalVar, string>>
): ParsedObservation | null {
  const time = row["time"];
  if (typeof time !== "string") return null;

  const get = (k?: string): unknown => (k ? row[k] : null);

  return {
    observedAt: time,
    waveHeightM: toNumber(get(variableMap.wave_height)),
    wavePeriodS: toNumber(get(variableMap.wave_period)),
    waveDirectionDeg: toNumber(get(variableMap.wave_direction)),
    waterTempC: toNumber(get(variableMap.water_temp)),
    windSpeedMS: toNumber(get(variableMap.wind_speed)),
    windDirectionDeg: toNumber(get(variableMap.wind_direction)),
    raw: row,
  };
}

/**
 * Parse observation row into IOOSObservation format (legacy format)
 * Used for the legacy buildObservationUrl API that uses hardcoded variables
 *
 * @param stationId - Station identifier
 * @param row - Array of values from ERDDAP response
 * @param columnNames - Array of column names from ERDDAP response
 * @returns IOOSObservation with parsed data
 */
export function parseObservationArray(
  stationId: string,
  row: (string | number | null)[],
  columnNames: string[]
): IOOSObservation {
  const getValue = (varNames: readonly string[]): number | null => {
    for (const varName of varNames) {
      const idx = columnNames.indexOf(varName);
      if (idx >= 0 && row[idx] != null) {
        const val = Number(row[idx]);
        return isFinite(val) ? val : null;
      }
    }
    return null;
  };

  const timeIdx = columnNames.indexOf("time");
  const observedAt = timeIdx >= 0 ? String(row[timeIdx]) : new Date().toISOString();

  let waveHeight = getValue(IOOS_WAVE_VARIABLES.waveHeight);
  const wavePeriod = getValue(IOOS_WAVE_VARIABLES.wavePeriod);
  const waveDirection = getValue(IOOS_WAVE_VARIABLES.waveDirection);
  const waterTemp = getValue(IOOS_WAVE_VARIABLES.waterTemp);
  const windSpeed = getValue(IOOS_WAVE_VARIABLES.windSpeed);
  const windDirection = getValue(IOOS_WAVE_VARIABLES.windDirection);

  // Validate wave height bounds
  if (
    waveHeight !== null &&
    (waveHeight < IOOS_QUALITY_THRESHOLDS.waveHeight.min ||
      waveHeight > IOOS_QUALITY_THRESHOLDS.waveHeight.max)
  ) {
    waveHeight = null;
  }

  return {
    station_id: stationId,
    observed_at: observedAt,
    wave_height_m: waveHeight,
    wave_period_s: wavePeriod,
    wave_direction_deg: waveDirection,
    water_temp_c: waterTemp,
    wind_speed_ms: windSpeed,
    wind_direction_deg: windDirection,
    raw_data: { row, columnNames },
  };
}

/**
 * Parse network from datasetId and institution
 *
 * IOOS dataset IDs often follow pattern: "ism-NETWORK-..."
 * e.g., "ism-secoora-sun2wave-sunset-nearshore-wave"
 *
 * @param datasetId - ERDDAP dataset ID
 * @param institution - Institution name from ERDDAP
 * @returns IOOSNetwork identifier
 *
 * @example
 * ```ts
 * parseNetwork("ism-pacioos-ww3-global", "PacIOOS");
 * // Returns: "PacIOOS"
 *
 * parseNetwork("edu_ucsd_cdip_155", "CDIP");
 * // Returns: "CeNCOOS" (CDIP maps to CeNCOOS)
 * ```
 */
export function parseNetwork(datasetId: string, institution: string): IOOSNetwork {
  // First check datasetId for "ism-NETWORK-" pattern
  const ismMatch = datasetId.toLowerCase().match(NETWORK_PATTERNS.ISM_PREFIX);
  if (ismMatch) {
    const network = ismMatch[1];
    const mapped = NETWORK_PATTERNS.NETWORKS[network as keyof typeof NETWORK_PATTERNS.NETWORKS];
    if (mapped) return mapped;
  }

  // Also check if network name appears anywhere in datasetId
  const lowerDatasetId = datasetId.toLowerCase();
  for (const [key, value] of Object.entries(NETWORK_PATTERNS.NETWORKS)) {
    if (lowerDatasetId.includes(key)) {
      return value;
    }
  }

  // Fallback to institution name check
  const lowerInst = institution.toLowerCase();
  for (const [key, value] of Object.entries(NETWORK_PATTERNS.NETWORKS)) {
    if (lowerInst.includes(key)) {
      return value;
    }
  }

  // Special case: "data buoy" institution indicates NDBC
  if (lowerInst.includes("data buoy")) {
    return "NDBC";
  }

  return "unknown";
}

/**
 * Convert array row to object using column names
 * Helper for ERDDAP responses that come as [columnNames, rows[]]
 *
 * @param row - Array of values
 * @param columnNames - Array of column names
 * @returns Object with column names as keys
 */
export function rowToObject(
  row: (string | number | null)[],
  columnNames: string[]
): Record<string, unknown> {
  const obj: Record<string, unknown> = {};
  for (let i = 0; i < columnNames.length; i++) {
    obj[columnNames[i]] = row[i];
  }
  return obj;
}
