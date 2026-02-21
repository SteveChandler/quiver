/**
 * Tests for surf-terminal data transformation layer.
 *
 * Covers:
 *  - parseNumericValue  – string → number extraction
 *  - classifyWindDirection – offshore / onshore / cross-shore
 *  - transformForecastsToChartData – full pipeline
 */

import type { EnhancedForecastEntity } from "@/types/forecast";
import {
  parseNumericValue,
  classifyWindDirection,
  transformForecastsToChartData,
  utcToLocalChartTimestamp,
  localChartTimestampToUtc,
  smoothSeries,
  type BeachChartConfig,
  type SurfTerminalData,
  WIND_COLORS,
  LOOKBACK_HOURS,
} from "@/app/embed/surf-terminal/[slug]/data-transform";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal forecast entity with sensible defaults. */
function makeForecast(
  overrides: Partial<EnhancedForecastEntity> & { forecast_at: string }
): EnhancedForecastEntity {
  return {
    id: "fc-1",
    beach_id: "beach-1",
    forecast_date: "",
    forecast_time: "",
    wave_height: null,
    confidence_score: null,
    data_source: "NOAA_NWS",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    water_temp: null,
    ...overrides,
  };
}

const DEFAULT_CONFIG: BeachChartConfig = {
  windOffshoreDeg: 90, // east-facing beach
  windOffshoreTolDeg: 45,
  timezone: "America/Los_Angeles",
};

// ---------------------------------------------------------------------------
// parseNumericValue
// ---------------------------------------------------------------------------

