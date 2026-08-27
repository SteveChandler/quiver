/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";
import currentForecastContract from "@/__tests__/fixtures/current-forecast-contract-v1.json";

const mockSupabase = {
  from: jest.fn(),
};
const mockUpdateBeachForecast = jest.fn();
const mockApplyDisplayOverride = jest.fn(async (rows: unknown[]) => rows);

jest.mock("@/lib/middleware/api-wrappers", () => {
  const actual = jest.requireActual("@/lib/api-utils");
  return {
    withAuth:
      (handler: (request: NextRequest, context: { supabase: typeof mockSupabase }) => Promise<Response>) =>
      (request: NextRequest) =>
        handler(request, { supabase: mockSupabase }),
    withRateLimit:
      (handler: (request: NextRequest) => Promise<Response>) =>
      (request: NextRequest) =>
        handler(request),
    createErrorResponse: actual.createErrorResponse,
    createSuccessResponse: actual.createSuccessResponse,
    validateOrError: actual.validateOrError,
  };
});

jest.mock("@/lib/utils/forecast-server-utils", () => ({
  updateBeachForecast: (beachId: string) => mockUpdateBeachForecast(beachId),
}));

jest.mock("@/lib/services/forecast/v5-display-gate", () => ({
  applyV51DisplayOverrideToForecasts: (rows: unknown[]) =>
    mockApplyDisplayOverride(rows),
}));

type QueryResult<T> = {
  data: T | null;
  error: { message: string } | null;
};

type ForecastRow = {
  beach_id: string;
  forecast_at: string;
  wave_height: string | null;
  wind_speed: string | null;
  wind_direction: string | null;
  tide_height: string | null;
  confidence_score: number | null;
  data_source: string | null;
  om_fetched_at?: string | null;
  updated_at?: string | null;
  raw_forecast?: {
    fetch_timestamps?: {
      cdip?: string;
      noaa?: string;
    };
    wave_height_provenance?: {
      station_id: string | null;
    };
  } | null;
};

const BEACH_ID = "11111111-1111-4111-8111-111111111111";
const NOW = new Date("2026-05-21T19:00:00.000Z");

function currentRow(overrides: Partial<ForecastRow> = {}): ForecastRow {
  return {
    beach_id: BEACH_ID,
    forecast_at: "2026-05-21T18:00:00.000Z",
    wave_height: "3-4 ft",
    wind_speed: "5 mph",
    wind_direction: "W",
    tide_height: "2.0 ft",
    confidence_score: 86,
    data_source: "OPEN_METEO",
    ...overrides,
  };
}

function chain<T>(result: QueryResult<T>) {
  const query: any = {
    select: jest.fn(),
    eq: jest.fn(),
    is: jest.fn(),
    lte: jest.fn(),
    gte: jest.fn(),
    order: jest.fn(),
    limit: jest.fn(),
    maybeSingle: jest.fn(() => Promise.resolve(result)),
  };

  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.is.mockReturnValue(query);
  query.lte.mockReturnValue(query);
  query.gte.mockReturnValue(query);
  query.order.mockReturnValue(query);
  query.limit.mockReturnValue(query);

  return query;
}

function setupQueries(options: {
  beach?: QueryResult<{ id: string }>;
  latest: Array<QueryResult<{ updated_at: string; data_source: string | null }>>;
  current: Array<QueryResult<ForecastRow>>;
  tide?: Array<QueryResult<{ tide_ft: number | null }>>;
}) {
  const beach = chain(options.beach ?? { data: { id: BEACH_ID }, error: null });
  const latestQueries = [...options.latest].map(chain);
  const currentQueries = [...options.current].map(chain);
  const tideQueries = [...(options.tide ?? [])].map(chain);
  const latest = [...latestQueries];
  const current = [...currentQueries];
  const tide = [...tideQueries];

  mockSupabase.from.mockImplementation((table: string) => {
    if (table === "beaches") return beach;
    if (table === "v_enhanced_forecast_latest") {
      return latest.shift() ?? chain({ data: null, error: null });
    }
    if (table === "enhanced_forecasts") {
      return current.shift() ?? chain({ data: null, error: null });
    }
    if (table === "tide_forecasts") {
      return tide.shift() ?? chain({ data: null, error: null });
    }
    return chain({ data: null, error: null });
  });

  return { beach, latest: latestQueries, current: currentQueries, tide: tideQueries };
}

