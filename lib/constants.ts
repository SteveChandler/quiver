// Default coordinates used throughout the application
export const DEFAULT_COORDINATES = {
  OCEAN_BEACH_LAT: 32.7532,
  OCEAN_BEACH_LNG: -117.2564,
  DEFAULT_LAT: 32.7532,
  DEFAULT_LNG: -117.2564,
} as const;

// Distance constants
export const DISTANCE_LIMITS = {
  MAX_DISTANCE_MILES: 30,
  MAX_DISTANCE_METERS: 100000,
} as const;

// Pagination defaults
export const PAGINATION_DEFAULTS = {
  LIMIT: 10,
  MAX_LIMIT: 50,
  DEFAULT_PAGE: 1,
} as const;

// API endpoints
export const API_ENDPOINTS = {
  NDBC_REALTIME_BASE: "https://www.ndbc.noaa.gov/data/realtime2",
  NOAA_API_BASE: "https://api.weather.gov",
  NOAA_TIDES_BASE: "https://api.tidesandcurrents.noaa.gov/api/prod/datagetter",
  NOAA_WAVEWATCH: "https://nomads.ncep.noaa.gov/dods/wave/mww3",
} as const;

// Beach cluster configuration
export const PACIFIC_BEACH_CLUSTER = {
  name: "Pacific Beach Cluster",
  beaches: [
    "Ocean Beach",
    "Mission Beach",
    "Pacific Beach",
    "La Jolla",
    "Windansea",
    "Tourmaline",
    "Sunset Cliffs",
  ],
} as const;

// Form validation limits
export const FORM_LIMITS = {
  NAME_MIN_LENGTH: 2,
  NAME_MAX_LENGTH: 50,
  BIO_MAX_LENGTH: 300,
  LOCATION_MAX_LENGTH: 100,
  EXPERIENCE_MAX_LENGTH: 50,
  FAVORITE_SPOT_MAX_LENGTH: 100,
  INSTAGRAM_MAX_LENGTH: 100,
  PASSWORD_MIN_LENGTH: 6,
} as const;

// Database table names
export const TABLES = {
  BEACHES: "beaches",
  BOARDS: "boards",
  SESSIONS: "sessions",
  PROFILES: "profiles",
  BUOYS: "buoys",
  FORECASTS: "forecasts",
  LIKES: "session_likes",
  COMMENTS: "session_comments",
} as const;

// Session statuses
export const SESSION_STATUS = {
  PLANNED: "planned",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
} as const;

// File upload limits
export const UPLOAD_LIMITS = {
  MAX_FILE_SIZE: 5 * 1024 * 1024, // 5MB
  ALLOWED_IMAGE_TYPES: ["image/jpeg", "image/png", "image/webp", "image/gif"],
} as const;

// Cache durations (in milliseconds)
export const CACHE_DURATION = {
  FORECAST_CACHE: 30 * 60 * 1000, // 30 minutes
  BUOY_CACHE: 15 * 60 * 1000, // 15 minutes
  BEACH_CACHE: 60 * 60 * 1000, // 1 hour
} as const;

// Rate limiting
export const RATE_LIMITS = {
  API_CALLS_PER_MINUTE: 60,
  FORECAST_UPDATES_PER_HOUR: 100,
  MAX_CONCURRENT_REQUESTS: 10,
} as const;

// Error messages
export const ERROR_MESSAGES = {
  UNAUTHORIZED: "Authentication required",
  FORBIDDEN: "Access denied",
  NOT_FOUND: "Resource not found",
  VALIDATION_ERROR: "Validation failed",
  INTERNAL_ERROR: "Internal server error",
  NETWORK_ERROR: "Network connection failed",
  TIMEOUT_ERROR: "Request timed out",
} as const;

// Success messages
export const SUCCESS_MESSAGES = {
  PROFILE_UPDATED: "Profile updated successfully",
  SESSION_LOGGED: "Session logged successfully",
  SESSION_PLANNED: "Session planned successfully",
  BOARD_ADDED: "Board added successfully",
  BOARD_UPDATED: "Board updated successfully",
  BOARD_DELETED: "Board deleted successfully",
  AUTH_SUCCESS: "Authentication successful",
} as const;

export const FORECAST_CONFIG = {
  // NOAA Data Sources (Free, no API key required)
  NOAA_WAVEWATCH: "https://nomads.ncep.noaa.gov/dods/wave/mww3",
  NOAA_COOPS: "https://api.tidesandcurrents.noaa.gov/api/prod/datagetter",
  NOAA_NWS: "https://api.weather.gov",
  NDBC_BUOYS: "https://www.ndbc.noaa.gov/data/realtime2",

  // Enhanced forecast parameters - aligned with NOAA update schedule
  DEFAULT_FORECAST_DAYS: 10,
  UPDATE_INTERVAL_HOURS: 6, // NOAA updates every 6 hours
  CACHE_TTL_HOURS: 3, // Cache for half of NOAA's update cycle
} as const;
