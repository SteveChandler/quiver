/**
 * Tide Direction Scorer
 *
 * Scores tide direction (rising/falling) against beach preferences.
 * Different beaches have different sensitivities to tide direction.
 *
 * Weight: 0.15 (15% of total score)
 */

import type { ScorerPlugin, ScorerInput, ScorerResult } from '../types';
import { SCORER_WEIGHTS } from '../types';

const SENSITIVITY_SCORES = {
  low: { match: 80, mismatch: 55, slack: 62 },
  medium: { match: 85, mismatch: 35, slack: 52 },
  high: { match: 90, mismatch: 10, slack: 40 },
} as const;

const MISMATCH_WARNINGS = {
  low: 'Tide direction not ideal for this spot',
  medium: 'Tide dropping - may affect wave shape',
  high: 'Tide dropping - this spot closes out on outgoing tide',
} as const;

const MATCH_REASONS = {
  low: 'Tide direction favorable',
  medium: 'Tide rising - good for this spot',
  high: 'Tide rising - optimal for this spot',
} as const;

export const tideDirectionScorer: ScorerPlugin = {
  name: 'tideDirection',
  weight: SCORER_WEIGHTS.tideDirection,

  score(input: ScorerInput): ScorerResult {
    const { snapshot, profile } = input;
    const actualDirection = snapshot.tide.direction;
    const { preferredDirection, directionSensitivity } = profile.tidePreferences;

    const reasons: string[] = [];
    const warnings: string[] = [];

    // No preference = neutral
    if (preferredDirection === 'either') {
      return {
        name: 'tideDirection',
        score: 70,
        weight: SCORER_WEIGHTS.tideDirection,
        reasons: [],
        warnings: [],
        skip: false,
        skipReason: null,
      };
    }

    const scores = SENSITIVITY_SCORES[directionSensitivity];
    let score: number;

    // Match
    if (actualDirection === preferredDirection) {
      score = scores.match;
      reasons.push(getMatchReason(preferredDirection, directionSensitivity));
    }
    // Slack when movement preferred
    else if (actualDirection === 'slack' && preferredDirection !== 'slack') {
      score = scores.slack;
      warnings.push('Tide slack - spot prefers ' + preferredDirection + ' tide');
    }
    // Slack match
    else if (actualDirection === 'slack' && preferredDirection === 'slack') {
      score = scores.match;
      reasons.push('Slack tide - good for this spot');
    }
    // Movement when slack preferred
    else if (actualDirection !== 'slack' && preferredDirection === 'slack') {
      score = scores.mismatch;
      warnings.push('Tide moving - spot prefers slack tide');
    }
    // Mismatch
    else {
      score = scores.mismatch;
      warnings.push(getMismatchWarning(actualDirection, preferredDirection, directionSensitivity));
    }

    return {
      name: 'tideDirection',
      score,
      weight: SCORER_WEIGHTS.tideDirection,
      reasons,
      warnings,
      skip: false,
      skipReason: null,
    };
  },
};

function getMatchReason(
  direction: 'rising' | 'falling' | 'slack',
  sensitivity: 'low' | 'medium' | 'high'
): string {
  if (direction === 'slack') return 'Slack tide - good for this spot';
  const base = MATCH_REASONS[sensitivity];
  if (direction === 'falling') {
    return base.replace('rising', 'dropping').replace('Tide rising', 'Tide dropping');
  }
  return base;
}

function getMismatchWarning(
  actual: 'rising' | 'falling' | 'slack',
  preferred: 'rising' | 'falling' | 'either' | 'slack',
  sensitivity: 'low' | 'medium' | 'high'
): string {
  const base = MISMATCH_WARNINGS[sensitivity];
  if (actual === 'rising' && preferred === 'falling') {
    return base.replace('dropping', 'rising').replace('outgoing', 'incoming');
  }
  return base;
}
