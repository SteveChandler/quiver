/**
 * Wind Quality Scorer
 *
 * Scores wind conditions based on direction and speed.
 * Offshore > Cross-shore > Onshore
 *
 * Weight: 0.15 (15% of total score)
 *
 * Key behaviors:
 * - Glassy (< 3 mph): Perfect score
 * - Offshore wind: Excellent score, slight degradation at higher speeds
 * - Cross-shore: Moderate score
 * - Onshore: Poor score, can trigger skip at high speeds
 */

import type { ScorerPlugin, ScorerInput, ScorerResult } from '../types';
import { SCORER_WEIGHTS, createSkipResult } from '../types';
import { angleDifference } from '../../shared';

/**
 * Wind quality scoring thresholds.
 */
const WIND_THRESHOLDS = {
  /** Wind speed considered glassy */
  glassyMph: 3,
  /** Cross-shore extends this many degrees beyond offshore tolerance */
  crossShoreExtensionDeg: 60,
};

/**
 * Wind quality scorer plugin.
 *
 * Ported from existing surf-conditions-scorer.ts with improvements:
 * - Uses SpotProfile wind thresholds
 * - More granular scoring for different wind types
 * - Clear skip conditions for dangerous wind
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

    // Score based on wind type
    if (isOffshore) {
      return scoreOffshoreWind(windSpeed);
    } else if (isCrossShore) {
      return scoreCrossShoreWind(windSpeed);
    } else {
      return scoreOnshoreWind(windSpeed, windThresholds.maxOnshoreMph);
    }
  },
};

/**
 * Score offshore wind (best conditions).
 */
function scoreOffshoreWind(speed: number): ScorerResult {
  // Offshore is excellent, but degrades slightly with higher speeds
  const speedFactor = Math.max(0.7, 1 - (speed - WIND_THRESHOLDS.glassyMph) / 30);
  const score = Math.round(100 * speedFactor);

  return {
    name: 'windQuality',
    score,
    weight: SCORER_WEIGHTS.windQuality,
    reasons: ['Offshore wind'],
    warnings: speed > 12 ? ['Offshore wind a bit strong'] : [],
    skip: false,
    skipReason: null,
  };
}

/**
 * Score cross-shore wind (moderate conditions).
 */
function scoreCrossShoreWind(speed: number): ScorerResult {
  // Cross-shore is OK, but degrades more quickly with speed
  const speedFactor = Math.max(0.5, 1 - (speed - WIND_THRESHOLDS.glassyMph) / 20);
  const score = Math.round(70 * speedFactor);

  const warnings: string[] = [];
  if (speed > 10) {
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
 */
function scoreOnshoreWind(speed: number, maxOnshore: number): ScorerResult {
  // Onshore is poor - linear degradation
  const speedRatio = speed / maxOnshore;
  const score = Math.round(Math.max(20, 50 * (1 - speedRatio)));

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
