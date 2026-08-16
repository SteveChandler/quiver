/**
 * Window Scorer
 *
 * Functions for scoring forecast windows based on conditions and user preferences.
 *
 * @module lib/services/discovery/window-selector/window-scorer
 */

import type { Beach } from '@/types/database';
import type { BeachWithThresholds } from '@/lib/scoring/types';
import type { EnhancedForecastEntity } from '@/types/forecast';
import type { getUserSurfPreferences } from '@/lib/services/preference-learning-service';
import type { CompositeScore } from '@/lib/domains/scoring';
import type { BoardClass, RideabilityBand } from '@/lib/domains/rideability';
import type { SkillLevel } from '@/lib/domains/user-preferences/skill-level';
import {
  beachToSpotProfile,
  forecastToSnapshot,
} from '@/lib/domains/scoring';
import {
  resolveNativeSkillLevel,
  scoreNativeForecastSlot,
} from '@/lib/scoring/native-condition-score';
import { getRideabilityBand } from '@/lib/domains/rideability';
import { getDirectionDegrees } from './direction-utils';
import { getScoringEngine } from './scoring-engine-singleton';

const SELECTOR_IDEAL_RIDEABILITY_BONUS = 4;
const SELECTOR_ACCEPTABLE_RIDEABILITY_BONUS = 1;
const SELECTOR_OUT_OF_BAND_PENALTY_PER_FOOT = 5;
const SELECTOR_OUT_OF_BAND_PENALTY_CAP = 12;

/**
 * Score a single forecast window based on conditions and user preferences.
 *
 * @deprecated Use `scoreWindowConditionScore` instead. This function uses a
 * different 0-80 scale that doesn't match the display score (0-100).
 * Kept for backwards compatibility with tests.
 *
 * Scoring components:
 * - Wave Height Fit (0-25 points)
 * - Period/Energy Score (0-20 points)
 * - Wind Alignment (0-20 points)
 * - Tide Fit (0-15 points)
 *
 * Maximum score: 80 points (before time bonuses)
 *
 * @param forecast - Forecast entity to score
 * @param beach - Beach metadata for wind/tide preferences
 * @param userPrefs - User surf preferences (optional)
 * @returns Score from 0-80
 */
export function scoreForecastWindow(
  forecast: EnhancedForecastEntity,
  beach: Beach,
  userPrefs: Awaited<ReturnType<typeof getUserSurfPreferences>> | null
): number {
  let score = 0;

  const waveHeight = parseFloat(forecast.wave_height || '0');
  const wavePeriod = parseFloat(forecast.wave_period?.replace('s', '') || '0');
  const windSpeed = parseFloat(forecast.wind_speed || '0');
  const windDir = getDirectionDegrees(forecast.wind_direction_deg, forecast.wind_direction);
  const tideHeight = parseFloat(forecast.tide_height || '0') || 0;

  // 1. Wave Height Fit (0-25 points)
  if (userPrefs) {
    const userMin = userPrefs.wave_min_ft || 2;
    const userMax = userPrefs.wave_max_ft || 8;

    if (waveHeight >= userMin && waveHeight <= userMax) {
      score += 25;
    } else if (waveHeight >= userMin * 0.8 && waveHeight <= userMax * 1.2) {
      score += 15;
    } else {
      score += 5;
    }
  } else {
    if (waveHeight >= 2 && waveHeight <= 6) {
      score += 20;
    } else {
      score += 10;
    }
  }

  // 2. Period/Energy Score (0-20 points)
  if (userPrefs) {
    const userMinPeriod = userPrefs.wave_period_min_s || 8;
    const userMaxPeriod = userPrefs.wave_period_max_s || 18;

    if (wavePeriod >= userMinPeriod && wavePeriod <= userMaxPeriod) {
      score += 20;
    } else if (wavePeriod >= 10) {
      score += 15;
    } else {
      score += 5;
    }
  } else {
    if (wavePeriod >= 12) {
      score += 20;
    } else if (wavePeriod >= 9) {
      score += 15;
    } else {
      score += 5;
    }
  }

  // 3. Wind Alignment (0-20 points)
  if (beach.wind_offshore_deg !== null && beach.wind_offshore_tol_deg !== null) {
    const offshoreDir = beach.wind_offshore_deg;
    const tolerance = beach.wind_offshore_tol_deg || 30;

    if (windDir === null) {
      if (windSpeed <= 10) {
        score += 15;
      } else if (windSpeed <= 15) {
        score += 8;
      }
    } else {
      const angleDiff = Math.min(
        Math.abs(windDir - offshoreDir),
        360 - Math.abs(windDir - offshoreDir)
      );

      if (angleDiff <= tolerance && windSpeed <= 15) {
        score += 20;
      } else if (angleDiff <= tolerance * 2) {
        score += 10;
      }
    }
  } else {
    if (windSpeed <= 10) {
      score += 15;
    } else if (windSpeed <= 15) {
      score += 8;
    }
  }

  // 4. Tide Fit (0-15 points)
  if (beach.preferred_tide_ft_min !== null && beach.preferred_tide_ft_max !== null) {
    const idealMin = beach.preferred_tide_ft_min;
    const idealMax = beach.preferred_tide_ft_max;

    if (tideHeight >= idealMin && tideHeight <= idealMax) {
      score += 15;
    } else if (
      tideHeight >= idealMin * 0.8 &&
      tideHeight <= idealMax * 1.2
    ) {
      score += 8;
    } else {
      score += 3;
    }
  } else {
    score += 8;
  }

  return score;
}

