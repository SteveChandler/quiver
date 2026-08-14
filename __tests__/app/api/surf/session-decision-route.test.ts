/** @jest-environment node */

jest.mock("server-only", () => ({}));
jest.mock("next/server", () => require("@/__tests__/setup/mock-next-server"));

jest.mock("@/lib/middleware/api-wrappers", () => {
  const actual = jest.requireActual("@/lib/middleware/api-wrappers");
  return {
    ...actual,
    withAuth: (handler: unknown) => handler,
    withRateLimit: (handler: unknown) => handler,
  };
});

const HELD_BEACH_ID = "11111111-1111-4111-8111-111111111111";
const SAFE_BEACH_ID = "22222222-2222-4222-8222-222222222222";

const mockBuildCandidatePool = jest.fn();
const mockBatchFetchForecasts = jest.fn();
const mockServiceFrom = jest.fn();
const mockServiceRpc = jest.fn(async () => ({ data: [], error: null }));

function serviceQuery(
  data: unknown[],
  onIn?: (values: string[]) => void,
): Record<string, any> {
  const query: Record<string, any> = {};
  let resolvedData = data;
  const resolved = () => ({ data: resolvedData, error: null });
  const passthrough = (): Record<string, any> => query;

  query.select = jest.fn(passthrough);
  query.eq = jest.fn(passthrough);
  query.neq = jest.fn(passthrough);
  query.is = jest.fn(passthrough);
  query.gte = jest.fn(passthrough);
  query.lte = jest.fn(passthrough);
  query.or = jest.fn(passthrough);
  query.order = jest.fn(passthrough);
  query.limit = jest.fn(passthrough);
  query.in = jest.fn((_column: string, values: string[]) => {
    onIn?.(values);
    if (
      data.every((row) => typeof row === "object" && row !== null && "beach_id" in row)
    ) {
      resolvedData = data.filter((row) =>
        values.includes(String((row as { beach_id: unknown }).beach_id)),
      );
    }
    return query;
  });
  query.maybeSingle = jest.fn(async () => ({
    data: data[0] ?? null,
    error: null,
  }));
  query.then = (
    onFulfilled: (value: { data: unknown[]; error: null }) => unknown,
    onRejected?: (reason: unknown) => unknown,
  ) => Promise.resolve(resolved()).then(onFulfilled, onRejected);

  return query;
}

const mockWaterQualityQueries: string[][] = [];

jest.mock("@/lib/supabase/server", () => ({
  ...jest.requireActual("@/lib/supabase/server"),
  createSupabaseServiceRoleClient: jest.fn(() => ({
    from: mockServiceFrom,
    rpc: mockServiceRpc,
  })),
}));

jest.mock("@/lib/services/discovery/candidate-pool-builder", () => ({
  ...jest.requireActual("@/lib/services/discovery/candidate-pool-builder"),
  buildCandidatePool: (...args: unknown[]) => mockBuildCandidatePool(...args),
}));

jest.mock("@/lib/services/discovery/forecast-batch-fetcher", () => ({
  ...jest.requireActual("@/lib/services/discovery/forecast-batch-fetcher"),
  batchFetchForecasts: (...args: unknown[]) => mockBatchFetchForecasts(...args),
}));

jest.mock("@/lib/services/discovery/window-selector", () => {
  const makeWindow = (forecast: any) => ({
    start: new Date(forecast.forecast_at),
    end: new Date(new Date(forecast.forecast_at).getTime() + 2 * 60 * 60 * 1000),
    tide: "Rising",
    wind: "5 mph W",
    waveHeight: "3-4 ft",
    wavePeriod: "12s",
    dataSource: "test",
    confidence: 90,
    timezone: "America/Los_Angeles",
    sourceForecast: forecast,
  });
  const forecastsFrom = (input: any): any[] =>
    Array.isArray(input) ? input : input.forecasts ?? [];
  const selectBestWindow = jest.fn((input: any) => {
    const forecast = forecastsFrom(input)[0];
    return forecast ? makeWindow(forecast) : null;
  });

  return {
    selectBestWindow,
    selectBestWindows: jest.fn((input: any) => {
      const forecast = forecastsFrom(input)[0];
      return forecast ? [makeWindow(forecast)] : [];
    }),
    getLocalDateStr: jest.fn((date: Date) => date.toISOString().slice(0, 10)),
    getLocalHour: jest.fn((date: Date) => date.getUTCHours()),
    MIN_SESSION_HOURS: 1,
    FORECAST_WINDOW_DURATION_MINUTES: 60,
    PAST_WINDOW_TOLERANCE_MINUTES: 30,
    scoreWindowConditionScore: jest.fn(() => 70),
  };
});

