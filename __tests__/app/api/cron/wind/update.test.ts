// __tests__/app/api/cron/wind/update.test.ts

import { readFileSync } from "node:fs";
import { join } from "node:path";

jest.mock("@/lib/cron/outcome", () => ({
  withCronOutcome: jest.fn(async (_options: unknown, handler: () => Promise<unknown>) => handler()),
}));

// Pass-through observability wrapper so importing GET yields the unwrapped
// handler. Keeps the route's public surface unchanged.
jest.mock("@/lib/cron/observability", () => ({
  withObservedCron: <H extends Function>(_route: string, handler: H) => handler,
}));

jest.mock("@/lib/services/open-meteo-wind-service", () => ({
  fetchHourlyWind: jest.fn(),
}));

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: jest.fn(),
}));

// Match the pattern used by other cron route tests
// (e.g. enhanced-forecast-sync.test.ts) — NextResponse.json isn't implemented
// in jsdom, so substitute plain envelope objects that expose .status + .json().
jest.mock("@/lib/middleware/api-wrappers", () => ({
  createSuccessResponse: jest.fn((data, status = 200) => ({
    status,
    json: () =>
      Promise.resolve({
        success: true,
        data,
        timestamp: new Date().toISOString(),
      }),
  })),
  createErrorResponse: jest.fn((error, details, status = 500) => ({
    status,
    json: () =>
      Promise.resolve({
        success: false,
        error,
        details,
        timestamp: new Date().toISOString(),
      }),
  })),
  validateCronRequest: jest.fn(() => true),
}));

import { fetchHourlyWind } from "@/lib/services/open-meteo-wind-service";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { validateCronRequest } from "@/lib/middleware/api-wrappers";
import { GET } from "@/app/api/cron/wind/update/route";

type Beach = { id: string; lat: number; lon: number; name: string };

function makeBeaches(count: number): Beach[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `beach-${i}`,
    lat: 30 + i * 0.01,
    lon: -90 - i * 0.01,
    name: `Beach ${i}`,
  }));
}

function makeWindPoints(count: number) {
  const start = Date.parse("2026-05-03T00:00:00Z");
  return Array.from({ length: count }, (_, i) => ({
    ts: new Date(start + i * 3600_000).toISOString(),
    wind_speed_mph: 8 + (i % 5),
    wind_direction_deg: (i * 15) % 360,
    wind_gust_mph: 12 + (i % 5),
  }));
}

function makeRequest(): Request {
  return new Request("http://test/api/cron/wind/update");
}

