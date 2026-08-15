import {
  sanitizeSurfDiscoveryForMajorEventHold,
  type MajorEventHoldSurfDiscoveryResponse,
} from "@/lib/recommendations/major-event-hold/adapters/surf-discovery";
import { resolveMajorEventHoldBoundary } from "@/lib/recommendations/major-event-hold/adapters/shared";
import { evaluateMajorEventHoldCandidates } from "@/lib/recommendations/major-event-hold/service";
import type {
  MajorEventHoldCandidate,
  MajorEventHoldCandidateDecision,
  RecommendationAvailability,
} from "@/lib/recommendations/major-event-hold/types";
import type {
  SurfDiscoveryRecommendation,
  SurfDiscoveryResponse,
} from "@/types/personalization";

export type EvaluateDiscoveryHoldCandidates = (input: {
  candidates: readonly MajorEventHoldCandidate[];
  profileExperience: unknown;
}) => Promise<MajorEventHoldCandidateDecision[]>;

interface EnforceDiscoveryHoldInput {
  recommendations: readonly SurfDiscoveryRecommendation[];
  profileExperience: unknown;
  maxResults: number;
  isPrimaryEligible: (recommendation: SurfDiscoveryRecommendation) => boolean;
  preserveSafetyReasons?: boolean;
  evaluateCandidates?: EvaluateDiscoveryHoldCandidates;
}

export interface EnforcedDiscoveryHoldPool {
  allAllowedRecommendations: SurfDiscoveryRecommendation[];
  primaryRecommendations: SurfDiscoveryRecommendation[];
  decisionRecommendations?: SurfDiscoveryRecommendation[];
  recommendationAvailability: RecommendationAvailability;
}

function withSafetyReason(
  recommendation: SurfDiscoveryRecommendation,
  reason: "water_quality_closure" | "hold_state_unavailable",
): SurfDiscoveryRecommendation {
  return {
    ...recommendation,
    safetyOverrideReasons: Array.from(
      new Set([...(recommendation.safetyOverrideReasons ?? []), reason]),
    ),
  };
}

function serializedInstant(value: unknown): string {
  if (Object.prototype.toString.call(value) === "[object Date]") {
    const milliseconds = Date.prototype.getTime.call(value);
    return Number.isFinite(milliseconds)
      ? new Date(milliseconds).toISOString()
      : "";
  }
  return typeof value === "string" ? value : "";
}

function deterministicRecommendationId(
  recommendation: SurfDiscoveryRecommendation,
): string {
  const forecastAt =
    typeof recommendation.forecast?.forecast_at === "string"
      ? recommendation.forecast.forecast_at
      : serializedInstant(recommendation.window?.start);
  const entityId =
    recommendation.kind === "custom_spot" && recommendation.customSpotId
      ? `custom:${recommendation.customSpotId}`
      : `beach:${recommendation.beach?.id ?? ""}`;
  return `${entityId}:${forecastAt}`;
}

function withDeterministicRecommendationId(
  recommendation: SurfDiscoveryRecommendation,
): SurfDiscoveryRecommendation {
  const recommendationId = deterministicRecommendationId(recommendation);
  return recommendation.recommendationId === recommendationId
    ? recommendation
    : { ...recommendation, recommendationId };
}

function candidateForRecommendation(
  recommendation: SurfDiscoveryRecommendation,
): MajorEventHoldCandidate {
  return {
    candidateId: recommendation.recommendationId ?? "",
    beachId: recommendation.beach?.id ?? "",
    startsAt: serializedInstant(recommendation.window?.start),
    endsAt: serializedInstant(recommendation.window?.end),
  };
}

export function buildSurfDiscoveryMajorEventHoldCandidates(
  response: Pick<
    SurfDiscoveryResponse,
    "recommendations" | "includedRecommendations"
  >,
): MajorEventHoldCandidate[] {
  return [
    ...response.recommendations,
    ...(response.includedRecommendations ?? []),
  ].map(candidateForRecommendation);
}

export async function enforceMajorEventHoldBeforeDiscoveryTruncation({
  recommendations,
  profileExperience,
  maxResults,
  isPrimaryEligible,
  preserveSafetyReasons = false,
  evaluateCandidates = (input) =>
    evaluateMajorEventHoldCandidates({
      ...input,
      applyWaterQualityHolds: true,
    }),
}: EnforceDiscoveryHoldInput): Promise<EnforcedDiscoveryHoldPool> {
  const identifiedRecommendations = recommendations.map(
    withDeterministicRecommendationId,
  );
  const candidates = identifiedRecommendations.map(candidateForRecommendation);
  const decisions = await evaluateCandidates({
    candidates,
    profileExperience,
  });
  const boundary = resolveMajorEventHoldBoundary(
    candidates,
    candidates,
    decisions,
  );
  const allAllowedRecommendations = identifiedRecommendations.filter(
    ({ recommendationId }) =>
      typeof recommendationId === "string" &&
      boundary.allowedCandidateIds.has(recommendationId),
  );
  const decisionRecommendations =
    preserveSafetyReasons &&
    allAllowedRecommendations.length === 0 &&
    (boundary.recommendationAvailability.reasonCode === "water_quality_hold" ||
      boundary.recommendationAvailability.reasonCode ===
        "hold_state_unavailable")
      ? identifiedRecommendations.map((recommendation) =>
          withSafetyReason(
            recommendation,
            boundary.recommendationAvailability.reasonCode ===
              "water_quality_hold"
              ? "water_quality_closure"
              : "hold_state_unavailable",
          ),
        )
      : undefined;

  return {
    allAllowedRecommendations,
    primaryRecommendations: allAllowedRecommendations
      .filter(isPrimaryEligible)
      .slice(0, maxResults),
    decisionRecommendations,
    recommendationAvailability: boundary.recommendationAvailability,
  };
}

export async function sanitizeSurfDiscoveryForSerializationMajorEventHold(
  response: Readonly<SurfDiscoveryResponse>,
  profileExperience: unknown,
  evaluateCandidates: EvaluateDiscoveryHoldCandidates =
    (input) =>
      evaluateMajorEventHoldCandidates({
        ...input,
        applyWaterQualityHolds: true,
      }),
): Promise<MajorEventHoldSurfDiscoveryResponse> {
  const candidates = buildSurfDiscoveryMajorEventHoldCandidates(response);
  const decisions = await evaluateCandidates({
    candidates,
    profileExperience,
  });
  return sanitizeSurfDiscoveryForMajorEventHold(
    response,
    candidates,
    decisions,
  );
}
