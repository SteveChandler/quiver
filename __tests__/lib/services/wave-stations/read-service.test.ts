/**
 * @jest-environment node
 */

import { unstable_cache } from "next/cache";
import { createPublicReadClient } from "@/lib/supabase/server";
import {
  forecastStationIds,
  getBeachesForStation,
  getLatestObservation,
  getNearbyStations,
  getObservationHistory,
  getStationPageObservationHistory,
  getStationBySlug,
  getStationForBeach,
  listStations,
} from "@/lib/services/wave-stations";
import type { WaveStationHistoryRow } from "@/lib/services/wave-stations/types";

jest.mock("next/cache", () => ({ unstable_cache: jest.fn() }));

jest.mock("@/lib/supabase/server", () => ({
  createPublicReadClient: jest.fn(() => {
    throw new Error("tests pass a client");
  }),
  createSupabaseServiceRoleClient: jest.fn(() => {
    throw new Error("tests pass a client");
  }),
}));

type Ops = Array<[string, unknown[]]>;

/** Each from()/rpc() chain resolves to `respond(table, ops)`. */
function fakeClient(
  respond: (table: string, ops: Ops) => unknown,
  readError?: (ops: Ops) => { message: string; code: string } | null,
) {
  const chains: Array<{ table: string; ops: Ops }> = [];
  const chain = (table: string, ops: Ops) => {
    chains.push({ table, ops });
    const builder: Record<string, unknown> = {};
    for (const op of ["select", "eq", "order", "range", "limit", "in", "not", "is", "gte", "lt", "or"]) {
      builder[op] = (...args: unknown[]) => {
        ops.push([op, args]);
        return builder;
      };
    }
    builder.maybeSingle = () => {
      ops.push(["maybeSingle", []]);
      return builder;
    };
    builder.then = (resolve: (value: unknown) => unknown) => {
      const error = readError?.(ops) ?? null;
      return Promise.resolve({ data: error ? null : respond(table, ops), error }).then(resolve);
    };
    return builder;
  };
  const client = {
    from: (table: string) => chain(table, []),
    rpc: (name: string, args: unknown) => chain(`rpc:${name}`, [["args", [args]]]),
  };
  return { client: client as never, chains };
}

const STATION = {
  id: "ndbc:46225",
  source: "ndbc",
  source_station_id: "46225",
  cdip_station_id: "100",
  lat: 32.933,
  lon: -117.391,
};

describe("forecastStationIds", () => {
  it("lists the three id forms the forecast pipeline uses", () => {
    expect(forecastStationIds({ source: "ndbc", source_station_id: "46225", cdip_station_id: "100" })).toEqual([
      "46225",
      "wmo_46225",
      "edu_ucsd_cdip_100",
    ]);
    expect(forecastStationIds({ source: "ndbc", source_station_id: "46086", cdip_station_id: null })).toEqual([
      "46086",
      "wmo_46086",
    ]);
    expect(forecastStationIds({ source: "ndbc", source_station_id: "LJPC1", cdip_station_id: null })).toEqual([
      "LJPC1",
      "ljpc1",
      "wmo_ljpc1",
    ]);
  });
});

