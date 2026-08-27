/**
 * Constants for Coast Pulse data fetching and display
 */

/** Distance thresholds in kilometers */
export const DISTANCE = {
  /** Maximum distance for buoy search */
  BUOY_MAX_KM: 200,
  /** Maximum distance for buoy search in meters (for PostGIS) */
  BUOY_MAX_METERS: 200000,
  /** Maximum distance for CDIP station search */
  CDIP_MAX_KM: 100,
  /** Maximum distance for forecast relevance */
  FORECAST_MAX_KM: 100,
  /** Maximum distance for daily intel relevance */
  DAILY_INTEL_MAX_KM: 100,
  /** Maximum distance for intel post filtering */
  INTEL_MAX_KM: 50,
} as const;

/** Time thresholds in milliseconds */
export const TIME = {
  /** 24 hours in milliseconds */
  TWENTY_FOUR_HOURS_MS: 24 * 60 * 60 * 1000,
  /** Maximum age for buoy/sensor data before filtering out (6 hours) */
  MAX_BUOY_AGE_MS: 6 * 60 * 60 * 1000,
  /** 2 hours in milliseconds */
  TWO_HOURS_MS: 2 * 60 * 60 * 1000,
  /** 30 minutes in milliseconds */
  THIRTY_MINUTES_MS: 30 * 60 * 1000,
  /** Time window for grouping items by credibility */
  CREDIBILITY_GROUPING_MS: 30 * 60 * 1000,
  /** Maximum age for intel posts in pagination (7 days) */
  MAX_INTEL_AGE_MS: 7 * 24 * 60 * 60 * 1000,
} as const;

/** Cache and revalidation settings */
export const CACHE = {
  /** ISR revalidation interval in seconds */
  ISR_REVALIDATE_SECONDS: 120,
  /** Unstable_cache revalidation in seconds */
  CACHE_REVALIDATE_SECONDS: 300,
  /** Polling interval in milliseconds for client-side updates */
  CLIENT_POLL_INTERVAL_MS: 10 * 60 * 1000,
  /** Summary endpoint cache max-age in seconds */
  SUMMARY_CACHE_SECONDS: 30,
} as const;

/** Pagination limits */
export const PAGINATION = {
  /** Default items per page */
  DEFAULT_LIMIT: 8,
  /** Maximum items per page */
  MAX_LIMIT: 15,
  /** Number of CDIP stations to fetch */
  CDIP_STATIONS_LIMIT: 2,
  /** Number of local buoys to fetch */
  LOCAL_BUOYS_LIMIT: 5,
  /** Number of beaches to cache */
  BEACHES_CACHE_LIMIT: 100,
} as const;

/** Source credibility scores (0-100) */
export const CREDIBILITY = {
  CDIP: 95,
  TIDE: 95,
  RTMA: 92,
  NDBC: 90,
  LOCAL_BUOY: 85,
  DAILY_INTEL: 75,
  FORECAST: 70,
  INTEL_BASE: 50,
  /** Maximum bonus from confirmations */
  INTEL_CONFIRMATION_MAX: 20,
  /** Points per confirmation */
  INTEL_CONFIRMATION_MULTIPLIER: 2,
} as const;

/** Realtime subscription debounce times in milliseconds */
export const REALTIME = {
  /** Debounce for forecast/conditions changes */
  FORECAST_DEBOUNCE_MS: 500,
  /** Debounce for session events */
  SESSION_DEBOUNCE_MS: 150,
  /** Delay before cleanup to prevent WebSocket race conditions */
  CLEANUP_DELAY_MS: 100,
  /** Scroll threshold to consider user "at top" */
  SCROLL_TOP_THRESHOLD_PX: 50,
} as const;

/** Intersection observer settings */
export const OBSERVER = {
  /** Root margin for triggering infinite scroll load */
  INFINITE_SCROLL_MARGIN: "200px",
  /** Root margin for triggering visibility-based lazy loading */
  VISIBILITY_MARGIN: "200px",
} as const;
