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
  waterTemps: Record<string, string | undefined>;
  isCalibrated: Record<string, boolean>;
  conditionScores: Record<string, number | undefined>;
  conditionSummaries: Record<string, "GOOD" | "FAIR" | "CHECK" | "UNKNOWN">;
}

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

jest.mock("@/lib/middleware/api-wrappers", () => ({
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

jest.mock("@/lib/services/discovery/window-selector/window-scorer", () => ({
  scoreWindowWithEngine: jest.fn(() => 72),
}));

const { GET } = require("@/app/api/forecasts/bulk/route");

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
    not: jest.fn(),
    order: jest.fn(),
    then: jest.fn((onResolve: (value: QueryResult<T>) => unknown) =>
      Promise.resolve(onResolve(result)),
    ),
  };

  chain.select.mockReturnValue(chain);
  chain.in.mockReturnValue(chain);
  chain.gte.mockReturnValue(chain);
  chain.not.mockReturnValue(chain);
  chain.order.mockReturnValue(chain);

  return chain;
}

function mockBulkQueries(options: {
  forecastRows?: ForecastRow[] | null;
  forecastError?: { message: string } | null;
  beachRows?: BeachRow[] | null;
  waterRows?: Array<{ beach_id: string; water_temp: string | null }> | null;
} = {}) {
  const forecastChain = queryChain({
    data: options.forecastRows ?? [],
    error: options.forecastError ?? null,
  });
  const beachChain = queryChain({
    data: options.beachRows ?? [],
    error: null,
  });
  const waterChain = queryChain({
    data: options.waterRows ?? [],
    error: null,
  });

  let enhancedForecastCalls = 0;
  mockSupabaseClient.from = jest.fn((table: string) => {
    if (table === "enhanced_forecasts") {
      enhancedForecastCalls += 1;
      return enhancedForecastCalls === 1 ? forecastChain : waterChain;
    }
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
    jest.clearAllMocks();
    mockSupabaseClient.from = jest.fn(() => queryChain({ data: null, error: null })) as any;
  });

  afterEach(() => {
    cleanup?.();
  });

  it("fetches forecasts for multiple beaches from enhanced_forecasts", async () => {
    mockBulkQueries({
      forecastRows: [
        forecastRow("beach-1", "4.5"),
        forecastRow("beach-2", "3.2"),
        forecastRow("beach-3", "5.8"),
      ],
      beachRows: [
        beachRow("beach-1"),
        beachRow("beach-2"),
        beachRow("beach-3"),
      ],
    });

    const request = createMockRequest("GET", "http://localhost:3000/api/forecasts/bulk", {
      searchParams: { beachIds: "beach-1,beach-2,beach-3" },
    });

    const response = await GET(request);
    const result = await expectSuccessResponse<ForecastsBulkResponse>(response, 200);

    expect(result.data.forecasts).toEqual({
      "beach-1": 4.5,
      "beach-2": 3.2,
      "beach-3": 5.8,
    });
    expect(result.data.conditionScores).toEqual({
      "beach-1": 72,
      "beach-2": 72,
      "beach-3": 72,
    });
    expect(result.data.conditionSummaries).toEqual({
      "beach-1": "GOOD",
      "beach-2": "GOOD",
      "beach-3": "GOOD",
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
        waterTemps: {},
        isCalibrated: {},
        conditionScores: {},
        conditionSummaries: {},
      });
    }
    expect(mockSupabaseClient.from).not.toHaveBeenCalled();
  });

  it("handles beaches with no forecast data", async () => {
    mockBulkQueries({
      forecastRows: [forecastRow("beach-with-forecast", "4.5")],
    });

    const request = createMockRequest("GET", "http://localhost:3000/api/forecasts/bulk", {
      searchParams: { beachIds: "beach-with-forecast,beach-without-forecast" },
    });

    const response = await GET(request);
    const result = await expectSuccessResponse<ForecastsBulkResponse>(response, 200);

    expect(result.data.forecasts).toHaveProperty("beach-with-forecast", 4.5);
    expect(result.data.forecasts).not.toHaveProperty("beach-without-forecast");
    expect(result.data.conditionSummaries).toEqual({
      "beach-with-forecast": "UNKNOWN",
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
    mockBulkQueries({
      forecastRows: [forecastRow("beach-1", "4.5")],
      waterRows: [{ beach_id: "beach-1", water_temp: "63" }],
      beachRows: [beachRow("beach-1", { shoaling_factors: { "270": 1.05 } })],
    });

    const request = createMockRequest("GET", "http://localhost:3000/api/forecasts/bulk", {
      searchParams: { beachIds: "beach-1" },
    });

    const response = await GET(request);
    const result = await expectSuccessResponse<ForecastsBulkResponse>(response, 200);

    expect(result.data.forecasts["beach-1"]).toBe(4.5);
    expect(result.data.waterTemps).toEqual({ "beach-1": "63" });
    expect(result.data.isCalibrated).toEqual({ "beach-1": true });
    expect(result.data.conditionSummaries).toEqual({ "beach-1": "GOOD" });
  });
});
