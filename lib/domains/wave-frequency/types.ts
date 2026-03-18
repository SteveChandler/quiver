import type { EnhancedForecastEntity } from "@/types/forecast";
import type { Beach } from "@/types/database";

export type BreakType = "beach" | "point" | "reef" | "river" | "other";

export interface WaveFrequencyResult {
  rideableWavesPerHour: number;
  confidence: "high" | "medium" | "low";
}

export interface BreakTypeConfig {
  factor: number;
  thresholdFt: number;
}
