/**
 * Morning Intel Types
 * Data structures for automated daily surf intel posts
 */

export interface SurfMetrics {
  min: number;
  max: number;
  dominant: string; // e.g., "waist-chest"
}

export interface TideMetrics {
  height: number; // feet
  direction: "rising" | "falling" | "slack";
  nextEvent: {
    type: "HIGH" | "LOW";
    height: number;
    time: string; // HH:mm format
  } | null;
}

export interface SwellComponent {
  height: number; // feet
  period: number; // seconds
  direction: number; // degrees
  cardinal: string; // e.g., "WSW"
}

export interface WindMetrics {
  speed: number; // mph
  direction: number; // degrees
  cardinal: string; // e.g., "ENE"
  offshore: boolean;
  description: string; // e.g., "offshore", "light onshore", "strong cross-shore"
}

export interface BeachPreferences {
  name: string;
  swellWindowMin?: number | null;
  swellWindowMax?: number | null;
  windOffshoreDeg?: number | null;
  windOffshoreTol?: number | null;
  tideMinFt?: number | null;
  tideMaxFt?: number | null;
  hazards?: string[] | null;
  skillLevel?: string | null;
  breakType?: string | null;
}

export interface ConditionEvaluation {
  status: "optimal" | "acceptable" | "poor";
  emoji: "✅" | "⚠️" | "❌";
  message: string;
}

export interface ConditionsAnalysis {
  score: number; // 0-10
  swell: ConditionEvaluation;
  wind: ConditionEvaluation;
  tide: ConditionEvaluation;
}

export interface MorningIntelData {
  spotName: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm (e.g., "06:00")
  surf: SurfMetrics;
  tide: TideMetrics;
  swells: {
    primary: SwellComponent | null;
    secondary: SwellComponent | null;
  };
  wind: WindMetrics;
  bestWindow: string;
  confidence: "Low" | "Medium" | "High";
  notes: string;
  beachPreferences?: BeachPreferences;
  conditions?: ConditionsAnalysis;
  payload: {
    generatedAt: string;
    dataCompleteness: number; // 0-1
    sources: {
      wave: boolean;
      tide: boolean;
      wind: boolean;
      swell: boolean;
    };
  };
}

export interface MorningIntelConfig {
  spotId: string;
  spotName: string;
  userEmail: string;
  userPassword: string;
  timezone: string;
  targetHour: number; // 6 for 6AM
  enabled: boolean;
}

export interface ForecastSlice {
  forecasts: Array<{
    forecast_date: string;
    forecast_time: string;
    wave_height?: number | null;
    wave_period?: number | null;
    wave_direction?: number | null;
    wind_speed?: number | null;
    wind_direction?: number | null;
    tide_height?: number | null;
    tide_status?: string | null;
    swell_height?: number | null;
    swell_period?: number | null;
    swell_direction?: number | null;
    secondary_swell_height?: number | null;
    secondary_swell_period?: number | null;
    secondary_swell_direction?: number | null;
    confidence_score?: number | null;
  }>;
  tides: Array<{
    ts: string;
    tide_height_m: number;
    tide_phase?: string | null;
  }>;
}
