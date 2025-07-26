// Cache TTL values in milliseconds - Updated for NOAA 6-hour cycle
export const CACHE_TTL = {
  API_CALLS: 30 * 60 * 1000, // 30 minutes - reduced frequency for free APIs
  FORECASTS: 3 * 60 * 60 * 1000, // 3 hours - NOAA updates every 6 hours
  BEACH_DATA: 12 * 60 * 60 * 1000, // 12 hours - beach info rarely changes
  USER_SESSIONS: 5 * 60 * 1000, // 5 minutes - still dynamic
  // Map-specific cache TTLs - simplified for NOAA reliability
  MAP_BUOY_CONDITIONS: 4 * 60 * 60 * 1000, // 4 hours - real NOAA data
  MAP_NEARBY_BUOYS: 24 * 60 * 60 * 1000, // 24 hours - static locations
  MAP_NEARBY_BEACHES: 12 * 60 * 60 * 1000, // 12 hours - static beach data
} as const;

// UI interaction timings
export const UI_TIMING = {
  AUTO_HIDE_DELAY: 3000, // Navigation auto-hide
  DEBOUNCE_DELAY: 300, // Search input debounce
  LOADING_SPINNER_DELAY: 200, // Delay before showing spinner
  TOAST_DURATION: 5000, // Toast notification duration
} as const;

// App defaults
export const APP_DEFAULTS = {
  DEFAULT_BEACH: "Huntington Beach",
  FORECAST_DAYS: 10,
  SESSION_LIMIT: 20,
  NEARBY_BEACH_RADIUS: 30, // miles
} as const;

// Form validation
export const VALIDATION = {
  MIN_RATING: 1,
  MAX_RATING: 5,
  MIN_TITLE_LENGTH: 3,
  MAX_TITLE_LENGTH: 100,
  MIN_CONTENT_LENGTH: 10,
  MAX_CONTENT_LENGTH: 1000,
} as const;

// API endpoints
export const API_ENDPOINTS = {
  FORECASTS_ENHANCED: "/api/forecasts/update-enhanced",
  FORECASTS_UPDATE: "/api/forecasts/update",
  BEACHES_NEARBY: "/api/beaches/nearby",
  BUOYS_CONDITIONS: "/api/buoys/conditions",
} as const;

// Error messages
export const ERROR_MESSAGES = {
  NETWORK_ERROR: "Network error. Please check your connection.",
  UNAUTHORIZED: "You must be signed in to perform this action.",
  NOT_FOUND: "The requested resource was not found.",
  GENERIC_ERROR: "Something went wrong. Please try again.",
  VALIDATION_ERROR: "Please check your input and try again.",
} as const;

// Success messages
export const SUCCESS_MESSAGES = {
  REVIEW_CREATED: "Review posted successfully!",
  REVIEW_UPDATED: "Review updated successfully!",
  REVIEW_DELETED: "Review deleted successfully!",
  SESSION_LOGGED: "Session logged successfully!",
  PROFILE_UPDATED: "Profile updated successfully!",
} as const;
