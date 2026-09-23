/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";

const NO_STORE = "private, no-store, no-cache, must-revalidate";
const BEACH_ID = "11111111-1111-4111-8111-111111111111";
const SLOT_ONE = "2026-07-19T18:00:00.000Z";
const SLOT_TWO = "2026-07-19T21:00:00.000Z";
const mockEvaluateMajorEventHoldCandidates = jest.fn();
const mockGetProfileExperienceLevel = jest.fn();
let mockAuthContext: any;

jest.mock("@ducanh2912/next-pwa", () => ({
  __esModule: true,
  default: () => (config: unknown) => config,
}));

jest.mock("@sentry/nextjs", () => ({
  withSentryConfig: (config: unknown) => config,
}));

jest.mock("@/lib/middleware/api-wrappers", () => {
  const actual = jest.requireActual("@/lib/middleware/api-wrappers");
  return {
    ...actual,
    withAuth: (handler: any) => (request: NextRequest) =>
      handler(request, mockAuthContext),
  };
});

jest.mock("@/lib/recommendations/major-event-hold/service", () => ({
  evaluateMajorEventHoldCandidates: (input: unknown) =>
    mockEvaluateMajorEventHoldCandidates(input),
}));

jest.mock("@/lib/profile/skill-level", () => ({
  getProfileExperienceLevel: (...args: unknown[]) =>
    mockGetProfileExperienceLevel(...args),
}));

jest.mock("@/lib/services/forecast/v5-display-gate", () => ({
  applyV51DisplayOverrideToForecasts: jest.fn(async (rows: unknown[]) => rows),
}));

jest.mock("@/lib/services/observations/nowcast-anchor", () => ({
  fetchLatestObservation: jest.fn(async () => ({
    observedAt: "2026-07-19T17:55:00.000Z",
    waveHeightM: 1.2,
  })),
}));

jest.mock("@/lib/services/discovery/window-selector/window-scorer", () => ({
  scoreWindowConditionDetails: jest.fn(() => ({
    score: 75,
    boardClass: null,
    rideabilityBand: null,
    decisionCeiling: 100,
    components: { waveFit: 0, period: 0, wind: 0, tide: 0 },
    appliedEffects: [],
  })),
  scoreWindowConditionForBoardClass: jest.fn((_forecast, _beach, _skill, boardClass) => ({
    score: 75,
    boardClass,
    rideabilityBand: null,
    decisionCeiling: 100,
    components: { waveFit: 0, period: 0, wind: 0, tide: 0 },
    appliedEffects: [],
  })),
}));

jest.mock("@/lib/domains/wave-frequency/calculator", () => ({
  calculateRideableWaves: jest.fn(() => ({
    rideableWavesPerHour: 12,
    confidence: "high",
    swellTrains: 1,
    dominantBeatIntervalS: null,
  })),
}));

function forecast(forecastAt: string) {
  return {
    id: `forecast-${forecastAt}`,
    beach_id: BEACH_ID,
    forecast_at: forecastAt,
    forecast_date: forecastAt.slice(0, 10),
    forecast_time: forecastAt.slice(11, 19),
    wave_height: "3-5 ft",
    swell_1_height: "3",
    swell_1_period: "12",
    swell_1_direction: "W",
    swell_2_height: null,
    swell_2_period: null,
    swell_2_direction: null,
    wind_wave_height: null,
    wind_wave_period: null,
    wind_wave_direction: null,
    wind_speed: "5 mph",
    wind_direction: "E",
    wind_direction_deg: 90,
    tide_height: "2.5",
    tide_status: "Rising",
    water_temp: "78°F",
    air_temperature: "80°F",
    confidence_score: 90,
    created_at: "2026-07-19T00:00:00.000Z",
    updated_at: "2026-07-19T00:00:00.000Z",
  };
}

function scoredSupabase() {
  const beachChain: any = {
    select: jest.fn(() => beachChain),
    eq: jest.fn(() => beachChain),
    single: jest.fn(async () => ({
      data: {
        id: BEACH_ID,
        name: "Bound Beach",
        aspect_deg: 270,
        break_type: "beach",
        shoaling_factors: null,
        swell_access_factors: Array(72).fill(0.8),
      },
      error: null,
    })),
  };
  const forecastChain: any = {
    select: jest.fn(() => forecastChain),
    eq: jest.fn(() => forecastChain),
    gte: jest.fn(() => forecastChain),
    lt: jest.fn(() => forecastChain),
    order: jest.fn(() => forecastChain),
    limit: jest.fn(async () => ({
      data: [forecast(SLOT_ONE), forecast(SLOT_TWO)],
      error: null,
    })),
    maybeSingle: jest.fn(async () => ({ data: null, error: null })),
  };
  return {
    from: jest.fn((table: string) =>
      table === "beaches" ? beachChain : forecastChain,
    ),
  };
}

