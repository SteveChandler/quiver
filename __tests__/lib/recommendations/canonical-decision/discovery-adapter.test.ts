export {};

type DiscoveryAdapterModule = {
  buildCanonicalDecisionFromSurfDiscovery: (input: unknown) => unknown;
};

function loadAdapter(): DiscoveryAdapterModule {
  return require("@/lib/recommendations/canonical-decision/discovery-adapter") as DiscoveryAdapterModule;
}

function recommendation(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    recommendationId: "beach:blacks:2026-07-23T14:00:00.000Z",
    beach: {
      id: "blacks",
      name: "Black's Beach",
      skill_level: "advanced",
    },
    window: {
      start: new Date("2026-07-23T14:00:00.000Z"),
      end: new Date("2026-07-23T17:00:00.000Z"),
      timezone: "America/Los_Angeles",
    },
    forecast: {
      id: "forecast-blacks",
      beach_id: "blacks",
      forecast_at: "2026-07-23T14:00:00.000Z",
      wave_height: "8-10 ft",
    },
    score: 97,
    recommendationLabel: "Worth it",
    similarity: null,
    warnings: [],
    ...overrides,
  };
}

describe("canonical discovery adapter", () => {
  it("turns the full discovery pool into one skill-safe decision without changing forecasts", () => {
    const { buildCanonicalDecisionFromSurfDiscovery } = loadAdapter();
    const recommendations = [
      recommendation(),
      recommendation({
        recommendationId: "beach:shores:2026-07-23T15:00:00.000Z",
        beach: {
          id: "shores",
          name: "La Jolla Shores",
          skill_level: "beginner",
        },
        window: {
          start: new Date("2026-07-23T15:00:00.000Z"),
          end: new Date("2026-07-23T18:00:00.000Z"),
          timezone: "America/Los_Angeles",
        },
        forecast: {
          id: "forecast-shores",
          beach_id: "shores",
          forecast_at: "2026-07-23T15:00:00.000Z",
          wave_height: "2-3 ft",
        },
        score: 78,
      }),
    ];
    const before = JSON.stringify(recommendations);
    const decision = buildCanonicalDecisionFromSurfDiscovery({
      anchorTime: "2026-07-22T18:00:00.000Z",
      scope: {
        kind: "plan_next_session",
        windowStart: "2026-07-22T18:00:00.000Z",
        windowEnd: "2026-07-23T18:00:00.000Z",
        timezone: "America/Los_Angeles",
      },
      profileExperience: "beginner",
      recommendationAvailability: {
        state: "available",
        holdEpoch: "hold-epoch-1",
      },
      recommendations,
    }) as {
      verdict: string;
      selection: { beachId: string; forecastRef: { forecastId: string } } | null;
    };

    expect(decision.verdict).toBe("go");
    expect(decision.selection).toMatchObject({
      beachId: "shores",
      forecastRef: { forecastId: "forecast-shores" },
    });
    expect(JSON.stringify(recommendations)).toBe(before);
  });

  it("maps a water-quality closure warning to a hard safety override", () => {
    const { buildCanonicalDecisionFromSurfDiscovery } = loadAdapter();
    const decision = buildCanonicalDecisionFromSurfDiscovery({
      anchorTime: "2026-07-22T18:00:00.000Z",
      scope: {
        kind: "plan_next_session",
        windowStart: "2026-07-22T18:00:00.000Z",
        windowEnd: "2026-07-23T18:00:00.000Z",
        timezone: "America/Los_Angeles",
      },
      profileExperience: "advanced",
      recommendationAvailability: {
        state: "available",
        holdEpoch: "hold-epoch-1",
      },
      recommendations: [
        recommendation({
          similarity: {
            state: "ready",
            score: 8.1,
            label: "GOOD",
            bonusApplied: 0,
            confidence: "high",
            reason: "Strong historical match",
            reasons: ["Strong historical match"],
            sessionCount: 20,
          },
          warnings: ["Water quality closure — health advisory active"],
        }),
      ],
    }) as {
      verdict: string;
      decisionBasis: string;
      reasonCode: string;
      selection: unknown;
    };

    expect(decision).toMatchObject({
      verdict: "no",
      decisionBasis: "safety_override",
      reasonCode: "water_quality_closure",
      selection: null,
    });
  });
});