describe("GET /api/cron/wind/update", () => {
  let rpcCalls: Array<{ fn: string; args: Record<string, unknown> }> = [];
  let consoleLog: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    rpcCalls = [];
    consoleLog = jest.spyOn(console, "log").mockImplementation(() => undefined);

    (fetchHourlyWind as jest.Mock).mockImplementation(async () => makeWindPoints(48));

    const beachesQuery = {
      select: jest.fn().mockReturnValue({
        not: jest.fn().mockReturnValue({
          not: jest.fn().mockResolvedValue({ data: makeBeaches(40), error: null }),
        }),
      }),
    };

    (createSupabaseServiceRoleClient as jest.Mock).mockReturnValue({
      from: jest.fn((table: string) => {
        if (table === "beaches") return beachesQuery;
        throw new Error(`unexpected table: ${table}`);
      }),
      rpc: jest.fn(async (fn: string, args: Record<string, unknown>) => {
        rpcCalls.push({ fn, args });
        return { data: { updated_count: 8, skipped_count: 40 }, error: null };
      }),
    });
  });

  afterEach(() => {
    consoleLog.mockRestore();
  });

  it("uses the shared API wrapper module for response helpers and cron auth", () => {
    const source = readFileSync(
      join(process.cwd(), "app/api/cron/wind/update/route.ts"),
      "utf8"
    );

    expect(source).not.toMatch(/from\s+['"]@\/lib\/api-utils['"]/);
    expect(source).toMatch(/from\s+['"]@\/lib\/middleware\/api-wrappers['"]/);
  });

  it("updates wind with one RPC call per beach", async () => {
    const response = await GET(makeRequest());

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({
      success: true,
      data: expect.objectContaining({
        beaches: 40,
        updated: expect.any(Number),
        skipped: expect.any(Number),
        errors: expect.any(Number),
      }),
    });
    expect(rpcCalls).toHaveLength(40);
    expect(rpcCalls[0]).toMatchObject({
      fn: "update_open_meteo_wind_for_beach",
      args: {
        p_beach_id: "beach-0",
      },
    });
    expect(rpcCalls[0].args.p_points).toHaveLength(48);
    expect(body.data).toMatchObject({
      updated: 40 * 8,
      skipped: 40 * 40,
      errors: 0,
    });
  });

  it("returns 401 on unauthorized requests", async () => {
    (validateCronRequest as jest.Mock).mockReturnValueOnce(false);
    const response = await GET(makeRequest());
    expect(response.status).toBe(401);
  });

  it("returns an error response when an RPC call fails", async () => {
    const beachesQuery = {
      select: jest.fn().mockReturnValue({
        not: jest.fn().mockReturnValue({
          not: jest.fn().mockResolvedValue({ data: makeBeaches(5), error: null }),
        }),
      }),
    };

    (createSupabaseServiceRoleClient as jest.Mock).mockReturnValue({
      from: jest.fn((table: string) => {
        if (table === "beaches") return beachesQuery;
        throw new Error(`unexpected table: ${table}`);
      }),
      rpc: jest.fn(async (fn: string, args: Record<string, unknown>) => {
        rpcCalls.push({ fn, args });
        if (args.p_beach_id === "beach-1") {
          return { data: null, error: { message: "simulated supabase RST", code: "08006" } };
        }
        return { data: { updated_count: 8, skipped_count: 40 }, error: null };
      }),
    });

    const response = await GET(makeRequest());
    expect(response.status).toBe(500);
    const body = await response.json();

    expect(rpcCalls).toHaveLength(5);
    expect(body.details).toMatchObject({
      updated: 4 * 8,
      skipped: 4 * 40,
      errors: 1,
      sampleErrors: ["simulated supabase RST (code=08006)"],
    });
  });

  it("keeps the cron successful when one Open-Meteo fetch fails", async () => {
    const beachesQuery = {
      select: jest.fn().mockReturnValue({
        not: jest.fn().mockReturnValue({
          not: jest.fn().mockResolvedValue({ data: makeBeaches(3), error: null }),
        }),
      }),
    };

    (createSupabaseServiceRoleClient as jest.Mock).mockReturnValue({
      from: jest.fn((table: string) => {
        if (table === "beaches") return beachesQuery;
        throw new Error(`unexpected table: ${table}`);
      }),
      rpc: jest.fn(async (fn: string, args: Record<string, unknown>) => {
        rpcCalls.push({ fn, args });
        return { data: { updated_count: 8, skipped_count: 40 }, error: null };
      }),
    });
    (fetchHourlyWind as jest.Mock)
      .mockResolvedValueOnce(makeWindPoints(48))
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockResolvedValueOnce(makeWindPoints(48));

    const response = await GET(makeRequest());
    expect(response.status).toBe(200);
    const body = await response.json();

    expect(rpcCalls).toHaveLength(2);
    expect(body.data).toMatchObject({
      beaches: 3,
      updated: 16,
      skipped: 80,
      errors: 0,
      fetchErrors: 1,
      sampleErrors: ["Beach 1: fetch failed"],
    });
  });

  it("filters null wind speeds before calling the RPC", async () => {
    (fetchHourlyWind as jest.Mock).mockResolvedValueOnce([
      {
        ts: "2026-05-03T00:00:00.000Z",
        wind_speed_mph: 8,
        wind_direction_deg: 90,
        wind_gust_mph: 12,
      },
      {
        ts: "2026-05-03T01:00:00.000Z",
        wind_speed_mph: null,
        wind_direction_deg: 120,
        wind_gust_mph: 14,
      },
    ]);

    const response = await GET(makeRequest());
    expect(response.status).toBe(200);
    const body = await response.json();

    expect(body.success).toBe(true);
    expect(rpcCalls[0].args.p_points).toEqual([
      {
        ts: "2026-05-03T00:00:00.000Z",
        wind_speed_mph: 8,
        wind_direction_deg: 90,
      },
    ]);
  });
});
