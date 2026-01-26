/**
 * Constants and configuration for NOAA WaveWatch III service
 *
 * @module noaa-wavewatch/constants
 */

/**
 * NOAA National Weather Service API endpoints
 */
export const API_ENDPOINTS = {
  /** Base URL for NWS point forecast API */
  NWS_POINT_FORECAST_BASE: "https://api.weather.gov/gridpoints",
  /** Base URL for NWS points API */
  NWS_POINTS_BASE: "https://api.weather.gov/points",
  /** Base URL for NDFD XML forecast API (deprecated, not currently used) */
  NDFD_FORECAST_BASE:
    "https://graphical.weather.gov/xml/sample_products/browser_interface/ndfdXMLclient.php",
  /** Base URL for Open-Meteo Marine API (fallback source) */
  OPEN_METEO_MARINE_BASE: "https://marine-api.open-meteo.com/v1/marine",
} as const;

/**
 * Geographic regions and their baseline wave characteristics
 */
export const WAVE_REGIONS = {
  /** Pacific Coast (California) */
  PACIFIC_COAST: {
    longitudeRange: { min: -130, max: -115 },
    latitudeRange: { min: 30, max: 50 },
    baseWaveHeight: 0.7, // meters (~2.3ft typical San Diego conditions)
    prevailingDirection: 270, // West
  },
  /** Atlantic Coast */
  ATLANTIC_COAST: {
    longitudeRange: { min: -85, max: -70 },
    latitudeRange: { min: 25, max: 45 },
    baseWaveHeight: 0.8, // meters
    prevailingDirection: 120, // Southeast
  },
  /** Gulf of Mexico */
  GULF_OF_MEXICO: {
    longitudeRange: { min: -100, max: -80 },
    latitudeRange: { min: 25, max: 35 },
    baseWaveHeight: 0.6, // meters
    prevailingDirection: 225, // Southwest
  },
  /** Default ocean conditions */
  DEFAULT_OCEAN: {
    baseWaveHeight: 0.8, // meters
    prevailingDirection: 225, // Southwest
  },
} as const;

/**
 * Seasonal factors for wave height variations
 */
export const SEASONAL_FACTORS = {
  /** Northern hemisphere winter months (higher waves) */
  NORTHERN_WINTER: {
    months: [11, 0, 1], // Dec, Jan, Feb
    factor: 1.3,
  },
  /** Northern hemisphere summer months (smaller waves) */
  NORTHERN_SUMMER: {
    months: [5, 6, 7], // Jun, Jul, Aug
    factor: 0.8,
  },
  /** Southern hemisphere winter months (smaller waves) */
  SOUTHERN_WINTER: {
    months: [11, 0, 1],
    factor: 0.8,
  },
  /** Southern hemisphere summer months (higher waves) */
  SOUTHERN_SUMMER: {
    months: [5, 6, 7],
    factor: 1.3,
  },
  /** Spring/Fall default */
  DEFAULT: {
    factor: 1.0,
  },
} as const;

/**
 * Forecast configuration
 */
export const FORECAST_CONFIG = {
  /** Number of forecasts per day (every 3 hours) */
  FORECASTS_PER_DAY: 8,
  /** Interval between forecasts in hours */
  FORECAST_INTERVAL_HOURS: 3,
  /** Maximum forecast days for Open-Meteo API */
  OPEN_METEO_MAX_DAYS: 7,
  /** Minimum wave period for Pacific swells (seconds) */
  MIN_PACIFIC_SWELL_PERIOD: 10,
  /** Minimum wind wave period (seconds) */
  MIN_WIND_WAVE_PERIOD: 3,
  /** Minimum significant wave height (meters) */
  MIN_WAVE_HEIGHT: 0.3,
} as const;

/**
 * Compass directions for wave direction display
 */
export const COMPASS_DIRECTIONS = [
  "N",
  "NNE",
  "NE",
  "ENE",
  "E",
  "ESE",
  "SE",
  "SSE",
  "S",
  "SSW",
  "SW",
  "WSW",
  "W",
  "WNW",
  "NW",
  "NNW",
] as const;

/**
 * Unit conversion constants
 */
export const UNIT_CONVERSIONS = {
  /** Feet to meters conversion factor */
  FEET_TO_METERS: 0.3048,
  /** Meters to feet conversion factor */
  METERS_TO_FEET: 3.28084,
} as const;

/**
 * HTTP request configuration
 */
export const HTTP_CONFIG = {
  /** User agent for API requests */
  USER_AGENT: "quiver-surf-app/1.0 (contact@quiver-surf.com)",
  /** Default request headers */
  DEFAULT_HEADERS: {
    Accept: "application/json",
  },
} as const;
