/**
 * Personalized Scoring Service
 *
 * Scores beaches for specific users by combining:
 * 1. Base algorithmic score (from coach picks)
 * 2. Onboarding preferences (explicit user choices)
 * 3. Learned preferences (implicit from session history)
 * 4. Implicit preferences (inferred from engagement patterns)
 * 5. Beach affinity (familiarity from past sessions)
 *
 * Scoring breakdown:
 * - Base score: From existing coach picks algorithm
 * - Onboarding wave size match: +10 pts
 * - Onboarding break type match: +8 pts
 * - Learned wave range match: +15 pts * confidence
 * - Learned wind preferences match: +10 pts * confidence
 * - Learned tide preferences match: +8 pts * confidence
 * - Implicit wave range match: +10 pts * implicitWeight
 * - Implicit break type match: +8 pts * implicitWeight
 * - Implicit top engaged beach: +2 pts (flat)
 * - Beach affinity: +affinity_score * 0.15 (max 15 pts)
 * - Final score capped at 100
 *
 * @see supabase/migrations/20251103000002_beach_affinity.sql
 * @see supabase/migrations/20251103000003_user_surf_preferences.sql
 * @see docs/features/PERSONALIZATION_FORECAST_IMPLEMENTATION.md Phase 6
 * @see docs/IMPLICIT_PREFERENCE_LEARNING.md
 */

import { createSupabaseServiceRoleClient } from '@/lib/supabase/server';
import { getUserSurfPreferences, type UserSurfPreferences } from './preference-learning-service';
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
  };
}

/**
 * Score a beach for a specific user by combining base score with personalization
 *
 * Queries user's onboarding preferences, learned preferences, and beach affinity
 * to boost the base score for beaches that match user's demonstrated preferences.
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

  let score = baseScore;
  let personalized = false;
  const breakdown = {
    base: baseScore,
    onboardingPrefs: 0,
    learnedPrefs: 0,
    implicitPrefs: 0,
    affinity: 0,
  };

  try {
    // 1. Get user profile (onboarding preferences)
    const { data: profile } = await supabase
      .from('profiles')
      .select('preferred_wave_size, preferred_break_type, crowd_preference')
      .eq('id', userId)
      .single();

    if (profile) {
      // Match wave size preference
      if (profile.preferred_wave_size && profile.preferred_wave_size !== 'any') {
        if (matchesWaveSize(forecast, profile.preferred_wave_size)) {
          score += 10;
          breakdown.onboardingPrefs += 10;
          personalized = true;
        }
      }

      // Match break type preference
      if (profile.preferred_break_type && profile.preferred_break_type !== 'any') {
        const { data: beach } = await supabase
          .from('beaches')
          .select('break_type')
          .eq('id', beachId)
          .single();

        if (beach?.break_type === profile.preferred_break_type) {
          score += 8;
          breakdown.onboardingPrefs += 8;
          personalized = true;
        }
      }
    }

    // 2. Get learned preferences
    const learnedPrefs = await getUserSurfPreferences(userId);

    if (learnedPrefs && learnedPrefs.confidence > 0.5) {
      // Match learned wave range
      if (matchesLearnedWaveRange(forecast, learnedPrefs)) {
        const bonus = 15 * learnedPrefs.confidence;
        score += bonus;
        breakdown.learnedPrefs += bonus;
        personalized = true;
      }

      // Match learned wind preferences
      if (matchesLearnedWindPrefs(forecast, learnedPrefs)) {
        const bonus = 10 * learnedPrefs.confidence;
        score += bonus;
        breakdown.learnedPrefs += bonus;
        personalized = true;
      }

      // Match learned tide preferences
      if (matchesLearnedTidePrefs(forecast, learnedPrefs)) {
        const bonus = 8 * learnedPrefs.confidence;
        score += bonus;
        breakdown.learnedPrefs += bonus;
        personalized = true;
      }
    }

    // 3. Get implicit preferences and calculate blend weight
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
          score += implicitBonus.total;
          breakdown.implicitPrefs = implicitBonus.total;
          personalized = true;
        }
      }
    }

    // 4. Beach affinity bonus
    const { data: affinity } = await supabase
      .from('user_beach_affinity')
      .select('affinity_score, session_count')
      .eq('user_id', userId)
      .eq('beach_id', beachId)
      .single();

    if (affinity && affinity.affinity_score > 10) {
      // Up to 15 bonus points for familiar beaches
      const affinityBonus = Math.min(affinity.affinity_score * 0.15, 15);
      score += affinityBonus;
      breakdown.affinity = affinityBonus;
      personalized = true;
    }
  } catch (error) {
    // Graceful degradation - return base score on error
    console.error(`Error personalizing score for user ${userId}, beach ${beachId}:`, error);
  }

  return {
    score: Math.min(100, Math.round(score)),
    personalized,
    breakdown,
  };
}

/**
 * Batch score multiple beaches for a user
 *
 * OPTIMIZED VERSION: Makes 3 database queries total instead of N*3 queries
 * - 1 query for user profile
 * - 1 query for all beach break types
 * - 1 query for learned preferences
 * Affinity data is already pre-loaded by the caller
 *
 * @param userId - The user ID
 * @param beaches - Array of beaches with forecasts and base scores
 * @param affinityMap - Pre-loaded affinity data keyed by beach_id
 * @returns Map of beach_id to PersonalizedScore
 *
 * @example
 * const scores = await scoreBeachesForUser('user-123', [
 *   { beachId: 'beach-1', forecast, baseScore: 75 },
 *   { beachId: 'beach-2', forecast, baseScore: 82 },
 * ], affinityMap);
 * console.log(scores.get('beach-1')?.score); // Personalized score
 */
