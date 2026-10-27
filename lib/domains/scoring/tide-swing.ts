/**
 * Tide swing assessment: how fast the tide is moving, as felt by this break,
 * and what that means for the next hour. Pure; callers own the flag check.
 *
 * Tide alone never takes a call below FAIR: every ceiling here is >= 55.
 */

import type { ConditionsSnapshot } from '../conditions/types';
import type { SpotProfile, TidePreferences } from '../spot-profile/types';
import type { ScoringDecisionEffect } from './types';
import {
  TIDE_SWING_COPY,
  TIDE_WITHIN_THE_HOUR,
  tideBackInRangeCopy,
  tideLeavesRangeCopy,
} from './tide-copy';

/** Band edges are approximate; ignore the first quarter foot outside them. */
export const TIDE_BAND_TOLERANCE_FT = 0.25;

/** Effect codes a tide sets: the band ceiling (tide-fit scorer) and the rate effect (below). */
export const TIDE_EFFECT_CODES: ReadonlySet<string> = new Set(['tide_outside_band', 'tide_swing']);

/** No tide-only ceiling may push a call below FAIR. */
export const TIDE_ONLY_CEILING_FLOOR = 55;

/** Wider than this is the "any tide" default, not a curated band. */
const NO_PREFERENCE_BAND_WIDTH_FT = 10;

const FAST_RATE_FT_PER_HOUR = 1.0;
const MODERATE_RATE_FT_PER_HOUR = 0.6;
/** Filling a reef or point needs a steady push, not a fast one. */
const FILL_IN_RATE_FT_PER_HOUR = 0.6;
const SLACK_RATE_FT_PER_HOUR = 0.2;
const SOON_HOURS = 1;

const WALLING_MIN_WAVE_FT = 3;
const WALLING_MIN_PERIOD_S = 10;
const REEF_DRAIN_ZONE_FT = 1;
/** Walling is a low-tide effect: the sandbar needs to be shallow. */
const WALLING_ZONE_ABOVE_BAND_MIN_FT = 0.5;
const UNBANDED_WALLING_MAX_FT = 2.0;
const UNBANDED_SLACK_HIGH_FT = 6.0;
/** Under this, the band tier (79) already says enough; slack high only warns. */
const SLACK_HIGH_CAP_EXCESS_FT = 1.0;

const WALLING_CEILING = 69;
const REEF_DRAIN_CEILING = 79;
const SLACK_HIGH_CEILING = 69;

type TideBreakClass = 'beach' | 'reef' | 'point' | 'jetty' | 'unknown';

/** How strongly a break reacts to the same water movement. */
const TIDE_BREAK_MULTIPLIER: Record<TideBreakClass, number> = {
  beach: 1.0,
  reef: 1.2,
  point: 0.7,
  jetty: 0.9,
  unknown: 1.0,
};

const SENSITIVITY_MULTIPLIER: Record<TidePreferences['directionSensitivity'], number> = {
  low: 0.7,
  medium: 1.0,
  high: 1.3,
};

export type TideRateClass = 'fast' | 'moderate' | 'gentle' | 'slack' | 'unknown';

export interface TideBand {
  readonly minFt: number;
  readonly maxFt: number;
}

export interface TideSwingAssessment {
  /** Feet outside the band (0 inside, or when the beach has no band). */
  readonly excessFt: number;
  readonly side: 'high' | 'low' | null;
  /** Hours until the tide is back inside the band at the current rate. */
  readonly hoursToReenter: number | null;
  /** Hours until an in-band tide leaves the band at the current rate. */
  readonly hoursToExit: number | null;
  /** Classified on the raw rate: how much water is moving. */
  readonly rateClass: TideRateClass;
  /** Signed rate x break multiplier x direction sensitivity; the "fast" effects compare this to 1 ft/h. */
  /** Signed rate x break multiplier (x curated sensitivity when the beach sets one). */
  readonly effectiveRateFtPerHour: number | null;
  /** Set when the tide re-enters the band within the hour. */
  readonly reentryMessage: string | null;
  readonly effects: ScoringDecisionEffect[];
  readonly reasons: string[];
  readonly warnings: string[];
}

