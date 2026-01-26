/**
 * Constants for CDIP API integration
 *
 * Contains configuration values, station mappings, and data quality thresholds.
 */

// Re-export station configurations from main constants file
export {
  CDIP_STATIONS,
  SOCAL_PRIMARY_STATIONS,
  CDIP_API_CONFIG,
  DATA_QUALITY_THRESHOLDS,
  getStationConfig,
  getStationCoverageRadius,
} from "@/lib/constants/cdip-stations";

/**
 * Cache timeout in milliseconds (30 minutes)
 */
export const CACHE_TIMEOUT_MS = 30 * 60 * 1000;

/**
 * Maximum concurrent requests when fetching multiple stations
 */
export const MAX_CONCURRENT_REQUESTS = 3;

/**
 * Delay between batches in milliseconds
 */
export const BATCH_DELAY_MS = 1000;

/**
 * User agent for CDIP API requests
 */
export const USER_AGENT = "quiver-surf-app/1.0 (contact@quiver-surf.com)";

/**
 * Default maximum distance for nearest station lookup (in kilometers)
 */
export const DEFAULT_MAX_DISTANCE_KM = 50;

/**
 * Maximum cache size (number of entries)
 */
export const MAX_CACHE_SIZE = 20;

/**
 * Blacklisted stations that are known to have issues
 * These stations frequently return 404 errors on the ERDDAP dataset
 */
export const DEFAULT_BLACKLIST = [
  "46221", // Point Arena: observed 404s on wave_agg
  "46225", // Point Reyes: observed 404s on wave_agg
  "46236", // Monterey Bay: treat as non-CDIP for now; observed issues on wave_agg
];

/**
 * Swell estimation factors (used when swell separation data is not available)
 */
export const SWELL_ESTIMATION = {
  /** Percentage of total wave height attributed to swell */
  swellHeightRatio: 0.8,
  /** Period multiplier for swell (swell has longer periods) */
  swellPeriodMultiplier: 1.1,
  /** Percentage of total wave height attributed to wind waves */
  windWaveHeightRatio: 0.2,
  /** Period multiplier for wind waves (shorter periods) */
  windWavePeriodMultiplier: 0.6,
  /** Minimum wind wave period in seconds */
  minWindWavePeriod: 3,
};
