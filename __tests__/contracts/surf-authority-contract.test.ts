/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";
import type { Beach } from "@/types/database";
import type { EnhancedForecastEntity } from "@/types/forecast";
import type { WeekScoutServiceDependencies } from "@/lib/services/discovery/week-scout";

const BEACH_ID = "11111111-1111-4111-8111-111111111111";
const NOW = new Date("2026-09-10T20:40:00.000Z");
const SHIFTED_NOW = new Date("2026-09-10T22:10:00.000Z");
const CURRENT_AT = "2026-09-10T18:00:00.000Z";
const NEXT_AT = "2026-09-10T21:00:00.000Z";

const beach = {
  id: BEACH_ID,
  name: "Contract Beach",
  slug: "contract-beach",
  lat: 32.75,
  lon: -117.25,
  city: "San Diego",
  state: "CA",
  country: "USA",
  region: "Southern California",
  timezone: "America/Los_Angeles",
  is_private: false,
  recommendation_eligible: true,
  skill_level: "intermediate",
  break_type: "beach",
  swell_window_center_deg: 200,
  swell_window_halfwidth_deg: 30,
  wind_offshore_deg: 90,
  wind_offshore_tol_deg: 45,
  shoaling_factors: null,
} as unknown as Beach;

function forecast(localHour: number, day = 10): EnhancedForecastEntity {
  const utcHour = localHour + 7;
  const forecastAt = new Date(Date.UTC(2026, 8, day, utcHour)).toISOString();
  const isCurrent = forecastAt === CURRENT_AT;
  return {
    id: `${BEACH_ID}:${forecastAt}`,
    beach_id: BEACH_ID,
    forecast_at: forecastAt,
    forecast_date: `2026-09-${String(day).padStart(2, "0")}`,
    forecast_time: `${String(localHour).padStart(2, "0")}:00:00`,
    wave_height: "3 ft",
    wave_period: "9s",
    wave_direction: "W",
    swell_1_height: "3 ft",
    swell_1_period: "9s",
    swell_1_direction: "W",
    swell_2_height: null,
    swell_2_period: null,
    swell_2_direction: null,
    wind_wave_height: null,
    wind_wave_period: null,
    wind_wave_direction: null,
    wave_height_om: null,
    wave_direction_om: null,
    swell_height_om: isCurrent ? 0.68 : null,
    swell_period_om: isCurrent ? 6.9 : null,
    swell_direction_om: isCurrent ? 209 : null,
    wind_speed: "4 mph",
    wind_direction: "E",
    wind_direction_deg: 90,
    water_temp: "67",
    tide_height: "3.0 ft",
    tide_status: "Rising",
    confidence_score: 82,
    data_source: "NOAA_NWS",
    created_at: "2026-09-10T11:30:00.000Z",
    updated_at: "2026-09-10T11:30:00.000Z",
  } as EnhancedForecastEntity;
}

const rows = [5, 8, 11, 14, 17, 20, 23]
  .map((hour) => forecast(hour))
  .concat([forecast(5, 11), forecast(8, 11)]);
const currentRow = rows.find((row) => row.forecast_at === CURRENT_AT)!;
const sunTimes = new Map([[BEACH_ID, {
  sunrises: [new Date("2026-09-10T13:30:00.000Z")],
  sunsets: [new Date("2026-09-11T02:05:00.000Z")],
}]]);

function queryFor(table: string) {
  let upperBound: string | null = null;
  const query: any = {
    select: jest.fn(() => query),
    eq: jest.fn(() => query),
    neq: jest.fn(() => query),
    is: jest.fn(() => query),
    in: jest.fn(() => query),
    gte: jest.fn(() => query),
    lt: jest.fn(() => query),
    lte: jest.fn((_column: string, value: string) => {
      upperBound = value;
      return query;
    }),
    order: jest.fn(() => query),
    limit: jest.fn(() => query),
    maybeSingle: jest.fn(async () => {
      if (table === "beaches") return { data: { id: BEACH_ID }, error: null };
      if (table === "tide_forecasts") return { data: null, error: null };
      if (table !== "enhanced_forecasts") return { data: null, error: null };
      const eligible = rows.filter((row) => !upperBound || row.forecast_at <= upperBound);
      return { data: eligible.at(-1) ?? null, error: null };
    }),
    then: jest.fn((resolve: (value: unknown) => unknown) => {
      const data = table === "enhanced_forecasts"
        ? rows
        : table === "beaches"
          ? [beach]
          : table === "sun_times"
            ? [{
                beach_id: BEACH_ID,
                sunrise_utc: "2026-09-10T13:30:00.000Z",
                sunset_utc: "2026-09-11T02:05:00.000Z",
              }]
            : [];
      return Promise.resolve(resolve({ data, error: null }));
    }),
  };
  return query;
}