jest.mock("@/lib/services/discovery/window-selector/window-scorer", () => ({
  scoreWindowConditionDetails: jest.fn(() => ({ boardClass: "shortboard" })),
}));

jest.mock("@/lib/services/discovery/response-formatter", () => ({
  enrichWithPhotos: jest.fn(async (recommendations: unknown[]) => recommendations),
  generateDiscoverySummary: jest.fn(() => "Good conditions"),
  getRecommendationLabel: jest.fn(() => "Worth it"),
  getRecommendationLabelGated: jest.fn(() => "Worth it"),
  buildDiscoveryMessage: jest.fn(() => "Worth it — Good conditions"),
}));

jest.mock("@/lib/services/preference-learning-service", () => ({
  getUserSurfPreferences: jest.fn(async () => null),
}));

jest.mock("@/lib/services/beach-query-service", () => ({
  getFavoriteBeachesFromDb: jest.fn(async () => ({ success: true, data: [] })),
}));

jest.mock("@/lib/services/discovery/personalization-layer", () => ({
  fetchPersonalizationContext: jest.fn(async () => ({
    implicitPrefs: null,
    learnedPrefs: null,
    affinityMap: new Map(),
    implicitWeight: 0,
  })),
  calculatePersonalizationBonus: jest.fn(() => ({
    total: 0,
    affinityBonus: 0,
    personalizationBonus: 0,
    avoidancePenalty: 0,
    reasons: [],
  })),
}));

jest.mock("@/lib/services/discovery/break-behavior-score", () => ({
  ...jest.requireActual("@/lib/services/discovery/break-behavior-score"),
  fetchBreakBehaviorSessionRows: jest.fn(async () => []),
}));

jest.mock("@/lib/services/discovery/similarity-layer", () => ({
  applySimilarityLayer: jest.fn(async ({ recommendations }: any) => ({
    recommendations,
  })),
}));

jest.mock("@/lib/domains/scoring", () => ({
  createDiscoveryScoringEngine: jest.fn(() => ({
    score: jest.fn(() => ({
      total: 70,
      subscores: new Map(),
      reasons: [],
      warnings: [],
      skip: false,
      skipReason: null,
    })),
  })),
  scoreBeachWithEngine: jest.fn((_engine: unknown, beach: { id: string }) => ({
    total: beach.id === HELD_BEACH_ID ? 99 : 80,
    subscores: {
      waveHeightFit: 20,
      periodEnergyScore: 15,
      windAlignment: 15,
      tideFit: 12,
      affinityBonus: 0,
      personalizationBonus: 0,
      distancePenalty: 0,
      behaviorBonus: 0,
    },
    matchQuality: "excellent",
    reasons: ["Good wave size"],
    warnings: [],
    conditionBadges: [],
  })),
  beachToSpotProfile: jest.fn((beach: { id: string }) => ({
    beachId: beach.id,
    swellWindow: { minDeg: 180, maxDeg: 270, centerDeg: 225, halfWidthDeg: 45 },
    windThresholds: { offshoreDeg: 270, offshoreTolDeg: 45, maxOnshoreMph: 10, maxAnyMph: 18 },
    tidePreferences: { preferredMinFt: 0, preferredMaxFt: 5, preferredDirection: "either" },
    skillLevel: "beginner",
    breakType: "beach",
  })),
  forecastToSnapshot: jest.fn(() => ({
    timestamp: new Date(),
    waveHeight: 3,
    wavePeriod: 12,
    waveDirection: 220,
    primarySwell: { heightFt: 3, periodS: 12, directionDeg: 220 },
    secondarySwell: null,
    windWave: null,
    wind: { speedMph: 5, directionDeg: 270 },
    tide: { heightFt: 2, status: "rising", direction: "rising" },
    confidence: 80,
    dataSource: "test",
  })),
  getConditionCharacter: jest.fn(() => ({ label: "Clean", category: "medium-clean" })),
}));

jest.mock("@/lib/scoring/native-condition-score", () => ({
  getNativeConditionMatchQuality: jest.fn(() => "excellent"),
  scoreNativeForecastSlot: jest.fn(() => 70),
}));

jest.mock("@/lib/profile/skill-level", () => ({
  getProfileExperienceLevel: jest.fn(async () => "beginner"),
}));

import { NextRequest } from "next/server";

