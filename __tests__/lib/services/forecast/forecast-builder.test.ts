import { ForecastBuilder } from "@/lib/services/forecast/forecast-builder";
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
    data_source: "NOAA_NWS",
    forecast: [
      {
        timestamp: new Date().toISOString(),
        significant_wave_height: 1.2,
        peak_wave_period: 12,
        peak_wave_direction: 225,
        swell_1_height: 0.8,
        swell_1_period: 14,
        swell_1_direction: 220,
      },
    ],
  };

  const mockTideData = {
    station_id: "9410230",
    station_name: "La Jolla",
    tides: [
      { time: Math.floor(Date.now() / 1000) + 7200, height: 5.2, type: "high", name: "High" },
    ],
  };

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
    });

    expect(forecasts[0].data_source).toBe("NOAA_NWS");
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
    });

    // First forecast should use CDIP for current conditions
    expect(forecasts[0].data_source).toBe("CDIP");
  });
});
