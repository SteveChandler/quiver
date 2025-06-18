// Cache TTL values in milliseconds
export const CACHE_TTL = {
  API_CALLS: 5 * 60 * 1000, // 5 minutes
  FORECASTS: 15 * 60 * 1000, // 15 minutes
  BEACH_DATA: 30 * 60 * 1000, // 30 minutes
  USER_SESSIONS: 2 * 60 * 1000, // 2 minutes (more dynamic)
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
