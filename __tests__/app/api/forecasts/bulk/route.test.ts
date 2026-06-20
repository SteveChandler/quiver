/**
 * @jest-environment node
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { GET } from "@/app/api/forecasts/bulk/route";
import { scoreWindowWithEngine } from "@/lib/services/discovery/window-selector/window-scorer";
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
  conditionScores: Record<string, number | undefined>;
  conditionSummaries: Record<string, "GOOD" | "FAIR" | "CHECK" | "UNKNOWN">;
  swellPartitions: Record<string, unknown>;
  swellPartitionTimeline: Record<string, unknown[]>;
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

jest.mock("@/lib/supabase/api-server-client", () => ({
  createAPIServerClient: jest.fn(() => mockSupabaseClient),
}));

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: jest.fn(() => mockSupabaseClient),
}));

jest.mock("@/lib/services/forecast/v5-display-gate", () => ({
  applyV51DisplayOverrideToForecasts: jest.fn(async (forecasts: ForecastRow[]) => forecasts),
}));

jest.mock("@/lib/services/discovery/window-selector/window-scorer", () => ({
  scoreWindowWithEngine: jest.fn(() => 72),
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
    (scoreWindowWithEngine as jest.Mock).mockReturnValue(72);
    mockSupabaseClient.from = jest.fn(() => queryChain({ data: null, error: null })) as any;
  });

  afterEach(() => {
    cleanup?.();
  });

  it("uses the shared API wrapper module for response helpers", () => {
    const source = readFileSync(
      join(process.cwd(), "app/api/forecasts/bulk/route.ts"),
      "utf8",
    );

    expect(source).not.toMatch(/@\/lib\/api-utils/);
    expect(source).toMatch(/@\/lib\/middleware\/api-wrappers/);
    expect(source).toMatch(/optional:\s*true/);
  });

  it("returns all empty maps when beachIds is missing or empty", async () => {
    for (const url of [
      "http://localhost:3000/api/forecasts/bulk",
      "http://localhost:3000/api/forecasts/bulk?beachIds=",
      "http://localhost:3000/api/forecasts/bulk?beachIds=   ",
    ]) {
      const response = await GET(createMockRequest("GET", url));
      const data = await expectSuccessResponse<BulkForecastResponse>(response, 200);

      expect(data.data).toEqual({
        forecasts: {},
        waterTemps: {},
        isCalibrated: {},
        conditionScores: {},
        conditionSummaries: {},
        swellPartitions: {},
        swellPartitionTimeline: {},
      });
    }
    expect(mockSupabaseClient.from).not.toHaveBeenCalled();
  });

  it("allows anonymous requests through optional auth", async () => {
    mockBulkQueries({
      forecastRows: [forecastRow("beach-1", "2.4")],
      beachRows: [beachRow("beach-1")],
    });

    const response = await GET(
      createMockRequest("GET", "http://localhost:3000/api/forecasts/bulk?beachIds=beach-1"),
    );
    const data = await expectSuccessResponse<BulkForecastResponse>(response, 200);

    expect(data.data.forecasts).toEqual({ "beach-1": 2.4 });
    expect(data.data.conditionSummaries).toEqual({ "beach-1": "GOOD" });
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

    const consoleErrorSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});

    try {
      const response = await GET(
        createMockRequest("GET", "http://localhost:3000/api/forecasts/bulk?beachIds=beach-1"),
      );
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toContain("Failed to fetch bulk forecasts");
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Error fetching bulk forecasts:",
        { message: "Database connection failed" },
      );
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  it("returns empty maps when no forecast rows match", async () => {
    mockBulkQueries();

    const response = await GET(
      createMockRequest("GET", "http://localhost:3000/api/forecasts/bulk?beachIds=beach-1,beach-2"),
    );
    const data = await expectSuccessResponse<BulkForecastResponse>(response, 200);

    expect(data.data).toEqual({
      forecasts: {},
      waterTemps: {},
      isCalibrated: {},
      conditionScores: {},
      conditionSummaries: {
        "beach-1": "UNKNOWN",
        "beach-2": "UNKNOWN",
      },
      swellPartitions: {},
      swellPartitionTimeline: {},
    });
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

  it("parses v5.1 display ranges without dropping the beach", async () => {
    mockBulkQueries({
      forecastRows: [forecastRow("beach-1", "3-4ft")],
    });

    const response = await GET(
      createMockRequest("GET", "http://localhost:3000/api/forecasts/bulk?beachIds=beach-1"),
    );
    const data = await expectSuccessResponse<BulkForecastResponse>(response, 200);

    expect(data.data.forecasts).toEqual({ "beach-1": 3 });
  });

  it("queries forecast rows through the second future UTC date for the 48-hour timeline", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-06-20T10:30:00Z"));
    const { forecastChain } = mockBulkQueries({
      forecastRows: [forecastRow("beach-1", "2.0")],
    });

    try {
      const response = await GET(
        createMockRequest("GET", "http://localhost:3000/api/forecasts/bulk?beachIds=beach-1"),
      );
      await expectSuccessResponse<BulkForecastResponse>(response, 200);

      expect(forecastChain.in).toHaveBeenCalledWith("forecast_date", [
        "2026-06-20",
        "2026-06-21",
        "2026-06-22",
      ]);
    } finally {
      jest.useRealTimers();
    }
  });

  it("returns an eight-step 48-hour swell partition timeline from nearest forecast rows", async () => {
    mockBulkQueries({
      forecastRows: [
        {
          ...forecastRow("beach-1", "2.0", 1),
          swell_1_direction: "W",
          swell_1_period: "10s",
          wind_direction_deg: 80,
        },
        {
          ...forecastRow("beach-1", "4.0", 4),
          swell_1_direction: "WNW",
          swell_1_period: "14s",
          wind_direction_deg: 120,
        },
        {
          ...forecastRow("beach-1", "5.0", 7),
          swell_1_direction: "NW",
          swell_1_period: "16s",
          wind_direction_deg: 160,
        },
        {
          ...forecastRow("beach-1", "6.0", 18),
          swell_1_direction: "N",
          swell_1_period: "18s",
          wind_direction_deg: 200,
        },
        {
          ...forecastRow("beach-1", "7.0", 25),
          swell_1_direction: "NE",
          swell_1_period: "20s",
          wind_direction_deg: 240,
        },
        {
          ...forecastRow("beach-1", "8.0", 36),
          swell_1_direction: "E",
          swell_1_period: "22s",
          wind_direction_deg: 280,
        },
        {
          ...forecastRow("beach-1", "9.0", 48),
          swell_1_direction: "SE",
          swell_1_period: "24s",
          wind_direction_deg: 320,
        },
      ],
    });

    const response = await GET(
      createMockRequest("GET", "http://localhost:3000/api/forecasts/bulk?beachIds=beach-1"),
    );
    const data = await expectSuccessResponse<BulkForecastResponse>(response, 200);

    expect(data.data.swellPartitionTimeline["beach-1"]).toHaveLength(8);
    expect(data.data.swellPartitionTimeline["beach-1"][0]).toMatchObject({
      s1Dir: 270,
      s1PeriodS: 10,
      s1HeightFt: 2,
      windDir: 80,
    });
    expect(data.data.swellPartitionTimeline["beach-1"][1]).toMatchObject({
      s1Dir: 292.5,
      s1PeriodS: 14,
      s1HeightFt: 4,
      windDir: 120,
    });
    expect(data.data.swellPartitionTimeline["beach-1"][2]).toMatchObject({
      s1Dir: 315,
      s1PeriodS: 16,
      s1HeightFt: 5,
      windDir: 160,
    });
    expect(data.data.swellPartitionTimeline["beach-1"][7]).toMatchObject({
      s1Dir: 135,
      s1PeriodS: 24,
      s1HeightFt: 9,
      windDir: 320,
    });
  });

  it("preserves flat v5.1 display as zero", async () => {
    mockBulkQueries({
      forecastRows: [forecastRow("beach-1", "Flat")],
    });

    const response = await GET(
      createMockRequest("GET", "http://localhost:3000/api/forecasts/bulk?beachIds=beach-1"),
    );
    const data = await expectSuccessResponse<BulkForecastResponse>(response, 200);

    expect(data.data.forecasts).toEqual({ "beach-1": 0 });
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

  it("returns condition scores and native summaries for scored current rows", async () => {
    (scoreWindowWithEngine as jest.Mock)
      .mockReturnValueOnce(71)
      .mockReturnValueOnce(40)
      .mockReturnValueOnce(39);
    mockBulkQueries({
      forecastRows: [
        forecastRow("beach-good", "3.5"),
        forecastRow("beach-fair", "2.5"),
        forecastRow("beach-check", "1.2"),
      ],
      beachRows: [
        beachRow("beach-good"),
        beachRow("beach-fair"),
        beachRow("beach-check"),
      ],
    });

    const response = await GET(
      createMockRequest(
        "GET",
        "http://localhost:3000/api/forecasts/bulk?beachIds=beach-good,beach-fair,beach-check,beach-missing",
      ),
    );
    const data = await expectSuccessResponse<BulkForecastResponse>(response, 200);

    expect(data.data.conditionScores).toEqual({
      "beach-good": 71,
      "beach-fair": 40,
      "beach-check": 39,
    });
    expect(data.data.conditionSummaries).toEqual({
      "beach-good": "GOOD",
      "beach-fair": "FAIR",
      "beach-check": "CHECK",
      "beach-missing": "UNKNOWN",
    });
  });

  it("keeps wave-height data when condition scoring fails", async () => {
    (scoreWindowWithEngine as jest.Mock).mockImplementation(() => {
      throw new Error("scoring unavailable");
    });
    mockBulkQueries({
      forecastRows: [forecastRow("beach-1", "2.5")],
      beachRows: [beachRow("beach-1")],
    });
    const consoleWarnSpy = jest
      .spyOn(console, "warn")
      .mockImplementation(() => {});

    try {
      const response = await GET(
        createMockRequest("GET", "http://localhost:3000/api/forecasts/bulk?beachIds=beach-1"),
      );
      const data = await expectSuccessResponse<BulkForecastResponse>(response, 200);

      expect(data.data.forecasts).toEqual({ "beach-1": 2.5 });
      expect(data.data.conditionScores).toEqual({});
      expect(data.data.conditionSummaries).toEqual({ "beach-1": "UNKNOWN" });
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        "Failed to score bulk forecast condition:",
        expect.objectContaining({ beachId: "beach-1" }),
      );
    } finally {
      consoleWarnSpy.mockRestore();
    }
  });

  it("returns calibration status for beaches with shoaling_factors", async () => {
    mockBulkQueries({
      forecastRows: [
        forecastRow("beach-a", "2.5"),
        forecastRow("beach-b", "3.1"),
      ],
      beachRows: [
        beachRow("beach-a", { shoaling_factors: { "270": 1.05 } }),
        beachRow("beach-b", { shoaling_factors: null }),
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

    const consoleErrorSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});

    try {
      const response = await GET(
        createMockRequest("GET", "http://localhost:3000/api/forecasts/bulk?beachIds=beach-1"),
      );
      const data = await expectSuccessResponse<BulkForecastResponse>(response, 200);

      expect(data.data.forecasts).toEqual({ "beach-1": 2.5 });
      expect(data.data.isCalibrated).toEqual({});
      expect(data.data.conditionSummaries).toEqual({ "beach-1": "UNKNOWN" });
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Error fetching beach calibration status:",
        { message: "rls denied" },
      );
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });
});