async function callRoute(url: string): Promise<Response> {
  const { GET } = await import("@/app/api/forecasts/current/route");
  return GET(new NextRequest(url));
}

describe("GET /api/forecasts/current", () => {
  beforeEach(() => {
    jest.useFakeTimers({ now: NOW });
    jest.clearAllMocks();
    jest.resetModules();
    mockUpdateBeachForecast.mockResolvedValue({
      beach: "Mission Beach",
      forecastsGenerated: 80,
    });
    mockApplyDisplayOverride.mockImplementation(async (rows: unknown[]) => rows);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("returns a fresh current row without refreshing", async () => {
    const current = currentRow();
    setupQueries({
      current: [{ data: current, error: null }],
      latest: [
        {
          data: {
            updated_at: new Date(NOW.getTime() - 60 * 60 * 1000).toISOString(),
            data_source: "OPEN_METEO",
          },
          error: null,
        },
      ],
      tide: [{ data: { tide_ft: 2.7 }, error: null }],
    });

    const response = await callRoute(
      `http://localhost:3000/api/forecasts/current?beachId=${BEACH_ID}&refresh=if-stale`,
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(body.success).toBe(true);
    expect(body.data.current.wave_height).toBe("3-4 ft");
    expect(body.data.current.tide_height).toBe("2.7 ft");
    expect(body.data.metadata).toEqual(
      expect.objectContaining({
        refreshed: false,
        refreshAttempted: false,
        stale: false,
        missing: false,
        availability: "fresh",
        dataSource: "OPEN_METEO",
      }),
    );
    expect(mockUpdateBeachForecast).not.toHaveBeenCalled();
  });

  it("returns the canonical current forecast provenance contract", async () => {
    const {
      source_fetched_at: _sourceFetchedAt,
      station_id: _stationId,
      ...storedRow
    } = currentForecastContract;
    setupQueries({
      current: [{ data: storedRow, error: null }],
      latest: [
        {
          data: {
            updated_at: "2026-05-21T17:45:00.000Z",
            data_source: "CDIP",
          },
          error: null,
        },
      ],
    });

    const response = await callRoute(
      `http://localhost:3000/api/forecasts/current?beachId=${BEACH_ID}`,
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.current).toEqual(currentForecastContract);
  });

  it("returns nullable provenance fields when the row has no fetch time or station", async () => {
    setupQueries({
      current: [
        {
          data: currentRow({
            data_source: "CDIP",
            om_fetched_at: null,
            updated_at: null,
            raw_forecast: {
              fetch_timestamps: {},
              wave_height_provenance: { station_id: null },
            },
          }),
          error: null,
        },
      ],
      latest: [
        {
          data: {
            updated_at: "2026-05-21T18:00:00.000Z",
            data_source: "CDIP",
          },
          error: null,
        },
      ],
    });

    const response = await callRoute(
      `http://localhost:3000/api/forecasts/current?beachId=${BEACH_ID}`,
    );
    const body = await response.json();

    expect(body.data.current).toHaveProperty("source_fetched_at", null);
    expect(body.data.current).toHaveProperty("station_id", null);
  });

  it.each([
    ["Open-Meteo fetch", "2026-05-21T17:30:00.000Z", "2026-05-21T17:30:00.000Z"],
    ["row update", null, "2026-05-21T17:45:00.000Z"],
  ])("falls back to the %s timestamp", async (_label, omFetchedAt, expected) => {
    setupQueries({
      current: [
        {
          data: currentRow({
            data_source: "NOAA_NWS",
            om_fetched_at: omFetchedAt,
            updated_at: "2026-05-21T17:45:00.000Z",
            raw_forecast: { fetch_timestamps: {} },
          }),
          error: null,
        },
      ],
      latest: [
        {
          data: {
            updated_at: "2026-05-21T18:00:00.000Z",
            data_source: "NOAA_NWS",
          },
          error: null,
        },
      ],
    });

    const response = await callRoute(
      `http://localhost:3000/api/forecasts/current?beachId=${BEACH_ID}`,
    );
    const body = await response.json();

    expect(body.data.current.source_fetched_at).toBe(expected);
  });

  it("refreshes a missing current row and returns the reread source-backed row", async () => {
    const afterRefresh = new Date("2026-05-21T21:00:01.000Z");
    mockUpdateBeachForecast.mockImplementationOnce(async () => {
      jest.setSystemTime(afterRefresh);
      return {
        beach: "Mission Beach",
        forecastsGenerated: 80,
      };
    });

    const queries = setupQueries({
      current: [
        { data: null, error: null },
        { data: currentRow({ forecast_at: "2026-05-21T21:00:00.000Z" }), error: null },
      ],
      latest: [
        { data: null, error: null },
        {
          data: {
            updated_at: afterRefresh.toISOString(),
            data_source: "NOAA_NWS",
          },
          error: null,
        },
      ],
      tide: [{ data: null, error: null }],
    });

    const response = await callRoute(
      `http://localhost:3000/api/forecasts/current?beachId=${BEACH_ID}&refresh=if-stale`,
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockUpdateBeachForecast).toHaveBeenCalledWith(BEACH_ID);
    expect(queries.current[1].lte).toHaveBeenCalledWith("forecast_at", afterRefresh.toISOString());
    expect(body.data.current.forecast_at).toBe("2026-05-21T21:00:00.000Z");
    expect(body.data.metadata).toEqual(
      expect.objectContaining({
        refreshed: true,
        refreshAttempted: true,
        missing: false,
        stale: false,
        dataSource: "NOAA_NWS",
      }),
    );
  });

  it("refreshes a stale current row before serving it", async () => {
    setupQueries({
      current: [
        { data: currentRow({ forecast_at: "2026-05-21T15:00:00.000Z" }), error: null },
        { data: currentRow({ forecast_at: "2026-05-21T18:00:00.000Z" }), error: null },
      ],
      latest: [
        {
          data: {
            updated_at: new Date(NOW.getTime() - 13 * 60 * 60 * 1000).toISOString(),
            data_source: "OPEN_METEO",
          },
          error: null,
        },
        {
          data: {
            updated_at: NOW.toISOString(),
            data_source: "OPEN_METEO",
          },
          error: null,
        },
      ],
      tide: [
        { data: { tide_ft: 2.1 }, error: null },
        { data: { tide_ft: 2.4 }, error: null },
      ],
    });

    const response = await callRoute(
      `http://localhost:3000/api/forecasts/current?beachId=${BEACH_ID}&refresh=if-stale`,
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockUpdateBeachForecast).toHaveBeenCalledWith(BEACH_ID);
    expect(body.data.current.tide_height).toBe("2.4 ft");
    expect(body.data.metadata.refreshed).toBe(true);
    expect(body.data.metadata.stale).toBe(false);
  });

  it("keeps the stale response byte-identical when includeStale is omitted", async () => {
    const staleUpdatedAt = new Date(
      NOW.getTime() - 13 * 60 * 60 * 1000,
    ).toISOString();
    setupQueries({
      current: [{ data: currentRow(), error: null }],
      latest: [
        {
          data: {
            updated_at: staleUpdatedAt,
            data_source: "OPEN_METEO",
          },
          error: null,
        },
      ],
      tide: [{ data: { tide_ft: 2.7 }, error: null }],
    });

    const response = await callRoute(
      `http://localhost:3000/api/forecasts/current?beachId=${BEACH_ID}`,
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toBe(
      JSON.stringify({
        success: true,
        data: {
          current: null,
          metadata: {
            refreshed: false,
            refreshAttempted: false,
            stale: true,
            // Phase C deletes this assertion when the legacy `missing` semantics are corrected.
            missing: true,
            availability: "stale",
            dataSource: "OPEN_METEO",
            lastUpdated: staleUpdatedAt,
            reason: "Data is 13.0h old (threshold: 12h)",
          },
        },
        timestamp: NOW.toISOString(),
      }),
    );
  });

  it("includes a stale current row when includeStale is enabled", async () => {
    setupQueries({
      current: [{ data: currentRow(), error: null }],
      latest: [
        {
          data: {
            updated_at: new Date(
              NOW.getTime() - 13 * 60 * 60 * 1000,
            ).toISOString(),
            data_source: "OPEN_METEO",
          },
          error: null,
        },
      ],
      tide: [{ data: { tide_ft: 2.7 }, error: null }],
    });

    const response = await callRoute(
      `http://localhost:3000/api/forecasts/current?beachId=${BEACH_ID}&includeStale=1`,
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.current).toEqual(
      expect.objectContaining({
        wave_height: "3-4 ft",
        tide_height: "2.7 ft",
      }),
    );
    expect(body.data.metadata.availability).toBe("stale");
    expect(body.data.metadata.stale).toBe(true);
    expect(body.data.metadata.missing).toBe(true);
  });

  it("withholds the current row when includeStale is enabled but data is unavailable", async () => {
    setupQueries({
      current: [{ data: null, error: null }],
      latest: [{ data: null, error: null }],
    });

    const response = await callRoute(
      `http://localhost:3000/api/forecasts/current?beachId=${BEACH_ID}&includeStale=1`,
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.current).toBeNull();
    expect(body.data.metadata).toEqual(
      expect.objectContaining({
        stale: false,
        missing: true,
        availability: "unavailable",
        reason: "No forecast data in cache",
      }),
    );
  });

  it("returns unavailable metadata when refresh fails", async () => {
    mockUpdateBeachForecast.mockRejectedValueOnce(new Error("provider timeout"));
    setupQueries({
      current: [{ data: currentRow(), error: null }],
      latest: [
        {
          data: {
            updated_at: new Date(NOW.getTime() - 13 * 60 * 60 * 1000).toISOString(),
            data_source: "OPEN_METEO",
          },
          error: null,
        },
      ],
      tide: [{ data: { tide_ft: 2.7 }, error: null }],
    });

    const response = await callRoute(
      `http://localhost:3000/api/forecasts/current?beachId=${BEACH_ID}&refresh=if-stale`,
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.current).toBeNull();
    expect(body.data.metadata).toEqual(
      expect.objectContaining({
        refreshed: false,
        refreshAttempted: true,
        stale: true,
        missing: true,
        availability: "unavailable",
        refreshError: "provider timeout",
      }),
    );
  });

  it("returns 400 for an invalid beach id", async () => {
    setupQueries({
      current: [],
      latest: [],
    });

    const response = await callRoute(
      "http://localhost:3000/api/forecasts/current?beachId=not-a-uuid",
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });

  it("returns 404 for a nonexistent beach", async () => {
    setupQueries({
      beach: { data: null, error: null },
      current: [],
      latest: [],
    });

    const response = await callRoute(
      `http://localhost:3000/api/forecasts/current?beachId=${BEACH_ID}`,
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBe("Beach not found");
  });

  it("returns the wrapper error when the hourly tide query fails", async () => {
    setupQueries({
      current: [{ data: currentRow(), error: null }],
      latest: [
        {
          data: {
            updated_at: new Date(NOW.getTime() - 60 * 60 * 1000).toISOString(),
            data_source: "OPEN_METEO",
          },
          error: null,
        },
      ],
      tide: [{ data: null, error: { message: "tide query failed" } }],
    });

    await expect(
      callRoute(
        `http://localhost:3000/api/forecasts/current?beachId=${BEACH_ID}&refresh=if-stale`,
      ),
    ).rejects.toThrow("tide query failed");
  });
});
