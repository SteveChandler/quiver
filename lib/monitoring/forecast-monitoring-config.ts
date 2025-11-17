/**
 * Forecast Monitoring Configuration
 * 
 * Defines thresholds and settings for monitoring forecast data freshness,
 * cron job health, and API performance.
 */

export const MONITORING_CONFIG = {
  // Staleness alerts
  STALE_DATA_THRESHOLD_BEACHES: 10,  // Alert if >10 beaches have stale data
  CRITICAL_STALE_HOURS: 24,          // Critical if data >24h old
  WARNING_STALE_HOURS: 12,           // Warning if data >12h old
  
  // Cron job monitoring
  EXPECTED_CRON_INTERVAL_HOURS: 6,   // Cron should run every 6h
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
} as const;

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
export const DATA_SOURCES = {
  CDIP: 'CDIP',
  NOAA_NWS: 'NOAA_NWS',
  FALLBACK: 'FALLBACK',
  UNKNOWN: 'UNKNOWN',
} as const;

export type DataSourceType = (typeof DATA_SOURCES)[keyof typeof DATA_SOURCES];
