// Domain types for the enhanced forecast system
import type { WaveWatchData } from "@/lib/services/noaa-wavewatch/types";
// Branded types for better type safety

export type ConfidenceScore = number & { readonly __brand: "ConfidenceScore" };
export type BeachId = string & { readonly __brand: "BeachId" };
export type ForecastId = string & { readonly __brand: "ForecastId" };
export type Latitude = number & { readonly __brand: "Latitude" };
export type Longitude = number & { readonly __brand: "Longitude" };

// Helper functions to create branded types
export const createConfidenceScore = (score: number): ConfidenceScore => {
  if (score < 0 || score > 100) {
    throw new Error("Confidence score must be between 0 and 100");
  }
  return score as ConfidenceScore;
};

// Convenience converter: clamps any numeric input to a valid 0–100 ConfidenceScore
export const toConfidenceScore = (value: number): ConfidenceScore => {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  return createConfidenceScore(clamped);
};

export const createBeachId = (id: string): BeachId => {
  if (!id || id.trim().length === 0) {
    throw new Error("Beach ID cannot be empty");
  }
  return id as BeachId;
};

export const createLatitude = (lat: number): Latitude => {
  if (lat < -90 || lat > 90) {
    throw new Error("Latitude must be between -90 and 90");
  }
  return lat as Latitude;
};

export const createLongitude = (lng: number): Longitude => {
  if (lng < -180 || lng > 180) {
    throw new Error("Longitude must be between -180 and 180");
  }
  return lng as Longitude;
};

// Core domain interfaces
export interface Location {
  readonly latitude: Latitude;
  readonly longitude: Longitude;
}

export interface TimeRange {
  readonly start: Date;
  readonly end: Date;
}

// Weather conditions
export interface WeatherConditions {
  readonly airTemperature: string;
  readonly weatherCondition: string;
  readonly windSpeed: string;
  readonly windDirection: string;
}

// Wave conditions with detailed swell information
export interface WaveConditions {
  readonly waveHeight: string | null;
  readonly wavePeriod: string | null;
  readonly waveDirection: string | null;
  readonly primarySwell: SwellComponent | null;
  readonly secondarySwell: SwellComponent | null;
  readonly windWave: SwellComponent | null;
}

export interface SwellComponent {
  readonly height: string;
  readonly period: string;
  readonly direction: string;
}

// Tide conditions
export interface TideConditions {
  readonly status: TideStatus;
  readonly currentHeight: string;
  readonly nextTide: NextTideInfo;
}

export type TideStatus =
  | "Rising"
  | "Falling"
  | "High Slack"
  | "Low Slack"
  | "Unknown";

export interface NextTideInfo {
  readonly time: string;
  readonly type: "High" | "Low" | "Unknown";
  readonly height: string;
}

// Main forecast data structure
export interface ForecastTimePoint {
  readonly id: ForecastId;
  readonly beachId: BeachId;
  readonly timestamp: Date;
  readonly forecastAt: string;
  /** @deprecated Use forecastAt */
  readonly forecastDate: string;
  /** @deprecated Use forecastAt */
  readonly forecastTime: string;
  readonly weather: WeatherConditions;
  readonly waves: WaveConditions;
  readonly tides: TideConditions;
  readonly waterTemperature: string;
  readonly confidence: ConfidenceScore;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

// Database entity interface (for backward compatibility)
export interface EnhancedForecastEntity {
  id: string;
  beach_id: string;
  /** ISO 8601 UTC timestamptz — canonical forecast time (replaces forecast_date + forecast_time) */
  forecast_at: string;
  /** @deprecated Use forecast_at. Bare date without timezone — ambiguous. */
  forecast_date: string;
  /** @deprecated Use forecast_at. Bare time without timezone — ambiguous. */
  forecast_time: string;
  wave_height: string | null;
  wave_period?: string | null;
  wave_direction?: string | null;
  /**
   * Wind direction in degrees (0-360).
   *
   * Stored in `enhanced_forecasts.wind_direction_deg` and preferred for scoring/analytics.
   * Optional for backward compatibility with older cached rows.
   */
  wind_direction_deg?: number | null;
  swell_1_height?: string | null;
  swell_1_period?: string | null;
  swell_1_direction?: string | null;
  swell_2_height?: string | null;
  swell_2_period?: string | null;
  swell_2_direction?: string | null;
  wind_wave_height?: string | null;
  wind_wave_period?: string | null;
  wind_wave_direction?: string | null;

