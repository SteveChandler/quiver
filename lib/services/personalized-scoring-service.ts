/**
 * Personalized Scoring Service
 *
 * Scores beaches for specific users by combining:
 * 1. Learned preferences (implicit from session history)
 * 2. Implicit preferences (inferred from engagement patterns)
 * 3. Beach affinity (familiarity from past sessions)
 *
 * Scoring uses a multiplicative approach to prevent score inflation:
 * - Individual bonus components are calculated the same way (additive pts)
 * - The total bonus is converted to a multiplier (1.0x to 1.15x)
 * - multiplier = 1.0 + min(totalBonus / MAX_ADDITIVE, 1.0) * MAX_MULTIPLIER
 * - finalScore = min(100, round(baseScore * multiplier))
 *
 * This means personalization gently boosts good conditions rather than
 * inflating mediocre scores into artificially high ratings.
 *
 * Bonus components (accumulated into totalBonus, max ~50):
 * - Learned wave range match: 15 pts * confidence
 * - Learned wind preferences match: 10 pts * confidence
 * - Learned tide preferences match: 8 pts * confidence
 * - Implicit wave range match: 10 pts * implicitWeight
 * - Implicit break type match: 8 pts * implicitWeight
 * - Implicit top engaged beach: 2 pts (flat)
 * - Beach affinity: affinity_score * 0.15 (max 15 pts)
 *
 * @see supabase/migrations/20251103000002_beach_affinity.sql
 * @see supabase/migrations/20251103000003_user_surf_preferences.sql
 * @see docs/features/PERSONALIZATION_FORECAST_IMPLEMENTATION.md Phase 6
 * @see docs/IMPLICIT_PREFERENCE_LEARNING.md
 */

import { createSupabaseServiceRoleClient } from '@/lib/supabase/server';
import {
  getUserSurfPreferences,
  normalizeTideStatus,
  parseForecastNumber,
  parseWindDirection,
} from './preference-learning-service';
import {
  getImplicitPreferences,
  calculateImplicitBonus,
  isTopEngagedBeach,
} from './implicit-preferences-service';
import type { EnhancedForecastEntity } from '@/types/forecast';

/**
 * Personalized score with breakdown
 */
export interface PersonalizedScore {
  /** Final personalized score (0-100) */
  score: number;
  /** Whether any personalization was applied */
  personalized: boolean;
  /** Score breakdown by component */
  breakdown: {
    /** Base algorithmic score */
    base: number;
    /** Bonus from onboarding preferences */
    onboardingPrefs: number;
    /** Bonus from learned preferences */
    learnedPrefs: number;
    /** Bonus from implicit preferences */
    implicitPrefs: number;
    /** Bonus from beach affinity */
    affinity: number;
    /** Multiplier applied to base score (1.0x to 1.15x) */
    multiplier: number;
  };
}

/**
 * Score a beach for a specific user by combining base score with personalization
 *
 * Queries user's learned preferences and beach affinity to boost the base
 * score for beaches that match user's demonstrated preferences.
 *
 * @param userId - The user ID
 * @param beachId - The beach ID to score
 * @param forecast - Current forecast for the beach
 * @param baseScore - Base algorithmic score (from coach picks)
 * @returns Personalized score with breakdown
 *
 * @example
 * const score = await scoreBeachForUser('user-123', 'beach-456', forecast, 75);
 * if (score.personalized) {
 *   console.log(`Boosted to ${score.score} (base: ${score.breakdown.base})`);
 * }
 */
export async function scoreBeachForUser(
  userId: string,
  beachId: string,
  forecast: EnhancedForecastEntity,
  baseScore: number
): Promise<PersonalizedScore> {
  const supabase = createSupabaseServiceRoleClient();

  let personalized = false;
  const breakdown = {
    base: baseScore,
    onboardingPrefs: 0,
    learnedPrefs: 0,
    implicitPrefs: 0,
    affinity: 0,
    multiplier: 1.0,
  };

  try {
    // 1. Get learned preferences
    const learnedPrefs = await getUserSurfPreferences(userId);

    if (learnedPrefs && learnedPrefs.confidence > 0.5) {
      // Match learned wave range
      if (matchesLearnedWaveRange(forecast, learnedPrefs)) {
        const bonus = 15 * learnedPrefs.confidence;
        breakdown.learnedPrefs += bonus;
        personalized = true;
      }

      // Match learned wind preferences
      if (matchesLearnedWindPrefs(forecast, learnedPrefs)) {
        const bonus = 10 * learnedPrefs.confidence;
        breakdown.learnedPrefs += bonus;
        personalized = true;
      }

      // Match learned tide preferences
      if (matchesLearnedTidePrefs(forecast, learnedPrefs)) {
        const bonus = 8 * learnedPrefs.confidence;
        breakdown.learnedPrefs += bonus;
        personalized = true;
      }
    }

    // 2. Get implicit preferences and calculate blend weight
    const implicitPrefs = await getImplicitPreferences(userId);

    if (implicitPrefs && implicitPrefs.confidence > 0.1) {
      // Confidence blend: implicit fills the gap left by explicit
      const explicitConf = learnedPrefs?.confidence ?? 0;
      const implicitWeight = implicitPrefs.confidence * (1 - explicitConf);

      if (implicitWeight > 0.1) {
        // Get beach break type
        const { data: beach } = await supabase
          .from('beaches')
          .select('break_type')
          .eq('id', beachId)
          .single();

        const beachType = beach?.break_type ?? null;
        const isTopEngaged = isTopEngagedBeach(beachId, implicitPrefs);

        const implicitBonus = calculateImplicitBonus(
          {
            wave_height_ft: parseFloat(forecast.wave_height || '0') || null,
            wave_period_s: parseFloat(forecast.wave_period || '0'),
            wind_speed_mph: parseFloat(forecast.wind_speed || '0'),
          },
          beachType,
          isTopEngaged,
          implicitPrefs,
          implicitWeight
        );

        if (implicitBonus.total > 0) {
          breakdown.implicitPrefs = implicitBonus.total;
          personalized = true;
        }
      }
    }

    // 3. Beach affinity bonus
    const { data: affinity } = await supabase
      .from('user_beach_affinity')
      .select('affinity_score, session_count')
      .eq('user_id', userId)
      .eq('beach_id', beachId)
      .single();

    if (affinity && affinity.affinity_score > 10) {
      // Up to 15 bonus points for familiar beaches
      const affinityBonus = Math.min(affinity.affinity_score * 0.15, 15);
      breakdown.affinity = affinityBonus;
      personalized = true;
    }
  } catch (error) {
    // Graceful degradation - return base score on error
    console.error(`Error personalizing score for user ${userId}, beach ${beachId}:`, error);
  }

  // Convert additive bonuses to a multiplicative boost (1.0x to 1.15x)
  const totalBonus = breakdown.onboardingPrefs + breakdown.learnedPrefs
                   + breakdown.implicitPrefs + breakdown.affinity;
  const MAX_ADDITIVE = 50;  // maximum possible bonus sum
  const MAX_MULTIPLIER = 0.15;  // max 15% boost
  const multiplier = 1.0 + Math.min(totalBonus / MAX_ADDITIVE, 1.0) * MAX_MULTIPLIER;
  breakdown.multiplier = multiplier;

  const finalScore = Math.min(100, Math.round(baseScore * multiplier));

  return {
    score: finalScore,
    personalized,
    breakdown,
  };
}


// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if forecast matches learned wave range
 *
 * Uses 10th-90th percentile range from user's session history.
 *
 * @param forecast - The forecast to check
 * @param prefs - User's learned preferences
 * @returns True if wave height is within user's preferred range
 *
 * @example
 * matchesLearnedWaveRange(forecast, { wave_min_ft: 2.5, wave_max_ft: 5.0 })
 * // Returns true if wave_height is between 2.5-5.0 ft
 */
export function matchesLearnedWaveRange(
  forecast: EnhancedForecastEntity,
  prefs: { wave_min_ft: number | null; wave_max_ft: number | null }
): boolean {
  const height = parseForecastNumber(forecast.wave_height);
  if (!height || !prefs.wave_min_ft || !prefs.wave_max_ft) return false;

  return height >= prefs.wave_min_ft && height <= prefs.wave_max_ft;
}

/**
 * Check if forecast matches learned wind preferences
 *
 * Checks both wind speed tolerance and preferred directions (±30 degrees).
 *
 * @param forecast - The forecast to check
 * @param prefs - User's learned preferences
 * @returns True if wind conditions match user's preferences
 *
 * @example
 * matchesLearnedWindPrefs(forecast, {
 *   max_wind_mph: 15,
 *   preferred_wind_directions: [0, 45] // North and Northeast
 * })
 * // Returns true if wind <= 15 mph and direction is near North or Northeast
 */
export function matchesLearnedWindPrefs(
  forecast: EnhancedForecastEntity,
  prefs: { max_wind_mph: number | null; preferred_wind_directions: number[] | null }
): boolean {
  const windSpeed = parseForecastNumber(forecast.wind_speed);
  const windDir = parseWindDirection(forecast.wind_direction);

  // Check wind speed tolerance
  if (prefs.max_wind_mph !== null && windSpeed !== null) {
    if (windSpeed > prefs.max_wind_mph) return false;
  }

  // Check wind direction preference (within ±30 degrees)
  if (prefs.preferred_wind_directions && prefs.preferred_wind_directions.length > 0 && windDir !== null) {
    const matches = prefs.preferred_wind_directions.some((prefDir) => {
      const diff = Math.abs(windDir - prefDir);
      // Handle wrapping around 0/360
      return diff <= 30 || diff >= 330;
    });

    if (!matches) return false;
  }

  // If we have max_wind_mph but no direction prefs, just check speed
  if (prefs.max_wind_mph !== null) {
    return windSpeed !== null && windSpeed <= prefs.max_wind_mph;
  }

  // If we only have direction prefs and passed the direction check, return true
  return prefs.preferred_wind_directions !== null && prefs.preferred_wind_directions.length > 0;
}

/**
 * Check if forecast matches learned tide preferences
 *
 * @param forecast - The forecast to check
 * @param prefs - User's learned preferences
 * @returns True if tide status matches user's preferred statuses
 *
 * @example
 * matchesLearnedTidePrefs(forecast, {
 *   preferred_tide_statuses: ['rising', 'high']
 * })
 * // Returns true if forecast.tide_status is 'rising' or 'high'
 */
export function matchesLearnedTidePrefs(
  forecast: EnhancedForecastEntity,
  prefs: { preferred_tide_statuses: string[] | null }
): boolean {
  if (!prefs.preferred_tide_statuses || !forecast.tide_status) return false;

  const forecastTide = normalizeTideStatus(forecast.tide_status);
  if (!forecastTide) return false;

  return prefs.preferred_tide_statuses
    .map((status) => normalizeTideStatus(status))
    .includes(forecastTide);
}
