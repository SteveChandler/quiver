/** @jest-environment node */
import type { TideStationRow } from "@/lib/tide-stations/types";

let mockStoredRows: Array<{ station_id: string; kind: string; ts: string; height_m: number }> = [];
let mockStoredError: { message: string } | null = null;
jest.mock("@/lib/supabase/server", () => ({
  createPublicReadClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          gte: () => ({
            lte: () => ({ order: async () => ({ data: mockStoredRows, error: mockStoredError }) }),
          }),
        }),
      }),
    }),
  }),
}));

const mockDataCache = new Map<string, unknown>();
const mockCacheOptions: Array<{ revalidate?: number | false }> = [];
jest.mock("next/cache", () => ({
  unstable_cache: (load: () => Promise<unknown>, keys: string[], options: { revalidate?: number | false }) => async () => {
    mockCacheOptions.push(options);
    const key = `${load.toString()}-${JSON.stringify(keys)}`;
    if (mockDataCache.has(key)) return JSON.parse(JSON.stringify(mockDataCache.get(key)));
    const value = await load();
    mockDataCache.set(key, JSON.parse(JSON.stringify(value)));
    return value;
  },
}));

const NOW = Date.parse("2026-11-15T12:00:00Z");
const HOUR = 3_600_000;
const station = {
  id: "noaa:test", source: "noaa", source_station_id: "test",
  station_kind: "reference", reference_station_id: null,
} as TideStationRow;
let getStationSeries: typeof import("@/lib/tide-stations/predictions").getStationSeries;
const mockFetch = jest.fn();

function reload(): void {
  jest.resetModules();
  getStationSeries = require("@/lib/tide-stations/predictions").getStationSeries;
}

function goodResponse(url: string): Promise<Response> {
  const params = new URL(url).searchParams;
  const date = (key: string): number => {
    const s = params.get(key)!;
    return Date.parse(`${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}T00:00:00Z`);
  };
  const start = date("begin_date");
  const end = date("end_date") + 23 * HOUR;
  const step = params.get("interval") === "h" ? HOUR : 6 * HOUR;
  return Promise.resolve(new Response(JSON.stringify({
    predictions: Array.from({ length: Math.floor((end - start) / step) + 1 }, (_, i) => ({
      t: new Date(start + i * step).toISOString(), v: "1.2", type: i % 2 ? "L" : "H",
    })),
  })));
}

beforeEach(() => {
  mockStoredRows = [];
  mockStoredError = null;
  mockDataCache.clear();
  mockCacheOptions.length = 0;
  mockFetch.mockReset().mockImplementation(goodResponse);
  global.fetch = mockFetch;
  jest.spyOn(console, "warn").mockImplementation(() => undefined);
  reload();
});

it("serves covering raw rows with the current California adjustment and never calls NOAA", async () => {
  const california = { ...station, source_station_id: "9410230", id: "noaa:9410230" };
  const start = NOW - 3 * 24 * HOUR;
  mockStoredRows = Array.from({ length: 15 * 24 }, (_, index) => {
    const ts = new Date(start + index * HOUR).toISOString();
    return [
      { station_id: california.id, kind: "hourly", ts, height_m: 1 },
      ...(index % 6 === 0 ? [{ station_id: california.id, kind: index % 12 === 0 ? "high" : "low", ts, height_m: 1 }] : []),
    ];
  }).flat();
  const result = await getStationSeries(california, NOW, "beach-page");
  expect(result.status).toBe("ok");
  if (result.status !== "ok") throw new Error("Expected stored tides");
  expect(result.adjustmentFt).toBe(1.5);
  expect(result.extremes[0].heightM).toBe(1.457);
  expect(result.hourly[0].heightM).toBe(1.457);
  expect(mockCacheOptions).toHaveLength(0);
  expect(mockFetch).not.toHaveBeenCalled();
});

it("uses live NOAA when stored rows do not cover the window", async () => {
  mockStoredRows = [{ station_id: station.id, kind: "high", ts: new Date(NOW).toISOString(), height_m: 1 }];
  jest.mocked(console.warn).mockClear();
  const result = await getStationSeries(station, NOW, "beach-page");
  expect(result.status).toBe("ok");
  expect(mockFetch).toHaveBeenCalled();
  expect(console.warn).toHaveBeenCalledWith("Beach tide stored coverage fallback", {
    stationId: station.id,
    outcome: "live-noaa",
  });
});

