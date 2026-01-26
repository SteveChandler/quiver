/**
 * Window Scorer
 *
 * Functions for scoring forecast windows based on conditions and user preferences.
 *
 * @module lib/services/discovery/window-selector/window-scorer
 */

import type { Beach } from '@/types/database';
import type { EnhancedForecastEntity } from '@/types/forecast';
import type { getUserSurfPreferences } from '@/lib/services/preference-learning-service';
import {
  beachToSpotProfile,
  forecastToSnapshot,
} from '@/lib/domains/scoring';
import { getDirectionDegrees } from './direction-utils';
import { getScoringEngine } from './scoring-engine-singleton';

/**
 * Score a single forecast window based on conditions and user preferences.
 *
 * @deprecated Use `scoreWindowWithEngine` instead. This function uses a
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
  const tideHeight = parseFloat(forecast.tide_height || '0');

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
 * Score a forecast window using the unified discovery scoring engine.
 *
 * This replaces scoreForecastWindow with the same scoring system used
 * for display, ensuring consistency between window selection and UI.
 *
 * @param forecast - Forecast entity to score
 * @param beach - Beach metadata
 * @returns Score from 0-100
 */
export function scoreWindowWithEngine(
  forecast: EnhancedForecastEntity,
  beach: Beach
): number {
  const engine = getScoringEngine();
  const profile = beachToSpotProfile(beach);
  const snapshot = forecastToSnapshot(forecast);

  const result = engine.score({
    profile,
    snapshot,
    window: null,
    preferences: null,
  });

  return result.total;
}
