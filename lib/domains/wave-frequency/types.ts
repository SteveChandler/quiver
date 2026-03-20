import type { EnhancedForecastEntity } from "@/types/forecast";
import type { Beach } from "@/types/database";

export type BreakType = "beach" | "point" | "reef" | "river" | "other";

export interface WaveFrequencyResult {
  rideableWavesPerHour: number;
  confidence: "high" | "medium" | "low";
  /** Number of swell trains that contributed to grouping analysis (1-3) */
  swellTrains: number;
  /** Dominant set interval in seconds (null if single swell / no grouping) */
  dominantBeatIntervalS: number | null;
}

export interface BreakTypeConfig {
  factor: number;
  thresholdFt: number;
}