const mockSupabase = {
  from: jest.fn((table: string) => queryFor(table)),
  rpc: jest.fn(async () => ({ data: [], error: null })),
};
const mockBatchFetchForecasts = jest.fn(async () => ({
  successful: [{ beach, forecasts: rows }],
  failed: [],
  staleCount: 0,
}));
const mockEvaluateHolds = jest.fn(async ({ candidates }: { candidates: Array<{ candidateId: string }> }) =>
  candidates.map(({ candidateId }) => ({
    candidateId,
    evaluation: { outcome: "allow", holdIds: [], holdEpoch: "contract-test" },
    recommendationAvailability: { state: "available", holdEpoch: "contract-test" },
  })),
);

jest.mock("@/lib/middleware/api-wrappers", () => {
  const actual = jest.requireActual("@/lib/api-utils");
  return {
    withAuth: (handler: (request: NextRequest, context: unknown) => Promise<Response>) =>
      (request: NextRequest) => handler(request, { supabase: mockSupabase, user: null, params: {} }),
    withRateLimit: (handler: (request: NextRequest) => Promise<Response>) => handler,
    withNoStore: (handler: (request: NextRequest) => Promise<Response>) => handler,
    createErrorResponse: actual.createErrorResponse,
    createSuccessResponse: actual.createSuccessResponse,
    createValidationError: actual.createValidationError,
    handleApiError: actual.handleApiError,
    validateOrError: actual.validateOrError,
  };
});
jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: jest.fn(() => mockSupabase),
}));
jest.mock("@/lib/services/forecast/v5-display-gate", () => ({
  applyV51DisplayOverrideToForecasts: jest.fn(async (value: unknown[]) => value),
}));
jest.mock("@/lib/utils/forecast-service-utils", () => ({
  readLatestForecastMetadata: jest.fn(async () => ({
    missing: false,
    stale: false,
    dataSource: "NOAA_NWS",
    lastUpdated: "2026-09-11T01:30:00.000Z",
    reason: null,
  })),
  getStalenessDetails: jest.fn(() => ({ threshold: 12 })),
}));
jest.mock("@/lib/utils/forecast-server-utils", () => ({ updateBeachForecast: jest.fn() }));
jest.mock("@/lib/profile/skill-level", () => ({
  getProfileExperienceLevel: jest.fn(async () => "intermediate"),
}));
jest.mock("@/lib/services/discovery", () => ({ getBatchSunTimes: jest.fn(async () => sunTimes) }));
jest.mock("@/lib/services/discovery/candidate-pool-builder", () => ({
  CANDIDATE_POOL_LIMIT: 60,
  MAX_CANDIDATE_RADIUS_MILES: 100,
  buildCandidatePool: jest.fn(async () => ({
    candidates: [beach],
    preferredWaveSize: null,
    userSkillLevel: "intermediate",
    preferredBreakType: null,
  })),
}));
jest.mock("@/lib/services/discovery/forecast-batch-fetcher", () => ({
  batchFetchForecasts: () => mockBatchFetchForecasts(),
}));
jest.mock("@/lib/services/preference-learning-service", () => ({
  getUserSurfPreferences: jest.fn(async () => null),
}));
jest.mock("@/lib/services/beach-query-service", () => ({
  getFavoriteBeachesFromDb: jest.fn(async () => ({ success: true, data: [] })),
}));
jest.mock("@/lib/services/discovery/personalization-layer", () => ({
  fetchPersonalizationContext: jest.fn(async () => null),
  calculatePersonalizationBonus: jest.fn(() => ({
    affinityBonus: 0,
    personalizationBonus: 0,
    reasons: [],
  })),
}));
jest.mock("@/lib/services/discovery/similarity-layer", () => ({
  applySimilarityLayer: jest.fn(async ({ recommendations }: { recommendations: unknown[] }) => ({
    recommendations,
    diagnostics: [],
  })),
}));
jest.mock("@/lib/services/discovery/response-formatter", () => {
  const actual = jest.requireActual("@/lib/services/discovery/response-formatter");
  return { ...actual, enrichWithPhotos: jest.fn(async (recommendations: unknown[]) => recommendations) };
});
jest.mock("@/lib/recommendations/selection", () => ({
  rankBeaches: jest.fn(async (candidates: unknown[]) => candidates),
}));
jest.mock("@/lib/recommendations/major-event-hold/service", () => ({
  evaluateMajorEventHoldCandidates: (input: unknown) => mockEvaluateHolds(input as never),
}));
jest.mock("@/lib/utils/timezone-utils.server", () => ({
  getTimezoneFromCoords: jest.fn(() => "America/Los_Angeles"),
}));
jest.mock("@/lib/logger", () => ({
  createContextLogger: jest.fn(() => ({
    debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn(),
  })),
}));

