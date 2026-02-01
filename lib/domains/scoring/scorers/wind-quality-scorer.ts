/**
 * Wind Quality Scorer
 *
 * Scores wind conditions based on direction and speed.
 * Offshore > Cross-shore > Onshore
 *
 * Weight: 0.15 (15% of total score)
 *
 * DOMAIN KNOWLEDGE:
 *
 * Break Type Wind Sensitivity (most to least tolerant):
 * 1. Point breaks: Often sheltered by headlands, handle cross-shore well
 * 2. Reef breaks: Deeper water structure reduces wind chop impact
 * 3. Beach breaks: Shallow, exposed, most sensitive to all wind types
 *
 * Wind Direction Priority (best to worst):
 * 1. Glassy (<3 mph): Perfect glass, no wind effect
 * 2. Offshore: Holds waves up, creates barrels
 * 3. Cross-shore: Rideable but choppy
 * 4. Onshore: Destroys wave face, creates closeouts
 *
 * Scoring Philosophy:
 * - Wind degrades scores via divisor (larger divisor = slower degradation)
 * - Break types adjust parameters to reflect real-world wind tolerance
 * - Offshore scoring: 70-100 range (excellent baseline)
 * - Cross-shore scoring: 35-75 range (moderate baseline)
 * - Onshore scoring: 20-55 range (poor baseline)
 */

import type { ScorerPlugin, ScorerInput, ScorerResult } from '../types';
import { SCORER_WEIGHTS, createSkipResult } from '../types';
import { angleDifference } from '../../shared';

// ============================================================================
// Constants
// ============================================================================

/**
 * Wind quality scoring thresholds.
 */
const WIND_THRESHOLDS = {
  /** Wind speed considered glassy */
  glassyMph: 3,
  /** Cross-shore extends this many degrees beyond offshore tolerance */
  crossShoreExtensionDeg: 60,
  /** Speed threshold for "offshore wind a bit strong" warning */
  offshoreStrongMph: 12,
  /** Speed threshold for "cross-shore wind picking up" warning */
  crossShorePickingUpMph: 10,
};

/**
 * Scoring parameters for different wind types.
 */
const WIND_SCORING = {
  /** Offshore wind parameters */
  offshore: {
    baseScore: 100,
    minSpeedFactor: 0.7,
  },
  /** Cross-shore wind parameters */
  crossShore: {
    baseScore: 70,
    minSpeedFactor: 0.5,
  },
  /** Onshore wind parameters */
  onshore: {
    baseScore: 50,
    minScore: 20,
  },
};

// ============================================================================
// Break Type Configuration
// ============================================================================

/**
 * Wind type categories for configuration lookup.
 */
type WindType = 'offshore' | 'crossShore' | 'onshore';

/**
 * Break type categories derived from break type string.
 */
type BreakTypeCategory = 'reef' | 'point' | 'beach' | 'default';

/**
 * Configuration for how a break type handles wind.
 */
interface BreakTypeWindConfig {
  /** Speed degradation divisor (larger = slower degradation) */
  divisor: number;
  /** Base score adjustment (added to wind type's base score) */
  baseScoreAdjustment: number;
  /** Speed ratio multiplier for onshore wind (affects degradation rate) */
  speedRatioMultiplier: number;
}

/**
 * Configuration matrix for break type wind sensitivity.
 *
 * Values are tuned based on real-world surf behavior:
 * - Reef breaks: Deeper water reduces chop, handles wind better
 * - Point breaks: Often sheltered by headlands, best wind tolerance
 * - Beach breaks: Shallow and exposed, most sensitive to wind
 */
const BREAK_TYPE_WIND_CONFIG: Record<WindType, Record<BreakTypeCategory, BreakTypeWindConfig>> = {
  offshore: {
    reef:    { divisor: 33, baseScoreAdjustment: 0, speedRatioMultiplier: 1.0 },
    point:   { divisor: 35, baseScoreAdjustment: 0, speedRatioMultiplier: 1.0 },
    beach:   { divisor: 28, baseScoreAdjustment: 0, speedRatioMultiplier: 1.0 },
    default: { divisor: 30, baseScoreAdjustment: 0, speedRatioMultiplier: 1.0 },
  },
  crossShore: {
    reef:    { divisor: 27, baseScoreAdjustment: 0, speedRatioMultiplier: 1.0 },
    point:   { divisor: 28, baseScoreAdjustment: 5, speedRatioMultiplier: 1.0 },
    beach:   { divisor: 22, baseScoreAdjustment: 0, speedRatioMultiplier: 1.0 },
    default: { divisor: 25, baseScoreAdjustment: 0, speedRatioMultiplier: 1.0 },
  },
  onshore: {
    reef:    { divisor: 0, baseScoreAdjustment: 5,  speedRatioMultiplier: 0.9  },
    point:   { divisor: 0, baseScoreAdjustment: 5,  speedRatioMultiplier: 0.85 },
    beach:   { divisor: 0, baseScoreAdjustment: -5, speedRatioMultiplier: 1.1  },
    default: { divisor: 0, baseScoreAdjustment: 0,  speedRatioMultiplier: 1.0  },
  },
};

/**
 * Categorize a break type string into a known category.
 *
 * Uses includes() to handle variations like "reef break", "point break", etc.
 */
function categorizeBreakType(breakType: string | null | undefined): BreakTypeCategory {
  const normalized = breakType?.toLowerCase() ?? '';

  if (normalized.includes('reef')) return 'reef';
  if (normalized.includes('point')) return 'point';
  if (normalized.includes('beach')) return 'beach';

  return 'default';
}

/**
 * Get wind configuration for a specific break type and wind direction.
 *
 * This is the single source of truth for how break types affect wind scoring.
 */
