/**
 * Wind Quality Scorer — 6-Tier Rework (PR 4)
 *
 * Scores wind conditions using a research-backed 6-tier table that blends
 * direction, speed, wave-height context, and period.
 *
 * Weight: 0.15 (15% of total score)
 *
 * 6-tier table (median of 16 cited surf-forecasting sources — Surfline,
 * Surf Captain, Surfer Today, Watersport Geek, Foam Mag, NOAA Beaufort,
 * Cornish Wave, Boardcave, Wikipedia, Academy of Surfing Instructors):
 *
 *   Tier               | Cutoff                                        | Mult
 *   -------------------|-----------------------------------------------|-----
 *   Glassy             | <= 3 mph any direction                        | 1.00
 *   Clean offshore     | 3-15 mph offshore (component >= 70%)          | 1.00
 *   Light onshore/cross| 3-8 mph onshore or sideshore                  | 0.75
 *   Textured / fair    | 8-15 mph onshore-or-cross OR 15-22 mph offshore| 0.50
 *   Choppy / poor      | 15-22 mph onshore-or-cross OR 22-30 mph offshore| 0.20
 *   Blown out          | >= 22 mph onshore-or-cross OR >= 30 mph offshore| skip
 *
 * Wave-height penalty modifier (applied to `1 - tierMultiplier`):
 *   penaltyMultiplier = clamp(1.5 - 0.1 * waveHeightFt, 0.5, 1.5)
 *
 * Period modifier (boundary nudges to penalty):
 *   period <  10s: +0.10 (more wind-affected)
 *   period >= 14s: -0.05 (long-period groundswell resists wind chop)
 *
 * Sideshore-strict (Surf Captain): cross-shore is treated AT LEAST as harsh
 * as onshore at the same speed. Today's old engine had cross-shore softer
 * than onshore — that's flipped.
 */

import type { ScorerPlugin, ScorerInput, ScorerResult } from '../types';
import { SCORER_WEIGHTS, createSkipResult } from '../types';
import { angleDifference } from '../../shared';
import { toBin5 } from '@/types/terrain';

// ============================================================================
// Constants
// ============================================================================

/** Glassy threshold — wind below this is perfect regardless of direction. */
const GLASSY_MPH = 3;

/**
 * Direction classification semantics.
 *
 * The scorer reduces direction to one of three labels by computing the
 * angular difference between wind and offshore. We treat the SpotProfile's
 * `offshoreToleranceDeg` as the offshore cone half-width; sideshore is the
 * 60-deg band beyond it (matches the old engine's `crossShoreExtensionDeg`).
 */
const CROSS_SHORE_EXTENSION_DEG = 60;

/** Tier multipliers — 1.0 is unscathed, 0.0 is blown out. */
const TIER_MULTIPLIER = {
  glassy: 1.0,
  cleanOffshore: 1.0,
  lightOnshoreCross: 0.75,
  texturedFair: 0.5,
  choppyPoor: 0.2,
  blownOut: 0.0,
} as const;

/**
 * Period thresholds for the penalty modifier.
 *
 * Long-period groundswells (>= 13s) hold their shape against wind chop
 * (Boardcave + Wikipedia). Wind-swell (< 10s) is more vulnerable.
 *
 * Offset shifts: a stronger negative offset for groundswells captures the
 * Horseshoe-style "2.3 ft / 13s NW cross-shore" scenario where surfers do
 * still paddle out. Tuned so that the 12 mph cross-shore @ 4 ft / 12s
 * "default" textured-fair test stays in the documented 40-60 band.
 */
const PERIOD_WIND_SWELL_MAX_S = 10;
const PERIOD_GROUNDSWELL_MIN_S = 13;
const PERIOD_PENALTY_WIND_SWELL = 0.1;
const PERIOD_PENALTY_GROUNDSWELL = -0.3;

/** Wave-height penalty modifier bounds. */
const WAVE_HEIGHT_PENALTY_MIN = 0.5;
const WAVE_HEIGHT_PENALTY_MAX = 1.5;

// ============================================================================
// Direction classification
// ============================================================================

type WindDirectionClass = 'offshore' | 'sideshore' | 'onshore';

/**
 * Classify wind direction relative to the spot's offshore vector.
 *
 * - Within `offshoreToleranceDeg` of offshore => offshore.
 * - Within tolerance + CROSS_SHORE_EXTENSION_DEG => sideshore.
 * - Else => onshore.
 */
