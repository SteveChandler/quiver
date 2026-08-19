export {};

type AlertAdapterModule = {
  buildCanonicalDecisionFromAlertMatches: (input: unknown) => {
    verdict: string;
    selection: {
      candidateId: string;
      beachId: string;
      forecastRef: { forecastId: string };
    } | null;
  };
  canonicalAlertCandidateId: (match: {
    rule_id: string;
    beach_id: string;
    window_start: string;
  }) => string;
};

function loadAdapter(): AlertAdapterModule {
  return require("@/lib/recommendations/canonical-decision/alert-adapter") as AlertAdapterModule;
}

function match(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    rule_id: "rule-1",
    rule_name: "Dawn patrol",
    beach_id: "11111111-1111-4111-8111-111111111111",
    beach_name: "La Jolla Shores",
    beach_skill_level: "beginner",
    beach_timezone: "America/Los_Angeles",
    window_start: "2026-07-23T14:00:00.000Z",
    window_end: "2026-07-23T16:00:00.000Z",
    best_hour: "2026-07-23T14:00:00.000Z",
    best_score: 84,
    conditions_snapshot: {
      forecast_id: "forecast-1",
      wave_height: 3,
    },
    notify_email: true,
    notify_push: true,
    ...overrides,
  };
}

describe("canonical alert decision adapter", () => {
  it("selects one safe alert window and preserves a stable candidate identity", () => {
    const {
      buildCanonicalDecisionFromAlertMatches,
      canonicalAlertCandidateId,
    } = loadAdapter();
    const safe = match();
    const unsafe = match({
      rule_id: "rule-2",
      beach_id: "22222222-2222-4222-8222-222222222222",
      beach_name: "Black's Beach",
      beach_skill_level: "advanced",
      best_score: 99,
    });

    const decision = buildCanonicalDecisionFromAlertMatches({
      anchorTime: "2026-07-22T18:00:00.000Z",
      scope: {
        kind: "plan_next_session",
        windowStart: "2026-07-22T18:00:00.000Z",
        windowEnd: "2026-07-24T18:00:00.000Z",
        timezone: "America/Los_Angeles",
      },
      profileExperience: "beginner",
      recommendationAvailability: {
        state: "available",
        holdEpoch: "alert-hold-1",
      },
      matches: [unsafe, safe],
    });

    expect(decision).toMatchObject({
      verdict: "go",
      selection: {
        candidateId: canonicalAlertCandidateId(
          safe as {
            rule_id: string;
            beach_id: string;
            window_start: string;
          },
        ),
        beachId: safe.beach_id,
      },
    });
  });

  it("returns explicit no when alert safety data is incomplete", () => {
    const { buildCanonicalDecisionFromAlertMatches } = loadAdapter();
    const decision = buildCanonicalDecisionFromAlertMatches({
      anchorTime: "2026-07-22T18:00:00.000Z",
      scope: {
        kind: "plan_next_session",
        windowStart: "2026-07-22T18:00:00.000Z",
        windowEnd: "2026-07-24T18:00:00.000Z",
        timezone: "America/Los_Angeles",
      },
      profileExperience: "beginner",
      recommendationAvailability: {
        state: "available",
        holdEpoch: "alert-hold-1",
      },
      matches: [match({ beach_skill_level: null })],
    });

    expect(decision).toMatchObject({ verdict: "no", selection: null });
  });

  it("uses the stable alert identity when a queued row predates forecast IDs", () => {
    const {
      buildCanonicalDecisionFromAlertMatches,
      canonicalAlertCandidateId,
    } = loadAdapter();
    const legacy = match({ conditions_snapshot: { wave_height: 3 } });

    const decision = buildCanonicalDecisionFromAlertMatches({
      anchorTime: "2026-07-22T18:00:00.000Z",
      scope: {
        kind: "plan_next_session",
        windowStart: "2026-07-22T18:00:00.000Z",
        windowEnd: "2026-07-24T18:00:00.000Z",
        timezone: "America/Los_Angeles",
      },
      profileExperience: "beginner",
      recommendationAvailability: {
        state: "available",
        holdEpoch: "alert-hold-1",
      },
      matches: [legacy],
    });

    const syntheticId = canonicalAlertCandidateId(
      legacy as {
        rule_id: string;
        beach_id: string;
        window_start: string;
      },
    );

    expect(decision).toMatchObject({
      verdict: "go",
      selection: {
        candidateId: syntheticId,
        forecastRef: { forecastId: syntheticId },
      },
    });
  });
});