export function classifyTideBreak(breakType: string | null | undefined): TideBreakClass {
  const normalized = breakType?.toLowerCase().trim() ?? '';
  if (!normalized) return 'unknown';
  if (normalized.includes('reef')) return 'reef';
  if (normalized.includes('point')) return 'point';
  if (normalized.includes('jetty') || normalized.includes('breakwater')) return 'jetty';
  // Piers sit on beach-break sandbars.
  if (normalized.includes('beach') || normalized.includes('pier')) return 'beach';
  return 'unknown';
}

/** A curated band, or null for the default "any tide" range. */
export function resolveTideBand(
  prefs: Pick<TidePreferences, 'minHeightFt' | 'maxHeightFt' | 'explicitRange'>,
): TideBand | null {
  if (!prefs.explicitRange) return null;
  if (prefs.maxHeightFt - prefs.minHeightFt >= NO_PREFERENCE_BAND_WIDTH_FT) return null;
  return { minFt: prefs.minHeightFt, maxFt: prefs.maxHeightFt };
}

export function classifyTideRate(rateFtPerHour: number | null): TideRateClass {
  if (rateFtPerHour === null) return 'unknown';
  const speed = Math.abs(rateFtPerHour);
  if (speed >= FAST_RATE_FT_PER_HOUR) return 'fast';
  if (speed >= MODERATE_RATE_FT_PER_HOUR) return 'moderate';
  if (speed < SLACK_RATE_FT_PER_HOUR) return 'slack';
  return 'gentle';
}

/** One tier softer for a tide that is back in range within the hour; 79 is already the softest. */
export function softenTideBandCeiling(ceiling: number): number {
  if (ceiling <= 55) return 69;
  if (ceiling <= 69) return 79;
  return ceiling;
}

/** "by ~1 PM" in the beach's timezone, rounded up to the half hour. */
export function formatTideWhen(from: Date, hoursAhead: number, timezone: string | null | undefined): string {
  const fromMs = from.getTime();
  if (!timezone || !Number.isFinite(fromMs) || !Number.isFinite(hoursAhead)) return TIDE_WITHIN_THE_HOUR;
  const halfHourMs = 30 * 60 * 1000;
  const targetMs = Math.ceil((fromMs + hoursAhead * 3_600_000) / halfHourMs) * halfHourMs;
  try {
    const clock = new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      timeZone: timezone,
    }).format(new Date(targetMs));
    return `by ~${clock.replace(':00', '')}`;
  } catch {
    // An unknown IANA zone throws RangeError; the relative phrase is still true.
    return TIDE_WITHIN_THE_HOUR;
  }
}

/** Mirrors spot-profile's break-type fallback for tide_direction_sensitivity. */
function sensitivityFromBreakType(breakType: string | null | undefined): TidePreferences['directionSensitivity'] {
  const normalized = breakType?.toLowerCase().trim() ?? '';
  if (normalized.includes('reef')) return 'high';
  if (normalized.includes('point')) return 'low';
  return 'medium';
}

/**
 * The profile doesn't say whether sensitivity was curated or derived from the
 * break type. A value equal to the break-type default adds nothing the break
 * multiplier doesn't already say, so only a differing (curated) value scales.
 */
function curatedSensitivityMultiplier(
  sensitivity: TidePreferences['directionSensitivity'],
  breakType: string | null | undefined,
): number {
  if (sensitivity === sensitivityFromBreakType(breakType)) return 1;
  return SENSITIVITY_MULTIPLIER[sensitivity];
}

