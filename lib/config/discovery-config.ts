/**
 * Discovery Service Configuration
 *
 * Centralized configuration for the surf discovery service.
 * Extracted from hard-coded values to enable easy tuning and documentation.
 *
 * @see lib/services/surf-discovery-service.ts
 */

/**
 * Discovery result limits
 */
export const DISCOVERY_LIMITS = {
  /** Maximum beaches to evaluate (controls DB query size) */
  MAX_CANDIDATES: 50,
  /** Maximum recommendations returned to client */
  MAX_RESULTS: 20,
  /** Default results when limit not specified */
  DEFAULT_RESULTS: 10,
  /** Parallel forecast fetch batch size */
  FORECAST_BATCH_SIZE: 20,
} as const;

/**
 * Scoring algorithm weights
 */
export const DISCOVERY_SCORING = {
  /** Weight for conditions score (wave, wind, tide fit) */
  CONDITIONS_WEIGHT: 0.7,
  /** Weight for forecast confidence score */
  CONFIDENCE_WEIGHT: 0.3,
  /** Minimum score to include in results (0-100 scale) */
  MINIMUM_SCORE_THRESHOLD: 50,
  /** Lower threshold for morning discoveries (more lenient) */
  MINIMUM_SCORE_THRESHOLD_MORNING: 35,
} as const;

/**
 * Timeout configuration (milliseconds)
 */
export const DISCOVERY_TIMEOUTS = {
  /** Total timeout for discovery request */
  TOTAL_REQUEST_MS: 12000,
  /** Individual forecast fetch timeout */
  FORECAST_FETCH_MS: 8000,
  /** Database query timeout */
  DB_QUERY_MS: 5000,
} as const;

/**
 * Window selection configuration
 */
export const DISCOVERY_WINDOWS = {
  /** Hours in each forecast window */
  WINDOW_SIZE_HOURS: 3,
  /** Maximum hours ahead to look for windows */
  MAX_LOOKAHEAD_HOURS: 48,
  /** Prefer windows starting after this hour (24h format) */
  PREFERRED_START_HOUR: 6,
  /** Prefer windows ending before this hour (24h format) */
  PREFERRED_END_HOUR: 19,
} as const;

// Type exports for consumers
export type DiscoveryLimits = typeof DISCOVERY_LIMITS;
export type DiscoveryScoring = typeof DISCOVERY_SCORING;
export type DiscoveryTimeouts = typeof DISCOVERY_TIMEOUTS;
export type DiscoveryWindows = typeof DISCOVERY_WINDOWS;
