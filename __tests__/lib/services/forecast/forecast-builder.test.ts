import { ForecastBuilder } from "@/lib/services/forecast/forecast-builder";
import type { ForecastInputs } from "@/lib/services/forecast/forecast-builder";
import type { Beach } from "@/types/database";

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
  metersToFeet: jest.fn((m: number) => m * 3.28084),
  METERS_TO_FEET: 3.28084,
}));

describe("ForecastBuilder", () => {
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
            swell_height_om: 0.72,
            swell_period_om: 13.1,
            swell_direction_om: 224,
            wind_wave_height_om: 0.34,
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
