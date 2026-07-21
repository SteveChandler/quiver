import type {
  SurfCallResult,
  SurfCallTiers,
  TierVerdict,
} from "@/lib/utils/surf-call-logic";
import type {
  MajorEventHoldCandidate,
  MajorEventHoldCandidateDecision,
  RecommendationAvailability,
} from "../types";
import {
  resolveMajorEventHoldBoundary,
  type MajorEventHoldBoundaryDecision,
} from "./shared";

export type MajorEventHoldSurfCallResult = SurfCallResult & {
  recommendationAvailability: RecommendationAvailability;
};

export type AuthorizedSurfCallTier =
  | "beginner"
  | "intermediate"
  | "advanced"
  | null;

export interface SurfCallCandidateIdentity {
  candidateId: string;
  beachId: string;
  authorizedTier: AuthorizedSurfCallTier;
}

function nonPositiveTier(): TierVerdict {
  return {
    verdict: "NO",
    trail: "",
    bestWindowStart: null,
    bestWindowEnd: null,
  };
}

function mappedUserTier(
  userTier: SurfCallResult["userTier"],
): Exclude<AuthorizedSurfCallTier, null> | null {
  if (userTier === "beginner" || userTier === "intermediate") return userTier;
  if (userTier === "advanced" || userTier === "expert") return "advanced";
  return null;
}

function isAuthorizedTier(value: unknown): value is AuthorizedSurfCallTier {
  return (
    value === null ||
    value === "beginner" ||
    value === "intermediate" ||
    value === "advanced"
  );
}

function isPositiveTier(tier: TierVerdict): boolean {
  return tier.verdict === "YES" || tier.verdict === "MAYBE";
}

function failTierContractClosed(
  candidates: readonly MajorEventHoldCandidate[],
  decisions: readonly MajorEventHoldCandidateDecision[],
): MajorEventHoldBoundaryDecision {
  return resolveMajorEventHoldBoundary(candidates, [null], decisions);
}

function sanitizeUnavailableSurfCall(
  response: Readonly<SurfCallResult>,
  boundary: MajorEventHoldBoundaryDecision,
): MajorEventHoldSurfCallResult {
  return {
    ...response,
    verdict: "NO",
    bestWindowStart: null,
    bestWindowEnd: null,
    windowMinutes: null,
    shortWindow: false,
    whySentence: "",
    score: 0,
    peakTime: null,
    trendTags: [],
    character: null,
    tiers: null,
    recommendationAvailability: boundary.recommendationAvailability,
  };
}

export function sanitizeSurfCallForMajorEventHold(
  response: Readonly<SurfCallResult>,
  identity: Readonly<SurfCallCandidateIdentity>,
  candidates: readonly MajorEventHoldCandidate[],
  decisions: readonly MajorEventHoldCandidateDecision[],
): MajorEventHoldSurfCallResult {
  const candidateId = identity?.candidateId;
  const boundary = resolveMajorEventHoldBoundary(
    candidates,
    [
      {
        candidateId,
        beachId: identity?.beachId,
        startsAt: response.bestWindowStart,
        endsAt: response.bestWindowEnd,
      },
    ],
    decisions,
  );
  if (
    typeof candidateId !== "string" ||
    !boundary.allowedCandidateIds.has(candidateId)
  ) {
    return sanitizeUnavailableSurfCall(response, boundary);
  }

  const authorizedTier = identity?.authorizedTier;
  if (!isAuthorizedTier(authorizedTier)) {
    return sanitizeUnavailableSurfCall(
      response,
      failTierContractClosed(candidates, decisions),
    );
  }
  if (authorizedTier === null) {
    return {
      ...response,
      tiers: null,
      userTier: null,
      recommendationAvailability: boundary.recommendationAvailability,
    };
  }
  if (mappedUserTier(response.userTier) !== authorizedTier) {
    return sanitizeUnavailableSurfCall(
      response,
      failTierContractClosed(candidates, decisions),
    );
  }

  const selectedTier = response.tiers?.[authorizedTier];
  if (!selectedTier) {
    return {
      ...response,
      tiers: null,
      recommendationAvailability: boundary.recommendationAvailability,
    };
  }
  if (isPositiveTier(selectedTier)) {
    const tierBoundary = resolveMajorEventHoldBoundary(
      candidates,
      [
        {
          candidateId,
          beachId: identity.beachId,
          startsAt: selectedTier.bestWindowStart,
          endsAt: selectedTier.bestWindowEnd,
        },
      ],
      decisions,
    );
    if (!tierBoundary.allowedCandidateIds.has(candidateId)) {
      return sanitizeUnavailableSurfCall(response, tierBoundary);
    }
  }

  const tiers: SurfCallTiers = {
    beginner: nonPositiveTier(),
    intermediate: nonPositiveTier(),
    advanced: nonPositiveTier(),
    [authorizedTier]: isPositiveTier(selectedTier)
      ? selectedTier
      : nonPositiveTier(),
  };
  return {
    ...response,
    tiers,
    recommendationAvailability: boundary.recommendationAvailability,
  };
}
