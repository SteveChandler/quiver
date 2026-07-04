import type { EnhancedForecastEntity } from "@/types/forecast";
import {
  parsePeriodSeconds,
  parseWaveHeightRangeFt,
} from "@/lib/alerts/forecast-parsers";
import { detectSwellWatch } from "@/lib/alerts/swell-watch-detector";

const TIMEZONE = "America/Los_Angeles";
const NOW = new Date("2026-07-01T15:00:00.000Z");

function dateKey(offset: number): string {
  const date = new Date("2026-07-01T00:00:00.000Z");
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

function forecastAt(offset: number, hourUtc = 19): string {
  return `${dateKey(offset)}T${String(hourUtc).padStart(2, "0")}:00:00.000Z`;
}

function row(
  offset: number,
  waveHeight: string | null,
  period: string | null,
  overrides: Partial<EnhancedForecastEntity> = {}
): EnhancedForecastEntity {
  return {
    id: `forecast-${offset}-${waveHeight ?? "none"}-${period ?? "none"}`,
    beach_id: "beach-1",
    forecast_at: forecastAt(offset),
    forecast_date: dateKey(offset),
    forecast_time: "12:00",
    wave_height: waveHeight,
    wave_period: period,
    wave_direction: null,
    wind_direction_deg: null,
    swell_1_height: null,
    swell_1_period: period,
    swell_1_direction: null,
    water_temp: null,
    air_temperature: null,
    wind_speed: null,
    wind_direction: null,
    tide_status: null,
    tide_height: null,
    confidence_score: null,
    data_source: "NOAA_NWS",
    created_at: "2026-07-01T00:00:00.000Z",
    updated_at: "2026-07-01T00:00:00.000Z",
    ...overrides,
  };
}

function run(forecasts: EnhancedForecastEntity[]) {
  return detectSwellWatch({ forecasts, timezone: TIMEZONE, now: NOW });
}

describe("detectSwellWatch", () => {
  it("returns null for a flat 2 ft / 8 s week", () => {
    expect(run(Array.from({ length: 6 }, (_, index) => row(index, "2 ft", "8s")))).toBeNull();
  });

  it("detects a future jump and picks the highest peak day in the swell run", () => {
    const result = run([
      row(0, "2 ft", "8s"),
      row(1, "2 ft", "8s"),
      row(2, "2 ft", "8s"),
      row(3, "2 ft", "8s"),
      row(4, "5 ft", "15s"),
      row(5, "6 ft", "14s"),
      row(6, "3 ft", "12s"),
    ]);

    expect(result).toMatchObject({
      eventStartDate: dateKey(4),
      peakDate: dateKey(5),
      peakHeightFt: 6,
      peakPeriodS: 14,
      peakForecastAt: forecastAt(5),
      baselineHeightFt: 2,
    });
  });

  it("guards against a big day-0 CDIP cliff faking a future swell", () => {
    expect(
      run([
        row(0, "5 ft", "15s"),
        row(1, "2 ft", "8s"),
        row(2, "2 ft", "8s"),
        row(3, "2 ft", "8s"),
        row(4, "4 ft", "15s"),
      ])
    ).toBeNull();
  });

  it("rejects short-period wind slop even when height rises", () => {
    expect(
      run([
        row(0, "2 ft", "8s"),
        row(1, "2 ft", "8s"),
        row(2, "2 ft", "8s"),
        row(3, "4 ft", "6s"),
        row(4, "2 ft", "8s"),
      ])
    ).toBeNull();
  });

  it("returns null when day-0 or day-1 rows are missing", () => {
    expect(
      run([row(1, "2 ft", "8s"), row(2, "5 ft", "15s"), row(3, "5 ft", "15s")])
    ).toBeNull();

    expect(
      run([row(0, "2 ft", "8s"), row(2, "5 ft", "15s"), row(3, "5 ft", "15s")])
    ).toBeNull();
  });

  it("skips unparseable rows without crashing", () => {
    const result = run([
      row(0, "2 ft", "8s"),
      row(1, "2 ft", "8s"),
      row(2, "calf high", "8s"),
      row(3, "5 ft", "garbage"),
      row(4, "5 ft", "15s"),
      row(5, "4 ft", "13s"),
    ]);

    expect(result).toMatchObject({
      eventStartDate: dateKey(4),
      peakDate: dateKey(4),
      peakHeightFt: 5,
      peakPeriodS: 15,
    });
  });

  it("uses the upper bound of range heights for peak decisions", () => {
    const result = run([
      row(0, "2 ft", "8s"),
      row(1, "2 ft", "8s"),
      row(2, "3-5 ft", "15s"),
      row(3, "3 ft", "12s"),
    ]);

    expect(result).toMatchObject({
      eventStartDate: dateKey(2),
      peakDate: dateKey(2),
      peakHeightFt: 5,
      baselineHeightFt: 2,
    });
  });
});

describe("Swell Watch forecast parser helpers", () => {
  it("parses wave-height ranges", () => {
    expect(parseWaveHeightRangeFt("1-2ft")).toEqual({ min: 1, max: 2 });
    expect(parseWaveHeightRangeFt("3 ft")).toEqual({ min: 3, max: 3 });
    expect(parseWaveHeightRangeFt("calf high")).toBeNull();
  });

  it("parses period strings", () => {
    expect(parsePeriodSeconds("15s")).toBe(15);
    expect(parsePeriodSeconds("8")).toBe(8);
    expect(parsePeriodSeconds("garbage")).toBeNull();
  });
});
