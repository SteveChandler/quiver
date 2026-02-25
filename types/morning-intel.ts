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
  // Optional debug/enrichment fields (may be absent in older DB schemas/queries)
  aspectDeg?: number | null;
  windOffshoreDegSource?: "db" | "computed_from_aspect" | "db_overridden_with_aspect";
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

export type MorningIntelRecommendationDecision = "worth_it" | "maybe" | "skip";

export interface MorningIntelRecommendationSummary {
  decision: MorningIntelRecommendationDecision;
  label: string; // Human label for UI (e.g., "Worth it", "Maybe", "Skip")
  reasons: string[]; // Short reasons for the call
}

/**
 * Persisted payload for automated daily intel posts (stored in intel_posts.surf_conditions).
 *
 * Keep this backward-compatible: older posts may have a different/partial shape.
 */
export interface MorningIntelSurfConditionsPayloadV2 {
  kind: "morning_intel_v2";
  generatedAt: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm

  recommendation: MorningIntelRecommendationSummary;
  conditions?: ConditionsAnalysis;

  bestWindow: string;
  confidence: "Low" | "Medium" | "High";

  surf: SurfMetrics;
  tide: TideMetrics & { recommendedTime?: string; optimalRange?: string | null };
  wind: WindMetrics;
  swells: {
    primary: SwellComponent | null;
    secondary: SwellComponent | null;
  };

  dataCompleteness: number; // 0-1
  sources: {
    wave: boolean;
    tide: boolean;
    wind: boolean;
    swell: boolean;
  };

  beach?: {
    name?: string;
    skillLevel?: string | null;
    hazards?: string[] | null;
    breakType?: string | null;
    // Debugging/validation helpers for recommendation correctness
    aspectDeg?: number | null;
    windOffshoreDegUsed?: number | null;
    windOffshoreDegSource?: "db" | "computed_from_aspect" | "db_overridden_with_aspect";
  };
  /** Water quality status at generation time — absent on older posts */
  waterQuality?: {
    status: "good" | "advisory" | "closure" | "unknown";
    latestSampleDate: string | null;
  };
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
    kind: "morning_intel_v2";
    generatedAt: string;
    date: string;
    time: string;
    recommendation: MorningIntelRecommendationSummary;
    conditions?: ConditionsAnalysis;
    bestWindow: string;
    confidence: "Low" | "Medium" | "High";
    surf: SurfMetrics;
    tide: TideMetrics & { recommendedTime?: string; optimalRange?: string | null };
    wind: WindMetrics;
    swells: {
      primary: SwellComponent | null;
      secondary: SwellComponent | null;
    };
    dataCompleteness: number; // 0-1
    sources: {
      wave: boolean;
      tide: boolean;
      wind: boolean;
      swell: boolean;
    };
    beach?: MorningIntelSurfConditionsPayloadV2["beach"];
    waterQuality?: MorningIntelSurfConditionsPayloadV2["waterQuality"];
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
    /**
     * ISO 8601 UTC timestamptz — canonical forecast time.
     * Optional during migration transition (some external/cached sources may lack it).
     * Will become required after Phase 8 (legacy column drop).
     */
    forecast_at?: string;
    /** @deprecated Use forecast_at */
    forecast_date: string;
    /** @deprecated Use forecast_at */
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
