/** @jest-environment node */
import { NextRequest } from "next/server";
import type { OptionalAuthContext } from "@/lib/middleware/api-wrappers";
import {
  FORECAST_BULK_MAX_INFLIGHT,
  FORECAST_BULK_MAX_INFLIGHT_PER_IP,
  FORECAST_BULK_DEADLINE_MS,
} from "@/lib/api/bulk-forecast-guard";
import { bulkForecastHandler, GET } from "@/app/api/forecasts/bulk/route";
import { getCachedRateLimiter } from "@/lib/utils/enhanced-rate-limiter";
import { RATE_LIMITS } from "@/lib/api/rate-limit-config";
import { GET as bootstrap } from "@/app/api/map/bootstrap/route";

interface QueryResult {
  data: unknown;
  error: { message: string } | null;
}
interface QueryChain extends PromiseLike<QueryResult> {
  select: jest.Mock;
  in: jest.Mock;
  gte: jest.Mock;
  lt: jest.Mock;
  order: jest.Mock;
  limit: jest.Mock;
  abortSignal: (signal: AbortSignal) => QueryChain;
}
interface TrackedQuery {
  source: string;
  signal?: AbortSignal;
  aborted: boolean;
  complete: () => void;
}

const mockQueries: TrackedQuery[] = [];
const mockAuth = jest.fn();
const nativeTimeout = AbortSignal.timeout;
let mockPendingForecasts = false;
let mockPendingRpc = false;
const mockRpcData = { beaches: [], profile: null, boards: [], sun_times: [], personalization: null, water_quality: {} };
const mockFrom = jest.fn((source: string) => mockQuery(source, [], mockPendingForecasts));
const mockRpc = jest.fn(() => mockQuery("rpc", mockRpcData, mockPendingRpc));
const mockContext: OptionalAuthContext = {
  supabase: { from: mockFrom } as unknown as OptionalAuthContext["supabase"],
  user: null,
  params: {},
};

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: () => ({ rpc: mockRpc }),
}));
jest.mock("@/lib/services/forecast/v5-display-gate", () => ({
  applyV51DisplayOverrideToForecasts: async (rows: unknown[]): Promise<unknown[]> => rows,
}));
jest.mock("@/lib/recommendations/major-event-hold/service", () => ({
  evaluateMajorEventHoldCandidates: async (): Promise<unknown[]> => [],
}));
jest.mock("@/lib/services/nearby-beach-service", () => ({
  getCachedNearbyBeachesFromDb: async () => ({ success: true, data: [{ id: "beach-1" }] }),
  normalizeNearbyBeachQuery: () => ({ radiusMiles: 30, limit: 20 }),
}));
jest.mock("@/lib/middleware/api-wrappers", () => ({
  ...jest.requireActual("@/lib/middleware/api-wrappers"),
  withAuth: (handler: typeof bulkForecastHandler) => (request: NextRequest) => {
    mockAuth(request);
    return handler(request, mockContext);
  },
}));

function mockQuery(source: string, data: unknown, pending: boolean): QueryChain {
  let resolveResult: (value: QueryResult) => void = (): void => {};
  const promise = new Promise<QueryResult>((resolve) => { resolveResult = resolve; });
  const tracked: TrackedQuery = {
    source,
    aborted: false,
    complete: (): void => resolveResult({ data, error: null }),
  };
  mockQueries.push(tracked);
  const query: QueryChain = {
    select: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    lt: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    abortSignal: jest.fn((signal: AbortSignal): QueryChain => {
      tracked.signal = signal;
      const abort = (): void => {
        tracked.aborted = true;
        resolveResult({ data: null, error: { message: "FetchError: aborted" } });
      };
      if (signal.aborted) abort();
      else signal.addEventListener("abort", abort, { once: true });
      return query;
    }),
    then: promise.then.bind(promise),
  };
  if (!pending) tracked.complete();
  return query;
}

function request(ip: string, params = "beachIds=beach-1", signal?: AbortSignal): NextRequest {
  return new NextRequest(`http://localhost/api/forecasts/bulk?${params}`, {
    headers: { "x-vercel-forwarded-for": `${ip}, proxy`, "x-real-ip": "untrusted" },
    signal,
  });
}