import { GET as getCurrentForecast } from "@/app/api/forecasts/current/route";
import { bulkForecastHandler } from "@/app/api/forecasts/bulk/route";
import { buildForecastRecommendationContext } from "@/lib/services/forecast-recommendation-context";
import { resolveDisplaySwell } from "@/lib/domains/conditions/display-swell";
import { resolveRecommendationLabel } from "@/lib/services/discovery/recommendation-label";
import { discoverSurfSpots } from "@/lib/services/discovery/surf-discovery-orchestrator";
import { generateWeekScoutForecast } from "@/lib/services/discovery/week-scout";
import { selectBeachDayWindows } from "@/lib/services/discovery/window-authority";
import { selectBestWindows, scoreWindowConditionScore } from "@/lib/services/discovery/window-selector";
import { beachToSpotProfile, createDiscoveryScoringEngine, scoreBeachWithEngine } from "@/lib/domains/scoring";
import { rerankHero } from "@/lib/services/discovery/hero-ranking";
import { formatDisplaySwellPeriod } from "@/lib/domains/conditions/display-swell";
import { degreeToCardinal } from "@/lib/utils/geo-utils";

type ProducerResults = Awaited<ReturnType<typeof runProducers>>;
type CurrentProducerResults = Awaited<ReturnType<typeof runCurrentProducers>>;

function weekScoutDependencies(now: Date): WeekScoutServiceDependencies {
  const engine = createDiscoveryScoringEngine();
  return {
    now,
    fetchBeaches: jest.fn(async () => [beach]),
    fetchForecasts: jest.fn(async () => new Map([[BEACH_ID, rows]])),
    fetchSunTimes: jest.fn(async () => sunTimes),
    fetchPreferences: jest.fn(async () => null),
    fetchSkill: jest.fn(async () => "intermediate"),
    fetchPersonalizationContext: jest.fn(async () => null),
    calculatePersonalizationBonus: jest.fn(() => ({ affinityBonus: 0, personalizationBonus: 0, reasons: [] })),
    selectBestWindows,
    scoreWindowCondition: (row, candidate, skill, boardClasses) =>
      scoreWindowConditionScore(row, candidate, skill, null, boardClasses),
    scoreBeach: (candidate, row, options) => scoreBeachWithEngine(engine, candidate, row, options),
    beachToSpotProfile,
    rankWindows: rerankHero,
  };
}

async function runProducers(now: Date) {
  jest.setSystemTime(now);
  const currentResponse = await getCurrentForecast(new NextRequest(
    `http://localhost/api/forecasts/current?beachId=${BEACH_ID}`,
  ));
  const bulkResponse = await bulkForecastHandler(
    new NextRequest(`http://localhost/api/forecasts/bulk?beachIds=${BEACH_ID}`),
    { supabase: mockSupabase as never, user: null, params: {} },
  );
  const [currentBody, bulkBody, nowDiscovery, bestDiscovery] = await Promise.all([
    currentResponse.json(),
    bulkResponse.json(),
    discoverSurfSpots("contract-user", {
      discoveryMode: "now", includeBeachIds: [BEACH_ID], userLocation: beach, throwOnFailure: true,
    }),
    discoverSurfSpots("contract-user", {
      discoveryMode: "best-window", includeBeachIds: [BEACH_ID], userLocation: beach, throwOnFailure: true,
    }),
  ]);
  const authority = selectBeachDayWindows({
    forecasts: rows, beach, userPrefs: null, sunTimesCache: sunTimes, now,
    localDate: "2026-09-10", userSkillLevel: "intermediate",
  });
  const weekScout = await generateWeekScoutForecast("contract-user", {
    candidateBeachIds: [BEACH_ID], localTimezone: beach.timezone!, startLocalDate: "2026-09-10", dayCount: 1,
  } as never, weekScoutDependencies(now));
  const bestRecommendation = bestDiscovery.recommendations[0];
  return {
    current: currentBody.data.current as EnhancedForecastEntity,
    bulk: bulkBody.data,
    nowRecommendation: nowDiscovery.recommendations[0],
    bestRecommendation,
    nowContext: buildForecastRecommendationContext({
      beach, forecasts: [nowDiscovery.recommendations[0].forecast],
      window: nowDiscovery.recommendations[0].window, now,
    })!,
    bestWindowContext: buildForecastRecommendationContext({
      beach, forecasts: [bestRecommendation.forecast], window: bestRecommendation.window, now,
    })!,
    authority,
    weekScout: weekScout.days[0],
  };
}

