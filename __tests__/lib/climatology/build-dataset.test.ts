import { buildSurfClimatologyDataset } from "@/lib/climatology/build-dataset";
import { datasetToCsv } from "@/lib/climatology/csv";
import type { CityClimatologyConfig, ClimatologySourceConfig } from "@/lib/climatology/sources";
import { utcHours } from "./__fixtures__/observations";

const YEARS = [2020, 2024] as const;
const source = (id: string, role: ClimatologySourceConfig["role"]): ClimatologySourceConfig => ({
  id,
  alias: null,
  name: `Station ${id}`,
  role,
  kind: "ndbc",
  lat: 28.4,
  lon: -80.533,
  years: YEARS,
  pageUrl: `https://example.test/${id}`,
});

const CITY: CityClimatologyConfig = {
  citySlug: "test-beach",
  cityName: "Test Beach",
  timezone: "Etc/UTC",
  reference: { label: "Test Pier", lat: 28.367648, lon: -80.602777 },
  places: [{ label: "Test Pier", lat: 28.367648, lon: -80.602777 }],
  shoreNormalDeg: 90,
  sources: [source("W1", "waves"), source("C1", "comparison-waves"), source("WIND1", "wind")],
};

// 1.0 m all the time, 12 s swell on days divisible by 3, 24 °C water.
const waves = utcHours(YEARS, (date) => ({
  waveHeightM: 1,
  dominantPeriodS: date.getUTCDate() % 3 === 0 ? 12 : 6,
  meanWaveDirDeg: 90,
  waterTempC: 24,
}));
// Only the first two weeks of each month: fails the 90% gate.
const patchyComparison = utcHours(YEARS, (date) => ({
  waveHeightM: date.getUTCDate() <= 14 ? 1 : null,
}));
// Offshore dawn, onshore afternoon: a clear sea breeze.
const seaBreezeWind = utcHours(YEARS, (date) => {
  const hour = date.getUTCHours();
  if (hour >= 6 && hour <= 8) return { windDirDeg: 270, windSpeedKt: 10 };
  if (hour >= 15 && hour <= 17) return { windDirDeg: 90, windSpeedKt: 12 };
  return { windDirDeg: 0, windSpeedKt: 3 };
});
const flatWind = utcHours(YEARS, () => ({ windDirDeg: 270, windSpeedKt: 10 }));

const build = (wind = seaBreezeWind) =>
  buildSurfClimatologyDataset({
    city: CITY,
    generatedAt: "2026-09-26",
    series: [
      { source: CITY.sources[0], hourly: waves },
      { source: CITY.sources[1], hourly: patchyComparison },
      { source: CITY.sources[2], hourly: wind },
    ],
  });

// Five years of hourly data per source; build each variant once.
const SEA_BREEZE_DATASET = build();
const FLAT_WIND_DATASET = build(flatWind);

describe("buildSurfClimatologyDataset", () => {
  it("gates each station and scores every month", () => {
    const dataset = SEA_BREEZE_DATASET;

    expect(dataset.stations.map((s) => [s.id, s.gate])).toEqual([
      ["W1", "passed"],
      ["C1", "failed"],
      ["WIND1", "passed"],
    ]);
    expect(dataset.stations[0]).toMatchObject({ distanceKm: 7.7, referenceLabel: "Test Pier", yearsUsed: [2020, 2024] });
    expect(dataset.months).toHaveLength(12);
    expect(dataset.months.every((m) => m.comparisonWaves === null)).toBe(true);
    expect(dataset.months[0].water?.medianF).toBe(75);
    expect(dataset.months[0].wind?.cleanMorningShare).toBe(1);
    expect(dataset.months[0].waves?.threeFootDaysBySector.E).toBe(1);
    // 100 x (0.45 x 1 + 0.25 x 0.32 + 0.20 x 1 + 0.10 x 0.93) = 82.3
    expect(dataset.months[0].score).toBe(82);
  });

  it("drops wind and rescales the score when the wind shows no sea breeze", () => {
    const dataset = FLAT_WIND_DATASET;

    expect(dataset.stations[2].gate).toBe("failed");
    expect(dataset.months[0].wind).toBeNull();
    // 100 x (0.45 + 0.08 + 0.093) / 0.8 = 77.9
    expect(dataset.months[0].score).toBe(78);
  });

  it("stops when the primary buoy fails its gate", () => {
    const patchyWaves = utcHours(YEARS, (date) => ({ waveHeightM: date.getUTCDate() <= 10 ? 1 : null }));
    expect(() =>
      buildSurfClimatologyDataset({
        city: { ...CITY, sources: [CITY.sources[0]] },
        generatedAt: "2026-09-26",
        series: [{ source: CITY.sources[0], hourly: patchyWaves }],
      }),
    ).toThrow("W1 failed its coverage gate");
  });
});

describe("datasetToCsv", () => {
  it("writes a commented header and one row per month for passing wave stations", () => {
    const lines = datasetToCsv(SEA_BREEZE_DATASET).trimEnd().split("\n");
    const comments = lines.filter((line) => line.startsWith("#"));
    const rows = lines.filter((line) => !line.startsWith("#"));

    expect(comments.join("\n")).toContain("not surf height at the beach");
    expect(comments.join("\n")).toContain("gate failed");
    expect(rows[0].split(",")[0]).toBe("month");
    expect(rows[0]).toContain("days_3ft_s_share");
    expect(rows).toHaveLength(13);
    expect(rows[1].startsWith("1,W1,waves,3.3,")).toBe(true);
    expect(rows[1].endsWith(",75,75,75,1,82")).toBe(true);
  });
});
