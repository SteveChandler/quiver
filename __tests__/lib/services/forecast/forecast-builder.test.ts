import { expectConsoleErrors } from "@/__tests__/setup/test-utils";
import { ForecastBuilder } from "@/lib/services/forecast/forecast-builder";
import type { ForecastInputs } from "@/lib/services/forecast/forecast-builder";
import {
  buildGfsWaveShadowForecast,
  logGfsWaveShadowRows,
} from "@/lib/services/noaa-wavewatch/gfs-wave-shadow";
import type { Beach } from "@/types/database";
import { toFaceHeightFeetDecomposedWithDebug } from "@/lib/utils/wave-formatters";

// Mock dependencies
jest.mock("@/lib/services/forecast/confidence-scorer", () => ({
  calculateConfidenceScore: jest.fn(() => 75),
}));

jest.mock("@/lib/logger", () => ({
  createContextLogger: () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }),
}));

jest.mock("@/lib/utils/wave-formatters", () => ({
  toFaceHeightFeet: jest.fn(() => "3.5 ft"),
  toFaceHeightFeetDecomposed: jest.fn(() => "3.5 ft"),
  toFaceHeightFeetDecomposedWithDebug: jest.fn(() => ({
    value: "3.5 ft",
    debug: {
      source: "model_swell",
      rawHeightFt: 3.5,
      transformPath: "decomposed",
      componentsUsed: true,
      calibratedShoalingFired: false,
    },
  })),
  metersToFeet: jest.fn((m: number) => m * 3.28084),
  METERS_TO_FEET: 3.28084,
}));

jest.mock("@/lib/services/noaa-wavewatch/gfs-wave-shadow", () => {
  const actual = jest.requireActual("@/lib/services/noaa-wavewatch/gfs-wave-shadow");
  return {
    ...actual,
    logGfsWaveShadowRows: jest.fn(async () => undefined),
  };
});

