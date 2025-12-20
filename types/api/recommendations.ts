import type { Beach, Database } from "@/types/database";

// ===================================================
// RPC + DB SHAPES
// ===================================================

/**
 * Typed return row from the `get_nearby_beaches` RPC.
 * Prefer using this over hand-rolled interfaces to stay in sync with DB changes.
 */
export type NearbyBeach =
  Database["public"]["Functions"]["get_nearby_beaches"]["Returns"][number];

export type MarineForecastPoint = Pick<
  Database["public"]["Tables"]["marine_forecasts"]["Row"],
  | "beach_id"
  | "ts"
  | "created_at"
  | "source"
  | "wave_height_m"
  | "wave_period_s"
  | "wave_direction_deg"
  | "wind_speed_ms"
  | "wind_direction_deg"
>;

export type TideForecastPoint = Pick<
  Database["public"]["Tables"]["tide_forecasts"]["Row"],
  | "beach_id"
  | "ts"
  | "created_at"
  | "source"
  | "tide_height_m"
  | "tide_phase"
>;

/**
 * The route scores using the full Beach row (scorer expects Beach).
 * We additionally attach optional distance fields.
 */
export type BeachWithDistance = Beach & {
  distance_meters?: number;
  distance_km?: number | null;
};

// ===================================================
// RESPONSE CONTRACT
// ===================================================

export interface WaveConditions {
  ht_ft: number | null;
  period_s: number | null;
}

export interface WindConditions {
  dir_deg: number | null;
  kts: number | null;
}

export interface TideConditions {
  height_ft: number | null;
  status: string | null;
}

export interface Recommendation {
  spotId: string;
  name: string;
  distance_km: number | null;
  score: number;
  reasons: string[];
  wave: WaveConditions;
  wind: WindConditions;
  tide: TideConditions;
  best_time_window: string | null;
}

export type DataFreshness = "current" | "stale" | "outdated" | "missing";
export type ConfidenceLevel = "high" | "medium" | "low";

export interface QualityIndicators {
  data_freshness: DataFreshness;
  forecast_age_hours: number | null;
  confidence_level: ConfidenceLevel;
}

export interface TopPickSnapshot {
  timestamp: string;
  conditions: {
    wave: WaveConditions;
    wind: WindConditions;
    tide: TideConditions;
  };
  quality_indicators: QualityIndicators;
}

export interface TopPick extends Recommendation {
  rank: number;
  isTopPick: true;
  snapshot: TopPickSnapshot;
}

export interface DegradationInfo {
  postgis_unavailable?: boolean;
  fallback_to_simple_query?: boolean;
  missing_forecasts?: {
    marine: number;
    tide: number;
  };
  forecast_query_errors?: {
    marine?: string;
    tide?: string;
  };
}

export interface RequestMetadata {
  query_time: string;
  location: {
    lat: number;
    lon: number;
  };
  total_spots_analyzed: number;
  user_skill: string | null;
  degradation?: DegradationInfo;
}

export interface RecommendationsResponse {
  recommendations: Recommendation[];
  top_picks: TopPick[];
  metadata: RequestMetadata;
}



