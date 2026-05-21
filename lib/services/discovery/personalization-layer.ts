/**
 * Personalization Layer — Batch Personalization for Homepage Discovery
 *
 * Provides a batch-friendly alternative to the per-beach N+1 pattern in
 * `personalized-scoring-service.ts`. Instead of making 4-6 DB queries per
 * beach, this module pre-fetches all personalization data in 2 parallel
 * batch queries and exposes a pure-computation scoring function.
 *
 * Usage pattern:
 *   1. Call `fetchPersonalizationContext` once per discovery request.
 *   2. For each beach/forecast pair, call `calculatePersonalizationBonus`
 *      (zero DB calls, pure computation).
 *
 * @module lib/services/discovery/personalization-layer
 */

import { createSupabaseServiceRoleClient } from '@/lib/supabase/server';
import { getImplicitPreferences, calculateImplicitBonus, isTopEngagedBeach } from '@/lib/services/implicit-preferences-service';
import {
  calculateAvoidancePenalty,
  getAvoidancePatternForBeach,
  getUserSurfPreferences,
} from '@/lib/services/preference-learning-service';
import {
  matchesLearnedWaveRange,
  matchesLearnedWindPrefs,
  matchesLearnedTidePrefs,
} from '@/lib/services/personalized-scoring-service';
import { createContextLogger } from '@/lib/logger';
import type { UserImplicitPreferences } from '@/types/implicit-preferences';
import type { UserSurfPreferences } from '@/lib/services/preference-learning-service';
import type { EnhancedForecastEntity } from '@/types/forecast';
import type { Beach } from '@/types/database';

const log = createContextLogger('PersonalizationLayer');
const MAX_AFFINITY_BONUS = 4;
const AFFINITY_BONUS_SCALE = 0.05;
const MAX_CONDITION_PERSONALIZATION_BONUS = 12;
const MAX_AVOIDANCE_PERSONALIZATION_PENALTY = 6;

// ============================================================================
// Public Types
// ============================================================================

/**
 * All personalization data pre-fetched for a set of beaches.
 * Passed into `calculatePersonalizationBonus` for zero-DB-call scoring.
 */
export interface PersonalizationContext {
  /** Implicit prefs inferred from engagement patterns (null for new users) */
  implicitPrefs: UserImplicitPreferences | null;
  /** Explicit prefs learned from rated session history (null for new users) */
  learnedPrefs: UserSurfPreferences | null;
  /** Map of beachId -> affinity_score from user_beach_affinity table */
  affinityMap: Map<string, number>;
  /**
   * Pre-computed implicit weight — a confidence blend that lets implicit
   * preferences fill the gap left by explicit preferences:
   *   implicitWeight = implicitPrefs.confidence * (1 - explicitConfidence)
   * Zero-floored at 0.1 threshold to suppress noise from very weak signals.
   */
  implicitWeight: number;
}

/**
 * Personalization bonus result for a single beach/forecast pair.
 * Values are bounded so personalization can break close calls without
 * overriding the base surf setup.
 */
export interface PersonalizationBonusResult {
  /** Total bonus to add to the beach score (affinityBonus + personalizationBonus) */
  total: number;
  /** Affinity bonus component, based on user_beach_affinity.affinity_score */
  affinityBonus: number;
  /** Combined bonus from learned and implicit preferences */
  personalizationBonus: number;
  /** Soft demotion from learned negative session patterns */
  avoidancePenalty: number;
  /** Human-readable reasons, suitable for the recommendation card UI */
  reasons: string[];
}

// ============================================================================
// Batch Fetch
// ============================================================================

