export interface AlertConditions {
  swell_height_min?: number;
  swell_height_max?: number;
  swell_direction_min_deg?: number;
  swell_direction_max_deg?: number;
  swell_period_min?: number;
  wind_direction?: "offshore" | "onshore" | "cross-shore";
  wind_speed_max_kt?: number;
  tide_height_min_ft?: number;
  tide_height_max_ft?: number;
  tide_direction?: "rising" | "falling" | "high" | "low";
}

export type PresetType =
  | "glass_off"
  | "big_day"
  | "clean_groundswell"
  | "mellow_session"
  | "tide_window"
  | "dawn_patrol"
  | "epic_conditions";

export interface PresetDefinition {
  type: PresetType;
  name: string;
  description: string;
  conditionsSummary: string;
  group: "popular" | "specific";
  buildConditions: (beach: BeachAlertMeta) => AlertConditions;
}

export interface BeachAlertMeta {
  id: string;
  name: string;
  slug: string | null;
  lat: number;
  lon: number;
  timezone: string;
  wind_offshore_deg: number | null;
  wind_offshore_tol_deg: number | null;
  aspect_deg: number | null;
  preferred_tide_ft_min: number | null;
  preferred_tide_ft_max: number | null;
  preferred_tide_direction: string | null;
  swell_window_center_deg: number | null;
  swell_window_halfwidth_deg: number | null;
}

export interface ForecastHour {
  forecast_at: string;
  wave_height: number | null;
  wave_period: number | null;
  swell_1_height: number | null;
  swell_1_period: number | null;
  swell_1_direction: number | null;
  wind_speed: number | null;
  wind_direction_deg: number | null;
  tide_height: number | null;
  tide_status: string | null;
}

export interface MatchingWindow {
  rule_id: string;
  rule_name: string;
  beach_id: string;
  beach_name: string;
  beach_timezone: string;
  window_start: string;
  window_end: string;
  best_hour: string;
  best_score: number;
  conditions_snapshot: Record<string, unknown>;
  notify_email: boolean;
  notify_push: boolean;
}

export interface ConsolidatedAlertPayload {
  user_id: string;
  alert_date: string;
  send_at: string;
  matches: MatchingWindow[];
}

export interface AlertQueueRow {
  id: string;
  user_id: string;
  rule_id: string;
  beach_id: string;
  alert_date: string;
  send_at: string;
  window_start: string;
  window_end: string;
  best_hour: string;
  conditions_snapshot: Record<string, unknown>;
  sent: boolean;
}