it.each(["reference", "subordinate"] as const)(
  "reuses a covering %s snapshot for a beach page before asking NOAA",
  async (stationKind) => {
    const target = { ...station, station_kind: stationKind, reference_station_id: "9410230" };
    const previous = await getStationSeries(target, NOW);
    expect(previous).toMatchObject({ status: "ok", adjustmentFt: 1.5 });
    reload();
    mockFetch.mockClear().mockRejectedValue(new Error("snapshot should avoid network"));
    jest.mocked(console.warn).mockClear();

    const result = await getStationSeries(target, NOW + 13 * HOUR, "beach-page");
    expect(mockFetch).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledWith("Beach tide stored coverage fallback", {
      stationId: target.id,
      outcome: "snapshot",
    });
    if (result.status !== "ok" || previous.status !== "ok") throw new Error("Expected covering predictions");
    expect(result.windowStart).toBe(new Date(NOW - 11 * HOUR).toISOString());
    expect(result.adjustmentFt).toBe(previous.adjustmentFt);
    expect(result.extremes.find((point) => point.ts === previous.extremes[8].ts)).toEqual(previous.extremes[8]);
    expect(result.hourly.length > 0).toBe(stationKind === "reference");
  },
);

it("does not reuse a snapshot for a different datum adjustment", async () => {
  const modulePath = "@/lib/services/noaa-coops/api-client";
  const offset = jest.fn().mockReturnValue(0);
  jest.doMock(modulePath, () => ({ ...jest.requireActual(modulePath), seaLevelOffsetFt: offset }));
  try {
    reload();
    expect(await getStationSeries(station, NOW)).toMatchObject({ status: "ok", adjustmentFt: 0 });
    offset.mockReturnValue(1.5);
    reload();
    mockFetch.mockClear();

    const result = await getStationSeries(station, NOW, "beach-page");
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({ status: "ok", adjustmentFt: 1.5 });
  } finally {
    jest.dontMock(modulePath);
  }
});