describe("parseNumericValue", () => {
  it('parses plain number with units – "3.5 ft"', () => {
    expect(parseNumericValue("3.5 ft")).toBe(3.5);
  });

  it('averages a range – "3-5 ft"', () => {
    expect(parseNumericValue("3-5 ft")).toBe(4);
  });

  it('parses seconds notation – "12s"', () => {
    expect(parseNumericValue("12s")).toBe(12);
  });

  it('parses mph notation – "8 mph"', () => {
    expect(parseNumericValue("8 mph")).toBe(8);
  });

  it("returns null for null input", () => {
    expect(parseNumericValue(null)).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(parseNumericValue("")).toBeNull();
  });

  it("returns null for undefined input", () => {
    expect(parseNumericValue(undefined)).toBeNull();
  });

  it('returns null for "N/A"', () => {
    expect(parseNumericValue("N/A")).toBeNull();
  });

  it("handles integer without units – '7'", () => {
    expect(parseNumericValue("7")).toBe(7);
  });

  it("handles decimal without units – '2.3'", () => {
    expect(parseNumericValue("2.3")).toBe(2.3);
  });

  it('handles range with decimal – "1.5-3.5 ft"', () => {
    expect(parseNumericValue("1.5-3.5 ft")).toBe(2.5);
  });

  it("handles whitespace-only string", () => {
    expect(parseNumericValue("   ")).toBeNull();
  });

  it('handles leading/trailing whitespace – " 4.2 ft "', () => {
    expect(parseNumericValue(" 4.2 ft ")).toBe(4.2);
  });

  it('handles zero value – "0 ft"', () => {
    expect(parseNumericValue("0 ft")).toBe(0);
  });

  it('handles negative value – "-1.2 ft"', () => {
    expect(parseNumericValue("-1.2 ft")).toBe(-1.2);
  });

  it("returns null for non-numeric garbage", () => {
    expect(parseNumericValue("flat")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// classifyWindDirection
// ---------------------------------------------------------------------------

describe("classifyWindDirection", () => {
  // Beach faces west, offshore = 90° (east)
  const offshore = 90;
  const tolerance = 45;

  it("classifies wind matching offshore direction as offshore", () => {
    expect(classifyWindDirection(90, offshore, tolerance)).toBe("offshore");
  });

  it("classifies wind within tolerance of offshore as offshore", () => {
    expect(classifyWindDirection(80, offshore, tolerance)).toBe("offshore");
    expect(classifyWindDirection(100, offshore, tolerance)).toBe("offshore");
    expect(classifyWindDirection(135, offshore, tolerance)).toBe("offshore");
    expect(classifyWindDirection(45, offshore, tolerance)).toBe("offshore");
  });

  it("classifies wind 180° from offshore as onshore", () => {
    // Onshore direction = (90 + 180) % 360 = 270
    expect(classifyWindDirection(270, offshore, tolerance)).toBe("onshore");
  });

  it("classifies wind within tolerance of onshore as onshore", () => {
    expect(classifyWindDirection(260, offshore, tolerance)).toBe("onshore");
    expect(classifyWindDirection(280, offshore, tolerance)).toBe("onshore");
    expect(classifyWindDirection(315, offshore, tolerance)).toBe("onshore");
    expect(classifyWindDirection(225, offshore, tolerance)).toBe("onshore");
  });

  it("classifies wind at ~90° from offshore as cross-shore", () => {
    // 90° from offshore (90) → 0° or 180°
    expect(classifyWindDirection(180, offshore, tolerance)).toBe("cross-shore");
    expect(classifyWindDirection(0, offshore, tolerance)).toBe("cross-shore");
  });

  it("handles 0°/360° wrap-around", () => {
    // Beach offshore = 350°, tolerance = 30°
    // Offshore zone: 320–380 (i.e. 320–360 + 0–20)
    expect(classifyWindDirection(5, 350, 30)).toBe("offshore");
    expect(classifyWindDirection(340, 350, 30)).toBe("offshore");
    // Onshore = (350+180)%360 = 170, tolerance 30 → 140-200
    expect(classifyWindDirection(170, 350, 30)).toBe("onshore");
  });

  it("edge case: wind exactly at tolerance boundary of offshore", () => {
    // angleDiff(135, 90) = 45, which equals tolerance → still offshore
    expect(classifyWindDirection(135, offshore, tolerance)).toBe("offshore");
  });

  it("edge case: wind just beyond tolerance of offshore", () => {
    // angleDiff(136, 90) = 46 > 45 → not offshore
    const result = classifyWindDirection(136, offshore, tolerance);
    expect(result).not.toBe("offshore");
  });

  it("works with 0 tolerance (exact match only)", () => {
    expect(classifyWindDirection(90, 90, 0)).toBe("offshore");
    expect(classifyWindDirection(270, 90, 0)).toBe("onshore");
    expect(classifyWindDirection(91, 90, 0)).toBe("cross-shore");
  });
});

// ---------------------------------------------------------------------------
// utcToLocalChartTimestamp / localChartTimestampToUtc
// ---------------------------------------------------------------------------

describe("utcToLocalChartTimestamp", () => {
  it("shifts UTC to PST (UTC-8) correctly", () => {
    // 2026-02-18T13:00:00Z → 05:00 AM PST
    const utcSec = Math.floor(new Date("2026-02-18T13:00:00Z").getTime() / 1000);
    const result = utcToLocalChartTimestamp(utcSec, "America/Los_Angeles");
    const expected = Math.floor(Date.UTC(2026, 1, 18, 5, 0, 0) / 1000);
    expect(result).toBe(expected);
  });

  it("handles DST transition (PDT, UTC-7)", () => {
    // July 15 2026 20:00:00Z → 13:00 PDT
    const utcSec = Math.floor(new Date("2026-07-15T20:00:00Z").getTime() / 1000);
    const result = utcToLocalChartTimestamp(utcSec, "America/Los_Angeles");
    const expected = Math.floor(Date.UTC(2026, 6, 15, 13, 0, 0) / 1000);
    expect(result).toBe(expected);
  });

  it("handles Hawaii timezone (no DST, UTC-10)", () => {
    const utcSec = Math.floor(new Date("2026-02-18T13:00:00Z").getTime() / 1000);
    const result = utcToLocalChartTimestamp(utcSec, "Pacific/Honolulu");
    const expected = Math.floor(Date.UTC(2026, 1, 18, 3, 0, 0) / 1000);
    expect(result).toBe(expected);
  });

  it("handles day boundary crossing", () => {
    // 2026-02-18T02:00:00Z in PST = 2026-02-17 18:00
    const utcSec = Math.floor(new Date("2026-02-18T02:00:00Z").getTime() / 1000);
    const result = utcToLocalChartTimestamp(utcSec, "America/Los_Angeles");
    const expected = Math.floor(Date.UTC(2026, 1, 17, 18, 0, 0) / 1000);
    expect(result).toBe(expected);
  });
});

describe("localChartTimestampToUtc", () => {
  it("round-trips through utcToLocalChartTimestamp for PST", () => {
    const utcSec = Math.floor(new Date("2026-02-18T13:00:00Z").getTime() / 1000);
    const fakeUtc = utcToLocalChartTimestamp(utcSec, "America/Los_Angeles");
    const roundTripped = localChartTimestampToUtc(fakeUtc, "America/Los_Angeles");
    expect(roundTripped).toBe(utcSec);
  });

  it("round-trips for Hawaii timezone", () => {
    const utcSec = Math.floor(new Date("2026-02-18T13:00:00Z").getTime() / 1000);
    const fakeUtc = utcToLocalChartTimestamp(utcSec, "Pacific/Honolulu");
    const roundTripped = localChartTimestampToUtc(fakeUtc, "Pacific/Honolulu");
    expect(roundTripped).toBe(utcSec);
  });
});

// ---------------------------------------------------------------------------
// smoothSeries
// ---------------------------------------------------------------------------

describe("smoothSeries", () => {
  it("returns empty array for empty input", () => {
    expect(smoothSeries([])).toEqual([]);
  });

  it("returns single point unchanged", () => {
    const points = [{ time: 100, value: 5 }];
    expect(smoothSeries(points)).toEqual(points);
  });

  it("produces stepsPerInterval * (n-1) + 1 output points", () => {
    const points = [
      { time: 0, value: 0 },
      { time: 3600, value: 10 },
      { time: 7200, value: 5 },
    ];
    const result = smoothSeries(points, 6);
    expect(result).toHaveLength(13);
  });

  it("preserves original endpoint values", () => {
    const points = [
      { time: 0, value: 0 },
      { time: 3600, value: 10 },
    ];
    const result = smoothSeries(points, 4);
    expect(result[0].value).toBe(0);
    expect(result[0].time).toBe(0);
    expect(result[result.length - 1].value).toBe(10);
    expect(result[result.length - 1].time).toBe(3600);
  });

  it("midpoint matches cosine interpolation formula", () => {
    const points = [
      { time: 0, value: 0 },
      { time: 100, value: 10 },
    ];
    const result = smoothSeries(points, 2);
    // At step=1, u=0.5: value = 0 + 10 * (1 - cos(PI*0.5)) / 2 = 5
    // Use toBeCloseTo because cos(PI*0.5) has floating-point rounding error
    expect(result[1].value).toBeCloseTo(5, 10);
    expect(result[1].time).toBe(50);
  });

  it("handles duplicate timestamps (dt=0) gracefully", () => {
    const points = [
      { time: 100, value: 3 },
      { time: 100, value: 4 },
    ];
    const result = smoothSeries(points, 6);
    // dt=0: first point kept as-is, plus final point = 2
    expect(result).toHaveLength(2);
    expect(result[0].value).toBe(3);
    expect(result[1].value).toBe(4);
  });

  it("output times are monotonically increasing", () => {
    const points = [
      { time: 0, value: 1 },
      { time: 3600, value: 5 },
      { time: 7200, value: 2 },
    ];
    const result = smoothSeries(points, 4);
    for (let i = 1; i < result.length; i++) {
      expect(result[i].time).toBeGreaterThanOrEqual(result[i - 1].time);
    }
  });
});

// ---------------------------------------------------------------------------
// transformForecastsToChartData
// ---------------------------------------------------------------------------

describe("transformForecastsToChartData", () => {
  // Use a fixed "now" so tests are deterministic
  const NOW = new Date("2026-02-18T12:00:00Z");

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(NOW);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("returns empty arrays for empty forecasts", () => {
    const result = transformForecastsToChartData([], DEFAULT_CONFIG, 48);
    expect(result.waveHeight).toEqual([]);
    expect(result.mlCorrectedHeight).toEqual([]);
    expect(result.tideHeight).toEqual([]);
    expect(result.windSpeed).toEqual([]);
    expect(result.swellPeriod).toEqual([]);
  });

  it("produces sorted waveHeight data points", () => {
    const forecasts = [
      makeForecast({
        forecast_at: "2026-02-18T15:00:00Z",
        wave_height: "5 ft",
      }),
      makeForecast({
        forecast_at: "2026-02-18T13:00:00Z",
        wave_height: "3 ft",
      }),
      makeForecast({
        forecast_at: "2026-02-18T14:00:00Z",
        wave_height: "4 ft",
      }),
    ];

    const result = transformForecastsToChartData(forecasts, DEFAULT_CONFIG, 48);
    expect(result.waveHeight.length).toBeGreaterThanOrEqual(3);

    // After smoothing, first and last values are preserved
    expect(result.waveHeight[0].value).toBe(3);
    expect(result.waveHeight[result.waveHeight.length - 1].value).toBe(5);

    // Time should be ascending throughout
    for (let i = 1; i < result.waveHeight.length; i++) {
      expect(result.waveHeight[i].time).toBeGreaterThanOrEqual(
        result.waveHeight[i - 1].time
      );
    }
  });

  it("produces tideHeight data points", () => {
    const forecasts = [
      makeForecast({
        forecast_at: "2026-02-18T13:00:00Z",
        tide_height: "4.2 ft",
      }),
    ];

    const result = transformForecastsToChartData(forecasts, DEFAULT_CONFIG, 48);
    expect(result.tideHeight).toHaveLength(1);
    expect(result.tideHeight[0].value).toBe(4.2);
  });

  it("produces windSpeed data with color based on wind direction", () => {
    const forecasts = [
      makeForecast({
        forecast_at: "2026-02-18T13:00:00Z",
        wind_speed: "10 mph",
        wind_direction_deg: 90, // offshore for DEFAULT_CONFIG
      }),
      makeForecast({
        forecast_at: "2026-02-18T14:00:00Z",
        wind_speed: "15 mph",
        wind_direction_deg: 270, // onshore for DEFAULT_CONFIG
      }),
      makeForecast({
        forecast_at: "2026-02-18T15:00:00Z",
        wind_speed: "8 mph",
        wind_direction_deg: 180, // cross-shore for DEFAULT_CONFIG
      }),
    ];

    const result = transformForecastsToChartData(forecasts, DEFAULT_CONFIG, 48);
    expect(result.windSpeed).toHaveLength(3);

    expect(result.windSpeed[0].value).toBe(10);
    expect(result.windSpeed[0].color).toBe(WIND_COLORS.offshore);

    expect(result.windSpeed[1].value).toBe(15);
    expect(result.windSpeed[1].color).toBe(WIND_COLORS.onshore);

    expect(result.windSpeed[2].value).toBe(8);
    expect(result.windSpeed[2].color).toBe(WIND_COLORS["cross-shore"]);
  });

  it("produces swellPeriod data points", () => {
    const forecasts = [
      makeForecast({
        forecast_at: "2026-02-18T13:00:00Z",
        swell_1_period: "14s",
      }),
    ];

    const result = transformForecastsToChartData(forecasts, DEFAULT_CONFIG, 48);
    expect(result.swellPeriod).toHaveLength(1);
    expect(result.swellPeriod[0].value).toBe(14);
  });

  it("handles range wave heights by averaging", () => {
    const forecasts = [
      makeForecast({
        forecast_at: "2026-02-18T13:00:00Z",
        wave_height: "3-5 ft",
      }),
    ];

    const result = transformForecastsToChartData(forecasts, DEFAULT_CONFIG, 48);
    expect(result.waveHeight).toHaveLength(1);
    expect(result.waveHeight[0].value).toBe(4);
  });

  it("skips null values – does not interpolate", () => {
    const forecasts = [
      makeForecast({
        forecast_at: "2026-02-18T13:00:00Z",
        wave_height: "3 ft",
        wind_speed: null,
        tide_height: null,
        swell_1_period: null,
      }),
      makeForecast({
        forecast_at: "2026-02-18T14:00:00Z",
        wave_height: null,
        wind_speed: "10 mph",
        wind_direction_deg: 90,
        tide_height: "2.5 ft",
      }),
    ];

    const result = transformForecastsToChartData(forecasts, DEFAULT_CONFIG, 48);

    expect(result.waveHeight).toHaveLength(1);
    expect(result.waveHeight[0].value).toBe(3);

    expect(result.windSpeed).toHaveLength(1);
    expect(result.windSpeed[0].value).toBe(10);

    expect(result.tideHeight).toHaveLength(1);
    expect(result.tideHeight[0].value).toBe(2.5);

    expect(result.swellPeriod).toHaveLength(0);
  });

  it("filters forecasts to the requested time window", () => {
    const forecasts = [
      // 1 hour from now – within 2h window
      makeForecast({
        forecast_at: "2026-02-18T13:00:00Z",
        wave_height: "3 ft",
      }),
      // 3 hours from now – outside 2h window
      makeForecast({
        forecast_at: "2026-02-18T15:00:00Z",
        wave_height: "5 ft",
      }),
    ];

    const result = transformForecastsToChartData(forecasts, DEFAULT_CONFIG, 2);
    expect(result.waveHeight).toHaveLength(1);
    expect(result.waveHeight[0].value).toBe(3);
  });

  it("includes ML-corrected height only when is_ml_calibrated is true", () => {
    const forecasts = [
      makeForecast({
        forecast_at: "2026-02-18T13:00:00Z",
        ml_corrected_height: "3.2 ft",
        is_ml_calibrated: true,
      }),
      makeForecast({
        forecast_at: "2026-02-18T14:00:00Z",
        ml_corrected_height: "4.0 ft",
        is_ml_calibrated: false,
      }),
      makeForecast({
        forecast_at: "2026-02-18T15:00:00Z",
        ml_corrected_height: "5.0 ft",
        // is_ml_calibrated defaults to undefined → falsy
      }),
    ];

    const result = transformForecastsToChartData(forecasts, DEFAULT_CONFIG, 48);
    expect(result.mlCorrectedHeight).toHaveLength(1);
    expect(result.mlCorrectedHeight[0].value).toBe(3.2);
  });

  it("time values are shifted to local timezone for chart display", () => {
    const forecasts = [
      makeForecast({
        forecast_at: "2026-02-18T13:00:00Z",
        wave_height: "3 ft",
      }),
    ];

    const result = transformForecastsToChartData(forecasts, DEFAULT_CONFIG, 48);
    // With timezone "America/Los_Angeles" (PST, UTC-8), 13:00 UTC = 05:00 local
    const expectedFakeUtcSeconds = Math.floor(
      Date.UTC(2026, 1, 18, 5, 0, 0) / 1000
    );
    expect(result.waveHeight[0].time).toBe(expectedFakeUtcSeconds);
  });

  it("wind speed point without wind_direction_deg defaults to cross-shore color", () => {
    const forecasts = [
      makeForecast({
        forecast_at: "2026-02-18T13:00:00Z",
        wind_speed: "10 mph",
        // wind_direction_deg is undefined
      }),
    ];

    const result = transformForecastsToChartData(forecasts, DEFAULT_CONFIG, 48);
    expect(result.windSpeed).toHaveLength(1);
    expect(result.windSpeed[0].color).toBe(WIND_COLORS["cross-shore"]);
  });

  it("handles a full realistic forecast set", () => {
    const forecasts = [
      makeForecast({
        forecast_at: "2026-02-18T13:00:00Z",
        wave_height: "3-5 ft",
        wind_speed: "8 mph",
        wind_direction_deg: 90,
        tide_height: "4.2 ft",
        swell_1_period: "14s",
        ml_corrected_height: "3.8 ft",
        is_ml_calibrated: true,
      }),
      makeForecast({
        forecast_at: "2026-02-18T16:00:00Z",
        wave_height: "4 ft",
        wind_speed: "12 mph",
        wind_direction_deg: 270,
        tide_height: "2.1 ft",
        swell_1_period: "12s",
        ml_corrected_height: "3.5 ft",
        is_ml_calibrated: true,
      }),
    ];

    const result = transformForecastsToChartData(forecasts, DEFAULT_CONFIG, 48);

    // Smoothed series: 2 raw points → 7 interpolated
    expect(result.waveHeight).toHaveLength(7);
    expect(result.mlCorrectedHeight).toHaveLength(7);
    expect(result.tideHeight).toHaveLength(7);
    expect(result.swellPeriod).toHaveLength(7);
    // Wind is NOT smoothed (histogram)
    expect(result.windSpeed).toHaveLength(2);

    // First point values (index 0 is always the first raw point)
    expect(result.waveHeight[0].value).toBe(4); // avg of 3-5
    expect(result.windSpeed[0].color).toBe(WIND_COLORS.offshore);
    expect(result.tideHeight[0].value).toBe(4.2);
    expect(result.swellPeriod[0].value).toBe(14);
    expect(result.mlCorrectedHeight[0].value).toBe(3.8);

    // Last point values
    expect(result.waveHeight[result.waveHeight.length - 1].value).toBe(4);
    expect(result.windSpeed[1].color).toBe(WIND_COLORS.onshore);
    expect(result.tideHeight[result.tideHeight.length - 1].value).toBe(2.1);
    expect(result.swellPeriod[result.swellPeriod.length - 1].value).toBe(12);
    expect(result.mlCorrectedHeight[result.mlCorrectedHeight.length - 1].value).toBe(3.5);
  });

  it("excludes forecasts older than 6h lookback", () => {
    // NOW = 2026-02-18T12:00:00Z, so window start = 2026-02-18T06:00:00Z
    // A forecast at 05:00Z is 7h before NOW — outside the 6h lookback window.
    const forecasts = [
      makeForecast({
        forecast_at: "2026-02-18T05:00:00Z", // 7h before NOW — excluded
        wave_height: "2 ft",
      }),
      makeForecast({
        forecast_at: "2026-02-18T13:00:00Z", // 1h after NOW — included
        wave_height: "4 ft",
      }),
    ];

    const result = transformForecastsToChartData(forecasts, DEFAULT_CONFIG, 48);
    expect(result.waveHeight).toHaveLength(1);
    expect(result.waveHeight[0].value).toBe(4);
  });

  it("includes forecasts within 6h lookback window", () => {
    // LOOKBACK_HOURS = 6; window start = NOW - 6h = 2026-02-18T06:00:00Z
    // A forecast at 09:00Z is 3h before NOW — inside the lookback window.
    const forecasts = [
      makeForecast({
        forecast_at: "2026-02-18T09:00:00Z", // 3h before NOW — within lookback
        wave_height: "3 ft",
      }),
      makeForecast({
        forecast_at: "2026-02-18T13:00:00Z", // 1h after NOW — also included
        wave_height: "5 ft",
      }),
    ];

    const result = transformForecastsToChartData(forecasts, DEFAULT_CONFIG, 48);
    // Both points should be present; smoothing with 2 raw points yields 7 output points.
    // Verify endpoints to confirm both raw values made it through.
    expect(result.waveHeight.length).toBeGreaterThanOrEqual(2);
    expect(result.waveHeight[0].value).toBe(3); // first raw point preserved
    expect(result.waveHeight[result.waveHeight.length - 1].value).toBe(5); // last raw point preserved
    // Sanity-check: the LOOKBACK_HOURS constant matches the expectation encoded here
    expect(LOOKBACK_HOURS).toBe(6);
  });

  it("handles duplicate timestamps gracefully", () => {
    const forecasts = [
      makeForecast({
        forecast_at: "2026-02-18T13:00:00Z",
        wave_height: "3 ft",
      }),
      makeForecast({
        forecast_at: "2026-02-18T13:00:00Z",
        wave_height: "4 ft",
      }),
    ];

    const result = transformForecastsToChartData(forecasts, DEFAULT_CONFIG, 48);
    // Duplicate timestamps: smoothSeries skips interpolation for dt=0
    expect(result.waveHeight).toHaveLength(2);
  });
});
