import { ForecastBuilder } from "@/lib/services/forecast/forecast-builder";
import type { ForecastInputs } from "@/lib/services/forecast/forecast-builder";
import type { Beach } from "@/types/database";

// Mock dependencies
jest.mock("@/lib/services/forecast/confidence-scorer", () => ({
  calculateConfidenceScore: jest.fn(() => 75),
}));

jest.mock("@/lib/utils/wave-height-formatter", () => ({
  toFaceHeightFeet: jest.fn(() => "3.5 ft"),
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
      getTideStatusAtTime: () => "rising",
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
    });

    expect(forecasts[0].data_source).toBe("NOAA_NWS");
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
    });

    // Hawaii (lat ~21) is subtropical zone, base 75°F +/- 6°F seasonal
    const tempF = parseInt(forecasts[0].water_temp || "0");
    expect(tempF).toBeGreaterThanOrEqual(69);
    expect(tempF).toBeLessThanOrEqual(81);
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
    });

    // First forecast should use CDIP for current conditions
    expect(forecasts[0].data_source).toBe("CDIP");
  });
});
