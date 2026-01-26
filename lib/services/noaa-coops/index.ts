/**
 * NOAA CO-OPS Tide Data Service
 *
 * Provides tide predictions and water level data from NOAA's
 * Center for Operational Oceanographic Products and Services (CO-OPS).
 *
 * @module noaa-coops
 */

// Re-export the main service class
export { NOAACOOPSService } from "./noaa-coops-service";

// Re-export types for consumers
export type {
  TideData,
  TideExtreme,
  COOPSForecast,
  RegionBounds,
  StationInfo,
  TideCacheEntry,
} from "./types";

// Re-export constants for advanced usage
export { COOPS_STATIONS } from "./constants/station-mappings";
export { GEOGRAPHIC_STATIONS } from "./constants/geographic-regions";

// Re-export utilities for testing
export { parseCOOPSTimestampToUnixSecondsUTC } from "./tide-analysis";
export { generateFallbackTideData } from "./fallback-generator";
