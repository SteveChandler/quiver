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
  it.each(['advisory', 'closure'])('records the %s status of a requested beach removed by water-quality ranking', async (status) => {
    const { resolveCanonicalSessionDecisionContext } = loadService();
    const { rankBeaches } = jest.requireMock('@/lib/recommendations/selection') as { rankBeaches: jest.Mock };
    rankBeaches.mockImplementationOnce(async (_beaches: unknown[], options: { onWaterQualityResolution: (resolution: unknown) => void }) => {
      options.onWaterQualityResolution({
        state: 'resolved', heldBeachIds: ['shores'],
        waterQualityStatusByBeachId: { shores: status }, epoch: 'water-quality-test',
      });
      return [];
    });
    const discoverSurfSpots = jest.fn().mockResolvedValue({
      recommendations: [discoveryRecommendation()],
      recommendationAvailability: { state: 'available', holdEpoch: 'test' },
    });

    const result = await resolveCanonicalSessionDecisionContext({
      userId: 'user-1',
      profileExperience: 'intermediate',
      anchorTime: '2026-07-22T18:00:00.000Z',
      scope: { kind: 'plan_next_session', windowStart: '2026-07-22T18:00:00.000Z', windowEnd: '2026-07-23T18:00:00.000Z', timezone: 'America/Los_Angeles' },
      candidateBeachIds: ['shores'],
      discoveryOptions: { userLocation: { lat: 32.83, lon: -117.27 }, includeBeachIds: ['shores'] },
    }, { discoverSurfSpots }) as { decision: { reasonCode: string; candidateRejection: unknown } };

    expect(result.decision.reasonCode).toBe('no_candidates');
    expect(result.decision.candidateRejection).toEqual({
      gate: 'water_quality_hold',
      observed: { status },
      allowed: { status: 'open' },
    });
  });

  it('does not infer a closure if ranking supplies no hold evidence', async () => {
    const { resolveCanonicalSessionDecisionContext } = loadService();
    const { rankBeaches } = jest.requireMock('@/lib/recommendations/selection') as { rankBeaches: jest.Mock };
    rankBeaches.mockResolvedValueOnce([]);
    const discoverSurfSpots = jest.fn().mockResolvedValue({
      recommendations: [discoveryRecommendation()],
      recommendationAvailability: { state: 'available', holdEpoch: 'test' },
    });

    const result = await resolveCanonicalSessionDecisionContext({
      userId: 'user-1', profileExperience: 'intermediate', anchorTime: '2026-07-22T18:00:00.000Z',
      scope: { kind: 'plan_next_session', windowStart: '2026-07-22T18:00:00.000Z', windowEnd: '2026-07-23T18:00:00.000Z', timezone: 'America/Los_Angeles' },
      candidateBeachIds: ['shores'],
      discoveryOptions: { userLocation: { lat: 32.83, lon: -117.27 }, includeBeachIds: ['shores'] },
    }, { discoverSurfSpots }) as { decision: { candidateRejection: unknown } };

    expect(result.decision.candidateRejection).toEqual({ gate: 'window_selection' });
  });

  it('passes an included beach rejection into the canonical no-candidates decision', async () => {
    const { resolveCanonicalSessionDecisionContext } = loadService();
    const candidateRejection = { gate: 'horizon', observed: { hoursAhead: 27 }, allowed: { maximumHoursAhead: 24 } };
    const discoverSurfSpots = jest.fn().mockResolvedValue({
      recommendations: [],
      includedRecommendations: [],
      candidateRejections: { shores: candidateRejection },
      recommendationAvailability: { state: 'available', holdEpoch: 'test' },
    });
    const result = await resolveCanonicalSessionDecisionContext({
      userId: 'user-1',
      profileExperience: 'intermediate',
      anchorTime: '2026-07-22T18:00:00.000Z',
      scope: { kind: 'plan_next_session', windowStart: '2026-07-22T18:00:00.000Z', windowEnd: '2026-07-23T18:00:00.000Z', timezone: 'America/Los_Angeles' },
      candidateBeachIds: ['shores'],
      discoveryOptions: { userLocation: { lat: 32.83, lon: -117.27 }, includeBeachIds: ['shores'] },
    }, { discoverSurfSpots }) as { decision: { reasonCode: string; candidateRejection: unknown } };

    expect(result.decision.reasonCode).toBe('no_candidates');
    expect(result.decision.candidateRejection).toEqual(candidateRejection);
  });
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
