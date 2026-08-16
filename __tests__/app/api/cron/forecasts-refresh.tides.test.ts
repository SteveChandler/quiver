/** @jest-environment node */

jest.mock("@/lib/cron/outcome", () => ({
  withCronOutcome: jest.fn(async (_options: unknown, handler: () => Promise<unknown>) => handler()),
}));

import { readFileSync } from "fs";

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

const mockSupabaseFrom = jest.fn();

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
        return { upsert: upsertTides };
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
  });
});