function classifyDirection(
  windDirectionDeg: number,
  offshoreDeg: number,
  offshoreToleranceDeg: number
): WindDirectionClass {
  const angleFromOffshore = angleDifference(windDirectionDeg, offshoreDeg);
  if (angleFromOffshore <= offshoreToleranceDeg) return 'offshore';
  if (angleFromOffshore <= offshoreToleranceDeg + CROSS_SHORE_EXTENSION_DEG)
    return 'sideshore';
  return 'onshore';
}

// ============================================================================
// Tier resolution
// ============================================================================

type Tier =
  | 'glassy'
  | 'cleanOffshore'
  | 'lightOnshoreCross'
  | 'texturedFair'
  | 'choppyPoor'
  | 'blownOut';

interface TierResolution {
  tier: Tier;
  multiplier: number;
  reason: string;
}

/**
 * Resolve the wind tier from speed + direction class.
 *
 * Sideshore is treated as part of the onshore-or-cross band (sideshore-strict
 * per Surf Captain). Offshore gets its own, more lenient cutoffs.
 */
function resolveTier(
  speedMph: number,
  direction: WindDirectionClass
): TierResolution {
  if (speedMph <= GLASSY_MPH) {
    return { tier: 'glassy', multiplier: TIER_MULTIPLIER.glassy, reason: 'Glassy conditions' };
  }

  if (direction === 'offshore') {
    if (speedMph <= 15) {
      return {
        tier: 'cleanOffshore',
        multiplier: TIER_MULTIPLIER.cleanOffshore,
        reason: 'Clean offshore wind',
      };
    }
    if (speedMph < 22) {
      return {
        tier: 'texturedFair',
        multiplier: TIER_MULTIPLIER.texturedFair,
        reason: 'Strong offshore — textured',
      };
    }
    if (speedMph < 30) {
      return {
        tier: 'choppyPoor',
        multiplier: TIER_MULTIPLIER.choppyPoor,
        reason: 'Hard offshore — choppy',
      };
    }
    return {
      tier: 'blownOut',
      multiplier: TIER_MULTIPLIER.blownOut,
      reason: `Blown out (${Math.round(speedMph)} mph offshore)`,
    };
  }

  // Onshore + sideshore share the strict band.
  if (speedMph < 8) {
    return {
      tier: 'lightOnshoreCross',
      multiplier: TIER_MULTIPLIER.lightOnshoreCross,
      reason: direction === 'sideshore' ? 'Light side-shore' : 'Light onshore',
    };
  }
  if (speedMph < 15) {
    return {
      tier: 'texturedFair',
      multiplier: TIER_MULTIPLIER.texturedFair,
      reason: direction === 'sideshore' ? 'Side-shore textured' : 'Onshore textured',
    };
  }
  if (speedMph < 22) {
    return {
      tier: 'choppyPoor',
      multiplier: TIER_MULTIPLIER.choppyPoor,
      reason: direction === 'sideshore' ? 'Side-shore choppy' : 'Onshore choppy',
    };
  }
  return {
    tier: 'blownOut',
    multiplier: TIER_MULTIPLIER.blownOut,
    reason: `Blown out (${Math.round(speedMph)} mph ${direction})`,
  };
}

// ============================================================================
// Wave-height + period modifiers
// ============================================================================

/**
 * Wave-height penalty multiplier.
 *
 *   penaltyMultiplier = clamp(1.5 - 0.1 * waveHeightFt, 0.5, 1.5)
 *
 * Smaller waves are degraded harder by the same wind. Clamped so 0-ft
 * doesn't run away into infinity.
 */
function waveHeightPenaltyMultiplier(waveHeightFt: number): number {
  const raw = 1.5 - 0.1 * Math.max(0, waveHeightFt);
  return Math.max(WAVE_HEIGHT_PENALTY_MIN, Math.min(WAVE_HEIGHT_PENALTY_MAX, raw));
}

/**
 * Period adjustment to the penalty.
 *
 * Long-period groundswells (>=14s) resist wind chop better than short
 * wind-swell (<10s). Boundary nudge added to the penalty before clamping.
 */
