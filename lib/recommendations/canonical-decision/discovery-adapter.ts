import "server-only";

import type { SurfDiscoveryRecommendation } from "@/types/personalization";
import { buildCanonicalSessionDecision } from "./engine";
import type {
  BuildCanonicalSessionDecisionInput,
  CanonicalDecisionCandidate,
  CanonicalPersonalMatchEvidence,
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

function toPersonalMatchEvidence(
  recommendation: SurfDiscoveryRecommendation,
): CanonicalPersonalMatchEvidence | null {
  const similarity = recommendation.similarity;
  if (similarity?.state !== "ready") return null;

  const label = similarity.label.trim().toUpperCase();
  if (
    label !== "EPIC" &&
    label !== "GOOD" &&
    label !== "FAIR" &&
    label !== "RIDEABLE" &&
    label !== "MEH"
  ) {
    return null;
  }

  return {
    score: similarity.score,
    label,
    confidence: similarity.confidence,
    sessionCount: similarity.sessionCount,
    reasons:
      similarity.reasons.length > 0
        ? similarity.reasons
        : [similarity.reason].filter(Boolean),
  };
}

function toCanonicalCandidate(
  recommendation: SurfDiscoveryRecommendation,
): CanonicalDecisionCandidate {
  const safetyOverrideReasons = (recommendation.warnings ?? []).some(
    (warning) =>
      warning.toLowerCase().includes("water quality closure"),
  )
    ? (["water_quality_closure"] as const)
    : [];

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
    personalMatch: toPersonalMatchEvidence(recommendation),
    safetyOverrideReasons: [...safetyOverrideReasons],
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
