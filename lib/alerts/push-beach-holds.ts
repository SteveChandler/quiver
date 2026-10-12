import { resolveMajorEventHoldBoundary } from "@/lib/recommendations/major-event-hold/adapters/shared";
import { evaluateMajorEventHoldCandidates } from "@/lib/recommendations/major-event-hold/service";
import type {
  MajorEventHoldCandidate,
  MajorEventHoldCandidateDecision,
  RecommendationHoldReasonCode,
} from "@/lib/recommendations/major-event-hold/types";

const HOUR_MS = 60 * 60 * 1000;

/** Held candidate id → why. A candidate absent from the map is clear to name. */
export type HeldPushBeaches = Map<string, RecommendationHoldReasonCode>;

export type ResolveHeldPushBeaches = (args: {
  candidates: readonly MajorEventHoldCandidate[];
  profileExperience: unknown;
  asOf: Date;
}) => Promise<HeldPushBeaches>;

type EvaluateCandidates = (
  input: Parameters<typeof evaluateMajorEventHoldCandidates>[0],
) => Promise<MajorEventHoldCandidateDecision[]>;

/** A one-hour forecast slot, the window a push names when it has no longer one. */
export function forecastSlotCandidate(
  candidateId: string,
  beachId: string,
  forecastAt: string,
): MajorEventHoldCandidate {
  return {
    candidateId,
    beachId,
    startsAt: forecastAt,
    endsAt: new Date(Date.parse(forecastAt) + HOUR_MS).toISOString(),
  };
}

/**
 * Which beaches a push may name. Applies the rule the in-app recommendation
 * surfaces (Week Scout, discovery) already use, so a push never names a beach
 * the app hides: only candidates the hold boundary allows are clear, and an
 * unknown hold state withholds the beach.
 */
export async function resolveHeldPushBeaches(
  args: Parameters<ResolveHeldPushBeaches>[0],
  evaluateCandidates: EvaluateCandidates = evaluateMajorEventHoldCandidates,
): Promise<HeldPushBeaches> {
  const held: HeldPushBeaches = new Map();
  if (args.candidates.length === 0) return held;

  const decisions = await evaluateCandidates({
    candidates: args.candidates,
    profileExperience: args.profileExperience,
    asOf: args.asOf,
    applyWaterQualityHolds: true,
  });
  const boundary = resolveMajorEventHoldBoundary(
    args.candidates,
    args.candidates,
    decisions,
  );
  for (const candidate of args.candidates) {
    if (boundary.allowedCandidateIds.has(candidate.candidateId)) continue;
    const decision = decisions.find((value) => value.candidateId === candidate.candidateId);
    held.set(
      candidate.candidateId,
      decision?.evaluation.reasonCode ?? "hold_state_unavailable",
    );
  }
  return held;
}
