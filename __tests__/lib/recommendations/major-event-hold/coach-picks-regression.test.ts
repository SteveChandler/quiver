/**
 * @jest-environment node
 */

import {
  buildCoachPicksMajorEventHoldCandidates,
  sanitizeCoachPicksForMajorEventHold,
} from "@/lib/recommendations/major-event-hold/adapters/legacy";
import { evaluateMajorEventHoldCandidates } from "@/lib/recommendations/major-event-hold/service";
import type { RecommendationAvailability } from "@/lib/recommendations/major-event-hold/types";

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
  candidates: readonly unknown[],
  decisions: Awaited<ReturnType<typeof evaluateMajorEventHoldCandidates>>,
) => SanitizedCoachResponse;

describe("Coach Picks enforce regression", () => {
  it("filters a held pick and preserves an allowed pick using real decisions", async () => {
    const asOf = new Date("2026-07-20T12:00:00.000Z");
    const heldBeachId = "11111111-1111-4111-8111-111111111111";
    const allowedBeachId = "22222222-2222-4222-8222-222222222222";
    const response = {
      picks: [
        {
          beach_id: heldBeachId,
          beach_name: "Held Coach Pick",
          coach_score: 91,
        },
        {
          beach_id: allowedBeachId,
          beach_name: "Allowed Coach Pick",
          coach_score: 84,
        },
      ],
    };
    const candidates = buildCoachPicksMajorEventHoldCandidates(
      response.picks,
      asOf,
    );
    const decisions = await evaluateMajorEventHoldCandidates(
      {
        candidates,
        profileExperience: "advanced",
        mode: "enforce",
        asOf,
      },
      {
        resolveHolds: async () => ({
          state: "resolved",
          holds: [
            {
              recordId: "44444444-4444-4444-8444-444444444444",
              holdId: "33333333-3333-4333-8333-333333333333",
              version: 1,
              status: "active",
              scopeBeachIds: [heldBeachId],
              validFrom: "2026-07-20T00:00:00.000Z",
              validUntil: "2026-07-21T00:00:00.000Z",
              affectedCohorts: ["advanced"],
              action: "suppress_positive",
              expiresAt: "2026-07-21T00:00:00.000Z",
            },
          ],
        }),
        audit: async () => undefined,
      },
    );

    expect(decisions).toHaveLength(2);
    expect(decisions[0].evaluation.reasonCode).toBe("major_event_hold");
    expect(decisions[1].evaluation.outcome).toBe("allow");

    const sanitize =
      sanitizeCoachPicksForMajorEventHold as unknown as CoachSanitizer;
    const result = sanitize(response, candidates, decisions);

    expect(result.picks).toEqual([response.picks[1]]);
    expect(result.recommendationAvailability).toEqual({
      state: "available",
      holdEpoch: decisions[0].evaluation.holdEpoch,
      resolutionAsOf: asOf.toISOString(),
    });
    expect(JSON.stringify(result)).not.toMatch(/holdIds|evaluation/);
  });

  it("fails closed when candidate identity is not bound to the response", async () => {
    const asOf = new Date("2026-07-20T12:00:00.000Z");
    const response = {
      picks: [
        {
          beach_id: "11111111-1111-4111-8111-111111111111",
          beach_name: "Coach Pick",
          coach_score: 91,
        },
      ],
    };
    const candidates = buildCoachPicksMajorEventHoldCandidates(
      [
        {
          ...response.picks[0],
          beach_id: "22222222-2222-4222-8222-222222222222",
        },
      ],
      asOf,
    );
    const decisions = await evaluateMajorEventHoldCandidates(
      {
        candidates,
        profileExperience: "advanced",
        mode: "enforce",
        asOf,
      },
      {
        resolveHolds: async () => ({ state: "resolved", holds: [] }),
        audit: async () => undefined,
      },
    );

    const sanitize =
      sanitizeCoachPicksForMajorEventHold as unknown as CoachSanitizer;
    const result = sanitize(response, candidates, decisions);

    expect(result.picks).toEqual([]);
    expect(result.recommendationAvailability).toEqual({
      state: "none",
      reasonCode: "hold_state_unavailable",
      holdEpoch: decisions[0].evaluation.holdEpoch,
      resolutionAsOf: asOf.toISOString(),
    });
  });
});