function makeBeach(id: string, name: string): Record<string, unknown> {
  return {
    id,
    name,
    slug: name.toLowerCase().replaceAll(" ", "-"),
    lat: 32.83,
    lon: -117.27,
    timezone: "America/Los_Angeles",
    city: "San Diego",
    state: "CA",
    country: "USA",
    is_private: false,
    skill_level: "beginner",
    break_type: "beach",
    swell_window_min_deg: 180,
    swell_window_max_deg: 270,
    wind_offshore_deg: 270,
    wind_offshore_tol_deg: 45,
    wind_onshore_bad_kt: 14,
    wind_cross_shore_ok_kt: 10,
    preferred_tide_direction: "rising",
    preferred_tide_ft_min: 0,
    preferred_tide_ft_max: 5,
    tide_direction_sensitivity: "medium",
  };
}

function forecastFor(beachId: string): Record<string, unknown> {
  const forecastAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  return {
    beach_id: beachId,
    id: `forecast-${beachId}`,
    forecast_at: forecastAt,
    forecast_date: forecastAt.slice(0, 10),
    forecast_time: forecastAt.slice(11, 19),
    wave_height: "3-4 ft",
    wave_period: "12s",
    wave_direction: "220",
    wave_direction_deg: 220,
    wind_speed: "5",
    wind_direction: "W",
    wind_direction_deg: 270,
    tide_height: "2",
    tide_status: "Rising",
    swell_1_height: "3",
    swell_1_period: "12",
    swell_1_direction: "220",
    confidence_score: 0.8,
    data_source: "test",
  };
}

function supabaseStub(): Record<string, unknown> {
  return {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          maybeSingle: jest.fn(async () => ({
            data: {
              is_pro: false,
              is_trialing: false,
              billing_issue: false,
              expires_at: null,
            },
            error: null,
          })),
        })),
      })),
    })),
  };
}

describe("GET /api/surf/session-decision", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockWaterQualityQueries.length = 0;
    mockBuildCandidatePool.mockResolvedValue({
      candidates: [
        makeBeach(HELD_BEACH_ID, "Held Beach"),
        makeBeach(SAFE_BEACH_ID, "Safe Beach"),
      ],
      userSkillLevel: "beginner",
    });
    mockBatchFetchForecasts.mockImplementation(async (beaches: Array<{ id: string }>) => ({
      successful: beaches.map(({ id }) => ({ beach: makeBeach(id, id === HELD_BEACH_ID ? "Held Beach" : "Safe Beach"), forecasts: [forecastFor(id)] })),
      failed: [],
      staleCount: 0,
    }));
    mockServiceFrom.mockImplementation((table: string) => {
      if (table === "water_quality_held_beaches") {
        return serviceQuery([{ beach_id: HELD_BEACH_ID }], (values) => {
          mockWaterQualityQueries.push(values);
        });
      }
      if (table === "beach_water_quality") return serviceQuery([]);
      if (table === "county_beach_advisory_runs") {
        return serviceQuery([
          {
            id: "county-run-session-decision",
            fetched_at: new Date().toISOString(),
            status: "completed",
            source_identifier: "county-san-diego-dehq-sdbeachinfo",
          },
        ]);
      }
      if (table === "county_beach_advisories") return serviceQuery([]);
      return serviceQuery([]);
    });
  });

  it("resolves one server-owned decision through real discovery and hold resolution", async () => {
    const { GET } = await import("@/app/api/surf/session-decision/route");
    const request = new NextRequest(
      "http://localhost:3000/api/surf/session-decision?lat=32.83&lon=-117.27&horizonHours=24&timezone=America%2FLos_Angeles&timeSlot=any",
    );
    const response = await GET(request, {
      user: { id: "user-1" },
      supabase: supabaseStub(),
    } as never);

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe(
      "private, no-store, no-cache, must-revalidate",
    );
    expect(mockBuildCandidatePool).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({
        userLocation: { lat: 32.83, lon: -117.27 },
      }),
    );
    expect(mockWaterQualityQueries).toEqual(
      expect.arrayContaining([
        expect.arrayContaining([HELD_BEACH_ID, SAFE_BEACH_ID]),
      ]),
    );

    const decision = await response.json();
    expect(decision.data.selection).toMatchObject({
      beachId: SAFE_BEACH_ID,
      beachName: "Safe Beach",
    });
    expect(decision.data.selection).not.toMatchObject({
      beachId: HELD_BEACH_ID,
      beachName: "Held Beach",
    });
  });

  it("rejects unpaired coordinates before invoking discovery", async () => {
    const { GET } = await import("@/app/api/surf/session-decision/route");
    const request = new NextRequest(
      "http://localhost:3000/api/surf/session-decision?lat=32.83&timezone=America%2FLos_Angeles",
    );
    const response = await GET(request, {
      user: { id: "user-1" },
      supabase: supabaseStub(),
    } as never);

    expect(response.status).toBe(400);
    expect(mockBuildCandidatePool).not.toHaveBeenCalled();
  });
});
