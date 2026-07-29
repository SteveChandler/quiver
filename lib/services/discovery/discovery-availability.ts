import type { RecommendationAvailability } from '@/lib/recommendations/major-event-hold/types';

/**
 * Shared serialization rules for `recommendationAvailability`.
 *
 * A zero-candidate discovery cannot produce a verified hold decision, so the
 * major-event boundary reports `hold_state_unavailable`. That is an operational
 * state, never a successful answer: native clients reject any `state: 'none'`
 * payload whose reasonCode isn't `major_event_hold`, so serializing it as HTTP
 * 200 turns a legitimate "nothing to recommend" into a dead-end client error.
 *
 * `/api/surf/discover` and `/api/surf/week-scout` adopted these rules in the
 * 2026-07-26 hotfix; `/api/surf/call` was missed and is covered here too.
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

export function isUnresolvedHoldAvailability(
  availability: RecommendationAvailability | null | undefined,
): boolean {
  return (
    availability?.state === 'none' &&
    availability.reasonCode === 'hold_state_unavailable'
  );
}

/**
 * Resolve the availability a single-beach (scoped) discovery should serialize.
 *
 * Precedence mirrors the discover route: an explicit major-event hold is
 * authoritative, a successful empty result is normalized to `no_candidates`,
 * and anything else falls through to whatever the boundary reported.
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
      state: 'none',
      reasonCode: 'hold_state_unavailable',
      holdEpoch: fallbackHoldEpoch,
    }
  );
}
