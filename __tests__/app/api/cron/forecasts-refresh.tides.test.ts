/** @jest-environment node */

jest.mock("@/lib/cron/outcome", () => ({
  withCronOutcome: jest.fn(async (_options: unknown, handler: () => Promise<unknown>) => handler()),
}));

import { readFileSync } from "fs";
import { expectConsoleWarnings } from "@/__tests__/setup/test-utils";

// NextResponse.json relies on the static Response.json() helper (available in newer runtimes).
// Jest's jsdom environment may not provide it, so we polyfill it for route handler tests.
if (typeof (globalThis as any).Response?.json !== "function") {
  (globalThis as any).Response.json = (data: any, init?: ResponseInit) =>
    new Response(JSON.stringify(data), {
      ...init,
      headers: {
        "content-type": "application/json",
        ...(init?.headers || {}),
      },
    });
}

jest.mock("@/lib/middleware/api-wrappers", () => {
  const actual = jest.requireActual("@/lib/middleware/api-wrappers");
  return {
    ...actual,
    validateCronRequest: () => true,
  };
});

const mockGetNearestTideStation = jest.fn();
const mockFetchHourlyTidePredictions = jest.fn();

jest.mock("@/lib/services/noaa-tide-service", () => ({
  getNearestTideStation: (...args: any[]) => mockGetNearestTideStation(...args),
  fetchHourlyTidePredictions: (...args: any[]) =>
    mockFetchHourlyTidePredictions(...args),
}));

const mockFetchCOOPSData = jest.fn();

jest.mock("@/lib/services/noaa-coops", () => ({
  NOAACOOPSService: jest.fn().mockImplementation(() => ({
    fetchCOOPSData: (...args: any[]) => mockFetchCOOPSData(...args),
  })),
}));

const mockSupabaseFrom = jest.fn();

type DeleteCall = {
  options: { count: "exact" };
  filters: Array<[string, string, string | string[]]>;
};

function tideForecastsMock(
  upsert: jest.Mock,
  result: { error: { message: string } | null; count: number | null } = { error: null, count: 0 },
): { upsert: jest.Mock; delete: jest.Mock; deleteCalls: DeleteCall[] } {
  const deleteCalls: DeleteCall[] = [];
  const deleteTides = jest.fn((options: { count: "exact" }) => {
    const filters: DeleteCall["filters"] = [];
    const builder: any = {
      then: (resolve: any, reject: any) => Promise.resolve(result).then(resolve, reject),
    };
    for (const method of ["in", "neq", "gte", "lte"]) {
      builder[method] = (column: string, value: string | string[]) => {
        filters.push([method, column, value]);
        return builder;
      };
    }
    deleteCalls.push({ options, filters });
    return builder;
  });
  return { upsert, delete: deleteTides, deleteCalls };
}

function thenable(result: unknown) {
  const builder: any = {
    then: (resolve: any, reject: any) => Promise.resolve(result).then(resolve, reject),
  };
  for (const method of ["select", "not", "eq", "order", "limit", "in", "gte", "lte"]) {
    builder[method] = () => builder;
  }
  return builder;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function hourlyPoints(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    ts: new Date(Date.now() + (i + 1) * 60 * 60 * 1000).toISOString(),
    tide_height_m: 1 + Math.sin(i / 2),
    tide_phase: null,
  }));
}

async function runTideRefresh(query: string) {
  const { GET } = require("@/app/api/cron/forecasts/refresh/route");
  const { withCronOutcome } = require("@/lib/cron/outcome");
  const res = await GET(
    new Request(`http://localhost:3000/api/cron/forecasts/refresh?${query}`, {
      headers: { authorization: "Bearer test-cron-secret" },
    })
  );
  const json = JSON.parse(await res.text());
  const [options] = (withCronOutcome as jest.Mock).mock.calls.at(-1);
  return { json, failureReason: options.failureReason(json.data) as string | null };
}

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: () => ({ from: (...args: any[]) => mockSupabaseFrom(...args) }),
}));

