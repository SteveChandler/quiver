import type {
  ClimatologyStation,
  SurfClimatologyDataset,
  WaveMonthStats,
} from "@/lib/climatology/types";

export function waveStats(overrides: Partial<WaveMonthStats> = {}): WaveMonthStats {
  return {
    hsFt: { median: 2.4, p25: 1.8, p75: 3.3, p90: 4.6 },
    smallDayShare: 0.3,
    bigDayShare: 0.05,
    periodMix: { under8: 0.6, from8to10: 0.25, atLeast10: 0.15 },
    directionMix: { N: 0.1, NE: 0.3, E: 0.3, SE: 0.2, S: 0.05, SW: 0, W: 0, NW: 0.05 },
    threeFootDaysBySector: { N: 0, NE: 0.05, E: 0.1, SE: 0.05, S: 0, SW: 0, W: 0, NW: 0 },
    yearlyMedianFt: [],
    observedDays: 150,
    validHours: 3600,
    stationMonths: 5,
    ...overrides,
  };
}

export function station(overrides: Partial<ClimatologyStation> = {}): ClimatologyStation {
  return {
    id: "41113",
    alias: "CDIP 143",
    name: "Cape Canaveral Nearshore",
    role: "waves",
    kind: "ndbc",
    lat: 28.4,
    lon: -80.533,
    distanceKm: 7.7,
    referenceLabel: "Cocoa Beach Pier",
    yearsUsed: [2007, 2025],
    pageUrl: "https://www.ndbc.noaa.gov/station_page.php?station=41113",
    gate: "passed",
    gateCoverage: 0.93,
    validHours: 150000,
    excludedStationMonths: [],
    ...overrides,
  };
}

/** A Cocoa-like dataset with the given monthly scores (null = not enough data). */
export function makeDataset(
  scores: Array<number | null>,
  overrides: Partial<SurfClimatologyDataset> = {},
): SurfClimatologyDataset {
  return {
    schemaVersion: 1,
    scoreVersion: "buoy-v1",
    citySlug: "cocoa-beach",
    cityName: "Cocoa Beach",
    generatedAt: "2026-09-26",
    timezone: "America/New_York",
    shoreNormalDeg: 87,
    reference: { label: "Cocoa Beach Pier", lat: 28.367648, lon: -80.602777 },
    places: [
      { label: "Cocoa Beach Pier", lat: 28.367648, lon: -80.602777 },
      { label: "Satellite Beach", lat: 28.1707, lon: -80.5913 },
    ],
    stations: [station()],
    months: scores.map((score, index) => ({
      month: index + 1,
      waves: score === null ? null : waveStats(index === 5 ? { smallDayShare: 0.6 } : {}),
      comparisonWaves: null,
      water: score === null ? null : { medianF: 70 + index, p10F: 66 + index, p90F: 74 + index, validHours: 700 },
      wind: null,
      score,
    })),
    ...overrides,
  };
}
