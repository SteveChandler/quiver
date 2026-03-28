/**
 * Shared types for unified surf scoring module
 */

import type { EnhancedForecastEntity } from '@/types/forecast';
import { resolveForecastTime } from '@/lib/utils/forecast-time-resolver';

/**
 * Beach with wind threshold configuration
 *
 * Note: This is a minimal interface for scoring that doesn't require
 * all fields from the full Beach type. This makes it easier to use
 * from different contexts (Morning Intel, Discovery Service, etc.)
 */
export interface BeachWithThresholds {
  id: string;
  name: string;
  lat?: number | null;
  lon?: number | null;
  is_private?: boolean;
  created_at?: string;
  // Wind configuration
  wind_offshore_deg?: number | null;
  wind_offshore_tol_deg?: number | null;
  // Tide preferences
  preferred_tide_ft_min?: number | null;
  preferred_tide_ft_max?: number | null;
  // Wind thresholds for skip conditions
  max_wind_onshore_mph?: number | null;
  max_wind_any_mph?: number | null;
  // Beach skill level for wave-height ceiling
  skill_level?: string | null;
  // Swell direction window (exist in DB, used for quality scoring)
  swell_window_center_deg?: number | null;
  swell_window_halfwidth_deg?: number | null;
  swell_window_min_deg?: number | null;
  swell_window_max_deg?: number | null;
}

/**
 * Subscores breakdown for condition scoring
 */
export interface ConditionSubscores {
  waveHeightFit: number;
  periodEnergy: number;
  windAlignment: number;
  tideFit: number;
}

/**
 * Condition character categories — used to classify the qualitative nature
 * of conditions beyond a simple numeric score.
 */
export type ConditionCharacterCategory =
  | 'flat'
  | 'small-weak'
  | 'small-quality'
  | 'small-clean'
  | 'medium-clean'
  | 'medium-mixed'
  | 'large-clean'
  | 'large-rough'
  | 'skip';

/**
 * Human-readable condition character with category and display label
 */
export interface ConditionCharacter {
  /** Short descriptive label, e.g. "Small but powerful — long-period energy" */
  label: string;
  category: ConditionCharacterCategory;
}

/**
 * Match quality levels
 */
export type MatchQuality = 'perfect' | 'excellent' | 'good' | 'fair' | 'minimal' | 'skip';

/**
 * Recommendation label for Morning Intel
 */
export type RecommendationLabel = 'Worth it' | 'Maybe' | 'Skip';

/**
 * Result of scoring surf conditions
 */
export interface ConditionScore {
  /** Total score 0-100 */
  total: number;
  /** Breakdown by factor */
  subscores: ConditionSubscores;
  /** Quality classification */
  matchQuality: MatchQuality;
  /** Morning Intel style label */
  recommendationLabel: RecommendationLabel;
  /** What's working well */
  reasons: string[];
  /** What to watch out for */
  warnings: string[];
  /** Natural language summary */
  message: string;
  /** Water quality warning if advisory or closure */
  waterQualityWarning?: string;
  /** Qualitative condition character (category + label) */
  character: ConditionCharacter;
  /** Points added by swell quality (period + direction) for small waves */
  swellQualityBoost: number;
}

/**
 * Reason for window boundary
 */
export interface WindowBoundaryReason {
  time: Date;
  factor: 'tide' | 'wind' | 'sunset' | 'score';
  description: string;
}

/**
 * Optimal surf window with context
 */
export interface OptimalWindow {
  start: Date;
  end: Date;
  startReason: WindowBoundaryReason;
  endReason: WindowBoundaryReason;
  /** Natural language description */
  message: string;
  /** Peak score time within window */
  peakTime?: Date;
  /** Average score across all forecasts within this window (0-100) */
  avgScore?: number;
  /** Qualitative character of conditions during this window */
  character?: ConditionCharacter;
}

/**
 * Result of multi-window calculation — multiple viable windows ranked by score
 */
export interface MultiWindowResult {
  /** Up to 3 windows (or maxWindows), ranked by average score descending */
  windows: OptimalWindow[];
  /** The highest-scored window, or null if no viable windows */
  bestWindow: OptimalWindow | null;
}

