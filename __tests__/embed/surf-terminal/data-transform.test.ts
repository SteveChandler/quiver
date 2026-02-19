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
  type BeachChartConfig,
  type SurfTerminalData,
  WIND_COLORS,
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
    expect(result.waveHeight).toHaveLength(3);

    // Sorted by time ascending
    expect(result.waveHeight[0].value).toBe(3);
    expect(result.waveHeight[1].value).toBe(4);
    expect(result.waveHeight[2].value).toBe(5);

    // Time should be ascending
    expect(result.waveHeight[0].time).toBeLessThan(result.waveHeight[1].time);
    expect(result.waveHeight[1].time).toBeLessThan(result.waveHeight[2].time);
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

  it("time values are UTCTimestamp (seconds since epoch)", () => {
    const forecasts = [
      makeForecast({
        forecast_at: "2026-02-18T13:00:00Z",
        wave_height: "3 ft",
      }),
    ];

    const result = transformForecastsToChartData(forecasts, DEFAULT_CONFIG, 48);
    const expectedSeconds = Math.floor(
      new Date("2026-02-18T13:00:00Z").getTime() / 1000
    );
    expect(result.waveHeight[0].time).toBe(expectedSeconds);
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

    expect(result.waveHeight).toHaveLength(2);
    expect(result.mlCorrectedHeight).toHaveLength(2);
    expect(result.tideHeight).toHaveLength(2);
    expect(result.windSpeed).toHaveLength(2);
    expect(result.swellPeriod).toHaveLength(2);

    // First point
    expect(result.waveHeight[0].value).toBe(4); // avg of 3-5
    expect(result.windSpeed[0].color).toBe(WIND_COLORS.offshore);
    expect(result.tideHeight[0].value).toBe(4.2);
    expect(result.swellPeriod[0].value).toBe(14);
    expect(result.mlCorrectedHeight[0].value).toBe(3.8);

    // Second point
    expect(result.waveHeight[1].value).toBe(4);
    expect(result.windSpeed[1].color).toBe(WIND_COLORS.onshore);
    expect(result.tideHeight[1].value).toBe(2.1);
    expect(result.swellPeriod[1].value).toBe(12);
    expect(result.mlCorrectedHeight[1].value).toBe(3.5);
  });

  it("excludes forecasts with forecast_at before now", () => {
    const forecasts = [
      makeForecast({
        forecast_at: "2026-02-18T11:00:00Z", // 1h before NOW
        wave_height: "2 ft",
      }),
      makeForecast({
        forecast_at: "2026-02-18T13:00:00Z", // 1h after NOW
        wave_height: "4 ft",
      }),
    ];

    const result = transformForecastsToChartData(forecasts, DEFAULT_CONFIG, 48);
    // Past forecasts should still be included if we want to show history,
    // but the spec says "filter to requested time window from now"
    // which means only future. We include the past one only if within range.
    // Actually, the requirement says "within timeRangeHours from now" –
    // 11:00 is 1h before now but still within the 48h window looking back?
    // The typical use-case is forward-looking. Let's check the implementation.
    // The spec says "Filters to requested time window" – this should be
    // now → now + timeRangeHours
    expect(result.waveHeight).toHaveLength(1);
    expect(result.waveHeight[0].value).toBe(4);
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
    // Both should be included (no dedup); lightweight-charts handles this
    expect(result.waveHeight).toHaveLength(2);
  });
});
