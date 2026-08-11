/**
 * @jest-environment node
 */

import {
  createMockRequest,
  createMockSupabaseClient,
  expectSuccessResponse,
  setupApiTestEnvironment,
} from "@/test-utils/api-test-helpers";

interface ForecastsBulkResponse {
  forecasts: Record<string, number>;
  displayForecasts: Record<string, {
    label: string;
    minFt: number;
    maxFt: number;
    forecastAt: string;
    context: "today_headline" | "selected_hour";
  } | undefined>;
  waterTemps: Record<string, string | undefined>;
  isCalibrated: Record<string, boolean>;
  conditionScores: Record<string, number | undefined>;
  conditionSummaries: Record<
    string,
    "EPIC" | "GOOD" | "FAIR" | "RIDEABLE" | "MEH" | "UNKNOWN"
  >;
  swellPartitions: Record<string, unknown>;
  swellPartitionTimeline: Record<string, unknown[]>;
  recommendationAvailability: {
    state: "available" | "none";
    reasonCode?: "major_event_hold" | "hold_state_unavailable";
    holdEpoch: string;
    resolutionAsOf?: string;
  };
}

type HoldCandidate = {
  candidateId: string;
  beachId: string;
  startsAt: string;
  endsAt: string;
};

type QueryResult<T> = {
  data: T | null;
  error: { message: string } | null;
};

type ForecastRow = {
  beach_id: string;
  forecast_date: string;
  forecast_time: string;
  forecast_at: string;
  wave_height: string | null;
  wave_period: string | null;
  wave_direction: string | null;
  wave_height_om: number | null;
  wave_direction_om: number | null;
  swell_direction_om: number | null;
  swell_1_height: string | null;
  swell_1_period: string | null;
  swell_1_direction: string | null;
  swell_2_height: string | null;
  swell_2_period: string | null;
  swell_2_direction: string | null;
  wind_wave_height: string | null;
  wind_wave_period: string | null;
  wind_wave_direction: string | null;
  wind_speed: string | null;
  wind_direction: string | null;
  wind_direction_deg: number | null;
  water_temp: string | null;
  tide_height: string | null;
  tide_status: string | null;
  confidence_score: number | null;
  data_source: string | null;
};

type BeachRow = {
  id: string;
  name: string;
  lat: number;
  lon: number;
  shoaling_factors: unknown;
  swell_window_min_deg: number | null;
  swell_window_max_deg: number | null;
  wind_offshore_deg: number | null;
  wind_offshore_tol_deg: number | null;
  wind_onshore_bad_kt: number | null;
  wind_cross_shore_ok_kt: number | null;
  preferred_tide_ft_min: number | null;
  preferred_tide_ft_max: number | null;
  preferred_tide_direction: string | null;
  tide_direction_sensitivity: string | null;
  skill_level: string | null;
  break_type: string | null;
};

const mockSupabaseClient = createMockSupabaseClient();
const STABLE_TEST_NOW = new Date("2026-07-07T18:00:00.000Z");
const AVAILABLE_HOLD_EPOCH = "available-hold-epoch";
const BEACH_ONE_ID = "11111111-1111-4111-8111-111111111111";
const BEACH_TWO_ID = "22222222-2222-4222-8222-222222222222";
const BEACH_THREE_ID = "33333333-3333-4333-8333-333333333333";
const mockEvaluateMajorEventHoldCandidates = jest.fn();

