// Domain types for the enhanced forecast system
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
  readonly forecastDate: string;
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
  forecast_date: string;
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

  // Optional raw forecast payload for transparency/debugging
  raw_forecast?: {
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
  significantWaveHeight: number; // meters
  peakWavePeriod: number; // seconds
  peakWaveDirection: number; // degrees
  swellHeight?: number; // meters
  swellPeriod?: number; // seconds
  swellDirection?: number; // degrees
  windWaveHeight?: number; // meters
  windWavePeriod?: number; // seconds
  windWaveDirection?: number; // degrees
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

// Enhanced Forecast with Raw Data
export interface EnhancedForecastWithRawData extends EnhancedForecastEntity {
  raw_forecast?: {
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
  };
}
