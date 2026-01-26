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
 * Processed tide data with parsed values
 */
export interface TideData {
  time: number; // Unix timestamp (seconds)
  height: number; // Height in feet
  name: string; // "High Tide" or "Low Tide"
  type: "high" | "low";
}

/**
 * CO-OPS forecast result containing tide predictions
 */
export interface COOPSForecast {
  station_id: string;
  station_name: string;
  tides: TideData[];
  water_level: number | null; // Current water level in feet
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
