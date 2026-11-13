/**
 * Response Formatter for Surf Discovery
 *
 * Handles formatting and enrichment of discovery recommendations:
 * - Photo enrichment from database and fallbacks
 * - Human-readable summary generation
 * - Recommendation labels (Worth it/Maybe/Skip)
 * - Natural language message building
 *
 * @module lib/services/discovery/response-formatter
 */

import type {
  SurfDiscoveryRecommendation,
  PersonalizedForecastWindow,
  DetailedScore,
} from '@/types/personalization';
import type { Beach } from '@/types/database';
import { createSupabaseServiceRoleClient } from '@/lib/supabase/server';
import { withApprovedPhotos } from '@/lib/supabase/query-builders';
import { FALLBACK_IMAGE_BY_NAME } from '@/lib/constants/featured-beaches-config';
import type { RecommendationLabel } from '@/lib/scoring';
import type { ConditionCharacterCategory, SmallWeakReason } from '@/lib/domains/scoring';
import { getRideabilityBand, type BoardClass } from '@/lib/domains/rideability';
import type { SkillLevel } from '@/lib/domains/user-preferences';
import { joinReasonSentences, type ScoringReasonFact } from '@/lib/domains/scoring/reason-sentences';

// Re-export FALLBACK_IMAGE_BY_NAME for backward compatibility
export { FALLBACK_IMAGE_BY_NAME };

// ============================================================================
// Photo Enrichment
// ============================================================================

/**
 * Enrich recommendations with beach photo URLs
 *
 * Photo resolution order:
 * 1. Approved photo from beach_photos table
 * 2. Named fallback from FALLBACK_IMAGE_BY_NAME
 * 3. null (component will render gradient)
 *
 * @param recommendations - Discovery recommendations to enrich
 * @returns Recommendations with photo_url populated
 */
export async function enrichWithPhotos(
  recommendations: SurfDiscoveryRecommendation[]
): Promise<SurfDiscoveryRecommendation[]> {
  if (recommendations.length === 0) return recommendations;

  const supabase = createSupabaseServiceRoleClient();
  const beachIds = recommendations.map((r) => r.beach.id);

  // Fetch approved photos for all beaches in one query
  const baseQuery = supabase
    .from('beach_photos')
    .select('beach_id, image_url')
    .in('beach_id', beachIds)
    .order('fetched_at', { ascending: false });

  const { data: photos } = await withApprovedPhotos(baseQuery);

  // Build beach_id -> photo_url map (first photo per beach)
  const photoMap = new Map<string, string>();
  if (photos) {
    for (const photo of photos) {
      if (!photoMap.has(photo.beach_id)) {
        photoMap.set(photo.beach_id, photo.image_url);
      }
    }
  }

  // Enrich each recommendation
  return recommendations.map((rec) => {
    // Try database photo first
    let photoUrl = photoMap.get(rec.beach.id) || null;

    // Fall back to named fallback
    if (!photoUrl) {
      photoUrl = FALLBACK_IMAGE_BY_NAME[rec.beach.name as keyof typeof FALLBACK_IMAGE_BY_NAME] || null;
    }

    return {
      ...rec,
      beach: {
        ...rec.beach,
        photo_url: photoUrl,
      },
    };
  });
}

// ============================================================================
// Summary Generation
// ============================================================================

/**
 * Generate human-readable summary for discovery recommendation.
 *
 * Format: "{MatchQuality} at {BeachName} - {WaveHeight} with {Wind}. {Warning?}"
 *
 * @param beach - Beach being recommended
 * @param window - Optimal surf window
 * @param score - Detailed scoring breakdown
 * @returns Human-readable summary string
 *
 * @example
 * generateDiscoverySummary(beach, window, score)
 * // => "Excellent match at Black's Beach - 4-5 ft with 5 mph offshore. Below your preferred size."
 */
export function generateDiscoverySummary(
  beach: Beach,
  window: PersonalizedForecastWindow,
  score: DetailedScore
): string {
  const matchDesc =
    score.matchQuality === 'perfect'
      ? 'Perfect match'
      : score.matchQuality === 'excellent'
        ? 'Excellent match'
        : score.matchQuality === 'good'
          ? 'Good match'
          : score.matchQuality === 'minimal'
            ? 'Minimal conditions'
            : 'Fair conditions';

  const preferredSizeWarning = score.warnings.find(
    (w) =>
      w.startsWith('Below your preferred size') ||
      w.startsWith('Above your preferred size')
  );

  const warningSuffix = preferredSizeWarning ? ` ${preferredSizeWarning}.` : '';

  const wind = window.wind?.trim();
  const windClause = wind && wind.toLowerCase() !== 'unknown' ? ` with ${wind}` : '';
  const height = window.waveHeight?.trim();
  const heightClause = height && height.toLowerCase() !== 'unknown' ? ` - ${height}` : '';

  return `${matchDesc} at ${beach.name}${heightClause}${windClause}.${warningSuffix}`;
}

// ============================================================================
// Recommendation Labels
// ============================================================================

/**
 * Get recommendation label from score value
 *
 * Score-based thresholds:
 * - >= 70: "Worth it" - conditions are good, go surf!
 * - 40-69: "Maybe" - conditions are marginal, use judgment
 * - < 40: "Skip" - conditions not favorable
 *
 * @param score - Total score (0-100)
 * @returns Recommendation label
 *
 * @example
 * getRecommendationLabel(85) // => "Worth it"
 * getRecommendationLabel(55) // => "Maybe"
 * getRecommendationLabel(25) // => "Skip"
 */