/**
 * Options for window calculation
 */
export interface WindowCalculatorOptions {
  /** Max hours ahead to consider */
  horizonHours?: number;
  /** Sunset time to cap window */
  sunsetTime?: Date;
  /** Minimum score to consider viable */
  minScoreThreshold?: number;
  /** Minimum session length in hours */
  minSessionHours?: number;
}

/**
 * Simplified forecast data for scoring
 */
export interface ForecastForScoring {
  forecastTime: Date;
  waveHeight: number;
  wavePeriod: number;
  windSpeed: number;
  windDirection: number | null;
  tideHeight: number;
  tideStatus: string | null;
  /** Primary swell direction in degrees (0-360) */
  swellDirection?: number | null;
}

/**
 * Relative context for today's conditions vs the rest of the week
 */
export interface RelativeContext {
  isBestOfWeek: boolean;
  trend: 'improving' | 'declining' | 'stable';
  /** Score difference from yesterday (positive = improving) */
  trendDelta: number;
  incomingSwell?: {
    /** ISO date string */
    date: string;
    description: string;
    estimatedScore: number;
  } | null;
}

/**
 * Convert EnhancedForecastEntity to ForecastForScoring.
 *
 * When `beachTz` is provided, uses the timezone-aware heuristic from
 * `resolveForecastTime` to correctly handle both proper-UTC and
 * legacy local-as-UTC `forecast_at` values. Without a timezone,
 * falls back to parsing `forecast_at` as UTC directly.
 */
export function toForecastForScoring(
  forecast: EnhancedForecastEntity,
  beachTz?: string
): ForecastForScoring {
  const forecastTime = resolveForecastTime(forecast, beachTz);

  // Parse primary swell direction from swell_1_direction (cardinal or degrees)
  const swellDirection = parseSwellDirection(forecast.swell_1_direction);

  return {
    forecastTime,
    waveHeight: parseFloat(forecast.wave_height || '0'),
    wavePeriod: parseFloat(forecast.wave_period?.replace('s', '') || '0'),
    windSpeed: parseFloat(forecast.wind_speed || '0'),
    windDirection: parseWindDirection(forecast.wind_direction_deg, forecast.wind_direction),
    tideHeight: parseFloat(forecast.tide_height || '0') || 0,
    tideStatus: forecast.tide_status?.toLowerCase() || null,
    swellDirection,
  };
}

/**
 * Parse swell direction from a string that may be cardinal ("SW") or degrees ("225")
 */
function parseSwellDirection(value: string | null | undefined): number | null {
  if (!value) return null;
  const trimmed = value.trim();
  const asNum = Number(trimmed);
  if (Number.isFinite(asNum)) {
    return ((asNum % 360) + 360) % 360;
  }
  const cardinalMap: Record<string, number> = {
    N: 0, NNE: 22.5, NE: 45, ENE: 67.5,
    E: 90, ESE: 112.5, SE: 135, SSE: 157.5,
    S: 180, SSW: 202.5, SW: 225, WSW: 247.5,
    W: 270, WNW: 292.5, NW: 315, NNW: 337.5,
  };
  return cardinalMap[trimmed.toUpperCase()] ?? null;
}

export interface UserScoringPreferences {
  preferredWaveSize?: 'small' | 'medium' | 'large' | null;
}

/**
 * Parse wind direction from degrees or cardinal string
 */
function parseWindDirection(
  deg: number | string | null | undefined,
  cardinal: string | null | undefined
): number | null {
  if (deg !== null && deg !== undefined) {
    const asNum = typeof deg === 'number' ? deg : Number(deg);
    if (Number.isFinite(asNum)) {
      return ((asNum % 360) + 360) % 360;
    }
  }

  if (!cardinal) return null;
  const trimmed = cardinal.trim().toUpperCase();

  const cardinalMap: Record<string, number> = {
    N: 0, NNE: 22.5, NE: 45, ENE: 67.5,
    E: 90, ESE: 112.5, SE: 135, SSE: 157.5,
    S: 180, SSW: 202.5, SW: 225, WSW: 247.5,
    W: 270, WNW: 292.5, NW: 315, NNW: 337.5,
  };

  return cardinalMap[trimmed] ?? null;
}
