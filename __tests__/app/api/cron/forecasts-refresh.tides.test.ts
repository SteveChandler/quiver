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

const mockGetBeachModelTides = jest.fn();
const mockPredictHourlyModelTides = jest.fn();

jest.mock("@/lib/services/tides/model-tides", () => ({
  MODEL_TIDE_SOURCE: "fes2022",
  MODEL_TIDE_STATION_ID: "FES2022",
  getBeachModelTides: (...args: any[]) => mockGetBeachModelTides(...args),
  predictHourlyModelTides: (...args: any[]) => mockPredictHourlyModelTides(...args),
}));

const mockSupabaseFrom = jest.fn();

type DeleteCall = {
  options?: { count: "exact" };
  filters: Array<[string, string, string | string[]]>;
};

function tideForecastsMock(
  upsert: jest.Mock,
  result: { error: { message: string } | null; count: number | null } = { error: null, count: 0 },
): { upsert: jest.Mock; delete: jest.Mock; deleteCalls: DeleteCall[] } {
  const deleteCalls: DeleteCall[] = [];
  const deleteTides = jest.fn((options?: { count: "exact" }) => {
    const filters: DeleteCall["filters"] = [];
    const builder: any = {
      then: (resolve: any, reject: any) => Promise.resolve(result).then(resolve, reject),
    };
    for (const method of ["in", "neq", "eq", "is", "gte", "lte", "lt"]) {
      builder[method] = (column: string, value: string | string[]) => {
        filters.push([method, column, value]);
        return builder;
      };
    }
    deleteCalls.push({ options, filters });
    return builder;
  });
  return { upsert, delete: deleteTides, deleteCalls, select: () => thenable({ data: [], error: null }) } as any;
}

function thenable(result: unknown) {
  const builder: any = {
    then: (resolve: any, reject: any) => Promise.resolve(result).then(resolve, reject),
  };
  for (const method of ["select", "not", "eq", "order", "limit", "in", "gte", "lte", "range", "maybeSingle", "is"]) {
    builder[method] = () => builder;
  }
  return builder;
}

type StoredTide = {
  beach_id: string; ts: string; source: string; station_id: string;
  created_at: string; tide_height_m: number; tide_phase: string | null;
};

