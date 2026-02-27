/**
 * Forecast Monitoring Configuration
 * 
 * Defines thresholds and settings for monitoring forecast data freshness,
 * cron job health, and API performance.
 */

/**
 * Parse an environment variable as a number, returning the fallback if not set or invalid.
 */
function envNumber(key: string, fallback: number): number {
  const val = process.env[key];
  if (val == null || val.trim() === "") return fallback;
  const parsed = Number(val);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const MONITORING_CONFIG = {
  // Staleness alerts (enhanced forecasts - primary source)
  // Note: STALE_DATA_THRESHOLD_BEACHES and WARNING_STALE_HOURS are tuned to match
  // actual cron capacity. With 261 beaches, ~20 updates/hour, and a 12h freshness
  // window, ~30 beaches will naturally be in the 12-16h range at any given time.
  STALE_DATA_THRESHOLD_BEACHES: 35,  // Alert if >35 beaches have stale data (allows for normal variance)
  CRITICAL_STALE_HOURS: 24,          // Critical if data >24h old
  WARNING_STALE_HOURS: 16,           // Warning if data >16h old (4h buffer after 12h freshness window)
  
  /**
   * Source-specific staleness thresholds (warning / critical hours).
   * Aligned with respective cron refresh windows to avoid false positives.
   * 
   * Override via environment variables:
   * - MONITORING_MARINE_WARNING_HOURS / MONITORING_MARINE_CRITICAL_HOURS
   * - MONITORING_TIDE_WARNING_HOURS / MONITORING_TIDE_CRITICAL_HOURS
   * - MONITORING_SUN_WARNING_HOURS / MONITORING_SUN_CRITICAL_HOURS
   */
  get MARINE_WARNING_HOURS() {
    // Marine cron runs hourly with 130 beaches; 3h window in selection
    return envNumber("MONITORING_MARINE_WARNING_HOURS", 3);
  },
  get MARINE_CRITICAL_HOURS() {
    return envNumber("MONITORING_MARINE_CRITICAL_HOURS", 6);
  },
  get TIDE_WARNING_HOURS() {
    // Tide cron runs weekly (Sun 4 AM UTC) fetching 30 days of deterministic predictions.
    // Warning after 8 days = one missed weekly run.
    return envNumber("MONITORING_TIDE_WARNING_HOURS", 192);
  },
  get TIDE_CRITICAL_HOURS() {
    // Critical after 14 days = two missed weekly runs
    return envNumber("MONITORING_TIDE_CRITICAL_HOURS", 336);
  },
  get SUN_WARNING_HOURS() {
    // Sun cron runs daily; 7 day (168h) threshold is appropriate
    return envNumber("MONITORING_SUN_WARNING_HOURS", 168);
  },
  get SUN_CRITICAL_HOURS() {
    return envNumber("MONITORING_SUN_CRITICAL_HOURS", 336);
  },
  get IOOS_WARNING_HOURS() {
    // IOOS observation sync runs every 2h; 6h warning threshold
    return envNumber("MONITORING_IOOS_WARNING_HOURS", 6);
  },
  get IOOS_CRITICAL_HOURS() {
    // Critical if no observations for 12+ hours
    return envNumber("MONITORING_IOOS_CRITICAL_HOURS", 12);
  },

  // Cron job monitoring
  EXPECTED_CRON_INTERVAL_HOURS: 2,   // Cron should run every 2h
  CRON_TIMEOUT_MULTIPLIER: 1.5,      // Alert if 1.5x expected time passes
  
  // API health
  API_ERROR_RATE_THRESHOLD: 0.1,     // Alert if >10% API calls fail
  RATE_LIMIT_ALERT_THRESHOLD: 3,     // Alert after 3 rate limit hits
  
  // Coverage
  MIN_FORECAST_COVERAGE: 0.9,        // Alert if <90% of beaches have forecasts
  MIN_FORECAST_DAYS: 7,              // Each beach should have at least 7 days of forecasts
  
  // Performance
  SLOW_QUERY_THRESHOLD_MS: 1000,     // Log queries slower than 1s
  BATCH_SIZE_RECOMMENDATION: 5,      // Recommended batch size for processing
};

/**
 * Health status levels
 */
export type HealthStatus = 'healthy' | 'degraded' | 'critical';

/**
 * Monitoring alert severity levels
 */
export type AlertSeverity = 'info' | 'warning' | 'error' | 'critical';

/**
 * Data source types for tracking
 */
const DATA_SOURCES = {
  CDIP: 'CDIP',
  NOAA_NWS: 'NOAA_NWS',
  IOOS: 'IOOS',
  FALLBACK: 'FALLBACK',
  UNKNOWN: 'UNKNOWN',
} as const;

export type DataSourceType = (typeof DATA_SOURCES)[keyof typeof DATA_SOURCES];
