/**
 * @jest-environment node
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import {
  syncLatestObservations,
  syncRegistry,
  syncStandardHistory,
  syncSwellSplit,
  type CatalogueClient,
} from "@/lib/services/wave-stations/sync";
import {
  parseLatestObs,
  parseSpecFile,
  parseStandardFile,
} from "@/lib/services/wave-stations/ndbc/parsers";
import type {
  SourceStation,
  StationHistoryResult,
  WaveStationSourceAdapter,
} from "@/lib/services/wave-stations/types";

const fixture = (name: string): string =>
  readFileSync(path.join(__dirname, "../../../fixtures/ndbc-wave-stations", name), "utf8");

interface Call {
  table: string;
  ops: Array<[string, unknown[]]>;
}

/** Chainable PostgREST stand-in: every `from()` chain resolves to the next queued result for that table. */
function fakeDb(selectResults: Record<string, unknown[][]> = {}) {
  const calls: Call[] = [];
  const rpcCalls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const db = {
    from(table: string) {
      const call: Call = { table, ops: [] };
      calls.push(call);
      const builder: Record<string, unknown> = {};
      for (const op of ["select", "eq", "order", "range", "or", "limit", "upsert", "update", "in", "not", "is"]) {
        builder[op] = (...args: unknown[]) => {
          call.ops.push([op, args]);
          return builder;
        };
      }
      builder.then = (resolve: (value: unknown) => unknown) => {
        const isRead = call.ops[0]?.[0] === "select";
        const data = isRead ? (selectResults[table]?.shift() ?? []) : null;
        return Promise.resolve({ data, error: null }).then(resolve);
      };
      return builder;
    },
    rpc(name: string, args: Record<string, unknown>) {
      rpcCalls.push({ name, args });
      const rows = Array.isArray(args.p_rows) ? args.p_rows.length : 7;
      return Promise.resolve({ data: rows, error: null });
    },
  };
  return { db: db as unknown as CatalogueClient, calls, rpcCalls };
}

function adapter(overrides: Partial<WaveStationSourceAdapter> = {}): WaveStationSourceAdapter {
  return {
    source: "ndbc",
    fetchStations: jest.fn(async () => []),
    fetchLatestObservations: jest.fn(async () => parseLatestObs(fixture("latest_obs.txt"))),
    fetchStationHistory: jest.fn(async (): Promise<StationHistoryResult> => ({ status: "not_modified" })),
    ...overrides,
  };
}

