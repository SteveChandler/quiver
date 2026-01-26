/**
 * CDIP (Coastal Data Information Program) Service
 *
 * Provides high-quality wave data from buoy stations along the California coast.
 * Operated by Scripps Institution of Oceanography.
 *
 * @module cdip
 */

// Re-export the main service class
export { CDIPService } from "./cdip-service";

// Re-export types for consumers
export type {
  CDIPBuoyData,
  CDIPDataPoint,
  CDIPDataResponse,
  CDIPMetaResponse,
  CDIPStationConfig,
  CDIPCacheEntry,
} from "./types";

// Re-export constants for advanced usage
export {
  CDIP_STATIONS,
  SOCAL_PRIMARY_STATIONS,
  CDIP_API_CONFIG,
  DATA_QUALITY_THRESHOLDS,
  getStationConfig,
  getStationCoverageRadius,
  USER_AGENT,
  DEFAULT_MAX_DISTANCE_KM,
  MAX_CONCURRENT_REQUESTS,
  CACHE_TIMEOUT_MS,
} from "./constants";

// Re-export utilities for testing and advanced usage
export {
  transformToCDIPBuoyData,
  transformERDDAPToDataResponse,
  calculateDataQualityScore,
  isValidDataPoint,
  normalizeStationIdForErddap,
} from "./data-parser";
export { CDIPCache } from "./cache";
export { CDIPApiClient } from "./api-client";
