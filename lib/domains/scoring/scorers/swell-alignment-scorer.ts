/**
 * Swell Alignment Scorer
 *
 * Scores how well the primary swell direction aligns with the beach's swell window.
 * This is about directionality - does the swell hit the beach at a good angle?
 *
 * Weight: 0.15 (15% of total score)
 *
 * Key behaviors:
 * - Perfect alignment with beach window center: 100
 * - Within swell window: 70-100
 * - Outside window but close: 40-70
 * - Far outside window: 20-40
 */

import type { ScorerPlugin, ScorerInput, ScorerResult } from '../types';
import { SCORER_WEIGHTS, createNeutralResult } from '../types';
import { angleDifference, directionName } from '../../shared';
import { getDirectionalRelevance } from './directional-relevance';
import { toBin5 } from '@/types/terrain';

/**
 * Geometric scores at or above this threshold are framed as positive
 * "reasons". Below it, even an aligned-on-paper swell becomes a warning
 * because the dominant period is too weak to organise into rideable waves.
 */
const RELEVANCE_REASON_THRESHOLD = 60;

/**
 * Alignment scoring thresholds.
 *
 * These define the zones for scoring swell direction alignment:
 * - Perfect zone: Very close to center (within 10% of half-width)
 * - Inner window: Within inner half of the swell window
 * - Outer window: Within outer half of the swell window
 * - Just outside: Within 30° of the window edge
 * - Far outside: More than 30° outside the window
 */
const ALIGNMENT_THRESHOLDS = {
  /** Fraction of half-width that counts as "perfect" alignment */
  perfectFraction: 0.1,
  /** Fraction of half-width that counts as "inner" window */
  innerFraction: 0.5,
  /** Degrees outside window still considered "close" */
  closeOutsideDeg: 30,
  /** Minimum score for any alignment (floor) */
  minScore: 20,
  /** Score degradation per degree when just outside window */
  outsideDecayPerDeg: 1,
  /** Score degradation divisor when far outside window */
  farOutsideDivisor: 2,
};

/**
 * Swell alignment scorer plugin.
 *
 * Evaluates primary swell direction against beach swell window.
 * Separate from interference scorer which handles multi-swell interactions.
 */
export const swellAlignmentScorer: ScorerPlugin = {
  name: 'swellAlignment',
  weight: SCORER_WEIGHTS.swellAlignment,

  score(input: ScorerInput): ScorerResult {
    const { snapshot, profile } = input;
    const { swellWindow } = profile;

    // Get swell direction - prefer primary swell, fall back to overall wave direction
    let swellDirection: number | null = null;

    if (snapshot.primarySwell) {
      swellDirection = snapshot.primarySwell.directionDeg;
    } else if (snapshot.waveDirection !== null) {
      swellDirection = snapshot.waveDirection;
    }

    // If no direction data, return neutral (don't penalize missing data)
    if (swellDirection === null) {
      return createNeutralResult('swellAlignment', SCORER_WEIGHTS.swellAlignment);
    }

    // Calculate the geometric alignment score first…
    const { score: geometricScore, description } = calculateAlignmentScore(swellDirection, swellWindow);

    // …then attenuate by how relevant geometry is for the dominant wave
    // train. A 6s W "ideal direction" is wind chop — geometry doesn't save
    // it from being unrideable, so don't let it lift the composite score.
    const periodS = snapshot.primarySwell?.periodS ?? null;
    const relevance = getDirectionalRelevance(periodS);
    const accessFactors = profile.swellAccessFactors;
    const access = accessFactors?.length === 72
      ? Math.max(0, Math.min(1, accessFactors[toBin5(swellDirection)] ?? 1))
      : 1;
    const score = Math.round(geometricScore * relevance * access);

    const reasons: string[] = [];
    const warnings: string[] = [];

    if (score >= RELEVANCE_REASON_THRESHOLD) {
      reasons.push(description);
    } else if (access < 0.7 && geometricScore >= RELEVANCE_REASON_THRESHOLD) {
      warnings.push(`${description} but local terrain limits swell access`);
    } else if (relevance < 1 && geometricScore >= RELEVANCE_REASON_THRESHOLD) {
      // Geometry was good but period dragged it below threshold — surface
      // the period as the reason rather than reporting "ideal direction"
      // alongside a low score.
      const periodLabel = periodS != null ? `${periodS.toFixed(1)}s` : 'short period';
      warnings.push(`${description} but short period (${periodLabel})`);
    } else if (score < 50) {
      warnings.push(description);
    }

    return {
      name: 'swellAlignment',
      score,
      weight: SCORER_WEIGHTS.swellAlignment,
      reasons,
      warnings,
      skip: false,
      skipReason: null,
    };
  },
};

/**
 * Calculate alignment score for a swell direction against the beach window.
 */
function calculateAlignmentScore(
  direction: number,
  window: { minDeg: number; maxDeg: number; centerDeg: number; halfWidthDeg: number }
): { score: number; description: string } {
  const { centerDeg, halfWidthDeg } = window;
  const { perfectFraction, innerFraction, closeOutsideDeg, minScore, outsideDecayPerDeg, farOutsideDivisor } = ALIGNMENT_THRESHOLDS;

  // Calculate angular difference from center
  const diff = angleDifference(direction, centerDeg);

  // Perfect alignment (within 10% of half-width from center)
  if (diff <= halfWidthDeg * perfectFraction) {
    return {
      score: 100,
      description: `Ideal swell direction (${directionName(direction)})`,
    };
  }

  // Within inner half of window (score: 85-100)
  if (diff <= halfWidthDeg * innerFraction) {
    const progress = diff / (halfWidthDeg * innerFraction);
    const score = Math.round(100 - progress * 15);
    return {
      score,
      description: `Good swell angle (${directionName(direction)})`,
    };
  }

  // Within outer half of window (score: 70-85)
  if (diff <= halfWidthDeg) {
    const progress = (diff - halfWidthDeg * innerFraction) / (halfWidthDeg * innerFraction);
    const score = Math.round(85 - progress * 15);
    return {
      score,
      description: `Acceptable swell angle (${directionName(direction)})`,
    };
  }

  // Just outside window (within closeOutsideDeg degrees) (score: 40-70)
  if (diff <= halfWidthDeg + closeOutsideDeg) {
    const excess = diff - halfWidthDeg;
    const score = Math.round(70 - excess * outsideDecayPerDeg);
    return {
      score,
      description: `Swell angle (${directionName(direction)}) slightly off ideal`,
    };
  }

  // Far outside window (score: minScore-40)
  const score = Math.max(minScore, Math.round(40 - (diff - halfWidthDeg - closeOutsideDeg) / farOutsideDivisor));
  return {
    score,
    description: `Swell direction (${directionName(direction)}) not ideal for this spot`,
  };
}
