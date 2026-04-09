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
import { computeTrendTags, type TrendTag } from '@/lib/scoring';
import { formatTideHeight, formatWaveHeightRange as formatWaveHeight } from '@/lib/formatters/surf-data';
import { parseSkillLevel, SKILL_WAVE_RANGES } from '@/lib/domains/user-preferences/skill-level';

// ============================================================================
// Types
// ============================================================================

export type SurfCallVerdict = 'YES' | 'MAYBE' | 'NO';

export interface SurfCallResult {
  verdict: SurfCallVerdict;
  bestWindowStart: string | null;
  bestWindowEnd: string | null;
  windowMinutes: number | null;
  shortWindow: boolean;
  waveHeight: string | null;
  windDescription: string | null;
  windSpeed: string | null;
  windCompass: string | null;
  windType: string | null;
  tideDescription: string | null;
  tidePhase: string | null;
  tideHeight: string | null;
  nextTideType: string | null;
  nextTideAt: string | null;
  whySentence: string;
  forecastConfidence: number;
  lowForecastConfidence: boolean;
  score: number;
  peakTime: string | null;
  trendTags: TrendTag[];
  updatedAt: string;
  /**
   * **Beach-level** calibration flag. `true` means this beach has an empirical
   * shoaling calibration (`beaches.shoaling_factors IS NOT NULL`) — the surf
   * report consumers render the honesty layer's calibrated state ("Face height"
   * label). `false` means the beach is ML-only / forecast-only — consumers apply
   * the `~` prefix, dotted underline, "Forecast height" label, and tooltip.
   *
   * This is a population-level signal, not a per-reading claim. Matches the
   * semantic on `EnhancedForecastEntity.isCalibrated` and the WaveHeightDisplay
   * `isCalibrated` prop. Source: `beach.shoaling_factors !== null` at the call
   * site that owns the Beach record.
   */
  isCalibrated: boolean;
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

// Wave height hard gate minimums by skill level (in feet).
//
// These are derived from SKILL_WAVE_RANGES.acceptable.min (canonical source in
// user-preferences/skill-level.ts) for beginner/intermediate/advanced.
//
// Expert is intentionally set HIGHER than acceptable.min (2.5 vs 2.0).
// Reason: acceptable.min is a user-safety floor ("don't recommend waves too
// small for the user to paddle"). SKILL_LEVEL_MINIMUMS is a beach-as-venue
// gate ("this expert-rated break isn't worth paddling out under 2.5 ft —
// the wave shape won't form properly"). These are different concerns.
//
// The scoring curve counterpart (idealMin) lives in base-conditions-scorer.ts
// and is derived from SKILL_WAVE_RANGES.ideal.min with no overrides needed.
const SKILL_LEVEL_MINIMUMS: Record<string, number> = {
  beginner:     SKILL_WAVE_RANGES.beginner.acceptable.min,     // 0.5
  intermediate: SKILL_WAVE_RANGES.intermediate.acceptable.min, // 1.0
  advanced:     SKILL_WAVE_RANGES.advanced.acceptable.min,     // 2.0
  expert:       2.5, // intentionally above acceptable.min (2.0) — see comment above
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


// ============================================================================
// Helpers
// ============================================================================

function getMinRideable(beach: Beach): number {
  const beachWithType = beach as Beach & BeachWithBreakType;
  const breakType = (beachWithType.break_type || 'default').toLowerCase();
  const breakMin = BREAK_TYPE_MINIMUMS[breakType] ?? BREAK_TYPE_MINIMUMS.default;

  const skillLevel = parseSkillLevel(beach.skill_level);
  const skillMin = skillLevel ? (SKILL_LEVEL_MINIMUMS[skillLevel] ?? 0) : 0;

  return Math.max(breakMin, skillMin);
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

interface WindData {
  description: string;
  speed: string | null;
  compass: string | null;
  type: string | null;
}

/**
 * Compute window-aggregated wind data across all forecasts in the best window.
 * Returns min-max speed range, mode compass direction, and offshore/onshore type.
 */
function getWindowWind(
  windowForecasts: EnhancedForecastEntity[],
  beach: Beach
): WindData {
  if (windowForecasts.length === 0) {
    return { description: 'Unknown', speed: null, compass: null, type: null };
  }

  const speeds: number[] = [];
  const directions: string[] = [];
  const dirDegs: number[] = [];

  for (const f of windowForecasts) {
    const s = f.wind_speed ? parseFloat(f.wind_speed) : NaN;
    if (!isNaN(s)) speeds.push(s);
    if (f.wind_direction) directions.push(f.wind_direction);
    const fwd = f.wind_direction_deg;
    if (fwd != null) dirDegs.push(fwd);
  }

  if (speeds.length === 0) {
    return { description: 'Unknown', speed: null, compass: null, type: null };
  }

  const minSpeed = Math.round(Math.min(...speeds));
  const maxSpeed = Math.round(Math.max(...speeds));
  const avgSpeed = speeds.reduce((a, b) => a + b, 0) / speeds.length;

  // Glassy check
  if (maxSpeed < WIND_SPEED_GLASSY) {
    return { description: 'glassy', speed: `${maxSpeed} mph`, compass: null, type: 'glassy' };
  }

  // Speed string: show range if spread > 3 mph
  const speedStr = (maxSpeed - minSpeed) > 3
    ? `${minSpeed}–${maxSpeed} mph`
    : `${Math.round(avgSpeed)} mph`;

  // Compass: mode (most common direction)
  const compass = directions.length > 0
    ? modeString(directions)
    : null;

  // Wind type: use average direction degrees vs beach offshore
  const beachWithWind = beach as Beach & BeachWithWindData;
  const offshoreDeg = beachWithWind.wind_offshore_deg;
  let windType: string | null = null;

  if (offshoreDeg != null && dirDegs.length > 0) {
    const avgDirDeg = dirDegs.reduce((a, b) => a + b, 0) / dirDegs.length;
    let angleDiff = Math.abs(avgDirDeg - offshoreDeg) % 360;
    if (angleDiff > 180) angleDiff = 360 - angleDiff;

    windType = angleDiff <= WIND_DIRECTION_OFFSHORE_MAX
      ? 'offshore'
      : angleDiff >= WIND_DIRECTION_CROSSSHORE_MIN
        ? 'onshore'
        : 'cross-shore';
  }

  // Build description string
  const desc = windType
    ? `${compass || ''} ${speedStr} (${windType})`.trim()
    : `${compass || ''} ${speedStr}`.trim();

  return { description: desc, speed: speedStr, compass, type: windType };
}

function modeString(arr: string[]): string | null {
  if (arr.length === 0) return null;
  const counts: Record<string, number> = {};
  for (const s of arr) counts[s] = (counts[s] || 0) + 1;
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}

interface TideData {
  description: string;
  phase: string | null;
  nextType: string | null;
  nextAt: string | null;
  height: string | null;
}

/**
 * Extract tide data from the window forecasts.
 *
 * When useCurrentTime is true (today's surf call): selects the forecast row
 * closest to Date.now() so the tide phase reflects current conditions rather
 * than the conditions at window start time.
 *
 * When useCurrentTime is false (tomorrow's surf call): keeps the original
 * window-start behaviour — finds the first forecast whose next_tide_at is at or
 * after the window start.
 */
function getWindowTide(
  windowForecasts: EnhancedForecastEntity[],
  windowStartMs: number,
  useCurrentTime: boolean = true
): TideData {
  if (windowForecasts.length === 0) {
    return { description: 'Unknown', phase: null, nextType: null, nextAt: null, height: null };
  }

  let tideForecast: EnhancedForecastEntity | null = null;

  if (useCurrentTime) {
    // For today: find the forecast row closest to the current moment so that the
    // tide phase shown matches what the tide is doing right now, not at window start.
    const nowMs = Date.now();
    let minDist = Infinity;
    for (const f of windowForecasts) {
      if (!f.forecast_at) continue;
      const dist = Math.abs(new Date(f.forecast_at).getTime() - nowMs);
      if (dist < minDist && f.tide_status) {
        minDist = dist;
        tideForecast = f;
      }
    }
  }

  if (!tideForecast) {
    // Tomorrow mode (or no tide_status found above): use the first forecast
    // whose next_tide_at is at or after window start — original behaviour.
    for (const f of windowForecasts) {
      if (f.next_tide_at && new Date(f.next_tide_at).getTime() >= windowStartMs) {
        tideForecast = f;
        break;
      }
    }
  }

  // Final fallback: use first forecast with tide_status
  if (!tideForecast) {
    tideForecast = windowForecasts.find(f => f.tide_status) || null;
  }

  if (!tideForecast) {
    return { description: 'Unknown', phase: null, nextType: null, nextAt: null, height: null };
  }

  const status = tideForecast.tide_status;
  const rawNextAt = tideForecast.next_tide_at || null;
  const rawNextAtMs = rawNextAt ? new Date(rawNextAt).getTime() : null;

  // Only show "→ Low/High @ time" if the tide event is still in the future.
  // The next_tide_at on a forecast row is relative to that forecast hour, so
  // it can be in the past by the time the user views the surf call.
  const isFutureTide = rawNextAtMs != null && rawNextAtMs > Date.now();
  const nextType = isFutureTide ? (tideForecast.next_tide_type || null) : null;
  const nextAt = isFutureTide ? rawNextAt : null;

  // Normalize phase
  let phase: string | null = null;
  if (status) {
    const lower = status.toLowerCase();
    if (lower.includes('rising')) phase = 'rising';
    else if (lower.includes('falling')) phase = 'falling';
    else if (lower.includes('high')) phase = 'high slack';
    else if (lower.includes('low')) phase = 'low slack';
    else phase = status;
  }

  // Build description
  let desc = phase || 'Unknown';
  if (phase && nextType && nextAt) {
    desc = `${capitalize(phase)} → ${capitalize(nextType)}`;
  }

  // Format tide height for display
  const tideHeightValue = tideForecast.tide_height != null
    ? parseFloat(String(tideForecast.tide_height))
    : null;
  const height = tideHeightValue != null && isFinite(tideHeightValue)
    ? formatTideHeight(tideHeightValue)
    : null;

  return { description: desc, phase, nextType: nextType || null, nextAt: nextAt || null, height };
}

/**
 * Build why sentence explaining the reason for the verdict.
 * Picks the dominant factor rather than summarizing all conditions.
 */
function buildWhySentence(
  verdict: SurfCallVerdict,
  wind: WindData,
  waveHeight: string | null,
  tide: TideData,
  shortWindow: boolean,
  noReason?: string
): string {
  if (noReason) return noReason;

  const isOffshore = wind.type === 'offshore';
  const isOnshore = wind.type === 'onshore';
  const isCross = wind.type === 'cross-shore';
  const hasGoodTide = tide.phase === 'rising' || tide.phase === 'low slack';

  if (verdict === 'YES') {
    // Highlight the two strongest positives
    const parts: string[] = [];
    if (isOffshore || wind.type === 'glassy') {
      parts.push(wind.type === 'glassy' ? 'Glassy conditions' : 'Clean offshore');
    }
    if (hasGoodTide && tide.phase) {
      parts.push(`${tide.phase} tide`);
    }
    const wavePart = waveHeight && waveHeight !== 'Unknown'
      ? `with ${waveHeight} swell energy`
      : 'with solid swell';
    if (parts.length >= 2) {
      return `${capitalize(parts[0])} + ${parts[1]} ${wavePart}.`;
    }
    if (parts.length === 1) {
      return `${capitalize(parts[0])} ${wavePart}.`;
    }
    return `Good conditions ${wavePart}.`;
  }

  if (verdict === 'MAYBE') {
    // Highlight the biggest limiter
    if (shortWindow) {
      if (isOnshore || isCross) {
        return `Short clean window before wind turns ${wind.type}.`;
      }
      return 'Best window is short — conditions change quickly.';
    }
    if (isOnshore) {
      return 'Size is there, but onshore wind hurts shape.';
    }
    if (isCross) {
      return 'Size is there, but cross-shore wind affects quality.';
    }
    if (tide.phase === 'falling' || tide.phase === 'high slack') {
      return 'Good swell, but tide is dropping through the window.';
    }
    const wavePart = waveHeight && waveHeight !== 'Unknown'
      ? `${waveHeight} surf`
      : 'modest swell';
    return `Rideable ${wavePart} — keep an eye on conditions.`;
  }

  // NO — state the primary fail gate
  if (isOnshore) return 'Onshore wind all day making conditions choppy.';
  if (wind.description.includes('strong')) return 'Strong wind making conditions unsurfable.';
  if (shortWindow) return 'No viable window long enough to surf.';
  return 'Conditions not favorable for surfing.';
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
 * @param options.isTomorrow - When true, tide phase uses window-start logic
 *   (current time is irrelevant for tomorrow). Defaults to false.
 * @returns SurfCallResult with verdict, conditions, and explanation
 */
export function computeSurfCall(
  window: PersonalizedForecastWindow | null,
  forecasts: EnhancedForecastEntity[],
  beach: Beach,
  options: { isTomorrow?: boolean } = {}
): SurfCallResult {
  const { isTomorrow = false } = options;
  const now = new Date();
  const updatedAt = now.toISOString();
  // Population-level honesty signal: true when this beach has an empirical
  // shoaling calibration. Mirrors the API envelope semantic stamped by
  // /api/forecasts/update-enhanced and friends.
  const isCalibrated =
    (beach as Beach & { shoaling_factors?: unknown })?.shoaling_factors != null;
  const baseResult: SurfCallResult = {
    verdict: 'NO',
    bestWindowStart: null,
    bestWindowEnd: null,
    windowMinutes: null,
    shortWindow: false,
    waveHeight: null,
    windDescription: null,
    windSpeed: null,
    windCompass: null,
    windType: null,
    tideDescription: null,
    tidePhase: null,
    tideHeight: null,
    nextTideType: null,
    nextTideAt: null,
    whySentence: '',
    forecastConfidence: 0,
    lowForecastConfidence: false,
    score: 0,
    peakTime: null,
    trendTags: [],
    updatedAt,
    isCalibrated,
  };

  // Hard NO: no forecasts
  if (!forecasts || forecasts.length === 0) {
    return {
      ...baseResult,
      whySentence: 'No forecast data available',
    };
  }

  // Soft gate: wave height below minimum rideable
  // If a valid window exists with a decent score (which includes user preference
  // adjustments and swell quality boost), we downgrade to MAYBE instead of hard NO.
  // This prevents the surf call from contradicting the discovery system's assessment.
  const minRideable = getMinRideable(beach);
  const parsedHeights = forecasts
    .map((f) => parseMaxWaveHeight(f.wave_height))
    .filter((h): h is number => h !== null);
  const maxWave = parsedHeights.length > 0 ? Math.max(...parsedHeights) : null;
  // When wave heights are unknown (all null/Unknown), don't trigger the small-wave gate —
  // let the scoring system's verdict stand unmodified.
  const wavesBelowMin = maxWave !== null && maxWave < minRideable;

  // If waves below min AND no valid window → hard NO (both signals agree)
  if (wavesBelowMin && !window) {
    return {
      ...baseResult,
      waveHeight: maxWave != null && maxWave > 0 ? formatWaveHeight(maxWave) : null,
      whySentence: 'Waves too small for this spot.',
    };
  }

  // No viable window (but waves are adequate)
  if (!window) {
    return {
      ...baseResult,
      whySentence: 'No viable surf window today.',
    };
  }

  // Check window-specific wave height
  const windowWave = parseMaxWaveHeight(window.waveHeight);
  const windowWavesBelowMin = windowWave !== null && windowWave < minRideable;

  // Compute window duration
  const windowMs = new Date(window.end).getTime() - new Date(window.start).getTime();
  const windowMinutes = Math.round(windowMs / 60000);
  const shortWindow = windowMinutes < SHORT_WINDOW_THRESHOLD_MINUTES;
  const score = Math.max(0, Math.min(100, window.score ?? 0));
  const forecastConfidence = window.confidence ?? 50;
  const lowForecastConfidence = forecastConfidence < LOW_CONFIDENCE_DISPLAY_THRESHOLD;

  // Get forecasts within the window for aggregated conditions
  const windowStartMs = new Date(window.start).getTime();
  const windowEndMs = new Date(window.end).getTime();
  const windowForecasts = forecasts.filter((f) => {
    const fTime = new Date(f.forecast_at).getTime();
    return fTime >= windowStartMs && fTime <= windowEndMs;
  });
  // Fallback: if no forecasts strictly within window, use closest ones
  const effectiveForecasts = windowForecasts.length > 0
    ? windowForecasts
    : forecasts.slice(0, 3);

  const trendTags = computeTrendTags(effectiveForecasts, beach);

  const wind = getWindowWind(effectiveForecasts, beach);
  const tide = getWindowTide(effectiveForecasts, windowStartMs, !isTomorrow);
  const waveHeight = window.waveHeight !== 'Unknown' ? window.waveHeight : null;

  // Short window gate - reject if too short
  if (windowMinutes < MINIMUM_VIABLE_WINDOW_MINUTES) {
    return {
      ...baseResult,
      bestWindowStart: new Date(window.start).toISOString(),
      bestWindowEnd: new Date(window.end).toISOString(),
      windowMinutes,
      shortWindow: true,
      waveHeight,
      windDescription: wind.description,
      windSpeed: wind.speed,
      windCompass: wind.compass,
      windType: wind.type,
      tideDescription: tide.description,
      tidePhase: tide.phase,
      tideHeight: tide.height,
      nextTideType: tide.nextType,
      nextTideAt: tide.nextAt,
      forecastConfidence,
      lowForecastConfidence,
      score,
      whySentence: 'No viable window long enough to surf.',
    };
  }

  // Determine verdict based on score, window duration, and confidence
  let verdict = determineVerdict(score, windowMinutes, forecastConfidence);

  // Soft gate override: when waves are below the break's minimum but the score
  // (which includes user preference adjustments and swell quality boost) says
  // conditions are surfable, allow MAYBE instead of forcing NO.
  // Cap at MAYBE — never promote to YES for below-minimum waves.
  // Note: this intentionally overrides confidence-gate downgrades — when the
  // small-wave gate is the dominant signal, we trust the score threshold directly.
  if (wavesBelowMin || windowWavesBelowMin) {
    if (score >= SCORE_MAYBE_THRESHOLD) {
      verdict = 'MAYBE';
    } else {
      verdict = 'NO';
    }
  }

  // Build explanation — override for small-wave MAYBE to explain the nuance
  const smallWaveOverride = (wavesBelowMin || windowWavesBelowMin) && verdict === 'MAYBE'
    ? `Small for this break but conditions look fun — ${waveHeight ?? 'modest swell'} with ${wind.type === 'glassy' || wind.type === 'offshore' ? 'clean winds' : 'manageable wind'}.`
    : undefined;
  const whySentence = buildWhySentence(verdict, wind, waveHeight, tide, shortWindow, smallWaveOverride);
  const peakTime = window.peakTime instanceof Date && !isNaN(window.peakTime.getTime())
    ? window.peakTime.toISOString()
    : null;

  return {
    verdict,
    bestWindowStart: new Date(window.start).toISOString(),
    bestWindowEnd: new Date(window.end).toISOString(),
    windowMinutes,
    shortWindow,
    waveHeight,
    windDescription: wind.description,
    windSpeed: wind.speed,
    windCompass: wind.compass,
    windType: wind.type,
    tideDescription: tide.description,
    tidePhase: tide.phase,
    tideHeight: tide.height,
    nextTideType: tide.nextType,
    nextTideAt: tide.nextAt,
    whySentence,
    forecastConfidence,
    lowForecastConfidence,
    score,
    peakTime,
    trendTags,
    updatedAt,
    isCalibrated,
  };
}
