import type {
  MajorEventHoldCandidate,
  MajorEventHoldCandidateDecision,
  RecommendationAvailability,
} from "../types";
import type {
  SurfDiscoveryRecommendation,
  SurfDiscoveryResponse,
} from "@/types/personalization";
import { resolveMajorEventHoldBoundary } from "./shared";

export type MajorEventHoldSurfDiscoveryResponse = SurfDiscoveryResponse & {
  recommendationAvailability: RecommendationAvailability;
};

function serializedInstant(value: unknown): unknown {
  if (Object.prototype.toString.call(value) !== "[object Date]") return value;
  const milliseconds = Date.prototype.getTime.call(value);
  return Number.isFinite(milliseconds)
    ? new Date(milliseconds).toISOString()
    : null;
}

function legacyIdentity(recommendation: SurfDiscoveryRecommendation): unknown {
  return {
    candidateId: recommendation.recommendationId,
    beachId: recommendation.beach?.id,
    startsAt: serializedInstant(recommendation.window?.start),
    endsAt: serializedInstant(recommendation.window?.end),
  };
}

function v2Identity(item: {
  recommendation_id: string;
  beach: { id: string };
  window: { start: string; end: string };
}): unknown {
  return {
    candidateId: item.recommendation_id,
    beachId: item.beach?.id,
    startsAt: item.window?.start,
    endsAt: item.window?.end,
  };
}

function hasDuplicateIds(
  values: readonly unknown[],
  getId: (value: unknown) => unknown,
): boolean {
  const ids = values.map(getId);
  return new Set(ids).size !== ids.length;
}

export function sanitizeSurfDiscoveryForMajorEventHold(
  response: Readonly<SurfDiscoveryResponse>,
  candidates: readonly MajorEventHoldCandidate[],
  decisions: readonly MajorEventHoldCandidateDecision[],
): MajorEventHoldSurfDiscoveryResponse {
  const includedRecommendations = response.includedRecommendations ?? [];
  const v2Items = response.recommendationsV2?.items ?? [];
  const serializedCandidates: unknown[] = [
    ...response.recommendations.map(legacyIdentity),
    ...includedRecommendations.map(legacyIdentity),
    ...v2Items.map(v2Identity),
    ...(response.recommendationsV2?.hero
      ? [v2Identity(response.recommendationsV2.hero)]
      : []),
    ...(response.recommendationsV2?.watch_window
      ? [v2Identity(response.recommendationsV2.watch_window)]
      : []),
  ];
  if (
    hasDuplicateIds(
      [...response.recommendations, ...includedRecommendations],
      (value) => (value as SurfDiscoveryRecommendation).recommendationId,
    ) ||
    hasDuplicateIds(
      response.recommendations,
      (value) => (value as SurfDiscoveryRecommendation).recommendationId,
    ) ||
    hasDuplicateIds(
      includedRecommendations,
      (value) => (value as SurfDiscoveryRecommendation).recommendationId,
    ) ||
    hasDuplicateIds(
      v2Items,
      (value) => (value as { recommendation_id?: unknown }).recommendation_id,
    )
  ) {
    serializedCandidates.push(null);
  }
  const boundary = resolveMajorEventHoldBoundary(
    candidates,
    serializedCandidates,
    decisions,
  );
  const isAllowed = (candidateId: string | undefined): boolean =>
    typeof candidateId === "string" &&
    boundary.allowedCandidateIds.has(candidateId);
  const recommendations = response.recommendations.filter((item) =>
    isAllowed(item.recommendationId),
  );
  const sanitizedIncludedRecommendations =
    response.includedRecommendations?.filter((item) =>
      isAllowed(item.recommendationId),
    );
  const recommendationsV2 = response.recommendationsV2
    ? {
        ...response.recommendationsV2,
        hero: isAllowed(response.recommendationsV2.hero?.recommendation_id)
          ? response.recommendationsV2.hero
          : null,
        items: response.recommendationsV2.items.filter((item) =>
          isAllowed(item.recommendation_id),
        ),
        watch_window: isAllowed(
          response.recommendationsV2.watch_window?.recommendation_id,
        )
          ? response.recommendationsV2.watch_window
          : null,
      }
    : undefined;
  const hasPositiveCandidate =
    recommendations.length > 0 ||
    (sanitizedIncludedRecommendations?.length ?? 0) > 0 ||
    (recommendationsV2?.items.length ?? 0) > 0 ||
    (recommendationsV2?.hero !== null &&
      recommendationsV2?.hero !== undefined) ||
    (recommendationsV2?.watch_window !== null &&
      recommendationsV2?.watch_window !== undefined);
  const sanitizedV2 =
    recommendationsV2 && !hasPositiveCandidate
      ? {
          ...recommendationsV2,
          state: "no_good_window" as const,
          hero: null,
          items: [],
          watch_window: null,
          empty_state: { title: null, body: null, action_label: null },
        }
      : recommendationsV2;
  const shouldClearSecondaryCopy =
    boundary.recommendationAvailability.state === "none" ||
    boundary.blockedCandidateIds.size > 0;

  return {
    ...response,
    recommendations,
    includedRecommendations: sanitizedIncludedRecommendations,
    recommendationsV2: sanitizedV2,
    regionalCall:
      hasPositiveCandidate && !shouldClearSecondaryCopy
        ? response.regionalCall
        : "",
    eveningTransition:
      hasPositiveCandidate && !shouldClearSecondaryCopy
        ? response.eveningTransition
        : undefined,
    lockedBestSpotTeaser:
      hasPositiveCandidate && !shouldClearSecondaryCopy
        ? response.lockedBestSpotTeaser
        : null,
    recommendationAvailability: boundary.recommendationAvailability,
  };
}