  // ------------------------------------------------------------------
  // Open-Meteo raw values (co-located from Open-Meteo Marine API).
  // These are the unmodified numeric quantities from Open-Meteo, stored
  // alongside the primary NOAA-merged TEXT fields above. Populated on
  // every slot where OM had data at fetch time (horizon ≤168h). NULL
  // outside OM horizon or when OM fetch failed. Consumed by the Seaside
  // ML service (to avoid its current live-fetch mid-correction).
  //
  // Corresponding DB columns added by
  // supabase/migrations/20260417*_add_om_columns_to_enhanced_forecasts.sql.
  // ------------------------------------------------------------------
  /** Raw Open-Meteo significant wave height (meters). */
  wave_height_om?: number | null;
  /** Raw Open-Meteo wave period (seconds). */
  wave_period_om?: number | null;
  /** Raw Open-Meteo wave direction (degrees, 0-360). */
  wave_direction_om?: number | null;
  /** Raw Open-Meteo swell wave height (meters). */
  swell_height_om?: number | null;
  /** Raw Open-Meteo swell wave period (seconds). */
  swell_period_om?: number | null;
  /** Raw Open-Meteo swell wave direction (degrees, 0-360). */
  swell_direction_om?: number | null;
  /** Raw Open-Meteo wind-wave height (meters). */
  wind_wave_height_om?: number | null;
  /** ISO 8601 timestamp when Open-Meteo values were fetched. */
  om_fetched_at?: string | null;

  water_temp: string | null;
  air_temperature?: string | null;
  wind_speed?: string | null;
  wind_direction?: string | null;
  tide_status?: string | null;
  tide_height?: string | null;
  next_tide_time?: string | null;
  next_tide_type?: string | null;
  next_tide_height?: string | null;
  /** UTC timestamp of next tide event (ISO 8601) for timezone-aware formatting */
  next_tide_at?: string | null;
  /** NOAA CO-OPS station ID used for tide data (e.g., "9410230" for La Jolla) */
  coops_station_id?: string | null;
  weather_condition?: string | null;
  // Some tests refer to this alias; keep optional
  weather_description?: string | null;
  confidence_score: number | null;
  data_source: "NOAA_NWS" | "CDIP" | "FALLBACK" | string;
  created_at: string;
  updated_at: string;
  // ML Bias Correction fields (populated when ML corrections are available)
  /** ML-corrected wave height in feet (if available) */
  ml_corrected_height?: string | null;
  /** Whether this forecast has ML bias correction applied */
  is_ml_calibrated?: boolean;
  /** ML model version used for correction (e.g., "xgboost_v1") */
  ml_model_version?: string | null;
  /**
   * **Beach-level** calibration flag: `true` when
   * `beaches.shoaling_factors IS NOT NULL` (the beach has been empirically
   * calibrated against face-height observations as a population). `false`
   * when the beach is ML-only / forecast-only.
   *
   * Does **not** guarantee that the specific reading on this response was
   * produced by the calibrated short-circuit in
   * `transformToFaceHeightWithMetadata` — edge cases like periods outside
   * the bucket table, CDIP fallbacks to model swell, or model-Hs paths can
   * produce a calibrated-flagged response whose actual number came from
   * the generic pipeline. This is an acceptable trade-off for the honesty
   * layer: the user-facing distinction is "this beach is dialed in (Face
   * height)" vs "this beach is forecast-only (Forecast height)" as a
   * population statement, not a per-reading claim. Per-reading state is
   * available via `transformToFaceHeightWithMetadata().isCalibrated` if a
   * future consumer needs it — do NOT try to thread per-reading state
   * through this envelope field, the semantic here is locked as
   * beach-level.
   *
   * Populated server-side by forecast API routes; never derived on the
   * client. Consumed by `WaveHeightDisplay` to drive the honesty-layer
   * render (Face height label vs Forecast height label + `~` prefix +
   * dotted underline).
   */
  isCalibrated?: boolean;

