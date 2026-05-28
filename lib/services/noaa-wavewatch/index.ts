/**
 * NOAA WaveWatch III Wave Forecast Service
 *
 * Provides wave forecast data from NOAA's WaveWatch III model via the
 * National Weather Service API, with fallback to Open-Meteo Marine API
 * and synthetic data generation.
 *
 * @module noaa-wavewatch
 */

// Re-export the main service class
export { NOAAWaveWatchService } from "./noaa-wavewatch-service";

// Re-export types for consumers
export type {
  WaveWatchData,
  WaveWatchForecast,
  NOAAWavePoint,
  NOAAGridData,
  OpenMeteoMarineResponse,
} from "./types";

// Re-export constants for advanced usage
export {
  API_ENDPOINTS,
  WAVE_REGIONS,
  SEASONAL_FACTORS,
  FORECAST_CONFIG,
  COMPASS_DIRECTIONS,
  UNIT_CONVERSIONS,
  HTTP_CONFIG,
} from "./constants";

// Re-export utilities for testing and advanced usage
export {
  metersToFeet,
  feetToMeters,
  getWaveDirectionText,
  getBaseWaveHeight,
  getSeasonalFactor,
  getPrevailingWaveDirection,
  hasValidWaveData,
  getValueAtIndex,
  getValueAtTime,
  getTimestampForIndex,
  getTimestampForForecastSlot,
  parseNOAAValidTime,
} from "./wave-analysis";

export { generateFallbackData } from "./fallback-generator";
export { processNOAAGridData, processOpenMeteoData } from "./data-processors";