describe("syncLatestObservations", () => {
  it("drops unknown stations and older rows, and merges the rest", async () => {
    const { db, rpcCalls } = fakeDb({
      wave_stations: [[
        { id: "ndbc:46225", last_observed_at: "2026-11-11T02:26:00+00:00", has_wave: true },
        { id: "ndbc:46086", last_observed_at: "2026-11-11T03:00:00+00:00", has_wave: true },
        { id: "ndbc:51201", last_observed_at: "2026-11-11T03:30:00+00:00", has_wave: true },
        { id: "ndbc:46146", last_observed_at: null, has_wave: true },
      ]],
    });
    const result = await syncLatestObservations(db, adapter(), Date.parse("2026-11-11T03:34:00Z"));

    expect(result).toMatchObject({
      rowsInFeed: 7,
      rowsUnknownStation: 3,
      rowsNonWaveStation: 0,
      // 46086's 03:00 row is met-only (waves come later in the hour): not stored.
      rowsWithoutWave: 1,
      rowsStale: 1,
      rowsSent: 2,
      rowsPruned: 0,
    });
    expect(rpcCalls).toHaveLength(1);
    const rows = rpcCalls[0].args.p_rows as Array<Record<string, unknown>>;
    expect(rows.map((row) => row.station_id).sort()).toEqual(["ndbc:46146", "ndbc:46225"]);
    // Met fields that arrive on a wave row are kept.
    expect(rows.find((row) => row.station_id === "ndbc:46146")).toMatchObject({
      wave_height_m: 1,
      wind_speed_ms: 12,
      pressure_hpa: 1012.1,
      water_temp_c: 10.3,
    });
    // The latest feed never sends swell-split keys, so it cannot null them.
    expect(rows.every((row) => !("swell_height_m" in row))).toBe(true);
  });

  it("stores no rows for met-only stations unless the row has a wave height", async () => {
    const { db, rpcCalls } = fakeDb({
      wave_stations: [[
        { id: "ndbc:AAMC1", last_observed_at: null, has_wave: false },
        { id: "ndbc:15001", last_observed_at: null, has_wave: false },
        { id: "ndbc:46146", last_observed_at: null, has_wave: false },
      ]],
    });
    const result = await syncLatestObservations(db, adapter(), Date.parse("2026-11-11T03:34:00Z"));

    expect(result).toMatchObject({ rowsNonWaveStation: 2, rowsSent: 1 });
    const rows = rpcCalls[0].args.p_rows as Array<Record<string, unknown>>;
    // 46146 reported WVHT 1.0: the merge function then sets has_wave.
    expect(rows.map((row) => row.station_id)).toEqual(["ndbc:46146"]);
  });

  it("drops rows stamped more than an hour in the future", async () => {
    const { db, rpcCalls } = fakeDb({
      wave_stations: [[{ id: "ndbc:46225", last_observed_at: null, has_wave: true }]],
    });
    // 46225's row is 02:56Z; "now" 01:50Z puts it 66 minutes ahead.
    const result = await syncLatestObservations(db, adapter(), Date.parse("2026-11-11T01:50:00Z"));
    expect(result).toMatchObject({ rowsFuture: 1, rowsSent: 0 });
    expect(rpcCalls.filter((call) => call.name === "merge_wave_station_observations")).toHaveLength(0);

    const nearNow = fakeDb({
      wave_stations: [[{ id: "ndbc:46225", last_observed_at: null, has_wave: true }]],
    });
    const ok = await syncLatestObservations(nearNow.db, adapter(), Date.parse("2026-11-11T02:00:00Z"));
    expect(ok).toMatchObject({ rowsFuture: 0, rowsSent: 1 });
  });

  it("prunes past the 180-day retention on the first run of the hour", async () => {
    const { db, rpcCalls } = fakeDb({ wave_stations: [[]] });
    const result = await syncLatestObservations(db, adapter(), Date.parse("2026-11-11T03:04:00Z"));
    const prune = rpcCalls.find((call) => call.name === "prune_wave_station_observations");
    expect(prune?.args).toEqual({ p_before: "2026-05-15T03:04:00.000Z", p_limit: 5000 });
    expect(result.rowsPruned).toBe(7);
  });
});

