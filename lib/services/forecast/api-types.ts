/**
 * Type definitions for external forecast API responses
 *
 * Re-exports and defines the types used by forecast-builder.ts to eliminate `any`.
 * Rather than duplicating existing interfaces, this module re-exports from the
 * authoritative source modules and adds only the types that are missing.
 */

// Re-export wave forecast types from their canonical source
export type {
  WaveWatchForecast,
  WaveWatchData,
} from "@/lib/services/noaa-wavewatch/types";

// Re-export tide types from their canonical source
// Note: noaa-coops uses `TideData` (with `name` and lowercase `type: "high" | "low"`)
// which is different from `TidePoint` in types/forecast.ts (`type: "H" | "L"`).
export type {
  COOPSForecast,
  TideData as COOPSTideData,
} from "@/lib/services/noaa-coops/types";

// Re-export weather and CDIP types from their canonical source
export type {
  WeatherPeriod,
  CDIPDataPoint,
  CDIPBuoyData,
} from "@/types/forecast";

/**
 * NDBC buoy observation row from the `buoys` database table.
 *
 * This is a minimal interface covering only the fields accessed by
 * forecast-builder.ts. The actual database row has additional columns
 * (buoy_uuid, active, etc.) that are not relevant here.
 */
export interface NDBCBuoyRow {
  wave_height?: number | null;
  wave_period?: number | null;
  water_temperature?: number | null;
  wave_direction?: number | null;
  /** Distance from beach in km (computed at fetch time, not a DB column) */
  distance?: number;
}

/**
 * Resolved tide info returned by ForecastBuilder.getTideInfo().
 *
 * This is the internal shape produced by the private getTideInfo method and
 * consumed by buildSingleForecast to populate tide-related forecast fields.
 */
export interface ResolvedTideInfo {
  status: string;
  currentHeight: string;
  nextTideTime: string;
  nextTideType: string;
  nextTideHeight: string;
  nextTideAt: string | null;
}
