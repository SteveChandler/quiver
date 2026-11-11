/**
 * @jest-environment node
 */

import { createFixtureSource } from "@/lib/buoy-pages/dev-fixture-source";
import { loadAreaHub, loadRootHub, mapPins } from "@/lib/buoy-pages/hub-data";
import { isMissingCatalogueError, type BuoyPageSource } from "@/lib/buoy-pages/source";
import { loadStationPage, resolveStationSlug, withinNearbyRadius } from "@/lib/buoy-pages/station-page-data";

// The newest capture in the fixtures is 2026-11-11T03:26Z (46225).
const NOW = new Date("2026-11-11T03:46:00Z");

function source(overrides: Partial<BuoyPageSource> = {}): BuoyPageSource {
  return { ...createFixtureSource({ nowMs: NOW.getTime() }), ...overrides };
}

const MISSING_TABLE = new Error(
  "getStationBySlug: Could not find the table 'public.wave_stations' in the schema cache",
);

describe("loadStationPage", () => {
  it("loads a live station with swell split, trend, model block and beaches", async () => {
    const result = await loadStationPage(source(), "torrey-pines-outer-ca-46225", NOW);
    if (result.kind !== "found") throw new Error(`expected found, got ${result.kind}`);
    const { data } = result;
    expect(data.station.id).toBe("ndbc:46225");
    expect(data.timeZone).toBe("America/Los_Angeles");
    expect(data.status).toBe("fresh");
    expect(data.index.indexable).toBe(true);
    expect(data.latestWave).toMatchObject({ observed_at: "2026-11-11T03:26:00.000Z", wave_height_m: 1.4, swell_height_m: 1.0 });
    expect(data.reading).toMatch(/^Long-period groundswell leads: 3\.3 ft at 13 s from the W, with 3\.0 ft of wind waves at 9\.1 s from the WNW on top\./);
    expect(Object.keys(data.chartRanges).sort()).toEqual(["24h", "30d", "5d"]);
    expect(data.chartRanges["5d"]?.end).toBe(Date.parse("2026-11-11T03:00:00Z"));
    expect(data.model?.splitAt).toBe(Date.parse("2026-11-11T03:26:00Z"));
    expect(data.model?.comparisonText).toMatch(/^Over the last \d days, the model /);
    expect(data.model?.peaks.length).toBeGreaterThan(5);
    expect(data.beaches.relation).toBe("fed_by");
    // Halibut Bank (1,898 km) is past the 600 km cap.
    expect(data.nearby.map((item) => item.station.id)).toEqual(["ndbc:46086"]);
  });

  it("shows a buoy that stopped sending waves as stale, without a 6-hour trend", async () => {
    const result = await loadStationPage(source(), "san-clemente-basin-ca-46086", NOW);
    if (result.kind !== "found") throw new Error(`expected found, got ${result.kind}`);
    expect(result.data.status).toBe("stale");
    expect(result.data.index.indexable).toBe(true);
    expect(result.data.reading).not.toMatch(/last 6 hours/);
    expect(result.data.latestAny?.wind_speed_ms).not.toBeNull();
  });

  it.each(["46225", "100", "0100"])("redirects the alternate id %s to the canonical slug", async (id) => {
    await expect(loadStationPage(source(), id, NOW)).resolves.toEqual({
      kind: "redirect",
      slug: "torrey-pines-outer-ca-46225",
    });
  });

  it("does not redirect an id that matches more than one station", async () => {
    const ambiguous = source({
      getStationBySlug: async () => null,
      findStationsByAlternateId: async () => [
        { id: "ndbc:a", slug: "a" },
        { id: "ndbc:b", slug: "b" },
      ],
    });
    await expect(loadStationPage(ambiguous, "123", NOW)).resolves.toEqual({ kind: "not-found" });
  });

  it("rejects a missing column instead of answering 404", async () => {
    const broken = source({
      getStationBySlug: async () => {
        throw Object.assign(new Error("getStationBySlug: Could not find the 'slug' column of 'wave_stations' in the schema cache"), {
          code: "PGRST204",
        });
      },
    });
    await expect(loadStationPage(broken, "torrey-pines-outer-ca-46225", NOW)).rejects.toThrow(/column/);
  });

  it("keeps an offline, noindex page for a station that once had waves after has_wave is cleared", async () => {
    const base = source();
    const station = await base.getStationBySlug("torrey-pines-outer-ca-46225");
    if (!station) throw new Error("fixture missing");
    const cleared = source({ getStationBySlug: async () => ({ ...station, has_wave: false }) });
    const result = await loadStationPage(cleared, "torrey-pines-outer-ca-46225", NOW);
    if (result.kind !== "found") throw new Error(`expected found, got ${result.kind}`);
    expect(result.data.status).toBe("offline");
    expect(result.data.index).toEqual({ indexable: false, reason: "no-wave-data" });
    expect(result.data.nowObservation).toBeNull();
    const never = source({ getStationBySlug: async () => ({ ...station, has_wave: false, last_wave_observed_at: null }) });
    await expect(loadStationPage(never, "torrey-pines-outer-ca-46225", NOW)).resolves.toEqual({ kind: "not-found" });
  });

  it("is not found for unknown slugs and met-only stations", async () => {
    await expect(loadStationPage(source(), "no-such-buoy", NOW)).resolves.toEqual({ kind: "not-found" });
    await expect(loadStationPage(source(), "9414750-alameda-ca-aamc1", NOW)).resolves.toEqual({ kind: "not-found" });
  });

  it("treats a catalogue that is not migrated yet as not found", async () => {
    const missing = source({
      getStationBySlug: async () => {
        throw MISSING_TABLE;
      },
      findStationsByAlternateId: async () => {
        throw MISSING_TABLE;
      },
    });
    await expect(loadStationPage(missing, "torrey-pines-outer-ca-46225", NOW)).resolves.toEqual({ kind: "not-found" });
  });

  it("rethrows other read errors so ISR keeps the last good page", async () => {
    const broken = source({
      getStationBySlug: async () => {
        throw new Error("getStationBySlug: canceling statement due to statement timeout");
      },
    });
    await expect(loadStationPage(broken, "torrey-pines-outer-ca-46225", NOW)).rejects.toThrow(/statement timeout/);
  });

  it("hides the model block when the model has no data at the buoy", async () => {
    const result = await loadStationPage(source({ fetchModelAtBuoy: async () => null }), "torrey-pines-outer-ca-46225", NOW);
    if (result.kind !== "found") throw new Error("expected found");
    expect(result.data.model).toBeNull();
  });
});

