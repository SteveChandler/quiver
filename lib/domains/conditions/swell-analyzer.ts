/**
 * Swell Analyzer
 *
 * Analyzes primary and secondary swell interaction to detect interference.
 * This is a key improvement over current scoring which only considers primary swell.
 *
 * Key insights:
 * - Swells from similar directions reinforce each other (cleaner waves)
 * - Swells from crossing directions create interference (choppy, disorganized)
 * - Secondary swell matters more when it has significant energy relative to primary
 */

import type { SwellComponent, SwellAnalysis } from './types';
import type { SwellWindow } from '../spot-profile/types';
import {
  calculateWindowAlignment,
} from '../spot-profile/spot-profile';
import { CONDITIONS_CONSTANTS } from './types';
import { angleDifference, directionName } from '../shared';

/**
 * Analyzes primary and secondary swell interaction for a beach.
 *
 * @param primary - Primary swell component (dominant)
 * @param secondary - Secondary swell component (if any)
 * @param swellWindow - Beach's optimal swell window
 * @returns Analysis with alignment scores, interference penalty, and explanation
 */
export function analyzeSwell(
  primary: SwellComponent | null,
  secondary: SwellComponent | null,
  swellWindow: SwellWindow
): SwellAnalysis {
  // No swell data
  if (!primary) {
    return {
      primaryAlignment: 0,
      secondaryAlignment: 0,
      interferencePenalty: 0,
      combinedScore: 0,
      explanation: 'No swell data available',
    };
  }

  const primaryAlignment = calculateWindowAlignment(
    primary.directionDeg,
    swellWindow
  );

  // If no significant secondary swell, just use primary
  if (!secondary || !isSignificantSecondary(primary, secondary)) {
    return {
      primaryAlignment,
      secondaryAlignment: 0,
      interferencePenalty: 0,
      combinedScore: Math.round(primaryAlignment),
      explanation: formatSwellExplanation(primary, null, 0),
    };
  }

  const secondaryAlignment = calculateWindowAlignment(
    secondary.directionDeg,
    swellWindow
  );

  // Calculate interference penalty
  const interferencePenalty = calculateInterferencePenalty(primary, secondary);

  // Combined score: energy-weighted alignment minus interference
  const combinedScore = calculateCombinedScore(
    primary,
    secondary,
    primaryAlignment,
    secondaryAlignment,
    interferencePenalty
  );

  return {
    primaryAlignment: Math.round(primaryAlignment),
    secondaryAlignment: Math.round(secondaryAlignment),
    interferencePenalty,
    combinedScore,
    explanation: formatSwellExplanation(primary, secondary, interferencePenalty),
  };
}

/**
 * Determines if secondary swell is significant enough to consider.
 * Secondary matters if its energy is >= 10% of primary energy.
 */
function isSignificantSecondary(
  primary: SwellComponent,
  secondary: SwellComponent
): boolean {
  if (primary.energy === 0) return false;
  const energyRatio = secondary.energy / primary.energy;
  return energyRatio >= CONDITIONS_CONSTANTS.SECONDARY_SWELL_THRESHOLD;
}

/**
 * Calculates interference penalty based on angular difference and energy ratio.
 *
 * Interference increases when:
 * - Swells cross at high angles (>60° significant, >90° severe)
 * - Secondary swell has significant energy
 */
function calculateInterferencePenalty(
  primary: SwellComponent,
  secondary: SwellComponent
): number {
  const directionDiff = angleDifference(
    primary.directionDeg,
    secondary.directionDeg
  );

  // No interference if swells are aligned (< 30° apart)
  if (directionDiff < CONDITIONS_CONSTANTS.INTERFERENCE_START_DEG) {
    return 0;
  }

  // Interference factor: 0 at 30°, 1 at 90°+
  const interferenceFactor = Math.min(
    1,
    (directionDiff - CONDITIONS_CONSTANTS.INTERFERENCE_START_DEG) /
      (CONDITIONS_CONSTANTS.INTERFERENCE_SEVERE_DEG -
        CONDITIONS_CONSTANTS.INTERFERENCE_START_DEG)
  );

  // Energy ratio: how much secondary contributes to total
  const totalEnergy = primary.energy + secondary.energy;
  const energyRatio = secondary.energy / totalEnergy;

  // Penalty scales with both interference factor and energy ratio
  // Max penalty is 30 points at 90°+ difference with 50/50 energy split
  const penalty = Math.round(
    CONDITIONS_CONSTANTS.MAX_INTERFERENCE_PENALTY *
      interferenceFactor *
      Math.min(energyRatio * 2, 1) // Cap energy multiplier at 1
  );

  return penalty;
}

/**
 * Calculates combined swell score from both components.
 */
function calculateCombinedScore(
  primary: SwellComponent,
  secondary: SwellComponent,
  primaryAlignment: number,
  secondaryAlignment: number,
  interferencePenalty: number
): number {
  const totalEnergy = primary.energy + secondary.energy;

  // Energy-weighted alignment
  const weightedAlignment =
    (primaryAlignment * primary.energy + secondaryAlignment * secondary.energy) /
    totalEnergy;

  // Subtract interference penalty
  const score = Math.max(0, Math.round(weightedAlignment - interferencePenalty));

  return Math.min(100, score);
}

/**
 * Formats human-readable swell explanation.
 */
function formatSwellExplanation(
  primary: SwellComponent,
  secondary: SwellComponent | null,
  interferencePenalty: number
): string {
  const primaryDir = directionName(primary.directionDeg);
  const primaryInfo = `${primary.heightFt.toFixed(1)}ft @ ${primary.periodS}s from ${primaryDir}`;

  if (!secondary) {
    return `Primary swell: ${primaryInfo}`;
  }

  const secondaryDir = directionName(secondary.directionDeg);

  if (interferencePenalty > 15) {
    return `${primaryInfo}, cross-swell from ${secondaryDir} causing chop`;
  } else if (interferencePenalty > 5) {
    return `${primaryInfo}, secondary from ${secondaryDir} (minor interference)`;
  } else {
    return `${primaryInfo}, secondary from ${secondaryDir}`;
  }
}

/**
 * Creates a SwellComponent from raw values.
 * Computes energy automatically.
 */
export function createSwellComponent(
  heightFt: number,
  periodS: number,
  directionDeg: number
): SwellComponent {
  return {
    heightFt,
    periodS,
    directionDeg,
    energy: heightFt * heightFt * periodS,
  };
}

/**
 * Checks if two swells are from similar directions (< 30° apart).
 */
export function areSwellsAligned(
  swell1: SwellComponent,
  swell2: SwellComponent
): boolean {
  const diff = angleDifference(swell1.directionDeg, swell2.directionDeg);
  return diff < CONDITIONS_CONSTANTS.INTERFERENCE_START_DEG;
}

/**
 * Checks if two swells are crossing (> 60° apart).
 */
export function areSwellsCrossing(
  swell1: SwellComponent,
  swell2: SwellComponent
): boolean {
  const diff = angleDifference(swell1.directionDeg, swell2.directionDeg);
  return diff > 60;
}
