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
}
