/**
 * @jest-environment node
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { planRegistryUpsert } from "@/lib/services/wave-stations/catalogue";
import { fmiAdapter, fmiUrl } from "@/lib/services/wave-stations/fmi/adapter";
import {
  FMI_ATTRIBUTION,
  fmiObservations,
  fmiStations,
  parseFmiCoverage,
} from "@/lib/services/wave-stations/fmi/parsers";

const dir = path.join(__dirname, "../../../fixtures/fmi-wave-stations");
const xml = readFileSync(path.join(dir, "wave-multipointcoverage.xml"), "utf8");

describe("FMI wave coverage parser", () => {
  it("documents the direction convention in FMI's own metadata", () => {
    // "Aallokon tulosuunta" = the direction the waves come FROM; WHDD is its spread.
    const meta = readFileSync(path.join(dir, "observable-properties-fin.xml"), "utf8");
    expect(meta).toContain("Aallokon tulosuunta");
    expect(meta).toContain("Aallokon tulosuunnan hajonta");
  });

  it("maps Hs, modal period, modal FROM direction and water temperature per buoy", () => {
    const obs = fmiObservations(parseFmiCoverage(xml));
    const north = obs.find((o) => o.sourceStationId === "134220" && o.observedAt === "2026-11-11T00:30:00.000Z");
    expect(north?.values).toEqual({
      wave_height_m: 0.8,
      dominant_period_s: 5.7,
      mean_wave_direction_deg: 185,
      water_temp_c: 11,
    });
    // NaN is missing: temperature-only rows carry no wave keys.
    expect(obs.some((o) => !("wave_height_m" in o.values) && o.values.water_temp_c != null)).toBe(true);
    expect(obs.every((o) => Object.values(o.values).every((v) => v === null || Number.isFinite(v as number)))).toBe(true);
  });

  it("lists only buoys that reported waves, with English names for the open-sea ones", () => {
    const stations = fmiStations(parseFmiCoverage(xml));
    expect(stations.map((s) => [s.sourceStationId, s.name])).toEqual(
      expect.arrayContaining([
        ["134220", "Northern Baltic Proper"],
        ["134221", "Gulf of Finland"],
        ["134246", "Bothnian Sea"],
        ["137228", "Bay of Bothnia"],
      ]),
    );
    expect(stations.some((s) => s.sourceStationId === "103807")).toBe(false); // Oulu: water temperature only
    const plan = planRegistryUpsert("fmi", stations, [], Date.now());
    expect(plan.rows.find((row) => row.id === "fmi:134221")).toMatchObject({
      slug: "gulf-of-finland-134221",
      country_code: "FI",
      license: "CC-BY-4.0",
      attribution: FMI_ATTRIBUTION,
      has_swell_split: false,
    });
  });

  it("returns no rows for a feature collection without members (buoys lifted for the ice season)", () => {
    // Synthetic: the WFS 2.0 empty-result shape; a live empty window could not be requested.
    const empty = '<?xml version="1.0"?><wfs:FeatureCollection numberMatched="0" numberReturned="0" xmlns:wfs="http://www.opengis.net/wfs/2.0"></wfs:FeatureCollection>';
    const coverage = parseFmiCoverage(empty);
    expect(fmiObservations(coverage)).toEqual([]);
    expect(fmiStations(coverage)).toEqual([]);
  });

  it("fails on an exception report or a missing field", () => {
    expect(() => parseFmiCoverage("<ExceptionReport>bad</ExceptionReport>")).toThrow(/exception/);
    expect(() => parseFmiCoverage(xml.replace('<swe:field name="WTP"', '<swe:field name="X"'))).toThrow(/WTP missing/);
  });

  it("asks one bulk query for the wanted parameters only", () => {
    const url = new URL(fmiUrl(Date.parse("2026-11-10T23:30:00Z")));
    expect(url.searchParams.get("parameters")).toBe("WaveHs,WTP,ModalWDi,TWATER");
    expect(url.searchParams.get("starttime")).toBe("2026-11-10T23:30:00Z");
    expect(fmiAdapter.latestEveryMinutes).toBe(30);
  });
});
