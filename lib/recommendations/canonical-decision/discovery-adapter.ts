import "server-only";

import type { SurfDiscoveryRecommendation } from "@/types/personalization";
import { buildCanonicalSessionDecision } from "./engine";
import type {
  BuildCanonicalSessionDecisionInput,
  CanonicalDecisionCandidate,
  CanonicalSessionDecision,
} from "./types";

export type BuildCanonicalDecisionFromSurfDiscoveryInput = Omit<
  BuildCanonicalSessionDecisionInput,
  "candidates"
> & {
  recommendations: readonly SurfDiscoveryRecommendation[];
};

function serializeInstant(value: unknown): string {
  if (value instanceof Date) {
    return Number.isFinite(value.getTime()) ? value.toISOString() : "";
  }
  if (typeof value !== "string") return "";
  const milliseconds = Date.parse(value);
  return Number.isFinite(milliseconds)
    ? new Date(milliseconds).toISOString()
    : "";
}

function toCanonicalCandidate(
  recommendation: SurfDiscoveryRecommendation,
): CanonicalDecisionCandidate {
  return {
    candidateId: recommendation.recommendationId ?? "",
    beachId: recommendation.beach?.id ?? "",
    beachName: recommendation.beach?.name ?? "",
    beachSkillLevel: recommendation.beach?.skill_level,
    windowStart: serializeInstant(recommendation.window?.start),
    windowEnd: serializeInstant(recommendation.window?.end),
    timezone: recommendation.window?.timezone ?? "",
    forecastId: recommendation.forecast?.id ?? "",
    forecastAt: serializeInstant(recommendation.forecast?.forecast_at),
    waveHeight: recommendation.forecast?.wave_height,
    utilityScore: recommendation.score,
    recommendationLabel: recommendation.recommendationLabel,
  };
}

export function buildCanonicalDecisionFromSurfDiscovery(
  input: BuildCanonicalDecisionFromSurfDiscoveryInput,
): CanonicalSessionDecision {
  return buildCanonicalSessionDecision({
    anchorTime: input.anchorTime,
    scope: input.scope,
    profileExperience: input.profileExperience,
    recommendationAvailability: input.recommendationAvailability,
    candidates: input.recommendations.map(toCanonicalCandidate),
  });
}