describe("syncSwellSplit", () => {
  const options = { maxStations: 10, maxBackfills: 1, concurrency: 2, budgetMs: 60_000 };

  it("backfills a new station once, defers extra backfills, and sends only new rows otherwise", async () => {
    const { db, calls, rpcCalls } = fakeDb({
      wave_stations: [[
        { id: "ndbc:46225", source_station_id: "46225", spec_last_modified: null, spec_last_observed_at: null },
        { id: "ndbc:46254", source_station_id: "46254", spec_last_modified: null, spec_last_observed_at: null },
        {
          id: "ndbc:46086",
          source_station_id: "46086",
          spec_last_modified: "Tue, 10 Nov 2026 02:15:00 GMT",
          spec_last_observed_at: "2026-11-07T19:10:00+00:00",
        },
      ]],
    });
    const fetchStationHistory = jest.fn(
      async (id: string): Promise<StationHistoryResult> => ({
        status: "ok",
        lastModified: "Wed, 11 Nov 2026 03:10:22 GMT",
        observations: parseSpecFile(fixture(id === "46086" ? "46086.spec" : "46225.spec"), id),
      }),
    );
    const result = await syncSwellSplit(
      db,
      adapter({ fetchStationHistory }),
      Date.parse("2026-11-11T03:11:00Z"),
      options,
    );

    expect(result).toMatchObject({ stationsDue: 3, fetched: 2, backfilled: 1, backfillDeferred: 1, rowsWritten: 4 });
    expect(fetchStationHistory).toHaveBeenCalledWith("46225", { ifModifiedSince: null, file: "spec" });
    expect(fetchStationHistory).toHaveBeenCalledWith("46086", {
      ifModifiedSince: "Tue, 10 Nov 2026 02:15:00 GMT",
      file: "spec",
    });

    const sent = rpcCalls.flatMap((call) => call.args.p_rows as Array<{ station_id: string; observed_at: string }>);
    expect(sent.filter((row) => row.station_id === "ndbc:46225")).toHaveLength(3);
    expect(sent.filter((row) => row.station_id === "ndbc:46086").map((row) => row.observed_at)).toEqual([
      "2026-11-10T01:40:00.000Z",
    ]);

    const updates = calls.filter((call) => call.ops[0]?.[0] === "update").map((call) => call.ops[0][1][0]);
    expect(updates).toContainEqual({
      spec_checked_at: "2026-11-11T03:11:00.000Z",
      spec_last_modified: "Wed, 11 Nov 2026 03:10:22 GMT",
      spec_last_observed_at: "2026-11-10T01:40:00.000Z",
    });
    expect(updates).toContainEqual({
      spec_checked_at: "2026-11-11T03:11:00.000Z",
      spec_last_modified: "Wed, 11 Nov 2026 03:10:22 GMT",
      spec_last_observed_at: "2026-11-11T02:56:00.000Z",
    });
  });

  it("drops future-stamped history rows so they cannot advance the stored state", async () => {
    const { db, calls, rpcCalls } = fakeDb({
      wave_stations: [[
        {
          id: "ndbc:46225",
          source_station_id: "46225",
          spec_last_modified: "Wed, 11 Nov 2026 01:10:22 GMT",
          spec_last_observed_at: "2026-11-11T00:56:00+00:00",
        },
      ]],
    });
    const fetchStationHistory = async (): Promise<StationHistoryResult> => ({
      status: "ok",
      lastModified: "Wed, 11 Nov 2026 03:10:22 GMT",
      observations: parseSpecFile(fixture("46225.spec"), "46225"),
    });
    // now = 00:58Z: 01:56Z is 58 min ahead (kept), 02:26Z and 02:56Z are > 1 h ahead (dropped).
    const result = await syncSwellSplit(
      db,
      adapter({ fetchStationHistory }),
      Date.parse("2026-11-11T00:58:00Z"),
      options,
    );
    expect(result).toMatchObject({ rowsFuture: 2, rowsWritten: 1 });
    const sent = rpcCalls.flatMap((call) => call.args.p_rows as Array<{ observed_at: string }>);
    expect(sent.map((row) => row.observed_at)).toEqual(["2026-11-11T01:56:00.000Z"]);
    const update = calls.find((call) => call.ops[0]?.[0] === "update")?.ops[0][1][0];
    expect(update).toMatchObject({ spec_last_observed_at: "2026-11-11T01:56:00.000Z" });
  });

  it("records a 304 as checked without writing rows", async () => {
    const { db, rpcCalls } = fakeDb({
      wave_stations: [[
        {
          id: "ndbc:46225",
          source_station_id: "46225",
          spec_last_modified: "Wed, 11 Nov 2026 03:10:22 GMT",
          spec_last_observed_at: "2026-11-11T02:56:00+00:00",
        },
      ]],
    });
    const result = await syncSwellSplit(db, adapter(), Date.now(), options);
    expect(result).toMatchObject({ notModified: 1, fetched: 0, rowsWritten: 0 });
    expect(rpcCalls).toHaveLength(0);
  });
});

