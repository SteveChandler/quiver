/** Shared shape for surf-conditions data used by in-app ticker and embed widgets. */
export interface ConditionsData {
  waveHeight?: string | null;
  wavePeriod?: string | null;
  waveDirection?: string | null;
  windSpeed?: string | null;
  windDirection?: string | null;
  waterTemp?: string | null;
  tideStatus?: string | null;
  tideHeight?: string | null;
  rideableWavesPerHour?: number | null;
  /** Number of swell trains contributing to grouping (1-3) */
  swellTrains?: number;
  /** Dominant set interval in seconds (null if single swell) */
  dominantBeatIntervalS?: number | null;
}
