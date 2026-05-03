// __tests__/app/api/cron/wind/update.test.ts

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
jest.mock("@/lib/api-utils", () => ({
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

// p-limit ships ESM-only and isn't in jest's transformIgnorePatterns allowlist.
// Provide a faithful in-test reimplementation that preserves the concurrency
// cap so the limiter assertion is meaningful. Passes the function through
// immediately, capping how many run concurrently via a counter + queue.
// p-limit ships ESM-only and isn't in jest's transformIgnorePatterns allowlist.
// Ship a faithful in-test reimplementation that records the concurrency arg
// and tracks peak `active` so the limiter assertion is meaningful without
// relying on chain-level probes (which would over-count because thenable
// chains synchronously invoke terminal callbacks before yielding).
const pLimitState = {
  capArgs: [] as number[],
  peakActive: 0,
};
jest.mock("p-limit", () => {
  const pLimit = (concurrency: number) => {
    pLimitState.capArgs.push(concurrency);
    let active = 0;
    const queue: Array<() => void> = [];
    const tryRun = () => {
      if (active >= concurrency || queue.length === 0) return;
      active++;
      pLimitState.peakActive = Math.max(pLimitState.peakActive, active);
      const next = queue.shift()!;
      next();
    };
    function limited<T>(fn: () => Promise<T>): Promise<T> {
      return new Promise<T>((resolve, reject) => {
        const start = async () => {
          try {
            resolve(await fn());
          } catch (err) {
            reject(err);
          } finally {
            active--;
            tryRun();
          }
        };
        queue.push(start);
        tryRun();
      });
    }
    return limited;
  };
  return { __esModule: true, default: pLimit };
});

import { fetchHourlyWind } from "@/lib/services/open-meteo-wind-service";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { validateCronRequest } from "@/lib/api-utils";
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
  let totalUpdates = 0;
  const LIMITER_CAP = 80;

  beforeEach(() => {
    jest.clearAllMocks();
    totalUpdates = 0;
    pLimitState.capArgs = [];
    pLimitState.peakActive = 0;

    (fetchHourlyWind as jest.Mock).mockImplementation(async () => makeWindPoints(48));

    const updateChain = () => {
      const chain: Record<string, jest.Mock> = {};
      const terminal = jest.fn().mockImplementation(async () => {
        totalUpdates++;
        // Yield to microtasks so the limiter sees real concurrency churn,
        // not a 1920-deep synchronous chain. setImmediate is unavailable in
        // jsdom; queueMicrotask is the cross-env yield.
        await new Promise<void>((r) => queueMicrotask(r));
        return { data: [{ id: "row-1" }], error: null };
      });
      chain.eq = jest.fn().mockReturnValue(chain);
      chain.gte = jest.fn().mockReturnValue(chain);
      chain.lt = jest.fn().mockReturnValue(chain);
      chain.or = jest.fn().mockReturnValue(chain);
      chain.select = terminal;
      return chain;
    };

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
        if (table === "enhanced_forecasts") {
          return { update: jest.fn().mockReturnValue(updateChain()) };
        }
        throw new Error(`unexpected table: ${table}`);
      }),
    });
  });

  it("processes all beaches and returns success", async () => {
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
    // 40 beaches × 48 windPoints = 1920 expected DB updates
    expect(totalUpdates).toBe(40 * 48);
  });

  it("constructs a shared p-limit limiter and never exceeds its cap", async () => {
    await GET(makeRequest());
    // Wired up: the route imported and constructed pLimit(80) for this run.
    expect(pLimitState.capArgs).toContain(LIMITER_CAP);
    // The limiter actually limited: peak active starts ≤ cap, and parallelism
    // really happened (a serial implementation would not push past 1).
    expect(pLimitState.peakActive).toBeLessThanOrEqual(LIMITER_CAP);
    expect(pLimitState.peakActive).toBeGreaterThan(1);
  });

  it("returns 401 on unauthorized requests", async () => {
    (validateCronRequest as jest.Mock).mockReturnValueOnce(false);
    const response = await GET(makeRequest());
    expect(response.status).toBe(401);
  });

  it("counts thrown Supabase updates as errors instead of stranding the beach task", async () => {
    // Swap the chain factory so half the windPoint updates throw outright
    // (simulating a Supabase exception, not just a returned `{error}`).
    let updateCallCount = 0;
    const throwingUpdateChain = () => {
      const chain: Record<string, jest.Mock> = {};
      const terminal = jest.fn().mockImplementation(async () => {
        totalUpdates++;
        await new Promise<void>((r) => queueMicrotask(r));
        updateCallCount++;
        if (updateCallCount % 2 === 0) {
          throw new Error("simulated supabase RST");
        }
        return { data: [{ id: "row-1" }], error: null };
      });
      chain.eq = jest.fn().mockReturnValue(chain);
      chain.gte = jest.fn().mockReturnValue(chain);
      chain.lt = jest.fn().mockReturnValue(chain);
      chain.or = jest.fn().mockReturnValue(chain);
      chain.select = terminal;
      return chain;
    };

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
        if (table === "enhanced_forecasts") {
          return { update: jest.fn().mockReturnValue(throwingUpdateChain()) };
        }
        throw new Error(`unexpected table: ${table}`);
      }),
    });

    const response = await GET(makeRequest());
    expect(response.status).toBe(200);
    const body = await response.json();

    // Every windPoint update fired (5 beaches × 48 = 240). If a thrown
    // Supabase update had short-circuited the per-beach Promise.all, some
    // queued dbLimit slots would have been stranded and totalUpdates would
    // be < 240.
    expect(totalUpdates).toBe(5 * 48);
    // updated + errors should account for every windPoint that fired (no
    // counts lost because of the rejection short-circuit).
    expect(body.data.updated + body.data.errors).toBe(5 * 48);
    expect(body.data.errors).toBeGreaterThan(0);
    expect(body.data.updated).toBeGreaterThan(0);
  });
});
