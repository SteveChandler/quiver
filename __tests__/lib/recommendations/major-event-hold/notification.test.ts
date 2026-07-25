/**
 * @jest-environment node
 */

import {
  resolveNotificationMajorEventHold,
  type NotificationMajorEventHoldEvaluator,
} from "@/lib/recommendations/major-event-hold/adapters/notification";
import type {
  MajorEventHoldCandidate,
  MajorEventHoldCandidateDecision,
} from "@/lib/recommendations/major-event-hold/types";

const BEACH_ID = "11111111-1111-4111-8111-111111111111";
const STARTS_AT = "2026-07-17T07:00:00.000Z";
const ENDS_AT = "2026-07-18T07:00:00.000Z";
const MODE_EXPECTATIONS = [
  ["off", "allowed"],
  ["shadow", "allowed"],
  ["enforce", "suppressed"],
] as const;

function firingPayload(): Record<string, unknown> {
  return {
    cohort: "free_home_firing",
    title: "Good window at your home break",
    body: "Check today's forecast, and log a session if you paddle out.",
    beach_id: null,
    policy_context: {
      kind: "positive_session_recommendation",
      beach_id: BEACH_ID,
      starts_at: STARTS_AT,
      ends_at: ENDS_AT,
    },
  };
}

function decisionFor(
  candidate: MajorEventHoldCandidate,
  state: "allowed" | "blocked" | "unavailable",
): MajorEventHoldCandidateDecision {
  const reasonCode =
    state === "blocked" ? "major_event_hold" : "hold_state_unavailable";
  if (state === "allowed") {
    return {
      candidateId: candidate.candidateId,
      evaluation: {
        outcome: "allow",
        holdIds: [],
        holdEpoch: "epoch-clear",
      },
      recommendationAvailability: {
        state: "available",
        holdEpoch: "epoch-clear",
      },
    };
  }

  return {
    candidateId: candidate.candidateId,
    evaluation: {
      outcome: "explicit_none",
      reasonCode,
      holdIds: state === "blocked" ? ["hold-1"] : [],
      ...(state === "blocked" ? { expiresAt: ENDS_AT } : {}),
      holdEpoch: `epoch-${state}`,
    },
    recommendationAvailability: {
      state: "none",
      reasonCode,
      ...(state === "blocked" ? { expiresAt: ENDS_AT } : {}),
      holdEpoch: `epoch-${state}`,
    },
  };
}

function evaluatorReturning(
  state: "allowed" | "blocked" | "unavailable",
): jest.MockedFunction<NotificationMajorEventHoldEvaluator> {
  return jest.fn(async ({ candidates }) => {
    const candidate = candidates[0] as MajorEventHoldCandidate;
    return [decisionFor(candidate, state)];
  });
}

