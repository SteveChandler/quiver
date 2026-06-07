/**
 * @jest-environment node
 */

import { readFileSync } from "fs";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/cron/ndbc-direct-sync/route";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import {
  fetchRecentNDBCObservations,
  fetchRecentNDBCObservationsWithStatus,
} from "@/lib/services/ndbc-service";

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
  fetchRecentNDBCObservationsWithStatus: jest.fn(),
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

type SupabaseUpdate = {
  ids: string[];
  payload: Record<string, unknown>;
};

function createObservationSyncSupabase(
  stations: Array<{ station_id: string; ioos_station_id: string | null }>
) {
  const stationUpdates: SupabaseUpdate[] = [];
  const observationUpserts: unknown[][] = [];
  const refreshRpc = jest.fn().mockResolvedValue({ data: null, error: null });

  const stationQuery: any = {};
  let stationEqCalls = 0;
  stationQuery.select = jest.fn((_columns: string) => stationQuery);
  stationQuery.eq = jest.fn((_column: string, _value: unknown) => {
    stationEqCalls += 1;
    return stationEqCalls >= 2
      ? Promise.resolve({ data: stations, error: null })
      : stationQuery;
  });
  stationQuery.update = jest.fn((payload: Record<string, unknown>) => ({
    in: jest.fn((_column: string, ids: string[]) => {
      stationUpdates.push({ ids, payload });
      return Promise.resolve({ data: null, error: null });
    }),
    eq: jest.fn((_column: string, id: string) => {
      stationUpdates.push({ ids: [id], payload });
      return Promise.resolve({ data: null, error: null });
    }),
  }));

  const observationsQuery = {
    upsert: jest.fn((rows: unknown[]) => {
      observationUpserts.push(rows);
      return Promise.resolve({ data: null, error: null });
    }),
  };

  const supabase = {
    from: jest.fn((table: string) => {
      if (table === "ndbc_direct_stations") return stationQuery;
      if (table === "ndbc_direct_observations") return observationsQuery;
      return createObservationStationsQuery({ data: [], error: null });
    }),
    rpc: refreshRpc,
  };

  return { observationUpserts, refreshRpc, stationUpdates, supabase };
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
    expect(fetchRecentNDBCObservationsWithStatus).not.toHaveBeenCalled();
  });

  it("records no-wave NDBC fetch status without inserting observations", async () => {
    const { observationUpserts, refreshRpc, stationUpdates, supabase } =
      createObservationSyncSupabase([
        { station_id: "44069", ioos_station_id: null },
      ]);

    (createSupabaseServiceRoleClient as jest.Mock).mockReturnValue(supabase);
    (fetchRecentNDBCObservationsWithStatus as jest.Mock).mockResolvedValue({
      observations: [],
      status: "no_wave_data",
    });

    const request = new NextRequest(
      "http://localhost/api/cron/ndbc-direct-sync?phase=observations"
    );

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data).toMatchObject({
      phase: "observations",
      stationsQueried: 1,
      stationsSynced: 0,
      stationsFailed: 1,
      stationsNoWaveData: 1,
      observationsUpserted: 0,
    });
    expect(observationUpserts).toEqual([]);
    expect(stationUpdates).toEqual([
      {
        ids: ["44069"],
        payload: expect.objectContaining({
          last_wave_fetch_status: "no_wave_data",
        }),
      },
    ]);
    expect(refreshRpc).toHaveBeenCalledTimes(1);
  });

  it("records successful NDBC wave source health with latest observed time", async () => {
    const { observationUpserts, stationUpdates, supabase } =
      createObservationSyncSupabase([
        { station_id: "46215", ioos_station_id: null },
      ]);

    (createSupabaseServiceRoleClient as jest.Mock).mockReturnValue(supabase);
    (fetchRecentNDBCObservationsWithStatus as jest.Mock).mockResolvedValue({
      observations: [
        {
          ts: "2026-06-04T19:56:00.000Z",
          wave_height_m: 1.2,
          wave_period_s: 14,
          wave_direction_deg: 260,
          water_temp_c: null,
          wind_speed_ms: null,
          wind_direction_deg: null,
        },
        {
          ts: "2026-06-04T19:26:00.000Z",
          wave_height_m: 1.1,
          wave_period_s: 13,
          wave_direction_deg: 255,
          water_temp_c: null,
          wind_speed_ms: null,
          wind_direction_deg: null,
        },
      ],
      status: "ok",
    });

    const request = new NextRequest(
      "http://localhost/api/cron/ndbc-direct-sync?phase=observations"
    );

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data).toMatchObject({
      stationsQueried: 1,
      stationsSynced: 1,
      stationsFailed: 0,
      stationsNoWaveData: 0,
      observationsUpserted: 2,
    });
    expect(observationUpserts).toHaveLength(1);
    expect(stationUpdates).toEqual(
      expect.arrayContaining([
        {
          ids: ["46215"],
          payload: expect.objectContaining({
            has_wave_data: true,
            last_wave_fetch_status: "ok",
            last_wave_observed_at: "2026-06-04T19:56:00.000Z",
          }),
        },
      ])
    );
  });
});
