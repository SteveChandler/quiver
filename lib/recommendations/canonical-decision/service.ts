import "server-only";

import { CANDIDATE_POOL_LIMIT } from "@/lib/services/discovery/candidate-pool-builder";
import { discoverSurfSpots } from "@/lib/services/surf-discovery-service";
import type {
  SurfDiscoveryOptions,
  SurfDiscoveryResponse,
} from "@/types/personalization";
import { buildCanonicalDecisionFromSurfDiscovery } from "./discovery-adapter";
import { rankBeaches } from "@/lib/recommendations/selection";
import type {
  CanonicalDecisionScope,
  CanonicalSessionDecision,
} from "./types";

export interface ResolveCanonicalSessionDecisionInput {
  userId: string;
  profileExperience: unknown;
  anchorTime: string;
  scope: CanonicalDecisionScope;
  /** Restrict verdict selection to these beaches while preserving discovery context. */
  candidateBeachIds?: readonly string[];
  discoveryOptions: Omit<SurfDiscoveryOptions, "maxResults">;
}

export interface CanonicalSessionDecisionServiceDependencies {
  discoverSurfSpots?: (
    userId: string,
    options: SurfDiscoveryOptions,
  ) => Promise<SurfDiscoveryResponse>;
}

export interface CanonicalSessionDecisionContext {
  decision: CanonicalSessionDecision;
  discovery: SurfDiscoveryResponse;
}

export async function resolveCanonicalSessionDecisionContext(
  input: ResolveCanonicalSessionDecisionInput,
  dependencies: CanonicalSessionDecisionServiceDependencies = {},
): Promise<CanonicalSessionDecisionContext> {
  const discover = dependencies.discoverSurfSpots ?? discoverSurfSpots;
  const discovery = await discover(input.userId, {
    ...input.discoveryOptions,
    maxResults: CANDIDATE_POOL_LIMIT,
  });
  const recommendations = [
    ...discovery.recommendations,
    ...(discovery.includedRecommendations ?? []),
  ].filter((recommendation, index, all) => (
    all.findIndex((candidate) => (
      candidate.recommendationId === recommendation.recommendationId
    )) === index
  ));
  const candidateBeachIds = input.candidateBeachIds
    ? new Set(input.candidateBeachIds)
    : null;
  const decisionRecommendations = candidateBeachIds
    ? recommendations.filter((recommendation) =>
        candidateBeachIds.has(recommendation.beach.id),
      )
    : recommendations;
  const rankedDecisionRecommendations = await rankBeaches(
    decisionRecommendations.map((recommendation, index) => ({
      id: recommendation.beach.id,
      recommendation,
      index,
    })),
    {
      compare: (left, right) => left.index - right.index,
    },
  );

  const decision = buildCanonicalDecisionFromSurfDiscovery({
    anchorTime: input.anchorTime,
    scope: input.scope,
    profileExperience: input.profileExperience,
    // Discovery always reports availability; a missing value is an absent
    // hold, not a hold. Genuine major-event holds still arrive as
    // `state: "none"` with their own reason code.
    recommendationAvailability: discovery.recommendationAvailability ?? {
      state: "available",
      holdEpoch: "no-hold",
    },
    recommendations: rankedDecisionRecommendations.map(
      ({ recommendation }) => recommendation,
    ),
  });

  return { decision, discovery };
}

export async function resolveCanonicalSessionDecision(
  input: ResolveCanonicalSessionDecisionInput,
  dependencies: CanonicalSessionDecisionServiceDependencies = {},
): Promise<CanonicalSessionDecision> {
  const { decision } = await resolveCanonicalSessionDecisionContext(
    input,
    dependencies,
  );
  return decision;
}
