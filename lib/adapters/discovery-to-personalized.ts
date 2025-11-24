/**
 * Discovery-to-Personalized Adapter
 *
 * Adapts SurfDiscoveryRecommendation to PersonalizedForecastRecommendation format.
 * This enables the ForecastTab to consume discovery service data while maintaining
 * backward compatibility with the PersonalizedForecastCard component.
 *
 * KEY DIFFERENCES HANDLED:
 * - Discovery has 6-part detailed subscores → mapped to 4-part breakdown
 * - Discovery includes warnings → ignored (not in personalized format)
 * - Discovery includes matchQuality → derived from score in personalized
 * - Discovery may include distance data (GPS Phase 2) → ignored
 * - Personalized includes metadata counts → provided separately
 *
 * @module lib/adapters/discovery-to-personalized
 */

import type {
  SurfDiscoveryRecommendation,
  SurfDiscoveryResponse,
  PersonalizedForecastRecommendation,
} from '@/types/personalization';

/**
 * Adapt a single discovery recommendation to personalized format
 *
 * Maps the detailed 6-part discovery scoring into the 4-part personalized breakdown.
 * The mapping preserves the key scoring components while simplifying presentation:
 *
 * - base: Wave height fit (primary condition metric)
 * - onboardingPrefs: Period energy score (user skill/preference alignment)
 * - learnedPrefs: Wind + Tide alignment (learned from history)
 * - affinity: Beach familiarity bonus
 *
 * @param recommendation - Discovery recommendation to adapt
 * @returns Personalized forecast recommendation
 */
export function adaptDiscoveryRecommendation(
  recommendation: SurfDiscoveryRecommendation
): Omit<
  PersonalizedForecastRecommendation,
  'total_beaches_count' | 'available_beaches_count' | 'partial_success'
> {
  const { subscores } = recommendation;

  // Map 6-part detailed subscores to 4-part simplified breakdown
  // This maintains the core scoring logic while simplifying UI presentation
  const breakdown = {
    // Primary condition: Wave height fit
    base: subscores.waveHeightFit,

    // User preferences from onboarding: Swell period/energy
    onboardingPrefs: subscores.periodEnergyScore,

    // Learned preferences: Wind and tide alignment combined
    // These factors are learned from user's session history
    learnedPrefs: subscores.windAlignment + subscores.tideFit,

    // Beach familiarity from session history
    affinity: subscores.affinityBonus,
  };

  return {
    beach: recommendation.beach,
    window: recommendation.window,
    forecast: recommendation.forecast,
    score: recommendation.score,
    personalized: true, // Discovery always personalizes based on user data
    breakdown,
    summary: recommendation.summary,
    reasons: recommendation.reasons.slice(0, 4), // Limit to 4 reasons for mobile UI
    generated_at: recommendation.generated_at,
  };
}

/**
 * Adapt discovery response to personalized format
 *
 * Converts the top discovery recommendation to personalized format,
 * including metadata about the discovery search.
 *
 * @param response - Full discovery response
 * @returns Personalized recommendation or null if no recommendations
 *
 * @example
 * const discovery = await discoverSurfSpots(userId, { maxResults: 1 });
 * const personalized = adaptDiscoveryResponse(discovery);
 */
export function adaptDiscoveryResponse(
  response: SurfDiscoveryResponse
): PersonalizedForecastRecommendation | null {
  if (response.recommendations.length === 0) {
    return null;
  }

  const topRecommendation = response.recommendations[0];
  const adapted = adaptDiscoveryRecommendation(topRecommendation);

  return {
    ...adapted,
    total_beaches_count: response.metadata.totalBeachesConsidered,
    available_beaches_count: response.metadata.successfulForecasts,
    partial_success: response.metadata.partialSuccess,
  };
}

/**
 * Adapt multiple discovery recommendations to personalized format
 *
 * Useful for batch processing or comparison scenarios.
 *
 * @param recommendations - Array of discovery recommendations
 * @param metadata - Discovery metadata (for counts)
 * @returns Array of personalized recommendations
 */
export function adaptDiscoveryRecommendations(
  recommendations: SurfDiscoveryRecommendation[],
  metadata: SurfDiscoveryResponse['metadata']
): PersonalizedForecastRecommendation[] {
  return recommendations.map((rec) => {
    const adapted = adaptDiscoveryRecommendation(rec);
    return {
      ...adapted,
      total_beaches_count: metadata.totalBeachesConsidered,
      available_beaches_count: metadata.successfulForecasts,
      partial_success: metadata.partialSuccess,
    };
  });
}