beforeEach(() => {
  jest.useFakeTimers({ now: new Date("2026-10-11T18:00:00Z") });
  jest.clearAllMocks();
  // Native abort timers bypass Jest fake timers; keep deadline tests bounded.
  jest.spyOn(AbortSignal, "timeout").mockImplementation(() => nativeTimeout(50));
  mockQueries.length = 0;
  mockPendingForecasts = false;
  mockPendingRpc = false;
  jest.spyOn(console, "warn").mockImplementation(() => {});
  jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(async () => {
  await jest.advanceTimersByTimeAsync(FORECAST_BULK_DEADLINE_MS);
  mockQueries.forEach((query) => query.complete());
  await jest.advanceTimersByTimeAsync(0);
  jest.useRealTimers();
  jest.restoreAllMocks();
});

afterAll(() => {
  getCachedRateLimiter("forecast-bulk", RATE_LIMITS["forecast-bulk"]).destroy();
  getCachedRateLimiter("public-default", RATE_LIMITS["public-default"]).destroy();
});

describe("bulk forecast burst guard", () => {
  it("uses fixed guard budgets", () => {
    expect([FORECAST_BULK_MAX_INFLIGHT, FORECAST_BULK_MAX_INFLIGHT_PER_IP, FORECAST_BULK_DEADLINE_MS]).toEqual([16, 6, 12_000]);
  });

  it("sheds at the global cap and releases capacity after completion", async () => {
    mockPendingForecasts = true;
    const active = Array.from({ length: FORECAST_BULK_MAX_INFLIGHT }, (_, index) =>
      GET(request(`global-${index}`)));
    const shed = await GET(request("overflow"));
    expect(shed.status).toBe(429);
    expect(shed.headers.get("Retry-After")).toBe("2");
    expect(await shed.json()).toMatchObject({ success: false, reason: "inflight_global", retryAfter: 2 });
    expect(mockFrom).toHaveBeenCalledTimes(FORECAST_BULK_MAX_INFLIGHT);
    expect(mockAuth).toHaveBeenCalledTimes(FORECAST_BULK_MAX_INFLIGHT);
    expect(console.warn).toHaveBeenCalledWith("[forecast-bulk:shed]", {
      reason: "inflight_global", ip: "overflow", beachCount: 1,
      inflight: FORECAST_BULK_MAX_INFLIGHT, ipInflight: 0,
    });
    mockQueries[0].complete();
    expect((await active[0]).status).toBe(200);
    const replacement = GET(request("overflow"));
    expect(mockAuth).toHaveBeenCalledTimes(FORECAST_BULK_MAX_INFLIGHT + 1);
    mockQueries.forEach((query) => query.complete());
    expect((await Promise.all([...active, replacement])).map((response) => response.status)).toEqual(Array(FORECAST_BULK_MAX_INFLIGHT + 1).fill(200));
  });

  it("allows the four-batch pan, sheds the seventh request before auth, and admits another IP", async () => {
    mockPendingForecasts = true;
    const pan = Array.from({ length: 4 }, () => GET(request("busy")));
    expect(mockAuth).toHaveBeenCalledTimes(4);
    expect(mockFrom).toHaveBeenCalledTimes(4);
    const active = [...pan, GET(request("busy")), GET(request("busy"))];
    const shed = await GET(request("busy"));
    expect(shed.status).toBe(429);
    expect(shed.headers.get("Retry-After")).toBe("2");
    expect(await shed.json()).toMatchObject({ reason: "inflight_ip" });
    expect(mockAuth).toHaveBeenCalledTimes(6);
    expect(mockFrom).toHaveBeenCalledTimes(6);
    expect(shed.headers.get("X-RateLimit-Remaining")).toBe(String(RATE_LIMITS["forecast-bulk"].requestsPerMinute - 7));
    expect(console.warn).toHaveBeenCalledWith("[forecast-bulk:shed]", {
      reason: "inflight_ip", ip: "busy", beachCount: 1,
      inflight: FORECAST_BULK_MAX_INFLIGHT_PER_IP, ipInflight: FORECAST_BULK_MAX_INFLIGHT_PER_IP,
    });
    mockPendingForecasts = false;
    expect((await GET(request("other"))).status).toBe(200);
    mockQueries.forEach((query) => query.complete());
    expect((await Promise.all(active)).map((response) => response.status)).toEqual(Array(6).fill(200));
    expect((await Promise.all(pan)).map((response) => response.status)).toEqual(Array(4).fill(200));
    expect((await GET(request("busy"))).status).toBe(200);
  });

  it("uses one signal for the headline, every 336-hour chunk, pagination, and RPC", async () => {
    const ids = Array.from({ length: 50 }, (_, index) => `beach-${index}`);
    const response = await GET(request("hourly",
      `beachIds=${ids}&timelineBeachIds=${ids.slice(0, 20)}&timeline=hourly&timelineHours=336&includeConditions=true`));
    expect(response.status).toBe(200);
    // 113 anchors per beach allow eight beaches per chunk below PostgREST's row cap.
    expect(mockFrom).toHaveBeenCalledTimes(5);
    expect(mockRpc).toHaveBeenCalledTimes(1);
    const signals = mockQueries.map((query) => query.signal);
    expect(signals).toHaveLength(6);
    expect(signals[0]).toBeInstanceOf(AbortSignal);
    expect(signals.every((signal) => signal === signals[0])).toBe(true);
    expect(signals[0]?.aborted).toBe(false);
  });

  it("returns 503 at the deadline, aborts every query, and stops before the RPC", async () => {
    mockPendingForecasts = true;
    const pending = GET(request("deadline", "beachIds=beach-1,,%20beach-2%20,beach-3&timeline=hourly&timelineHours=336"));
    expect(AbortSignal.timeout).toHaveBeenCalledWith(FORECAST_BULK_DEADLINE_MS);
    jest.advanceTimersByTime(1234);
    const response = await pending;
    expect(response.status).toBe(503);
    expect(response.headers.get("Retry-After")).toBe("5");
    expect(await response.json()).toMatchObject({ success: false, reason: "deadline", retryAfter: 5 });
    expect(console.warn).toHaveBeenCalledWith("[forecast-bulk:shed]", { reason: "deadline", ip: "deadline", beachCount: 3, elapsedMs: 1234 });
    expect(mockQueries).toHaveLength(3);
    expect(mockQueries.every((query) => query.aborted && query.signal?.aborted)).toBe(true);
    expect(mockRpc).not.toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
    mockPendingForecasts = false;
    expect((await GET(request("deadline"))).status).toBe(200);
  });

  it("aborts a pending RPC at the deadline", async () => {
    mockPendingRpc = true;
    const pending = GET(request("rpc-deadline"));
    await jest.advanceTimersByTimeAsync(0);
    expect(mockRpc).toHaveBeenCalledTimes(1);
    expect((await pending).status).toBe(503);
    const rpc = mockQueries.find((query) => query.source === "rpc");
    expect(rpc?.signal).toBe(mockQueries[0].signal);
    expect(rpc?.aborted).toBe(true);
    await jest.advanceTimersByTimeAsync(0);
    expect(console.error).not.toHaveBeenCalled();
  });

  it("stops work on client abort", async () => {
    mockPendingForecasts = true;
    const controller = new AbortController();
    const req = request("client-abort", "beachIds=beach-1", controller.signal);
    const pending = GET(req);
    controller.abort();
    const response = await pending;
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ reason: "deadline" });
    await jest.advanceTimersByTimeAsync(0);
    expect(mockQueries).toHaveLength(1);
    expect(mockQueries[0].aborted).toBe(true);
    expect(mockRpc).not.toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
  });

  it("does no database work when the client already disconnected", async () => {
    const controller = new AbortController();
    controller.abort();
    const response = await GET(request("gone", "beachIds=beach-1", controller.signal));
    expect(response.status).toBe(503);
    expect(mockFrom).not.toHaveBeenCalled();
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("releases slots after an ordinary database failure", async () => {
    mockRpc.mockImplementationOnce(() => mockQuery("rpc", null, false));
    expect((await GET(request("failure"))).status).toBe(500);
    mockPendingForecasts = true;
    const active = Array.from({ length: FORECAST_BULK_MAX_INFLIGHT_PER_IP }, () => GET(request("failure")));
    mockQueries.forEach((query) => query.complete());
    expect((await Promise.all(active)).map((response) => response.status)).toEqual(Array(6).fill(200));
  });

  it("releases slots when auth fails before the handler", async () => {
    mockAuth.mockImplementationOnce(() => { throw new Error("Auth failed"); });
    expect((await GET(request("auth-failure"))).status).toBe(503);
    expect(mockFrom).not.toHaveBeenCalled();
    mockPendingForecasts = true;
    const active = Array.from({ length: FORECAST_BULK_MAX_INFLIGHT_PER_IP }, () => GET(request("auth-failure")));
    mockQueries.forEach((query) => query.complete());
    expect((await Promise.all(active)).map((response) => response.status)).toEqual(Array(6).fill(200));
  });

  it("bootstrap bypasses bulk slots when its IP is at capacity", async () => {
    mockPendingForecasts = true;
    const active = Array.from({ length: FORECAST_BULK_MAX_INFLIGHT_PER_IP }, () => GET(request("bootstrap")));
    const pending = bootstrap(new NextRequest("http://localhost/api/map/bootstrap?lat=32&lon=-117", {
      headers: { "x-vercel-forwarded-for": "bootstrap" },
    }));
    await jest.advanceTimersByTimeAsync(0);
    expect(mockFrom).toHaveBeenCalledTimes(FORECAST_BULK_MAX_INFLIGHT_PER_IP + 1);
    mockQueries[FORECAST_BULK_MAX_INFLIGHT_PER_IP].complete();
    const response = await pending;
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ data: { beaches: [{ id: "beach-1" }], forecast: { success: true } } });
    mockQueries.forEach((query) => query.complete());
    await Promise.all(active);
  });

  it.each(["deadline", "client abort"])("bootstrap returns forecast: null on %s", async (cause) => {
    mockPendingForecasts = true;
    const controller = new AbortController();
    const pending = bootstrap(new NextRequest("http://localhost/api/map/bootstrap?lat=32&lon=-117", { signal: controller.signal }));
    await jest.advanceTimersByTimeAsync(0);
    if (cause === "client abort") controller.abort();
    const response = await pending;
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ data: { forecast: null } });
    expect(mockQueries[0].aborted).toBe(true);
    expect(mockRpc).not.toHaveBeenCalled();
  });
});
