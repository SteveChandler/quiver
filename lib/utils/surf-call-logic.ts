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
import { parseSkillLevel, SKILL_WAVE_RANGES, type SkillLevel } from '@/lib/domains/user-preferences/skill-level';
import type { SkillSource } from '@/lib/domains/rideability/ability';
import { calculateRideableWaves } from '@/lib/domains/wave-frequency/calculator';
import {
  beachToSpotProfile,
  forecastToSnapshot,
  getDiscoveryScoringEngine,
  getConditionCharacter,
  getSkipCause,
  LOW_TIDE_HEAVY_SWELL_WARNING,
  type ConditionCharacter,
  type SkipCause,
} from '@/lib/domains/scoring';
import {
  getRecommendationLabel,
  getRecommendationLabelGated,
} from '@/lib/services/discovery/response-formatter';
import type { CompositeScore, ScorerInput } from '@/lib/domains/scoring';
import { classifyWindRelation, WIND_SPEED_GLASSY_MPH } from '@/lib/utils/wind-relation';
import { resolveOffshoreDeg } from '@/lib/domains/shared/wind-orientation';
import { resolveBeachTimezone } from '@/lib/utils/timezone-utils';
import { isTideSwingEnabled } from '@/lib/flags/tide-swing';
import { isDirectionScoringEnabledForBeach } from '@/lib/flags/direction-scoring';
import {
  assessTideSwing,
  resolveTideBand,
  TIDE_BAND_TOLERANCE_FT,
  TIDE_EFFECT_CODES,
} from '@/lib/domains/scoring/tide-swing';
import { windChopCeiling } from '@/lib/domains/scoring/wind-chop-ceiling';
import { scoreWindowWithComposite } from '@/lib/services/discovery/window-selector/window-scorer';
import { formatClock12, formatWindowLabel } from '@/lib/notifications/copy/daily-call-copy';

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
  /** Null when no selected window was scored; zero is a valid scored result. */
  score: number | null;
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
  rideableWavesPerHour: number | null;
  dominantBeatIntervalS: number | null;
  /**
   * Qualitative condition character from the new domain engine
   * (`getConditionCharacter`). Optional — present when a composite score
   * could be computed from a representative forecast in the window. Native
   * UI does not currently render this directly; it's plumbed through so
   * web/native consumers can adopt the richer label without re-deriving.
   */
  character?: ConditionCharacter | null;
  /**
   * Per-skill verdict ladder (BEGINNER / INTERMEDIATE / ADVANCED). Optional —
   * populated server-side by `computeSurfCallTiers` for the web zine UI; native
   * clients read only the top-level `verdict` and ignore tiers.
   */
  tiers?: SurfCallTiers | null;
  /**
   * The viewer's resolved experience level at request time. Used by the web UI
   * to highlight which tier row in `tiers` belongs to the user.
   */
  userTier?: SkillLevel | null;
  /**
   * Source for `userTier`: profile skill, board-implied prior, or default.
   * Additive telemetry/debug metadata for web and native clients.
   */
  skillSource?: SkillSource | null;
  /**
   * User-facing cautions from setup-specific guardrails. Additive for web and
   * native consumers; absent/empty means no extra warning needs to be shown.
   */
  cautions?: string[];
}

/**
 * Translate the discovery engine's recommendation label
 * ('Worth it' | 'Maybe' | 'Skip') into the native verdict shape
 * ('YES' | 'MAYBE' | 'NO') so the native UI doesn't change.
 *
 * Single source of truth for the legacy → unified mapping. Used by
 * `computeSurfCall` (and its tests) so a future native migration to the
 * 'Worth it'/'Maybe'/'Skip' shape only needs to flip this helper.
 */
export function verdictFromRecommendationLabel(
  label: 'Worth it' | 'Maybe' | 'Skip'
): SurfCallVerdict {
  switch (label) {
    case 'Worth it':
      return 'YES';
    case 'Maybe':
      return 'MAYBE';
    case 'Skip':
      return 'NO';
  }
}

// ============================================================================
// Constants
// ============================================================================