/**
 * Pre-fetch all personalization data for a discovery request in parallel.
 *
 * Runs two independent I/O operations concurrently:
 *   a. Implicit preference fetch (single-user record)
 *   b. Batch affinity query for all candidate beach IDs
 *
 * A third call to `getUserSurfPreferences` is skipped when `learnedPrefs` is
 * passed in from a higher-level caller that already fetched it (e.g. the
 * discovery orchestrator), avoiding a redundant DB round-trip.
 *
 * @param userId - The authenticated user ID
 * @param beachIds - All candidate beach IDs in the discovery pool
 * @param learnedPrefs - Optional pre-fetched surf preferences; re-fetched if omitted
 * @returns Populated PersonalizationContext for use with calculatePersonalizationBonus
 */
export async function fetchPersonalizationContext(
  userId: string,
  beachIds: string[],
  learnedPrefs?: UserSurfPreferences | null
): Promise<PersonalizationContext> {
  const supabase = createSupabaseServiceRoleClient();

  // Run independent fetches in parallel to avoid sequential waterfall
  const [implicitPrefs, affinityRows, resolvedLearnedPrefs] = await Promise.all([
    // (a) Implicit preferences from behavioral tracking
    getImplicitPreferences(userId).catch((err) => {
      log.warn('Failed to fetch implicit preferences, continuing without them', err);
      return null;
    }),

    // (b) Batch affinity scores for all candidate beaches
    beachIds.length > 0
      ? supabase
          .from('user_beach_affinity')
          .select('beach_id, affinity_score')
          .eq('user_id', userId)
          .in('beach_id', beachIds)
          .then(({ data, error }) => {
            if (error) {
              log.warn('Failed to fetch affinity scores, continuing without them', error);
              return [] as Array<{ beach_id: string; affinity_score: number }>;
            }
            return (data ?? []) as Array<{ beach_id: string; affinity_score: number }>;
          })
      : Promise.resolve([] as Array<{ beach_id: string; affinity_score: number }>),

    // (c) Explicit learned preferences — use caller's value if already available
    learnedPrefs !== undefined
      ? Promise.resolve(learnedPrefs)
      : getUserSurfPreferences(userId).catch((err) => {
          log.warn('Failed to fetch learned surf preferences, continuing without them', err);
          return null;
        }),
  ]);

  // Build affinity lookup map
  const affinityMap = new Map<string, number>();
  for (const row of affinityRows) {
    affinityMap.set(row.beach_id, row.affinity_score);
  }

  // Compute confidence-blend implicit weight.
  // Implicit fills the gap left by explicit: as explicit confidence grows,
  // the implicit signal is down-weighted to avoid redundant boosting.
  const explicitConf = resolvedLearnedPrefs?.confidence ?? 0;
  const rawImplicitWeight = (implicitPrefs?.confidence ?? 0) * (1 - explicitConf);
  // Suppress noise from very low-confidence implicit signals
  const implicitWeight = rawImplicitWeight >= 0.1 ? rawImplicitWeight : 0;

  log.debug(
    `Personalization context built for user ${userId}: ` +
      `implicitConf=${implicitPrefs?.confidence ?? 0}, ` +
      `explicitConf=${explicitConf}, ` +
      `implicitWeight=${implicitWeight}, ` +
      `affinityBeaches=${affinityMap.size}`
  );

  return {
    implicitPrefs,
    learnedPrefs: resolvedLearnedPrefs,
    affinityMap,
    implicitWeight,
  };
}

// ============================================================================
// Pure Bonus Computation
// ============================================================================

/**
 * Calculate the personalization bonus for a single beach/forecast pair.
 *
 * This is a PURE function — no database calls, no side effects.
 * All input data comes from a pre-fetched `PersonalizationContext`.
 *
 * Bonus sources (in order):
 *   1. Learned wave range match (+15 * confidence) — from session history
 *   2. Learned wind preference match (+10 * confidence) — from session history
 *   3. Learned tide preference match (+8 * confidence) — from session history
 *   4. Implicit behavior bonus — from engagement patterns, blended by implicitWeight
 *   5. Avoidance demotion — from learned negative session patterns
 *   6. Beach affinity bonus — from user_beach_affinity.affinity_score
 *
 * @param beach - The beach being evaluated
 * @param forecast - The forecast entry selected for scoring (best window)
 * @param context - Pre-fetched personalization context for this user
 * @returns Bonus breakdown with total, components, and human-readable reasons
 */
