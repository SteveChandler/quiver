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
  wave_height_om: number | null;
  wave_direction_om: number | null;
  swell_direction_om: number | null;
  swell_1_direction: string | null;
};

const mockSupabaseClient = createMockSupabaseClient();

jest.mock("@/lib/middleware/api-wrappers", () => ({
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
    wave_height_om: null,
    wave_direction_om: null,
    swell_direction_om: null,
    swell_1_direction: null,
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
  beachRows?: Array<{ id: string; shoaling_factors: unknown }> | null;
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
  });

  it("returns empty forecasts for missing, empty, or whitespace-only beachIds", async () => {
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

      expect(result.data.forecasts).toEqual({});
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
      beachRows: [{ id: "beach-1", shoaling_factors: { "270": 1.05 } }],
    });

    const request = createMockRequest("GET", "http://localhost:3000/api/forecasts/bulk", {
      searchParams: { beachIds: "beach-1" },
    });

    const response = await GET(request);
    const result = await expectSuccessResponse<ForecastsBulkResponse>(response, 200);

    expect(result.data.forecasts["beach-1"]).toBe(4.5);
    expect(result.data.waterTemps).toEqual({ "beach-1": "63" });
    expect(result.data.isCalibrated).toEqual({ "beach-1": true });
  });
});