describe("syncStandardHistory", () => {
  const options = { maxStations: 15, maxBackfills: 3, concurrency: 2, budgetMs: 60_000 };

  it("queues every wave station (with or without a .spec) and keeps its own .txt sync state", async () => {
    const { db, calls, rpcCalls } = fakeDb({
      wave_stations: [[
        { id: "ndbc:46146", source_station_id: "46146", txt_last_modified: null, txt_last_observed_at: null },
        {
          id: "ndbc:44042",
          source_station_id: "44042",
          txt_last_modified: "Wed, 11 Nov 2026 02:10:20 GMT",
          txt_last_observed_at: "2026-11-11T02:00:00+00:00",
        },
      ]],
    });
    const fetchStationHistory = jest.fn(
      async (id: string): Promise<StationHistoryResult> => ({
        status: "ok",
        lastModified: "Wed, 11 Nov 2026 03:10:20 GMT",
        observations: parseStandardFile(fixture("46146.txt"), id),
      }),
    );
    const result = await syncStandardHistory(
      db,
      adapter({ fetchStationHistory }),
      Date.parse("2026-11-11T03:11:00Z"),
      options,
    );

    expect(result).toMatchObject({ stationsDue: 2, fetched: 2, backfilled: 1, rowsWritten: 4 });
    expect(fetchStationHistory).toHaveBeenCalledWith("46146", { ifModifiedSince: null, file: "txt" });
    expect(fetchStationHistory).toHaveBeenCalledWith("44042", {
      ifModifiedSince: "Wed, 11 Nov 2026 02:10:20 GMT",
      file: "txt",
    });

    const queueOps = calls[0].ops;
    expect(queueOps).toContainEqual(["eq", ["has_wave", true]]);
    expect(queueOps.some(([op, args]) => op === "eq" && args[0] === "has_swell_split")).toBe(false);
    // Only rows newer than the stored .txt state are sent for 44042.
    const sent44042 = rpcCalls
      .flatMap((call) => call.args.p_rows as Array<{ station_id: string; observed_at: string }>)
      .filter((row) => row.station_id === "ndbc:44042");
    expect(sent44042.map((row) => row.observed_at)).toEqual(["2026-11-11T03:00:00.000Z"]);

    const updates = calls.filter((call) => call.ops[0]?.[0] === "update").map((call) => call.ops[0][1][0]);
    expect(updates).toContainEqual({
      txt_checked_at: "2026-11-11T03:11:00.000Z",
      txt_last_modified: "Wed, 11 Nov 2026 03:10:20 GMT",
      txt_last_observed_at: "2026-11-11T03:00:00.000Z",
    });
    expect(updates.every((fields) => !("spec_checked_at" in (fields as object)))).toBe(true);
  });

  it("waits until the station's .spec check is 20+ minutes old (checks ~30 min apart)", async () => {
    const now = Date.parse("2026-11-11T03:11:00Z");
    const { db, calls } = fakeDb({
      wave_stations: [[
        // .spec checked 5 min ago (e.g. earlier in this same cron run): not due for .txt yet.
        { id: "ndbc:46225", source_station_id: "46225", txt_last_modified: null,
          txt_last_observed_at: null, spec_checked_at: "2026-11-11T03:06:00+00:00" },
        // .spec checked 25 min ago: due.
        { id: "ndbc:46086", source_station_id: "46086", txt_last_modified: null,
          txt_last_observed_at: null, spec_checked_at: "2026-11-11T02:46:00+00:00" },
        // No .spec at all: due.
        { id: "ndbc:46146", source_station_id: "46146", txt_last_modified: null,
          txt_last_observed_at: null, spec_checked_at: null },
      ]],
    });
    const fetchStationHistory = jest.fn(async (): Promise<StationHistoryResult> => ({ status: "not_modified" }));
    const result = await syncStandardHistory(db, adapter({ fetchStationHistory }), now, options);

    expect(result.stationsDue).toBe(2);
    expect(fetchStationHistory.mock.calls.map(([id]) => id).sort()).toEqual(["46086", "46146"]);
    expect(calls[0].ops).toContainEqual(["select", [
      "id, source_station_id, txt_last_modified, txt_last_observed_at, spec_checked_at",
    ]]);
  });

  it("sends a stored Last-Modified even with no rows, and a 304 does not use a backfill slot", async () => {
    const { db } = fakeDb({
      wave_stations: [[
        { id: "ndbc:22101", source_station_id: "22101", txt_last_modified: "Mon, 09 Nov 2026 00:00:00 GMT",
          txt_last_observed_at: null, spec_checked_at: null },
        { id: "ndbc:22102", source_station_id: "22102", txt_last_modified: "Mon, 09 Nov 2026 00:00:00 GMT",
          txt_last_observed_at: null, spec_checked_at: null },
        { id: "ndbc:22103", source_station_id: "22103", txt_last_modified: null,
          txt_last_observed_at: null, spec_checked_at: null },
      ]],
    });
    const fetchStationHistory = jest.fn(
      async (id: string): Promise<StationHistoryResult> =>
        id === "22103"
          ? { status: "ok", lastModified: "Wed, 11 Nov 2026 03:10:20 GMT", observations: [] }
          : { status: "not_modified" },
    );
    const result = await syncStandardHistory(
      db,
      adapter({ fetchStationHistory }),
      Date.parse("2026-11-11T03:11:00Z"),
      { ...options, maxBackfills: 1, concurrency: 1 },
    );

    expect(fetchStationHistory).toHaveBeenCalledWith("22101", {
      ifModifiedSince: "Mon, 09 Nov 2026 00:00:00 GMT",
      file: "txt",
    });
    // All three ran with one slot: 304s and an empty 200 body give the slot back.
    expect(result).toMatchObject({ notModified: 2, fetched: 1, backfilled: 0, backfillDeferred: 0 });
  });

  it("does not touch has_swell_split when a .txt file is missing", async () => {
    const { db, calls } = fakeDb({
      wave_stations: [[
        { id: "ndbc:22101", source_station_id: "22101", txt_last_modified: null, txt_last_observed_at: null },
      ]],
    });
    const result = await syncStandardHistory(
      db,
      adapter({ fetchStationHistory: async () => ({ status: "not_found" }) }),
      Date.parse("2026-11-11T03:11:00Z"),
      options,
    );
    expect(result.notFound).toBe(1);
    const updates = calls.filter((call) => call.ops[0]?.[0] === "update").map((call) => call.ops[0][1][0]);
    expect(updates).toEqual([{ txt_checked_at: "2026-11-11T03:11:00.000Z" }]);
  });
});

