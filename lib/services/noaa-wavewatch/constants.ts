import { METERS_TO_FEET } from "@/lib/utils/unit-conversions";
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
 * Geographic regions and their prevailing swell direction
 */
export const WAVE_REGIONS = {
  /** Pacific Coast (California) */
  PACIFIC_COAST: {
    longitudeRange: { min: -130, max: -115 },
    latitudeRange: { min: 30, max: 50 },
    prevailingDirection: 270, // West
  },
  /** Atlantic Coast */
  ATLANTIC_COAST: {
    longitudeRange: { min: -85, max: -70 },
    latitudeRange: { min: 25, max: 45 },
    prevailingDirection: 120, // Southeast
  },
  /** Gulf of Mexico */
  GULF_OF_MEXICO: {
    longitudeRange: { min: -100, max: -80 },
    latitudeRange: { min: 25, max: 35 },
    prevailingDirection: 225, // Southwest
  },
  /** Hawaii */
  HAWAII: {
    longitudeRange: { min: -161, max: -154 },
    latitudeRange: { min: 18, max: 23 },
    prevailingDirection: 340, // NNW (dominant winter swell)
  },
  /** Default ocean conditions */
  DEFAULT_OCEAN: {
    prevailingDirection: 225, // Southwest
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
  OPEN_METEO_MAX_DAYS: 12,
  /** Maximum forecast days for Open-Meteo API (hard API limit) */
  OPEN_METEO_API_LIMIT: 16,
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
  METERS_TO_FEET: METERS_TO_FEET,
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
