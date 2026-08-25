export interface AlertConditions {
  watched_call?: WatchedCallCondition;
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
  avoid_tide_statuses?: string[];
  local_time_start?: string;
  local_time_end?: string;
  days_of_week?: number[];
  board_id?: string;
  board_label?: string;
  max_frequency_per_week?: number;
  quiet_hours_start?: number;
  quiet_hours_end?: number;
  beginner_sandy_window?: boolean;
  beginner_window_confirmed?: boolean;
}

export interface WatchedCallCondition {
  version: 1;
  recommendationId: string;
  sourceSurface:
    | "home_hero"
    | "home_also_worth_it"
    | "explore_for_you"
    | "beach_detail"
    | "surf_window_adjacent";
  mode: "now" | "best" | "my-spots" | "beach-detail";
  beachId: string;
  windowStart: string;
  windowEnd: string;
  forecastAt: string | null;
  recommendationState: string;
  conditionScore: number;
  personalMatchScore: number;
  overallScore: number;
  reasonType: string;
  dedupeKey: string;
}

export type PresetType =
  | "glass_off"
  | "big_day"
  | "clean_groundswell"
  | "mellow_session"
  | "tide_window"
  | "dawn_patrol"
  | "epic_conditions"
  | "daily_check_in"
  | "weekend_warrior"
  | "after_work"
  | "watched_call";

export interface PresetDefinition {
  type: PresetType;
  name: string;
  description: string;
  conditionsSummary: string;
  group: "popular" | "specific" | "internal";
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
  break_type?: string | null;
  skill_level?: string | null;
  features?: string[] | null;
  preference_model?: unknown;
  max_wind_any_mph?: number | null;
  max_wind_onshore_mph?: number | null;
}

export interface ForecastHour {
  forecast_id?: string;
  forecast_at: string;
  wave_height: number | null;
  wave_period: number | null;
  /** Total-spectrum dominant wave direction as a cardinal string ("WSW"); see enhanced_forecasts schema. */
  wave_direction: string | null;
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
  beach_slug?: string | null;
  beach_skill_level?: string | null;
  beach_timezone: string;
  window_start: string;
  window_end: string;
  best_hour: string;
  /** The selected enhanced_forecasts row identity, when sourced from a live row. */
  forecast_id?: string;
  best_score: number;
  conditions_snapshot: Record<string, unknown>;
  notify_email: boolean;
  notify_push: boolean;
  /** HMAC token for the one-click disable-email link. Set during delivery. */
  disable_token?: string;
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
