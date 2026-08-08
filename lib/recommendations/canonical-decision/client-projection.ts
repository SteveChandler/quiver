import type {
  SurfDiscoveryRecommendation,
  SurfDiscoveryResponse,
} from "@/types/personalization";

function emptyProjection(
  discovery: SurfDiscoveryResponse,
): SurfDiscoveryResponse {
  return {
    ...discovery,
    recommendations: [],
    includedRecommendations: [],
    recommendationsV2: undefined,
    regionalCall: "",
    eveningTransition: undefined,
  };
}

export function projectCanonicalDiscoverySurface(
  discovery: SurfDiscoveryResponse,
): SurfDiscoveryResponse {
  const decision = discovery.sessionDecision;
  const expiresAt = Date.parse(decision?.expiresAt ?? "");
  const createdAt = Date.parse(decision?.createdAt ?? "");
  if (
    !decision
    || decision.verdict === "no"
    || !decision.selection
    || !Number.isFinite(expiresAt)
    // Both stamps are server-authored; a decision without a valid createdAt,
    // or with a non-positive lifetime, grants no authority. Rejecting it here
    // keeps the expiry-timer bounds in use-surf-discovery from ever seeing it.
    || !Number.isFinite(createdAt)
    || createdAt >= expiresAt
    || Date.now() >= expiresAt
  ) {
    return emptyProjection(discovery);
  }
  const selection = decision.selection;

  const candidates: SurfDiscoveryRecommendation[] = [
    ...discovery.recommendations,
    ...(discovery.includedRecommendations ?? []),
  ];
  const selected = candidates.find(
    (candidate) =>
      candidate.recommendationId === selection.candidateId &&
      candidate.beach.id === selection.beachId,
  );
  if (!selected) return emptyProjection(discovery);

  return {
    ...discovery,
    recommendations: [selected],
    includedRecommendations: [],
    recommendationsV2: undefined,
    regionalCall: "",
    eveningTransition: undefined,
  };
}