export function getRecommendationLabel(score: number): RecommendationLabel {
  if (score >= 70) return 'Worth it';
  if (score >= 40) return 'Maybe';
  return 'Skip';
}

/**
 * Character categories whose conditions are positive enough to earn a
 * "Worth it" recommendation. Anything else (medium-rough, medium-mixed,
 * small-weak, large-rough, flat) caps at "Maybe" even when the score is
 * in the perfect/excellent band.
 *
 * Closes the PR 4 Horseshoe-screenshot gap: a 75-ish score (excellent
 * band) with `medium-mixed` character no longer surfaces as "Worth it"
 * just because the wind subscore is dominated by other factors.
 */
const POSITIVE_CHARACTER_CATEGORIES: ReadonlySet<ConditionCharacterCategory> =
  new Set<ConditionCharacterCategory>([
    'large-clean',
    'medium-clean',
    'small-quality',
    'small-clean',
  ]);

// A small, soft day that caps an experienced surfer is a good day for a
// learner. Onshore chop and marginal small-weak days stay capped.
const LEARNER_MEDIUM_MIXED_MAX_FT = 3;
const LEARNER_WEAK_SWELL_MIN_FT = 1;
const LEARNER_WEAK_SWELL_MIN_PERIOD_S = 6;

interface LearnerGateContext {
  skill: SkillLevel;
  boardClass: BoardClass | null;
  waveHeightFt: number;
  wavePeriodS: number;
  smallWeakReason: SmallWeakReason | null;
}

/**
 * Recommendation label gated on the character category, not score alone.
 *
 * Score gives the headline number; character gates whether the headline
 * promotes the day to "Worth it" or caps it at "Maybe". This is the
 * defensive layer that catches the "high score on a windy day" edge case.
 *
 * Falls back to the score-only `getRecommendationLabel` when no character
 * is available (legacy callers, character-classification failed).
 *
 * @param score - Total composite score (0-100)
 * @param characterCategory - Optional character category from getConditionCharacter
 * @param learner - Optional rating context; a learner gets extra "Worth it" cases
 * @returns Recommendation label
 */
export function getRecommendationLabelGated(
  score: number,
  characterCategory: ConditionCharacterCategory | null | undefined,
  learner?: LearnerGateContext
): RecommendationLabel {
  const baseLabel = getRecommendationLabel(score);

  // Only the positive label needs gating. Maybe / Skip already match the
  // bad-character verdict.
  if (baseLabel !== 'Worth it') return baseLabel;

  if (!characterCategory) return baseLabel;

  if (POSITIVE_CHARACTER_CATEGORIES.has(characterCategory)) return 'Worth it';

  if (!learner || !isLearnerContext(learner.skill, learner.boardClass)) return 'Maybe';

  return isLearnerWorthIt(characterCategory, learner) ? 'Worth it' : 'Maybe';
}

export function isLearnerContext(skill: SkillLevel, boardClass: BoardClass | null): boolean {
  return (
    skill === 'beginner' ||
    (boardClass !== null && getRideabilityBand(skill, boardClass).prefersClean)
  );
}

function isLearnerWorthIt(
  characterCategory: ConditionCharacterCategory,
  learner: LearnerGateContext
): boolean {
  if (characterCategory === 'medium-mixed') {
    return learner.waveHeightFt < LEARNER_MEDIUM_MIXED_MAX_FT;
  }
  if (characterCategory === 'small-weak') {
    return (
      learner.smallWeakReason === 'weak-swell' &&
      learner.waveHeightFt >= LEARNER_WEAK_SWELL_MIN_FT &&
      learner.wavePeriodS >= LEARNER_WEAK_SWELL_MIN_PERIOD_S
    );
  }
  return false;
}

// ============================================================================
// Message Building
// ============================================================================

/**
 * Build natural language message from score, reasons, and warnings
 *
 * Format: "{Label}. {TopReasons} Watch: {FirstWarning}"
 *
 * Examples:
 * - "Good. Good size at 3–4 ft, with solid swell period behind it. Watch: Onshore by noon"
 * - "Maybe. Good swell angle (W). Watch: Wind picking up"
 * - "Skip. Strong onshore wind"
 * - "" when there is no reason (no stand-in clause)
 *
 * @param score - Total score (0-100)
 * @param reasons - Positive factors for recommendation
 * @param warnings - Cautions or concerns
 * @param reasonFacts - Codes behind the scorer sentences, so two of them join as one sentence
 * @returns Natural language message
 */
export function buildDiscoveryMessage(
  score: number,
  reasons: string[],
  warnings: string[],
  recommendationLabel?: RecommendationLabel,
  reasonFacts?: readonly ScoringReasonFact[],
): string {
  const label = recommendationLabel ?? getRecommendationLabel(score);

  // No reason means no message: a generic clause would read as a real explanation.
  if (label === 'Skip') {
    const skipReason = warnings[0];
    return skipReason ? `Skip. ${skipReason}` : '';
  }

  // Pick top 2 reasons for concise message
  const topReasons = joinReasonSentences(reasons.slice(0, 2), reasonFacts);
  // With no reason, a real warning is still worth saying; with neither, say nothing.
  if (!topReasons) return warnings[0] ? `${label}. Watch: ${warnings[0]}` : '';
  let message = `${label}. ${topReasons}`;

  // Add first warning if present
  if (warnings.length > 0) {
    message += ` Watch: ${warnings[0]}`;
  }

  return message;
}