function getBreakTypeWindConfig(
  breakType: string | null | undefined,
  windType: WindType
): BreakTypeWindConfig {
  const category = categorizeBreakType(breakType);
  return BREAK_TYPE_WIND_CONFIG[windType][category];
}

// ============================================================================
// Scorer Plugin
// ============================================================================

/**
 * Wind quality scorer plugin.
 *
 * Evaluates wind conditions based on:
 * - Wind speed (lower is better)
 * - Wind direction relative to beach (offshore > cross > onshore)
 * - Break type sensitivity (reef/point handle wind better than beach)
 */
export const windQualityScorer: ScorerPlugin = {
  name: 'windQuality',
  weight: SCORER_WEIGHTS.windQuality,

  score(input: ScorerInput): ScorerResult {
    const { snapshot, profile } = input;
    const windSpeed = snapshot.wind.speedMph;
    const windDirection = snapshot.wind.directionDeg;
    const { windThresholds } = profile;

    // Check skip conditions first
    if (windSpeed > windThresholds.maxAnyMph) {
      return createSkipResult(
        'windQuality',
        `Too windy (${Math.round(windSpeed)} mph)`,
        SCORER_WEIGHTS.windQuality
      );
    }

    // Glassy conditions - perfect
    if (windSpeed <= WIND_THRESHOLDS.glassyMph) {
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

    // No wind direction data - assume moderate score
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

    // Determine wind type
    const angleFromOffshore = angleDifference(windDirection, windThresholds.offshoreDeg);
    const tolerance = windThresholds.offshoreToleranceDeg;

    const isOffshore = angleFromOffshore <= tolerance;
    const isCrossShore = angleFromOffshore > tolerance && angleFromOffshore <= tolerance + WIND_THRESHOLDS.crossShoreExtensionDeg;
    const isOnshore = !isOffshore && !isCrossShore;

    // Check onshore wind skip condition
    if (isOnshore && windSpeed > windThresholds.maxOnshoreMph) {
      return createSkipResult(
        'windQuality',
        `Strong onshore wind (${Math.round(windSpeed)} mph)`,
        SCORER_WEIGHTS.windQuality
      );
    }

    // Score based on wind type with break-type adjustments
    const breakType = profile.breakType;
    if (isOffshore) {
      return scoreOffshoreWind(windSpeed, breakType);
    } else if (isCrossShore) {
      return scoreCrossShoreWind(windSpeed, breakType);
    } else {
      return scoreOnshoreWind(windSpeed, windThresholds.maxOnshoreMph, breakType);
    }
  },
};

// ============================================================================
// Wind Type Scoring Functions
// ============================================================================

/**
 * Score offshore wind (best conditions).
 *
 * Offshore wind holds up wave faces and creates better barrels.
 * Score degrades gradually with increasing speed.
 */
function scoreOffshoreWind(speed: number, breakType?: string | null): ScorerResult {
  const config = getBreakTypeWindConfig(breakType, 'offshore');
  const { baseScore, minSpeedFactor } = WIND_SCORING.offshore;

  // Offshore is excellent, but degrades slightly with higher speeds
  const speedFactor = Math.max(
    minSpeedFactor,
    1 - (speed - WIND_THRESHOLDS.glassyMph) / config.divisor
  );
  const score = Math.round((baseScore + config.baseScoreAdjustment) * speedFactor);

  return {
    name: 'windQuality',
    score,
    weight: SCORER_WEIGHTS.windQuality,
    reasons: ['Offshore wind'],
    warnings: speed > WIND_THRESHOLDS.offshoreStrongMph ? ['Offshore wind a bit strong'] : [],
    skip: false,
    skipReason: null,
  };
}

/**
 * Score cross-shore wind (moderate conditions).
 *
 * Cross-shore wind creates chop but waves remain rideable.
 * Score degrades more quickly than offshore.
 */
function scoreCrossShoreWind(speed: number, breakType?: string | null): ScorerResult {
  const config = getBreakTypeWindConfig(breakType, 'crossShore');
  const { baseScore, minSpeedFactor } = WIND_SCORING.crossShore;

  // Cross-shore is OK, but degrades with speed
  const speedFactor = Math.max(
    minSpeedFactor,
    1 - (speed - WIND_THRESHOLDS.glassyMph) / config.divisor
  );
  const score = Math.round((baseScore + config.baseScoreAdjustment) * speedFactor);

  const warnings: string[] = [];
  if (speed > WIND_THRESHOLDS.crossShorePickingUpMph) {
    warnings.push('Cross-shore wind picking up');
  }

  return {
    name: 'windQuality',
    score,
    weight: SCORER_WEIGHTS.windQuality,
    reasons: [],
    warnings,
    skip: false,
    skipReason: null,
  };
}

/**
 * Score onshore wind (poor conditions).
 *
 * Onshore wind destroys wave faces and creates closeouts.
 * Uses linear degradation based on speed ratio to max allowed.
 */
function scoreOnshoreWind(speed: number, maxOnshore: number, breakType?: string | null): ScorerResult {
  const config = getBreakTypeWindConfig(breakType, 'onshore');
  const { baseScore, minScore } = WIND_SCORING.onshore;

  // Onshore is poor - linear degradation based on speed ratio
  const adjustedBaseScore = baseScore + config.baseScoreAdjustment;
  const speedRatio = (speed / maxOnshore) * config.speedRatioMultiplier;
  const score = Math.round(Math.max(minScore, adjustedBaseScore * (1 - speedRatio)));

  return {
    name: 'windQuality',
    score,
    weight: SCORER_WEIGHTS.windQuality,
    reasons: [],
    warnings: ['Onshore wind'],
    skip: false,
    skipReason: null,
  };
}
