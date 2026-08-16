/**
 * Unit tests for CDIP integration in Enhanced Forecast Service
 * Tests how CDIP data is integrated with existing NOAA data sources
 */

import { EnhancedForecastService } from "@/lib/services/enhanced-forecast-service";
import { expectConsoleErrors } from "@/__tests__/setup/test-utils";
import { CDIPService } from "@/lib/services/cdip";
import { CDIPBuoyData } from "@/types/forecast";
import type { CDIPBuoyDataDiagnostic } from "@/lib/services/cdip/types";

// Create spy for Supabase upsert
const mockUpsert = jest.fn(() => Promise.resolve({ data: [], error: null }));

// Mock the Supabase client
jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => Promise.resolve({ data: [], error: null })),
      })),
      upsert: mockUpsert,
    })),
  })),
}));

// Mock CDIP Service
jest.mock("@/lib/services/cdip", () => ({
  CDIPService: jest.fn(() => ({
    fetchBuoyData: jest.fn(),
    fetchBuoyDataWithDiagnostics: jest.fn(),
    fetchMultipleStations: jest.fn(),
    getSouthernCaliforniaStations: jest.fn(() => ["100", "46225", "46236"]),
    getDataQualityScore: jest.fn(() => 85),
    getNearestStation: jest.fn(),
  })),
}));

// Mock existing NOAA services
jest.mock("@/lib/services/noaa-wavewatch", () => ({
  NOAAWaveWatchService: jest.fn(() => ({
    fetchWaveWatchForecast: jest.fn(() =>
      Promise.resolve({
        lat: 32.8663,
        lng: -117.2544,
        forecast: [
          {
            timestamp: "2024-01-15T12:00:00Z",
            significant_wave_height: 1.5,
            peak_wave_period: 10.0,
            peak_wave_direction: 245,
            swell_1_height: 1.2,
            swell_1_period: 12.0,
            swell_1_direction: 250,
            swell_2_height: 0.5,
            swell_2_period: 8.0,
            swell_2_direction: 280,
            wind_wave_height: 0.3,
            wind_wave_period: 4.0,
            wind_wave_direction: 270,
            data_source: "NOAA_NWS",
          },
        ],
      })
    ),
    getWaveDirectionText: jest.fn(() => "SW"),
  })),
}));

jest.mock("@/lib/services/noaa-coops", () => ({
  NOAACOOPSService: jest.fn(() => ({
    getStationForLocation: jest.fn(() => "9414290"),
    fetchCOOPSData: jest.fn(() => Promise.resolve({ tides: [], currents: [] })),
    getTideStatusAtTime: jest.fn(() => "Rising"),
    getTideHeightAtTime: jest.fn(() => 2.5),
    getNextTideFromTime: jest.fn(() => ({
      time: Date.now() / 1000,
      name: "High",
      height: 4.2,
    })),
  })),
}));

// Mock distance utility
jest.mock("@/lib/utils/distance-utils", () => ({
  calculateDistance: jest.fn(() => 5.2),
}));

// Mock fetch for NOAA weather
global.fetch = jest.fn();

