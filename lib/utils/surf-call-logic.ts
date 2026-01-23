/**
 * Surf Call Logic
 *
 * Pure, testable function for computing a surf "call" (YES/MAYBE/NO)
 * from forecast window data. Used by the spot surf report server action.
 *
 * @module lib/utils/surf-call-logic
 */

import type { Beach } from '@/types/database';
import type { PersonalizedForecastWindow } from '@/types/personalization';
import type { EnhancedForecastEntity } from '@/types/forecast';

// ============================================================================
// Types
// ============================================================================

export type SurfCallVerdict = 'YES' | 'MAYBE' | 'NO';

export interface SurfCallResult {
  verdict: SurfCallVerdict;
  bestWindowStart: string | null;
  bestWindowEnd: string | null;
  windowMinutes: number | null;
  waveHeight: string | null;
  windDescription: string | null;
  tideDescription: string | null;
  whySentence: string;
  forecastConfidence: number;
  lowForecastConfidence: boolean;
  score: number;
  updatedAt: string;
}

// ============================================================================
// Constants
// ============================================================================

// Wave height minimums by break type (in feet)
const BREAK_TYPE_MINIMUMS: Record<string, number> = {
  'beach break': 1.5,
  'reef break': 2.0,
  'point break': 2.0,
  'river mouth': 1.5,
  default: 1.5,
};

// Wind speed thresholds (in mph)
const WIND_SPEED_GLASSY = 5;
const WIND_SPEED_LIGHT_MAX = 10;
const WIND_SPEED_MODERATE_MAX = 18;

// Wind direction classification (in degrees)
const WIND_DIRECTION_OFFSHORE_MAX = 45;
const WIND_DIRECTION_CROSSSHORE_MIN = 135;

// Window duration thresholds (in minutes)
const MINIMUM_VIABLE_WINDOW_MINUTES = 30;
const SHORT_WINDOW_THRESHOLD_MINUTES = 45;

// Score thresholds (0-100 scale)
const SCORE_YES_THRESHOLD = 70;
const SCORE_MAYBE_THRESHOLD = 40;

// Confidence thresholds
const LOW_CONFIDENCE_THRESHOLD = 20;
const LOW_CONFIDENCE_DISPLAY_THRESHOLD = 35;
const CONFIDENCE_THRESHOLD_MARGIN = 5;

// ============================================================================
// Type Guards and Accessors
// ============================================================================

interface BeachWithBreakType {
  break_type?: string | null;
}

interface BeachWithWindData {
  wind_offshore_deg?: number | null;
}

interface ForecastWithWindData {
  wind_direction_deg?: number | null;
}

interface ForecastWithTideData {
  tide_status?: string | null;
}

// ============================================================================
// Helpers
// ============================================================================

function getMinRideable(beach: Beach): number {
  const beachWithType = beach as Beach & BeachWithBreakType;
  const breakType = (beachWithType.break_type || 'default').toLowerCase();
  return BREAK_TYPE_MINIMUMS[breakType] ?? BREAK_TYPE_MINIMUMS.default;
}

/**
 * Parse wave height string to max numeric value in feet.
 * Handles formats like "2-3 ft", "3.5", "4-6", "Unknown"
 */
function parseMaxWaveHeight(waveHeight: string | null): number | null {
  if (!waveHeight || waveHeight === 'Unknown') return null;
  const numbers = waveHeight.match(/[\d.]+/g);
  if (!numbers || numbers.length === 0) return null;
  return Math.max(...numbers.map(Number));
}

/**
 * Determine wind quality relative to beach's offshore direction.
 */
