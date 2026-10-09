/**
 * Type definitions for NOAA CO-OPS tide data service
 */

/**
 * Raw tide extreme data from CO-OPS API
 */
export interface TideExtreme {
  t: string; // timestamp "YYYY-MM-DD HH:mm"
  v: string; // height value
  type: "H" | "L"; // High or Low
}

/**
 * Tide phase status returned by getTideStatusAtTime
 */
export type TideStatus = "Rising" | "Falling" | "Unknown";

/**
 * Processed tide data with parsed values
 */
export interface TideData {
  time: number; // Unix timestamp (seconds)
  height: number; // Height in feet
  name: string; // "High Tide" or "Low Tide"
  type: "high" | "low";
}

/**
 * One hourly predicted tide height
 */
export interface TideHeightSample {
  time: number; // Unix timestamp (seconds)
  height: number; // Height in feet, unrounded
}

/**
 * CO-OPS forecast result containing tide predictions
 */
export interface COOPSForecast {
  station_id: string;
  station_name: string;
  source?: string | null;
  tides: TideData[];
  water_level: number | null; // Current water level in feet
  /**
   * The hourly series `tides` was detected from, when the forecast came from
   * the tide_forecasts cache. Heights between a high and a low are read from
   * here; the live hilo API path has only the extremes.
   */
  hourly?: TideHeightSample[];
}

/**
 * Geographic region bounds for station lookup
 */
export interface RegionBounds {
  latMin: number;
  latMax: number;
  lonMin: number;
  lonMax: number;
  stationId: string;
  name: string;
}

/**
 * Station info from NOAA metadata API
 */
export interface StationInfo {
  name: string;
}

/**
 * Cache entry for tide data
 */
export interface TideCacheEntry {
  data: COOPSForecast;
  timestamp: number;
}
