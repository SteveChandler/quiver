type CanonicalServiceModule = {
  resolveCanonicalSessionDecision: (
    input: unknown,
    dependencies: { discoverSurfSpots: jest.Mock },
  ) => Promise<unknown>;
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
  it("resolves one decision from the full server discovery pool", async () => {
    const { resolveCanonicalSessionDecision } = loadService();
    const discoverSurfSpots = jest.fn().mockResolvedValue({
      recommendations: [discoveryRecommendation()],
      recommendationAvailability: {
        state: "available",
        holdEpoch: "hold-epoch-1",
        resolutionAsOf: "2026-07-22T17:59:59.000Z",
      },
    });

    const decision = (await resolveCanonicalSessionDecision(
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
        discoveryOptions: {
          userLocation: { lat: 32.83, lon: -117.27 },
          horizonHours: 24,
        },
      },
      { discoverSurfSpots },
    )) as { verdict: string; selection: { beachId: string } | null };

    expect(discoverSurfSpots).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({
        userLocation: { lat: 32.83, lon: -117.27 },
        horizonHours: 24,
        maxResults: 60,
      }),
    );
    expect(decision).toMatchObject({
      verdict: "go",
      selection: { beachId: "shores" },
    });
  });

  it("still answers when discovery omits an availability state", async () => {
    const { resolveCanonicalSessionDecision } = loadService();
    const discoverSurfSpots = jest.fn().mockResolvedValue({
      recommendations: [discoveryRecommendation()],
    });

    const decision = await resolveCanonicalSessionDecision(
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
        discoveryOptions: {
          userLocation: { lat: 32.83, lon: -117.27 },
          horizonHours: 24,
        },
      },
      { discoverSurfSpots },
    ) as { verdict: string; reasonCode: string; selection: unknown };

    expect(decision).toMatchObject({
      verdict: "go",
      reasonCode: "selected_go",
      selection: { beachId: "shores" },
    });
  });

  it("considers explicitly included beaches in the same canonical pool", async () => {
    const { resolveCanonicalSessionDecision } = loadService();
    const included = {
      ...discoveryRecommendation(),
      recommendationId: "beach:included:2026-07-23T14:00:00.000Z",
      beach: {
        id: "included",
        name: "Included Beach",
        skill_level: "beginner",
      },
      forecast: {
        id: "forecast-included",
        beach_id: "included",
        forecast_at: "2026-07-23T14:00:00.000Z",
        wave_height: "2-3 ft",
      },
      score: 92,
    };
    const discoverSurfSpots = jest.fn().mockResolvedValue({
      recommendations: [discoveryRecommendation()],
      includedRecommendations: [included],
      recommendationAvailability: {
        state: "available",
        holdEpoch: "hold-epoch-1",
      },
    });

    const decision = (await resolveCanonicalSessionDecision(
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
        discoveryOptions: {
          includeBeachIds: ["included"],
          horizonHours: 24,
        },
      },
      { discoverSurfSpots },
    )) as { selection: { beachId: string } | null };

    expect(decision.selection?.beachId).toBe("included");
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