function getWindDescription(
  forecast: EnhancedForecastEntity | null,
  beach: Beach
): string {
  if (!forecast) return 'Unknown';

  const windSpeedStr = forecast.wind_speed;
  const forecastWithWind = forecast as EnhancedForecastEntity & ForecastWithWindData;
  const windDirDeg = forecastWithWind.wind_direction_deg;
  const speed = windSpeedStr ? parseFloat(windSpeedStr) : null;

  if (speed == null || isNaN(speed)) return 'Unknown';
  if (speed < WIND_SPEED_GLASSY) return 'glassy';

  const speedLabel =
    speed < WIND_SPEED_LIGHT_MAX
      ? 'light'
      : speed < WIND_SPEED_MODERATE_MAX
        ? 'moderate'
        : 'strong';

  const beachWithWind = beach as Beach & BeachWithWindData;
  const offshoreDeg = beachWithWind.wind_offshore_deg;

  if (offshoreDeg == null || windDirDeg == null) {
    return `${speedLabel} wind`;
  }

  // Compute angular difference (normalized 0-180)
  let angleDiff = Math.abs(windDirDeg - offshoreDeg) % 360;
  if (angleDiff > 180) angleDiff = 360 - angleDiff;

  const directionLabel =
    angleDiff <= WIND_DIRECTION_OFFSHORE_MAX
      ? 'offshore'
      : angleDiff >= WIND_DIRECTION_CROSSSHORE_MIN
        ? 'onshore'
        : 'cross-shore';

  return `${speedLabel} ${directionLabel}`;
}

/**
 * Format tide description from forecast data.
 */
function getTideDescription(forecast: EnhancedForecastEntity | null): string {
  if (!forecast) return 'Unknown';

  const forecastWithTide = forecast as EnhancedForecastEntity & ForecastWithTideData;
  const status = forecastWithTide.tide_status;

  if (!status) return 'Unknown';

  // Normalize status
  const lower = status.toLowerCase();
  if (lower.includes('rising')) return 'rising';
  if (lower.includes('falling')) return 'falling';
  if (lower.includes('high')) return 'high slack';
  if (lower.includes('low')) return 'low slack';
  return status;
}

/**
 * Build why sentence based on conditions.
 */