function decision(
  candidateId: string,
  state: "allow" | "blocked",
  holdEpoch = "scored-epoch",
) {
  if (state === "allow") {
    return {
      candidateId,
      evaluation: { outcome: "allow", holdIds: [], holdEpoch },
      recommendationAvailability: { state: "available", holdEpoch },
    };
  }
  return {
    candidateId,
    evaluation: {
      outcome: "explicit_none",
      reasonCode: "major_event_hold",
      holdIds: ["internal-hold-id"],
      expiresAt: "2026-07-20T00:00:00.000Z",
      holdEpoch,
    },
    recommendationAvailability: {
      state: "none",
      reasonCode: "major_event_hold",
      expiresAt: "2026-07-20T00:00:00.000Z",
      holdEpoch,
    },
  };
}

describe("major-event hold route integration", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetProfileExperienceLevel.mockResolvedValue(null);
    mockAuthContext = {
      params: { beachId: BEACH_ID },
      user: null,
      supabase: scoredSupabase(),
    };
  });

  it.each(["", "?range=14day"])("bounds the scored forecast query for %s", async query => {
    const now = Date.now();
    const clock = jest.spyOn(Date, 'now').mockReturnValue(now);
    mockEvaluateMajorEventHoldCandidates.mockResolvedValueOnce([]);
    try {
      const { GET } = await import("@/app/api/forecasts/scored/[beachId]/route");
      const response = await GET(new NextRequest(`http://localhost/api/forecasts/scored/${BEACH_ID}${query}`));
      expect(response.status).toBe(200);
      const chain = mockAuthContext.supabase.from('enhanced_forecasts');
      expect(chain.gte).toHaveBeenCalledWith('forecast_at', new Date(now - (query ? 8 : 0) * 3_600_000).toISOString());
      expect(chain.lt).toHaveBeenCalledWith('forecast_at', new Date(now + (query ? 14 : 1) * 24 * 3_600_000).toISOString());
      expect(chain.limit).toHaveBeenCalledWith(query ? 344 : 8);
    } finally { clock.mockRestore(); }
  });

  it('scores with the authenticated surfer saved boards, not caller-supplied identity', async () => {
    mockAuthContext.user = { id: 'signed-in-surfer' };
    const originalFrom = mockAuthContext.supabase.from;
    const boardEq = jest.fn();
    const boardResult = { data: [
      { id: 'board-1', name: 'Log', board_type: 'longboard', volume: 65, session_count: 4 },
      { id: 'board-2', name: 'Fish', board_type: 'fish', volume: 32, session_count: 2 },
    ], error: null };
    const boardQuery: Record<string, unknown> = {
      then: (resolve: (value: typeof boardResult) => unknown) => Promise.resolve(boardResult).then(resolve),
    };
    for (const method of ['is', 'gte', 'order', 'limit']) boardQuery[method] = jest.fn(() => boardQuery);
    boardQuery.eq = jest.fn((...args: unknown[]) => { boardEq(...args); return boardQuery; });
    mockAuthContext.supabase.from = jest.fn(table => table === 'boards'
      ? { select: () => boardQuery } : originalFrom(table));
    mockEvaluateMajorEventHoldCandidates.mockResolvedValueOnce([]);
    const { GET } = await import("@/app/api/forecasts/scored/[beachId]/route");
    const { scoreWindowConditionForBoardClass } = await import('@/lib/services/discovery/window-selector/window-scorer');
    const response = await GET(new NextRequest(`http://localhost/api/forecasts/scored/${BEACH_ID}?range=14day&userId=someone-else`));
    expect(response.status).toBe(200);
    expect(boardEq).toHaveBeenCalledWith('user_id', 'signed-in-surfer');
    // The slot is scored for a board from the signed-in surfer's own quiver.
    expect(scoreWindowConditionForBoardClass).toHaveBeenCalledWith(
      expect.objectContaining({ forecast_at: SLOT_ONE }),
      expect.objectContaining({ id: BEACH_ID }), null, expect.stringMatching(/^(longboard|fish)$/),
    );
  });

  it('rejects an unbounded range before reading the database', async () => {
    const { GET } = await import("@/app/api/forecasts/scored/[beachId]/route");
    const response = await GET(new NextRequest(`http://localhost/api/forecasts/scored/${BEACH_ID}?range=999day`));
    expect(response.status).toBe(400);
    expect(mockAuthContext.supabase.from).not.toHaveBeenCalled();
  });

  it("binds scored slots and golden windows exactly and supports anonymous unknown", async () => {
    mockEvaluateMajorEventHoldCandidates.mockImplementationOnce(
      ({ candidates }: { candidates: Array<{ candidateId: string }> }) =>
        Promise.resolve(
          candidates.map(({ candidateId }, index) =>
            decision(candidateId, index === 1 ? "allow" : "blocked"),
          ),
        ),
    );
    const { GET } = await import("@/app/api/forecasts/scored/[beachId]/route");
    const response = await GET(
      new NextRequest(
        new URL(`http://localhost/api/forecasts/scored/${BEACH_ID}`),
      ),
    );
    const body = await response.json();
    const goldenEnd = "2026-07-20T00:00:00.000Z";

    expect(mockGetProfileExperienceLevel).toHaveBeenCalledWith(
      mockAuthContext.supabase,
      undefined,
    );
    expect(mockEvaluateMajorEventHoldCandidates).toHaveBeenCalledWith({
      candidates: [
        {
          candidateId: `scored-slot:${BEACH_ID}:${SLOT_ONE}`,
          beachId: BEACH_ID,
          startsAt: SLOT_ONE,
          endsAt: SLOT_TWO,
        },
        {
          candidateId: `scored-slot:${BEACH_ID}:${SLOT_TWO}`,
          beachId: BEACH_ID,
          startsAt: SLOT_TWO,
          endsAt: goldenEnd,
        },
        {
          candidateId: `scored-golden:${BEACH_ID}:${SLOT_ONE}:${goldenEnd}`,
          beachId: BEACH_ID,
          startsAt: SLOT_ONE,
          endsAt: goldenEnd,
        },
      ],
      profileExperience: null,
    });
    expect(body.data.timeSlots).toHaveLength(2);
    expect(body.data.timeSlots[0]).toMatchObject({
      forecastAt: SLOT_ONE,
      surfHeight: { min: 3, max: 5 },
      compositeScore: null,
    });
    expect(body.data.timeSlots[1]).toMatchObject({
      forecastAt: SLOT_TWO,
      surfHeight: { min: 3, max: 5 },
      compositeScore: 75,
    });
    expect(body.data.goldenWindows).toEqual([]);
    expect(body.data.latestObservation).toMatchObject({ waveHeightM: 1.2 });
    expect(body.data.recommendationAvailability).toEqual({
      state: "available",
      holdEpoch: "scored-epoch",
    });
    expect(JSON.stringify(body)).not.toMatch(
      /internal-hold-id|holdIds|evaluation/,
    );
    expect(response.headers.get("Cache-Control")).toBe(NO_STORE);
  });

  it("resolves exact no-store Next header exceptions after the blanket rule", async () => {
    const originalEnv = process.env;
    const configModule = (await (async () => {
      process.env = { ...originalEnv, SUPABASE_SERVICE_ROLE_KEY: "test-service-role", NEXT_PUBLIC_SITE_URL: "http://localhost:3000" };
      try { return await import("../../../next.config.mjs"); }
      finally { process.env = originalEnv; }
    })()) as {
      default: {
        headers: () => Promise<
          Array<{
            source: string;
            headers: Array<{ key: string; value: string }>;
          }>
        >;
      };
    };
    const rules = await configModule.default.headers();
    const endpoints = [
      "/api/surf/discover",
      "/api/surf/call",
      "/api/surf/week-scout",
      "/api/v1/recommendations",
      "/api/forecasts/bulk",
      "/api/forecasts/scored/:beachId",
      "/api/beach-daily-intel",
      "/api/coach-picks",
      "/api/og/surf-call",
      "/api/og/weekend-wave-check",
      "/api/og/forecast-window",
    ];
    const blanketIndex = rules.findIndex(
      ({ source }) => source === "/api/(.*)",
    );
    expect(blanketIndex).toBeGreaterThan(-1);

    for (const endpoint of endpoints) {
      const exactIndex = rules.findIndex(({ source }) => source === endpoint);
      expect(exactIndex).toBeGreaterThan(blanketIndex);
      const matchingCacheControl = rules
        .filter(
          ({ source }) => source === "/api/(.*)" || source === endpoint,
        )
        .flatMap(({ headers }) => headers)
        .filter(({ key }) => key === "Cache-Control")
        .at(-1);
      expect(matchingCacheControl?.value).toBe(NO_STORE);
    }
  });
});
