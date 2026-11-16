// __tests__/app/api/cron/wind/update.test.ts

import { readFileSync } from "node:fs";
import { join } from "node:path";

jest.mock("@/lib/cron/outcome", () => ({
  withCronOutcome: jest.fn(jest.requireActual("@/lib/cron/outcome").withCronOutcome),
}));

// Pass-through observability wrapper so importing GET yields the unwrapped
// handler. Keeps the route's public surface unchanged.
jest.mock("@/lib/cron/observability", () => ({
  withObservedCron: <H extends Function>(_route: string, handler: H) => handler,
  observedCronRun: { getStore: () => undefined },
}));

jest.mock("@sentry/nextjs", () => ({
  captureMessage: jest.fn(),
  captureException: jest.fn(),
}));

jest.mock("node:timers/promises", () => ({
  setTimeout: jest.fn().mockResolvedValue(undefined),
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
import * as Sentry from "@sentry/nextjs";

const mockInsertOutcome = jest.fn();

type Beach = { id: string; lat: number; lon: number; name: string };
type CronQueryMock = Record<'select' | 'eq' | 'gt' | 'order' | 'limit' | 'maybeSingle' | 'insert', jest.Mock>;

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
  lastOk: { data: { ran_at: string } | null; error: { message: string } | null } = {
    data: { ran_at: new Date().toISOString() }, error: null,
  },
): CronQueryMock {
  const beachesQuery = {
    select: jest.fn().mockReturnValue({
      not: jest.fn().mockReturnValue({
        not: jest.fn().mockResolvedValue({ data: makeBeaches(beachCount), error: null }),
      }),
    }),
  };
  const cronQuery = {
    select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(),
    gt: jest.fn().mockReturnThis(), order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(), maybeSingle: jest.fn().mockResolvedValue(lastOk),
    insert: mockInsertOutcome,
  };
  (createSupabaseServiceRoleClient as jest.Mock).mockReturnValue({
    from: jest.fn((table: string) => {
      if (table === "beaches") return beachesQuery;
      if (table === "cron_runs") return cronQuery;
      throw new Error(`unexpected table: ${table}`);
    }),
    rpc: jest.fn(async (fn: string, args: Record<string, unknown>) => {
      rpcCalls.push({ fn, args });
      return rpc(args);
    }),
  });
  return cronQuery;
}

type OutcomeOptions = {
  failureReason?: (value: unknown) => string | null;
};

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
    mockInsertOutcome.mockReset().mockResolvedValue({ error: null });
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
        if (table === "cron_runs") return { insert: mockInsertOutcome };
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
        if (table === "cron_runs") return { insert: mockInsertOutcome };
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
    expect(lastFailureReason(body.details)).toBeNull();
    expect(mockInsertOutcome).toHaveBeenCalledWith(expect.objectContaining({ status: 'ok' }));
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
        if (table === "cron_runs") return { insert: mockInsertOutcome };
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

  it("stops after two batches on each host in which every Open-Meteo fetch times out", async () => {
    mockClient(580, () => ({ data: { updated_count: 8, skipped_count: 0 }, error: null }), rpcCalls, {
      data: { ran_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString() }, error: null,
    });
    (fetchHourlyWind as jest.Mock).mockRejectedValue(timeoutError());

    const response = await GET(makeRequest());
    expect(response.status).toBe(200);
    const body = await response.json();

    // 20 on the primary host, then the same 20 again on the fallback host.
    expect(fetchHourlyWind).toHaveBeenCalledTimes(40);
    const hosts = (fetchHourlyWind as jest.Mock).mock.calls.map((c) => c[2]);
    expect(hosts.slice(0, 20).every((h) => h === "primary")).toBe(true);
    expect(hosts.slice(20).every((h) => h === "fallback")).toBe(true);
    expect(rpcCalls).toHaveLength(0);
    expect(body.data).toMatchObject({
      beaches: 580,
      attemptedBeaches: 40,
      updated: 0,
      fetchErrors: 40,
      upstreamFetchErrors: 40,
      windHost: "fallback",
      stoppedReason: "upstream_unavailable",
      outcome: "degraded",
    });
    expect(lastFailureReason(body.data)).toBeNull();
    expect(mockInsertOutcome).toHaveBeenCalledWith(expect.objectContaining({
      status: 'ok', legitimately_zero_reason: 'Upstream gap within allowed duration',
    }));
    expect(Sentry.captureMessage).not.toHaveBeenCalled();
    expectConsoleWarnings([/\[Wind\] Switching to the Open-Meteo fallback host/, /\[Wind\] Stopped early: upstream_unavailable/, /\[Wind\] \d+ Open-Meteo fetch errors/]);
  });

  it("alerts when both hosts have been unavailable for more than six hours", async () => {
    const lastOk = new Date(Date.now() - 7 * 60 * 60 * 1000).toISOString();
    mockClient(40, () => ({ data: null, error: null }), rpcCalls, { data: { ran_at: lastOk }, error: null });
    (fetchHourlyWind as jest.Mock).mockRejectedValue(timeoutError());

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.details).toMatchObject({ stoppedReason: 'upstream_unavailable', outcome: 'degraded' });
    expect(body.error).toContain(`Open-Meteo wind unavailable on both hosts for >6 h; last productive run ${lastOk}`);
    expect(body.error).toContain('Action: check Open-Meteo host availability');
    expect(lastFailureReason(body.details)).toBe(body.error);
    expect(mockInsertOutcome).toHaveBeenCalledWith(expect.objectContaining({ status: 'failed', legitimately_zero_reason: null }));
    expectConsoleWarnings([/Switching to the Open-Meteo fallback host/, /Open-Meteo fetch errors/, /Stopped early: upstream_unavailable/]);
  });

  it("alerts on the seventh hourly gap run even after six ok zero-row outcomes", async () => {
    const t0 = Date.parse('2026-11-16T00:00:00Z');
    const job = '/api/cron/wind/update';
    const history: Array<Record<string, unknown>> = [
      { job, status: 'ok', produced: 8, ran_at: new Date(t0).toISOString() },
    ];
    const query = mockClient(40, () => ({ data: null, error: null }), rpcCalls);
    let filters: Array<(row: Record<string, unknown>) => boolean> = [];
    query.select.mockImplementation(() => { filters = []; return query; });
    query.eq.mockImplementation((column: string, value: unknown) => {
      filters.push((row) => row[column] === value);
      return query;
    });
    query.gt.mockImplementation((column: string, value: number) => {
      filters.push((row) => Number(row[column]) > value);
      return query;
    });
    query.maybeSingle.mockImplementation(async () => ({
      data: history.filter((row) => filters.every((filter) => filter(row)))
        .sort((a, b) => Date.parse(String(b.ran_at)) - Date.parse(String(a.ran_at)))[0] ?? null,
      error: null,
    }));
    mockInsertOutcome.mockImplementation(async (row: Record<string, unknown>) => {
      history.push(row);
      return { error: null };
    });
    (fetchHourlyWind as jest.Mock).mockRejectedValue(timeoutError());
    jest.useFakeTimers({ now: t0 });

    try {
      for (let hour = 1; hour <= 7; hour++) {
        jest.setSystemTime(t0 + hour * 60 * 60 * 1000);
        const response = await GET(makeRequest());
        const body = await response.json();
        expectConsoleWarnings([/Switching to the Open-Meteo fallback host/, /Open-Meteo fetch errors/, /Stopped early: upstream_unavailable/]);

        expect(history).toHaveLength(hour + 1);
        expect(history.at(-1)).toMatchObject({ job, produced: 0, status: hour <= 6 ? 'ok' : 'failed' });
        expect(response.status).toBe(hour <= 6 ? 200 : 503);
        expect(history.at(-1)?.error_message).toBe(hour <= 6 ? null : body.error);
        expect(Sentry.captureMessage).toHaveBeenCalledTimes(hour <= 6 ? 0 : 1);
      }
      expect(history.at(-1)?.error_message).toEqual(expect.stringContaining(`last productive run ${new Date(t0).toISOString()}`));
      expect(history.at(-1)?.error_message).toEqual(expect.stringContaining('>6 h'));
      expect(query.gt).toHaveBeenCalledWith('produced', 0);
    } finally {
      jest.useRealTimers();
    }
  });

  it("alerts when there is no recorded ok run", async () => {
    mockClient(40, () => ({ data: null, error: null }), rpcCalls, { data: null, error: null });
    (fetchHourlyWind as jest.Mock).mockRejectedValue(timeoutError());

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.error).toContain('last productive run never');
    expectConsoleWarnings([/Switching to the Open-Meteo fallback host/, /Open-Meteo fetch errors/, /Stopped early: upstream_unavailable/]);
  });

  it("treats a failed last-productive read as a short gap and logs it", async () => {
    mockClient(40, () => ({ data: null, error: null }), rpcCalls, { data: null, error: { message: 'read timed out' } });
    (fetchHourlyWind as jest.Mock).mockRejectedValue(timeoutError());

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.outcome).toBe('degraded');
    expect(lastFailureReason(body.data)).toBeNull();
    expect(mockInsertOutcome).toHaveBeenCalledWith(expect.objectContaining({
      status: 'ok', legitimately_zero_reason: 'Upstream gap within allowed duration',
    }));
    expectConsoleWarnings([/Switching to the Open-Meteo fallback host/, /Open-Meteo fetch errors/, /could not read last productive run/, /Stopped early: upstream_unavailable/]);
  });

  it("names the connection error code in the upstream reason", async () => {
    mockClient(20, () => ({ data: { updated_count: 8, skipped_count: 0 }, error: null }), rpcCalls);
    (fetchHourlyWind as jest.Mock).mockRejectedValue(
      Object.assign(new TypeError("fetch failed"), { cause: { code: "ECONNREFUSED" } }),
    );

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.stoppedReason).toBe('upstream_unavailable');
    expectConsoleWarnings([/\[Wind\] Switching to the Open-Meteo fallback host/, /\[Wind\] Stopped early: upstream_unavailable.*TypeError\/ECONNREFUSED/, /\[Wind\] \d+ Open-Meteo fetch errors/]);
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

    expect(response.status).toBe(200);
    expect(body.data).toMatchObject({ stoppedReason: 'upstream_unavailable', outcome: 'degraded' });
    expectConsoleWarnings([/\[Wind\] Switching to the Open-Meteo fallback host/, /\[Wind\] Stopped early: upstream_unavailable.*TypeError\/ECONNREFUSED/, /\[Wind\] \d+ Open-Meteo fetch errors/]);
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
    expect(lastFailureReason(body.details)).toBe('Wind update completed with row errors');
  });

  it.each([1, 2, 3])("tolerates at most ceil(5%%) row errors among 21 attempted beaches (%i errors)", async (errorCount) => {
    mockClient(21, (args) => Number(String(args.p_beach_id).split('-')[1]) < errorCount
      ? { data: null, error: { message: 'write timed out' } }
      : { data: { updated_count: 8, skipped_count: 0 }, error: null }, rpcCalls);

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.details).toMatchObject({ errors: errorCount, attemptedBeaches: 21, outcome: 'degraded', sampleErrors: ['write timed out'] });
    expect(mockInsertOutcome).toHaveBeenLastCalledWith(expect.objectContaining({
      status: errorCount > 2 ? 'failed' : 'ok',
      error_message: errorCount > 2 ? 'Wind update completed with row errors' : null,
    }));
    expect(Sentry.captureMessage).toHaveBeenCalledTimes(errorCount > 2 ? 1 : 0);
  });

  it("keeps a zero-row run degraded when its one write error is within the rounded allowance", async () => {
    mockClient(1, () => ({ data: null, error: { message: 'write timed out' } }), rpcCalls);

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.details).toMatchObject({ updated: 0, errors: 1, attemptedBeaches: 1, outcome: 'degraded' });
    expect(mockInsertOutcome).toHaveBeenCalledWith(expect.objectContaining({
      status: 'ok', error_message: null, legitimately_zero_reason: 'Wind row errors within tolerated limit',
    }));
    expect(Sentry.captureMessage).not.toHaveBeenCalled();
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

  it("switches to the fallback host when the primary host gives no HTTP response", async () => {
    mockClient(40, () => ({ data: { updated_count: 8, skipped_count: 0 }, error: null }), rpcCalls);
    (fetchHourlyWind as jest.Mock).mockImplementation(async (_lat: number, _lon: number, host: string) => {
      if (host === "fallback") return makeWindPoints(48);
      throw timeoutError();
    });

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    // 20 primary timeouts, then all 40 beaches (the first 20 retried) on the fallback.
    expect(fetchHourlyWind).toHaveBeenCalledTimes(60);
    expect(rpcCalls).toHaveLength(40);
    expect(new Set(rpcCalls.map((c) => c.args.p_beach_id)).size).toBe(40);
    expect(body.data).toMatchObject({
      updated: 40 * 8,
      windHost: "fallback",
      stoppedReason: null,
    });
    expect(body.data.primaryDownDetail).toMatch(/primary host gave no HTTP response in 2 consecutive batches \(TimeoutError\)/);
    expect(lastFailureReason(body.data)).toBeNull();
    expectConsoleWarnings([/\[Wind\] Switching to the Open-Meteo fallback host/, /\[Wind\] \d+ Open-Meteo fetch errors/]);
  });

  it("stays on the primary host when fetches fail with non-network errors", async () => {
    mockClient(30, () => ({ data: { updated_count: 8, skipped_count: 0 }, error: null }), rpcCalls);
    (fetchHourlyWind as jest.Mock).mockRejectedValue(new SyntaxError("Unexpected token < in JSON"));

    const response = await GET(makeRequest());
    const body = await response.json();

    const hosts = (fetchHourlyWind as jest.Mock).mock.calls.map((c) => c[2]);
    expect(hosts).toHaveLength(30);
    expect(hosts.every((h) => h === "primary")).toBe(true);
    expect(body.data).toMatchObject({ windHost: "primary", primaryDownDetail: null });
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

  it("returns a degraded success when the fallback host reaches the deadline", async () => {
    mockClient(40, () => ({ data: { updated_count: 8, skipped_count: 0 }, error: null }), rpcCalls);
    let now = 1_000_000;
    const clock = jest.spyOn(Date, 'now').mockImplementation(() => now);
    (fetchHourlyWind as jest.Mock).mockImplementation(async (_lat: number, _lon: number, host: string) => {
      if (host === 'primary') throw timeoutError();
      now += 5_000;
      return makeWindPoints(48);
    });

    try {
      const response = await GET(makeRequest());
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.data).toMatchObject({ windHost: 'fallback', stoppedReason: 'deadline_exceeded', outcome: 'degraded', updated: 20 * 8 });
      expect(lastFailureReason(body.data)).toBeNull();
      expect(fetchHourlyWind).toHaveBeenCalledTimes(40);
      expectConsoleWarnings([/Switching to the Open-Meteo fallback host/, /Open-Meteo fetch errors/, /Stopped early: deadline_exceeded/]);
    } finally {
      clock.mockRestore();
    }
  });

  it.each([2, 7])("applies the gap limit to a zero-row fallback deadline %i hours after the last productive run", async (hours) => {
    const t0 = Date.parse('2026-11-16T00:00:00Z');
    jest.useFakeTimers({ now: t0 + hours * 60 * 60 * 1000 });
    mockClient(40, () => ({ data: null, error: null }), rpcCalls, {
      data: { ran_at: new Date(t0).toISOString() }, error: null,
    });
    (fetchHourlyWind as jest.Mock).mockImplementation(async (_lat: number, _lon: number, host: string) => {
      if (host === 'primary') throw timeoutError();
      jest.setSystemTime(Date.now() + 5_000);
      return [];
    });

    try {
      const response = await GET(makeRequest());
      const body = await response.json();
      expectConsoleWarnings([/Switching to the Open-Meteo fallback host/, /Open-Meteo fetch errors/, /Stopped early: deadline_exceeded/]);

      expect(response.status).toBe(hours === 2 ? 200 : 503);
      expect(body.data ?? body.details).toMatchObject({ windHost: 'fallback', stoppedReason: 'deadline_exceeded', outcome: 'degraded', updated: 0 });
      expect(mockInsertOutcome).toHaveBeenCalledWith(expect.objectContaining({
        status: hours === 2 ? 'ok' : 'failed', produced: 0,
        error_message: hours === 2 ? null : body.error,
      }));
      expect(Sentry.captureMessage).toHaveBeenCalledTimes(hours === 2 ? 0 : 1);
      const expectedError = `Open-Meteo wind primary unavailable and fallback deadline exceeded for >6 h; last productive run ${new Date(t0).toISOString()}. Action: check Open-Meteo host availability and retry wind update`;
      expect(body.error).toBe(hours === 2 ? undefined : expectedError);
    } finally {
      jest.useRealTimers();
    }
  });
});