function buildWhySentence(
  verdict: SurfCallVerdict,
  windDesc: string,
  waveHeight: string | null,
  tideDesc: string,
  noReason?: string
): string {
  if (noReason) return noReason;

  if (verdict === 'YES') {
    const wavePart = waveHeight && waveHeight !== 'Unknown'
      ? `with ${waveHeight} sets`
      : 'with solid swell';
    const tidePart = tideDesc !== 'Unknown' ? ` on the ${tideDesc} tide` : '';
    return `${capitalize(windDesc)} ${wavePart}${tidePart}`;
  }

  if (verdict === 'MAYBE') {
    const wavePart = waveHeight && waveHeight !== 'Unknown'
      ? `with ${waveHeight} surf`
      : 'with modest swell';
    return `${capitalize(windDesc)} ${wavePart}`;
  }

  // NO
  if (windDesc.includes('onshore') || windDesc.includes('strong')) {
    return `${capitalize(windDesc)} making conditions choppy`;
  }
  return 'Conditions not favorable for surfing today';
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Determine surf call verdict based on score, window duration, and confidence.
 */
function determineVerdict(
  score: number,
  windowMinutes: number,
  forecastConfidence: number
): SurfCallVerdict {
  // Short window gate - cannot be YES regardless of score
  if (windowMinutes < MINIMUM_VIABLE_WINDOW_MINUTES) {
    return 'NO';
  }

  // Base verdict from score thresholds
  let verdict: SurfCallVerdict;
  if (score >= SCORE_YES_THRESHOLD) {
    verdict = 'YES';
  } else if (score >= SCORE_MAYBE_THRESHOLD) {
    verdict = 'MAYBE';
  } else {
    verdict = 'NO';
  }

  // Short window cap: downgrade YES to MAYBE for short windows
  if (windowMinutes < SHORT_WINDOW_THRESHOLD_MINUTES && verdict === 'YES') {
    verdict = 'MAYBE';
  }

  // Confidence gate: downgrade if very low confidence near threshold
  if (forecastConfidence < LOW_CONFIDENCE_THRESHOLD) {
    const nearYesThreshold = Math.abs(score - SCORE_YES_THRESHOLD) <= CONFIDENCE_THRESHOLD_MARGIN;
    const nearMaybeThreshold = Math.abs(score - SCORE_MAYBE_THRESHOLD) <= CONFIDENCE_THRESHOLD_MARGIN;

    if (verdict === 'YES' && nearYesThreshold) {
      verdict = 'MAYBE';
    } else if (verdict === 'MAYBE' && nearMaybeThreshold) {
      verdict = 'NO';
    }
  }

  return verdict;
}

// ============================================================================
// Main Logic
// ============================================================================

/**
 * Compute a surf call verdict from window and forecast data.
 *
 * @param window - The best window from selectBestWindow (null if none)
 * @param forecasts - Today's forecast entries for the beach
 * @param beach - Beach entity with break_type and wind_offshore_deg
 * @returns SurfCallResult with verdict, conditions, and explanation
 */
export function computeSurfCall(
  window: PersonalizedForecastWindow | null,
  forecasts: EnhancedForecastEntity[],
  beach: Beach
): SurfCallResult {
  const now = new Date();
  const updatedAt = now.toISOString();
  const baseResult: SurfCallResult = {
    verdict: 'NO',
    bestWindowStart: null,
    bestWindowEnd: null,
    windowMinutes: null,
    waveHeight: null,
    windDescription: null,
    tideDescription: null,
    whySentence: '',
    forecastConfidence: 0,
    lowForecastConfidence: false,
    score: 0,
    updatedAt,
  };

  // Hard NO: no forecasts
  if (!forecasts || forecasts.length === 0) {
    return {
      ...baseResult,
      whySentence: 'No forecast data available',
    };
  }

  // Hard NO: max wave height below minimum rideable
  const minRideable = getMinRideable(beach);
  const maxWave = Math.max(
    ...forecasts
      .map((f) => parseMaxWaveHeight(f.wave_height))
      .filter((h): h is number => h !== null)
  );
  if (maxWave < minRideable) {
    return {
      ...baseResult,
      waveHeight: maxWave > 0 ? `${maxWave} ft` : null,
      whySentence: 'Waves too small for this spot',
    };
  }

  // Hard NO: no viable window
  if (!window) {
    return {
      ...baseResult,
      whySentence: 'No viable surf window today',
    };
  }

  // Compute window duration
  const windowMs = new Date(window.end).getTime() - new Date(window.start).getTime();
  const windowMinutes = Math.round(windowMs / 60000);
  const score = Math.max(0, Math.min(100, window.score ?? 0));
  const forecastConfidence = window.confidence ?? 50;
  const lowForecastConfidence = forecastConfidence < LOW_CONFIDENCE_DISPLAY_THRESHOLD;

  // Find the forecast entry closest to window start for condition details
  const windowStartMs = new Date(window.start).getTime();
  const closestForecast = forecasts.reduce<EnhancedForecastEntity | null>((closest, f) => {
    const fTime = new Date(f.forecast_date + 'T' + f.forecast_time).getTime();
    if (!closest) return f;
    const closestTime = new Date(closest.forecast_date + 'T' + closest.forecast_time).getTime();
    return Math.abs(fTime - windowStartMs) < Math.abs(closestTime - windowStartMs) ? f : closest;
  }, null);

  const windDescription = getWindDescription(closestForecast, beach);
  const tideDescription = getTideDescription(closestForecast);
  const waveHeight = window.waveHeight !== 'Unknown' ? window.waveHeight : null;

  // Short window gate - reject if too short
  if (windowMinutes < MINIMUM_VIABLE_WINDOW_MINUTES) {
    return {
      ...baseResult,
      bestWindowStart: new Date(window.start).toISOString(),
      bestWindowEnd: new Date(window.end).toISOString(),
      windowMinutes,
      waveHeight,
      windDescription,
      tideDescription,
      forecastConfidence,
      lowForecastConfidence,
      score,
      whySentence: 'Window too short',
    };
  }

  // Determine verdict based on score, window duration, and confidence
  const verdict = determineVerdict(score, windowMinutes, forecastConfidence);

  const whySentence = buildWhySentence(verdict, windDescription, waveHeight, tideDescription);

  return {
    verdict,
    bestWindowStart: new Date(window.start).toISOString(),
    bestWindowEnd: new Date(window.end).toISOString(),
    windowMinutes,
    waveHeight,
    windDescription,
    tideDescription,
    whySentence,
    forecastConfidence,
    lowForecastConfidence,
    score,
    updatedAt,
  };
}
