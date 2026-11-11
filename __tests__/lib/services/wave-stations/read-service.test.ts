/**
 * @jest-environment node
 */

import {
  forecastStationIds,
  getBeachesForStation,
  getLatestObservation,
  getNearbyStations,
  getObservationHistory,
  getStationBySlug,
  listStations,
} from "@/lib/services/wave-stations";

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
function fakeClient(respond: (table: string, ops: Ops) => unknown) {
  const chains: Array<{ table: string; ops: Ops }> = [];
  const chain = (table: string, ops: Ops) => {
    chains.push({ table, ops });
    const builder: Record<string, unknown> = {};
    for (const op of ["select", "eq", "order", "range", "limit", "in", "not", "is", "gte"]) {
      builder[op] = (...args: unknown[]) => {
        ops.push([op, args]);
        return builder;
      };
    }
    builder.maybeSingle = () => {
      ops.push(["maybeSingle", []]);
      return builder;
    };
    builder.then = (resolve: (value: unknown) => unknown) =>
      Promise.resolve({ data: respond(table, ops), error: null }).then(resolve);
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

  it("getNearbyStations adds distance and rejects bad coordinates", async () => {
    const { client } = fakeClient(() => [{ ...STATION, name: "Torrey" }]);
    const rows = await getNearbyStations(32.85, -117.27, 3, client);
    expect(rows[0].distance_km).toBeGreaterThan(10);
    expect(rows[0].distance_km).toBeLessThan(20);
    await expect(getNearbyStations(NaN, 0, 3, client)).resolves.toEqual([]);
  });
});

describe("getBeachesForStation", () => {
  const beach = { id: "b1", name: "Torrey Pines", slug: "torrey-pines", state: "CA", lat: 32.92, lon: -117.26 };

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
