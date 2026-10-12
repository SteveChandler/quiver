/**
 * @jest-environment node
 */
import { forecastSlotCandidate, resolveHeldPushBeaches } from "@/lib/alerts/push-beach-holds";
import type {
  MajorEventHoldCandidate,
  MajorEventHoldCandidateDecision,
  RecommendationHoldReasonCode,
} from "@/lib/recommendations/major-event-hold/types";

const NOW = new Date("2026-10-10T13:00:00.000Z");
const CLEAR = forecastSlotCandidate("a", "11111111-1111-4111-8111-111111111111", "2026-10-10T15:00:00.000Z");
const HELD = forecastSlotCandidate("b", "22222222-2222-4222-8222-222222222222", "2026-10-10T15:00:00.000Z");

function decision(
  candidate: MajorEventHoldCandidate,
  reasonCode: RecommendationHoldReasonCode | null,
  holdEpoch = "epoch",
): MajorEventHoldCandidateDecision {
  return reasonCode === null
    ? {
        candidateId: candidate.candidateId,
        evaluation: { outcome: "allow", holdIds: [], holdEpoch },
        recommendationAvailability: { state: "available", holdEpoch },
      }
    : {
        candidateId: candidate.candidateId,
        evaluation: {
          outcome: "explicit_none",
          reasonCode,
          holdIds: reasonCode === "hold_state_unavailable" ? [] : [`hold-${candidate.candidateId}`],
          holdEpoch,
        },
        recommendationAvailability: { state: "none", reasonCode, holdEpoch },
      };
}

describe("resolveHeldPushBeaches", () => {
  it("does not look anything up when a push names no beach", async () => {
    const evaluate = jest.fn();

    await expect(resolveHeldPushBeaches({ candidates: [], profileExperience: "beginner", asOf: NOW }, evaluate))
      .resolves.toEqual(new Map());
    expect(evaluate).not.toHaveBeenCalled();
  });

  it("returns only the held candidates, with water-quality holds applied", async () => {
    const evaluate = jest.fn(async () => [decision(CLEAR, null), decision(HELD, "water_quality_hold")]);

    const held = await resolveHeldPushBeaches(
      { candidates: [CLEAR, HELD], profileExperience: "beginner", asOf: NOW },
      evaluate,
    );

    expect(held).toEqual(new Map([["b", "water_quality_hold"]]));
    expect(evaluate).toHaveBeenCalledWith({
      candidates: [CLEAR, HELD],
      profileExperience: "beginner",
      asOf: NOW,
      applyWaterQualityHolds: true,
    });
  });

  it("withholds every beach when the decisions cannot be trusted as one snapshot", async () => {
    const evaluate = jest.fn(async () => [decision(CLEAR, null, "epoch-1"), decision(HELD, null, "epoch-2")]);

    const held = await resolveHeldPushBeaches(
      { candidates: [CLEAR, HELD], profileExperience: "beginner", asOf: NOW },
      evaluate,
    );

    expect(held).toEqual(new Map([
      ["a", "hold_state_unavailable"],
      ["b", "hold_state_unavailable"],
    ]));
  });

  it("names a one-hour slot from the forecast instant", () => {
    expect(CLEAR).toEqual({
      candidateId: "a",
      beachId: "11111111-1111-4111-8111-111111111111",
      startsAt: "2026-10-10T15:00:00.000Z",
      endsAt: "2026-10-10T16:00:00.000Z",
    });
  });
});