  // Optional raw forecast payload for transparency/debugging
  raw_forecast?: {
    wave_source_selection?: WaveWatchData["source_selection"];
    cdip_data?: any;
    noaa_data?: any;
    data_sources?: string[];
    quality_scores?: {
      cdip?: number;
      noaa?: number;
      overall?: number;
    };
    fetch_timestamps?: {
      cdip?: string;
      noaa?: string;
    };
    /** Tide schedule for dynamic client-side computation (first forecast of day only) */
    tide_schedule?: TideScheduleEntry[];
    /** NOAA CO-OPS station used for tide predictions */
    tide_station?: TideStationInfo;
    /** Per-row wave_height provenance (source, shoaling basis, transform path, etc.). */
    wave_height_provenance?: WaveHeightProvenance;
  } | null;
}

// Data source interfaces
export interface ForecastDataSource {
  readonly name: string;
  fetchData(location: Location, timeRange: TimeRange): Promise<any>;
  isAvailable(): boolean;
  getReliabilityScore(): ConfidenceScore;
}

export interface WaveDataSource extends ForecastDataSource {
  fetchWaveData(location: Location, days: number): Promise<WaveData>;
}

export interface TideDataSource extends ForecastDataSource {
  fetchTideData(location: Location, days: number): Promise<TideData>;
}

export interface WeatherDataSource extends ForecastDataSource {
  fetchWeatherData(location: Location, days: number): Promise<WeatherData>;
}

// Data source response types
export interface WaveData {
  readonly forecast: WavePoint[];
  readonly data_source: "NOAA_NWS" | "CDIP" | "OPEN_METEO" | "FALLBACK";
  readonly location: {
    readonly latitude: number;
    readonly longitude: number;
  };
}

export interface WavePoint {
  readonly timestamp: Date;
  readonly significantWaveHeight: number;
  readonly peakWavePeriod: number;
  readonly peakWaveDirection: number;
  readonly swell1Height: number;
  readonly swell1Period: number;
  readonly swell1Direction: number;
  readonly swell2Height: number;
  readonly swell2Period: number;
  readonly swell2Direction: number;
  readonly windWaveHeight: number;
  readonly windWavePeriod: number;
  readonly windWaveDirection: number;
  readonly data_source: "NOAA_NWS" | "CDIP" | "OPEN_METEO" | "FALLBACK";
}

export interface TideData {
  readonly tides: TidePoint[];
}

export interface TidePoint {
  readonly time: number;
  readonly height: number;
  readonly type: "H" | "L";
}

/** A tide extreme (high or low) from the tide schedule */
export interface TideScheduleEntry {
  /** Unix timestamp in seconds */
  time: number;
  /** Height in feet */
  height: number;
  /** Tide extreme type */
  type: "high" | "low";
}

/** NOAA CO-OPS station information for tide predictions */
export interface TideStationInfo {
  /** NOAA station ID (e.g., "9410230") */
  id: string;
  /** Human-readable station name (e.g., "La Jolla, CA") */
  name: string;
}

export interface WeatherData {
  readonly periods: WeatherPeriod[];
}

export interface WeatherPeriod {
  readonly startTime: string;
  readonly temperature: number;
  readonly windSpeed: string;
  readonly windDirection: string;
  readonly shortForecast: string;
}

// Forecast grouping types
export interface SwellDirectionGroup {
  readonly direction: string;
  readonly forecasts: ForecastTimePoint[];
  readonly representative: ForecastTimePoint;
  readonly timeRange: string;
  readonly count: number;
  readonly swellType: SwellType;
}

export type SwellType = "primary" | "secondary" | "mixed";

// Component prop types
export interface ForecastCardVariant {
  readonly variant: "compact" | "detailed";
  readonly showDate: boolean;
  readonly showBeachName: boolean;
}

// Constants
export const FORECAST_CONSTANTS = {
  DAYS: 12,
  INTERVAL_HOURS: 3,
  FORECASTS_PER_DAY: 8,
  MAX_CONFIDENCE: 100,
  MIN_CONFIDENCE: 0,
} as const;

export const TOTAL_FORECASTS =
  FORECAST_CONSTANTS.DAYS * FORECAST_CONSTANTS.FORECASTS_PER_DAY;

// Utility type for converting database entities to domain objects
export type ForecastMapper = {
  toDomain(entity: EnhancedForecastEntity): ForecastTimePoint;
  toEntity(domain: ForecastTimePoint): EnhancedForecastEntity;
};

export interface ForecastPreview {
  type: "enhanced" | "basic";
  wave_height: string;
  wind_speed: string;
  wind_direction: string;
  weather_condition: string;
  confidence_score?: number;
}

// CDIP Data Types
export interface CDIPDataPoint {
  timestamp: string;
  significantWaveHeight: number; // feet (converted from meters in cdip/data-parser)
  peakWavePeriod: number; // seconds
  peakWaveDirection: number; // degrees
  swellHeight?: number; // feet (derived from significantWaveHeight in cdip/data-parser)
  swellPeriod?: number; // seconds
  swellDirection?: number; // degrees
  windWaveHeight?: number; // feet (derived from significantWaveHeight in cdip/data-parser)
  windWavePeriod?: number; // seconds
  windWaveDirection?: number; // degrees
  /**
   * Primary swell partition from CDIP when exposed (height in meters — CDIP's
   * native unit; conversion happens at the forecast-builder layer). Null or
   * omitted when no primary partition is available for the observation.
   */
  primarySwell?: {
    heightM: number;
    periodS: number;
    directionDeg: number;
  } | null;
  /**
   * Secondary swell partition from CDIP when exposed (height in meters — CDIP's
   * native unit; conversion happens at the forecast-builder layer). Null or
   * omitted when no secondary partition is available for the observation.
   */
  secondarySwell?: {
    heightM: number;
    periodS: number;
    directionDeg: number;
  } | null;
}

export interface CDIPBuoyData {
  stationId: string;
  stationName: string;
  data: CDIPDataPoint[];
  dataSource: "CDIP";
  lastUpdated: string;
}

export interface CDIPMetaResponse {
  stnId: string;
  stnName: string;
  deployLatitude: number;
  deployLongitude: number;
  deployDepth: number;
  hullType: string;
  dataStart: string;
  dataEnd: string;
  parameters: string[];
}

export interface CDIPDataResponse {
  parameter: string;
  sensorId: string;
  units: string;
  dataGaps: any[];
  data: Array<[string, number, number, number]>; // [timestamp, waveHeight, period, direction]
  metadata?: {
    station_name: string;
    location: {
      latitude: number;
      longitude: number;
    };
    /**
     * Optional extra metadata fields used by our ERDDAP transformer.
     * Not all CDIP responses include these.
     */
    parameters?: string[];
    units?: Record<string, string>;
  };
}

export interface CDIPStationConfig {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  deployDepth: number;
  hullType: string;
  parameters: string[];
}

// Tide Chart Types - see components/forecast/tide-chart-recharts.tsx for TidePoint and TideChartProps

// Rate Limiter Types
export interface RateLimiterConfig {
  requestsPerMinute: number;
  requestsPerHour: number;
  burstLimit: number;
  /**
   * Optional custom burst window in milliseconds (default: 60s)
   */
  burstWindowMs?: number;
  /**
   * Optional number of warmup requests allowed before limits apply
   */
  warmupRequests?: number;
  /**
   * Optional warmup duration after initialization where rate limiting is disabled (ms)
   */
  warmupDurationMs?: number;
  /**
   * Optional rapid-streak detection threshold. When set, requests that arrive faster
   * than `rapidThresholdMs` and exceed `rapidStreakLimit` will trigger an immediate block.
   */
  rapidStreakLimit?: number;
  rapidThresholdMs?: number;
  rapidCooldownMs?: number;
  /**
    * Allow rapid recovery after a burst by trimming history when the burst
    * limit is exceeded (useful for marketing endpoints that still need to
    * demonstrate 429 behavior without long cooldowns).
    */
  softBurstRecovery?: boolean;
}

export interface RateLimitStatus {
  canMakeRequest: boolean;
  timeUntilReset: number;
  requestsRemaining: number;
}

/**
 * Provenance metadata recorded for the wave_height number on each forecast row.
 *
 * Surfaced by the forecast builder via `WaveHeightDebugInfo` and stored on
 * `raw_forecast.wave_height_provenance` so post-hoc questions like
 * "why does Quiver show 1.5 ft when CDIP 220 shows 3 ft?" are answerable
 * from one row instead of by re-running the pipeline.
 */
export interface WaveHeightProvenance {
  /** Which raw input drove the displayed face height. */
  source:
    | 'cdip_sig'
    | 'cdip_swell'
    | 'model_swell'
    | 'model_hs'
    | 'ndbc_buoy'
    | 'nowcast_anchor'
    | null;
  /**
   * Shoaling basis for the displayed number. `population_prior_v1` is a
   * measured population prior, not per-beach calibration.
   */
  provenance: 'generic' | 'measured' | 'population_prior_v1';
  /** Raw input height in feet, before transformation. */
  raw_value_ft: number | null;
  /** CDIP / NDBC / IOOS station that supplied the input (null for model). */
  station_id: string | null;
  /** Which transformer math path fired. */
  transform_path:
    | 'scalar_calibrated'
    | 'scalar_generic'
    | 'decomposed'
    | null;
  /** True when the per-component decomposed RMS sum was computed. */
  components_used: boolean;
  /** True when the per-beach `shoaling_factors` lookup actually fired. */
  calibrated_shoaling_fired: boolean;
  /** True when a low long-period CDIP bucket was skipped by quarantine rules. */
  calibration_bucket_quarantined?: boolean;
  /** Last CDIP face height minus first following model face height at the source handoff. */
  handoff_discontinuity_ft?: number;
  /** Optional default-off boundary blend applied to model rows after a CDIP handoff. */
  handoff_blend?: {
    cdip_forecast_at: string;
    model_forecast_at: string;
    cdip_face_ft: number;
    model_face_ft: number;
    handoff_discontinuity_ft: number;
    raw_ratio: number;
    clamped_ratio: number;
    taper_hours: number;
    hours_after_seam: number;
    taper_factor: number;
    original_face_ft: number;
    blended_face_ft: number;
  };
  /** Set when CDIP was rejected as an outlier and a fallback source was used. */
  cdip_rejection?: {
    reason: 'cdip_too_large' | 'cdip_outlier_vs_model';
    raw_cdip_hs: number;
    raw_model_hs: number | null;
  };
  /** Targeted South OC/San Onofre shadow-guardrail provenance when it fired. */
  south_oc_sano_guardrail?: {
    zone: 'south_oc_sano_shadow_zone';
    branch: 'non_cluster_anchor_floor' | 'trestles_calibrated_anchor';
    height_floor_applied: boolean;
    station_ids_used: string[];
    station_ages_minutes: Record<string, number>;
    confirmed_nearshore_hs_m: number;
    confirmed_nearshore_hs_ft: number;
    confirmed_period_s: number;
    confirmed_direction_deg: number;
    offshore_context_station_id: string | null;
    offshore_context_hs_m: number | null;
    offshore_context_age_minutes: number | null;
  };
}

// Enhanced Forecast with Raw Data
export interface EnhancedForecastWithRawData extends EnhancedForecastEntity {
  raw_forecast?: {
    wave_source_selection?: WaveWatchData["source_selection"];
    cdip_data?: CDIPBuoyData | null;
    noaa_data?: any;
    data_sources: string[];
    quality_scores?: {
      cdip?: number;
      noaa?: number;
      overall?: number;
    };
    fetch_timestamps?: {
      cdip?: string;
      noaa?: string;
    };
    /** Tide schedule for dynamic client-side computation (first forecast of day only) */
    tide_schedule?: TideScheduleEntry[];
    /** NOAA CO-OPS station used for tide predictions */
    tide_station?: TideStationInfo;
    /** Per-row wave_height provenance metadata (source, transform path, etc.). */
    wave_height_provenance?: WaveHeightProvenance;
  };
}