describe("notification major-event hold adapter", () => {
  function homeMorningPayload(expiresAt: string): Record<string, unknown> {
    return {
      verdict: "YES",
      beach_id: BEACH_ID,
      forecast_at: STARTS_AT,
      title: "Go this morning",
      body: "A clean window is lining up.",
      policy_context: {
        kind: "positive_session_recommendation",
        beach_id: BEACH_ID,
        starts_at: STARTS_AT,
        ends_at: ENDS_AT,
      },
      session_decision: {
        schemaVersion: "canonical-session-decision.v1",
        engineVersion: "rules.v1",
        decisionId: "a".repeat(64),
        createdAt: "2026-07-17T06:55:00.000Z",
        expiresAt,
        scope: {
          kind: "plan_next_session",
          windowStart: "2026-07-17T06:55:00.000Z",
          windowEnd: ENDS_AT,
          timezone: "UTC",
        },
        verdict: "go",
        decisionBasis: "physical_fallback",
        reasonCode: "selected_go",
        selection: {
          candidateId: "recommendation-1",
          beachId: BEACH_ID,
          beachName: "Test Beach",
          windowStart: STARTS_AT,
          windowEnd: ENDS_AT,
          timezone: "UTC",
          forecastRef: {
            forecastId: "forecast-1",
            beachId: BEACH_ID,
            forecastAt: STARTS_AT,
          },
          skillEligibility: {
            skill: "beginner",
            state: "eligible",
            reasonCodes: [],
          },
          evidence: {
            conditionScore: 82,
            recommendationLabel: "Worth it",
            personalMatch: null,
          },
        },
        skillEligibility: {
          skill: "beginner",
          state: "eligible",
          reasonCodes: [],
        },
        holdEpoch: "epoch-clear",
      },
    };
  }

  it("allows a home morning push only while its exact canonical decision is fresh", async () => {
    const evaluateCandidates = evaluatorReturning("allowed");
    const result = await resolveNotificationMajorEventHold(
      {
        eventId: "event-home-canonical",
        type: "home_morning_call",
        payload: homeMorningPayload("2026-07-17T07:10:00.000Z"),
        profileExperience: "beginner",
        mode: "enforce",
        asOf: new Date("2026-07-17T07:00:00.000Z"),
      },
      { evaluateCandidates },
    );

    expect(result).toMatchObject({ status: "allowed" });
    expect(evaluateCandidates).toHaveBeenCalledTimes(1);
  });

  it("suppresses a stale home morning push before hold evaluation", async () => {
    const evaluateCandidates = evaluatorReturning("allowed");
    const result = await resolveNotificationMajorEventHold(
      {
        eventId: "event-home-stale",
        type: "home_morning_call",
        payload: homeMorningPayload("2026-07-17T06:59:00.000Z"),
        profileExperience: "beginner",
        mode: "enforce",
        asOf: new Date("2026-07-17T07:00:00.000Z"),
      },
      { evaluateCandidates },
    );

    expect(result).toMatchObject({
      status: "suppressed",
      reasonCode: "hold_state_unavailable",
    });
    expect(evaluateCandidates).not.toHaveBeenCalled();
  });

  it("requires every positive surf notification to carry the exact fresh canonical decision", async () => {
    const evaluateCandidates = evaluatorReturning("allowed");
    const weekendPayload = homeMorningPayload(
      "2026-07-17T07:10:00.000Z",
    );
    delete weekendPayload.verdict;

    await expect(
      resolveNotificationMajorEventHold(
        {
          eventId: "event-weekend-canonical",
          type: "weekend_window",
          payload: weekendPayload,
          profileExperience: "beginner",
          mode: "enforce",
          asOf: new Date("2026-07-17T07:00:00.000Z"),
        },
        { evaluateCandidates },
      ),
    ).resolves.toMatchObject({ status: "allowed" });

    const missingDecision = { ...weekendPayload };
    delete missingDecision.session_decision;
    await expect(
      resolveNotificationMajorEventHold(
        {
          eventId: "event-weekend-missing",
          type: "weekend_window",
          payload: missingDecision,
          profileExperience: "beginner",
          mode: "enforce",
          asOf: new Date("2026-07-17T07:00:00.000Z"),
        },
        { evaluateCandidates },
      ),
    ).resolves.toMatchObject({
      status: "suppressed",
      reasonCode: "hold_state_unavailable",
    });
  });

  it("suppresses a positive alert when its canonical selection does not match the outbound window", async () => {
    const evaluateCandidates = evaluatorReturning("allowed");
    const payload = homeMorningPayload("2026-07-17T07:10:00.000Z");
    delete payload.verdict;
    payload.forecast_at = "2026-07-17T08:00:00.000Z";

    const result = await resolveNotificationMajorEventHold(
      {
        eventId: "event-forecast-mismatch",
        type: "forecast_alert",
        payload,
        profileExperience: "beginner",
        mode: "enforce",
        asOf: new Date("2026-07-17T07:00:00.000Z"),
      },
      { evaluateCandidates },
    );

    expect(result).toMatchObject({
      status: "suppressed",
      reasonCode: "hold_state_unavailable",
    });
    expect(evaluateCandidates).not.toHaveBeenCalled();
  });

  it("binds a firing first-session nudge to its exact internal beach/day context", async () => {
    const evaluateCandidates = evaluatorReturning("allowed");

    const result = await resolveNotificationMajorEventHold(
      {
        eventId: "event-firing",
        type: "log_session_nudge",
        payload: {
          cohort: "free_home_firing",
          title: "Good window at your home break",
          body: "Check today's forecast, and log a session if you paddle out.",
          beach_id: null,
          policy_context: {
            kind: "positive_session_recommendation",
            beach_id: BEACH_ID,
            starts_at: STARTS_AT,
            ends_at: ENDS_AT,
          },
        },
        profileExperience: "beginner",
        mode: "enforce",
      },
      { evaluateCandidates },
    );

    expect(evaluateCandidates).toHaveBeenCalledWith(
      expect.objectContaining({
        candidates: [
          {
            candidateId: "notification:event-firing",
            beachId: BEACH_ID,
            startsAt: STARTS_AT,
            endsAt: ENDS_AT,
          },
        ],
        profileExperience: "beginner",
        mode: "enforce",
      }),
    );
    expect(result).toMatchObject({
      status: "allowed",
      candidate: {
        beachId: BEACH_ID,
        startsAt: STARTS_AT,
        endsAt: ENDS_AT,
      },
    });
  });

  it.each(MODE_EXPECTATIONS)(
    "%s mode returns %s for a valid candidate with a blocking decision",
    async (mode, expectedStatus) => {
      const evaluateCandidates = evaluatorReturning("blocked");

      const result = await resolveNotificationMajorEventHold(
        {
          eventId: `event-blocked-${mode}`,
          type: "log_session_nudge",
          payload: firingPayload(),
          profileExperience: "beginner",
          mode,
        },
        { evaluateCandidates },
      );

      expect(result).toMatchObject(
        expectedStatus === "suppressed"
          ? { status: "suppressed", reasonCode: "major_event_hold" }
          : { status: "allowed" },
      );
    },
  );

  it.each(MODE_EXPECTATIONS)(
    "%s mode returns %s when hold resolution is unavailable for a valid candidate",
    async (mode, expectedStatus) => {
      const evaluateCandidates = evaluatorReturning("unavailable");

      const result = await resolveNotificationMajorEventHold(
        {
          eventId: `event-unavailable-${mode}`,
          type: "log_session_nudge",
          payload: firingPayload(),
          profileExperience: "beginner",
          mode,
        },
        { evaluateCandidates },
      );

      expect(result).toMatchObject(
        expectedStatus === "suppressed"
          ? { status: "suppressed", reasonCode: "hold_state_unavailable" }
          : { status: "allowed" },
      );
    },
  );

  it.each(MODE_EXPECTATIONS)(
    "%s mode returns %s when the evaluator throws for a valid candidate",
    async (mode, expectedStatus) => {
      const evaluateCandidates: NotificationMajorEventHoldEvaluator = jest.fn(
        async () => {
          throw new Error("hold evaluator unavailable");
        },
      );

      const result = await resolveNotificationMajorEventHold(
        {
          eventId: `event-throw-${mode}`,
          type: "log_session_nudge",
          payload: firingPayload(),
          profileExperience: "beginner",
          mode,
        },
        { evaluateCandidates },
      );

      expect(result).toMatchObject(
        expectedStatus === "suppressed"
          ? { status: "suppressed", reasonCode: "hold_state_unavailable" }
          : { status: "allowed" },
      );
    },
  );

  it("fails a malformed firing context closed in enforce mode", async () => {
    const evaluateCandidates: NotificationMajorEventHoldEvaluator = jest.fn(
      async () => {
        const decision: MajorEventHoldCandidateDecision = {
          candidateId: null,
          evaluation: {
            outcome: "explicit_none",
            reasonCode: "hold_state_unavailable",
            holdIds: [],
            holdEpoch: "epoch-unavailable",
          },
          recommendationAvailability: {
            state: "none",
            reasonCode: "hold_state_unavailable",
            holdEpoch: "epoch-unavailable",
          },
        };
        return [decision];
      },
    );

    const result = await resolveNotificationMajorEventHold(
      {
        eventId: "event-malformed",
        type: "log_session_nudge",
        payload: {
          cohort: "free_home_firing",
          title: "Good window at your home break",
          body: "Check today's forecast, and log a session if you paddle out.",
          policy_context: {
            kind: "positive_session_recommendation",
            beach_id: BEACH_ID,
            starts_at: STARTS_AT,
            ends_at: STARTS_AT,
          },
        },
        profileExperience: "beginner",
        mode: "enforce",
      },
      { evaluateCandidates },
    );

    expect(result).toMatchObject({
      status: "suppressed",
      reasonCode: "hold_state_unavailable",
      auditCode: "major_event_hold",
      candidate: null,
    });
  });

  it("does not treat ordinary growth or objective safety notifications as positive sessions", async () => {
    const evaluateCandidates = evaluatorReturning("blocked");

    for (const input of [
      {
        eventId: "event-growth",
        type: "log_session_nudge",
        payload: {
          cohort: "free_home",
          title: "Start your surf log",
          body: "Add your first session when you paddle out.",
        },
      },
      {
        eventId: "event-swell",
        type: "swell_watch",
        payload: {
          beach_id: BEACH_ID,
          forecast_at: STARTS_AT,
          title: "Swell Watch",
          body: "A significant swell is arriving.",
        },
      },
      {
        eventId: "event-home-no",
        type: "home_morning_call",
        payload: {
          verdict: "NO",
          beach_id: BEACH_ID,
          forecast_at: STARTS_AT,
          title: "Not this morning",
          body: "The window does not line up.",
        },
      },
    ]) {
      await expect(
        resolveNotificationMajorEventHold(
          {
            ...input,
            profileExperience: "beginner",
            mode: "enforce",
          },
          { evaluateCandidates },
        ),
      ).resolves.toEqual({ status: "not_applicable" });
    }

    expect(evaluateCandidates).not.toHaveBeenCalled();
  });
});
