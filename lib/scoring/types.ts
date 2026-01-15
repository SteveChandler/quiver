/**
 * Shared types for unified surf scoring module
 */

import type { EnhancedForecastEntity } from '@/types/forecast';

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
 * Match quality levels
 */
export type MatchQuality = 'perfect' | 'excellent' | 'good' | 'fair' | 'skip';

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
}

/**
 * Convert EnhancedForecastEntity to ForecastForScoring
 */
export function toForecastForScoring(
  forecast: EnhancedForecastEntity
): ForecastForScoring {
  return {
    forecastTime: new Date(`${forecast.forecast_date}T${forecast.forecast_time}Z`),
    waveHeight: parseFloat(forecast.wave_height || '0'),
    wavePeriod: parseFloat(forecast.wave_period?.replace('s', '') || '0'),
    windSpeed: parseFloat(forecast.wind_speed || '0'),
    windDirection: parseWindDirection(forecast.wind_direction_deg, forecast.wind_direction),
    tideHeight: parseFloat(forecast.tide_height || '0'),
    tideStatus: forecast.tide_status?.toLowerCase() || null,
  };
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
