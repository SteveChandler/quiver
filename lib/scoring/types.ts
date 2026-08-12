/**
 * Shared types for unified surf scoring module
 */

import type { EnhancedForecastEntity } from '@/types/forecast';
import type { SkillLevel } from '@/lib/domains/user-preferences/skill-level';
import type { BoardClass } from '@/lib/domains/rideability';
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
  slug?: string | null;
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

// `ConditionCharacter` + `ConditionCharacterCategory` are owned by the domain
// engine. Re-exported here so existing `@/lib/scoring` consumers keep working
// without each one needing to migrate import paths.
import type {
  ConditionCharacter,
  ConditionCharacterCategory,
} from '@/lib/domains/scoring/condition-character';
export type { ConditionCharacter, ConditionCharacterCategory };

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
  /** Score at peakTime; the render-facing decision score for this window */
  peakScore?: number;
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
  /** Viewer skill level for native-compatible condition scoring */
  skillLevel?: SkillLevel | string | null;
  /** IANA timezone used to exclude non-daylight forecast rows */
  beachTimezone?: string;
  /** Saved board classes used to score the best available board fit */
  boardClasses?: readonly BoardClass[];
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
  /** Confirmed South OC/San Onofre guardrail signal from stored forecast provenance. */
  southOcSanoGuardrail?: {
    branch: 'non_cluster_anchor_floor' | 'trestles_calibrated_anchor';
    confirmedPeriodS: number;
    confirmedDirectionDeg: number;
  };
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
  const southOcSanoGuardrail = readSouthOcSanoGuardrailForScoring(forecast);

  return {
    forecastTime,
    waveHeight: parseFloat(forecast.wave_height || '0'),
    wavePeriod: parseFloat(forecast.wave_period?.replace('s', '') || '0'),
    windSpeed: parseFloat(forecast.wind_speed || '0'),
    windDirection: parseWindDirection(forecast.wind_direction_deg, forecast.wind_direction),
    tideHeight: parseFloat(forecast.tide_height || '0') || 0,
    tideStatus: forecast.tide_status?.toLowerCase() || null,
    swellDirection,
    ...(southOcSanoGuardrail ? { southOcSanoGuardrail } : {}),
  };
}

function readSouthOcSanoGuardrailForScoring(
  forecast: EnhancedForecastEntity
): ForecastForScoring['southOcSanoGuardrail'] | undefined {
  const guardrail =
    forecast.raw_forecast?.wave_height_provenance?.south_oc_sano_guardrail;
  if (!guardrail) return undefined;

  const confirmedPeriodS = guardrail.confirmed_period_s;
  const confirmedDirectionDeg = guardrail.confirmed_direction_deg;
  if (!Number.isFinite(confirmedPeriodS) || !Number.isFinite(confirmedDirectionDeg)) {
    return undefined;
  }

  return {
    branch: guardrail.branch,
    confirmedPeriodS,
    confirmedDirectionDeg,
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
