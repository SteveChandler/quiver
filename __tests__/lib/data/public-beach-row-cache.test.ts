/** @jest-environment node */

import { unstable_cache } from "next/cache";
import {
  publicBeachRowCacheWindow,
  readPublicBeachRowsForIds,
} from "@/lib/data/server/public-beach-row-cache";
import {
  memoizedBeachRowsRead,
  memoizedWaterQualityRead,
  runWithPublicWaterQualityReadScope,
  runWithWaterQualityReadScope,
} from "@/lib/recommendations/major-event-hold/read-scope";
import { createPublicReadClient, createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { readBeachPoints } from "@/lib/services/water-quality/county-coverage";
import { expectConsoleErrors, expectConsoleWarnings } from "@/__tests__/setup/test-utils";

jest.mock("next/cache", () => ({ unstable_cache: jest.fn() }));
jest.mock("@supabase/supabase-js", () => ({ createClient: jest.fn(() => ({ from: jest.fn() })) }));

const start = new Date("2026-11-23T12:00:00Z");
const rows = [{ beach_id: "beach-a", status: "good" }];
const result = <T,>(data: T): { data: T; error: null } => ({ data, error: null });
const valid = (data: unknown): boolean => Array.isArray(data) && data.every(
  (item) => typeof item?.beach_id === "string" && typeof item?.status === "string",
);
const nextCache = jest.mocked(unstable_cache);

beforeEach(() => {
  jest.useFakeTimers({ now: start });
  jest.replaceProperty(process, "env", { ...process.env });
  delete process.env.PUBLIC_BEACH_ROW_CACHE;
  delete process.env.PUBLIC_READ_SHARING;

  const entries = new Map<string, unknown>();
  nextCache.mockReset().mockImplementation((load, key, options) => async (...args) => {
    expect(options?.tags).toContain("public-beach-rows");
    const cacheKey = JSON.stringify([key, args]);
    if (entries.has(cacheKey)) return entries.get(cacheKey);
    const value = await load(...args);
    entries.set(cacheKey, JSON.parse(JSON.stringify(value)));
    return value;
  });
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

it.each(["county_beach_advisory_runs", "county_beach_advisories", "rain_advisory_events"])(
  "reuses %s across public renders and reads again after 300 seconds",
  async (table) => {
    const client = createSupabaseServiceRoleClient();
    const load = jest.fn(async () => result(rows));
    const render = (): Promise<unknown> => runWithPublicWaterQualityReadScope(() =>
      memoizedWaterQualityRead(client, table, load, { isValid: valid }),
    );
    await render();
    await render();
    expect(load).toHaveBeenCalledTimes(1);
    expect(nextCache).toHaveBeenCalledWith(expect.any(Function), expect.any(Array),
      expect.objectContaining({ revalidate: 300 }));
    jest.advanceTimersByTime(300_000);
    await render();
    expect(load).toHaveBeenCalledTimes(2);
  },
);

it.each(["water_quality_held_beaches", "beach_water_quality"])(
  "reads %s once for different beach lists and projects rows by beach",
  async (table) => {
    const client = createSupabaseServiceRoleClient();
    const allRows = [{ beach_id: "beach-a", status: "good" }, { beach_id: "beach-b", status: "unknown" }];
    const all = jest.fn(async () => result(allRows));
    const firstDirect = jest.fn(async () => result([allRows[0]]));
    const secondDirect = jest.fn(async () => result([allRows[1]]));
    const read = (ids: string[], load: () => Promise<unknown>): Promise<unknown> =>
      memoizedBeachRowsRead(client, table, ids, load as () => PromiseLike<{ data: unknown; error: unknown }>, {
        load: all as () => PromiseLike<{ data: unknown; error: unknown }>,
        isValid: valid,
      });

    const first = await runWithPublicWaterQualityReadScope(() => read(["beach-a"], firstDirect));
    const second = await runWithPublicWaterQualityReadScope(() => read(["beach-b"], secondDirect));
    expect(first).toEqual(result([allRows[0]]));
    expect(second).toEqual(result([allRows[1]]));
    expect(all).toHaveBeenCalledTimes(1);
    expect(firstDirect).not.toHaveBeenCalled();
    expect(secondDirect).not.toHaveBeenCalled();
  },
);

it("reads narrow beaches columns once across different beach-id lists", async () => {
  const client = createSupabaseServiceRoleClient();
  const allRows = [
    { id: "beach-a", lat: 32.8, lon: -117.2 },
    { id: "beach-b", lat: 33, lon: -117.3 },
  ];
  const all = jest.fn(async () => result(allRows));
  const direct = jest.fn(async (ids: string[]) => result(allRows.filter((row) => ids.includes(row.id))));
  const read = (ids: string[]): Promise<unknown> => runWithPublicWaterQualityReadScope(() =>
    readPublicBeachRowsForIds<typeof allRows[number], unknown>(
      client,
      "beaches|id, lat, lon",
      900,
      ids,
      (row: typeof allRows[number]) => row.id,
      all,
      () => direct(ids),
      (data) => Array.isArray(data) && data.every((row) =>
        typeof row.id === "string" && typeof row.lat === "number" && typeof row.lon === "number",
      ),
      1,
    ),
  );

  await expect(read(["beach-a"])).resolves.toEqual({ data: [allRows[0]], error: null });
  await expect(read(["beach-b"])).resolves.toEqual({ data: [allRows[1]], error: null });
  expect(all).toHaveBeenCalledTimes(1);
  expect(direct).not.toHaveBeenCalled();
  expect(nextCache).toHaveBeenCalledWith(expect.any(Function), expect.any(Array),
    expect.objectContaining({ revalidate: 900 }));
});

it.each([
  ["non-array", { malformed: true }],
  ["empty", []],
])("does not cache a %s County beaches read and retries the whole-table read", async (_case, badData) => {
  const client = createSupabaseServiceRoleClient();
  const point = { id: "65809772-20bc-4009-b9b2-89c8ef3c4127", lat: 32.8, lon: -117.2 };
  const reads: Array<{ filtered: boolean }> = [];
  const mockClient = client as unknown as { from: jest.Mock };
  mockClient.from.mockImplementation(() => {
    const state = { filtered: false };
    reads.push(state);
    const query = {
      select: jest.fn(),
      in: jest.fn(),
      then: (resolve: (value: unknown) => unknown) => Promise.resolve(
        state.filtered ? result([point]) : result(badData),
      ).then(resolve),
    };
    query.select.mockReturnValue(query);
    query.in.mockImplementation(() => {
      state.filtered = true;
      return query;
    });
    return query;
  });
  const render = (): Promise<Map<string, { lat: number | null; lon: number | null }> | null> =>
    runWithPublicWaterQualityReadScope(() => readBeachPoints(client as never, [point.id], "test"));

  await expect(render()).resolves.toEqual(new Map([[point.id, { lat: point.lat, lon: point.lon }]]));
  await expect(render()).resolves.toEqual(new Map([[point.id, { lat: point.lat, lon: point.lon }]]));
  expect(reads.filter((read) => !read.filtered)).toHaveLength(2);
  expect(reads.filter((read) => read.filtered)).toHaveLength(2);
  expectConsoleWarnings([/public-beach-row-cache/]);
});

it("keeps a null County beaches response fail-closed outside the public scope", async () => {
  const client = createSupabaseServiceRoleClient();
  const mockClient = client as unknown as { from: jest.Mock };
  const query = {
    select: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    then: (resolve: (value: unknown) => unknown) => Promise.resolve(result(null)).then(resolve),
  };
  mockClient.from.mockReturnValue(query);

  await expect(readBeachPoints(client as never, ["65809772-20bc-4009-b9b2-89c8ef3c4127"], "test"))
    .resolves.toBeNull();
  expectConsoleErrors([/^test /]);
  expect(mockClient.from).toHaveBeenCalledWith("beaches");
  expect(query.select).toHaveBeenCalledWith("id, lat, lon");
  expect(query.in).toHaveBeenCalledWith("id", ["65809772-20bc-4009-b9b2-89c8ef3c4127"]);
  expect(nextCache).not.toHaveBeenCalled();
});

it.each([
  ["malformed row", [{ id: "beach-a", lat: "32.8", lon: -117.2 }]],
  ["duplicate row", [{ id: "beach-a", lat: 32.8, lon: -117.2 }, { id: "beach-a", lat: 32.9, lon: -117.3 }]],
  ["case-insensitive duplicate row", [{ id: "beach-a", lat: 32.8, lon: -117.2 }, { id: "BEACH-A", lat: 32.9, lon: -117.3 }]],
  ["PostgREST cap", Array.from({ length: 1000 }, (_, index) => ({ id: String(index), lat: 1, lon: 2 }))],
])("falls back to the filtered query after a %s whole-table read", async (_case, allRows) => {
  const client = createSupabaseServiceRoleClient();
  const all = jest.fn(async () => result(allRows));
  const direct = jest.fn(async () => result([{ id: "beach-a", lat: 32.8, lon: -117.2 }]));
  const render = (): Promise<unknown> => runWithPublicWaterQualityReadScope(() =>
    readPublicBeachRowsForIds<{ id: string; lat: unknown; lon: unknown }, unknown>(
      client, "beaches|id,lat,lon", 900, ["beach-a"],
      (row: { id: string }) => row.id,
      all,
      direct,
      (data) => Array.isArray(data) && data.every((row) =>
        typeof row.id === "string" && typeof row.lat === "number" && typeof row.lon === "number",
      ),
    ),
  );

  await expect(render()).resolves.toEqual(result([{ id: "beach-a", lat: 32.8, lon: -117.2 }]));
  await expect(render()).resolves.toEqual(result([{ id: "beach-a", lat: 32.8, lon: -117.2 }]));
  expect(all).toHaveBeenCalledTimes(2);
  expect(direct).toHaveBeenCalledTimes(2);
  expectConsoleWarnings([/\[public-beach-row-cache\] not cached/]);
});

it("returns a whole-table database error without issuing the filtered read", async () => {
  const client = createSupabaseServiceRoleClient();
  const failure = { code: "57014", message: "statement timeout" };
  const all = jest.fn(async () => ({ data: null, error: failure }));
  const direct = jest.fn(async () => result([{ id: "beach-a", lat: 1, lon: 2 }]));
  const render = (): Promise<unknown> => runWithPublicWaterQualityReadScope(() =>
    readPublicBeachRowsForIds(client, "beaches|id,lat,lon", 900, ["beach-a"],
      (row: { id: string }) => row.id, all, direct, Array.isArray, 1),
  );

  await expect(render()).resolves.toEqual({ data: null, error: failure });
  await expect(render()).resolves.toEqual({ data: null, error: failure });
  expect(all).toHaveBeenCalledTimes(2);
  expect(direct).not.toHaveBeenCalled();
});

it("does not cache a started latest County run and retries until completed", async () => {
  const { readLatestCountyRun } = await import("@/lib/services/water-quality/current-status");
  const client = createSupabaseServiceRoleClient();
  const uuid = "9911e905-2e5f-42f7-b47f-10777220ccb2";
  const completed = {
    id: uuid, status: "completed", source_identifier: "county-san-diego-dehq-sdbeachinfo",
    fetched_at: start.toISOString(), advisory_count: 0, closure_count: 0, warning_count: 0,
  };
  const started = { ...completed, status: "started" };
  const responses = [started, started, completed];
  const mockClient = client as unknown as { from: jest.Mock };
  mockClient.from.mockImplementation(() => {
    const query = { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(), limit: jest.fn().mockReturnThis(),
      then: (resolve: (value: unknown) => unknown) => Promise.resolve(result([responses.shift()])).then(resolve) };
    return query;
  });
  const render = (): Promise<unknown> => runWithPublicWaterQualityReadScope(() => readLatestCountyRun(client as never));

  await expect(render()).resolves.toMatchObject({ data: [started] });
  await expect(render()).resolves.toMatchObject({ data: [completed] });
  expect(nextCache).toHaveBeenCalledTimes(2);
  expectConsoleWarnings([/public-beach-row-cache/]);
});

it("uses stable but staggered per-key cache windows", () => {
  const ttlMs = 300_000;
  const now = Date.parse("2026-11-23T12:00:00Z");
  const nextBoundary = (key: string): number => {
    const initial = publicBeachRowCacheWindow(key, ttlMs, now);
    let low = now;
    let high = now + ttlMs;
    while (low + 1 < high) {
      const middle = Math.floor((low + high) / 2);
      if (publicBeachRowCacheWindow(key, ttlMs, middle) === initial) low = middle;
      else high = middle;
    }
    return high;
  };
  const first = nextBoundary("county-run");
  const second = nextBoundary("beach-points");
  expect(first).not.toBe(second);
  expect(publicBeachRowCacheWindow("county-run", ttlMs, now + 1)).toBe(
    publicBeachRowCacheWindow("county-run", ttlMs, now + 2),
  );
});

it("does not cache an errored water-quality read or issue a second database read", async () => {
  const client = createSupabaseServiceRoleClient();
  const badResult = { data: null, error: { code: "503" } };
  const load = jest.fn(async (): Promise<{ data: unknown; error: unknown }> => badResult);
  const render = (): Promise<unknown> => runWithPublicWaterQualityReadScope(() =>
    memoizedWaterQualityRead(client, "latest-run", load, { isValid: valid }),
  );
  await expect(render()).resolves.toEqual(badResult);
  expect(load).toHaveBeenCalledTimes(1);
  await render();
  expect(load).toHaveBeenCalledTimes(2);
});

it("falls back after a successful malformed water-quality read and retries cache next time", async () => {
  const client = createSupabaseServiceRoleClient();
  const malformed = result([{ beach_id: "beach-a" }]);
  const load = jest.fn(async (): Promise<{ data: unknown; error: unknown }> => malformed);
  const render = (): Promise<unknown> => runWithPublicWaterQualityReadScope(() =>
    memoizedWaterQualityRead(client, "malformed-table", load, { isValid: valid }),
  );
  await expect(render()).resolves.toEqual(malformed);
  expect(load).toHaveBeenCalledTimes(2);
  await render();
  expect(load).toHaveBeenCalledTimes(4);
  expectConsoleWarnings([/public-beach-row-cache/]);
});

it("does not retry unrelated exceptions through the cached-read fallback", async () => {
  const client = createSupabaseServiceRoleClient();
  const error = new TypeError("broken query");
  const load = jest.fn().mockRejectedValue(error);
  await expect(runWithPublicWaterQualityReadScope(() =>
    memoizedWaterQualityRead(client, "latest-run", load, { isValid: valid }),
  )).rejects.toBe(error);
  expect(nextCache).toHaveBeenCalledTimes(1);
  expect(load).toHaveBeenCalledTimes(1);
});

it("keeps ordinary scopes, no scope, signed-in clients and the off flag on direct reads", async () => {
  const client = createSupabaseServiceRoleClient();
  const userClient = { auth: { getSession: async () => ({ data: { session: { access_token: "user-token" } } }) } };
  const load = jest.fn(async () => result(rows));
  const read = (reader = client as object): Promise<unknown> =>
    memoizedWaterQualityRead(reader, "latest-run", load, { isValid: valid });

  await read();
  await runWithWaterQualityReadScope(() => read());
  await runWithPublicWaterQualityReadScope(() => runWithWaterQualityReadScope(() => read()));
  await runWithPublicWaterQualityReadScope(() => read(userClient));
  process.env.PUBLIC_BEACH_ROW_CACHE = "false";
  await runWithPublicWaterQualityReadScope(() => read());
  expect(load).toHaveBeenCalledTimes(5);
  expect(nextCache).not.toHaveBeenCalled();
});

it("keeps anon and service-role rows in separate cache entries", async () => {
  process.env.PUBLIC_READ_SHARING = "false";
  const anon = createPublicReadClient();
  const service = createSupabaseServiceRoleClient();
  const anonLoad = jest.fn(async () => result([]));
  const serviceLoad = jest.fn(async () => result(rows));
  for (let render = 0; render < 2; render++) {
    await runWithPublicWaterQualityReadScope(async () => {
      await memoizedWaterQualityRead(service, "same-key", serviceLoad, { isValid: valid });
      await memoizedWaterQualityRead(anon, "same-key", anonLoad, { isValid: valid });
    });
  }
  expect(anonLoad).toHaveBeenCalledTimes(1);
  expect(serviceLoad).toHaveBeenCalledTimes(1);
});

it("keeps the County run decision fresh against each caller's clock", async () => {
  const { currentWaterQuality } = await import("@/lib/services/water-quality/current-status");
  const client = createSupabaseServiceRoleClient();
  const calls = jest.fn();
  const cacheRead = jest.fn().mockResolvedValue(result([{
    id: "9911e905-2e5f-42f7-b47f-10777220ccb2",
    status: "completed",
    source_identifier: "county-san-diego-dehq-sdbeachinfo",
    fetched_at: new Date(start.getTime() - 2 * 60 * 60 * 1000 + 1).toISOString(),
    advisory_count: 0,
    closure_count: 0,
    warning_count: 0,
  }]));
  const mock = client as unknown as {
    from: jest.Mock;
  };
  mock.from.mockImplementation((table: string) => {
    calls(table);
    const response = table === "beaches"
      ? result([{ id: "65809772-20bc-4009-b9b2-89c8ef3c4127", lat: 32.8, lon: -117.25 }])
      : table === "county_beach_advisory_runs" ? null
        : result([]);
    if (table === "county_beach_advisory_runs") {
      const query = { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(), limit: jest.fn().mockReturnThis(),
        then: (resolve: (value: unknown) => unknown) => cacheRead().then(resolve) };
      return query;
    }
    return { select: jest.fn().mockReturnThis(), in: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(), order: jest.fn().mockReturnThis(),
      then: (resolve: (value: unknown) => unknown) => Promise.resolve(response).then(resolve) };
  });
  const beach = { beach_id: "65809772-20bc-4009-b9b2-89c8ef3c4127", status: "unknown", latest_sample_date: null };
  await runWithPublicWaterQualityReadScope(() => currentWaterQuality([beach], client as never, start));
  const later = new Date(start.getTime() + 1);
  const resultRows = await runWithPublicWaterQualityReadScope(() =>
    currentWaterQuality([beach], client as never, later),
  );
  expect(resultRows).toMatchObject([{ county_advisory_status: "unavailable" }]);
});