describe("catalogue reads", () => {
  it("getStationBySlug filters on slug", async () => {
    const { client, chains } = fakeClient(() => STATION);
    await expect(getStationBySlug("torrey-pines-outer-ca-46225", client)).resolves.toEqual(STATION);
    expect(chains[0].ops).toContainEqual(["eq", ["slug", "torrey-pines-outer-ca-46225"]]);
  });

  it("listStations defaults to active wave stations and pages past 1000 rows", async () => {
    const pages = [Array.from({ length: 1000 }, (_, i) => ({ id: `ndbc:${i}` })), [{ id: "ndbc:last" }]];
    const { client, chains } = fakeClient(() => pages.shift());
    const rows = await listStations({ country: "us", region: "ca" }, client);
    expect(rows).toHaveLength(1001);
    expect(chains[0].ops).toEqual(expect.arrayContaining([
      ["eq", ["country_code", "US"]],
      ["eq", ["region", "CA"]],
      ["eq", ["has_wave", true]],
      ["eq", ["active", true]],
      ["range", [0, 999]],
    ]));
    expect(chains[1].ops).toContainEqual(["range", [1000, 1999]]);
  });

  it("getLatestObservation returns the newest wave row and the newest row separately", async () => {
    const { client, chains } = fakeClient((_table, ops) =>
      ops.some(([op]) => op === "not")
        ? { observed_at: "2026-11-11T02:40:00Z", wave_height_m: 2.3 }
        : { observed_at: "2026-11-11T03:00:00Z", wave_height_m: null },
    );
    const latest = await getLatestObservation("ndbc:46086", client);
    expect(latest.latestWave?.wave_height_m).toBe(2.3);
    expect(latest.latestAny?.observed_at).toBe("2026-11-11T03:00:00Z");
    expect(chains[0].ops).toContainEqual(["not", ["wave_height_m", "is", null]]);
  });

  it("getObservationHistory clamps hours to the retention window", async () => {
    const { client, chains } = fakeClient(() => []);
    const before = Date.now();
    await getObservationHistory("ndbc:46225", 100_000, client);
    const since = Date.parse(chains[0].ops.find(([op]) => op === "gte")![1][1] as string);
    expect(before - since).toBeGreaterThanOrEqual(180 * 24 * 3600 * 1000 - 1000);
    expect(before - since).toBeLessThan(180 * 24 * 3600 * 1000 + 5000);
  });

  it("getObservationHistory reads only the columns the charts, the Now row and the beach card use", async () => {
    const { client, chains } = fakeClient(() => []);
    await getObservationHistory("ndbc:46225", 24, client);
    const select = chains[0].ops.find(([op]) => op === "select")![1][0] as string;
    expect(select.split(", ").sort()).toEqual([
      "dominant_period_s",
      "mean_wave_direction_deg",
      "observed_at",
      "swell_direction_deg",
      "swell_height_m",
      "swell_period_s",
      "water_temp_c",
      "wave_height_m",
      "wind_wave_direction_deg",
      "wind_wave_height_m",
      "wind_wave_period_s",
    ]);
  });

  it("getNearbyStations adds distance and rejects bad coordinates", async () => {
    const { client } = fakeClient(() => [{ ...STATION, name: "Torrey" }]);
    const rows = await getNearbyStations(32.85, -117.27, 3, client);
    expect(rows[0].distance_km).toBeGreaterThan(10);
    expect(rows[0].distance_km).toBeLessThan(20);
    await expect(getNearbyStations(NaN, 0, 3, client)).resolves.toEqual([]);
  });

  it("getNearbyStations can leave out the origin station and still returns `limit` rows", async () => {
    const rows = [
      { ...STATION, name: "Torrey" },
      { ...STATION, id: "ndbc:46254", lat: 32.868, lon: -117.267 },
      { ...STATION, id: "ndbc:46232", lat: 32.517, lon: -117.425 },
    ];
    const { client, chains } = fakeClient(() => rows);
    const nearby = await getNearbyStations(32.933, -117.391, 2, client, { excludeStationId: "ndbc:46225" });
    expect(nearby.map((station) => station.id)).toEqual(["ndbc:46254", "ndbc:46232"]);
    expect(chains[0].ops[0]).toEqual(["args", [expect.objectContaining({ p_limit: 3 })]]);

    const plain = fakeClient(() => rows.slice(0, 2));
    await getNearbyStations(32.933, -117.391, 2, plain.client);
    expect(plain.chains[0].ops[0]).toEqual(["args", [expect.objectContaining({ p_limit: 2 })]]);
  });
});

