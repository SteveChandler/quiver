import {
  sanitizeSurfDiscoveryForMajorEventHold,
  type MajorEventHoldSurfDiscoveryResponse,
} from "@/lib/recommendations/major-event-hold/adapters/surf-discovery";
import { evaluateMajorEventHoldCandidates } from "@/lib/recommendations/major-event-hold/service";
import type {
  MajorEventHoldCandidate,
  MajorEventHoldCandidateDecision,
} from "@/lib/recommendations/major-event-hold/types";
import type {
  SurfDiscoveryRecommendation,
  SurfDiscoveryResponse,
} from "@/types/personalization";

export type EvaluateDiscoveryHoldCandidates = (input: {
  candidates: readonly MajorEventHoldCandidate[];
  profileExperience: unknown;
}) => Promise<MajorEventHoldCandidateDecision[]>;

function serializedInstant(value: unknown): string {
  if (Object.prototype.toString.call(value) === "[object Date]") {
    const milliseconds = Date.prototype.getTime.call(value);
    return Number.isFinite(milliseconds)
      ? new Date(milliseconds).toISOString()
      : "";
  }
  return typeof value === "string" ? value : "";
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
