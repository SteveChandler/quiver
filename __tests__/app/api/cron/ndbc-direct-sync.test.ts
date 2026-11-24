/**
 * @jest-environment node
 */

import { readFileSync } from "fs";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/cron/ndbc-direct-sync/route";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { fetchRecentNDBCObservations } from "@/lib/services/ndbc-service";

jest.mock("@/lib/cron/outcome", () => ({
  withCronOutcome: jest.fn(async (_options: unknown, handler: () => Promise<unknown>) => handler()),
}));

jest.mock("@/lib/middleware/api-wrappers", () => ({
  createSuccessResponse: jest.fn((data, status = 200) => ({
    json: async () => ({
      success: true,
      data,
      timestamp: "2026-05-26T00:00:00.000Z",
    }),
    status,
  })),
  createErrorResponse: jest.fn((error, details, status = 500) => ({
    json: async () => ({
      success: false,
      error,
      details,
      timestamp: "2026-05-26T00:00:00.000Z",
    }),
    status,
  })),
  handleApiError: jest.fn((error) => ({
    json: async () => ({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      timestamp: "2026-05-26T00:00:00.000Z",
    }),
    status: 500,
  })),
  validateCronRequest: jest.fn(() => true),
}));

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: jest.fn(),
}));

jest.mock("@/lib/services/ndbc-service", () => ({
  getActiveNDBCStations: jest.fn(),
  fetchRecentNDBCObservations: jest.fn(),
}));

type QueryResult<T> = {
  data: T;
  error: { message: string } | null;
};

type ObservationStationsQuery<T> = {
  select: jest.Mock<ObservationStationsQuery<T>, [string]>;
  eq: jest.Mock<ObservationStationsQuery<T> | Promise<QueryResult<T>>, [string, unknown]>;
};

function createObservationStationsQuery<T>(
  result: QueryResult<T>
): ObservationStationsQuery<T> {
  let eqCalls = 0;
  const query = {} as ObservationStationsQuery<T>;
  query.select = jest.fn((_columns: string) => query);
  query.eq = jest.fn((_column: string, _value: unknown) => {
    eqCalls += 1;
    return eqCalls >= 2 ? Promise.resolve(result) : query;
  });

  return query;
}

describe("NDBC direct sync cron route", () => {
  const routeSource = readFileSync(
    "app/api/cron/ndbc-direct-sync/route.ts",
    "utf8"
  );

  let consoleLogSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleLogSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it("uses the API wrapper barrel for response helpers and cron request validation", () => {
    expect(routeSource).not.toContain("@/lib/api-utils");
    expect(routeSource).toContain("@/lib/middleware/api-wrappers");
  });

  it("rejects requests without a valid sync phase before fetching NDBC data", async () => {
    const request = new NextRequest(
      "http://localhost/api/cron/ndbc-direct-sync"
    );

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data).toEqual({
      success: false,
      error: "Invalid phase",
      details: 'Query param "phase" must be "stations" or "observations"',
      timestamp: "2026-05-26T00:00:00.000Z",
    });
    expect(fetchRecentNDBCObservations).not.toHaveBeenCalled();
  });

  it("returns an empty observation summary without fetching observations", async () => {
    const refreshRpc = jest.fn().mockResolvedValue({ data: null, error: null });
    const supabase = {
      from: jest.fn((table: string) => {
        if (table === "ndbc_direct_stations") {
          return createObservationStationsQuery({ data: [], error: null });
        }

        return createObservationStationsQuery({ data: [], error: null });
      }),
      rpc: refreshRpc,
    };

    (createSupabaseServiceRoleClient as jest.Mock).mockReturnValue(supabase);

    const request = new NextRequest(
      "http://localhost/api/cron/ndbc-direct-sync?phase=observations"
    );

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data).toMatchObject({
      phase: "observations",
      stationsQueried: 0,
      stationsSynced: 0,
      stationsSkippedIOOS: 0,
      stationsFailed: 0,
      stationsSkippedTimeout: 0,
      observationsUpserted: 0,
      errors: [],
    });
    expect(typeof data.data.duration_ms).toBe("number");
    expect(refreshRpc).not.toHaveBeenCalled();
    expect(fetchRecentNDBCObservations).not.toHaveBeenCalled();
  });
  describe("active IOOS dedup read", () => {
    const stations = [
      { station_id: "46225", ioos_station_id: "ioos-46225" },
      { station_id: "46086", ioos_station_id: null },
    ];

    function buildSupabase(ioosResult: {
      data: Array<{ station_id: string }> | null;
      error: { code?: string; message: string } | null;
    }) {
      const upsert = jest.fn().mockResolvedValue({ error: null });
      const supabase = {
        from: jest.fn((table: string) => {
          if (table === "ndbc_direct_stations") {
            const query = createObservationStationsQuery({ data: stations, error: null });
            return Object.assign(query, {
              update: jest.fn(() => ({ in: jest.fn().mockResolvedValue({ error: null }) })),
            });
          }
          if (table === "ioos_stations") {
            return {
              select: jest.fn(() => ({
                in: jest.fn(() => ({ eq: jest.fn().mockResolvedValue(ioosResult) })),
              })),
            };
          }
          if (table === "ndbc_direct_observations") {
            return { upsert };
          }
          throw new Error(`unexpected table ${table}`);
        }),
        rpc: jest.fn(),
      };
      return supabase;
    }

    beforeEach(() => {
      (fetchRecentNDBCObservations as jest.Mock).mockResolvedValue([
        {
          ts: "2026-11-11T00:00:00Z",
          wave_height_m: 1,
          wave_period_s: 12,
          wave_direction_deg: 270,
          water_temp_c: 15,
          wind_speed_ms: 2,
          wind_direction_deg: 300,
        },
      ]);
    });

    it("skips stations that are active in IOOS when the read succeeds", async () => {
      const supabase = buildSupabase({ data: [{ station_id: "ioos-46225" }], error: null });
      (createSupabaseServiceRoleClient as jest.Mock).mockReturnValue(supabase);

      const response = await GET(
        new NextRequest("http://localhost/api/cron/ndbc-direct-sync?phase=observations")
      );
      const data = await response.json();

      expect(data.data.errors).toEqual([]);
      expect(data.data.stationsSkippedIOOS).toBe(1);
      expect(fetchRecentNDBCObservations).toHaveBeenCalledTimes(1);
      expect(fetchRecentNDBCObservations).toHaveBeenCalledWith("46086", 24);
    });

    it("records a failed IOOS read and does not sync IOOS-linked stations", async () => {
      const supabase = buildSupabase({
        data: null,
        error: { code: "57014", message: "canceling statement due to statement timeout" },
      });
      (createSupabaseServiceRoleClient as jest.Mock).mockReturnValue(supabase);

      const response = await GET(
        new NextRequest("http://localhost/api/cron/ndbc-direct-sync?phase=observations")
      );
      const data = await response.json();

      expect(data.data.errors).toEqual([
        expect.stringContaining("canceling statement due to statement timeout"),
      ]);
      expect(fetchRecentNDBCObservations).not.toHaveBeenCalledWith("46225", expect.anything());
      expect(fetchRecentNDBCObservations).toHaveBeenCalledWith("46086", 24);
    });
  });
});
