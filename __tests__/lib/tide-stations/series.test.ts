import { predictorConstituentName } from "@/lib/tide-stations/harmonics";
import { computeHarmonicSeries } from "@/lib/tide-stations/predictions";
import {
  classifyFormFactor,
  classifyTideTypeFromConstituents,
  classifyTideTypeFromExtremes,
  groupExtremesByLocalDay,
  summarizeRange,
  tideStateAt,
  type TideExtremePoint,
} from "@/lib/tide-stations/series";
import { formatStationTime } from "@/lib/tide-stations/format";
import type { TideStationRow } from "@/lib/tide-stations/types";

const HOUR = 3_600_000;
const T0 = Date.parse("2026-11-10T00:00:00Z");

function extremesEvery(hours: number, count: number, high: number, low: number, inequality = 0): TideExtremePoint[] {
  return Array.from({ length: count }, (_, i) => {
    const isHigh = i % 2 === 0;
    const bump = isHigh && Math.floor(i / 2) % 2 === 1 ? -inequality : 0;
    return {
      ts: new Date(T0 + i * hours * HOUR).toISOString(),
      type: isHigh ? "high" : "low",
      heightM: isHigh ? high + bump : low,
    } as TideExtremePoint;
  });
}

function station(overrides: Partial<TideStationRow>): TideStationRow {
  return {
    id: "ticon:test-tst-xxx-bodc",
    source: "ticon",
    source_station_id: "test-tst-xxx-bodc",
    name: "Test",
    slug: "test-tst-xxx-bodc",
    country_code: "GB",
    country_slug: "united-kingdom",
    region: null,
    region_slug: null,
    lat: 50,
    lon: -4,
    timezone: "Europe/London",
    station_kind: "harmonic-model",
    reference_station_id: null,
    datum_label: "MLLW (computed)",
    datum_offset_m: 1,
    constituents: [{ name: "M2", amplitudeM: 1, phaseDeg: 0 }],
    operator: "British Oceanographic Data Centre",
    licence: "cc-by-4.0",
    licence_url: "https://creativecommons.org/licenses/by/4.0/",
    attribution: "x",
    commercial_use: true,
    active: true,
    ...overrides,
  };
}

describe("tide type", () => {
  it("uses the Courtier form factor bands", () => {
    expect(classifyFormFactor(0.1)).toBe("semidiurnal");
    expect(classifyFormFactor(0.8)).toBe("mixed-semidiurnal");
    expect(classifyFormFactor(2)).toBe("mixed-diurnal");
    expect(classifyFormFactor(3.5)).toBe("diurnal");
  });

  it("classifies from constituents and reports the form factor", () => {
    const result = classifyTideTypeFromConstituents([
      { name: "M2", amplitudeM: 0.5, phaseDeg: 0 },
      { name: "S2", amplitudeM: 0.2, phaseDeg: 0 },
      { name: "K1", amplitudeM: 0.35, phaseDeg: 0 },
      { name: "O1", amplitudeM: 0.21, phaseDeg: 0 },
    ]);
    expect(result).toEqual({ type: "mixed-semidiurnal", formFactor: 0.8, basis: "constituents" });
  });

  it("classifies regular twice-daily extremes as semidiurnal", () => {
    expect(classifyTideTypeFromExtremes(extremesEvery(6.21, 28, 2, 0))?.type).toBe("semidiurnal");
  });

  it("classifies unequal twice-daily highs as mixed", () => {
    expect(classifyTideTypeFromExtremes(extremesEvery(6.21, 28, 2, 0, 0.9))?.type).toBe("mixed-semidiurnal");
  });

  it("classifies one high a day as diurnal", () => {
    expect(classifyTideTypeFromExtremes(extremesEvery(12.42, 14, 1, 0))?.type).toBe("diurnal");
  });

  it("returns null when there is too little data", () => {
    expect(classifyTideTypeFromExtremes(extremesEvery(6.21, 3, 2, 0))).toBeNull();
  });
});

describe("tide state and grouping", () => {
  const extremes = extremesEvery(6, 8, 1.8, 0.2);

  it("is rising before a high and names the next extreme", () => {
    const state = tideStateAt(extremes, T0 + 7 * HOUR);
    expect(state?.direction).toBe("rising");
    expect(state?.next.ts).toBe(new Date(T0 + 12 * HOUR).toISOString());
    expect(state?.previous?.type).toBe("low");
  });

  it("is falling before a low", () => {
    expect(tideStateAt(extremes, T0 + 1 * HOUR)?.direction).toBe("falling");
  });

  it("returns null past the end of the series", () => {
    expect(tideStateAt(extremes, T0 + 100 * HOUR)).toBeNull();
  });

  it("groups by the station's local day, not UTC", () => {
    // 00:00Z and 06:00Z on Nov 10 are still Nov 9 in Los Angeles (UTC-8).
    const days = groupExtremesByLocalDay(extremes, "America/Los_Angeles", T0 - 12 * HOUR, 7);
    expect(days[0].dateKey).toBe("2026-11-09");
    expect(days[0].extremes).toHaveLength(2);
    expect(days[1].dateKey).toBe("2026-11-10");
  });

  it("summarises ranges between consecutive highs and lows", () => {
    const range = summarizeRange(extremes);
    expect(range?.meanRangeM).toBeCloseTo(1.6);
    expect(range?.highestM).toBe(1.8);
    expect(range?.lowestM).toBe(0.2);
  });

  it("formats station-local times with a plain space", () => {
    expect(formatStationTime("2026-11-10T00:30:00Z", "America/Los_Angeles")).toBe("4:30 PM");
  });
});

describe("harmonic predictions", () => {
  it("maps TICON constituent spellings onto the predictor's names", () => {
    expect(predictorConstituentName("M2")).toBe("M2");
    expect(predictorConstituentName("EPS2")).toBe("eps2");
    expect(predictorConstituentName("LDA2")).toBe("LAMBDA2");
    expect(predictorConstituentName("NOT_A_TIDE")).toBeNull();
  });

  it("predicts M2 highs and lows a half lunar day apart around the datum offset", () => {
    const series = computeHarmonicSeries(station({}), T0);
    expect(series.status).toBe("ok");
    if (series.status !== "ok") return;
    const highs = series.extremes.filter((e) => e.type === "high");
    const lows = series.extremes.filter((e) => e.type === "low");
    // offset 1 m + amplitude 1 m (nodal factor keeps M2 within a few percent)
    for (const h of highs) expect(h.heightM).toBeGreaterThan(1.9);
    for (const l of lows) expect(l.heightM).toBeLessThan(0.1);
    const gapHours = (Date.parse(highs[1].ts) - Date.parse(highs[0].ts)) / HOUR;
    expect(gapHours).toBeCloseTo(12.42, 1);
    expect(series.hourly.length).toBeGreaterThan(9 * 24);
    expect(series.adjustmentFt).toBe(0);
  });

  it("fails clearly when a computed station has no constants", () => {
    expect(computeHarmonicSeries(station({ constituents: null }), T0)).toEqual({
      status: "failed",
      reason: "no-constituents",
    });
  });
});