function installTideStore(beachId = "beach-a", afterUpsert?: (rows: StoredTide[]) => void, previousPending: string[] = []) {
  const rows: StoredTide[] = [];
  const deletes: Array<Array<[string, string, any]>> = [];
  const upsertBatches: StoredTide[][] = [];
  mockSupabaseFrom.mockImplementation((table: string) => {
    if (table === "beaches") return thenable({ data: [{ id: beachId, name: "Beach", lat: 32.86, lon: -117.26, tide_forecasts: [] }], error: null });
    if (table === "cron_runs") return thenable({ data: { summary: { result: { tideIngest: { reconcilePendingBeachIds: previousPending } } } }, error: null });
    if (table === "v_tide_forecast_latest") return thenable({ data: [{ beach_id: beachId, created_at: new Date().toISOString() }], error: null });
    if (table !== "tide_forecasts") return { upsert: jest.fn(async () => ({ error: null })) };
    return {
      upsert: jest.fn(async (batch: StoredTide[]) => {
        upsertBatches.push(batch);
        for (const row of batch) {
          const index = rows.findIndex((current) => current.beach_id === row.beach_id && current.ts === row.ts && current.source === row.source);
          if (index >= 0) rows.splice(index, 1);
          rows.push(row);
        }
        afterUpsert?.(rows);
        return { error: null };
      }),
      select: () => makeQuery("select"),
      delete: () => makeQuery("delete"),
    };

    function makeQuery(action: "select" | "delete") {
      const filters: Array<[string, string, any]> = [];
      let range: [number, number] | null = null;
      const query: any = {
        then: (resolve: any, reject: any) => {
          const matches = rows.filter((row) => filters.every(([method, column, value]) => {
            const actual = row[column as keyof StoredTide];
            if (method === "eq") return actual === value;
            if (method === "neq") return actual !== value;
            if (method === "is") return actual === value;
            if (method === "in") return value.includes(actual);
            if (method === "gte") return String(actual) >= value;
            if (method === "lte") return String(actual) <= value;
            if (method === "lt") return String(actual) < value;
            return true;
          }));
          if (action === "delete") {
            deletes.push(filters);
            for (const row of matches) rows.splice(rows.indexOf(row), 1);
          }
          return Promise.resolve(action === "select"
            ? { data: (range ? matches.slice(range[0], range[1] + 1) : matches).map(({ beach_id, ts }) => ({ beach_id, ts })), error: null }
            : { error: null, count: matches.length }).then(resolve, reject);
        },
        order: () => query,
        range: (start: number, end: number) => { range = [start, end]; return query; },
      };
      for (const method of ["in", "eq", "neq", "is", "gte", "lte", "lt"]) query[method] = (column: string, value: any) => {
        filters.push([method, column, value]); return query;
      };
      return query;
    }
  });
  return { rows, deletes, upsertBatches };
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
    expect(tideForecasts.deleteCalls).toHaveLength(3);
    expect(tideForecasts.deleteCalls[0].filters[0]).toEqual(["in", "beach_id", ["beach-a", "beach-b"]]);
  });

  describe("coverage", () => {
    beforeEach(() => {
      jest.resetModules();
      mockGetNearestTideStation.mockReset();
      mockFetchHourlyTidePredictions.mockReset();
      mockFetchCOOPSData.mockReset().mockResolvedValue(null);
      mockGetBeachModelTides.mockReset().mockReturnValue(null);
      mockPredictHourlyModelTides.mockReset().mockImplementation(() => hourlyPoints(3));
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

      expect(tideForecasts.deleteCalls[0]).toEqual({
        options: { count: "exact" },
        filters: [
          ["in", "beach_id", ["beach-a", "beach-b"]],
          ["neq", "station_id", stationId],
          ["gte", "ts", firstTs],
          ["lte", "ts", lastTs],
          ["lt", "created_at", expect.any(String)],
        ],
      });
      expect(tideForecasts.deleteCalls[1].filters[1]).toEqual(["is", "station_id", null]);
      expect(json.data.tideIngest.supersededRows).toBe(14);
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

    it("recovers a station on retry when NOAA's first answer was a 200 with an error body", async () => {
      // 2026-09-30: 76 of 111 stations came back empty and the retry recovered none,
      // because the service cached the empty answer and handed it straight back.
      // This runs the real service and fakes only its HTTP boundary.
      const noPredictions = { error: { message: "No Predictions data was found." } };
      const predictions = hourlyPoints(3).map((point) => ({
        t: point.ts.slice(0, 16).replace("T", " "),
        v: String(point.tide_height_m),
      }));
      const mockFetch = jest.fn()
        .mockImplementationOnce(async () => new Response(JSON.stringify(noPredictions)))
        .mockImplementationOnce(async () => new Response(JSON.stringify({ predictions })));
      const originalFetch = global.fetch;
      global.fetch = mockFetch;
      try {
        const realService = jest.requireActual("@/lib/services/noaa-tide-service");
        mockFetchHourlyTidePredictions.mockImplementation(
          (...args: any[]) => realService.fetchHourlyTidePredictions(...args),
        );
        mockGetNearestTideStation.mockResolvedValue({ id: "9410841", name: "Retry Cache", lat: 34.008, lon: -118.5 });
        const upsertTides = jest.fn(async () => ({ error: null }));
        const tideForecasts = tideForecastsMock(upsertTides);
        mockSupabaseFrom.mockImplementation((table: string) => {
          if (table === "beaches") return thenable({ data: [{ id: "beach-a", name: "A", lat: 34.03, lon: -118.67, tide_forecasts: [] }], error: null });
          if (table === "tide_forecasts") return tideForecasts;
          return { upsert: jest.fn(async () => ({ error: null })) };
        });

        const { json } = await runTideRefresh("tidesBackfillMissing=1");

        expectConsoleWarnings([/NOAA tide request returned no predictions/, /NOAA tides empty for station/]);
        expect(mockFetch).toHaveBeenCalledTimes(2);
        expect(upsertTides).toHaveBeenCalledTimes(1);
        expect(json.data.totals.tides).toBe(3);
        expect(json.data.tideIngest).toEqual(expect.objectContaining({
          retriedStations: 1,
          recoveredStations: 1,
          failedStations: [],
        }));
      } finally {
        global.fetch = originalFetch;
      }
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
        if (table === "cron_runs") return thenable({ data: null, error: null });
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

    it("reports incomplete reconciliation when superseding fails", async () => {
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
        if (table === "cron_runs") return thenable({ data: null, error: null });
        if (table === "tide_forecasts") return tideForecasts;
        return { upsert: jest.fn(async () => ({ error: null })) };
      });

      const { json, failureReason } = await runTideRefresh("source=tide");

      expectConsoleWarnings([/Tide supersede failed.*9410230.*delete timed out/]);
      expect(tideForecasts.deleteCalls).toHaveLength(2);
      expect(json.data.tideIngest.supersedeErrors).toBe(2);
      expect(json.data.tideIngest.failedStations).toEqual([{ stationId: "9410230", beaches: 1, reason: "reconcile_incomplete" }]);
      expect(json.data.tideIngest.reconcilePendingBeachIds).toEqual(["beach-a"]);
      expect(json.data.tideIngest.beachIdsBelowMinCoverage).toEqual(["beach-a"]);
      expect(failureReason).toBe("tide coverage under 7 days for 1 beach");
    });

    it("selects direct hours before writing fallback rows", async () => {
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
      expect(tideForecasts.deleteCalls).toHaveLength(2);
      expect(tideForecasts.deleteCalls[0].filters[1]).toEqual(["neq", "station_id", stationId]);
    });


    it("writes model tides for a beach without a NOAA station", async () => {
      mockGetNearestTideStation.mockResolvedValue(null);
      mockGetBeachModelTides.mockReturnValue({ beachId: "model-beach", model: "FES2022", mllwOffsetM: 0, constituents: [{ name: "M2", amplitudeM: 1, phaseDeg: 0 }] });
      const upsertTides = jest.fn(async () => ({ error: null }));
      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === "beaches") return thenable({ data: [{ id: "model-beach", name: "Model", lat: 23, lon: -110, tide_forecasts: [] }], error: null });
        if (table === "tide_forecasts") return tideForecastsMock(upsertTides);
        return { upsert: jest.fn(async () => ({ error: null })) };
      });

      const { json, failureReason } = await runTideRefresh("tidesBackfillMissing=1");

      expect(mockPredictHourlyModelTides).toHaveBeenCalledWith(expect.objectContaining({ beachId: "model-beach" }), expect.any(String), expect.any(String));
      expect(upsertTides).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ beach_id: "model-beach", source: "fes2022", station_id: "FES2022", tide_phase: null })]),
        { onConflict: "beach_id,ts,source" },
      );
      expect(json.data.totals.tides).toBe(3);
      expect(json.data.tideIngest).toEqual(expect.objectContaining({ beachesWithoutStation: 1, beachesWithoutTideSource: 0, modelBeachesWritten: 1 }));
      expect(failureReason).toBeNull();
    });

    it("alarms when model tides cannot be written and coverage is under seven days", async () => {
      mockGetNearestTideStation.mockResolvedValue(null);
      mockGetBeachModelTides.mockReturnValue({ beachId: "model-beach", model: "FES2022", mllwOffsetM: 0, constituents: [{ name: "M2", amplitudeM: 1, phaseDeg: 0 }] });
      const upsertTides = jest.fn(async () => ({ error: { message: "statement timeout" } }));
      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === "beaches") return thenable({ data: [{ id: "model-beach", name: "Model", lat: 23, lon: -110, tide_forecasts: [] }], error: null });
        if (table === "tide_forecasts") return { upsert: upsertTides };
        return { upsert: jest.fn(async () => ({ error: null })) };
      });

      const { json, failureReason } = await runTideRefresh("tidesBackfillMissing=1");

      expectConsoleWarnings([/Tide upsert failed/]);
      expect(json.data.tideIngest.failedStations).toEqual([{ stationId: "FES2022", beaches: 1, reason: "upsert_failed" }]);
      expect(json.data.tideIngest.modelBeachesWritten).toBe(0);
      expect(json.data.tideIngest.beachIdsBelowMinCoverage).toEqual(["model-beach"]);
      expect(failureReason).toBe("tide coverage under 7 days for 1 beach");
    });

    it("does not alarm for a beach with neither a station nor model constants", async () => {
      mockGetNearestTideStation.mockResolvedValue(null);
      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === "beaches") return thenable({ data: [{ id: "no-source", name: "No source", lat: 23, lon: -110, tide_forecasts: [] }], error: null });
        if (table === "tide_forecasts") return { upsert: jest.fn() };
        return { upsert: jest.fn(async () => ({ error: null })) };
      });

      const { json, failureReason } = await runTideRefresh("tidesBackfillMissing=1");

      expect(json.data.tideIngest).toEqual(expect.objectContaining({ beachesWithoutStation: 1, beachesWithoutTideSource: 1, modelBeachesWritten: 0, beachesBelowMinCoverage: 0 }));
      expect(failureReason).toBeNull();
    });

    it("never looks up a NOAA station for a Canadian beach, even one within the 120 km radius", async () => {
      // Long Beach (Pacific Rim) sits about 110 km from Neah Bay. Without the
      // country gate the nearest-station lookup would bind it to a NOAA gauge
      // across the border; #717 requires an explicit Canadian binding first.
      mockGetNearestTideStation.mockResolvedValue({ id: "9443090", name: "Neah Bay", lat: 48.3683, lon: -124.6117 });
      const upsertTides = jest.fn(async () => ({ error: null }));
      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === "beaches") return thenable({ data: [{ id: "long-beach-bc", name: "Long Beach (Pacific Rim)", lat: 49.0658, lon: -125.7535, country: "Canada", tide_forecasts: [] }], error: null });
        if (table === "tide_forecasts") return tideForecastsMock(upsertTides);
        return { upsert: jest.fn(async () => ({ error: null })) };
      });

      const { json, failureReason } = await runTideRefresh("tidesBackfillMissing=1");

      expect(mockGetNearestTideStation).not.toHaveBeenCalled();
      expect(mockFetchHourlyTidePredictions).not.toHaveBeenCalled();
      expect(upsertTides).not.toHaveBeenCalled();
      expect(json.data.tideIngest).toEqual(expect.objectContaining({ beachesWithoutStation: 1, beachesWithoutTideSource: 1, modelBeachesWritten: 0, beachesBelowMinCoverage: 0 }));
      expect(failureReason).toBeNull();
    });
  });

  describe("cross-refresh reconciliation", () => {
    beforeEach(() => {
      jest.resetModules();
      jest.useFakeTimers().setSystemTime(new Date("2026-10-14T00:00:00.000Z"));
      mockGetNearestTideStation.mockReset();
      mockFetchHourlyTidePredictions.mockReset();
      mockFetchCOOPSData.mockReset();
      mockGetBeachModelTides.mockReset().mockReturnValue(null);
      mockPredictHourlyModelTides.mockReset().mockImplementation(() => hourlyPoints(3));
      mockSupabaseFrom.mockReset();
    });

    afterEach(() => jest.useRealTimers());

    const station = (id: string) => ({ id, name: id, lat: 32.86, lon: -117.26 });
    const fallback = () => {
      mockFetchHourlyTidePredictions.mockRejectedValue(new Error("hourly unavailable"));
      mockFetchCOOPSData.mockResolvedValue({ tides: [
        { time: Date.now() / 1000 - 3600, height: 1 },
        { time: Date.now() / 1000 + 86400, height: 2 },
      ] });
    };

    it("removes old fallback rows after a direct refresh of the same station", async () => {
      const store = installTideStore();
      mockGetNearestTideStation.mockResolvedValue(station("S1"));
      fallback();
      await runTideRefresh("tidesBackfillMissing=1");
      expectConsoleWarnings([/NOAA hourly tide fetch failed/]);
      const fallbackHours = new Set(store.rows.map((row) => row.ts));
      expect(fallbackHours.size).toBeGreaterThan(3);
      jest.setSystemTime(new Date(Date.now() + 60_000));
      mockFetchHourlyTidePredictions.mockResolvedValue(hourlyPoints(3));
      await runTideRefresh("tidesBackfillMissing=1");
      const directHours = new Set(store.rows.filter((row) => row.source === "noaa").map((row) => row.ts));
      expect(directHours.size).toBe(3);
      expect(store.rows.filter((row) => directHours.has(row.ts) && row.source === "noaa_hilo_interpolated")).toEqual([]);
      const sortedHours = [...directHours].sort();
      expect(store.deletes).toHaveLength(5);
      expect(store.deletes[4]).toEqual([
        ["in", "beach_id", ["beach-a"]],
        ["eq", "station_id", "S1"],
        ["eq", "source", "noaa_hilo_interpolated"],
        ["gte", "ts", sortedHours[0]],
        ["lte", "ts", sortedHours[2]],
        ["lt", "created_at", "2026-10-14T00:01:00.000Z"],
      ]);
    });

    it("keeps older direct hours and excludes them from a later fallback batch", async () => {
      const store = installTideStore();
      mockGetNearestTideStation.mockResolvedValue(station("S1"));
      mockFetchHourlyTidePredictions.mockResolvedValue(hourlyPoints(3));
      await runTideRefresh("tidesBackfillMissing=1");
      const directHours = new Set(store.rows.map((row) => row.ts));
      jest.setSystemTime(new Date(Date.now() + 60_000));
      fallback();
      await runTideRefresh("tidesBackfillMissing=1");
      expectConsoleWarnings([/NOAA hourly tide fetch failed/]);
      expect(store.upsertBatches[1].every((row) => !directHours.has(row.ts))).toBe(true);
      expect(store.rows.filter((row) => row.source === "noaa")).toHaveLength(3);
      expect(store.rows.some((row) => row.source === "noaa_hilo_interpolated")).toBe(true);
    });

    it("reports a fallback reconciliation select error before upsert", async () => {
      mockGetNearestTideStation.mockResolvedValue(station("S1"));
      fallback();
      const tides = tideForecastsMock(jest.fn(async () => ({ error: null }))) as any;
      tides.select = () => thenable({ data: null, error: { message: "select failed" } });
      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === "beaches") return thenable({ data: [{ id: "beach-a", name: "Beach", lat: 32.86, lon: -117.26, tide_forecasts: [] }], error: null });
        if (table === "tide_forecasts") return tides;
        return { upsert: jest.fn(async () => ({ error: null })) };
      });
      const { json } = await runTideRefresh("tidesBackfillMissing=1");
      expectConsoleWarnings([/NOAA hourly tide fetch failed/, /Tide reconciliation select failed/]);
      expect(tides.upsert).not.toHaveBeenCalled();
      expect(json.data.tideIngest.failedStations).toEqual([{ stationId: "S1", beaches: 1, reason: "reconcile_incomplete" }]);
    });

    it("keeps a contiguous new-station series after a partial station overlap", async () => {
      const store = installTideStore();
      mockGetNearestTideStation.mockResolvedValueOnce(station("S1")).mockResolvedValueOnce(station("S2"));
      fallback();
      await runTideRefresh("tidesBackfillMissing=1");
      expectConsoleWarnings([/NOAA hourly tide fetch failed/]);
      jest.setSystemTime(new Date(Date.now() + 60_000));
      mockFetchHourlyTidePredictions.mockResolvedValue(hourlyPoints(3));
      await runTideRefresh("tidesBackfillMissing=1");
      const { selectTideSeries } = require("@/lib/services/tide-forecast-selection");
      const selected = selectTideSeries(store.rows) as StoredTide[];
      expect(selected.map((row) => row.station_id)).toEqual(["S2", "S2", "S2"]);
      expect(selected.map((row) => Date.parse(row.ts))).toEqual(selected.map((row, index) => Date.parse(selected[0].ts) + index * 3_600_000));
      expect(store.rows.filter((row) => row.station_id === "S1" && selected.some((current) => current.ts === row.ts))).toEqual([]);
    });

    it.each(["model-to-station", "station-to-model"])("reconciles %s transitions", async (direction) => {
      const store = installTideStore();
      let useModel = direction === "model-to-station";
      mockGetNearestTideStation.mockImplementation(async () => useModel ? null : station("S1"));
      mockGetBeachModelTides.mockReturnValue({ beachId: "beach-a", model: "FES2022", constituents: [] });
      mockFetchHourlyTidePredictions.mockResolvedValue(hourlyPoints(3));
      await runTideRefresh("tidesBackfillMissing=1");
      useModel = !useModel;
      jest.setSystemTime(new Date(Date.now() + 60_000));
      await runTideRefresh("tidesBackfillMissing=1");
      expect(new Set(store.rows.map((row) => row.station_id))).toEqual(new Set([useModel ? "FES2022" : "S1"]));
    });

    it("marks a post-upsert budget stop as reconciliation incomplete", async () => {
      const store = installTideStore("beach-a", () => jest.setSystemTime(new Date(Date.now() + 2_000)));
      mockGetNearestTideStation.mockResolvedValue(station("S1"));
      mockFetchHourlyTidePredictions.mockResolvedValue(hourlyPoints(3));
      process.env.FORECAST_CRON_TIME_BUDGET_MS = "1000";
      try {
        const { json } = await runTideRefresh("tidesBackfillMissing=1");
        expect(store.deletes).toHaveLength(0);
        expect(json.data.tideIngest.failedStations).toEqual([{ stationId: "S1", beaches: 1, reason: "reconcile_incomplete" }]);
        expect(json.data.tideIngest.reconcilePendingBeachIds).toEqual(["beach-a"]);
      } finally {
        delete process.env.FORECAST_CRON_TIME_BUDGET_MS;
      }
    });

    it("keeps a partial upsert pending when the retry fails before writing", async () => {
      mockGetNearestTideStation.mockResolvedValue(station("S1"));
      mockFetchHourlyTidePredictions.mockResolvedValue(hourlyPoints(1001));
      const upsert = jest.fn()
        .mockResolvedValueOnce({ error: null })
        .mockResolvedValue({ error: { message: "statement timeout" } });
      const tides = tideForecastsMock(upsert);
      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === "beaches") return thenable({ data: [{ id: "beach-a", name: "Beach", lat: 32.86, lon: -117.26 }], error: null });
        if (table === "v_tide_forecast_latest") return thenable({ data: [{ beach_id: "beach-a", created_at: new Date(Date.now() - 2 * DAY_MS).toISOString() }], error: null });
        if (table === "cron_runs") return thenable({ data: null, error: null });
        if (table === "tide_forecasts") return tides;
        return { upsert: jest.fn(async () => ({ error: null })) };
      });

      const { json, failureReason } = await runTideRefresh("source=tide");

      expectConsoleWarnings([/Tide upsert failed/]);
      expect(upsert).toHaveBeenCalledTimes(4);
      expect(tides.deleteCalls).toHaveLength(0);
      expect(json.data.totals.tides).toBe(1000);
      expect(json.data.tideIngest.failedStations).toEqual([{ stationId: "S1", beaches: 1, reason: "upsert_failed" }]);
      expect(json.data.tideIngest.reconcilePendingBeachIds).toEqual(["beach-a"]);
      expect(failureReason).toBeNull();
    });

    it("continues tide ingest when the previous pending lookup fails", async () => {
      mockGetNearestTideStation.mockResolvedValue(station("S1"));
      mockFetchHourlyTidePredictions.mockResolvedValue(hourlyPoints(3));
      const tides = tideForecastsMock(jest.fn(async () => ({ error: null })));
      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === "beaches") return thenable({ data: [{ id: "beach-a", name: "Beach", lat: 32.86, lon: -117.26 }], error: null });
        if (table === "v_tide_forecast_latest") return thenable({ data: [{ beach_id: "beach-a", created_at: new Date(Date.now() - 2 * DAY_MS).toISOString() }], error: null });
        if (table === "cron_runs") return thenable({ data: null, error: { message: "read timed out" } });
        if (table === "tide_forecasts") return tides;
        return { upsert: jest.fn(async () => ({ error: null })) };
      });

      const { json, failureReason } = await runTideRefresh("source=tide");

      expectConsoleWarnings([/Pending tide reconciliation lookup failed/]);
      expect(tides.upsert).toHaveBeenCalledTimes(1);
      expect(json.data.tideIngest.reconcilePendingBeachIds).toEqual([]);
      expect(failureReason).toBeNull();
    });

    it("reselects a fresh beach carried from a previous incomplete run", async () => {
      const store = installTideStore("beach-a", undefined, ["beach-a"]);
      mockGetNearestTideStation.mockResolvedValue(station("S1"));
      mockFetchHourlyTidePredictions.mockResolvedValue(hourlyPoints(3));
      const { json } = await runTideRefresh("source=tide");
      expect(store.upsertBatches).toHaveLength(1);
      expect(json.data.tideIngest.reconcilePendingBeachIds).toEqual([]);
    });

    it("does not delete rows written by a newer overlapping run", async () => {
      let inserted = false;
      const store = installTideStore("beach-a", (rows) => {
        if (inserted) return;
        inserted = true;
        rows.push({ ...rows[0], source: "noaa_hilo_interpolated", station_id: "S2", created_at: new Date(Date.now() + 60_000).toISOString() });
        rows.push({ ...rows[1], source: "noaa_hilo_interpolated", station_id: "S1", created_at: new Date(Date.now() + 60_000).toISOString() });
      });
      mockGetNearestTideStation.mockResolvedValue(station("S1"));
      mockFetchHourlyTidePredictions.mockResolvedValue(hourlyPoints(3));
      await runTideRefresh("tidesBackfillMissing=1");
      expect(store.rows.some((row) => row.station_id === "S2")).toBe(true);
      expect(store.rows.some((row) => row.station_id === "S1" && row.source === "noaa_hilo_interpolated")).toBe(true);
      expect(store.deletes[0]).toContainEqual(["lt", "created_at", "2026-10-14T00:00:00.000Z"]);
    });
  });
});





