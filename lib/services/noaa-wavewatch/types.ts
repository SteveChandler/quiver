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
 * Shared shape for NOAA NWS gridpoint time-series values.
 *
 * Every quantity in a `gridpoints` response (waveHeight, wavePeriod, etc.)
 * follows the same `{ uom, values: [{ validTime, value }] }` envelope. Extracted
 * so new partition fields (primary/secondary swell, wavePeriod2) can reuse it.
 */
export interface NOAAValueSeries {
  uom?: string;
  values: Array<{
    validTime: string;
    value: number | null;
  }>;
}

/**
 * NOAA NWS Grid Data API response structure
 */
export interface NOAAGridData {
  properties: {
    waveHeight?: NOAAValueSeries;
    wavePeriod?: NOAAValueSeries;
    waveDirection?: NOAAValueSeries;
    swellHeight?: NOAAValueSeries;
    swellPeriod?: NOAAValueSeries;
    swellDirection?: NOAAValueSeries;
    /** Primary swell partition height (meters). */
    primarySwellHeight?: NOAAValueSeries;
    /** Primary swell partition direction (degrees). */
    primarySwellDirection?: NOAAValueSeries;
    /** Secondary swell partition height (meters). */
    secondarySwellHeight?: NOAAValueSeries;
    /** Secondary swell partition direction (degrees). */
    secondarySwellDirection?: NOAAValueSeries;
    /** Secondary-partition wave period (seconds). */
    wavePeriod2?: NOAAValueSeries;
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
  wave_peak_period_om?: number | null;
  swell_height_om: number | null;
  swell_period_om: number | null;
  swell_direction_om: number | null;
  swell_wave_peak_period_om?: number | null;
  wind_wave_height_om: number | null;
  wind_wave_period_om?: number | null;
  wind_wave_direction_om?: number | null;
  wind_wave_peak_period_om?: number | null;
  secondary_swell_height_om?: number | null;
  secondary_swell_period_om?: number | null;
  secondary_swell_direction_om?: number | null;
  tertiary_swell_height_om?: number | null;
  tertiary_swell_period_om?: number | null;
  tertiary_swell_direction_om?: number | null;
  om_wind_wave_missing?: boolean | null;
  om_primary_swell_missing?: boolean | null;
  om_secondary_swell_missing?: boolean | null;
  om_tertiary_swell_missing?: boolean | null;
  om_partition_schema_version?: number | null;
}

/**
 * Wave forecast data point
 */
export interface WaveWatchData {
  /** Synthesized total/primary height, period, direction inputs; absent means unknown provenance. */
  inferred_input_count?: number;
  has_reported_wave_height?: boolean;
  period_basis?: "peak" | "mean" | "inferred";
  source_selection?: {
    reason: "reported_inputs" | "tie" | "only_source";
    disagreement: boolean;
    noaa_height_m: number | null;
    open_meteo_height_m: number | null;
    period_basis?: "peak" | "mean" | "inferred";
  };
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
  /**
   * Secondary swell height in meters.
   *
   * Holds a REAL secondary-partition value from NOAA (`secondarySwellHeight`)
   * or CDIP when available. No longer derived from `swell_1_height * magic`.
   * `0` when no real secondary partition exists for the slot — downstream
   * consumers must treat `swell_2_height === 0` (or `swell_2_period === 0`)
   * as "no second swell train," not as "small second swell." This is the
   * pipeline-level sentinel; persisted/DB-level values are nullable at the
   * `EnhancedForecastEntity` layer.
   */
  swell_2_height: number;
  /**
   * Secondary swell period in seconds.
   *
   * Real NOAA `wavePeriod2` or CDIP secondary-partition period. Not synthetic.
   * `0` when no real secondary partition exists for the slot (sentinel; see
   * `swell_2_height` note).
   */
  swell_2_period: number;
  /**
   * Secondary swell direction in degrees.
   *
   * Real NOAA `secondarySwellDirection` or CDIP secondary-partition direction.
   * Not synthetic. `0` when no real secondary partition exists (sentinel; see
   * `swell_2_height` note).
   */
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
 * and Open-Meteo, and any aggregate label hides that.
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
    time: Array<string | number>;
    wave_height?: Array<number | null>;
    wave_direction?: Array<number | null>;
    wave_period?: Array<number | null>;
    wave_peak_period?: Array<number | null>;
    swell_wave_height?: Array<number | null>;
    swell_wave_direction?: Array<number | null>;
    swell_wave_period?: Array<number | null>;
    swell_wave_peak_period?: Array<number | null>;
    wind_wave_height?: Array<number | null>;
    wind_wave_direction?: Array<number | null>;
    wind_wave_period?: Array<number | null>;
    wind_wave_peak_period?: Array<number | null>;
    secondary_swell_wave_height?: Array<number | null>;
    secondary_swell_wave_period?: Array<number | null>;
    secondary_swell_wave_direction?: Array<number | null>;
    tertiary_swell_wave_height?: Array<number | null>;
    tertiary_swell_wave_period?: Array<number | null>;
    tertiary_swell_wave_direction?: Array<number | null>;
  };
}