function finiteOrNull(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function tideSwingEffect(ceiling: number, message: string): ScoringDecisionEffect {
  return {
    code: 'tide_swing',
    severity: 'material',
    verdictCeiling: Math.max(TIDE_ONLY_CEILING_FLOOR, ceiling),
    message,
  };
}

const EMPTY_ASSESSMENT: TideSwingAssessment = {
  excessFt: 0,
  side: null,
  hoursToReenter: null,
  hoursToExit: null,
  rateClass: 'unknown',
  effectiveRateFtPerHour: null,
  reentryMessage: null,
  effects: [],
  reasons: [],
  warnings: [],
};

export function assessTideSwing(
  snapshot: Pick<ConditionsSnapshot, 'tide' | 'waveHeight' | 'wavePeriod' | 'timestamp'>,
  profile: Pick<SpotProfile, 'tidePreferences' | 'breakType' | 'timezone'>,
): TideSwingAssessment {
  const { tide } = snapshot;
  if (tide.heightKnown === false || !Number.isFinite(tide.heightFt)) return { ...EMPTY_ASSESSMENT };

  const heightFt = tide.heightFt;
  const band = resolveTideBand(profile.tidePreferences);
  const side: 'high' | 'low' | null = band
    ? heightFt > band.maxFt ? 'high' : heightFt < band.minFt ? 'low' : null
    : null;
  const excessFt = band && side ? (side === 'high' ? heightFt - band.maxFt : band.minFt - heightFt) : 0;

  const rate = finiteOrNull(tide.rateFtPerHour);
  // Rate-less rows (most 3-hourly rows until the bridge lands) score exactly as today.
  if (rate === null) return { ...EMPTY_ASSESSMENT, excessFt, side };

  const breakClass = classifyTideBreak(profile.breakType);
  const effectiveRate = rate
    * TIDE_BREAK_MULTIPLIER[breakClass]
    * curatedSensitivityMultiplier(profile.tidePreferences.directionSensitivity, profile.breakType);
  const rateClass = classifyTideRate(rate);
  // A more sensitive break feels a slower tide as fast.
  const fastFall = effectiveRate <= -FAST_RATE_FT_PER_HOUR;
  const fillingRise = effectiveRate >= FILL_IN_RATE_FT_PER_HOUR;
  const speed = Math.abs(rate);

  const towardBand = (side === 'high' && rate < 0) || (side === 'low' && rate > 0);
  const hoursToReenter = side && towardBand && speed > 0 ? excessFt / speed : null;
  const hoursToExit = band && !side && speed > 0
    ? (rate < 0 ? heightFt - band.minFt : band.maxFt - heightFt) / speed
    : null;

  const effects: ScoringDecisionEffect[] = [];
  const reasons: string[] = [];
  const warnings: string[] = [];

  const reentrySoon = hoursToReenter !== null && hoursToReenter <= SOON_HOURS;
  const reentryMessage = reentrySoon
    ? tideBackInRangeCopy(formatTideWhen(snapshot.timestamp, hoursToReenter, profile.timezone))
    : null;
  if (hoursToExit !== null && hoursToExit <= SOON_HOURS) {
    warnings.push(tideLeavesRangeCopy(formatTideWhen(snapshot.timestamp, hoursToExit, profile.timezone)));
  }

  const shallowEnoughToWall = band
    ? heightFt - band.minFt <= WALLING_ZONE_ABOVE_BAND_MIN_FT
    : heightFt <= UNBANDED_WALLING_MAX_FT;
  if (
    fastFall
    && breakClass === 'beach'
    && shallowEnoughToWall
    && snapshot.waveHeight >= WALLING_MIN_WAVE_FT
    && snapshot.wavePeriod >= WALLING_MIN_PERIOD_S
  ) {
    effects.push(tideSwingEffect(WALLING_CEILING, TIDE_SWING_COPY.wallsUpDraining));
  }

  if (band) {
    if (
      fastFall
      && breakClass === 'reef'
      && heightFt >= band.minFt
      && heightFt - band.minFt <= REEF_DRAIN_ZONE_FT
    ) {
      effects.push(tideSwingEffect(REEF_DRAIN_CEILING, TIDE_SWING_COPY.reefTurningOff));
    }

    const fillingFromBelow = side === 'low' ? reentrySoon : !side && heightFt - band.minFt <= REEF_DRAIN_ZONE_FT;
    if (fillingRise && (breakClass === 'reef' || breakClass === 'point') && fillingFromBelow) {
      reasons.push(TIDE_SWING_COPY.fillingIn);
    }

    if (rateClass === 'slack' && heightFt > band.maxFt + TIDE_BAND_TOLERANCE_FT) {
      if (heightFt - band.maxFt >= SLACK_HIGH_CAP_EXCESS_FT) {
        effects.push(tideSwingEffect(SLACK_HIGH_CEILING, TIDE_SWING_COPY.slackHighWater));
      } else {
        warnings.push(TIDE_SWING_COPY.slackHighWater);
      }
    }
  } else if (rateClass === 'slack' && heightFt >= UNBANDED_SLACK_HIGH_FT) {
    warnings.push(TIDE_SWING_COPY.slackHighWater);
  }

  return {
    excessFt,
    side,
    hoursToReenter,
    hoursToExit,
    rateClass,
    effectiveRateFtPerHour: effectiveRate,
    reentryMessage,
    effects,
    reasons,
    warnings,
  };
}
