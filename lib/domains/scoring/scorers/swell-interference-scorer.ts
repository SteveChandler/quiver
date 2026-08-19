/**
 * Swell Interference Scorer
 *
 * Scores the interaction between primary and secondary swells.
 * Crossing swells create choppy, disorganized conditions.
 *
 * Weight: 0.15 (15% of total score)
 *
 * Key behaviors:
 * - No secondary swell: Full score (no interference)
 * - Aligned swells (<30° apart): Full score (swells combine constructively)
 * - Crossing swells (60°+ apart): Penalty based on energy ratio
 * - Perpendicular swells (90°): Maximum penalty
 *
 * Note: Primary swell alignment with beach is handled by swell-alignment-scorer.
 */

import type { ScorerPlugin, ScorerInput, ScorerResult, ScoringDecisionEffect } from '../types';
import { SCORER_WEIGHTS, createNeutralResult } from '../types';
import { analyzeSwell, areSwellsAligned, areSwellsCrossing } from '../../conditions';
import { CONDITIONS_CONSTANTS } from '../../conditions';
import { directionName } from '../../shared';
import { getDirectionalRelevance } from './directional-relevance';

/**
 * When directional relevance drops the attenuated score below this floor,
 * suppress the positive "Clean single swell" / "Dominant primary swell"
 * reasons — they're misleading on wind-chop dominated days.
 */
const RELEVANCE_REASON_THRESHOLD = 70;
/** A crossing secondary train is a decision-affecting caution, not copy-only. */
const CROSSING_SWELL_VERDICT_CEILING = 65;

/**
 * Swell interference scorer plugin.
 *
 * NEW scorer that addresses a gap in the existing scoring system:
 * Secondary swell data was available but not used in scoring decisions.
 *
 * This scorer focuses specifically on multi-swell interference.
 * It does NOT score primary swell alignment (that's swell-alignment-scorer).
 */
export const swellInterferenceScorer: ScorerPlugin = {
  name: 'swellInterference',
  weight: SCORER_WEIGHTS.swellInterference,

  score(input: ScorerInput): ScorerResult {
    const { snapshot, profile } = input;

    // If no primary swell data, return neutral
    if (!snapshot.primarySwell) {
      return createNeutralResult('swellInterference', SCORER_WEIGHTS.swellInterference);
    }

    // Geometry is meaningless when the dominant train carries no usable
    // energy. Attenuate every score path below by directional relevance so a
    // 6s "clean single swell" can't carry the composite into the good band.
    const relevance = getDirectionalRelevance(snapshot.primarySwell.periodS);

    // If no secondary swell, no interference - geometric score is 100
    if (!snapshot.secondarySwell) {
      const score = Math.round(100 * relevance);
      return {
        name: 'swellInterference',
        score,
        weight: SCORER_WEIGHTS.swellInterference,
        reasons: score >= RELEVANCE_REASON_THRESHOLD ? ['Clean single swell'] : [],
        warnings: [],
        skip: false,
        skipReason: null,
      };
    }

    // Check if secondary swell is significant enough to matter
    const primaryEnergy = snapshot.primarySwell.energy;
    const secondaryEnergy = snapshot.secondarySwell.energy;
    const energyRatio = secondaryEnergy / (primaryEnergy + secondaryEnergy);

    // If secondary is < 10% of total energy, ignore it
    if (energyRatio < CONDITIONS_CONSTANTS.SECONDARY_SWELL_THRESHOLD) {
      const score = Math.round(95 * relevance);
      return {
        name: 'swellInterference',
        score,
        weight: SCORER_WEIGHTS.swellInterference,
        reasons: score >= RELEVANCE_REASON_THRESHOLD ? ['Dominant primary swell'] : [],
        warnings: [],
        skip: false,
        skipReason: null,
      };
    }

    // Use swell analyzer to get interference penalty
    const analysis = analyzeSwell(
      snapshot.primarySwell,
      snapshot.secondarySwell,
      profile.swellWindow
    );

    // Convert interference penalty (0-30) to score (100-0)
    // interferencePenalty of 0 = score of 100
    // interferencePenalty of 30 = score of ~40
    const geometricScore = Math.max(30, Math.round(100 - analysis.interferencePenalty * 2));
    const score = Math.round(geometricScore * relevance);

    // Build reasons and warnings
    const reasons: string[] = [];
    const warnings: string[] = [];
    const effects: ScoringDecisionEffect[] = [];

    if (areSwellsAligned(snapshot.primarySwell, snapshot.secondarySwell)) {
      // "Swells aligned" is a positive geometric finding, but on a 6s
      // dominant day it's not a reason to like the surf — only surface it
      // when the attenuated score still reads as a strength.
      if (score >= RELEVANCE_REASON_THRESHOLD) {
        reasons.push('Swells aligned - waves combine well');
      }
    } else if (areSwellsCrossing(snapshot.primarySwell, snapshot.secondarySwell)) {
      const message = 'Crossing swells creating choppy conditions';
      warnings.push(message);
      effects.push({
        code: 'crossing_swells',
        severity: 'material',
        verdictCeiling: CROSSING_SWELL_VERDICT_CEILING,
        message,
      });
    } else {
      // In between - mild interference
      if (analysis.interferencePenalty > 5) {
        warnings.push('Minor cross-swell interference');
      }
    }

    // Add context about the secondary swell
    if (energyRatio > 0.3) {
      const secondaryDir = directionName(snapshot.secondarySwell.directionDeg);
      warnings.push(`Strong secondary swell from ${secondaryDir}`);
    }

    return {
      name: 'swellInterference',
      score,
      weight: SCORER_WEIGHTS.swellInterference,
      reasons,
      warnings,
      effects,
      skip: false,
      skipReason: null,
    };
  },
};