it("keeps the default live NOAA lookup and deadline even when a covering snapshot exists", async () => {
  const target = { ...station, station_kind: "subordinate" } as const;
  expect(await getStationSeries(target, NOW)).toMatchObject({ status: "ok" });
  reload();
  mockFetch.mockClear();
  const timeout = jest.spyOn(AbortSignal, "timeout");
  try {
    expect(await getStationSeries(target, NOW)).toMatchObject({ status: "ok" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(timeout).toHaveBeenCalledWith(20_000);
  } finally {
    timeout.mockRestore();
  }
});

it.each(["beach-page", undefined] as const)(
  "fetches a reference curve on the next beach render after an incomplete %s read",
  async (firstPurpose) => {
    mockFetch.mockImplementation((url: string) =>
      new URL(url).searchParams.get("interval") === "h"
        ? Promise.reject(new DOMException("NOAA deadline elapsed", "TimeoutError"))
        : goodResponse(url),
    );
    const incomplete = await getStationSeries(station, NOW, firstPurpose);
    expect(incomplete).toMatchObject({ status: "ok", hourly: [] });
    expect(mockDataCache.size).toBe(1);
    mockFetch.mockImplementation(goodResponse);
    mockFetch.mockClear();

    const recovered = await getStationSeries(station, NOW, "beach-page");
    if (recovered.status !== "ok") throw new Error("Expected reference station predictions");
    expect(recovered.hourly).toHaveLength(241);
    const requestedIntervals = mockFetch.mock.calls.map(([url]) => new URL(url).searchParams.get("interval"));
    expect(requestedIntervals).toContain("h");

    reload();
    mockFetch.mockClear().mockRejectedValue(new Error("the recovered snapshot should avoid NOAA"));
    await expect(getStationSeries(station, NOW, "beach-page")).resolves.toEqual(recovered);
    expect(mockFetch).not.toHaveBeenCalled();
  },
);

it("uses live NOAA after a stored-row Supabase result error", async () => {
  mockStoredError = { message: "database unavailable" };
  const result = await getStationSeries(station, NOW);
  expect(result.status).toBe("ok");
  expect(mockFetch).toHaveBeenCalled();
});

it.each(["beach-page", undefined] as const)(
  "rescues a beach page with covering high and low times from a prior %s read after live NOAA fails",
  async (firstPurpose) => {
    jest.mocked(console.warn).mockClear();
    mockFetch.mockImplementation((url: string) =>
      new URL(url).searchParams.get("interval") === "h"
        ? Promise.reject(new Error("hourly predictions unavailable"))
        : goodResponse(url),
    );
    const partial = await getStationSeries(station, NOW, firstPurpose);
    expect(partial).toMatchObject({ status: "ok", hourly: [] });
    const initialOutcomes = jest.mocked(console.warn).mock.calls
      .filter(([message]) => message === "Beach tide stored coverage fallback")
      .map(([, details]) => details);
    expect(initialOutcomes).toEqual(firstPurpose === "beach-page"
      ? [{ stationId: station.id, outcome: "live-noaa-extrema-only" }]
      : []);

    reload();
    mockFetch.mockClear().mockRejectedValue(new DOMException("NOAA deadline elapsed", "TimeoutError"));
    jest.mocked(console.warn).mockClear();
    await expect(getStationSeries(station, NOW, "beach-page")).resolves.toEqual(partial);
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(console.warn).toHaveBeenCalledWith("Beach tide stored coverage fallback", {
      stationId: station.id,
      outcome: "snapshot-after-noaa-error",
    });
    expect(console.warn).not.toHaveBeenCalledWith("Beach tide stored coverage fallback", {
      stationId: station.id,
      outcome: "snapshot",
    });
  },
);

it.each(["reference", "subordinate"] as const)("persists a covering last-good %s series across module reload and UTC rollover", async (kind) => {
  const s = { ...station, station_kind: kind };
  const good = await getStationSeries(s, NOW);
  expect(good.status).toBe("ok");
  reload();
  mockFetch.mockRejectedValue(new TypeError("fetch failed"));
  const result = await getStationSeries(s, NOW + 13 * HOUR);
  expect(result.status).toBe("ok");
  if (result.status !== "ok" || good.status !== "ok") throw new Error("Expected real tides");
  expect(result.extremes.length).toBeGreaterThan(20);
  expect(result.extremes.every((p) => p.heightM === 1.2)).toBe(true);
  expect(result.windowStart).toBe(new Date(NOW + 13 * HOUR - 24 * HOUR).toISOString());
  expect(mockCacheOptions.length).toBeGreaterThan(0);
  expect(mockCacheOptions.every((o) => o.revalidate === false || (o.revalidate ?? 0) >= 43200)).toBe(true);
});

it("rejects last-good data whose requested window has expired", async () => {
  await getStationSeries(station, NOW);
  expect(mockDataCache.size).toBeGreaterThan(0);
  reload();
  const failure = new TypeError("fetch failed");
  mockFetch.mockRejectedValue(failure);
  await expect(getStationSeries(station, NOW + 3 * 24 * HOUR)).rejects.toThrow("fetch failed");
});

it("rejects a snapshot when the actual predictions no longer cover the window", async () => {
  await getStationSeries(station, NOW);
  expect(mockDataCache.size).toBeGreaterThan(0);
  for (const value of mockDataCache.values()) {
    const series = value as { extremes: Array<{ ts: string }>; hourly: Array<{ ts: string }> };
    series.extremes = series.extremes.filter((p) => Date.parse(p.ts) < NOW);
    series.hourly = series.hourly.filter((p) => Date.parse(p.ts) < NOW);
  }
  reload();
  mockFetch.mockResolvedValue(new Response("{}", { status: 403 }));
  mockFetch.mockClear();
  await expect(getStationSeries(station, NOW, "beach-page")).rejects.toThrow("NOAA tide failed: 403");
  expect(mockFetch).toHaveBeenCalled();
});

it("keeps throwing on a cold cache when NOAA is unavailable", async () => {
  mockFetch.mockRejectedValue(new TypeError("fetch failed"));
  await expect(getStationSeries(station, NOW)).rejects.toThrow("fetch failed");
  expect(mockDataCache.size).toBe(0);
  expect(mockCacheOptions.length).toBeGreaterThan(0);
});

it.each(["headers", "body"])("aborts a beach page NOAA request stalled at the %s without canceling the API", async (stage) => {
  const deadline = new AbortController();
  const timeout = jest.spyOn(AbortSignal, "timeout").mockImplementation((ms) =>
    ms === 1_500 ? deadline.signal : new AbortController().signal,
  );
  const target = { ...station, station_kind: "subordinate" } as const;
  let started!: () => void;
  const beachRequestStarted = new Promise<void>((resolve) => { started = resolve; });
  let releaseApi!: () => void;
  const apiCanRespond = new Promise<void>((resolve) => { releaseApi = resolve; });
  mockFetch.mockImplementation((url: string, init?: RequestInit) => {
    if (init?.signal !== deadline.signal) return apiCanRespond.then(() => goodResponse(url));
    const stalled = new Promise<never>((_, reject) => {
      deadline.signal.addEventListener("abort", () => reject(deadline.signal.reason), { once: true });
    });
    started();
    return stage === "headers" ? stalled : Promise.resolve({ ok: true, json: () => stalled });
  });
  try {
    const beach = getStationSeries(target, NOW, "beach-page");
    await beachRequestStarted;
    const api = getStationSeries(target, NOW);
    await new Promise<void>((resolve) => setImmediate(resolve));
    deadline.abort(new DOMException("NOAA deadline elapsed", "TimeoutError"));
    await expect(beach).rejects.toMatchObject({ name: "NoaaTideRequestError" });
    releaseApi();
    await expect(api).resolves.toMatchObject({ status: "ok" });
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(timeout.mock.calls).toEqual([[1_500], [20_000]]);
  } finally {
    releaseApi();
    timeout.mockRestore();
  }
});

it("propagates a parsing error even if the NOAA deadline has expired", async () => {
  const deadline = new AbortController();
  const timeout = jest.spyOn(AbortSignal, "timeout").mockReturnValue(deadline.signal);
  const bug = new SyntaxError("invalid NOAA response");
  mockFetch.mockResolvedValue({
    ok: true,
    json: async () => {
      deadline.abort(new DOMException("NOAA deadline elapsed", "TimeoutError"));
      throw bug;
    },
  });
  try {
    const target = { ...station, station_kind: "subordinate" } as const;
    await expect(getStationSeries(target, NOW, "beach-page")).rejects.toBe(bug);
  } finally {
    timeout.mockRestore();
  }
});

it.each(["h", "hilo"])("does not swallow an unrelated TypeError while parsing %s, even with a last-good snapshot", async (interval) => {
  await getStationSeries(station, NOW);
  expect(mockDataCache.size).toBeGreaterThan(0);
  reload();
  const bug = new TypeError("broken parser");
  mockFetch.mockImplementation((url: string) => new URL(url).searchParams.get("interval") === interval
    ? Promise.resolve({ ok: true, json: async () => { throw bug; } }) : goodResponse(url));
  await expect(getStationSeries(station, NOW)).rejects.toBe(bug);
});

it("does not replace a real NOAA empty answer with last-good predictions", async () => {
  await getStationSeries(station, NOW);
  expect(mockDataCache.size).toBeGreaterThan(0);
  reload();
  mockFetch.mockImplementation(async () => new Response(JSON.stringify({ predictions: [] })));
  await expect(getStationSeries(station, NOW)).resolves.toEqual({ status: "failed", reason: "noaa-empty" });
});

it("round-trips through Next's real data cache without lowering the 12-hour ISR window", async () => {
  const runtime = globalThis as typeof globalThis & {
    AsyncLocalStorage?: typeof import("node:async_hooks").AsyncLocalStorage;
    __incrementalCache?: unknown;
  };
  const previousStorage = runtime.AsyncLocalStorage;
  const previousCache = runtime.__incrementalCache;
  const entries = new Map<string, unknown>();
  runtime.AsyncLocalStorage = require("node:async_hooks").AsyncLocalStorage;
  const incrementalCache = {
    generateSimpleCacheKey: async (key: string): Promise<string> => key,
    get: async (key: string): Promise<unknown> => entries.get(key) ?? null,
    set: async (key: string, value: unknown): Promise<void> => { entries.set(key, { value, isStale: false }); },
  };
  runtime.__incrementalCache = incrementalCache;
  jest.doMock("next/cache", () => jest.requireActual("next/cache"));
  try {
    reload();
    const { workAsyncStorage } = require("next/dist/server/app-render/work-async-storage.external");
    const { workUnitAsyncStorage } = require("next/dist/server/app-render/work-unit-async-storage.external");
    const render = { type: "prerender-legacy", revalidate: 43200, tags: null };
    const work = { incrementalCache, route: "/tides/station/[slug]" };
    await workAsyncStorage.run(work, () => workUnitAsyncStorage.run(render, () => getStationSeries(station, NOW)));
    expect(entries.size).toBe(1);
    expect(render.revalidate).toBe(43200);
    reload();
    mockFetch.mockRejectedValue(new TypeError("fetch failed"));
    await expect(getStationSeries(station, NOW + 13 * HOUR)).resolves.toMatchObject({ status: "ok" });
    expect(entries.size).toBe(1);
  } finally {
    runtime.AsyncLocalStorage = previousStorage;
    runtime.__incrementalCache = previousCache;
  }
});