/**
 * Score a forecast window using the native-compatible condition score.
 *
 * This replaces scoreForecastWindow with the same scoring system used for
 * display, ensuring consistency between window selection and UI.
 *
 * @param forecast - Forecast entity to score
 * @param beach - Beach metadata
 * @returns Score from 0-100
 */
export interface WindowConditionScoreDetails {
  score: number;
  boardClass: BoardClass | null;
  rideabilityBand: RideabilityBand | null;
}

/**
 * Scores the best saved board, but never below the no-board baseline. A null
 * boardClass means no saved board improved the displayed score.
 */
export function scoreWindowConditionDetails(
  forecast: EnhancedForecastEntity,
  _beach: BeachWithThresholds,
  skillLevel?: SkillLevel | string | null,
  rideabilityBand?: RideabilityBand | null,
  boardClasses?: readonly BoardClass[] | null,
): WindowConditionScoreDetails {
  const resolvedSkillLevel = resolveNativeSkillLevel(skillLevel, 'intermediate');
  const uniqueBoardClasses = Array.from(new Set(boardClasses ?? []));
  const baselineScore = scoreNativeForecastSlot(forecast, resolvedSkillLevel);

  if (uniqueBoardClasses.length === 0) {
    return {
      score: rideabilityBand
        ? Math.max(
            baselineScore,
            scoreNativeForecastSlot(forecast, resolvedSkillLevel, rideabilityBand),
          )
        : baselineScore,
      boardClass: null,
      rideabilityBand: rideabilityBand ?? null,
    };
  }

  let best: WindowConditionScoreDetails = {
    score: baselineScore,
    boardClass: null,
    rideabilityBand: null,
  };
  for (const boardClass of uniqueBoardClasses) {
    const boardBand = getRideabilityBand(resolvedSkillLevel, boardClass);
    const score = scoreNativeForecastSlot(forecast, resolvedSkillLevel, boardBand);
    if (score > best.score) {
      best = {
        score,
        boardClass,
        rideabilityBand: boardBand,
      };
    }
  }

  return best;
}

export function scoreWindowConditionScore(
  forecast: EnhancedForecastEntity,
  beach: BeachWithThresholds,
  skillLevel?: SkillLevel | string | null,
  rideabilityBand?: RideabilityBand | null,
  boardClasses?: readonly BoardClass[] | null,
): number {
  return scoreWindowConditionDetails(
    forecast,
    beach,
    skillLevel,
    rideabilityBand,
    boardClasses,
  ).score;
}

/**
 * Score a forecast window for selector ranking, with a small board-aware
 * rideability nudge.
 */
export function scoreWindowForSelection(
  forecast: EnhancedForecastEntity,
  beach: Beach,
  rideabilityBand: RideabilityBand | null = null,
  skillLevel?: SkillLevel | string | null,
  boardClasses?: readonly BoardClass[] | null,
): number {
  const details = scoreWindowConditionDetails(
    forecast,
    beach,
    skillLevel,
    rideabilityBand,
    boardClasses,
  );
  const baseScore = details.score;
  const adjustmentBand = details.rideabilityBand;
  if (!adjustmentBand) {
    return baseScore;
  }

  return clampSelectionScore(
    baseScore + getRideabilitySelectionAdjustment(forecast, adjustmentBand)
  );
}

/**
 * Score a forecast window with the domain engine and return the composite
 * result for downstream explanation/confidence builders.
 */
export function scoreWindowWithComposite(
  forecast: EnhancedForecastEntity,
  beach: Beach
): CompositeScore {
  const engine = getScoringEngine();
  const profile = beachToSpotProfile(beach);
  const snapshot = forecastToSnapshot(forecast);

  return engine.score({
    profile,
    snapshot,
    window: null,
    preferences: null,
  });
}

function getRideabilitySelectionAdjustment(
  forecast: EnhancedForecastEntity,
  rideabilityBand: RideabilityBand
): number {
  const waveHeight = parseFloat(forecast.wave_height || '0');
  if (!Number.isFinite(waveHeight) || waveHeight <= 0) {
    return 0;
  }

  if (
    waveHeight >= rideabilityBand.ideal.min &&
    waveHeight <= rideabilityBand.ideal.max
  ) {
    return SELECTOR_IDEAL_RIDEABILITY_BONUS;
  }

  if (waveHeight < rideabilityBand.acceptable.min) {
    const under = rideabilityBand.acceptable.min - waveHeight;
    return -Math.min(
      SELECTOR_OUT_OF_BAND_PENALTY_CAP,
      Math.round(under * SELECTOR_OUT_OF_BAND_PENALTY_PER_FOOT)
    );
  }

  if (waveHeight > rideabilityBand.acceptable.max) {
    const over = waveHeight - rideabilityBand.acceptable.max;
    return -Math.min(
      SELECTOR_OUT_OF_BAND_PENALTY_CAP,
      Math.round(over * SELECTOR_OUT_OF_BAND_PENALTY_PER_FOOT)
    );
  }

  return SELECTOR_ACCEPTABLE_RIDEABILITY_BONUS;
}

function clampSelectionScore(score: number): number {
  return Math.max(0, Math.min(100, score));
}
