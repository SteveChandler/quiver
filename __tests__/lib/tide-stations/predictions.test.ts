/** @jest-environment node */
import type { TideStationRow } from "@/lib/tide-stations/types";

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
  mockDataCache.clear();
  mockCacheOptions.length = 0;
  mockFetch.mockReset().mockImplementation(goodResponse);
  global.fetch = mockFetch;
  jest.spyOn(console, "warn").mockImplementation(() => undefined);
  reload();
});

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
  await expect(getStationSeries(station, NOW)).rejects.toThrow();
});

it("keeps throwing on a cold cache when NOAA is unavailable", async () => {
  mockFetch.mockRejectedValue(new TypeError("fetch failed"));
  await expect(getStationSeries(station, NOW)).rejects.toThrow("fetch failed");
  expect(mockDataCache.size).toBe(0);
  expect(mockCacheOptions.length).toBeGreaterThan(0);
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