describe("ForecastBuilder", () => {
  // Phase 21: the trusted layer resolves coverage beach slugs through the
  // shared service-role mock, which answers nothing here, so it reports
  // coverage as unavailable once and serves baseline. Declared, not silenced.
  // Registered inside the describe so it runs before jest.setup's own check.
  afterEach(() => {
    expectConsoleErrors([/trusted_forecast_coverage_unavailable/]);
  });
  const mockBeach: Beach = {
    id: "beach-1",
    name: "Test Beach",
    lat: 32.7,
    lon: -117.2,
  } as Beach;

  const mockWaveData = {
    lat: 32.7,
    lng: -117.2,
    forecast: [
      {
        timestamp: new Date().toISOString(),
        significant_wave_height: 1.2,
        peak_wave_period: 12,
        peak_wave_direction: 225,
        swell_1_height: 0.8,
        swell_1_period: 14,
        swell_1_direction: 220,
        swell_2_height: 0,
        swell_2_period: 0,
        swell_2_direction: 0,
        wind_wave_height: 0.3,
        wind_wave_period: 6,
        wind_wave_direction: 200,
        data_source: "NOAA_NWS" as const,
      },
    ],
  } satisfies ForecastInputs["waveData"] & {};

  const mockOpenMeteoWaveData = {
    lat: 32.7,
    lng: -117.2,
    forecast: [
      {
        timestamp: new Date().toISOString(),
        significant_wave_height: 1.06,
        peak_wave_period: 8,
        peak_wave_direction: 270,
        swell_1_height: 0.64,
        swell_1_period: 8,
        swell_1_direction: 270,
        swell_2_height: 0.37,
        swell_2_period: 9,
        swell_2_direction: 293,
        wind_wave_height: 0.46,
        wind_wave_period: 4.2,
        wind_wave_direction: 270,
        data_source: "OPEN_METEO" as const,
      },
    ],
  } satisfies ForecastInputs["waveData"] & {};

  const mockTideData = {
    station_id: "9410230",
    station_name: "La Jolla",
    water_level: null as number | null,
    tides: [
      { time: Math.floor(Date.now() / 1000) + 7200, height: 5.2, type: "high" as const, name: "High" },
    ],
  } satisfies ForecastInputs["tideData"] & {};

  let builder: ForecastBuilder;

  beforeEach(() => {
    jest.clearAllMocks();
    builder = new ForecastBuilder({
      getWaveDirectionText: (deg: number) => "SW",
      getTideStatusAtTime: () => "Rising",
      getTideHeightAtTime: () => 3.5,
      getNextTideFromTime: () => ({
        time: Math.floor(Date.now() / 1000) + 7200,
        height: 5.2,
        type: "high",
        name: "High",
      }),
      getDataQualityScore: () => 85,
    });
  });

  it("logs issue-time GFS-Wave shadow rows without changing display forecasts", async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-06-10T00:00:00Z"));

    try {
      const waveData = {
        ...mockWaveData,
        forecast: [
          {
            ...mockWaveData.forecast[0],
            timestamp: "2026-06-10T00:00:00Z",
          },
        ],
      };
      const gfsWaveData = buildGfsWaveShadowForecast(
        {
          hourly: {
            time: Array.from({ length: 24 }, (_, index) =>
              new Date(Date.parse("2026-06-10T00:00:00Z") + index * 60 * 60 * 1000).toISOString(),
            ),
            wave_height: Array.from({ length: 24 }, (_, index) => 1 + index * 0.1),
            wave_period: Array.from({ length: 24 }, (_, index) => 10 + index * 0.1),
            wave_direction: Array.from({ length: 24 }, (_, index) => 220 + index),
            tertiary_swell_wave_height: Array.from({ length: 24 }, () => 0.1),
            tertiary_swell_wave_period: Array.from({ length: 24 }, () => 8),
            tertiary_swell_wave_direction: Array.from({ length: 24 }, () => 150),
          },
        },
        { forecastDays: 1, fetchedAt: new Date("2026-06-10T00:00:00Z") },
      );

      const forecasts = await builder.buildForecasts({
        beach: mockBeach,
        waveData,
        tideData: mockTideData,
        weatherData: [],
        buoyData: null,
        cdipData: null,
        ioosWaterTempC: null,
        coopsWaterTempC: null,
        gfsWaveData,
      });

      expect(forecasts[0].beach_id).toBe("beach-1");
      expect(logGfsWaveShadowRows).toHaveBeenCalledTimes(1);
      const rows = (logGfsWaveShadowRows as jest.Mock).mock.calls[0][0];
      expect(rows[0]).toEqual(
        expect.objectContaining({
          beach_id: "beach-1",
          predicted_at: "2026-06-10T00:00:00Z",
          source_model: "ncep_gfswave016",
          capture_status: "ok",
          wave_height_m: 1,
          tertiary_swell_height_m: 0.1,
        }),
      );
    } finally {
      jest.useRealTimers();
    }
  });

  it("builds forecast entities from raw data", async () => {
    const forecasts = await builder.buildForecasts({
      beach: mockBeach,
      waveData: mockWaveData,
      tideData: mockTideData,
      weatherData: [],
      buoyData: null,
      cdipData: null,
      ioosWaterTempC: null,
      coopsWaterTempC: null,
    });

    expect(forecasts.length).toBeGreaterThan(0);
    expect(forecasts[0].beach_id).toBe("beach-1");
  });

  it('persists source disagreement and the same reduced confidence in row and metadata', async () => {
    const selection = { reason: 'reported_inputs' as const, disagreement: true, noaa_height_m: 0.91, open_meteo_height_m: 1.58 };
    const forecasts = await builder.buildForecasts({
      beach: mockBeach,
      waveData: { ...mockWaveData, forecast: mockWaveData.forecast.map((point) => ({ ...point, source_selection: selection })) },
      tideData: mockTideData, weatherData: [], buoyData: null, cdipData: null,
      ioosWaterTempC: null, coopsWaterTempC: null,
    });
    expect(forecasts.length).toBeGreaterThan(0);
    expect(forecasts[0].confidence_score).toBe(40);
    expect(forecasts[0].raw_forecast?.quality_scores?.overall).toBe(40);
    expect(forecasts[0].raw_forecast?.wave_source_selection).toEqual(selection);
  });

  it("includes forecast_date and forecast_time", async () => {
    const forecasts = await builder.buildForecasts({
      beach: mockBeach,
      waveData: mockWaveData,
      tideData: mockTideData,
      weatherData: [],
      buoyData: null,
      cdipData: null,
      ioosWaterTempC: null,
      coopsWaterTempC: null,
    });

    expect(forecasts[0].forecast_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(forecasts[0].forecast_time).toMatch(/^\d{2}:00:00$/);
  });

  it("sets data_source based on available data", async () => {
    const forecasts = await builder.buildForecasts({
      beach: mockBeach,
      waveData: mockWaveData,
      tideData: null,
      weatherData: [],
      buoyData: null,
      cdipData: null,
      ioosWaterTempC: null,
      coopsWaterTempC: null,
    });

    expect(forecasts[0].data_source).toBe("NOAA_NWS");
  });

  it("propagates per-slot OPEN_METEO data_source without falling back to NWS", async () => {
    // Regression: previously a hardcoded wrapper-level data_source ("NOAA_NWS")
    // and the `||` fallback in forecast-builder masked OM-tagged slots as NWS.
    const forecasts = await builder.buildForecasts({
      beach: mockBeach,
      waveData: mockOpenMeteoWaveData,
      tideData: null,
      weatherData: [],
      buoyData: null,
      cdipData: null,
      ioosWaterTempC: null,
      coopsWaterTempC: null,
    });

    expect(forecasts[0].data_source).toBe("OPEN_METEO");
  });

  it("uses IOOS water temperature when available", async () => {
    const forecasts = await builder.buildForecasts({
      beach: mockBeach,
      waveData: mockWaveData,
      tideData: mockTideData,
      weatherData: [],
      buoyData: null,
      cdipData: null,
      ioosWaterTempC: 26, // 26°C = ~79°F
      coopsWaterTempC: null,
    });

    expect(forecasts[0].water_temp).toBe("79°F");
  });

  it("falls back to latitude estimate when no IOOS or buoy data", async () => {
    const hawaiiBeach = { ...mockBeach, lat: 21.3, lon: -157.8 } as Beach;
    const forecasts = await builder.buildForecasts({
      beach: hawaiiBeach,
      waveData: mockWaveData,
      tideData: mockTideData,
      weatherData: [],
      buoyData: null,
      cdipData: null,
      ioosWaterTempC: null,
      coopsWaterTempC: null,
    });

    // Hawaii (lat ~21) is subtropical zone, base 75°F +/- 6°F seasonal
    const tempF = parseInt(forecasts[0].water_temp || "0");
    expect(tempF).toBeGreaterThanOrEqual(69);
    expect(tempF).toBeLessThanOrEqual(81);
  });

  it("includes forecast_at as ISO 8601 UTC string", async () => {
    const forecasts = await builder.buildForecasts({
      beach: mockBeach,
      waveData: mockWaveData,
      tideData: mockTideData,
      weatherData: [],
      buoyData: null,
      cdipData: null,
      ioosWaterTempC: null,
      coopsWaterTempC: null,
    });

    const forecast = forecasts[0];
    expect(forecast.forecast_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:00:00Z$/);
  });

  it("forecast_at is consistent with forecast_date and forecast_time", async () => {
    const forecasts = await builder.buildForecasts({
      beach: mockBeach,
      waveData: mockWaveData,
      tideData: mockTideData,
      weatherData: [],
      buoyData: null,
      cdipData: null,
      ioosWaterTempC: null,
      coopsWaterTempC: null,
    });

    const f = forecasts[0];
    // forecast_date, forecast_time, and forecast_at all use UTC.
    // Verify they all represent the same moment rounded to 3-hour intervals.
    const forecastAtDate = new Date(f.forecast_at!);
    const utcDate = `${forecastAtDate.getUTCFullYear()}-${String(forecastAtDate.getUTCMonth() + 1).padStart(2, "0")}-${String(forecastAtDate.getUTCDate()).padStart(2, "0")}`;
    const utcHour = Math.floor(forecastAtDate.getUTCHours() / 3) * 3;
    const utcTime = `${String(utcHour).padStart(2, "0")}:00:00`;
    expect(f.forecast_date).toBe(utcDate);
    expect(f.forecast_time).toBe(utcTime);
  });

  it("uses '-- ft' fallback when tide interpolation fails", async () => {
    const builderNoTide = new ForecastBuilder({
      getWaveDirectionText: (deg: number) => "SW",
      getTideStatusAtTime: () => "Unknown",
      getTideHeightAtTime: () => null,
      getNextTideFromTime: () => null,
      getDataQualityScore: () => 85,
    });

    const forecasts = await builderNoTide.buildForecasts({
      beach: mockBeach,
      waveData: mockWaveData,
      tideData: mockTideData,
      weatherData: [],
      buoyData: null,
      cdipData: null,
      ioosWaterTempC: null,
      coopsWaterTempC: null,
    });

    expect(forecasts[0].tide_height).toBe("-- ft");
  });

  it("prioritizes CDIP data when available", async () => {
    const mockCdipData = {
      stationId: "100",
      data: [
        {
          timestamp: new Date().toISOString(),
          significantWaveHeight: 1.8,
          peakWavePeriod: 14,
          peakWaveDirection: 270,
        },
      ],
    };

    const forecasts = await builder.buildForecasts({
      beach: mockBeach,
      waveData: mockWaveData,
      tideData: null,
      weatherData: [],
      buoyData: null,
      cdipData: mockCdipData as any,
      ioosWaterTempC: null,
      coopsWaterTempC: null,
    });

    // First forecast should use CDIP for current conditions
    expect(forecasts[0].data_source).toBe("CDIP");
  });

  it("uses CO-OPS water temperature when IOOS is unavailable", async () => {
    const forecasts = await builder.buildForecasts({
      beach: mockBeach,
      waveData: mockWaveData,
      tideData: mockTideData,
      weatherData: [],
      buoyData: null,
      cdipData: null,
      ioosWaterTempC: null,
      coopsWaterTempC: 20, // 20°C = 68°F
    });

    expect(forecasts[0].water_temp).toBe("68°F");
  });

  it("prefers IOOS over CO-OPS water temperature", async () => {
    const forecasts = await builder.buildForecasts({
      beach: mockBeach,
      waveData: mockWaveData,
      tideData: mockTideData,
      weatherData: [],
      buoyData: null,
      cdipData: null,
      ioosWaterTempC: 26, // 26°C = ~79°F
      coopsWaterTempC: 20, // 20°C = 68°F — should be ignored
    });

    expect(forecasts[0].water_temp).toBe("79°F");
  });

  it("falls back to latitude estimate when both IOOS and CO-OPS are null", async () => {
    const hawaiiBeach = { ...mockBeach, lat: 21.3, lon: -157.8 } as Beach;
    const forecasts = await builder.buildForecasts({
      beach: hawaiiBeach,
      waveData: mockWaveData,
      tideData: mockTideData,
      weatherData: [],
      buoyData: null,
      cdipData: null,
      ioosWaterTempC: null,
      coopsWaterTempC: null,
    });

    const tempF = parseInt(forecasts[0].water_temp || "0");
    expect(tempF).toBeGreaterThanOrEqual(69);
    expect(tempF).toBeLessThanOrEqual(81);
  });

  it("wave_period reflects the tallest swell component, not always swell_1", async () => {
    // Scenario: small 14s groundswell + larger 6s windswell
    // wave_period should report 6s (the dominant energy), not 14s
    const windDominantWaveData = {
      ...mockWaveData,
      forecast: [
        {
          timestamp: new Date().toISOString(),
          significant_wave_height: 1.2,
          peak_wave_period: 14,
          peak_wave_direction: 225,
          swell_1_height: 0.4, // small groundswell
          swell_1_period: 14,
          swell_1_direction: 220,
          swell_2_height: 0,
          swell_2_period: 0,
          swell_2_direction: 0,
          wind_wave_height: 0.9, // larger windswell
          wind_wave_period: 6,
          wind_wave_direction: 200,
          data_source: "NOAA_NWS" as const,
        },
      ],
    };

    const forecasts = await builder.buildForecasts({
      beach: mockBeach,
      waveData: windDominantWaveData,
      tideData: mockTideData,
      weatherData: [],
      buoyData: null,
      cdipData: null,
      ioosWaterTempC: null,
      coopsWaterTempC: null,
    });

    expect(forecasts[0].wave_period).toBe("6s");
  });

  it("wave_direction comes from the same component as wave_period (mixed swells)", async () => {
    // Regression: wave_direction used to always pull `peak_wave_direction`
    // (the spectral peak — typically the wind-sea on mixed-swell days),
    // even when wave_period was correctly sourced from the tallest
    // long-period groundswell. That decoupling produced nonsense like
    // "13s W" when the 13s component was actually SSW.
    //
    // Setup: small W wind-sea (5s, 270°), big S groundswell (13s, 180°),
    // tiny W secondary (8s, 270°). Tallest = swell_2 (groundswell), so
    // wave_period must be 13s and wave_direction must reflect 180°.
    // peak_wave_direction is set to 270° (W) to prove the picker isn't
    // falling back to it.
    const directionCapture: number[] = [];
    const directionAwareBuilder = new ForecastBuilder({
      getWaveDirectionText: (deg: number) => {
        directionCapture.push(deg);
        // Return distinguishable text per cardinal so the assertion can
        // pin down which component supplied the direction.
        if (deg >= 157.5 && deg < 202.5) return "S";
        if (deg >= 247.5 && deg < 292.5) return "W";
        return "OTHER";
      },
      getTideStatusAtTime: () => "Rising",
      getTideHeightAtTime: () => 3.5,
      getNextTideFromTime: () => ({
        time: Math.floor(Date.now() / 1000) + 7200,
        height: 5.2,
        type: "high",
        name: "High",
      }),
      getDataQualityScore: () => 85,
    });

    const mixedSwellWaveData = {
      lat: 32.7,
      lng: -117.2,
      forecast: [
        {
          timestamp: new Date().toISOString(),
          significant_wave_height: 2.2,
          peak_wave_period: 5,
          peak_wave_direction: 270, // W spectral peak — the OLD bug source
          swell_1_height: 1.0, // smaller W swell
          swell_1_period: 8,
          swell_1_direction: 270,
          swell_2_height: 2.0, // tallest — long-period S groundswell
          swell_2_period: 13,
          swell_2_direction: 180,
          wind_wave_height: 0.5,
          wind_wave_period: 5,
          wind_wave_direction: 270,
          data_source: "NOAA_NWS" as const,
        },
      ],
    } satisfies ForecastInputs["waveData"] & {};

    const forecasts = await directionAwareBuilder.buildForecasts({
      beach: mockBeach,
      waveData: mixedSwellWaveData,
      tideData: mockTideData,
      weatherData: [],
      buoyData: null,
      cdipData: null,
      ioosWaterTempC: null,
      coopsWaterTempC: null,
    });

    // wave_period must come from the tallest (swell_2 at 13s)
    expect(forecasts[0].wave_period).toBe("13s");
    // wave_direction must come from THE SAME component (swell_2 at 180°),
    // NOT from peak_wave_direction (270°).
    expect(forecasts[0].wave_direction).toBe("S");
    // Defensive: peak_wave_direction (270 → "W") must never appear as the
    // wave_direction text — direction must follow the picked component.
    expect(forecasts[0].wave_direction).not.toBe("W");
  });

  it.each([
    { height: null, period: 13, direction: 180, dominant: false },
    { height: 2, period: null, direction: 180, dominant: false },
    { height: 2, period: 13, direction: null, dominant: false },
    { height: null, period: null, direction: null, dominant: false },
    { height: 2, period: 13, direction: 0, dominant: true },
  ])("preserves secondary missingness: %j", async ({ height, period, direction, dominant }) => {
    const directionAwareBuilder = new ForecastBuilder({
      getWaveDirectionText: (deg: number) => `${deg} degrees`,
      getTideStatusAtTime: () => "Rising",
      getTideHeightAtTime: () => 3.5,
      getNextTideFromTime: () => ({ time: Math.floor(Date.now() / 1000) + 7200, height: 5.2, type: "high", name: "High" }),
      getDataQualityScore: () => 85,
    });
    const forecasts = await directionAwareBuilder.buildForecasts({
      beach: mockBeach,
      waveData: { ...mockOpenMeteoWaveData, forecast: [{
        ...mockOpenMeteoWaveData.forecast[0],
        swell_2_height: height, swell_2_period: period, swell_2_direction: direction,
      }] },
      tideData: mockTideData, weatherData: [], buoyData: null, cdipData: null,
      ioosWaterTempC: null, coopsWaterTempC: null,
    });
    expect(forecasts[0].wave_period).toBe(dominant ? "13s" : "8s");
    expect(forecasts[0].wave_direction).toBe(dominant ? "0 degrees" : "270 degrees");
    expect(forecasts[0].swell_2_direction).toBe(
      height == null || direction == null ? null : `${direction} degrees`,
    );
    const secondary = jest.mocked(toFaceHeightFeetDecomposedWithDebug).mock.calls[0][0].components?.[1];
    expect(secondary).toEqual(height == null || period == null ? null : {
      heightFt: height * 3.28084, periodS: period, directionDeg: direction,
    });
  });

  it("wind_wave_period renders null when source emits the 0 sentinel", async () => {
    // Regression: previously `getWindWavePeriod` used a raw template-literal
    // (`${wavePoint.wind_wave_period}s`), bypassing the `formatPeriodSeconds`
    // 4s floor. The data-processors null-period path coerces to 0 at the
    // write boundary, and the gate must reject 0 → null.
    const zeroPeriodWaveData = {
      ...mockWaveData,
      forecast: [
        {
          timestamp: new Date().toISOString(),
          significant_wave_height: 1.2,
          peak_wave_period: 12,
          peak_wave_direction: 225,
          swell_1_height: 0.8,
          swell_1_period: 14,
          swell_1_direction: 220,
          swell_2_height: 0,
          swell_2_period: 0,
          swell_2_direction: 0,
          wind_wave_height: 0.3,
          wind_wave_period: 0, // sentinel from null-period upstream
          wind_wave_direction: 200,
          data_source: "NOAA_NWS" as const,
        },
      ],
    };

    const forecasts = await builder.buildForecasts({
      beach: mockBeach,
      waveData: zeroPeriodWaveData,
      tideData: mockTideData,
      weatherData: [],
      buoyData: null,
      cdipData: null,
      ioosWaterTempC: null,
      coopsWaterTempC: null,
    });

    // The pre-fix output was the literal "0s" string. The gate must null it.
    expect(forecasts[0].wind_wave_period).toBeNull();
    expect(forecasts[0].wind_wave_period).not.toBe("0s");
  });

  it("wave_period prefers longer period when swell heights are close", async () => {
    // When two swells are within 20% height, prefer the longer period
    const closeHeightsWaveData = {
      ...mockWaveData,
      forecast: [
        {
          timestamp: new Date().toISOString(),
          significant_wave_height: 1.2,
          peak_wave_period: 14,
          peak_wave_direction: 225,
          swell_1_height: 0.8, // groundswell
          swell_1_period: 14,
          swell_1_direction: 220,
          swell_2_height: 0,
          swell_2_period: 0,
          swell_2_direction: 0,
          wind_wave_height: 0.85, // nearly same height windswell
          wind_wave_period: 6,
          wind_wave_direction: 200,
          data_source: "NOAA_NWS" as const,
        },
      ],
    };

    const forecasts = await builder.buildForecasts({
      beach: mockBeach,
      waveData: closeHeightsWaveData,
      tideData: mockTideData,
      weatherData: [],
      buoyData: null,
      cdipData: null,
      ioosWaterTempC: null,
      coopsWaterTempC: null,
    });

    // Heights within 20% → prefer the 14s period
    expect(forecasts[0].wave_period).toBe("14s");
  });

  describe("Open-Meteo co-located values", () => {
    const waveDataWithOm = {
      lat: 32.7,
      lng: -117.2,
      data_source: "NOAA_NWS" as const,
      forecast: [
        {
          timestamp: new Date().toISOString(),
          significant_wave_height: 1.2,
          peak_wave_period: 12,
          peak_wave_direction: 225,
          swell_1_height: 0.8,
          swell_1_period: 14,
          swell_1_direction: 220,
          swell_2_height: 0,
          swell_2_period: 0,
          swell_2_direction: 0,
          wind_wave_height: 0.3,
          wind_wave_period: 6,
          wind_wave_direction: 200,
          data_source: "NOAA_NWS" as const,
          om_values: {
            wave_height_om: 1.05,
            wave_period_om: 11.4,
            wave_direction_om: 231,
            wave_peak_period_om: 12.2,
            swell_height_om: 0.72,
            swell_period_om: 13.1,
            swell_direction_om: 224,
            swell_wave_peak_period_om: 15.4,
            wind_wave_height_om: 0.34,
            wind_wave_period_om: 5.8,
            wind_wave_direction_om: 207,
            wind_wave_peak_period_om: 7.2,
            secondary_swell_height_om: 0.25,
            secondary_swell_period_om: 11.5,
            secondary_swell_direction_om: 190,
            tertiary_swell_height_om: 0.15,
            tertiary_swell_period_om: 9.4,
            tertiary_swell_direction_om: 145,
            om_wind_wave_missing: false,
            om_primary_swell_missing: false,
            om_secondary_swell_missing: false,
            om_tertiary_swell_missing: false,
            om_partition_schema_version: 1,
          },
        },
      ],
    };

    it("populates *_om columns on rows where OM data is available", async () => {
      const forecasts = await builder.buildForecasts({
        beach: mockBeach,
        waveData: waveDataWithOm,
        tideData: mockTideData,
        weatherData: [],
        buoyData: null,
        cdipData: null,
        ioosWaterTempC: null,
        coopsWaterTempC: null,
      });

      const f = forecasts[0];
      expect(f.wave_height_om).toBe(1.05);
      expect(f.wave_period_om).toBe(11.4);
      expect(f.wave_direction_om).toBe(231);
      expect(f.swell_height_om).toBe(0.72);
      expect(f.swell_period_om).toBe(13.1);
      expect(f.swell_direction_om).toBe(224);
      expect(f.wind_wave_height_om).toBe(0.34);
      expect(f.om_fetched_at).toEqual(expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/));
    });

    it("preserves NOAA-side string wave fields alongside *_om numeric fields", async () => {
      const forecasts = await builder.buildForecasts({
        beach: mockBeach,
        waveData: waveDataWithOm,
        tideData: mockTideData,
        weatherData: [],
        buoyData: null,
        cdipData: null,
        ioosWaterTempC: null,
        coopsWaterTempC: null,
      });

      const f = forecasts[0];
      // NOAA-side wave_height remains a TEXT-style string produced by the
      // face-height transformer — see toFaceHeightFeetDecomposed mock.
      expect(typeof f.wave_height).toBe("string");
      // OM-side is numeric (meters), completely independent of the TEXT.
      expect(typeof f.wave_height_om).toBe("number");
    });

    it("keeps expanded partition fields out of served forecast rows", async () => {
      const forecasts = await builder.buildForecasts({
        beach: mockBeach,
        waveData: waveDataWithOm,
        tideData: mockTideData,
        weatherData: [],
        buoyData: null,
        cdipData: null,
        ioosWaterTempC: null,
        coopsWaterTempC: null,
      });

      const f = forecasts[0];
      expect(f).not.toHaveProperty("wave_peak_period_om");
      expect(f).not.toHaveProperty("swell_wave_peak_period_om");
      expect(f).not.toHaveProperty("wind_wave_period_om");
      expect(f).not.toHaveProperty("secondary_swell_height_om");
      expect(f).not.toHaveProperty("tertiary_swell_height_om");
      expect(f).not.toHaveProperty("om_partition_schema_version");
    });

    it("leaves *_om columns undefined when wave point has no om_values", async () => {
      // mockWaveData contains no om_values (pre-migration NOAA-only shape).
      const forecasts = await builder.buildForecasts({
        beach: mockBeach,
        waveData: mockWaveData,
        tideData: mockTideData,
        weatherData: [],
        buoyData: null,
        cdipData: null,
        ioosWaterTempC: null,
        coopsWaterTempC: null,
      });

      const f = forecasts[0];
      expect(f.wave_height_om).toBeUndefined();
      expect(f.om_fetched_at).toBeUndefined();
    });
  });
});