export async function scoreBeachesForUser(
  userId: string,
  beaches: Array<{
    beachId: string;
    forecast: EnhancedForecastEntity;
    baseScore: number;
  }>,
  affinityMap: Map<string, { affinity_score: number; session_count: number }>
): Promise<Map<string, PersonalizedScore>> {
  const supabase = createSupabaseServiceRoleClient();
  const results = new Map<string, PersonalizedScore>();

  // Early return if no beaches
  if (beaches.length === 0) {
    return results;
  }

  try {
    // BATCH QUERY 1: Get user profile (onboarding preferences) - single query
    const { data: profile } = await supabase
      .from('profiles')
      .select('preferred_wave_size, preferred_break_type, crowd_preference')
      .eq('id', userId)
      .single();

    // BATCH QUERY 2: Get all beach break types in one query
    const beachIds = beaches.map((b) => b.beachId);
    const { data: beachDetails } = await supabase
      .from('beaches')
      .select('id, break_type')
      .in('id', beachIds);

    // Create a map for quick lookup
    const beachTypeMap = new Map<string, string>();
    if (beachDetails) {
      for (const beach of beachDetails) {
        if (beach.break_type) {
          beachTypeMap.set(beach.id, beach.break_type);
        }
      }
    }

    // BATCH QUERY 3: Get learned preferences - single query
    const learnedPrefs = await getUserSurfPreferences(userId);

    // BATCH QUERY 4: Get implicit preferences - single query
    const implicitPrefs = await getImplicitPreferences(userId);

    // Now process each beach in memory (no more DB queries)
    for (const { beachId, forecast, baseScore } of beaches) {
      let score = baseScore;
      let personalized = false;
      const breakdown = {
        base: baseScore,
        onboardingPrefs: 0,
        learnedPrefs: 0,
        implicitPrefs: 0,
        affinity: 0,
      };

      // 1. Apply onboarding preferences (from profile)
      if (profile) {
        // Match wave size preference
        if (profile.preferred_wave_size && profile.preferred_wave_size !== 'any') {
          if (matchesWaveSize(forecast, profile.preferred_wave_size)) {
            score += 10;
            breakdown.onboardingPrefs += 10;
            personalized = true;
          }
        }

        // Match break type preference (using pre-loaded map)
        if (profile.preferred_break_type && profile.preferred_break_type !== 'any') {
          const beachType = beachTypeMap.get(beachId);
          if (beachType === profile.preferred_break_type) {
            score += 8;
            breakdown.onboardingPrefs += 8;
            personalized = true;
          }
        }
      }

      // 2. Apply learned preferences
      if (learnedPrefs && learnedPrefs.confidence > 0.5) {
        // Match learned wave range
        if (matchesLearnedWaveRange(forecast, learnedPrefs)) {
          const bonus = 15 * learnedPrefs.confidence;
          score += bonus;
          breakdown.learnedPrefs += bonus;
          personalized = true;
        }

        // Match learned wind preferences
        if (matchesLearnedWindPrefs(forecast, learnedPrefs)) {
          const bonus = 10 * learnedPrefs.confidence;
          score += bonus;
          breakdown.learnedPrefs += bonus;
          personalized = true;
        }

        // Match learned tide preferences
        if (matchesLearnedTidePrefs(forecast, learnedPrefs)) {
          const bonus = 8 * learnedPrefs.confidence;
          score += bonus;
          breakdown.learnedPrefs += bonus;
          personalized = true;
        }
      }

      // 3. Apply implicit preferences
      if (implicitPrefs && implicitPrefs.confidence > 0.1) {
        // Confidence blend: implicit fills the gap left by explicit
        const explicitConf = learnedPrefs?.confidence ?? 0;
        const implicitWeight = implicitPrefs.confidence * (1 - explicitConf);

        if (implicitWeight > 0.1) {
          const beachType = beachTypeMap.get(beachId);
          const isTopEngaged = isTopEngagedBeach(beachId, implicitPrefs);

          const implicitBonus = calculateImplicitBonus(
            {
              wave_height_ft: parseFloat(forecast.wave_height || '0') || null,
              wave_period_s: parseFloat(forecast.wave_period || '0'),
              wind_speed_mph: parseFloat(forecast.wind_speed || '0'),
            },
            beachType ?? null,
            isTopEngaged,
            implicitPrefs,
            implicitWeight
          );

          if (implicitBonus.total > 0) {
            score += implicitBonus.total;
            breakdown.implicitPrefs = implicitBonus.total;
            personalized = true;
          }
        }
      }

      // 4. Apply beach affinity (from pre-loaded map)
      const affinity = affinityMap.get(beachId);
      if (affinity && affinity.affinity_score > 10) {
        const affinityBonus = Math.min(affinity.affinity_score * 0.15, 15);
        score += affinityBonus;
        breakdown.affinity = affinityBonus;
        personalized = true;
      }

      results.set(beachId, {
        score: Math.min(100, Math.round(score)),
        personalized,
        breakdown,
      });
    }
  } catch (error) {
    // Graceful degradation - return base scores on error
    console.error(`Error batch personalizing scores for user ${userId}:`, error);
    for (const { beachId, baseScore } of beaches) {
      results.set(beachId, {
        score: Math.round(baseScore),
        personalized: false,
        breakdown: {
          base: baseScore,
          onboardingPrefs: 0,
          learnedPrefs: 0,
          implicitPrefs: 0,
          affinity: 0,
        },
      });
    }
  }

  return results;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if forecast matches onboarding wave size preference
 *
 * Wave size ranges:
 * - small: 1-3 ft
 * - medium: 3-6 ft
 * - large: 6+ ft
 *
 * @param forecast - The forecast to check
 * @param pref - User's wave size preference
 * @returns True if forecast matches preference
 *
 * @example
 * matchesWaveSize(forecast, 'medium') // Returns true if wave_height is 3-6 ft
 */
export function matchesWaveSize(
  forecast: EnhancedForecastEntity,
  pref: string
): boolean {
  const height = parseFloat(forecast.wave_height || '0');

  switch (pref) {
    case 'small':
      return height >= 1 && height <= 3;
    case 'medium':
      return height > 3 && height <= 6;
    case 'large':
      return height > 6;
    default:
      return false;
  }
}

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
  const height = parseFloat(forecast.wave_height || '0');
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
  const windSpeed = parseFloat(forecast.wind_speed || '0');
  const windDir = parseFloat(forecast.wind_direction || '0');

  // Check wind speed tolerance
  if (prefs.max_wind_mph !== null && !isNaN(windSpeed)) {
    if (windSpeed > prefs.max_wind_mph) return false;
  }

  // Check wind direction preference (within ±30 degrees)
  if (prefs.preferred_wind_directions && prefs.preferred_wind_directions.length > 0 && !isNaN(windDir)) {
    const matches = prefs.preferred_wind_directions.some((prefDir) => {
      const diff = Math.abs(windDir - prefDir);
      // Handle wrapping around 0/360
      return diff <= 30 || diff >= 330;
    });

    if (!matches) return false;
  }

  // If we have max_wind_mph but no direction prefs, just check speed
  if (prefs.max_wind_mph !== null) {
    return windSpeed <= prefs.max_wind_mph;
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

  return prefs.preferred_tide_statuses.includes(forecast.tide_status);
}
