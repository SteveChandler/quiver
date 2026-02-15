/**
 * Magic Hour Service Type Definitions
 *
 * Type definitions for the Magic Hour Finder service that identifies
 * optimal surf windows based on multi-metric weighted scoring.
 *
 * @module magic-hour/types
 */

/**
 * Forecast slot representing a single 3-hour forecast block.
 * Extracted from EnhancedForecastEntity for interpolation.
 */
export interface ForecastSlot {
  forecast_at?: string;
  forecast_date: string;
  forecast_time: string;
  local_time: Date;
  tide_height_ft: number;
  wind_speed_mph: number;
  wind_direction_deg: number;
  wave_height_ft: number;
  wave_period_s: number;
  wave_direction_deg: number;
}

/**
 * Beach metadata with surf condition preferences.
 * Subset of beach table columns used for optimal window calculation.
 */
export interface BeachMetadata {
  id: string;
  name: string;
  slug: string;
  skill_level: string | null;
  swell_window_center_deg: number | null;
  swell_window_halfwidth_deg: number | null;
  wind_offshore_deg: number | null;
  wind_offshore_tol_deg: number | null;
  preferred_tide_ft_min: number | null;
  preferred_tide_ft_max: number | null;
  /** IANA timezone identifier for the beach location */
  timezone?: string;
}

/**
 * Enhanced forecast entity from database.
 * Matches EnhancedForecastEntity interface from types/forecast.ts
 */
export interface EnhancedForecastEntity {
  id: string;
  beach_id: string;
  forecast_at: string;
  forecast_date: string;
  forecast_time: string;
  wave_height: string | null;
  wave_period?: string | null;
  wave_direction?: string | null;
  wind_direction_deg?: number | null;
  wind_speed?: string | null;
  tide_height?: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Result of Magic Hour calculation.
 *
 * **IMPORTANT: Confidence Type Clarification**
 *
 * The `confidence` field here represents **condition match quality**,
 * NOT forecast data quality. This is fundamentally different from the
 * confidence scores in `calculateConfidenceScore()` from the ML pipeline.
 *
 * Condition match confidence (0-1 scale):
 * - Swell in optimal window: +0.3
 * - Wind quality: +0.4 (perfect) or +0.2 (acceptable)
 * - Tide in preferred range: +0.3
 *
 * This confidence measures: "How well do the CONDITIONS at this time
 * match the BEACH'S OPTIMAL PREFERENCES?"
 *
 * It does NOT measure: "How reliable is the underlying forecast data?"
 * (That's handled by `calculateConfidenceScore()` in confidence-scorer.ts)
 */
export interface MagicHourResult {
  found: boolean;
  peakTime: Date | null;
  windowStart: string | null; // "8:30 AM"
  windowEnd: string | null; // "9:30 AM"
  /**
   * Condition match confidence (0-1 scale).
   * Measures how well conditions match beach preferences, NOT forecast data quality.
   * See MagicHourResult JSDoc for breakdown.
   */
  confidence: number; // 0-1
  swellMatch: boolean;
  windQuality: "perfect" | "acceptable" | "cross" | "onshore" | null;
  tideInRange: boolean;
}

/**
 * Optimal window found between two forecast slots.
 */
export interface OptimalWindow {
  peakTime: Date;
  windowStart: string;
  windowEnd: string;
  confidence: number;
  swellMatch: boolean;
  windQuality: "perfect" | "acceptable" | "cross" | "onshore";
  tideInRange: boolean;
}

/**
 * Weight configuration for multi-metric scoring.
 */
export interface WeightConfig {
  tide: number; // default 0.4
  wind: number; // default 0.35
  swell: number; // default 0.25
}

/**
 * Wind quality assessment result.
 */
export interface WindQualityResult {
  isOffshore: boolean;
  quality: "perfect" | "acceptable" | "cross" | "onshore";
}
