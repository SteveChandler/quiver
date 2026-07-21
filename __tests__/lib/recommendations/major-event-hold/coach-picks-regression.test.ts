/**
 * @jest-environment node
 */

import { sanitizeCoachPicksForMajorEventHold } from "@/lib/recommendations/major-event-hold/adapters/legacy";
import { evaluateMajorEventHoldCandidates } from "@/lib/recommendations/major-event-hold/service";
import type {
  MajorEventHoldCandidateDecision,
  RecommendationAvailability,
} from "@/lib/recommendations/major-event-hold/types";

interface CoachPick {
  beach_id: string;
  beach_name: string;
  coach_score: number;
}

interface SanitizedCoachResponse {
  picks: CoachPick[];
  recommendationAvailability: RecommendationAvailability;
}

type CoachSanitizer = (
  response: { picks: readonly CoachPick[] },
  decisions: readonly MajorEventHoldCandidateDecision[],
) => SanitizedCoachResponse;

describe("Coach Picks enforce regression", () => {
  it("fails the unsupported Coach surface closed with a real enforce decision", async () => {
    const decisions = await evaluateMajorEventHoldCandidates(
      {
        candidates: [null],
        profileExperience: "advanced",
        mode: "enforce",
      },
      {
        resolveHolds: async () => ({ state: "resolved", holds: [] }),
        audit: async () => undefined,
      },
    );

    expect(decisions).toHaveLength(1);
    expect(decisions[0]).toMatchObject({
      candidateId: null,
      evaluation: {
        outcome: "explicit_none",
        reasonCode: "hold_state_unavailable",
      },
      recommendationAvailability: {
        state: "none",
        reasonCode: "hold_state_unavailable",
      },
    });

    const sanitize =
      sanitizeCoachPicksForMajorEventHold as unknown as CoachSanitizer;
    const result = sanitize(
      {
        picks: [
          {
            beach_id: "11111111-1111-4111-8111-111111111111",
            beach_name: "Stale Coach Pick",
            coach_score: 91,
          },
        ],
      },
      decisions,
    );

    expect(result.picks).toEqual([]);
    expect(result.recommendationAvailability).toMatchObject({
      state: "none",
      reasonCode: "hold_state_unavailable",
    });
    expect(JSON.stringify(result)).not.toMatch(/holdIds|evaluation/);
  });
});