export function calculatePersonalizationBonus(
  beach: Beach,
  forecast: EnhancedForecastEntity,
  context: PersonalizationContext
): PersonalizationBonusResult {
  let personalizationBonus = 0;
  let affinityBonus = 0;
  let avoidancePenalty = 0;
  const reasons: string[] = [];

  // ── 1–3. Learned preferences (session history) ────────────────────────────
  // Only apply when there is sufficient confidence to trust the learned model.
  const learned = context.learnedPrefs;
  if (learned && learned.confidence > 0.5) {
    const conf = learned.confidence;

    // Wave range match: +15 * confidence
    if (matchesLearnedWaveRange(forecast, learned)) {
      personalizationBonus += 15 * conf;
      reasons.push('Wave size matches your sweet spot');
    }

    // Wind preferences match: +10 * confidence
    // Copy note: onboarding never asks the user for a wind preference. This
    // signal is learned from session history, so the reason must be framed
    // as observation — not a preference they declared.
    if (matchesLearnedWindPrefs(forecast, learned)) {
      personalizationBonus += 10 * conf;
      reasons.push('Wind matches your usual sessions');
    }

    // Tide preferences match: +8 * confidence
    // Same as above — tide isn't asked in onboarding, so frame as observation.
    if (matchesLearnedTidePrefs(forecast, learned)) {
      personalizationBonus += 8 * conf;
      reasons.push('Tide matches your usual sessions');
    }
  }

  // ── 4. Implicit behavioral preferences ────────────────────────────────────
  // Blended with explicit confidence to avoid redundancy.
  if (context.implicitWeight > 0 && context.implicitPrefs !== null) {
    const forecastData = {
      wave_height_ft: parseFloat(String(forecast.wave_height ?? '0')) || null,
      wave_period_s: parseFloat(String(forecast.wave_period ?? '').replace('s', '') || '0'),
      wind_speed_mph: parseFloat(String(forecast.wind_speed ?? '0')),
    };

    const topEngaged = isTopEngagedBeach(beach.id, context.implicitPrefs);
    const implicitResult = calculateImplicitBonus(
      forecastData,
      beach.break_type ?? null,
      topEngaged,
      context.implicitPrefs,
      context.implicitWeight
    );

    if (implicitResult.total > 0) {
      personalizationBonus += implicitResult.total;
      reasons.push('Matches your surfing patterns');
    }
  }

  const positivePersonalizationBonus = Math.min(
    personalizationBonus,
    MAX_CONDITION_PERSONALIZATION_BONUS
  );

  const avoidancePattern = getAvoidancePatternForBeach(learned, beach.id);
  const avoidanceMatch = calculateAvoidancePenalty(forecast, avoidancePattern);
  if (avoidanceMatch > 0) {
    avoidancePenalty = Math.min(
      avoidanceMatch * MAX_AVOIDANCE_PERSONALIZATION_PENALTY,
      MAX_AVOIDANCE_PERSONALIZATION_PENALTY
    );
  }

  personalizationBonus = Math.max(
    -MAX_AVOIDANCE_PERSONALIZATION_PENALTY,
    positivePersonalizationBonus - avoidancePenalty
  );

  // ── 5. Beach affinity ──────────────────────────────────────────────────────
  // Small tie-breaker for beaches the user frequents.
  // Threshold at 10 matches the same guard in personalized-scoring-service.ts.
  const affinityScore = context.affinityMap.get(beach.id) ?? 0;
  if (affinityScore > 10) {
    affinityBonus = Math.min(affinityScore * AFFINITY_BONUS_SCALE, MAX_AFFINITY_BONUS);
    reasons.push("One of your go-to spots");
  }

  return {
    total: affinityBonus + personalizationBonus,
    affinityBonus,
    personalizationBonus,
    avoidancePenalty,
    reasons,
  };
}