// Wave height minimums by break type (in feet).
//
// Both the canonical normalized form (beach/reef/point/river_mouth — what the
// DB actually stores after migration 20251207100000_beaches_data_quality_fixes)
// and the legacy two-word form ("beach break" etc.) are keyed so this lookup
// works for any caller regardless of normalization stage. Without the canonical
// keys, normalized "reef" / "point" rows would fall back to the 1.5ft default
// instead of the intended 2.0ft minimum.
const BREAK_TYPE_MINIMUMS: Record<string, number> = {
  beach: 1.5,
  reef: 2.0,
  point: 2.0,
  river_mouth: 1.5,
  // Legacy two-word forms — preserved for any rows that didn't get normalized.
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
const WIND_SPEED_LIGHT_MAX = 10;
const WIND_SPEED_MODERATE_MAX = 18;

// Window duration thresholds (in minutes)
export const MINIMUM_VIABLE_WINDOW_MINUTES = 30;
const SHORT_WINDOW_THRESHOLD_MINUTES = 45;

// Score thresholds (0-100 scale)
//
// These thresholds mirror `getRecommendationLabel` in
// `lib/services/discovery/response-formatter.ts` (>=70 'Worth it',
// >=40 'Maybe', else 'Skip'). Verdict is now translated from
// `recommendationLabel` via `verdictFromRecommendationLabel`, so these
// constants only drive confidence-gate proximity checks.
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


// ============================================================================
// Helpers
// ============================================================================

/**
 * Minimum rideable wave height (ft) for a beach, derived from break_type and
 * skill_level. Exported for the alert-evaluator surfability gate, which lives
 * outside the discovery pipeline and only needs `break_type` + `skill_level`.
 */
export function getMinRideable(beach: Beach): number {
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
  if (maxSpeed < WIND_SPEED_GLASSY_MPH) {
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
  const offshoreDeg = resolveOffshoreDeg(beach);
  let windType: string | null = null;

  if (offshoreDeg != null && dirDegs.length > 0) {
    const avgDirDeg = dirDegs.reduce((a, b) => a + b, 0) / dirDegs.length;
    windType = classifyWindRelation(avgDirDeg, offshoreDeg);
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
  noReason?: string,
  skipCause?: SkipCause | null,
  tideLimiter?: TideLimiter | null,
): string {
  if (noReason) return noReason;

  const isOffshore = wind.type === 'offshore';
  const isOnshore = wind.type === 'onshore';
  const isCross = wind.type === 'cross-shore';
  const hasGoodTide = tide.phase === 'rising' || tide.phase === 'low slack';

  if (verdict === 'YES' && tideLimiter) {
    return tideLimitSentence('Good size', tideLimiter);
  }

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

  if (skipCause) return skipWhySentence(skipCause);

  if (verdict === 'MAYBE') {
    // Highlight the biggest limiter
    if (shortWindow) {
      if (isOnshore || isCross) {
        return `Short clean window before wind turns ${wind.type}.`;
      }
      return 'Best window is short — conditions change quickly.';
    }
    // The lowest ceiling on the call, so it outranks the wind and falling-tide lines below.
    if (tideLimiter) {
      return tideLimitSentence('Size is there', tideLimiter);
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
  if (isOnshore) return 'Onshore wind all day, so it stays choppy.';
  if (wind.description.includes('strong')) return 'Too windy to be fun right now.';
  if (shortWindow) return 'It only lines up for a few minutes. Not worth the drive.';
  return 'Not worth paddling out right now.';
}

/** The skip cause the condition label names, in that hour's numbers. */
function skipWhySentence(cause: SkipCause): string {
  if (cause.kind === 'wind') {
    if (cause.direction === 'onshore') {
      return `Blown out — ${cause.speedMph} mph onshore wind, choppy and hard to read.`;
    }
    if (cause.direction === 'sideshore') {
      return `Blown out — ${cause.speedMph} mph side-shore wind, choppy and hard to read.`;
    }
    return `Blown out — ${cause.speedMph} mph offshore wind, hard to paddle into.`;
  }
  if (cause.kind === 'flat') return 'Under half a foot at the peak — not enough swell to break.';
  if (cause.kind === 'setup-risk') return `${LOW_TIDE_HEAVY_SWELL_WARNING}.`;
  return 'Not enough forecast data at the peak to rate it.';
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function lowercaseFirst(s: string): string {
  return s.charAt(0).toLowerCase() + s.slice(1);
}

// ============================================================================
// Tide limiter (TIDE_SWING_ENABLED)
// ============================================================================

/** The tide effect holding the call's ceiling, read from the composite of the call's peak row. */
interface TideLimiter {
  code: string;
  message: string;
  /** Which side of the curated band the tide sits on; null when inside it or unbanded. */
  side: 'high' | 'low' | null;
  /** "Tide back in range by ~12 PM" when the tide re-enters the band within the hour. */
  reentryMessage: string | null;
  /** "12–3 PM" / "around 2 PM": the next in-band rows after the peak row, from the day's rows. */
  betterSpan: string | null;
}

function tideLimitSentence(lead: string, limiter: TideLimiter): string {
  if (limiter.reentryMessage) return `${lead}; ${lowercaseFirst(limiter.reentryMessage)}.`;
  const better = limiter.betterSpan ? ` — better ${limiter.betterSpan}` : '';
  if (limiter.side === 'high') return `${lead}, but a lot of water until the tide drops${better}.`;
  if (limiter.side === 'low') return `${lead}, but not enough water until the tide fills in${better}.`;
  return `${lead}, but ${lowercaseFirst(limiter.message)}.`;
}

function tideHeightOf(forecast: EnhancedForecastEntity): number | null {
  const value = forecast.tide_height == null ? NaN : parseFloat(String(forecast.tide_height));
  return Number.isFinite(value) ? value : null;
}

/** The Daily Call's surfable day, 05:00 to 20:00 local: a span never names a night hour. */
const BETTER_SPAN_FIRST_HOUR = 5;
const BETTER_SPAN_END_HOUR = 20;

/** One formatter per timezone: building one per row is the slow part of these reads. */
const localDayFormatters = new Map<string, Intl.DateTimeFormat>();
const localHourFormatters = new Map<string, Intl.DateTimeFormat>();

function cachedFormatter(
  cache: Map<string, Intl.DateTimeFormat>,
  timezone: string,
  build: () => Intl.DateTimeFormat,
): Intl.DateTimeFormat {
  let formatter = cache.get(timezone);
  if (!formatter) {
    formatter = build();
    cache.set(timezone, formatter);
  }
  return formatter;
}

function localDayOf(ms: number, timezone: string): string {
  return cachedFormatter(localDayFormatters, timezone, () =>
    new Intl.DateTimeFormat('en-CA', { timeZone: timezone })).format(new Date(ms));
}

function localHourOf(ms: number, timezone: string): number {
  return Number(cachedFormatter(localHourFormatters, timezone, () => new Intl.DateTimeFormat('en-US', {
    timeZone: timezone, hour: 'numeric', hourCycle: 'h23',
  })).format(new Date(ms)));
}

/** Rows on `ms`'s local day inside the surfable 05:00–20:00 local hours, in time order. */
function surfableRowsOnDayOf(
  ms: number,
  forecasts: readonly EnhancedForecastEntity[],
  timezone: string,
): EnhancedForecastEntity[] {
  const day = localDayOf(ms, timezone);
  return forecasts
    .filter((forecast) => {
      const at = Date.parse(forecast.forecast_at);
      if (!Number.isFinite(at) || localDayOf(at, timezone) !== day) return false;
      const hour = localHourOf(at, timezone);
      return hour >= BETTER_SPAN_FIRST_HOUR && hour < BETTER_SPAN_END_HOUR;
    })
    .sort((left, right) => Date.parse(left.forecast_at) - Date.parse(right.forecast_at));
}

/**
 * The contiguous run of in-band rows after the limited row, on the same local
 * day. Times come only from rows that exist; with none, the sentence has no times.
 */
function findBetterTideSpan(
  limitedRow: EnhancedForecastEntity,
  forecasts: readonly EnhancedForecastEntity[],
  band: { minFt: number; maxFt: number },
  timezone: string,
): string | null {
  const limitedMs = Date.parse(limitedRow.forecast_at);
  if (!Number.isFinite(limitedMs)) return null;
  const later = surfableRowsOnDayOf(limitedMs, forecasts, timezone)
    .filter((forecast) => Date.parse(forecast.forecast_at) > limitedMs);
  const inBand = (forecast: EnhancedForecastEntity): boolean => {
    const height = tideHeightOf(forecast);
    return height !== null
      && height >= band.minFt - TIDE_BAND_TOLERANCE_FT
      && height <= band.maxFt + TIDE_BAND_TOLERANCE_FT;
  };
  const firstIndex = later.findIndex(inBand);
  if (firstIndex === -1) return null;
  let lastIndex = firstIndex;
  while (lastIndex + 1 < later.length && inBand(later[lastIndex + 1])) lastIndex += 1;
  const first = later[firstIndex].forecast_at;
  const last = later[lastIndex].forecast_at;
  try {
    return firstIndex === lastIndex
      ? `around ${formatClock12(first, timezone)}`
      : formatWindowLabel(first, last, timezone, { forBody: true });
  } catch {
    // An unknown IANA zone throws RangeError; the sentence still stands without times.
    return null;
  }
}

/**
 * The tide effect that sets the call's lowest ceiling (effects plus the wind-chop
 * ceiling, as the displayed score resolves it). Ties go to the tide, as in the engine.
 */
function resolveTideLimiter(
  composite: CompositeScore,
  scorerInput: ScorerInput,
  beach: Beach,
  representativeForecast: EnhancedForecastEntity,
  forecasts: readonly EnhancedForecastEntity[],
  timezone: string,
): TideLimiter | null {
  const effects = composite.effects ?? [];
  const tideEffects = effects.filter((effect) =>
    TIDE_EFFECT_CODES.has(effect.code) && effect.verdictCeiling !== undefined);
  if (tideEffects.length === 0) return null;
  const chop = isDirectionScoringEnabledForBeach(beach)
    ? windChopCeiling(scorerInput, composite.subscores, { ignoreWindQuality: true })
    : null;
  const limitingCeiling = effects.reduce(
    (current, effect) => Math.min(current, effect.verdictCeiling ?? 100),
    chop?.ceiling ?? 100,
  );
  const binding = tideEffects.find((effect) => (effect.verdictCeiling ?? 100) <= limitingCeiling);
  if (!binding) return null;

  const swing = assessTideSwing(scorerInput.snapshot, scorerInput.profile);
  const band = resolveTideBand(scorerInput.profile.tidePreferences);
  const reentryMessage = binding.code === 'tide_outside_band' ? swing.reentryMessage : null;
  return {
    code: binding.code,
    message: binding.message,
    side: swing.side,
    reentryMessage,
    betterSpan: band && swing.side && !reentryMessage
      ? findBetterTideSpan(representativeForecast, forecasts, band, timezone)
      : null,
  };
}

function extractSetupCautions(warnings: readonly string[] | undefined): string[] {
  if (!warnings || warnings.length === 0) return [];
  return warnings.filter((warning) => warning === LOW_TIDE_HEAVY_SWELL_WARNING);
}

/**
 * Narrow a "best window" to peakTime ± 1h, clamped to the original window bounds.
 * Used when the verdict is MAYBE — a wide daylight span is useless noise, but a
 * concrete 2-hour span around the peak is the actionable answer.
 */
const ONE_HOUR_MS = 60 * 60 * 1000;

export function narrowWindowAroundPeak(
  peakTime: Date,
  windowStart: Date,
  windowEnd: Date,
): { start: Date; end: Date } {
  const startMs = Math.max(peakTime.getTime() - ONE_HOUR_MS, windowStart.getTime());
  const endMs = Math.min(peakTime.getTime() + ONE_HOUR_MS, windowEnd.getTime());
  // Defensive: if peakTime falls outside [windowStart, windowEnd] (clock
  // skew, upstream regression), the naive clamp returns end < start. Pin
  // to the nearest bound so callers never see an inverted interval.
  if (endMs < startMs) {
    const pinnedMs = peakTime.getTime() < windowStart.getTime()
      ? windowStart.getTime()
      : windowEnd.getTime();
    return { start: new Date(pinnedMs), end: new Date(pinnedMs) };
  }
  return { start: new Date(startMs), end: new Date(endMs) };
}

/**
 * Determine surf call verdict using the new domain engine's
 * `recommendationLabel` translated through `verdictFromRecommendationLabel`,
 * then apply the window-duration and confidence guards.
 *
 * Character-gated label (PR 4): when a `ConditionCharacter` is available,
 * `getRecommendationLabelGated` caps "Worth it" on positive characters
 * only. This is what closes the Horseshoe-screenshot regression where a
 * 75-ish score on `medium-mixed` was surfacing as YES / NOW FIRING.
 */
function determineVerdict(
  score: number,
  windowMinutes: number,
  forecastConfidence: number,
  character: ConditionCharacter | null
): SurfCallVerdict {
  // Short window gate - cannot be YES regardless of score
  if (windowMinutes < MINIMUM_VIABLE_WINDOW_MINUTES) {
    return 'NO';
  }

  // Base verdict from the character-gated label mapping (PR 4)
  const label = character
    ? getRecommendationLabelGated(score, character.category)
    : getRecommendationLabel(score);
  let verdict = verdictFromRecommendationLabel(label);

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
// Domain Engine Integration
// ============================================================================

/**
 * Pick the representative forecast row inside the chosen window for
 * composite scoring + character classification. Prefers the row closest
 * to `peakTime`, falls back to the first window forecast, then to the
 * first overall forecast — matches the row that drove window scoring.
 */
function pickRepresentativeForecast(
  windowForecasts: EnhancedForecastEntity[],
  fallbackForecasts: EnhancedForecastEntity[],
  peakTime: Date | undefined
): EnhancedForecastEntity | null {
  const pool = windowForecasts.length > 0 ? windowForecasts : fallbackForecasts;
  if (pool.length === 0) return null;
  if (peakTime instanceof Date && !isNaN(peakTime.getTime())) {
    const peakMs = peakTime.getTime();
    let best: EnhancedForecastEntity | null = null;
    let bestDist = Infinity;
    for (const f of pool) {
      if (!f.forecast_at) continue;
      const dist = Math.abs(new Date(f.forecast_at).getTime() - peakMs);
      if (dist < bestDist) {
        bestDist = dist;
        best = f;
      }
    }
    if (best) return best;
  }
  return pool[0] ?? null;
}

interface CompositeAndCharacter {
  composite: CompositeScore;
  character: ConditionCharacter;
  skipCause: SkipCause | null;
  /** Always null with TIDE_SWING_ENABLED off. */
  tideLimiter: TideLimiter | null;
}

/** Copy only: a failure here must not cost the call its composite and character. */
function safeTideLimiter(...args: Parameters<typeof resolveTideLimiter>): TideLimiter | null {
  try {
    return resolveTideLimiter(...args);
  } catch {
    return null;
  }
}

/** How far past the window's end (or before its start) a tide takeover is still news. */
const TIDE_HANDOFF_LOOK_MS = 3 * ONE_HOUR_MS;
const TIDE_HANDOFF_MAX_CHARS = 120;

function tideLimiterForRow(
  beach: Beach,
  row: EnhancedForecastEntity,
  forecasts: readonly EnhancedForecastEntity[],
  timezone: string,
): TideLimiter | null {
  const scorerInput: ScorerInput = {
    profile: beachToSpotProfile(beach),
    snapshot: forecastToSnapshot(row),
    window: null,
    preferences: null,
  };
  // Memoized per (row, beach) inside a request scope; the input is still needed for the chop ceiling.
  const composite = scoreWindowWithComposite(row, beach);
  return resolveTideLimiter(composite, scorerInput, beach, row, forecasts, timezone);
}

function roundedClock(ms: number, timezone: string): string {
  const halfHourMs = 30 * 60 * 1000;
  return formatClock12(new Date(Math.round(ms / halfHourMs) * halfHourMs).toISOString(), timezone);
}

/**
 * A clean window next to a stretch the tide holds down: "go early" when the
 * tide takes over within 3 hours of the window's end, or "once the tide drops"
 * when the window opens straight after one. Times are row times only.
 * Returns the clause and an optional tail that is dropped first for length.
 */
function resolveTideHandoff(
  beach: Beach,
  window: PersonalizedForecastWindow,
  forecasts: readonly EnhancedForecastEntity[],
  timezone: string,
): { clause: string; tail: string | null } | null {
  const startMs = new Date(window.start).getTime();
  const endMs = new Date(window.end).getTime();
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return null;
  const dayRows = surfableRowsOnDayOf(startMs, forecasts, timezone);

  const after = dayRows.filter((row) => {
    const at = Date.parse(row.forecast_at);
    return at >= endMs && at <= endMs + TIDE_HANDOFF_LOOK_MS;
  });
  for (const row of after) {
    const limiter = tideLimiterForRow(beach, row, forecasts, timezone);
    if (!limiter) continue;
    const from = `~${formatClock12(row.forecast_at, timezone)}`;
    const clause = limiter.side === 'high'
      ? `go early, the tide floods it from ${from}`
      : limiter.side === 'low'
        ? `go early, it drains out from ${from}`
        : `go early, the tide takes over from ${from}`;
    return { clause, tail: limiter.betterSpan ? ` (better again ${limiter.betterSpan})` : null };
  }

  const before = [...dayRows].reverse().find((row) => {
    const at = Date.parse(row.forecast_at);
    return at < startMs && at >= startMs - TIDE_HANDOFF_LOOK_MS;
  });
  const beforeLimiter = before ? tideLimiterForRow(beach, before, forecasts, timezone) : null;
  if (!beforeLimiter) return null;
  const once = beforeLimiter.side === 'high'
    ? 'once the tide drops'
    : beforeLimiter.side === 'low' ? 'once the tide fills in' : 'once the tide eases';
  return { clause: `${once}, from ~${roundedClock(startMs, timezone)}`, tail: null };
}

/** Copy only, like safeTideLimiter. */
function safeTideHandoff(...args: Parameters<typeof resolveTideHandoff>): ReturnType<typeof resolveTideHandoff> {
  try {
    return resolveTideHandoff(...args);
  } catch {
    return null;
  }
}

function withTideHandoff(sentence: string, handoff: { clause: string; tail: string | null }): string {
  const base = sentence.replace(/\.$/, '');
  const full = `${base} — ${handoff.clause}${handoff.tail ?? ''}.`;
  if (full.length <= TIDE_HANDOFF_MAX_CHARS || !handoff.tail) return full;
  return `${base} — ${handoff.clause}.`;
}

/**
 * Run the new domain engine + character classifier against a
 * representative forecast. Returns null if the engine throws — character
 * is optional on `SurfCallResult`, so the caller falls back gracefully.
 */
function computeCompositeAndCharacter(
  beach: Beach,
  representativeForecast: EnhancedForecastEntity | null,
  forecasts: readonly EnhancedForecastEntity[] = [],
  timezone: string = resolveBeachTimezone(beach.timezone),
): CompositeAndCharacter | null {
  if (!representativeForecast) return null;
  try {
    const profile = beachToSpotProfile(beach);
    const snapshot = forecastToSnapshot(representativeForecast);
    const scorerInput: ScorerInput = {
      profile,
      snapshot,
      window: null,
      preferences: null,
    };
    const composite = getDiscoveryScoringEngine().score(scorerInput);
    const character = getConditionCharacter(snapshot, profile, composite);
    return {
      composite,
      character,
      skipCause: getSkipCause(snapshot, profile, composite),
      tideLimiter: isTideSwingEnabled()
        ? safeTideLimiter(composite, scorerInput, beach, representativeForecast, forecasts, timezone)
        : null,
    };
  } catch {
    return null;
  }
}

// ============================================================================
// Main Logic
// ============================================================================

export interface SurfCallOptions {
  /** When true, tide phase uses window-start logic. Defaults to false. */
  isTomorrow?: boolean;
  /**
   * A verdict decided elsewhere (the canonical session decision). The
   * explanation, window narrowing and per-skill tiers are derived from it so
   * they cannot describe a different verdict than the one the caller stamps.
   */
  verdict?: SurfCallVerdict;
  /** IANA zone for tier trail times; defaults to the window's, then the beach's. */
  timezone?: string;
}

/** Categories whose label promises clean wind. */
const CLEAN_WIND_CATEGORIES: ReadonlySet<string> = new Set([
  'small-clean',
  'medium-clean',
  'large-clean',
]);

const KNOTS_TO_MPH = 1.15078;

/**
 * The character label is classified from a composite score on a single row; the
 * window wind type is classified separately. A "clean wind" label beside an
 * onshore wind, or a cross-shore wind past the beach's cross-shore tolerance,
 * contradicts itself, so the label gives way to the wind.
 */
function reconcileCharacterWithWind(
  character: ConditionCharacter | null,
  wind: WindData,
  beach: Beach,
): ConditionCharacter | null {
  if (!character || !CLEAN_WIND_CATEGORIES.has(character.category)) return character;
  const strongCrossShore =
    wind.type === 'cross-shore' &&
    (parseMaxWaveHeight(wind.speed) ?? 0) >
      beachToSpotProfile(beach).windThresholds.crossShoreOkKts * KNOTS_TO_MPH;
  if (wind.type !== 'onshore' && !strongCrossShore) return character;
  const cause = wind.type === 'onshore' ? 'onshore' : 'cross-shore';
  return character.category === 'large-clean'
    ? { category: 'large-rough', label: `Big but wind-affected — ${cause}` }
    : { category: 'medium-mixed', label: `Decent — ${cause} wind takes the shine off` };
}

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
  options: SurfCallOptions = {}
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
    score: null,
    peakTime: null,
    trendTags: [],
    updatedAt,
    isCalibrated,
    rideableWavesPerHour: null,
    dominantBeatIntervalS: null,
    character: null,
    cautions: [],
  };

  // Hard NO: no forecasts
  if (!forecasts || forecasts.length === 0) {
    return {
      ...baseResult,
      whySentence: 'No forecast for this spot right now.',
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
      whySentence: 'Too small to break here today.',
    };
  }

  // No viable window (but waves are adequate)
  if (!window) {
    return {
      ...baseResult,
      whySentence: 'Nothing worth paddling out for today.',
    };
  }

  // Check window-specific wave height
  const windowWave = parseMaxWaveHeight(window.waveHeight);
  const windowWavesBelowMin = windowWave !== null && windowWave < minRideable;

  // Compute window duration
  const windowMs = new Date(window.end).getTime() - new Date(window.start).getTime();
  const windowMinutes = Math.round(windowMs / 60000);
  const shortWindow = windowMinutes < SHORT_WINDOW_THRESHOLD_MINUTES;
  const score = window.score == null
    ? null
    : Math.max(0, Math.min(100, window.score));
  const verdictScore = score ?? 0;
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

  // Wave frequency — pass the peak-wave-height hour in the window so the
  // calculator's height view matches the waveHeight we render on the card
  // (window.waveHeight is the peak across the window, not hour 0). Without
  // this, a window that peaks at 3ft mid-way through could be gated against
  // hour 0's 1.9ft forecast and score 0 waves/hr under an "EPIC" badge.
  const freqForecast = effectiveForecasts.reduce<EnhancedForecastEntity | null>(
    (best, f) => {
      const fMax = parseMaxWaveHeight(f.wave_height);
      if (fMax == null) return best;
      if (best == null) return f;
      const bestMax = parseMaxWaveHeight(best.wave_height) ?? 0;
      return fMax > bestMax ? f : best;
    },
    null,
  ) ?? effectiveForecasts[0] ?? null;
  const freqResult = freqForecast ? calculateRideableWaves(freqForecast, beach) : null;

  // Compute composite + character via the new domain engine using the
  // window's representative forecast (closest to peakTime). This is what
  // PR 3 wires up so the native verdict path consumes the unified engine.
  const representativeForecast = pickRepresentativeForecast(
    windowForecasts,
    forecasts,
    window.peakTime instanceof Date ? window.peakTime : undefined
  );
  const callTimezone = resolveBeachTimezone(options.timezone ?? window.timezone ?? beach.timezone);
  const compositeResult = computeCompositeAndCharacter(beach, representativeForecast, forecasts, callTimezone);
  const character = compositeResult?.character ?? null;
  const cautions = extractSetupCautions(compositeResult?.composite.warnings);
  // The scorer reads a missing wave height as 0 ft, a flat skip nobody measured.
  const skipCause: SkipCause | null =
    compositeResult?.skipCause?.kind === 'flat' && parseMaxWaveHeight(representativeForecast?.wave_height ?? null) === null
      ? { kind: 'other' }
      : compositeResult?.skipCause ?? null;

  // Short window gate - reject if too short. Verdict is NO → suppress the
  // "Best window" so the UI doesn't contradict itself.
  // A stamped verdict other than NO already passed the decision engine's
  // duration gate, so this sentence would contradict it.
  const stampedPastDurationGate = options.verdict != null && options.verdict !== 'NO';
  if (windowMinutes < MINIMUM_VIABLE_WINDOW_MINUTES && !stampedPastDurationGate) {
    return {
      ...baseResult,
      bestWindowStart: null,
      bestWindowEnd: null,
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
      whySentence: 'It only lines up for a few minutes. Not worth the drive.',
      rideableWavesPerHour: freqResult?.rideableWavesPerHour ?? null,
      dominantBeatIntervalS: freqResult?.dominantBeatIntervalS ?? null,
      character,
      cautions,
    };
  }

  // Determine verdict based on score, window duration, confidence, and
  // character (PR 4 character-gate prevents high-score windy days from
  // promoting to YES).
  let verdict = determineVerdict(verdictScore, windowMinutes, forecastConfidence, character);

  // Soft gate override: when waves are below the break's minimum but the score
  // (which includes user preference adjustments and swell quality boost) says
  // conditions are surfable, allow MAYBE instead of forcing NO.
  // Cap at MAYBE — never promote to YES for below-minimum waves.
  // Note: this intentionally overrides confidence-gate downgrades — when the
  // small-wave gate is the dominant signal, we trust the score threshold directly.
  if (wavesBelowMin || windowWavesBelowMin) {
    if (verdictScore >= SCORE_MAYBE_THRESHOLD) {
      verdict = 'MAYBE';
    } else {
      verdict = 'NO';
    }
  }

  if (cautions.length > 0) {
    verdict = 'NO';
  }

  if (options.verdict) {
    verdict = options.verdict;
  }

  // Build explanation — override for small-wave MAYBE to explain the nuance
  const smallWaveOverride = (wavesBelowMin || windowWavesBelowMin) && verdict === 'MAYBE'
    ? `Small for this break but conditions look fun — ${waveHeight ?? 'modest swell'} with ${wind.type === 'glassy' || wind.type === 'offshore' ? 'clean winds' : 'manageable wind'}.`
    : undefined;
  const setupRiskOverride = cautions.length > 0
    ? `${cautions[0]}.`
    : undefined;
  // "Conditions look fun" can't stand beside a tide that holds the call down.
  const tideLimiter = compositeResult?.tideLimiter ?? null;
  const smallWaveTideOverride = smallWaveOverride && tideLimiter
    ? tideLimitSentence('Small for this break', tideLimiter)
    : undefined;
  // A skip's own cause outranks "conditions look fun" for small waves.
  const baseWhySentence = buildWhySentence(
    verdict,
    wind,
    waveHeight,
    tide,
    shortWindow,
    setupRiskOverride ?? (skipCause ? undefined : smallWaveTideOverride ?? smallWaveOverride),
    skipCause,
    tideLimiter,
  );
  // A call the tide doesn't limit can still sit beside a stretch it does.
  const tideHandoff = isTideSwingEnabled() && verdict !== 'NO' && !setupRiskOverride && !skipCause && !tideLimiter
    ? safeTideHandoff(beach, window, forecasts, callTimezone)
    : null;
  const whySentence = tideHandoff ? withTideHandoff(baseWhySentence, tideHandoff) : baseWhySentence;
  const peakTime = window.peakTime instanceof Date && !isNaN(window.peakTime.getTime())
    ? window.peakTime.toISOString()
    : null;

  // Verdict-gate the "Best window":
  //  YES   → wide window (unchanged)
  //  MAYBE → narrow to peakTime ± 1h, clamped to the original window
  //  NO    → suppress (null) so the UI hides the row
  const rawStart = new Date(window.start);
  const rawEnd = new Date(window.end);
  let bestWindowStartOut: string | null;
  let bestWindowEndOut: string | null;
  if (verdict === 'NO') {
    bestWindowStartOut = null;
    bestWindowEndOut = null;
  } else if (
    verdict === 'MAYBE' &&
    window.peakTime instanceof Date &&
    !isNaN(window.peakTime.getTime())
  ) {
    const narrow = narrowWindowAroundPeak(window.peakTime, rawStart, rawEnd);
    bestWindowStartOut = narrow.start.toISOString();
    bestWindowEndOut = narrow.end.toISOString();
  } else {
    bestWindowStartOut = rawStart.toISOString();
    bestWindowEndOut = rawEnd.toISOString();
  }

  return {
    verdict,
    bestWindowStart: bestWindowStartOut,
    bestWindowEnd: bestWindowEndOut,
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
    rideableWavesPerHour: freqResult?.rideableWavesPerHour ?? null,
    dominantBeatIntervalS: freqResult?.dominantBeatIntervalS ?? null,
    character: reconcileCharacterWithWind(character, wind, beach),
    cautions,
  };
}

// ============================================================================
// Per-Skill Tier Verdicts
// ============================================================================

/**
 * A per-skill verdict slice. Same shape repeated for beginner / intermediate /
 * advanced so the UI can render a 3-stamp ladder. The `trail` is the secondary
 * caption beneath the verdict word ("TRY AT 4:00 PM" / "BEST AT 8:00 AM" /
 * "WORTH A SURF" / "WAIT FOR SWELL" / "TOO BIG" / "TOO SMALL").
 */
export interface TierVerdict {
  verdict: SurfCallVerdict;
  trail: string;
  bestWindowStart: string | null;
  bestWindowEnd: string | null;
}

export interface SurfCallTiers {
  beginner: TierVerdict;
  intermediate: TierVerdict;
  advanced: TierVerdict;
}

function formatWindowShort(iso: string | null, timeZone: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone });
}

function buildTrail(
  verdict: SurfCallVerdict,
  windowStart: string | null,
  timeZone: string,
  override?: string,
): string {
  if (override) return override;
  const t = formatWindowShort(windowStart, timeZone);
  if (verdict === 'YES') return t ? `BEST AT ${t}` : 'WORTH A SURF';
  if (verdict === 'MAYBE') return t ? `TRY AT ${t}` : 'KEEP WATCHING';
  return 'WAIT FOR SWELL';
}

/**
 * Compute three per-skill verdicts (BEGINNER / INTERMEDIATE / ADVANCED) for the
 * same forecast. The intermediate verdict mirrors the existing `computeSurfCall`
 * output exactly. Beginner and advanced apply post-call heuristic adjustments
 * keyed off the wave-height range from `SKILL_WAVE_RANGES`:
 *
 * - Beginner: capped to NO when waves exceed `acceptable.max` (4 ft); promoted
 *   from MAYBE to YES when waves sit in the `ideal` band (1–3 ft) AND wind
 *   is light (≤10 mph) or offshore/glassy. A baseline NO stays NO.
 * - Advanced: downgraded to NO when waves fall below `acceptable.min` (2 ft);
 *   promoted to YES when waves exceed 8 ft AND the baseline verdict is at
 *   least MAYBE.
 *
 * The wrapper does not re-run the full domain engine — it derives tier
 * verdicts from a single `computeSurfCall` baseline + cheap wave/wind
 * heuristics. That keeps the action's per-page cost flat (one engine call,
 * not three) while still surfacing the skill-tier nuance the UI needs.
 */
export function computeSurfCallTiers(
  window: PersonalizedForecastWindow | null,
  forecasts: EnhancedForecastEntity[],
  beach: Beach,
  options: SurfCallOptions = {},
): SurfCallTiers {
  const baseline = computeSurfCall(window, forecasts, beach, options);
  const timeZone = resolveBeachTimezone(options.timezone ?? window?.timezone ?? beach.timezone);
  const intermediate: TierVerdict = {
    verdict: baseline.verdict,
    trail: buildTrail(baseline.verdict, baseline.bestWindowStart, timeZone),
    bestWindowStart: baseline.bestWindowStart,
    bestWindowEnd: baseline.bestWindowEnd,
  };

  const maxWave = parseMaxWaveHeight(baseline.waveHeight);
  const wind = baseline.windType; // 'glassy' | 'offshore' | 'cross-shore' | 'onshore' | null
  const windSpeedNum = baseline.windSpeed
    ? Number(baseline.windSpeed.replace(/[^\d.]/g, ''))
    : null;
  const lightWind =
    wind === 'glassy' || wind === 'offshore' || (windSpeedNum != null && windSpeedNum <= 10);

  const beginnerRange = SKILL_WAVE_RANGES.beginner;
  const advancedRange = SKILL_WAVE_RANGES.advanced;

  // ── Beginner derivation ─────────────────────────────────────────────────
  let beginnerVerdict: SurfCallVerdict = baseline.verdict;
  let beginnerTrailOverride: string | undefined;
  let beginnerStart = baseline.bestWindowStart;
  let beginnerEnd = baseline.bestWindowEnd;

  if (maxWave != null && maxWave > beginnerRange.acceptable.max) {
    beginnerVerdict = 'NO';
    beginnerTrailOverride = 'TOO BIG';
    beginnerStart = null;
    beginnerEnd = null;
  } else if (
    maxWave != null &&
    maxWave >= beginnerRange.ideal.min &&
    maxWave <= beginnerRange.ideal.max &&
    lightWind
  ) {
    // A baseline NO has no viable bounds; size/wind alone cannot restore a window.
    if (baseline.verdict === 'MAYBE') beginnerVerdict = 'YES';
  }

  const beginner: TierVerdict = {
    verdict: beginnerVerdict,
    trail: buildTrail(beginnerVerdict, beginnerStart, timeZone, beginnerTrailOverride),
    bestWindowStart: beginnerStart,
    bestWindowEnd: beginnerEnd,
  };

  // ── Advanced derivation ─────────────────────────────────────────────────
  let advancedVerdict: SurfCallVerdict = baseline.verdict;
  let advancedTrailOverride: string | undefined;
  let advancedStart = baseline.bestWindowStart;
  let advancedEnd = baseline.bestWindowEnd;

  if (maxWave != null && maxWave < advancedRange.acceptable.min) {
    advancedVerdict = 'NO';
    advancedTrailOverride = 'TOO SMALL';
    advancedStart = null;
    advancedEnd = null;
  } else if (maxWave != null && maxWave > advancedRange.ideal.max && baseline.verdict !== 'NO') {
    // Big waves, baseline already at least MAYBE → upgrade to YES for advanced
    advancedVerdict = 'YES';
  }

  const advanced: TierVerdict = {
    verdict: advancedVerdict,
    trail: buildTrail(advancedVerdict, advancedStart, timeZone, advancedTrailOverride),
    bestWindowStart: advancedStart,
    bestWindowEnd: advancedEnd,
  };

  return { beginner, intermediate, advanced };
}