describe("/api/cron/forecasts/refresh (tides)", () => {
  const routeSource = readFileSync(
    "app/api/cron/forecasts/refresh/route.ts",
    "utf8"
  );

  let consoleLogSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleLogSpy = jest.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  it("uses the API wrapper barrel for response helpers and cron request validation", () => {
    expect(routeSource).not.toContain("@/lib/api-utils");
    expect(routeSource).toContain("@/lib/middleware/api-wrappers");
  });

  it("backfills only missing beaches and fetches tides once per station", async () => {
    jest.resetModules();
    mockGetNearestTideStation.mockReset();
    mockFetchHourlyTidePredictions.mockReset();
    mockSupabaseFrom.mockReset();

    const beaches = [
      {
        id: "beach-a",
        name: "Beach A",
        lat: 32.1,
        lon: -117.2,
        tide_forecasts: [], // missing
      },
      {
        id: "beach-b",
        name: "Beach B",
        lat: 32.1001,
        lon: -117.2001,
        tide_forecasts: [], // missing
      },
      {
        id: "beach-c",
        name: "Beach C",
        lat: 33.0,
        lon: -118.0,
        tide_forecasts: [{ ts: "2025-12-20T00:00:00.000Z" }], // has tides already
      },
    ];

    // All missing beaches map to the same station
    mockGetNearestTideStation.mockResolvedValue({
      id: "9410230",
      name: "Test Station",
      lat: 32.0,
      lon: -117.0,
    });

    mockFetchHourlyTidePredictions.mockResolvedValue([
      {
        ts: "2025-12-20T01:17:00.000Z",
        tide_height_m: 1.2,
        tide_phase: "H",
      },
      {
        ts: "2025-12-20T02:42:00.000Z",
        tide_height_m: 1.1,
        tide_phase: null,
      },
    ]);

    const upsertTides = jest.fn<any, any[]>(async () => ({ error: null }));
    const tideForecasts = tideForecastsMock(upsertTides);
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "beaches") {
        const result = { data: beaches, error: null };
        const builder: any = {
          select: () => builder,
          not: () => builder,
          eq: () => builder,
          order: () => builder,
          limit: () => builder,
          then: (resolve: any, reject: any) =>
            Promise.resolve(result).then(resolve, reject),
        };
        return builder;
      }
      if (table === "tide_forecasts") {
        return tideForecasts;
      }
      // should not be called in tidesBackfillMissing=1 mode
      return { upsert: jest.fn(async () => ({ error: null })) };
    });

    // Import GET after mocks are configured (and module cache reset)
    const { GET } = require("@/app/api/cron/forecasts/refresh/route");

    const req = new Request(
      "http://localhost:3000/api/cron/forecasts/refresh?tidesBackfillMissing=1",
      { headers: { authorization: "Bearer test-cron-secret" } }
    );

    const res = await GET(req);
    const text = await res.text();
    expect(text).not.toBe("");
    const json = JSON.parse(text);

    expect(json.success).toBe(true);

    // Fetch predictions once per station (not per beach)
    expect(mockFetchHourlyTidePredictions).toHaveBeenCalledTimes(1);

    // Upsert should include rows for beach-a and beach-b only (beach-c already had tides)
    expect(upsertTides).toHaveBeenCalledTimes(1);
    const firstCall = upsertTides.mock.calls[0];
    if (!firstCall) {
      throw new Error("Expected tide_forecasts.upsert to be called");
    }
    const rowsArg = firstCall[0] as any[];
    const beachIds = new Set(rowsArg.map((r: any) => r.beach_id));
    expect(beachIds).toEqual(new Set(["beach-a", "beach-b"]));
    expect(new Set(rowsArg.map((r: any) => r.station_id))).toEqual(
      new Set(["9410230"])
    );
    expect(new Set(rowsArg.map((r: any) => r.ts))).toEqual(
      new Set([
        "2025-12-20T01:00:00.000Z",
        "2025-12-20T02:00:00.000Z",
      ])
    );

    // 2 beaches * 2 tide points
    expect(json.data.totals.tides).toBe(4);
    expect(tideForecasts.deleteCalls).toHaveLength(1);
    expect(tideForecasts.deleteCalls[0].filters[0]).toEqual(["in", "beach_id", ["beach-a", "beach-b"]]);
  });

  describe("coverage", () => {
    beforeEach(() => {
      jest.resetModules();
      mockGetNearestTideStation.mockReset();
      mockFetchHourlyTidePredictions.mockReset();
      mockFetchCOOPSData.mockReset().mockResolvedValue(null);
      mockSupabaseFrom.mockReset();
    });

    it("deletes other stations across the written span after the whole group writes", async () => {
      const stationId = "9410230";
      const firstTs = "2026-09-29T01:00:00.000Z";
      const lastTs = "2026-09-29T03:00:00.000Z";
      const beaches = [
        { id: "beach-a", name: "A", lat: 32.86, lon: -117.26, tide_forecasts: [] },
        { id: "beach-b", name: "B", lat: 32.87, lon: -117.27, tide_forecasts: [] },
      ];
      mockGetNearestTideStation.mockResolvedValue({ id: stationId, name: "La Jolla", lat: 32.867, lon: -117.257 });
      mockFetchHourlyTidePredictions.mockResolvedValue([
        { ts: lastTs, tide_height_m: 1, tide_phase: null },
        { ts: firstTs, tide_height_m: 2, tide_phase: null },
      ]);
      const tideForecasts = tideForecastsMock(jest.fn(async () => ({ error: null })), { error: null, count: 7 });
      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === "beaches") return thenable({ data: beaches, error: null });
        if (table === "tide_forecasts") return tideForecasts;
        return { upsert: jest.fn(async () => ({ error: null })) };
      });

      const { json } = await runTideRefresh("tidesBackfillMissing=1");

      expect(tideForecasts.deleteCalls).toEqual([{
        options: { count: "exact" },
        filters: [
          ["in", "beach_id", ["beach-a", "beach-b"]],
          ["neq", "station_id", stationId],
          ["gte", "ts", firstTs],
          ["lte", "ts", lastTs],
        ],
      }]);
      expect(json.data.tideIngest.supersededRows).toBe(7);
      expect(json.data.tideIngest.supersedeErrors).toBe(0);
    });

    it("retries a station whose NOAA fetch failed and writes it on the second try", async () => {
      // 2026-09-27: every upsert returned 201, but a quarter of the stations
      // came back with no points and their beaches kept aging.
      mockGetNearestTideStation.mockResolvedValue({ id: "9410840", name: "Santa Monica", lat: 34.008, lon: -118.5 });
      mockFetchHourlyTidePredictions
        .mockRejectedValueOnce(new Error("NOAA tide failed: 503"))
        .mockResolvedValueOnce(hourlyPoints(3));
      const upsertTides = jest.fn(async () => ({ error: null }));
      const tideForecasts = tideForecastsMock(upsertTides);
      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === "beaches") return thenable({ data: [{ id: "beach-a", name: "A", lat: 34.03, lon: -118.67, tide_forecasts: [] }], error: null });
        if (table === "tide_forecasts") return tideForecasts;
        return { upsert: jest.fn(async () => ({ error: null })) };
      });

      const { json, failureReason } = await runTideRefresh("tidesBackfillMissing=1");

      expectConsoleWarnings([/NOAA hourly tide fetch failed/, /NOAA tides empty for station/]);
      expect(mockFetchHourlyTidePredictions).toHaveBeenCalledTimes(2);
      expect(upsertTides).toHaveBeenCalledTimes(1);
      expect(json.data.totals.tides).toBe(3);
      expect(json.data.tideIngest).toEqual(expect.objectContaining({
        retriedStations: 1,
        recoveredStations: 1,
        failedStations: [],
        beachesBelowMinCoverage: 0,
      }));
      expect(failureReason).toBeNull();
    });

    it("fails the run when a beach with a station would keep under 7 days of tides", async () => {
      const now = Date.now();
      const beaches = [
        { id: "lapsing", name: "Lapsing", lat: 32.67, lon: -117.17 },
        { id: "fresh", name: "Fresh", lat: 32.68, lon: -117.18 },
        { id: "no-station", name: "Cabo Pulmo", lat: 23.44, lon: -109.42 },
      ];
      mockGetNearestTideStation.mockImplementation(async (lat: number) =>
        lat < 30 ? null : { id: "9410170", name: "San Diego", lat: 32.7156, lon: -117.1767 });
      mockFetchHourlyTidePredictions.mockRejectedValue(new Error("NOAA tide failed: 503"));
      const tideForecasts = tideForecastsMock(jest.fn(async () => ({ error: null })));
      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === "beaches") return thenable({ data: beaches, error: null });
        if (table === "v_tide_forecast_latest") {
          return thenable({
            data: [
              // Written 25 days ago: 30 days of rows leave 5 days of coverage.
              { beach_id: "lapsing", created_at: new Date(now - 25 * DAY_MS).toISOString() },
              { beach_id: "fresh", created_at: new Date(now - 2 * DAY_MS).toISOString() },
            ],
            error: null,
          });
        }
        if (table === "tide_forecasts") return tideForecasts;
        return { upsert: jest.fn(async () => ({ error: null })) };
      });

      const { json, failureReason } = await runTideRefresh("source=tide");

      expectConsoleWarnings([/NOAA hourly tide fetch failed/, /NOAA tides empty for station/]);
      expect(tideForecasts.deleteCalls).toHaveLength(0);
      // Both San Diego beaches are past the 24h refresh window, so they share the failed group.
      expect(json.data.tideIngest).toEqual(expect.objectContaining({
        failedStations: [{ stationId: "9410170", beaches: 2, reason: "no_predictions" }],
        beachesWithoutStation: 1,
        beachesBelowMinCoverage: 1,
        beachIdsBelowMinCoverage: ["lapsing"],
      }));
      expect(failureReason).toBe("tide coverage under 7 days for 1 beach");
    });

    it("records a failed upsert instead of dropping it", async () => {
      mockGetNearestTideStation.mockResolvedValue({ id: "9410230", name: "La Jolla", lat: 32.867, lon: -117.257 });
      mockFetchHourlyTidePredictions.mockResolvedValue(hourlyPoints(2));
      const upsertTides = jest.fn(async () => ({ error: { message: "canceling statement due to statement timeout" } }));
      const tideForecasts = tideForecastsMock(upsertTides);
      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === "beaches") return thenable({ data: [{ id: "beach-a", name: "A", lat: 32.86, lon: -117.26, tide_forecasts: [] }], error: null });
        if (table === "tide_forecasts") return tideForecasts;
        return { upsert: jest.fn(async () => ({ error: null })) };
      });

      const { json, failureReason } = await runTideRefresh("tidesBackfillMissing=1");

      expectConsoleWarnings([/Tide upsert failed/]);
      expect(upsertTides).toHaveBeenCalledTimes(2);
      expect(tideForecasts.deleteCalls).toHaveLength(0);
      expect(json.data.tideIngest.failedStations).toEqual([
        { stationId: "9410230", beaches: 1, reason: "upsert_failed" },
      ]);
      // A beach that has never had tides and still has none is under the floor.
      expect(failureReason).toBe("tide coverage under 7 days for 1 beach");
    });

    it("keeps a written beach covered when superseding fails", async () => {
      mockGetNearestTideStation.mockResolvedValue({ id: "9410230", name: "La Jolla", lat: 32.867, lon: -117.257 });
      mockFetchHourlyTidePredictions.mockResolvedValue(hourlyPoints(2));
      const tideForecasts = tideForecastsMock(jest.fn(async () => ({ error: null })), {
        error: { message: "delete timed out" }, count: null,
      });
      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === "beaches") return thenable({ data: [{ id: "beach-a", name: "A", lat: 32.86, lon: -117.26 }], error: null });
        if (table === "v_tide_forecast_latest") return thenable({
          data: [{ beach_id: "beach-a", created_at: new Date(Date.now() - 25 * DAY_MS).toISOString() }],
          error: null,
        });
        if (table === "tide_forecasts") return tideForecasts;
        return { upsert: jest.fn(async () => ({ error: null })) };
      });

      const { json, failureReason } = await runTideRefresh("source=tide");

      expectConsoleWarnings([/Tide supersede failed.*9410230.*delete timed out/]);
      expect(tideForecasts.deleteCalls).toHaveLength(1);
      expect(json.data.tideIngest.supersedeErrors).toBe(1);
      expect(json.data.tideIngest.beachIdsBelowMinCoverage).toEqual([]);
      expect(failureReason).toBeNull();
    });

    it("preserves both sources at the fallback station while targeting other stations", async () => {
      const stationId = "9410230";
      mockGetNearestTideStation.mockResolvedValue({ id: stationId, name: "La Jolla", lat: 32.867, lon: -117.257 });
      mockFetchHourlyTidePredictions.mockRejectedValue(new Error("hourly unavailable"));
      const nowSeconds = Date.now() / 1000;
      mockFetchCOOPSData.mockResolvedValue({ tides: [
        { time: nowSeconds - 3600, height: 1 },
        { time: nowSeconds + 86400, height: 2 },
      ] });
      const upsertTides = jest.fn(async (_rows: Array<{ station_id: string; source: string }>) => ({ error: null }));
      const tideForecasts = tideForecastsMock(upsertTides);
      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === "beaches") return thenable({ data: [{ id: "beach-a", name: "A", lat: 32.86, lon: -117.26, tide_forecasts: [] }], error: null });
        if (table === "tide_forecasts") return tideForecasts;
        return { upsert: jest.fn(async () => ({ error: null })) };
      });

      await runTideRefresh("tidesBackfillMissing=1");

      expectConsoleWarnings([/NOAA hourly tide fetch failed/]);
      expect(upsertTides.mock.calls[0][0]).toEqual(expect.arrayContaining([
        expect.objectContaining({ station_id: stationId, source: "noaa_hilo_interpolated" }),
      ]));
      expect(tideForecasts.deleteCalls).toHaveLength(1);
      expect(tideForecasts.deleteCalls[0].filters[1]).toEqual(["neq", "station_id", stationId]);
    });

  });
});






