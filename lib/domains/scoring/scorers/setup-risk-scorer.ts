/**
 * Setup Risk Scorer
 *
 * Catches spot-specific setup failures that can look good in generic swell
 * scoring but are bad calls in the water.
 */

import type { ScorerInput, ScorerPlugin, ScorerResult } from '../types';
import { createNeutralResult, createSkipResult, SCORER_WEIGHTS } from '../types';

export const LOW_TIDE_HEAVY_SWELL_WARNING =
  'Likely heavy / closing out on the dropping low tide';

const BEACH_BREAK_TOKEN = 'beach';
const HEAVY_SURF_MIN_FT = 6;
const ENERGETIC_PERIOD_MIN_S = 10;
const LOW_TIDE_MIN_DIFF_FT = 1;
const NEGATIVE_TIDE_FT = 0;

export interface SetupRisk {
  severity: 'severe';
  warning: typeof LOW_TIDE_HEAVY_SWELL_WARNING;
}

export function detectSetupRisk(input: ScorerInput): SetupRisk | null {
  const { profile, snapshot } = input;
  const breakType = String(profile.breakType ?? '').toLowerCase();
  if (!breakType.includes(BEACH_BREAK_TOKEN)) return null;

  const waveHeight = snapshot.waveHeight;
  const wavePeriod = snapshot.wavePeriod;
  const tideHeight = snapshot.tide.heightFt;
  if (
    !Number.isFinite(waveHeight) ||
    !Number.isFinite(wavePeriod) ||
    !Number.isFinite(tideHeight)
  ) {
    return null;
  }

  const isHeavyEnough = waveHeight >= HEAVY_SURF_MIN_FT;
  const hasEnoughEnergy = wavePeriod >= ENERGETIC_PERIOD_MIN_S;
  const isDropping = snapshot.tide.direction === 'falling';
  const preferredMin = profile.tidePreferences.minHeightFt;
  const belowPreferredBy = preferredMin - tideHeight;
  const isBelowPreferredLow =
    tideHeight <= NEGATIVE_TIDE_FT || belowPreferredBy >= LOW_TIDE_MIN_DIFF_FT;

  if (!isHeavyEnough || !hasEnoughEnergy || !isDropping || !isBelowPreferredLow) {
    return null;
  }

  return {
    severity: 'severe',
    warning: LOW_TIDE_HEAVY_SWELL_WARNING,
  };
}

export const setupRiskScorer: ScorerPlugin = {
  name: 'setupRisk',
  weight: SCORER_WEIGHTS.setupRisk,

  score(input: ScorerInput): ScorerResult {
    const risk = detectSetupRisk(input);
    if (!risk) return createNeutralResult('setupRisk', SCORER_WEIGHTS.setupRisk);
    return createSkipResult('setupRisk', risk.warning, SCORER_WEIGHTS.setupRisk);
  },
};