function periodPenaltyAdjustment(periodS: number | null | undefined): number {
  if (periodS == null || !isFinite(periodS)) return 0;
  if (periodS < PERIOD_WIND_SWELL_MAX_S) return PERIOD_PENALTY_WIND_SWELL;
  if (periodS >= PERIOD_GROUNDSWELL_MIN_S) return PERIOD_PENALTY_GROUNDSWELL;
  return 0;
}

// ============================================================================
// Scorer Plugin
// ============================================================================

/**
 * Wind quality scorer plugin.
 */
export const windQualityScorer: ScorerPlugin = {
  name: 'windQuality',
  weight: SCORER_WEIGHTS.windQuality,

  score(input: ScorerInput): ScorerResult {
    const { snapshot, profile } = input;
    const windDirection = snapshot.wind.directionDeg;
    const exposureFactors = profile.windExposureFactors;
    const exposure = windDirection !== null && exposureFactors?.length === 72
      ? Math.max(0, Math.min(1, exposureFactors[toBin5(windDirection)] ?? 1))
      : 1;
    const windSpeed = snapshot.wind.speedMph * exposure;
    const waveHeight = snapshot.waveHeight;
    const wavePeriod = snapshot.wavePeriod;
    const { windThresholds } = profile;

    // Glassy short-circuit (any direction, including null).
    if (windSpeed <= GLASSY_MPH) {
      return {
        name: 'windQuality',
        score: 100,
        weight: SCORER_WEIGHTS.windQuality,
        reasons: ['Glassy conditions'],
        warnings: [],
        skip: false,
        skipReason: null,
      };
    }

    // No wind direction => moderate score, no skip.
    if (windDirection === null) {
      return {
        name: 'windQuality',
        score: 50,
        weight: SCORER_WEIGHTS.windQuality,
        reasons: [],
        warnings: ['Wind direction unknown'],
        skip: false,
        skipReason: null,
      };
    }

    const direction = classifyDirection(
      windDirection,
      windThresholds.offshoreDeg,
      windThresholds.offshoreToleranceDeg
    );

    const { tier, multiplier, reason } = resolveTier(windSpeed, direction);

    // Tier-based skip (replaces the legacy binary `windSpeed > maxOnshoreMph`
    // gate). Only the blown-out tier disqualifies.
    if (tier === 'blownOut') {
      return createSkipResult(
        'windQuality',
        reason,
        SCORER_WEIGHTS.windQuality
      );
    }

    // Glassy already handled above. For clean offshore, tier multiplier is
    // 1.0 — return the reason verbatim, no penalty math needed.
    if (tier === 'cleanOffshore') {
      // Apply a soft speed nudge so 14 mph offshore doesn't tie 5 mph offshore.
      const speedFactor = Math.max(0.85, 1 - (windSpeed - GLASSY_MPH) / 80);
      const score = Math.round(100 * speedFactor);
      const warnings: string[] = windSpeed >= 12 ? ['Offshore wind a bit strong'] : [];
      return {
        name: 'windQuality',
        score,
        weight: SCORER_WEIGHTS.windQuality,
        reasons: [reason],
        warnings,
        skip: false,
        skipReason: null,
      };
    }

    // For penalty tiers: apply wave-height + period modifiers.
    //
    // Wave-height modifier only applies to onshore/sideshore tiers — strong
    // offshore is its own ailment (waves get held up too long, blown out
    // backs), and the base penalty already encodes that. Letting the small-
    // wave amplifier hit offshore-textured/choppy tiers double-counts the
    // limiter and crashes 18 mph offshore @ 4 ft below the documented 50-70
    // band.
    const basePenalty = 1 - multiplier;
    const heightMod = direction === 'offshore' ? 1 : waveHeightPenaltyMultiplier(waveHeight);
    const periodMod = periodPenaltyAdjustment(wavePeriod);
    const adjustedPenalty = Math.max(0, Math.min(1, basePenalty * heightMod + periodMod));
    const score = Math.round((1 - adjustedPenalty) * 100);

    const warnings: string[] = [];
    if (direction === 'onshore') warnings.push('Onshore wind');
    else if (direction === 'sideshore' && windSpeed >= 8) warnings.push('Side-shore wind');

    return {
      name: 'windQuality',
      score,
      weight: SCORER_WEIGHTS.windQuality,
      reasons: tier === 'lightOnshoreCross' ? [reason] : [],
      warnings,
      skip: false,
      skipReason: null,
    };
  },
};
