/**
 * @jest-environment node
 */

import { GET } from "@/app/api/forecasts/bulk/route";
import {
  createMockRequest,
  createMockSupabaseClient,
  expectSuccessResponse,
  setupApiTestEnvironment,
} from "@/test-utils/api-test-helpers";

interface BulkForecastResponse {
  forecasts: Record<string, number | undefined>;
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

jest.mock("@/lib/supabase/api-server-client", () => ({
  createAPIServerClient: jest.fn(() => mockSupabaseClient),
}));

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: jest.fn(() => mockSupabaseClient),
}));

jest.mock("@/lib/services/forecast/v5-display-gate", () => ({
  applyV51DisplayOverrideToForecasts: jest.fn(async (forecasts: ForecastRow[]) => forecasts),
}));

jest.mock("@/lib/api-utils", () => {
  const actual = jest.requireActual("@/lib/api-utils");
  return {
    ...actual,
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
  };
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
  beachError?: { message: string } | null;
  waterRows?: Array<{ beach_id: string; water_temp: string | null }> | null;
} = {}) {
  const forecastChain = queryChain({
    data: options.forecastRows ?? [],
    error: options.forecastError ?? null,
  });
  const beachChain = queryChain({
    data: options.beachRows ?? [],
    error: options.beachError ?? null,
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

  return { forecastChain, beachChain, waterChain };
}

describe("/api/forecasts/bulk", () => {
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

  it("returns empty forecasts when beachIds is missing or empty", async () => {
    for (const url of [
      "http://localhost:3000/api/forecasts/bulk",
      "http://localhost:3000/api/forecasts/bulk?beachIds=",
      "http://localhost:3000/api/forecasts/bulk?beachIds=   ",
    ]) {
      const response = await GET(createMockRequest("GET", url));
      const data = await expectSuccessResponse<BulkForecastResponse>(response, 200);

      expect(data.data).toEqual({ forecasts: {}, waterTemps: {}, isCalibrated: {} });
    }
    expect(mockSupabaseClient.from).not.toHaveBeenCalled();
  });

  it("fetches current forecasts from enhanced_forecasts for a single beach", async () => {
    const { forecastChain } = mockBulkQueries({
      forecastRows: [forecastRow("beach-1", "1.2")],
    });

    const response = await GET(
      createMockRequest("GET", "http://localhost:3000/api/forecasts/bulk?beachIds=beach-1"),
    );
    const data = await expectSuccessResponse<BulkForecastResponse>(response, 200);

    expect(mockSupabaseClient.from).toHaveBeenCalledWith("enhanced_forecasts");
    expect(forecastChain.in).toHaveBeenCalledWith("beach_id", ["beach-1"]);
    expect(data.data.forecasts["beach-1"]).toBe(1.2);
  });

  it("fetches forecasts for multiple beaches", async () => {
    const { forecastChain } = mockBulkQueries({
      forecastRows: [
        forecastRow("beach-1", "2.5"),
        forecastRow("beach-2", "3.2"),
        forecastRow("beach-3", "1.8"),
      ],
    });

    const response = await GET(
      createMockRequest(
        "GET",
        "http://localhost:3000/api/forecasts/bulk?beachIds=beach-1,beach-2,beach-3",
      ),
    );
    const data = await expectSuccessResponse<BulkForecastResponse>(response, 200);

    expect(forecastChain.in).toHaveBeenCalledWith("beach_id", [
      "beach-1",
      "beach-2",
      "beach-3",
    ]);
    expect(data.data.forecasts).toEqual({
      "beach-1": 2.5,
      "beach-2": 3.2,
      "beach-3": 1.8,
    });
  });

  it("limits, trims, and filters beach IDs before querying", async () => {
    const beachIds = Array.from({ length: 60 }, (_, i) => `beach-${i}`);
    const { forecastChain } = mockBulkQueries();

    await GET(
      createMockRequest(
        "GET",
        `http://localhost:3000/api/forecasts/bulk?beachIds= ${beachIds.join(" , ")} ,,`,
      ),
    );

    expect(forecastChain.in).toHaveBeenCalledWith("beach_id", beachIds.slice(0, 50));
  });

  it("returns a 500 error when the forecast query fails", async () => {
    mockBulkQueries({
      forecastRows: null,
      forecastError: { message: "Database connection failed" },
    });

    const response = await GET(
      createMockRequest("GET", "http://localhost:3000/api/forecasts/bulk?beachIds=beach-1"),
    );
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.error).toContain("Failed to fetch bulk forecasts");
  });

  it("returns empty maps when no forecast rows match", async () => {
    mockBulkQueries();

    const response = await GET(
      createMockRequest("GET", "http://localhost:3000/api/forecasts/bulk?beachIds=beach-1,beach-2"),
    );
    const data = await expectSuccessResponse<BulkForecastResponse>(response, 200);

    expect(data.data).toEqual({ forecasts: {}, waterTemps: {}, isCalibrated: {} });
  });

  it("omits beaches with null or non-numeric wave_height", async () => {
    mockBulkQueries({
      forecastRows: [
        forecastRow("beach-1", null),
        forecastRow("beach-2", "knee high"),
      ],
    });

    const response = await GET(
      createMockRequest("GET", "http://localhost:3000/api/forecasts/bulk?beachIds=beach-1,beach-2"),
    );
    const data = await expectSuccessResponse<BulkForecastResponse>(response, 200);

    expect(data.data.forecasts).toEqual({});
  });

  it("returns water temps from the nearest future enhanced forecast row", async () => {
    mockBulkQueries({
      forecastRows: [forecastRow("beach-1", "2.5")],
      waterRows: [{ beach_id: "beach-1", water_temp: "64" }],
    });

    const response = await GET(
      createMockRequest("GET", "http://localhost:3000/api/forecasts/bulk?beachIds=beach-1"),
    );
    const data = await expectSuccessResponse<BulkForecastResponse>(response, 200);

    expect(data.data.waterTemps).toEqual({ "beach-1": "64" });
  });

  it("returns calibration status for beaches with shoaling_factors", async () => {
    mockBulkQueries({
      forecastRows: [
        forecastRow("beach-a", "2.5"),
        forecastRow("beach-b", "3.1"),
      ],
      beachRows: [
        { id: "beach-a", shoaling_factors: { "270": 1.05 } },
        { id: "beach-b", shoaling_factors: null },
      ],
    });

    const response = await GET(
      createMockRequest("GET", "http://localhost:3000/api/forecasts/bulk?beachIds=beach-a,beach-b"),
    );
    const data = await expectSuccessResponse<BulkForecastResponse>(response, 200);

    expect(data.data.isCalibrated).toEqual({
      "beach-a": true,
      "beach-b": false,
    });
  });

  it("keeps forecast data when the calibration query fails", async () => {
    mockBulkQueries({
      forecastRows: [forecastRow("beach-1", "2.5")],
      beachRows: null,
      beachError: { message: "rls denied" },
    });

    const response = await GET(
      createMockRequest("GET", "http://localhost:3000/api/forecasts/bulk?beachIds=beach-1"),
    );
    const data = await expectSuccessResponse<BulkForecastResponse>(response, 200);

    expect(data.data.forecasts).toEqual({ "beach-1": 2.5 });
    expect(data.data.isCalibrated).toEqual({});
  });
});
