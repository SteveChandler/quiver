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
