/**
 * @jest-environment node
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { aodnAdapter, aodnUrl } from "@/lib/services/wave-stations/aodn/adapter";
import {
  AODN_CONTRIBUTORS,
  AODN_EXCLUDED,
  aodnObservations,
  aodnStationId,
  aodnStations,
  parseAodnCsv,
  WAVE_COLUMNS,
  REQUIRED_COLUMNS,
} from "@/lib/services/wave-stations/aodn/parsers";
import { planRegistryUpsert } from "@/lib/services/wave-stations/catalogue";

const csv = readFileSync(path.join(__dirname, "../../../fixtures/aodn-wave-stations/wave-nrt-latest.csv"), "utf8");
const columns = [...REQUIRED_COLUMNS, ...WAVE_COLUMNS];

describe("AODN wave NRT parser", () => {
  it("keeps allowed contributors only and fails closed on unknown ones", () => {
    const { rows, excludedInstitutions } = parseAodnCsv(csv, columns);
    expect(excludedInstitutions).toEqual({
      "Department of Transport WA": 1,
      "Manly Hydraulics Laboratory -NSW Department of Planning, Industry and Environment": 1,
    });
    expect(rows.every((row) => row.institution in AODN_CONTRIBUTORS)).toBe(true);
    for (const excluded of Object.keys(AODN_EXCLUDED)) expect(AODN_CONTRIBUTORS[excluded]).toBeUndefined();

    const unknown = csv.replace("Bureau Of Meteorology", "Some New Contributor");
    expect(parseAodnCsv(unknown, columns).excludedInstitutions["Some New Contributor"]).toBe(1);
  });

  it("reads zone-less TIME as UTC", () => {
    const { rows } = parseAodnCsv(csv, columns);
    expect(rows.find((row) => row.siteName === "Tathra")?.observedAt).toBe("2026-11-11T03:45:00.000Z");
  });

  it("maps Spotter Hm0 and Datawell H1/3 to wave height, peak period and peak FROM direction", () => {
    const obs = aodnObservations(parseAodnCsv(csv, columns).rows);
    const wooli = obs.find((o) => o.sourceStationId === "wooli" && o.observedAt === "2026-11-11T04:25:00.000Z");
    expect(wooli?.values).toEqual({
      wave_height_m: 1.196,
      dominant_period_s: 11.378,
      average_period_s: 6.106,
      // SSE swell on the NSW north coast.
      mean_wave_direction_deg: 161.661,
    });
    const goldCoast = obs.find((o) => o.sourceStationId === "gold-coast" && o.observedAt === "2026-11-11T03:00:00.000Z");
    expect(goldCoast?.values).toEqual({
      wave_height_m: 0.88,
      dominant_period_s: 11.1,
      average_period_s: 4.4,
      mean_wave_direction_deg: 128,
    });
  });

  it("drops a 0 s peak and its 0° direction, and rows flagged bad", () => {
    const obs = aodnObservations(parseAodnCsv(csv, columns).rows);
    const zero = obs.find((o) => o.sourceStationId === "gold-coast" && o.observedAt === "2026-11-11T03:30:00.000Z");
    expect(zero?.values).toEqual({ wave_height_m: 0.86 });
    // QC 4 (bad): Mission Beach 03:35 and Exmouth Gulf North 02:50.
    expect(obs.some((o) => o.sourceStationId === "mission-beach")).toBe(false);
    expect(obs.filter((o) => o.sourceStationId === "exmouth-gulf-north").map((o) => o.observedAt)).toEqual([
      "2026-11-11T03:20:00.000Z",
    ]);
  });

  it("fails the run when an expected column disappears", () => {
    expect(() => parseAodnCsv(csv.replace("site_name", "site"), columns)).toThrow(/site_name missing/);
  });

  it("filters every request by TIME", () => {
    const url = new URL(aodnUrl(REQUIRED_COLUMNS, Date.parse("2026-11-10T23:30:00Z")));
    expect(url.searchParams.get("CQL_FILTER")).toBe("TIME AFTER 2026-11-10T23:30:00Z");
    expect(url.searchParams.get("typeName")).toBe("aodn:aodn_wave_nrt_v2_timeseries_data");
    expect(aodnAdapter.latestEveryMinutes).toBe(30);
  });
});

describe("AODN registry", () => {
  it("builds one station per site with ids, slugs, AU and per-contributor attribution", () => {
    const stations = aodnStations(parseAodnCsv(csv, columns).rows);
    const plan = planRegistryUpsert("aodn", stations, [], Date.now());
    const byId = new Map(plan.rows.map((row) => [row.id, row]));
    expect([...byId.keys()].sort()).toEqual([
      "aodn:cape-du-couedic",
      "aodn:exmouth-gulf-north",
      "aodn:gold-coast",
      "aodn:mission-beach",
      "aodn:port-fairy",
      "aodn:tathra",
      "aodn:wooli",
    ]);
    expect(byId.get("aodn:wooli")).toMatchObject({
      slug: "wooli",
      country_code: "AU",
      region: null,
      license: "CC-BY-4.0",
      has_swell_split: false,
      owner: "IMOS Coastal Wave Buoys Facility",
    });
    expect(byId.get("aodn:tathra")?.attribution).toMatch(/^NSW wave data sourced from IMOS were collected, processed and provided by the NSW Nearshore Wave Data Program/);
    for (const row of plan.rows) expect(row.attribution).toContain("Integrated Marine Observing System (IMOS)");
    expect(aodnStationId("Victor Harbouroffshore")).toBe("victor-harbouroffshore");
  });
});