describe("syncRegistry", () => {
  it("refuses an empty station list instead of deactivating everything", async () => {
    const { db } = fakeDb();
    await expect(syncRegistry(db, adapter(), Date.now())).rejects.toThrow(/station list is empty/);
  });

  it("skips deactivation when the list is under 80% of the active catalogue", async () => {
    const listed: SourceStation = {
      sourceStationId: "46225", name: "Torrey Pines Outer, CA", lat: 32.9, lon: -117.4,
      stationType: "buoy", owner: "SCRIPPS", program: "IOOS Partners", countryCode: "US",
      region: "CA", cdipStationId: "100", hasWave: true, hasSwellSplit: true, hasMet: true,
      license: "public-domain-us-gov", attribution: "NOAA NDBC",
    };
    const stored = ["46225", "46086", "46254", "46232", "46219"].map((id) => ({
      id: `ndbc:${id}`, slug: `s-${id}`, active: true, last_wave_observed_at: null,
    }));
    const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    const { db, calls } = fakeDb({ wave_stations: [stored] });
    const result = await syncRegistry(db, adapter({ fetchStations: async () => [listed] }), Date.now());

    expect(result).toMatchObject({
      upserted: 1,
      deactivated: 0,
      deactivationSkipped: { activeStored: 5, listed: 1 },
    });
    expect(calls.some((call) => call.ops[0]?.[0] === "update")).toBe(false);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("skipping deactivation of 4"));
    warn.mockRestore();
  });

  it("deactivates normally when the list is at least 80% of the active catalogue", async () => {
    const make = (id: string): SourceStation => ({
      sourceStationId: id, name: `Station ${id}`, lat: 30, lon: -120, stationType: "buoy",
      owner: "NDBC", program: "NDBC Meteorological/Ocean", countryCode: "US", region: null,
      cdipStationId: null, hasWave: true, hasSwellSplit: false, hasMet: true,
      license: "public-domain-us-gov", attribution: "NOAA NDBC",
    });
    const stored = ["1", "2", "3", "4", "5"].map((id) => ({
      id: `ndbc:${id}`, slug: `s-${id}`, active: true, last_wave_observed_at: null,
    }));
    const { db } = fakeDb({ wave_stations: [stored] });
    const result = await syncRegistry(
      db,
      adapter({ fetchStations: async () => ["1", "2", "3", "4"].map(make) }),
      Date.now(),
    );
    expect(result).toMatchObject({ deactivated: 1, deactivationSkipped: null });
  });

  it("upserts stations and counts wave stations by country", async () => {
    const stations: SourceStation[] = [
      {
        sourceStationId: "46225", name: "Torrey Pines Outer, CA", lat: 32.9, lon: -117.4,
        stationType: "buoy", owner: "SCRIPPS", program: "IOOS Partners", countryCode: "US",
        region: "CA", cdipStationId: "100", hasWave: true, hasSwellSplit: true, hasMet: true,
        license: "public-domain-us-gov", attribution: "NOAA NDBC",
      },
      {
        sourceStationId: "15001", name: "Station 15001", lat: -10, lon: -10,
        stationType: "buoy", owner: null, program: "International Partners", countryCode: null,
        region: null, cdipStationId: null, hasWave: false, hasSwellSplit: false, hasMet: true,
        license: "public-domain-us-gov", attribution: "NOAA NDBC",
      },
    ];
    const { db, calls } = fakeDb({ wave_stations: [[]] });
    const result = await syncRegistry(db, adapter({ fetchStations: async () => stations }), Date.now());
    expect(result).toEqual({
      stationsListed: 2,
      withWave: 1,
      withSwellSplit: 1,
      waveStationsByCountry: { US: 1 },
      upserted: 2,
      deactivated: 0,
      deactivationSkipped: null,
    });
    const upsert = calls.find((call) => call.ops[0]?.[0] === "upsert");
    const rows = upsert?.ops[0][1][0] as Array<Record<string, unknown>>;
    expect(rows[0]).not.toHaveProperty("first_seen_at");
    expect(rows[0]).not.toHaveProperty("last_observed_at");
    expect(rows[0].slug).toBe("torrey-pines-outer-ca-46225");
  });
});