describe("withinNearbyRadius", () => {
  const at = (km: number) => ({ distance_km: km });
  it("keeps buoys within 300 km, widening to 600 km only when fewer than two are that close", () => {
    expect(withinNearbyRadius([at(20), at(250), at(400), at(1898)])).toEqual([at(20), at(250)]);
    expect(withinNearbyRadius([at(76), at(420), at(1898)])).toEqual([at(76), at(420)]);
    expect(withinNearbyRadius([at(1898)])).toEqual([]);
  });
});

describe("resolveStationSlug", () => {
  it("resolves slugs and unique alternate ids for legacy /buoys/{id} URLs", async () => {
    await expect(resolveStationSlug(source(), "46225")).resolves.toBe("torrey-pines-outer-ca-46225");
    await expect(resolveStationSlug(source(), "torrey-pines-outer-ca-46225")).resolves.toBe("torrey-pines-outer-ca-46225");
    await expect(resolveStationSlug(source(), "99999")).resolves.toBeNull();
  });
});

describe("hubs", () => {
  it("groups a country by region and counts live buoys", async () => {
    const hub = await loadAreaHub(source(), "us", null, NOW);
    expect(hub?.countryCode).toBe("US");
    expect(hub?.groups.map((group) => group.name)).toEqual(["California"]);
    const california = hub?.groups.find((group) => group.code === "CA");
    expect(california?.stations.map((item) => item.station.source_station_id)).toEqual(["46086", "46225"]);
    expect(california?.stations.find((item) => item.station.source_station_id === "46225")?.latest?.wave_height_m).toBe(1.4);
  });

  it("returns null (a 404) for a country or region with no stations", async () => {
    await expect(loadAreaHub(source(), "zz", null, NOW)).resolves.toBeNull();
    await expect(loadAreaHub(source(), "us", "ak", NOW)).resolves.toBeNull();
  });

  it("returns null for the root hub when the catalogue is missing", async () => {
    const missing = source({
      listStations: async () => {
        throw new Error("listStations: relation \"public.wave_stations\" does not exist");
      },
    });
    await expect(loadRootHub(missing, NOW)).resolves.toBeNull();
  });

  it("lists countries without assuming the US", async () => {
    const hub = await loadRootHub(source(), NOW);
    expect(hub?.countries).toEqual([
      { code: "US", name: "United States", stationCount: 2, liveCount: 1 },
      { code: "CA", name: "Canada", stationCount: 1, liveCount: 1 },
    ]);
  });

  it("collapses map pins to 0.1° cells", () => {
    expect(mapPins([{ lat: 32.933, lon: -117.391 }, { lat: 32.94, lon: -117.36 }, { lat: 33.5, lon: -118 }])).toEqual([
      { latitude: 32.9, longitude: -117.4 },
      { latitude: 33.5, longitude: -118 },
    ]);
  });
});

describe("isMissingCatalogueError", () => {
  const withCode = (message: string, code: string) => Object.assign(new Error(message), { code });

  it("matches a missing catalogue table or RPC only", () => {
    expect(isMissingCatalogueError(MISSING_TABLE)).toBe(true);
    expect(isMissingCatalogueError(withCode(MISSING_TABLE.message, "PGRST205"))).toBe(true);
    expect(isMissingCatalogueError(new Error('relation "public.wave_stations" does not exist'))).toBe(true);
    expect(
      isMissingCatalogueError(withCode("getNearbyStations: Could not find the function public.get_nearby_wave_stations", "PGRST202")),
    ).toBe(true);
  });

  it("does not hide a missing column, another table or a transient failure", () => {
    const column = "listStations: Could not find the 'region' column of 'wave_stations' in the schema cache";
    expect(isMissingCatalogueError(new Error(column))).toBe(false);
    expect(isMissingCatalogueError(withCode(column, "PGRST204"))).toBe(false);
    expect(isMissingCatalogueError(withCode("Could not find the table 'public.beaches' in the schema cache", "PGRST205"))).toBe(false);
    expect(isMissingCatalogueError(new Error("fetch failed"))).toBe(false);
  });
});
