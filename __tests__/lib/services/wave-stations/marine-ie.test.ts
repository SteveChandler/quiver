/**
 * @jest-environment node
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { planRegistryUpsert } from "@/lib/services/wave-stations/catalogue";
import { isErddapNoRows } from "@/lib/services/wave-stations/erddap";
import { erddapUrl, marineIeAdapter } from "@/lib/services/wave-stations/marine-ie/adapter";
import {
  MARINE_IE_ATTRIBUTION,
  parseIwbObservations,
  parseIwbRegistry,
} from "@/lib/services/wave-stations/marine-ie/parsers";
import { syncLatestObservations, type CatalogueClient } from "@/lib/services/wave-stations/sync";

const fixture = (name: string): string =>
  readFileSync(path.join(__dirname, "../../../fixtures/marine-ie-wave-stations", name), "utf8");

const HEADER = [
  "station_id,CallSign,time,WaveHeight,WavePeriod,Tp,ThTp,SeaTemperature,AirTemperature,WindSpeed,WindDirection,Gust,AtmosphericPressure,QC_Flag",
  ",,UTC,meters,seconds,seconds,degrees_true,degrees_C,degrees_C,knots,degrees true,knots,millibars,",
].join("\n");

describe("Marine Institute IWBNetwork parsers", () => {
  it("reads the registry: four live M-buoys with WMO call signs, CC BY 4.0", () => {
    const stations = parseIwbRegistry(fixture("iwbnetwork-registry.csv"));
    expect(stations.map((s) => [s.sourceStationId, s.wmoId, s.name])).toEqual([
      ["M2", "62091", "M2 Irish Sea"],
      ["M3", "62092", "M3 Southwest Coast"],
      ["M5", "62094", "M5 Southeast Coast"],
      ["M6", "62095", "M6 West Coast"],
    ]);
    expect(stations[3]).toMatchObject({
      lat: 53.07482,
      lon: -15.88135,
      countryCode: "IE",
      region: null,
      hasWave: true,
      hasSwellSplit: false,
      license: "CC-BY-4.0",
      attribution: MARINE_IE_ATTRIBUTION,
    });
  });

  it("maps Hs, Tp, zero-crossing period and peak direction; converts knots to m/s", () => {
    const rows = parseIwbObservations(fixture("iwbnetwork-latest.csv"));
    expect(rows).toHaveLength(12);
    const m3 = rows.find((row) => row.sourceStationId === "M3" && row.observedAt === "2026-11-11T04:00:00.000Z");
    expect(m3?.values).toEqual({
      wave_height_m: 3.281,
      average_period_s: 6.445,
      dominant_period_s: 11.719,
      // ThTp (direction FROM at the peak): SSW swell at the south-west buoy.
      mean_wave_direction_deg: 196.875,
      water_temp_c: 12.98,
      air_temp_c: 12.07,
      wind_speed_ms: 13.18,
      wind_gust_ms: 17.75,
      wind_direction_deg: 66,
      pressure_hpa: 1000.317,
    });
    // Hmax is never stored.
    expect(rows.every((row) => !("wave_max_height_m" in row.values))).toBe(true);
  });

  it("drops fill values, NaN, bad QC flags and unparseable times", () => {
    const text = [
      HEADER,
      "M2,62091,2026-11-11T05:00:00Z,-999,NaN,5.0,-999,13.9,11.0,-999,74.0,25.0,1006.2,0",
      "M3,62092,2026-11-11T05:00:00Z,3.2,6.4,11.7,196.8,12.9,12.0,25.6,66.0,34.4,1000.3,9",
      "M5,62094,not-a-time,2.8,6.3,12.5,199.6,14.0,11.0,17.4,66.0,24.2,1002.8,0",
      "M6,62095,2026-11-11T05:00:00Z,,,,,,,,,,,0",
    ].join("\n");
    const rows = parseIwbObservations(text);
    expect(rows).toHaveLength(1);
    expect(rows[0].values).toEqual({
      dominant_period_s: 5,
      water_temp_c: 13.9,
      air_temp_c: 11,
      wind_gust_ms: 12.86,
      wind_direction_deg: 74,
      pressure_hpa: 1006.2,
    });
  });

  it("fails the run when a unit changes instead of storing wrong numbers", () => {
    const text = fixture("iwbnetwork-latest.csv").replace(",knots,degrees true", ",m s-1,degrees true");
    expect(() => parseIwbObservations(text)).toThrow(/WindSpeed unit/);
  });

  it("treats ERDDAP's 404 'no matching results' as an empty window", () => {
    expect(isErddapNoRows(404, fixture("erddap-no-rows.txt"))).toBe(true);
    expect(isErddapNoRows(500, fixture("erddap-no-rows.txt"))).toBe(false);
  });

  it("builds one bulk query with encoded constraints", () => {
    expect(erddapUrl(["station_id", "time"], ["time>=now-6hours", 'orderByMax("station_id,time")'])).toBe(
      "https://erddap.marine.ie/erddap/tabledap/IWBNetwork.csv?station_id,time&time%3E%3Dnow-6hours&orderByMax(%22station_id%2Ctime%22)",
    );
    expect(marineIeAdapter.latestEveryMinutes).toBe(60);
    expect(marineIeAdapter.fetchStationHistory).toBeUndefined();
  });
});

describe("Marine Institute registry plan", () => {
  it("builds ids, slugs, country and licence rows", () => {
    const plan = planRegistryUpsert("marine_ie", parseIwbRegistry(fixture("iwbnetwork-registry.csv")), [], Date.now());
    expect(plan.rows.map((row) => [row.id, row.slug])).toEqual([
      ["marine_ie:M2", "m2-irish-sea"],
      ["marine_ie:M3", "m3-southwest-coast"],
      ["marine_ie:M5", "m5-southeast-coast"],
      ["marine_ie:M6", "m6-west-coast"],
    ]);
    expect(new Set(plan.rows.map((row) => `${row.country_code}|${row.license}|${row.wmo_id !== null}`))).toEqual(
      new Set(["IE|CC-BY-4.0|true"]),
    );
  });
});

describe("Marine Institute latest sync", () => {
  it("drops rows stamped more than an hour ahead through the shared guard", async () => {
    const future = parseIwbObservations(
      `${HEADER}\nM3,62092,2026-11-11T07:30:00Z,3.2,6.4,11.7,196.8,12.9,12.0,25.6,66.0,34.4,1000.3,0`,
    );
    const rpc = jest.fn(async () => ({ data: 0, error: null }));
    const builder: Record<string, unknown> = {};
    for (const op of ["select", "eq", "order", "range"]) builder[op] = () => builder;
    builder.then = (resolve: (value: unknown) => unknown) =>
      Promise.resolve({ data: [{ id: "marine_ie:M3", last_observed_at: null, has_wave: true }], error: null }).then(resolve);
    const db = { from: () => builder, rpc } as unknown as CatalogueClient;
    const result = await syncLatestObservations(
      db,
      { ...marineIeAdapter, fetchLatestObservations: async () => future },
      Date.parse("2026-11-11T06:00:00Z"),
      { prune: false },
    );
    expect(result).toMatchObject({ rowsFuture: 1, rowsSent: 0 });
  });
});