jest.mock("@/lib/middleware/api-wrappers", () => ({
  withNoStore: jest.requireActual("@/lib/middleware/api-wrappers/cache-wrappers")
    .withNoStore,
  createSuccessResponse: jest.fn((data: unknown) => {
    return new Response(
      JSON.stringify({ success: true, data, timestamp: new Date().toISOString() }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  }),
  handleApiError: jest.fn((_error: unknown, message: string) => {
    return new Response(
      JSON.stringify({ success: false, error: message, timestamp: new Date().toISOString() }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }),
  withRateLimit: (handler: any) => handler,
  withAuth: (handler: any) => (request: any, context: any) =>
    handler(request, {
      params: context?.params ?? {},
      user: null,
      supabase: mockSupabaseClient,
    }),
}));

jest.mock("@/lib/services/forecast/v5-display-gate", () => ({
  applyV51DisplayOverrideToForecasts: jest.fn(async (forecasts: ForecastRow[]) => forecasts),
}));

jest.mock("@/lib/services/discovery", () => ({
  getBatchSunTimes: jest.fn(async () => new Map()),
}));

jest.mock("@/lib/recommendations/major-event-hold/service", () => ({
  evaluateMajorEventHoldCandidates: (input: unknown) =>
    mockEvaluateMajorEventHoldCandidates(input),
}));

function mockDisplayForForecast(
  forecast: ForecastRow,
  context: "today_headline" | "selected_hour",
) {
  const value = forecast.wave_height;
  if (value == null) return null;
  if (value.trim().toLowerCase() === "flat") {
    return {
      label: "Flat",
      minFt: 0,
      maxFt: 0,
      forecastAt: forecast.forecast_at,
      context,
    };
  }

  const rangeMatch = value.match(/(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)/);
  if (rangeMatch) {
    const minFt = Math.floor(Number(rangeMatch[1]));
    const maxFt = Math.ceil(Number(rangeMatch[2]));
    return {
      label: minFt === maxFt ? `${minFt}ft` : `${minFt}-${maxFt}ft`,
      minFt,
      maxFt,
      forecastAt: forecast.forecast_at,
      context,
    };
  }

  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) return null;
  const minFt = Math.floor(parsed);
  const maxFt = Math.ceil(parsed);
  return {
    label: minFt === maxFt ? `${minFt}ft` : `${minFt}-${maxFt}ft`,
    minFt,
    maxFt,
    forecastAt: forecast.forecast_at,
    context,
  };
}

jest.mock("@/lib/services/forecast/today-headline", () => ({
  resolveTodayHeadline: jest.fn(({ forecasts }: { forecasts: ForecastRow[] }) => {
    const forecast = forecasts[0];
    if (!forecast) return null;
    const display = mockDisplayForForecast(forecast, "today_headline");
    if (!display) return null;
    return {
      display,
      window: {
        start: new Date(forecast.forecast_at),
        end: new Date(new Date(forecast.forecast_at).getTime() + 60 * 60 * 1000),
        waveHeight: forecast.wave_height,
        sourceForecast: forecast,
      },
    };
  }),
  resolveSelectedHourDisplay: jest.fn((forecast: ForecastRow | null) =>
    forecast ? mockDisplayForForecast(forecast, "selected_hour") : null
  ),
}));

jest.mock("@/lib/services/discovery/window-selector/window-scorer", () => ({
  scoreWindowConditionScore: jest.fn(() => 72),
}));

const { GET, conditionSummaryFromScore } = require("@/app/api/forecasts/bulk/route");

describe("conditionSummaryFromScore", () => {
  it.each([
    [80, "EPIC"],
    [79.9, "GOOD"],
    [70, "GOOD"],
    [69.9, "FAIR"],
    [55, "FAIR"],
    [54.9, "RIDEABLE"],
    [40, "RIDEABLE"],
    [39.9, "MEH"],
    [0, "MEH"],
    [Number.NaN, "UNKNOWN"],
  ])("maps score %s to %s", (score: number, summary: string) => {
    expect(conditionSummaryFromScore(score)).toBe(summary);
  });
});

function forecastRow(
  beachId: string,
  waveHeight: string | null,
  offsetHours = 1,
): ForecastRow {
  const forecastAt = new Date(Date.now() + offsetHours * 60 * 60 * 1000);
  return {
    beach_id: beachId,
    forecast_at: forecastAt.toISOString(),
    forecast_date: forecastAt.toISOString().split("T")[0],
    forecast_time: forecastAt.toISOString().slice(11, 19),
    wave_height: waveHeight,
    wave_period: "12s",
    wave_direction: "W",
    wave_height_om: null,
    wave_direction_om: null,
    swell_direction_om: null,
    swell_1_height: waveHeight,
    swell_1_period: "12s",
    swell_1_direction: null,
    swell_2_height: null,
    swell_2_period: null,
    swell_2_direction: null,
    wind_wave_height: null,
    wind_wave_period: null,
    wind_wave_direction: null,
    wind_speed: "6 mph",
    wind_direction: "E",
    wind_direction_deg: 90,
    tide_height: "2.5 ft",
    tide_status: "Rising",
    confidence_score: 80,
    data_source: "NOAA_NWS",
    water_temp: null,
  };
}

function beachRow(id: string, overrides: Partial<BeachRow> = {}): BeachRow {
  return {
    id,
    name: `Beach ${id}`,
    lat: 32.75,
    lon: -117.25,
    shoaling_factors: null,
    swell_window_min_deg: null,
    swell_window_max_deg: null,
    wind_offshore_deg: null,
    wind_offshore_tol_deg: null,
    wind_onshore_bad_kt: null,
    wind_cross_shore_ok_kt: null,
    preferred_tide_ft_min: null,
    preferred_tide_ft_max: null,
    preferred_tide_direction: null,
    tide_direction_sensitivity: null,
    skill_level: null,
    break_type: null,
    ...overrides,
  };
}

function queryChain<T>(result: QueryResult<T>) {
  const chain: any = {
    select: jest.fn(),
    in: jest.fn(),
    gte: jest.fn(),
    lt: jest.fn(),
    not: jest.fn(),
    order: jest.fn(),
    then: jest.fn((onResolve: (value: QueryResult<T>) => unknown) =>
      Promise.resolve(onResolve(result)),
    ),
  };

  chain.select.mockReturnValue(chain);
  chain.in.mockReturnValue(chain);
  chain.gte.mockReturnValue(chain);
  chain.lt.mockReturnValue(chain);
  chain.not.mockReturnValue(chain);
  chain.order.mockReturnValue(chain);

  return chain;
}

function mockBulkQueries(options: {
  forecastRows?: ForecastRow[] | null;
  forecastError?: { message: string } | null;
  beachRows?: BeachRow[] | null;
} = {}) {
  const forecastRows = options.forecastRows ?? [];
  const beachRows =
    options.beachRows !== undefined
      ? options.beachRows
      : Array.from(new Set(forecastRows?.map((row) => row.beach_id) ?? []))
          .map((beachId) => beachRow(beachId));
  const forecastChain = queryChain({
    data: forecastRows,
    error: options.forecastError ?? null,
  });
  const beachChain = queryChain({
    data: beachRows,
    error: null,
  });
  mockSupabaseClient.from = jest.fn((table: string) => {
    if (table === "enhanced_forecasts") return forecastChain;
    if (table === "beaches") return beachChain;
    return queryChain({ data: null, error: null });
  }) as any;

  return { forecastChain };
}

describe("GET /api/forecasts/bulk", () => {
  let cleanup: () => void;

  beforeEach(() => {
    const testEnv = setupApiTestEnvironment();
    cleanup = testEnv.cleanup;
    jest.useFakeTimers({ now: STABLE_TEST_NOW });
    jest.clearAllMocks();
    mockEvaluateMajorEventHoldCandidates.mockImplementation(
      async ({ candidates }: { candidates: HoldCandidate[] }) =>
        candidates.map((candidate) => ({
          candidateId: candidate.candidateId,
          evaluation: {
            outcome: "allow",
            holdIds: [],
            holdEpoch: AVAILABLE_HOLD_EPOCH,
          },
          recommendationAvailability: {
            state: "available",
            holdEpoch: AVAILABLE_HOLD_EPOCH,
            resolutionAsOf: STABLE_TEST_NOW.toISOString(),
          },
        })),
    );
    mockSupabaseClient.from = jest.fn(() => queryChain({ data: null, error: null })) as any;
  });

  afterEach(() => {
    jest.useRealTimers();
    cleanup?.();
  });

  it("fetches forecasts for multiple beaches from enhanced_forecasts", async () => {
    mockBulkQueries({
      forecastRows: [
        forecastRow(BEACH_ONE_ID, "4.5"),
        forecastRow(BEACH_TWO_ID, "3.2"),
        forecastRow(BEACH_THREE_ID, "5.8"),
      ],
      beachRows: [
        beachRow(BEACH_ONE_ID),
        beachRow(BEACH_TWO_ID),
        beachRow(BEACH_THREE_ID),
      ],
    });

    const request = createMockRequest("GET", "http://localhost:3000/api/forecasts/bulk", {
      searchParams: {
        beachIds: `${BEACH_ONE_ID},${BEACH_TWO_ID},${BEACH_THREE_ID}`,
      },
    });

    const response = await GET(request);
    const result = await expectSuccessResponse<ForecastsBulkResponse>(response, 200);

    expect(result.data.forecasts).toEqual({
      [BEACH_ONE_ID]: 4.5,
      [BEACH_TWO_ID]: 3.2,
      [BEACH_THREE_ID]: 5.8,
    });
    expect(result.data.conditionScores).toEqual({
      [BEACH_ONE_ID]: 72,
      [BEACH_TWO_ID]: 72,
      [BEACH_THREE_ID]: 72,
    });
    expect(result.data.conditionSummaries).toEqual({
      [BEACH_ONE_ID]: "GOOD",
      [BEACH_TWO_ID]: "GOOD",
      [BEACH_THREE_ID]: "GOOD",
    });
    expect(result.data.recommendationAvailability).toEqual({
      state: "available",
      holdEpoch: AVAILABLE_HOLD_EPOCH,
      resolutionAsOf: STABLE_TEST_NOW.toISOString(),
    });
  });

  it("returns all empty maps for missing, empty, or whitespace-only beachIds", async () => {
    const cases: Array<Record<string, string>> = [
      {},
      { beachIds: "" },
      { beachIds: "   ,  ,   " },
    ];

    for (const searchParams of cases) {
      const request = createMockRequest("GET", "http://localhost:3000/api/forecasts/bulk", {
        searchParams,
      });

      const response = await GET(request);
      const result = await expectSuccessResponse<ForecastsBulkResponse>(response, 200);

      expect(result.data).toEqual({
        forecasts: {},
        displayForecasts: {},
        waterTemps: {},
        isCalibrated: {},
        conditionScores: {},
        conditionSummaries: {},
        swellPartitions: {},
        swellPartitionTimeline: {},
        recommendationAvailability: {
          state: "none",
          reasonCode: "hold_state_unavailable",
          holdEpoch: "hold-state-unavailable",
        },
      });
    }
    expect(mockSupabaseClient.from).not.toHaveBeenCalled();
  });

  it("handles beaches with no forecast data", async () => {
    mockBulkQueries({
      forecastRows: [forecastRow(BEACH_ONE_ID, "4.5")],
    });

    const request = createMockRequest("GET", "http://localhost:3000/api/forecasts/bulk", {
      searchParams: { beachIds: `${BEACH_ONE_ID},beach-without-forecast` },
    });

    const response = await GET(request);
    const result = await expectSuccessResponse<ForecastsBulkResponse>(response, 200);

    expect(result.data.forecasts).toHaveProperty(BEACH_ONE_ID, 4.5);
    expect(result.data.forecasts).not.toHaveProperty("beach-without-forecast");
    expect(result.data.conditionSummaries).toEqual({
      [BEACH_ONE_ID]: "GOOD",
      "beach-without-forecast": "UNKNOWN",
    });
  });

  it("limits to 50 beaches maximum", async () => {
    const beachIds = Array.from({ length: 60 }, (_, i) => `beach-${i + 1}`);
    const { forecastChain } = mockBulkQueries();

    const request = createMockRequest("GET", "http://localhost:3000/api/forecasts/bulk", {
      searchParams: { beachIds: beachIds.join(",") },
    });

    await GET(request);

    expect(forecastChain.in).toHaveBeenCalledWith("beach_id", beachIds.slice(0, 50));
  });

  it("returns partial forecast maps when some beaches have no row", async () => {
    mockBulkQueries({
      forecastRows: [
        forecastRow("beach-1", "4.5"),
        forecastRow("beach-3", "5.8"),
      ],
    });

    const request = createMockRequest("GET", "http://localhost:3000/api/forecasts/bulk", {
      searchParams: { beachIds: "beach-1,beach-2,beach-3" },
    });

    const response = await GET(request);
    const result = await expectSuccessResponse<ForecastsBulkResponse>(response, 200);

    expect(result.data.forecasts).toHaveProperty("beach-1", 4.5);
    expect(result.data.forecasts).toHaveProperty("beach-3", 5.8);
    expect(result.data.forecasts).not.toHaveProperty("beach-2");
  });

  it("returns 500 on forecast query database errors", async () => {
    mockBulkQueries({
      forecastRows: null,
      forecastError: { message: "Database connection failed" },
    });

    const request = createMockRequest("GET", "http://localhost:3000/api/forecasts/bulk", {
      searchParams: { beachIds: "beach-1,beach-2" },
    });

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.success).toBe(false);
  });

  it("filters out null and non-numeric wave heights", async () => {
    mockBulkQueries({
      forecastRows: [
        forecastRow("beach-1", null),
        forecastRow("beach-2", "overhead"),
      ],
    });

    const request = createMockRequest("GET", "http://localhost:3000/api/forecasts/bulk", {
      searchParams: { beachIds: "beach-1,beach-2" },
    });

    const response = await GET(request);
    const result = await expectSuccessResponse<ForecastsBulkResponse>(response, 200);

    expect(result.data.forecasts).toEqual({});
  });

  it("parses v5.1 display ranges without dropping the beach", async () => {
    mockBulkQueries({
      forecastRows: [forecastRow("beach-1", "3-4ft")],
    });

    const request = createMockRequest("GET", "http://localhost:3000/api/forecasts/bulk", {
      searchParams: { beachIds: "beach-1" },
    });

    const response = await GET(request);
    const result = await expectSuccessResponse<ForecastsBulkResponse>(response, 200);

    expect(result.data.forecasts).toEqual({ "beach-1": 3 });
  });

  it("preserves flat v5.1 display as zero", async () => {
    mockBulkQueries({
      forecastRows: [forecastRow("beach-1", "Flat")],
    });

    const request = createMockRequest("GET", "http://localhost:3000/api/forecasts/bulk", {
      searchParams: { beachIds: "beach-1" },
    });

    const response = await GET(request);
    const result = await expectSuccessResponse<ForecastsBulkResponse>(response, 200);

    expect(result.data.forecasts).toEqual({ "beach-1": 0 });
  });

  it("trims whitespace and filters empty strings from beach IDs", async () => {
    const { forecastChain } = mockBulkQueries();

    const request = createMockRequest("GET", "http://localhost:3000/api/forecasts/bulk", {
      searchParams: { beachIds: "  beach-1  ,  beach-2  ,,," },
    });

    await GET(request);

    expect(forecastChain.in).toHaveBeenCalledWith("beach_id", ["beach-1", "beach-2"]);
  });

  it("returns water temps and calibration status in the envelope", async () => {
    const currentRow = forecastRow(BEACH_ONE_ID, "4.5");
    currentRow.water_temp = "63";
    mockBulkQueries({
      forecastRows: [currentRow],
      beachRows: [beachRow(BEACH_ONE_ID, { shoaling_factors: { "270": 1.05 } })],
    });

    const request = createMockRequest("GET", "http://localhost:3000/api/forecasts/bulk", {
      searchParams: { beachIds: BEACH_ONE_ID },
    });

    const response = await GET(request);
    const result = await expectSuccessResponse<ForecastsBulkResponse>(response, 200);

    expect(result.data.forecasts[BEACH_ONE_ID]).toBe(4.5);
    expect(result.data.waterTemps).toEqual({ [BEACH_ONE_ID]: "63" });
    expect(result.data.isCalibrated).toEqual({ [BEACH_ONE_ID]: true });
    expect(result.data.conditionSummaries).toEqual({ [BEACH_ONE_ID]: "GOOD" });
    expect(
      (mockSupabaseClient.from as jest.Mock).mock.calls.filter(
        ([table]) => table === "enhanced_forecasts",
      ),
    ).toHaveLength(1);
  });

  it("fails closed when hold resolution is unavailable without hiding physical forecasts", async () => {
    mockEvaluateMajorEventHoldCandidates.mockImplementationOnce(
      async ({ candidates }: { candidates: HoldCandidate[] }) =>
        candidates.map((candidate) => ({
          candidateId: candidate.candidateId,
          evaluation: {
            outcome: "explicit_none",
            reasonCode: "hold_state_unavailable",
            holdIds: [],
            holdEpoch: "unresolved-hold-epoch",
          },
          recommendationAvailability: {
            state: "none",
            reasonCode: "hold_state_unavailable",
            holdEpoch: "unresolved-hold-epoch",
            resolutionAsOf: STABLE_TEST_NOW.toISOString(),
          },
        })),
    );
    mockBulkQueries({
      forecastRows: [forecastRow(BEACH_ONE_ID, "4.5")],
      beachRows: [beachRow(BEACH_ONE_ID)],
    });

    const request = createMockRequest("GET", "http://localhost:3000/api/forecasts/bulk", {
      searchParams: { beachIds: BEACH_ONE_ID },
    });

    const response = await GET(request);
    const result = await expectSuccessResponse<ForecastsBulkResponse>(response, 200);

    expect(result.data.forecasts).toEqual({ [BEACH_ONE_ID]: 4.5 });
    expect(result.data.displayForecasts[BEACH_ONE_ID]).toMatchObject({
      label: "4-5ft",
      minFt: 4,
      maxFt: 5,
    });
    expect(result.data.conditionScores).toEqual({});
    expect(result.data.conditionSummaries).toEqual({ [BEACH_ONE_ID]: "UNKNOWN" });
    expect(result.data.recommendationAvailability).toEqual({
      state: "none",
      reasonCode: "hold_state_unavailable",
      holdEpoch: "unresolved-hold-epoch",
      resolutionAsOf: STABLE_TEST_NOW.toISOString(),
    });
    expect(response.headers.get("Cache-Control")).toBe(
      "private, no-store, no-cache, must-revalidate",
    );
  });
});