describe("Enhanced Forecast Service - CDIP Integration", () => {
  let service: EnhancedForecastService;
  let mockCDIPService: jest.Mocked<CDIPService>;

  // Minimal mock beach - cast to any for testing
  const mockBeach = {
    id: "462bfb3b-b402-485d-b907-7eedfe5e828e",
    name: "Scripps Pier",
    lat: 32.8663,
    lon: -117.2544,
    state: "CA",
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
  } as any;

  const mockCDIPData: CDIPBuoyData = {
    stationId: "100",
    stationName: "Torrey Pines Outer",
    data: [
      {
        timestamp: "2024-01-15T12:00:00Z",
        significantWaveHeight: 1.8, // meters
        peakWavePeriod: 12.5,
        peakWaveDirection: 270,
        swellHeight: 1.6,
        swellPeriod: 14.2,
        swellDirection: 275,
        windWaveHeight: 0.3,
        windWavePeriod: 4.5,
        windWaveDirection: 225,
      },
      {
        timestamp: "2024-01-15T13:00:00Z",
        significantWaveHeight: 2.1,
        peakWavePeriod: 13.1,
        peakWaveDirection: 272,
        swellHeight: 1.9,
        swellPeriod: 14.8,
        swellDirection: 278,
        windWaveHeight: 0.2,
        windWavePeriod: 4.2,
        windWaveDirection: 230,
      },
    ],
    dataSource: "CDIP",
    lastUpdated: "2024-01-15T21:30:00Z",
  };

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2024-01-15T12:00:00Z"));

    service = new EnhancedForecastService();
    // EnhancedForecastService now delegates CDIP access via ForecastDataSourceManager
    mockCDIPService = (service as any).dataSourceManager.getCDIPService();

    jest.clearAllMocks();
    mockCDIPService.fetchBuoyDataWithDiagnostics.mockImplementation(async (stationId: string) => {
      const data = await mockCDIPService.fetchBuoyData(stationId);
      return {
        data,
        stationId,
        skipReason: data ? "success" : "cdip_unavailable",
      };
    });

    // Setup default NOAA weather API mocks
    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (url.includes("points")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              properties: {
                forecastHourly:
                  "https://api.weather.gov/gridpoints/MTR/85,105/forecast/hourly",
              },
            }),
        });
      } else if (url.includes("forecast/hourly")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              properties: {
                periods: [
                  {
                    startTime: new Date().toISOString(),
                    shortForecast: "Partly Cloudy",
                    temperature: 70,
                    windSpeed: "10 mph",
                    windDirection: "W",
                  },
                ],
              },
            }),
        });
      }
      return Promise.resolve({ ok: false });
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe("CDIP Data Source Integration", () => {
    it("fails over an explicit deterministic CDIP 404 to a nearby configured station", async () => {
      const explicitBeach = { ...mockBeach, cdip_station: "155" };
      mockCDIPService.fetchBuoyDataWithDiagnostics.mockImplementation(
        async (stationId: string) => {
          if (stationId === "155") {
            return {
              data: null,
              stationId,
              skipReason: "cdip_404" as const,
              status: 404,
            };
          }
          return {
            data: { ...mockCDIPData, stationId },
            stationId,
            skipReason: "success" as const,
          };
        },
      );
      mockCDIPService.getNearestStation.mockResolvedValue("191");

      const result = await (service as any).fetchCDIPDataWithRetry(explicitBeach);

      expect(result).toMatchObject({ stationId: "191", skipReason: "success" });
      expect(mockCDIPService.fetchBuoyDataWithDiagnostics).toHaveBeenNthCalledWith(1, "155");
      expect(mockCDIPService.getNearestStation).toHaveBeenCalledWith(
        explicitBeach.lat,
        explicitBeach.lon,
        150,
        ["155"],
      );
      expect(mockCDIPService.fetchBuoyDataWithDiagnostics).toHaveBeenNthCalledWith(2, "191");
    });

    it.each([
      [
        "HTTP 500",
        {
          data: null,
          stationId: "155",
          skipReason: "cdip_unavailable",
          status: 500,
        } as const,
      ],
      [
        "rate-limited",
        {
          data: null,
          stationId: "155",
          skipReason: "cdip_unavailable",
          errorMessage: "rate_limited",
        } as const,
      ],
      [
        "circuit-open",
        {
          data: null,
          stationId: "155",
          skipReason: "circuit_open",
          errorMessage: "Circuit breaker is open",
        } as const,
      ],
      [
        "unknown station",
        {
          data: null,
          stationId: "155",
          skipReason: "unknown_station",
        } as const,
      ],
    ] as const)(
      "does not fail over explicit station for %s diagnostics",
      async (_label, diagnostic) => {
        const explicitBeach = { ...mockBeach, cdip_station: "155" };
        mockCDIPService.fetchBuoyDataWithDiagnostics.mockResolvedValue(
          diagnostic as CDIPBuoyDataDiagnostic,
        );

        const result = await (service as any).fetchCDIPDataWithRetry(
          explicitBeach,
        );

        expect(result).toEqual(diagnostic);
        expect(
          mockCDIPService.getNearestStation,
        ).not.toHaveBeenCalled();
        expect(
          mockCDIPService.fetchBuoyDataWithDiagnostics,
        ).toHaveBeenCalledTimes(1);
        expect(
          mockCDIPService.fetchBuoyDataWithDiagnostics,
        ).toHaveBeenCalledWith("155");
      },
    );

    it("should use CDIP data as primary source for Southern California", async () => {
      mockCDIPService.getNearestStation.mockResolvedValue("100");
      mockCDIPService.fetchBuoyData.mockResolvedValue(mockCDIPData);

      const forecasts = await service.generateComprehensiveForecast(mockBeach);

      expect(mockCDIPService.getNearestStation).toHaveBeenCalledWith(
        mockBeach.lat,
        mockBeach.lon,
        150 // 150km radius for nearest station
      );
      expect(mockCDIPService.fetchBuoyDataWithDiagnostics).toHaveBeenCalledWith("100");

      // Verify CDIP data is used in forecasts
      const firstForecast = forecasts[0];
      expect(firstForecast.data_source).toBe("CDIP");
      // CDIP-scalar branch: CDIP `significantWaveHeight` (1.8) drives output
      // through the scalar/legacy path with `components: [null, null, null]`.
      // Previously, populated NOAA components silently overrode CDIP Hs in
      // the decomposed branch — the old "4.3 ft" pinned that bug.
      expect(firstForecast.wave_height).toBe("2 ft");
      expect(firstForecast.wave_period).toBe("13s");
      // Provenance must record CDIP-driven scalar path, not decomposed.
      const prov = firstForecast.raw_forecast?.wave_height_provenance;
      expect(prov?.source).toBe("cdip_sig");
      expect(prov?.components_used).toBe(false);

      // Phase 21 trusted-forecast coverage is inert-by-design until its
      // coverage slugs land; the builder logs this until then.
      expectConsoleErrors([/trusted_forecast_coverage_unavailable/]);
    });

    it("should fall back to NOAA when CDIP data unavailable", async () => {
      mockCDIPService.getNearestStation.mockResolvedValue(null);

      const forecasts = await service.generateComprehensiveForecast(mockBeach);

      expect(forecasts[0].data_source).toBe("NOAA_NWS");
    });

    it("should fall back to NOAA when CDIP station is too far", async () => {
      const { calculateDistance } = require("@/lib/utils/distance-utils");
      calculateDistance.mockReturnValue(75); // 75km - too far

      mockCDIPService.getNearestStation.mockResolvedValue(null);

      const forecasts = await service.generateComprehensiveForecast(mockBeach);

      expect(forecasts[0].data_source).toBe("NOAA_NWS");
    });

    it("should blend CDIP and NOAA data when both available", async () => {
      mockCDIPService.getNearestStation.mockResolvedValue("100");
      mockCDIPService.fetchBuoyData.mockResolvedValue(mockCDIPData);

      const forecasts = await service.generateComprehensiveForecast(mockBeach);

      // Should use CDIP wave data but NOAA weather/tide data
      expect(forecasts[0].data_source).toBe("CDIP");
      // CDIP-scalar branch: CDIP Hs drives wave_height; NOAA weather still
      // populates weather_condition.
      expect(forecasts[0].wave_height).toBe("2 ft");
      expect(forecasts[0].weather_condition).toBe("Partly Cloudy"); // From NOAA
    });

    it("should store raw CDIP data in raw_forecast field", async () => {
      mockCDIPService.getNearestStation.mockResolvedValue("100");
      mockCDIPService.fetchBuoyData.mockResolvedValue(mockCDIPData);

      const result = await service.storeEnhancedForecasts(
        mockBeach,
        await service.generateComprehensiveForecast(mockBeach)
      );

      expect(result.success).toBe(true);

      // Verify raw data storage
      expect(mockUpsert).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            raw_forecast: expect.objectContaining({
              cdip_data: mockCDIPData,
              data_sources: expect.arrayContaining(["CDIP", "NOAA_NWS"]),
            }),
          }),
        ]),
        expect.any(Object)
      );
    });
  });

  describe("Data Quality and Confidence Scoring", () => {
    it("should increase confidence score with high-quality CDIP data", async () => {
      mockCDIPService.getNearestStation.mockResolvedValue("100");
      mockCDIPService.fetchBuoyData.mockResolvedValue(mockCDIPData);
      mockCDIPService.getDataQualityScore.mockReturnValue(95);

      const forecasts = await service.generateComprehensiveForecast(mockBeach);

      expect(forecasts[0].confidence_score).toBeGreaterThan(80);
    });

    it("should adjust confidence based on data availability", async () => {
      // Mock scenario with no CDIP data (falls back to NOAA only)
      mockCDIPService.getNearestStation.mockResolvedValue(null);

      const forecasts = await service.generateComprehensiveForecast(mockBeach);

      // Without premium CDIP data, confidence should be lower than with CDIP
      expect(forecasts[0].confidence_score).toBeLessThan(95);
      expect(forecasts[0].confidence_score).toBeGreaterThan(70);
    });

    it("should handle missing swell component data gracefully", async () => {
      const incompleteData = {
        ...mockCDIPData,
        data: mockCDIPData.data.map((point) => ({
          timestamp: point.timestamp,
          significantWaveHeight: point.significantWaveHeight,
          peakWavePeriod: point.peakWavePeriod,
          peakWaveDirection: point.peakWaveDirection,
          // Missing swell components
        })),
      };

      mockCDIPService.getNearestStation.mockResolvedValue("100");
      mockCDIPService.fetchBuoyData.mockResolvedValue(incompleteData);

      const forecasts = await service.generateComprehensiveForecast(mockBeach);

      expect(forecasts[0].wave_height).not.toBeNull();
      expect(forecasts[0].swell_1_height).not.toBeNull(); // Should estimate from total wave height
    });
  });

  describe("Geographic Coverage", () => {
    it("should use CDIP for beaches near Station 100 (Torrey Pines)", async () => {
      const scriptsPierBeach = {
        ...mockBeach,
        name: "Scripps Pier",
        lat: 32.8663,
        lon: -117.2544,
      };

      mockCDIPService.getNearestStation.mockResolvedValue("100");
      mockCDIPService.fetchBuoyData.mockResolvedValue(mockCDIPData);

      const forecasts = await service.generateComprehensiveForecast(
        scriptsPierBeach
      );

      expect(forecasts[0].data_source).toBe("CDIP");
    });

    it("should use NOAA for beaches outside CDIP coverage", async () => {
      const humboldtBay = {
        ...mockBeach,
        name: "Humboldt Bay",
        lat: 40.7661,
        lon: -124.1936,
      };

      mockCDIPService.getNearestStation.mockResolvedValue(null);

      const forecasts = await service.generateComprehensiveForecast(
        humboldtBay
      );

      expect(forecasts[0].data_source).toBe("NOAA_NWS");
    });

    it("should select appropriate CDIP station based on location", async () => {
      const montereyBeach = {
        ...mockBeach,
        name: "Monterey Bay",
        lat: 36.6002,
        lon: -121.8947,
      };

      mockCDIPService.getNearestStation.mockResolvedValue("46236");

      await service.generateComprehensiveForecast(montereyBeach);

      expect(mockCDIPService.getNearestStation).toHaveBeenCalledWith(
        montereyBeach.lat,
        montereyBeach.lon,
        150
      );
    });
  });

  describe("Error Handling and Resilience", () => {
    it("should handle CDIP API failures gracefully", async () => {
      mockCDIPService.getNearestStation.mockRejectedValue(
        new Error("CDIP API down")
      );

      const forecasts = await service.generateComprehensiveForecast(mockBeach);

      expect(forecasts).toHaveLength(96); // Should still generate 12 days of forecasts
      expect(forecasts[0].data_source).toBe("NOAA_NWS");
    });

    it("should handle partial CDIP data", async () => {
      const partialData = {
        ...mockCDIPData,
        data: [mockCDIPData.data[0]], // Only one data point
      };

      mockCDIPService.getNearestStation.mockResolvedValue("100");
      mockCDIPService.fetchBuoyData.mockResolvedValue(partialData);

      const forecasts = await service.generateComprehensiveForecast(mockBeach);

      expect(forecasts).toHaveLength(96);
      expect(forecasts[0].data_source).toBe("CDIP");
    });

    it("should handle invalid CDIP data gracefully", async () => {
      const invalidData = {
        ...mockCDIPData,
        data: [
          {
            timestamp: "invalid-timestamp",
            significantWaveHeight: -1, // Invalid negative value
            peakWavePeriod: 0, // Invalid zero period
            peakWaveDirection: 500, // Invalid direction > 360
          },
        ],
      };

      mockCDIPService.getNearestStation.mockResolvedValue("100");
      mockCDIPService.fetchBuoyData.mockResolvedValue(invalidData);

      const forecasts = await service.generateComprehensiveForecast(mockBeach);

      // Invalid/future-unusable CDIP rows are ignored by the nowcast resolver.
      expect(forecasts[0].data_source).toBe("NOAA_NWS");
      expect(forecasts).toHaveLength(96);
    });
  });

  describe("Performance Optimization", () => {
    it("should handle multiple requests for same beach", async () => {
      mockCDIPService.getNearestStation.mockResolvedValue("100");
      mockCDIPService.fetchBuoyData.mockResolvedValue(mockCDIPData);

      // Make multiple requests for same beach
      const forecast1 = await service.generateComprehensiveForecast(mockBeach);
      const forecast2 = await service.generateComprehensiveForecast(mockBeach);

      // Both forecasts should be generated successfully
      expect(forecast1).toHaveLength(96); // 12 days * 8 forecasts per day
      expect(forecast2).toHaveLength(96);
      expect(forecast1[0].data_source).toBe("CDIP");
      expect(forecast2[0].data_source).toBe("CDIP");

      // TODO: Implement caching to reduce API calls for same beach/station
      expect(mockCDIPService.getNearestStation).toHaveBeenCalledTimes(2);
    });

    it("should make concurrent requests when possible", async () => {
      const beaches = [
        { ...mockBeach, id: "beach-1" },
        { ...mockBeach, id: "beach-2" },
        { ...mockBeach, id: "beach-3" },
      ];

      mockCDIPService.getNearestStation.mockResolvedValue("100");
      mockCDIPService.fetchBuoyData.mockResolvedValue(mockCDIPData);

      const startTime = Date.now();

      const promises = beaches.map((beach) =>
        service.generateComprehensiveForecast(beach)
      );

      await Promise.all(promises);

      const duration = Date.now() - startTime;

      // Should complete faster than sequential execution
      expect(duration).toBeLessThan(1000); // Adjust based on actual performance
    });
  });
});