describe("getStationPageObservationHistory", () => {
  const now = new Date("2026-11-11T03:46:00Z");
  const cut = "2026-11-10T00:00:00.000Z";
  const hours = 31 * 24;
  const cache = jest.mocked(unstable_cache);
  const originalFlag = process.env.BUOY_STATION_HISTORY_CACHE;
  const readError = { message: "canceling statement due to statement timeout", code: "57014" };

  function row(observed_at: string, wave_height_m: number): WaveStationHistoryRow {
    return {
      observed_at, wave_height_m, dominant_period_s: 12, mean_wave_direction_deg: 270,
      swell_height_m: 1, swell_period_s: 13, swell_direction_deg: 260,
      wind_wave_height_m: null, wind_wave_period_s: null, wind_wave_direction_deg: null, water_temp_c: 18,
    };
  }

  const old = row("2026-11-09T23:59:59.999Z", 1.2);
  const boundary = row(cut, 1.4);
  const recent = row("2026-11-11T03:00:00.000Z", 1.6);
  const agedOut = row("2026-10-11T03:45:59.999Z", 2.5);

  function historyClient(rows: WaveStationHistoryRow[], fail?: (completed: boolean) => boolean) {
    const mock = fakeClient((table, ops) => {
      const since = String(ops.find(([op]) => op === "gte")?.[1][1]);
      const before = ops.find(([op]) => op === "lt")?.[1][1] as string | undefined;
      const ascending = (ops.find(([op]) => op === "order")?.[1][1] as { ascending: boolean }).ascending;
      const [from, to] = ops.find(([op]) => op === "range")?.[1] as [number, number];
      expect(table).toBe("wave_station_observations");
      return rows.filter(({ observed_at }) => observed_at >= since && (!before || observed_at < before))
        .sort((a, b) => (ascending ? 1 : -1) * a.observed_at.localeCompare(b.observed_at))
        .slice(from, to + 1);
    }, fail && ((ops) => fail(ops.some(([op]) => op === "lt")) ? readError : null));
    jest.mocked(createPublicReadClient).mockReturnValue(mock.client);
    return mock;
  }

  beforeEach(() => {
    jest.useFakeTimers({ now });
    delete process.env.BUOY_STATION_HISTORY_CACHE;
    const entries = new Map<string, unknown>();
    cache.mockImplementation((read, parts) => async (...args) => {
      const key = JSON.stringify([parts, args]);
      if (entries.has(key)) return structuredClone(entries.get(key));
      const result = await read(...args);
      entries.set(key, structuredClone(result));
      return result;
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.mocked(createPublicReadClient).mockReset();
    cache.mockReset();
    if (originalFlag === undefined) delete process.env.BUOY_STATION_HISTORY_CACHE;
    else process.env.BUOY_STATION_HISTORY_CACHE = originalFlag;
  });

  it.each([
    { label: "rows on both sides", rows: [recent, agedOut, old] },
    { label: "only old rows", rows: [old] },
    { label: "only live rows", rows: [recent] },
    { label: "no rows", rows: [] },
    { label: "a row exactly at the cut", rows: [recent, boundary, old] },
  ])("matches the one-piece read for $label", async ({ rows }) => {
    const { client, chains } = historyClient(rows);
    const direct = await getObservationHistory(STATION.id, hours, client);
    const split = await getStationPageObservationHistory(STATION.id, hours, null);
    expect(split).toEqual(direct);
    expect(chains.map(({ ops }) => ops.find(([op]) => op === "lt")?.[1])).toEqual([
      undefined, ["observed_at", cut], undefined,
    ]);
    expect(chains[2].ops).toContainEqual(["gte", ["observed_at", cut]]);
    const select = chains[0].ops.find(([op]) => op === "select");
    expect(chains[1].ops).toContainEqual(select);
    expect(chains[2].ops).toContainEqual(select);
  });

  it("reuses completed pages within a window and reads the tail on every call", async () => {
    const rows = [old, recent];
    const { chains } = historyClient(rows);
    await getStationPageObservationHistory(STATION.id, hours, null);
    const updatedRecent = { ...recent, wave_height_m: 2 };
    rows.splice(1, 1, updatedRecent);
    jest.setSystemTime(new Date("2026-11-11T04:01:00Z"));
    await expect(getStationPageObservationHistory(STATION.id, hours, null)).resolves.toEqual([old, updatedRecent]);
    expect(chains).toHaveLength(3);
    expect(cache).toHaveBeenCalledWith(expect.any(Function), expect.any(Array), { revalidate: 86_400 });
  });

  it("reads completed history once across regenerations hours apart on the same UTC day", async () => {
    const rollsOut = row("2026-10-11T10:00:00.000Z", 2.1);
    const laterReading = row("2026-11-11T20:00:00.000Z", 1.8);
    const rows = [rollsOut, old, recent];
    const { chains } = historyClient(rows);
    await expect(getStationPageObservationHistory(STATION.id, hours, recent.observed_at))
      .resolves.toEqual([rollsOut, old, recent]);

    jest.setSystemTime(new Date("2026-11-11T20:15:00Z"));
    rows.push(laterReading);
    await expect(getStationPageObservationHistory(STATION.id, hours, laterReading.observed_at))
      .resolves.toEqual([old, recent, laterReading]);
    expect(chains.filter(({ ops }) => ops.some(([op]) => op === "lt"))).toHaveLength(1);
    expect(chains).toHaveLength(3);
  });

  it("reads the completed part again for a new station or UTC day with the same cut", async () => {
    const staleWaveAt = "2026-11-09T15:00:00.000Z";
    const historyHours = hours + 2;
    let shouldFail = false;
    const { chains } = historyClient([old, recent], (completed) => shouldFail && completed);
    await getStationPageObservationHistory(STATION.id, historyHours, staleWaveAt);
    await getStationPageObservationHistory("ndbc:46086", historyHours, staleWaveAt);
    jest.setSystemTime(new Date("2026-11-12T00:00:00Z"));
    shouldFail = true;
    await expect(getStationPageObservationHistory(STATION.id, historyHours, staleWaveAt)).rejects.toMatchObject(readError);
    const completedReads = chains.flatMap(({ ops }) => ops.filter(([op]) => op === "lt"));
    expect(completedReads).toEqual(Array.from({ length: 3 }, () => ["lt", ["observed_at", "2026-11-09T00:00:00.000Z"]]));
  });

  it("keeps the rows around a stale latest reading live for the observation age", async () => {
    const latest = row("2026-11-09T15:00:00.000Z", 1.7);
    const split = row("2026-11-09T14:00:00.000Z", 1.6);
    const rows = [latest];
    const { chains } = historyClient(rows);
    await getStationPageObservationHistory(STATION.id, hours, latest.observed_at);
    rows.push(split);
    await expect(getStationPageObservationHistory(STATION.id, hours, latest.observed_at)).resolves.toEqual([split, latest]);
    expect(chains).toHaveLength(3);
  });

  it.each([true, false])("propagates a timeout and retries when the completed part = %s failed", async (completed) => {
    let shouldFail = true;
    const { chains } = historyClient([old, recent], (part) => shouldFail && part === completed);
    await expect(getStationPageObservationHistory(STATION.id, hours, null)).rejects.toMatchObject(readError);
    shouldFail = false;
    await expect(getStationPageObservationHistory(STATION.id, hours, null)).resolves.toEqual([old, recent]);
    expect(chains.filter(({ ops }) => ops.some(([op]) => op === "lt") === completed)).toHaveLength(2);
  });

  it("uses only the direct read when the requested range is entirely live", async () => {
    const { chains } = historyClient([old, recent], () => true);
    await expect(getStationPageObservationHistory(STATION.id, 1, null)).rejects.toMatchObject(readError);
    expect(cache).not.toHaveBeenCalled();
    expect(chains).toHaveLength(1);
    expect(chains[0].ops).toContainEqual(["gte", ["observed_at", "2026-11-11T02:46:00.000Z"]]);
  });

  it("uses the direct read, including its errors, when disabled", async () => {
    process.env.BUOY_STATION_HISTORY_CACHE = "false";
    let shouldFail = false;
    const { chains } = historyClient([old, recent], () => shouldFail);
    await expect(getStationPageObservationHistory(STATION.id, hours, null)).resolves.toEqual([old, recent]);
    shouldFail = true;
    await expect(getStationPageObservationHistory(STATION.id, hours, null)).rejects.toMatchObject(readError);
    expect(cache).not.toHaveBeenCalled();
    expect(chains).toHaveLength(2);
    expect(chains[0].ops).toContainEqual(["gte", ["observed_at", "2026-10-11T03:46:00.000Z"]]);
  });
});

describe("getBeachesForStation", () => {
  const beach = { id: "b1", name: "Torrey Pines", slug: "torrey-pines", state: "CA", lat: 32.92, lon: -117.26 };

  it("returns the same links from the loaded row without reading wave_stations again", async () => {
    const publicRead = fakeClient((table) => {
      if (table === "wave_stations") return STATION;
      if (table === "beaches") return [beach];
      return [];
    });
    const serviceRole = fakeClient(() => [{ beach_id: beach.id }]);
    const clients = { publicRead: publicRead.client, serviceRole: serviceRole.client };
    const direct = await getBeachesForStation(STATION.id, clients);
    publicRead.chains.length = 0;
    await expect(getBeachesForStation({ ...STATION, source: "ndbc" }, clients)).resolves.toEqual(direct);
    expect(publicRead.chains.map(({ table }) => table)).toEqual(["beaches", "beaches"]);
  });

  it("returns fed_by beaches from the forecast station map and cdip_station", async () => {
    const publicRead = fakeClient((table, ops) => {
      if (table === "wave_stations") return STATION;
      if (table === "beaches" && ops.some(([op, args]) => op === "in" && args[0] === "cdip_station")) {
        return [{ id: "b2" }];
      }
      if (table === "beaches") return [beach, { ...beach, id: "b2", name: "Blacks", lat: 32.88 }];
      return [];
    });
    const serviceRole = fakeClient((table, ops) => {
      expect(table).toBe("beach_observation_stations");
      expect(ops).toContainEqual(["in", ["station_id", ["46225", "wmo_46225", "edu_ucsd_cdip_100"]]]);
      return [{ beach_id: "b1", station_id: "edu_ucsd_cdip_100" }];
    });

    const result = await getBeachesForStation("ndbc:46225", {
      publicRead: publicRead.client,
      serviceRole: serviceRole.client,
    });
    expect(result.relation).toBe("fed_by");
    expect(publicRead.chains.flatMap((chain) => chain.ops)).toContainEqual(["in", ["cdip_station", ["100"]]]);
    expect(result.beaches.map((b) => [b.id, b.links])).toEqual(
      expect.arrayContaining([["b1", ["forecast_station"]], ["b2", ["cdip_station"]]]),
    );
  });

  it("falls back to a plain distance list labelled nearby", async () => {
    const publicRead = fakeClient((table) => {
      if (table === "wave_stations") return { ...STATION, cdip_station_id: null };
      if (table === "rpc:get_nearby_beaches") return [{ ...beach, distance_meters: 12000 }];
      return [];
    });
    const serviceRole = fakeClient(() => []);
    const result = await getBeachesForStation("ndbc:46225", {
      publicRead: publicRead.client,
      serviceRole: serviceRole.client,
    });
    expect(result.relation).toBe("nearby");
    expect(result.beaches[0].links).toEqual(["nearby"]);
  });
});

describe("getStationForBeach", () => {
  const BEACH = { id: "b1", lat: 32.92, lon: -117.26, cdip_station: null as string | null };
  const TORREY = { ...STATION, id: "ndbc:46225", slug: "torrey-pines-outer-ca-46225", name: "Torrey Pines Outer" };
  const DEL_MAR = {
    ...STATION, id: "ndbc:46266", source_station_id: "46266", cdip_station_id: "153", name: "Del Mar Nearshore",
    slug: "del-mar-nearshore-ca-46266", lat: 32.957, lon: -117.279,
  };

  function clients(options: {
    beach?: typeof BEACH | null;
    forecastStationId?: string | null;
    catalogue?: Array<typeof TORREY>;
    nearby?: Array<typeof TORREY>;
  }) {
    const publicRead = fakeClient((table, ops) => {
      if (table === "beaches") return options.beach === undefined ? BEACH : options.beach;
      if (table === "rpc:get_nearby_wave_stations") return options.nearby ?? [];
      if (table === "wave_stations") {
        const filter = ops.find(([op]) => op === "in");
        const [column, values] = filter![1] as [string, string[]];
        return (options.catalogue ?? []).filter((station) =>
          values.includes(String((station as Record<string, unknown>)[column])));
      }
      return null;
    });
    const serviceRole = fakeClient((table, ops) => {
      expect(table).toBe("beach_observation_stations");
      expect(ops).toContainEqual(["eq", ["beach_id", "b1"]]);
      return options.forecastStationId ? { station_id: options.forecastStationId } : null;
    });
    return { publicRead, serviceRole, arg: { publicRead: publicRead.client, serviceRole: serviceRole.client } };
  }

  it("returns the forecast station and wins over a closer nearby buoy", async () => {
    const c = clients({ forecastStationId: "wmo_46225", catalogue: [TORREY, DEL_MAR], nearby: [DEL_MAR] });
    const result = await getStationForBeach("b1", c.arg);
    if (result.kind !== "found") throw new Error(result.kind);
    expect(result.match.relation).toBe("forecast_station");
    expect(result.match.station.id).toBe("ndbc:46225");
    expect(result.match.distance_km).toBeGreaterThan(10);
    expect(c.publicRead.chains.some((chain) => chain.table === "rpc:get_nearby_wave_stations")).toBe(false);
    // Private and deleted beaches never resolve.
    expect(c.publicRead.chains[0].ops).toEqual(expect.arrayContaining([
      ["or", ["is_private.is.null,is_private.eq.false"]],
      ["is", ["deleted_at", null]],
    ]));
  });

  it("maps a CDIP forecast id to the catalogue station by cdip_station_id", async () => {
    const c = clients({ forecastStationId: "edu_ucsd_cdip_100", catalogue: [TORREY, DEL_MAR] });
    const result = await getStationForBeach("b1", c.arg);
    if (result.kind !== "found") throw new Error(result.kind);
    expect(result.match).toMatchObject({ relation: "forecast_station", station: { id: "ndbc:46225" } });
    expect(c.publicRead.chains.flatMap((chain) => chain.ops)).toContainEqual(["in", ["cdip_station_id", ["100"]]]);
  });

  it("uses beaches.cdip_station when the forecast map has no row", async () => {
    const c = clients({ beach: { ...BEACH, cdip_station: "153" }, catalogue: [TORREY, DEL_MAR], nearby: [TORREY] });
    const result = await getStationForBeach("b1", c.arg);
    if (result.kind !== "found") throw new Error(result.kind);
    expect(result.match).toMatchObject({ relation: "forecast_station", station: { id: "ndbc:46266" } });
  });

  it("falls back to the nearest wave station when no link is in the catalogue", async () => {
    const c = clients({ forecastStationId: "46999", catalogue: [], nearby: [DEL_MAR] });
    const result = await getStationForBeach("b1", c.arg);
    if (result.kind !== "found") throw new Error(result.kind);
    expect(result.match.relation).toBe("nearby");
    expect(result.match.station.id).toBe("ndbc:46266");
    expect(result.match.station).not.toHaveProperty("distance_km");
    expect(result.match.distance_km).toBeLessThan(10);
  });

  it("finds no station when the nearest buoy is more than 150 km away", async () => {
    const far = { ...DEL_MAR, lat: 34.5, lon: -120.5 };
    const c = clients({ nearby: [far] });
    await expect(getStationForBeach("b1", c.arg)).resolves.toEqual({ kind: "no-station" });
  });

  it("does not resolve a private, deleted or unknown beach", async () => {
    const c = clients({ beach: null, nearby: [TORREY] });
    await expect(getStationForBeach("b1", c.arg)).resolves.toEqual({ kind: "beach-not-found" });
    expect(c.serviceRole.chains).toHaveLength(0);
  });
});
