import type { RecommendationAvailability } from '@/lib/recommendations/major-event-hold/types';

/**
 * Shared serialization rules for `recommendationAvailability`.
 *
 * Native clients reject any `state: 'none'` payload whose reasonCode isn't
 * `major_event_hold`, so these routes must only ever serialize a hold they can
 * actually name. An explicit major-event hold is authoritative; everything else
 * resolves to an available state rather than withholding the answer.
 */

/** Structural shape shared by every discovery result these routes serialize. */
export interface DiscoveryAvailabilityShape {
  recommendations: unknown[];
  includedRecommendations?: unknown[] | null;
  recommendationsV2?: {
    items: unknown[];
    hero?: unknown;
    watch_window?: unknown;
  } | null;
  recommendationAvailability?: RecommendationAvailability | null;
}

/** Availability for a discovery that succeeded but produced nothing to rank. */
export const NO_CANDIDATES_AVAILABILITY: RecommendationAvailability = {
  state: 'available',
  holdEpoch: 'no-candidates',
};

export function hasNoDiscoveryCandidates(
  discovery: DiscoveryAvailabilityShape,
): boolean {
  if (discovery.recommendations.length > 0) return false;
  if ((discovery.includedRecommendations?.length ?? 0) > 0) return false;
  if ((discovery.recommendationsV2?.items.length ?? 0) > 0) return false;
  if (discovery.recommendationsV2?.hero) return false;
  if (discovery.recommendationsV2?.watch_window) return false;

  return true;
}

export function hasExplicitMajorEventHold(
  discovery: DiscoveryAvailabilityShape,
): boolean {
  return (
    discovery.recommendationAvailability?.state === 'none' &&
    discovery.recommendationAvailability.reasonCode === 'major_event_hold'
  );
}

/**
 * Resolve the availability a single-beach (scoped) discovery should serialize.
 *
 * Precedence mirrors the discover route: an explicit major-event hold is
 * authoritative, a successful empty result is normalized to `no_candidates`,
 * and anything else falls through to whatever the boundary reported. A missing
 * availability is an absent hold, not a hold — discovery always reports one,
 * and withholding the answer on its absence is what suppressed every
 * recommendation for every user.
 */
export function resolveScopedRecommendationAvailability(
  discovery: DiscoveryAvailabilityShape,
  fallbackHoldEpoch: string,
): RecommendationAvailability {
  if (hasExplicitMajorEventHold(discovery)) {
    return discovery.recommendationAvailability as RecommendationAvailability;
  }
  if (hasNoDiscoveryCandidates(discovery)) {
    return NO_CANDIDATES_AVAILABILITY;
  }
  return (
    discovery.recommendationAvailability ?? {
      state: 'available',
      holdEpoch: fallbackHoldEpoch,
    }
  );
}
