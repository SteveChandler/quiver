/**
 * Type definitions for NOAA WaveWatch III wave forecast data
 *
 * @module noaa-wavewatch/types
 */

/**
 * NOAA NWS Point API response structure
 */
export interface NOAAWavePoint {
  properties: {
    gridId: string;
    gridX: number;
    gridY: number;
    forecast: string;
    forecastHourly: string;
    forecastGridData: string;
  };
}

/**
 * NOAA NWS Grid Data API response structure
 */
export interface NOAAGridData {
  properties: {
    waveHeight?: {
      uom: string;
      values: Array<{
        validTime: string;
        value: number;
      }>;
    };
    wavePeriod?: {
      uom: string;
      values: Array<{
        validTime: string;
        value: number;
      }>;
    };
    waveDirection?: {
      uom: string;
      values: Array<{
        validTime: string;
        value: number;
      }>;
    };
    swellHeight?: {
      uom: string;
      values: Array<{
        validTime: string;
        value: number;
      }>;
    };
    swellPeriod?: {
      uom: string;
      values: Array<{
        validTime: string;
        value: number;
      }>;
    };
    swellDirection?: {
      uom: string;
      values: Array<{
        validTime: string;
        value: number;
      }>;
    };
  };
}

/**
 * Wave forecast data point
 */
export interface WaveWatchData {
  /** ISO 8601 timestamp */
  timestamp: string;
  /** Significant wave height in meters */
  significant_wave_height: number;
  /** Peak wave period in seconds */
  peak_wave_period: number;
  /** Peak wave direction in degrees */
  peak_wave_direction: number;
  /** Primary swell height in meters */
  swell_1_height: number;
  /** Primary swell period in seconds */
  swell_1_period: number;
  /** Primary swell direction in degrees */
  swell_1_direction: number;
  /** Secondary swell height in meters */
  swell_2_height: number;
  /** Secondary swell period in seconds */
  swell_2_period: number;
  /** Secondary swell direction in degrees */
  swell_2_direction: number;
  /** Wind wave height in meters */
  wind_wave_height: number;
  /** Wind wave period in seconds */
  wind_wave_period: number;
  /** Wind wave direction in degrees */
  wind_wave_direction: number;
  /** Data source indicator */
  data_source: "NOAA_NWS" | "FALLBACK";
}

/**
 * Wave forecast response containing multiple forecast points
 */
export interface WaveWatchForecast {
  /** Latitude of forecast location */
  lat: number;
  /** Longitude of forecast location */
  lng: number;
  /** Array of wave forecast data points */
  forecast: WaveWatchData[];
  /** Data source indicator */
  data_source: "NOAA_NWS" | "FALLBACK";
}

/**
 * Open-Meteo Marine API response structure
 */
export interface OpenMeteoMarineResponse {
  hourly?: {
    time: string[];
    wave_height?: number[];
    wave_direction?: number[];
    wave_period?: number[];
    swell_wave_height?: number[];
    swell_wave_direction?: number[];
    swell_wave_period?: number[];
    wind_wave_height?: number[];
    wind_wave_direction?: number[];
    wind_wave_period?: number[];
  };
}