async function runCurrentProducers(now: Date) {
  jest.setSystemTime(now);
  const [currentResponse, bulkResponse, discovery] = await Promise.all([
    getCurrentForecast(new NextRequest(
      `http://localhost/api/forecasts/current?beachId=${BEACH_ID}`,
    )),
    bulkForecastHandler(
      new NextRequest(`http://localhost/api/forecasts/bulk?beachIds=${BEACH_ID}`),
      { supabase: mockSupabase as never, user: null, params: {} },
    ),
    discoverSurfSpots("contract-user", {
      discoveryMode: "now", includeBeachIds: [BEACH_ID], userLocation: beach, throwOnFailure: true,
    }),
  ]);
  return {
    current: (await currentResponse.json()).data.current as EnhancedForecastEntity,
    bulk: (await bulkResponse.json()).data,
    recommendation: discovery.recommendations[0],
  };
}

describe("surf authority producer contract", () => {
  let result: ProducerResults;
  let shifted: CurrentProducerResults;

  beforeAll(async () => {
    jest.useFakeTimers({ now: NOW });
    result = await runProducers(NOW);
    shifted = await runCurrentProducers(SHIFTED_NOW);
  });

  afterAll(() => jest.useRealTimers());

  describe("current row", () => {
    it("keeps current, bulk, and discovery on the latest past row", () => {
      const bulkAt = result.bulk.displayForecasts[BEACH_ID].forecastAt;
      expect({
        current: result.current.forecast_at,
        bulk: bulkAt,
        discovery: result.nowRecommendation.forecast.forecast_at,
      }).toEqual({ current: CURRENT_AT, bulk: CURRENT_AT, discovery: CURRENT_AT });
      expect([result.current.forecast_at, bulkAt, result.nowRecommendation.forecast.forecast_at])
        .not.toContain(NEXT_AT);
    });

    it("moves every current-row producer together after the next row becomes current", () => {
      const bulkAt = shifted.bulk.displayForecasts[BEACH_ID].forecastAt;
      expect({
        current: shifted.current.forecast_at,
        bulk: bulkAt,
        discovery: shifted.recommendation.forecast.forecast_at,
      }).toEqual({ current: NEXT_AT, bulk: NEXT_AT, discovery: NEXT_AT });
    });
  });

  describe("display swell", () => {
    it("uses the same offshore tuple everywhere", () => {
      const direct = resolveDisplaySwell(currentRow, { centerDeg: 200, halfwidthDeg: 30 });
      expect(direct.source).toBe("offshore");
      expect({
        bulk: result.bulk.displaySwell[BEACH_ID],
        nowContext: {
          period: result.nowContext.swellPeriod,
          direction: result.nowContext.swellDirection,
        },
      }).toEqual({
        bulk: direct,
        nowContext: {
          period: formatDisplaySwellPeriod(direct.periodSeconds),
          direction: degreeToCardinal(direct.directionDeg!),
        },
      });
      // Negative control: none of the named-partition values (3 ft / 9s / W) leak through.
      expect(result.bulk.displaySwell[BEACH_ID]).not.toMatchObject({ periodSeconds: 9 });
      expect(result.nowContext.swellPeriod).not.toBe("9s");
      expect(result.nowContext.swellDirection).not.toBe("W");
    });

    it("resolves the best-window context swell from its own forecast row", () => {
      const direct = resolveDisplaySwell(
        result.bestRecommendation.forecast,
        { centerDeg: 200, halfwidthDeg: 30 },
      );
      expect(result.bestWindowContext.swellPeriod).toBe(formatDisplaySwellPeriod(direct.periodSeconds));
      expect(result.bestWindowContext.swellDirection).toBe(degreeToCardinal(direct.directionDeg!));
    });
  });

  describe("verdict", () => {
    it("shares one recommendation label", () => {
      const direct = resolveRecommendationLabel({
        beach, forecast: currentRow, score: result.bulk.conditionScores[BEACH_ID],
      }).label;
      expect(result.bulk.recommendationLabels[BEACH_ID]).toBe(direct);
      expect(result.nowRecommendation.recommendationLabel).toBe(direct);
    });
  });

  describe("best window", () => {
    it("shares display bounds across discovery, surf call, authority, and Week Scout", () => {
      const discoveryStart = result.bestRecommendation.window.displayWindowStart!.toISOString();
      const discoveryEnd = result.bestRecommendation.window.displayWindowEnd!.toISOString();
      expect(result.bestWindowContext.displayWindowStart).toBe(discoveryStart);
      expect(result.bestWindowContext.displayWindowEnd).toBe(discoveryEnd);
      expect(result.authority.bestDayWindow?.displayWindowStart.toISOString()).toBe(discoveryStart);
      expect(result.authority.bestDayWindow?.displayWindowEnd.toISOString()).toBe(discoveryEnd);
      expect(result.weekScout.bestDayWindow?.displayWindowStart).toBe(discoveryStart);
      expect(result.weekScout.bestDayWindow?.displayWindowEnd).toBe(discoveryEnd);
      expect(result.weekScout.bestDayWindow?.isBeachDayBest).toBe(true);
    });
  });
});
