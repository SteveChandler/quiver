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
  fetchHourlyWindOrThrow: jest.fn(),
  isOpenMeteoUpstreamError: jest.requireActual("@/lib/services/open-meteo-wind-service").isOpenMeteoUpstreamError,
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

import { fetchHourlyWindOrThrow as fetchHourlyWind } from "@/lib/services/open-meteo-wind-service";
import { withCronOutcome } from "@/lib/cron/outcome";
import { expectConsoleWarnings } from "@/__tests__/setup/test-utils";
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

function timeoutError(): Error {
  return Object.assign(new Error("The operation was aborted due to timeout"), { name: "TimeoutError" });
}

function mockClient(
  beachCount: number,
  rpc: (args: Record<string, unknown>) => { data: unknown; error: unknown },
  rpcCalls: Array<{ fn: string; args: Record<string, unknown> }>,
): void {
  const beachesQuery = {
    select: jest.fn().mockReturnValue({
      not: jest.fn().mockReturnValue({
        not: jest.fn().mockResolvedValue({ data: makeBeaches(beachCount), error: null }),
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
      return rpc(args);
    }),
  });
}

type OutcomeOptions = { failureReason?: (value: unknown) => string | null };

function lastFailureReason(summary: unknown): string | null {
  const calls = (withCronOutcome as jest.Mock).mock.calls;
  const options = calls[calls.length - 1][0] as OutcomeOptions;
  return options.failureReason?.(summary) ?? null;
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
    expectConsoleWarnings([/\[Wind\] \d+ Open-Meteo fetch errors/]);
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

  it("stops after two batches in which every Open-Meteo fetch times out", async () => {
    mockClient(580, () => ({ data: { updated_count: 8, skipped_count: 0 }, error: null }), rpcCalls);
    (fetchHourlyWind as jest.Mock).mockRejectedValue(timeoutError());

    const response = await GET(makeRequest());
    expect(response.status).toBe(503);
    const body = await response.json();

    expect(fetchHourlyWind).toHaveBeenCalledTimes(20);
    expect(rpcCalls).toHaveLength(0);
    expect(body.error).toMatch(/^upstream_unavailable: /);
    expect(body.details).toMatchObject({
      beaches: 580,
      attemptedBeaches: 20,
      updated: 0,
      fetchErrors: 20,
      upstreamFetchErrors: 20,
      stoppedReason: "upstream_unavailable",
    });
    expect(lastFailureReason(body.details)).toMatch(/^upstream_unavailable: Open-Meteo wind .*2 consecutive batches.*TimeoutError/);
    expectConsoleWarnings([/\[Wind\] Stopped early: upstream_unavailable/, /\[Wind\] \d+ Open-Meteo fetch errors/]);
  });

  it("names the connection error code in the upstream reason", async () => {
    mockClient(20, () => ({ data: { updated_count: 8, skipped_count: 0 }, error: null }), rpcCalls);
    (fetchHourlyWind as jest.Mock).mockRejectedValue(
      Object.assign(new TypeError("fetch failed"), { cause: { code: "ECONNREFUSED" } }),
    );

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.error).toContain("(TypeError/ECONNREFUSED)");
    expectConsoleWarnings([/\[Wind\] Stopped early: upstream_unavailable/, /\[Wind\] \d+ Open-Meteo fetch errors/]);
  });

  it("names only the errors of the failed streak in the stop reason", async () => {
    mockClient(40, () => ({ data: { updated_count: 8, skipped_count: 0 }, error: null }), rpcCalls);
    (fetchHourlyWind as jest.Mock).mockImplementation(async (lat: number) => {
      const index = Math.round((lat - 30) * 100);
      // Batch 1: one AbortError among good fetches. Batches 3-4: refused connections.
      if (index === 3) throw Object.assign(new Error("aborted"), { name: "AbortError" });
      if (index >= 20) throw Object.assign(new TypeError("fetch failed"), { cause: { code: "ECONNREFUSED" } });
      return makeWindPoints(48);
    });

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.error).toContain("(TypeError/ECONNREFUSED)");
    expect(body.error).not.toContain("AbortError");
    expectConsoleWarnings([/\[Wind\] Stopped early: upstream_unavailable/, /\[Wind\] \d+ Open-Meteo fetch errors/]);
  });

  it("resets the breaker when a batch has one good Open-Meteo fetch", async () => {
    mockClient(30, () => ({ data: { updated_count: 8, skipped_count: 0 }, error: null }), rpcCalls);
    (fetchHourlyWind as jest.Mock).mockImplementation(async (lat: number) => {
      // Beach 15 (batch 2) answers; all others time out.
      if (Math.abs(lat - 30.15) < 1e-9) return makeWindPoints(48);
      throw timeoutError();
    });

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(fetchHourlyWind).toHaveBeenCalledTimes(30);
    expect(response.status).toBe(200);
    expect(body.data).toMatchObject({ stoppedReason: null, attemptedBeaches: 30, updated: 8 });
    expectConsoleWarnings([/\[Wind\] \d+ Open-Meteo fetch errors/]);
  });

  it("does not trip the upstream breaker on RPC errors", async () => {
    mockClient(40, () => ({ data: null, error: { message: "simulated supabase RST", code: "08006" } }), rpcCalls);

    const response = await GET(makeRequest());
    expect(response.status).toBe(500);
    const body = await response.json();

    expect(fetchHourlyWind).toHaveBeenCalledTimes(40);
    expect(rpcCalls).toHaveLength(40);
    expect(body.details).toMatchObject({ errors: 40, attemptedBeaches: 40, stoppedReason: null });
    expect(lastFailureReason(body.details)).toBeNull();
  });

  it("does not count non-network fetch errors toward the breaker", async () => {
    mockClient(30, () => ({ data: { updated_count: 8, skipped_count: 0 }, error: null }), rpcCalls);
    (fetchHourlyWind as jest.Mock).mockRejectedValue(new SyntaxError("Unexpected token < in JSON"));

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(fetchHourlyWind).toHaveBeenCalledTimes(30);
    expect(response.status).toBe(200);
    expect(body.data).toMatchObject({ fetchErrors: 30, upstreamFetchErrors: 0, stoppedReason: null });
    // Zero rows still fails the outcome through expectedMin; it is just not an upstream stop.
    expect(lastFailureReason(body.data)).toBeNull();
    expectConsoleWarnings([/\[Wind\] \d+ Open-Meteo fetch errors/]);
  });

  it("stops at the wall-clock deadline and records a non-ok outcome", async () => {
    mockClient(40, () => ({ data: { updated_count: 8, skipped_count: 0 }, error: null }), rpcCalls);
    let now = 1_000_000;
    const clock = jest.spyOn(Date, "now").mockImplementation(() => now);
    (fetchHourlyWind as jest.Mock).mockImplementation(async () => {
      now += 5_000; // each fetch takes 5 s of wall clock; a batch of 10 = 50 s
      return makeWindPoints(48);
    });

    try {
      const response = await GET(makeRequest());
      expect(response.status).toBe(503);
      const body = await response.json();

      expect(fetchHourlyWind).toHaveBeenCalledTimes(20);
      expect(body.error).toMatch(/^deadline_exceeded: /);
      expect(body.details).toMatchObject({ attemptedBeaches: 20, updated: 20 * 8, stoppedReason: "deadline_exceeded" });
      expect(lastFailureReason(body.details)).toMatch(/^deadline_exceeded: /);
      expectConsoleWarnings([/\[Wind\] Stopped early: deadline_exceeded/]);
    } finally {
      clock.mockRestore();
    }
  });
});
