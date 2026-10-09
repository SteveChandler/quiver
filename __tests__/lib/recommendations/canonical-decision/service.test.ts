type CanonicalServiceModule = {
  resolveCanonicalSessionDecisionContext: (
    input: unknown,
    dependencies: { discoverSurfSpots: jest.Mock },
  ) => Promise<unknown>;
};

jest.mock("@/lib/recommendations/selection", () => ({
  rankBeaches: jest.fn(async (beaches: Array<{ id: string }>) => beaches),
}));

function loadService(): CanonicalServiceModule {
  return require("@/lib/recommendations/canonical-decision/service") as CanonicalServiceModule;
}

function discoveryRecommendation(): Record<string, unknown> {
  return {
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
    recommendationLabel: "Worth it",
  };
}

describe("canonical session decision service", () => {
  it("passes a null viewer through to discovery for anonymous decisions", async () => {
    const { resolveCanonicalSessionDecisionContext } = loadService();
    const discoverSurfSpots = jest.fn().mockResolvedValue({
      recommendations: [],
      recommendationAvailability: {
        state: "available",
        holdEpoch: "anonymous",
      },
    });

    await resolveCanonicalSessionDecisionContext(
      {
        userId: null,
        profileExperience: null,
        anchorTime: "2026-07-22T18:00:00.000Z",
        scope: {
          kind: "plan_next_session",
          windowStart: "2026-07-22T18:00:00.000Z",
          windowEnd: "2026-07-23T18:00:00.000Z",
          timezone: "America/Los_Angeles",
        },
        discoveryOptions: {
          userLocation: { lat: 32.83, lon: -117.27 },
          horizonHours: 24,
        },
      },
      { discoverSurfSpots },
    );

    expect(discoverSurfSpots).toHaveBeenCalledWith(
      null,
      expect.objectContaining({ maxResults: 60 }),
    );
  });

  it("restricts the canonical decision to explicitly requested candidate beaches", async () => {
    const { resolveCanonicalSessionDecisionContext } = loadService();
    const requestedBeach = {
      ...discoveryRecommendation(),
      recommendationId: "beach:bowls:2026-07-23T16:00:00.000Z",
      beach: {
        id: "bowls",
        name: "Ala Moana Bowls",
        skill_level: "intermediate",
      },
      window: {
        start: new Date("2026-07-23T16:00:00.000Z"),
        end: new Date("2026-07-23T19:00:00.000Z"),
        timezone: "Pacific/Honolulu",
      },
      forecast: {
        id: "forecast-bowls",
        beach_id: "bowls",
        forecast_at: "2026-07-23T16:00:00.000Z",
        wave_height: "3-4 ft",
      },
      score: 70,
      recommendationLabel: "Maybe",
    };
    const discovery = {
      recommendations: [discoveryRecommendation()],
      includedRecommendations: [requestedBeach],
      recommendationAvailability: {
        state: "available",
        holdEpoch: "hold-epoch-1",
      },
    };
    const discoverSurfSpots = jest.fn().mockResolvedValue(discovery);

    const result = (await resolveCanonicalSessionDecisionContext(
      {
        userId: "user-1",
        profileExperience: "intermediate",
        anchorTime: "2026-07-22T18:00:00.000Z",
        scope: {
          kind: "plan_next_session",
          windowStart: "2026-07-22T18:00:00.000Z",
          windowEnd: "2026-07-23T20:00:00.000Z",
          timezone: "Pacific/Honolulu",
        },
        candidateBeachIds: ["bowls"],
        discoveryOptions: {
          includeBeachIds: ["bowls"],
          horizonHours: 24,
        },
      },
      { discoverSurfSpots },
    )) as {
      decision: { selection: { beachId: string } | null };
      discovery: Record<string, unknown>;
    };

    expect(result.decision.selection?.beachId).toBe("bowls");
    expect(result.discovery).toBe(discovery);
  });

  it("returns the exact discovery payload used to make the decision", async () => {
    const { resolveCanonicalSessionDecisionContext } = loadService();
    const discovery = {
      recommendations: [discoveryRecommendation()],
      recommendationAvailability: {
        state: "available",
        holdEpoch: "hold-epoch-1",
      },
    };
    const discoverSurfSpots = jest.fn().mockResolvedValue(discovery);

    const result = (await resolveCanonicalSessionDecisionContext(
      {
        userId: "user-1",
        profileExperience: "beginner",
        anchorTime: "2026-07-22T18:00:00.000Z",
        scope: {
          kind: "plan_next_session",
          windowStart: "2026-07-22T18:00:00.000Z",
          windowEnd: "2026-07-23T18:00:00.000Z",
          timezone: "America/Los_Angeles",
        },
        discoveryOptions: { horizonHours: 24 },
      },
      { discoverSurfSpots },
    )) as {
      decision: { selection: { candidateId: string } | null };
      discovery: Record<string, unknown>;
    };

    expect(result.discovery).toBe(discovery);
    expect(result.decision.selection?.candidateId).toBe(
      "beach:shores:2026-07-23T15:00:00.000Z",
    );
  });
});
