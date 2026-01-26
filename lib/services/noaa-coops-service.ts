/**
 * NOAA CO-OPS Service - Backwards Compatibility Re-export
 *
 * This file maintains backwards compatibility for existing imports.
 * The implementation has been refactored into the noaa-coops/ module.
 *
 * @see lib/services/noaa-coops/
 */

// Re-export everything from the new modular location
export { NOAACOOPSService } from "./noaa-coops";
export type {
  TideData,
  TideExtreme,
  COOPSForecast,
  RegionBounds,
  StationInfo,
} from "./noaa-coops";
