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
  state: "allowed" | "blocked" | "water_quality_block" | "unavailable",
): MajorEventHoldCandidateDecision {
  const reasonCode =
    state === "blocked"
      ? "major_event_hold"
      : state === "water_quality_block"
        ? "water_quality_hold"
        : "hold_state_unavailable";
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
      holdIds: state === "blocked" || state === "water_quality_block" ? ["hold-1"] : [],
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
  it("allows water-quality warnings to name the configured affected beach", async () => {
    const evaluateCandidates = jest.fn();
    const result = await resolveNotificationMajorEventHold(
      {
        eventId: "event-water-quality-warning",
        type: "water_quality",
        payload: {
          beach_id: BEACH_ID,
          title: "Water quality update",
          body: "Check the latest advisory before entering the water.",
        },
        profileExperience: "beginner",
        mode: "enforce",
      },
      { evaluateCandidates },
    );

    expect(result).toMatchObject({
      status: "allowed",
      candidate: { beachId: BEACH_ID },
    });
    expect(evaluateCandidates).not.toHaveBeenCalled();
  });

  it("evaluates a weekend snapshot window instead of suppressing a null candidate", async () => {
    const evaluateCandidates = evaluatorReturning("allowed");
    const result = await resolveNotificationMajorEventHold(
      {
        eventId: "event-weekend-window",
        type: "weekend_window",
        payload: {
          beach_id: BEACH_ID,
          forecast_at: STARTS_AT,
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

    expect(result).toMatchObject({
      status: "allowed",
      candidate: { beachId: BEACH_ID, startsAt: STARTS_AT, endsAt: ENDS_AT },
    });
    expect(evaluateCandidates).toHaveBeenCalledTimes(1);
  });

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

  it("allows a user-configured forecast alert without a canonical session decision when hold state is clear", async () => {
    const evaluateCandidates = evaluatorReturning("allowed");

    const result = await resolveNotificationMajorEventHold(
      {
        eventId: "event-forecast-alert-clear",
        type: "forecast_alert",
        payload: {
          beach_id: BEACH_ID,
          forecast_at: STARTS_AT,
          policy_context: {
            kind: "positive_session_recommendation",
            beach_id: BEACH_ID,
            starts_at: STARTS_AT,
            ends_at: ENDS_AT,
          },
        },
        profileExperience: "beginner",
        mode: "enforce",
        asOf: new Date("2026-07-17T07:00:00.000Z"),
      },
      { evaluateCandidates },
    );

    expect(result).toMatchObject({ status: "allowed" });
    expect(evaluateCandidates).toHaveBeenCalledTimes(1);
  });

  it("allows an over-length event id with a deterministic bounded candidate id", async () => {
    const eventId = "condition-alert-deliver:push:" + "x".repeat(147);
    const candidates: string[] = [];
    const evaluateCandidates: NotificationMajorEventHoldEvaluator = jest.fn(
      async ({ candidates: evaluatedCandidates }) => {
        const candidate = evaluatedCandidates[0] as MajorEventHoldCandidate;
        candidates.push(candidate.candidateId);
        return [decisionFor(candidate, "allowed")];
      },
    );
    const input = {
      eventId,
      type: "forecast_alert",
      payload: {
        beach_id: BEACH_ID,
        forecast_at: STARTS_AT,
        policy_context: {
          kind: "positive_session_recommendation",
          beach_id: BEACH_ID,
          starts_at: STARTS_AT,
          ends_at: ENDS_AT,
        },
      },
      profileExperience: "beginner",
      mode: "enforce" as const,
      asOf: new Date("2026-07-17T07:00:00.000Z"),
    };

    await expect(
      resolveNotificationMajorEventHold(input, { evaluateCandidates }),
    ).resolves.toMatchObject({ status: "allowed" });
    await expect(
      resolveNotificationMajorEventHold(input, { evaluateCandidates }),
    ).resolves.toMatchObject({ status: "allowed" });
    await expect(
      resolveNotificationMajorEventHold(
        { ...input, eventId: `${eventId}y` },
        { evaluateCandidates },
      ),
    ).resolves.toMatchObject({ status: "allowed" });

    expect(eventId).toHaveLength(176);
    expect(candidates).toHaveLength(3);
    expect(candidates[0]).toMatch(/^notification:sha256:[a-f0-9]{64}$/);
    expect(candidates[0]).toHaveLength(84);
    expect(candidates[1]).toBe(candidates[0]);
    expect(candidates[2]).not.toBe(candidates[0]);
  });

  it("delivers a user-configured alert on a held beach", async () => {
    const evaluateCandidates = jest.fn(async (input) => {
      expect(input.applyWaterQualityHolds).toBe(true);
      expect(input.waterQualityExemptBeachIds).toEqual([BEACH_ID]);
      return [decisionFor(input.candidates[0] as MajorEventHoldCandidate, "allowed")];
    });

    const result = await resolveNotificationMajorEventHold(
      {
        eventId: "event-user-alert-held-beach",
        type: "forecast_alert",
        payload: {
          beach_id: BEACH_ID,
          configured_beach_id: BEACH_ID,
          forecast_at: STARTS_AT,
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

    expect(result).toMatchObject({ status: "allowed" });
  });

  it("delivers a user-configured similarity subscription on a held beach", async () => {
    const payload = homeMorningPayload("2026-07-17T07:10:00.000Z");
    delete payload.verdict;
    payload.configured_beach_id = BEACH_ID;
    const evaluateCandidates = jest.fn(async (input) => {
      expect(input.applyWaterQualityHolds).toBe(true);
      expect(input.waterQualityExemptBeachIds).toEqual([BEACH_ID]);
      return [decisionFor(input.candidates[0] as MajorEventHoldCandidate, "allowed")];
    });

    const result = await resolveNotificationMajorEventHold(
      {
        eventId: "event-similarity-held-beach",
        type: "similarity_match",
        payload,
        profileExperience: "beginner",
        mode: "enforce",
        asOf: new Date("2026-07-17T07:00:00.000Z"),
      },
      { evaluateCandidates },
    );

    expect(result).toMatchObject({ status: "allowed" });
  });

  it("filters an unlisted future Quiver beach recommendation by default", async () => {
    const evaluateCandidates = jest.fn(async (input) => {
      expect(input.applyWaterQualityHolds).toBe(true);
      return [
        decisionFor(
          input.candidates[0] as MajorEventHoldCandidate,
          "water_quality_block",
        ),
      ];
    });

    const result = await resolveNotificationMajorEventHold(
      {
        eventId: "event-future-quiver-recommendation-held-beach",
        // Deliberately absent from the former WATER_QUALITY_NOTIFICATION_TYPES
        // allowlist: new Quiver types must inherit filtering automatically.
        type: "future_quiver_beach_recommendation",
        payload: {
          beach_id: BEACH_ID,
          configured_beach_id: BEACH_ID,
          forecast_at: STARTS_AT,
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

    expect(result).toMatchObject({
      status: "suppressed",
      reasonCode: "water_quality_hold",
      candidate: { beachId: BEACH_ID },
    });
  });

  // An unknown hold state is retried by the delivery cron; a major-event hold is
  // not. Withholding an unknown candidate per beach must not relabel it.
  it("suppresses a multi-beach alert with an unknown-hold beach as retryable", async () => {
    const OTHER_BEACH_ID = "33333333-3333-4333-8333-333333333333";
    const evaluateCandidates = jest.fn(async (input) =>
      (input.candidates as MajorEventHoldCandidate[]).map((candidate, index) => {
        const decision = decisionFor(candidate, index === 0 ? "unavailable" : "allowed");
        return {
          ...decision,
          evaluation: { ...decision.evaluation, holdEpoch: "epoch-shared" },
          recommendationAvailability: { ...decision.recommendationAvailability, holdEpoch: "epoch-shared" },
        };
      }),
    );

    const result = await resolveNotificationMajorEventHold(
      {
        eventId: "event-forecast-alert-unknown-hold",
        type: "forecast_alert",
        payload: {
          beach_id: BEACH_ID,
          forecast_at: STARTS_AT,
          matches: [
            { beach_id: BEACH_ID, window_start: STARTS_AT, window_end: ENDS_AT },
            { beach_id: OTHER_BEACH_ID, window_start: STARTS_AT, window_end: ENDS_AT },
          ],
        },
        profileExperience: "beginner",
        mode: "enforce",
      },
      { evaluateCandidates },
    );

    expect(evaluateCandidates).toHaveBeenCalled();
    expect(result).toMatchObject({
      status: "suppressed",
      reasonCode: "hold_state_unavailable",
      candidate: { beachId: BEACH_ID },
    });
  });

  describe("Daily Call and swell pushes", () => {
    const OPTION_A = "33333333-3333-4333-8333-333333333333";
    const OPTION_B = "44444444-4444-4444-8444-444444444444";
    const WINDOW_START = "2026-10-10T14:00:00.000Z";
    const WINDOW_END = "2026-10-10T16:00:00.000Z";

    function dailyCallPayload(): Record<string, unknown> {
      return {
        schema_version: "daily-call.v1",
        beach_id: BEACH_ID,
        beach_slug: "lead",
        beach_name: "Lead",
        alert_date: "2026-10-10",
        window_start: WINDOW_START,
        window_end: WINDOW_END,
        window_local: "7–9 AM",
        options: [
          { beach_id: OPTION_A, beach_slug: "a", beach_name: "A", window_start: "2026-10-10T15:00:00.000Z", window_end: "2026-10-10T17:00:00.000Z", window_local: "8–10 AM", wave_height_ft: 3, relation: "favorite" },
          { beach_id: OPTION_B, beach_slug: "b", beach_name: "B", window_start: "2026-10-10T16:00:00.000Z", window_end: "2026-10-10T18:00:00.000Z", window_local: "9–11 AM", wave_height_ft: 2, relation: "nearby" },
        ],
        drivers: [],
        wave_height_ft: 3.5,
        wave_period_s: 16,
        swell_dir: "SSW",
        wind_label: "4mph E",
        tide_label: "Rising",
        reason: "Good window",
        title: "Good window",
        title_id: "daily-1",
        comparison: null,
        swell_event_key: null,
        decision_id: "decision-1",
        session_decision: {},
      };
    }

    function swellPayload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
      return {
        schema_version: "major-swell-notification.v1",
        beach_id: BEACH_ID,
        beach_name: "Lead",
        forecast_at: WINDOW_START,
        title: "SSW swell Tue-Fri, sets to 4 ft",
        body: "A swell is coming.",
        beaches: [
          { beach_id: BEACH_ID, beach_name: "Lead", rank: 1 },
          { beach_id: OPTION_A, beach_name: "A", rank: 2, forecast_at: WINDOW_START },
          { beach_id: OPTION_B, beach_name: "B", rank: 3, forecast_at: WINDOW_START },
        ],
        ...overrides,
      };
    }

    function evaluatorHolding(
      heldBeachId: string | null,
      state: "blocked" | "water_quality_block" | "unavailable" = "water_quality_block",
    ): jest.MockedFunction<NotificationMajorEventHoldEvaluator> {
      return jest.fn(async ({ candidates }) =>
        (candidates as MajorEventHoldCandidate[]).map((candidate) => {
          const decision = decisionFor(
            candidate,
            candidate.beachId === heldBeachId ? state : "allowed",
          );
          return {
            ...decision,
            evaluation: { ...decision.evaluation, holdEpoch: "epoch-shared" },
            recommendationAvailability: { ...decision.recommendationAvailability, holdEpoch: "epoch-shared" },
          };
        }));
    }

    it("checks the Daily Call lead and both alternatives with their own windows", async () => {
      const evaluateCandidates = evaluatorHolding(null);

      const result = await resolveNotificationMajorEventHold(
        {
          eventId: "event-daily-call",
          type: "daily_call",
          payload: dailyCallPayload(),
          profileExperience: "beginner",
          mode: "enforce",
        },
        { evaluateCandidates },
      );

      expect(result).toMatchObject({ status: "allowed", candidate: { beachId: BEACH_ID } });
      expect(evaluateCandidates).toHaveBeenCalledTimes(1);
      const input = evaluateCandidates.mock.calls[0][0];
      expect(input.applyWaterQualityHolds).toBe(true);
      expect(input.waterQualityExemptBeachIds).toEqual([]);
      expect(input.candidates).toMatchObject([
        { beachId: BEACH_ID, startsAt: WINDOW_START, endsAt: WINDOW_END },
        { beachId: OPTION_A, startsAt: "2026-10-10T15:00:00.000Z", endsAt: "2026-10-10T17:00:00.000Z" },
        { beachId: OPTION_B, startsAt: "2026-10-10T16:00:00.000Z", endsAt: "2026-10-10T18:00:00.000Z" },
      ]);
    });

    it.each(["off", "shadow", "enforce"] as const)(
      "%s mode suppresses a Daily Call whose alternative is under a water-quality hold",
      async (mode) => {
        const result = await resolveNotificationMajorEventHold(
          {
            eventId: `event-daily-call-held-${mode}`,
            type: "daily_call",
            payload: dailyCallPayload(),
            profileExperience: "beginner",
            mode,
          },
          { evaluateCandidates: evaluatorHolding(OPTION_B) },
        );

        expect(result).toMatchObject({
          status: "suppressed",
          reasonCode: "water_quality_hold",
          candidate: { beachId: OPTION_B },
        });
      },
    );

    it.each(MODE_EXPECTATIONS)(
      "%s mode returns %s for a Daily Call whose alternative is under a major-event hold",
      async (mode, expectedStatus) => {
        const result = await resolveNotificationMajorEventHold(
          {
            eventId: `event-daily-call-major-${mode}`,
            type: "daily_call",
            payload: dailyCallPayload(),
            profileExperience: "beginner",
            mode,
          },
          { evaluateCandidates: evaluatorHolding(OPTION_B, "blocked") },
        );

        expect(result).toMatchObject(
          expectedStatus === "suppressed"
            ? { status: "suppressed", reasonCode: "major_event_hold", candidate: { beachId: OPTION_B } }
            : { status: "allowed" },
        );
      },
    );

    it.each(MODE_EXPECTATIONS)(
      "%s mode returns %s for a Daily Call whose alternative has an unknown hold state",
      async (mode, expectedStatus) => {
        const result = await resolveNotificationMajorEventHold(
          {
            eventId: `event-daily-call-unknown-${mode}`,
            type: "daily_call",
            payload: dailyCallPayload(),
            profileExperience: "beginner",
            mode,
          },
          { evaluateCandidates: evaluatorHolding(OPTION_B, "unavailable") },
        );

        expect(result).toMatchObject(
          expectedStatus === "suppressed"
            ? { status: "suppressed", reasonCode: "hold_state_unavailable" }
            : { status: "allowed" },
        );
      },
    );

    it("fails a Daily Call with a malformed alternative closed in enforce mode", async () => {
      const payload = dailyCallPayload();
      payload.options = [{ beach_id: "not-a-uuid", window_start: WINDOW_START, window_end: WINDOW_END }];

      const result = await resolveNotificationMajorEventHold(
        {
          eventId: "event-daily-call-malformed",
          type: "daily_call",
          payload,
          profileExperience: "beginner",
          mode: "enforce",
        },
        { evaluateCandidates: evaluatorHolding(null) },
      );

      expect(result).toMatchObject({ status: "suppressed", reasonCode: "hold_state_unavailable" });
    });

    it("checks every beach a swell push names, once each", async () => {
      const evaluateCandidates = evaluatorHolding(null);

      const result = await resolveNotificationMajorEventHold(
        {
          eventId: "event-swell-first-sighting",
          type: "swell_watch",
          payload: swellPayload(),
          profileExperience: "beginner",
          mode: "enforce",
        },
        { evaluateCandidates },
      );

      expect(result).toMatchObject({ status: "allowed", candidate: { beachId: BEACH_ID } });
      expect(evaluateCandidates.mock.calls[0][0].candidates).toMatchObject([
        { beachId: BEACH_ID, startsAt: WINDOW_START, endsAt: "2026-10-10T15:00:00.000Z" },
        { beachId: OPTION_A, startsAt: WINDOW_START, endsAt: "2026-10-10T15:00:00.000Z" },
        { beachId: OPTION_B, startsAt: WINDOW_START, endsAt: "2026-10-10T15:00:00.000Z" },
      ]);
    });

    it("uses a recommended surf window for the swell lead and its window for untimed alternatives", async () => {
      const evaluateCandidates = evaluatorHolding(null);

      await resolveNotificationMajorEventHold(
        {
          eventId: "event-swell-tide-window",
          type: "swell_watch",
          payload: swellPayload({
            surf_window: {
              state: "recommended",
              start: "2026-10-10T13:53:00.000Z",
              end: "2026-10-10T16:00:00.000Z",
              local_date: "2026-10-10",
              timezone: "America/Los_Angeles",
              reasons: [],
            },
            beaches: [
              { beach_id: BEACH_ID, beach_name: "Lead", rank: 1 },
              { beach_id: OPTION_A, beach_name: "A", rank: 2 },
            ],
          }),
          profileExperience: "beginner",
          mode: "enforce",
        },
        { evaluateCandidates },
      );

      expect(evaluateCandidates.mock.calls[0][0].candidates).toMatchObject([
        { beachId: BEACH_ID, startsAt: "2026-10-10T13:53:00.000Z", endsAt: "2026-10-10T16:00:00.000Z" },
        { beachId: OPTION_A, startsAt: "2026-10-10T13:53:00.000Z", endsAt: "2026-10-10T16:00:00.000Z" },
      ]);
    });

    it("suppresses a swell follow-up whose lead beach has a water-quality hold, in every mode", async () => {
      const payload = swellPayload({
        beaches: [{ beach_id: BEACH_ID, beach_name: "Lead", rank: 1 }],
        kind: "bigger",
      });

      for (const mode of ["off", "shadow", "enforce"] as const) {
        const result = await resolveNotificationMajorEventHold(
          {
            eventId: `event-swell-followup-${mode}`,
            type: "swell_watch",
            payload,
            profileExperience: "beginner",
            mode,
          },
          { evaluateCandidates: evaluatorHolding(BEACH_ID) },
        );
        expect(result).toMatchObject({ status: "suppressed", reasonCode: "water_quality_hold" });
      }
    });
  });

  it("suppresses a Quiver-initiated recommendation that names a held beach", async () => {
    const evaluateCandidates = jest.fn(async (input) => {
      expect(input.applyWaterQualityHolds).toBe(true);
      return [
        decisionFor(
          input.candidates[0] as MajorEventHoldCandidate,
          "water_quality_block",
        ),
      ];
    });

    const result = await resolveNotificationMajorEventHold(
      {
        eventId: "event-feedback-nudge-held-beach",
        type: "forecast_feedback_nudge",
        payload: {
          beach_id: BEACH_ID,
          beach_name: "Held Beach",
          forecast_at: STARTS_AT,
        },
        profileExperience: "beginner",
        mode: "enforce",
      },
      { evaluateCandidates },
    );

    expect(result).toMatchObject({
      status: "suppressed",
      reasonCode: "water_quality_hold",
      candidate: { beachId: BEACH_ID },
    });
  });

  it.each(MODE_EXPECTATIONS)(
    "%s mode returns %s for a user-configured forecast alert under an active hold",
    async (mode, expectedStatus) => {
      const evaluateCandidates = evaluatorReturning("blocked");

      const result = await resolveNotificationMajorEventHold(
        {
          eventId: `event-forecast-alert-held-${mode}`,
          type: "forecast_alert",
          payload: {
            beach_id: BEACH_ID,
            forecast_at: STARTS_AT,
            policy_context: {
              kind: "positive_session_recommendation",
              beach_id: BEACH_ID,
              starts_at: STARTS_AT,
              ends_at: ENDS_AT,
            },
          },
          profileExperience: "beginner",
          mode,
          asOf: new Date("2026-07-17T07:00:00.000Z"),
        },
        { evaluateCandidates },
      );

      expect(result).toMatchObject(
        expectedStatus === "suppressed"
          ? { status: "suppressed", reasonCode: "major_event_hold" }
          : { status: "allowed" },
      );
      expect(evaluateCandidates).toHaveBeenCalledTimes(1);
    },
  );

  it("requires weekend notifications to carry their exact persisted snapshot window", async () => {
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
    delete missingDecision.policy_context;
    delete missingDecision.beach_id;
    delete missingDecision.forecast_at;
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

  it("suppresses a similarity alert when its canonical selection does not match the outbound window", async () => {
    const evaluateCandidates = evaluatorReturning("allowed");
    const payload = homeMorningPayload("2026-07-17T07:10:00.000Z");
    delete payload.verdict;
    payload.forecast_at = "2026-07-17T08:00:00.000Z";

    const result = await resolveNotificationMajorEventHold(
      {
        eventId: "event-similarity-mismatch",
        type: "similarity_match",
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
