/**
 * @jest-environment node
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { planRegistryUpsert } from "@/lib/services/wave-stations/catalogue";
import { smhiAdapter, smhiLatestUrl } from "@/lib/services/wave-stations/smhi/adapter";
import { mergeSmhiData, parseSmhiStations } from "@/lib/services/wave-stations/smhi/parsers";

const dir = path.join(__dirname, "../../../fixtures/smhi-wave-stations");
const json = (name: string): unknown => JSON.parse(readFileSync(path.join(dir, name), "utf8"));
const answers = () => ({
  "1": json("parameter-1-latest-day.json"),
  "8": json("parameter-8-latest-day.json"),
  "9": json("parameter-9-latest-day.json"),
  "10": json("parameter-10-latest-day.json"),
});
const NOW = Date.parse("2026-11-11T05:30:00Z");

describe("SMHI parsers", () => {
  it("lists active wave-height stations from the last 30 days, credited to SMHI and the owner", () => {
    const stations = parseSmhiStations(json("parameter-1-stations.json"), NOW);
    expect(stations.map((s) => [s.sourceStationId, s.name]).sort()).toEqual([
      ["33002", "Huvudskär Ost"],
      ["33003", "Finngrundet"],
      ["33008", "Knolls Grund"],
      ["33015", "Väderöarna 3"],
      ["33033", "Brofjorden"],
    ]);
    const plan = planRegistryUpsert("smhi", stations, [], NOW);
    expect(plan.rows.find((row) => row.id === "smhi:33033")).toMatchObject({
      slug: "brofjorden-33033",
      country_code: "SE",
      license: "CC-BY-4.0",
      attribution: "SMHI (Swedish Meteorological and Hydrological Institute); station owned by Sjöfartsverket",
      has_swell_split: false,
    });
  });

  it("merges the four parameters into one row per station and hour", () => {
    const rows = mergeSmhiData(answers());
    const newest = rows.filter((row) => row.sourceStationId === "33015").at(-1);
    expect(newest).toEqual({
      sourceStationId: "33015",
      observedAt: "2026-11-11T05:00:00.000Z",
      values: {
        wave_height_m: 0.41,
        dominant_period_s: 3.59,
        average_period_s: 3.38,
        // FROM the SW: the open Skagerrak side of the west-coast buoy.
        mean_wave_direction_deg: 233.44,
      },
    });
  });

  it("drops suspect (Y) values and out-of-range numbers", () => {
    const data = answers();
    const hs = data["1"] as { station: Array<{ key: string; value: Array<{ date: number; value: number; quality: string }> }> };
    const station = hs.station.find((s) => s.key === "33015");
    if (!station) throw new Error("fixture missing");
    station.value[station.value.length - 1].quality = "Y";
    station.value[station.value.length - 2].value = -999;
    const rows = mergeSmhiData(data).filter((row) => row.sourceStationId === "33015");
    expect(rows.at(-1)?.values.wave_height_m).toBeUndefined();
    expect(rows.at(-2)?.values.wave_height_m).toBeUndefined();
  });

  it("fails when a unit or parameter changes", () => {
    const wrongUnit = answers();
    (wrongUnit["1"] as { parameter: { unit: string } }).parameter.unit = "cm";
    expect(() => mergeSmhiData(wrongUnit)).toThrow(/unit is "cm"/);
    const swapped = answers();
    swapped["9"] = json("parameter-10-latest-day.json");
    expect(() => mergeSmhiData(swapped)).toThrow(/answer is for 10/);
  });

  it("asks one station-set request per parameter, hourly", () => {
    expect(smhiLatestUrl("1")).toBe(
      "https://opendata-download-ocobs.smhi.se/api/version/latest/parameter/1/station-set/all/period/latest-day/data.json",
    );
    expect(smhiAdapter.latestEveryMinutes).toBe(60);
  });
});
