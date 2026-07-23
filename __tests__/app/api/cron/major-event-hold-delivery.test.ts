/**
 * @jest-environment node
 */

import {
  resolveNotificationMajorEventHold,
  type NotificationMajorEventHoldEvaluator,
} from "@/lib/recommendations/major-event-hold/adapters/notification";
import type { MajorEventHoldCandidateDecision } from "@/lib/recommendations/major-event-hold/types";

const BEACH_ID = "11111111-1111-4111-8111-111111111111";

describe("major-event hold notification delivery boundary", () => {
  it("suppresses a positive alert queued before hold activation", async () => {
    const evaluateCandidates: NotificationMajorEventHoldEvaluator = jest.fn(
      async ({ candidates, asOf }) => {
        const candidate = candidates[0] as {
          candidateId: string;
          startsAt: string;
          endsAt: string;
        };
        expect(asOf?.toISOString()).toBe("2026-07-17T16:05:00.000Z");
        const decision: MajorEventHoldCandidateDecision = {
          candidateId: candidate.candidateId,
          evaluation: {
            outcome: "explicit_none",
            reasonCode: "major_event_hold",
            holdIds: ["hold-activated-after-enqueue"],
            expiresAt: candidate.endsAt,
            holdEpoch: "epoch-active",
          },
          recommendationAvailability: {
            state: "none",
            reasonCode: "major_event_hold",
            expiresAt: candidate.endsAt,
            holdEpoch: "epoch-active",
          },
        };
        return [decision];
      },
    );

    const result = await resolveNotificationMajorEventHold(
      {
        eventId: "queued-at-2026-07-17T15:55:00.000Z",
        type: "forecast_alert",
        payload: {
          alert_date: "2026-07-17",
          title: "Conditions lining up today",
          body: "A clean morning window",
          beach_id: BEACH_ID,
          forecast_at: "2026-07-17T17:00:00.000Z",
          session_decision: {
            schemaVersion: "canonical-session-decision.v1",
            engineVersion: "rules.v1",
            decisionId: "b".repeat(64),
            createdAt: "2026-07-17T16:04:00.000Z",
            expiresAt: "2026-07-17T18:30:00.000Z",
            scope: {
              kind: "plan_next_session",
              windowStart: "2026-07-17T17:00:00.000Z",
              windowEnd: "2026-07-17T18:00:00.000Z",
              timezone: "America/Los_Angeles",
            },
            verdict: "go",
            reasonCode: "selected_go",
            selection: {
              candidateId: "delivery-boundary-test",
              beachId: BEACH_ID,
              beachName: "Test Beach",
              windowStart: "2026-07-17T17:00:00.000Z",
              windowEnd: "2026-07-17T18:00:00.000Z",
              timezone: "America/Los_Angeles",
              forecastRef: {
                forecastId: "forecast-delivery-test",
                beachId: BEACH_ID,
                forecastAt: "2026-07-17T17:00:00.000Z",
              },
              skillEligibility: {
                skill: "beginner",
                state: "eligible",
                reasonCodes: [],
              },
            },
            skillEligibility: {
              skill: "beginner",
              state: "eligible",
              reasonCodes: [],
            },
            holdEpoch: "delivery-boundary-test",
          },
        },
        profileExperience: "beginner",
        mode: "enforce",
        asOf: new Date("2026-07-17T16:05:00.000Z"),
      },
      { evaluateCandidates },
    );

    expect(result).toMatchObject({
      status: "suppressed",
      reasonCode: "major_event_hold",
      auditCode: "major_event_hold",
    });
  });
});
