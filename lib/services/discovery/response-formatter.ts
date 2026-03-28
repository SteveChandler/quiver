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

  return `${matchDesc} at ${beach.name} - ${window.waveHeight} with ${window.wind}.${warningSuffix}`;
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

// ============================================================================
// Message Building
// ============================================================================

/**
 * Build natural language message from score, reasons, and warnings
 *
 * Format: "{Label} - {TopReasons}. Watch: {FirstWarning}"
 *
 * Examples:
 * - "Worth it - Good wave size, Offshore wind. Watch: Tide is high"
 * - "Maybe - Surfable conditions. Watch: Wind picking up"
 * - "Skip - Conditions not favorable"
 *
 * @param score - Total score (0-100)
 * @param reasons - Positive factors for recommendation
 * @param warnings - Cautions or concerns
 * @returns Natural language message
 *
 * @example
 * buildDiscoveryMessage(75, ['Good wave size', 'Offshore wind'], ['Tide is high'])
 * // => "Worth it - Good wave size, Offshore wind. Watch: Tide is high"
 */
export function buildDiscoveryMessage(
  score: number,
  reasons: string[],
  warnings: string[]
): string {
  const label = getRecommendationLabel(score);

  if (label === 'Skip') {
    const skipReason = warnings[0] || 'Conditions not favorable';
    return `Skip - ${skipReason}`;
  }

  // Pick top 2 reasons for concise message
  const topReasons = reasons.slice(0, 2).join(', ');
  let message = `${label} - ${topReasons || 'Conditions look surfable'}`;

  // Add first warning if present
  if (warnings.length > 0) {
    message += `. Watch: ${warnings[0]}`;
  }

  return message;
}
