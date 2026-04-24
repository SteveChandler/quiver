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
 * Raw Open-Meteo wave values for a forecast slot.
 *
 * Stored alongside the primary merged values so `enhanced_forecasts` can
 * co-locate NOAA + OM data on a single row. Values are the unmodified
 * numeric quantities returned by Open-Meteo (meters / seconds / degrees)
 * — never synthesized defaults.
 */
export interface OpenMeteoSlotValues {
  wave_height_om: number | null;
  wave_period_om: number | null;
  wave_direction_om: number | null;
  swell_height_om: number | null;
  swell_period_om: number | null;
  swell_direction_om: number | null;
  wind_wave_height_om: number | null;
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
  data_source: "NOAA_NWS" | "OPEN_METEO" | "FALLBACK";
  /**
   * Raw Open-Meteo values for this slot when OM data was available
   * at fetch time (horizon ≤168h). Carried through regardless of which
   * source wins the merge so `enhanced_forecasts` can co-locate NOAA +
   * OM values on the same row.
   */
  om_values?: OpenMeteoSlotValues;
}

/**
 * Wave forecast response containing multiple forecast points.
 *
 * Source attribution lives per-slot on `forecast[].data_source`. The wrapper
 * intentionally has no `data_source` field — a merged response can mix NOAA
 * (days 1-3) and Open-Meteo (days 4-12), and any aggregate label hides that.
 */
export interface WaveWatchForecast {
  /** Latitude of forecast location */
  lat: number;
  /** Longitude of forecast location */
  lng: number;
  /** Array of wave forecast data points */
  forecast: WaveWatchData[];
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
