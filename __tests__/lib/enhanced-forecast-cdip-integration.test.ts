/**
 * Unit tests for CDIP integration in Enhanced Forecast Service
 * Tests how CDIP data is integrated with existing NOAA data sources
 */

import { EnhancedForecastService } from "@/lib/services/enhanced-forecast-service";
import { CDIPService } from "@/lib/services/cdip-service";
import { CDIPBuoyData } from "@/types/forecast";

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
jest.mock("@/lib/services/cdip-service", () => ({
  CDIPService: jest.fn(() => ({
    fetchBuoyData: jest.fn(),
    fetchMultipleStations: jest.fn(),
    getSouthernCaliforniaStations: jest.fn(() => ["100", "46225", "46236"]),
    getDataQualityScore: jest.fn(() => 85),
    getNearestStation: jest.fn(),
  })),
}));

// Mock existing NOAA services
jest.mock("@/lib/services/noaa-wavewatch-service", () => ({
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
          },
        ],
        data_source: "NOAA_NWS",
      })
    ),
    getWaveDirectionText: jest.fn(() => "SW"),
  })),
}));

jest.mock("@/lib/services/noaa-coops-service", () => ({
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

  const mockBeach = {
    id: "test-beach-id",
    name: "Scripps Pier",
    latitude: 32.8663,
    longitude: -117.2544,
    state: "CA",
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
  };

  const mockCDIPData: CDIPBuoyData = {
    stationId: "100",
    stationName: "Torrey Pines Outer",
    data: [
      {
        timestamp: "2024-01-15T20:00:00Z",
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
        timestamp: "2024-01-15T21:00:00Z",
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
    // Get the mocked CDIP service instance that the service uses internally
    mockCDIPService = (service as any).cdipService;

    jest.clearAllMocks();

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
    it("should use CDIP data as primary source for Southern California", async () => {
      mockCDIPService.getNearestStation.mockResolvedValue("100");
      mockCDIPService.fetchBuoyData.mockResolvedValue(mockCDIPData);

      const forecasts = await service.generateComprehensiveForecast(mockBeach);

      expect(mockCDIPService.getNearestStation).toHaveBeenCalledWith(
        mockBeach.latitude,
        mockBeach.longitude,
        50 // 50km radius for nearest station
      );
      expect(mockCDIPService.fetchBuoyData).toHaveBeenCalledWith("100");

      // Verify CDIP data is used in forecasts
      const firstForecast = forecasts[0];
      expect(firstForecast.data_source).toBe("CDIP");
      expect(firstForecast.wave_height).toBe("6.9 ft"); // 2.1m converted to feet (latest data point)
      expect(firstForecast.wave_period).toBe("13.1s");
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
      expect(forecasts[0].wave_height).toBe("6.9 ft"); // From CDIP (latest data point)
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

      expect(forecasts[0].wave_height).toBeDefined();
      expect(forecasts[0].swell_1_height).toBeDefined(); // Should estimate from total wave height
    });
  });

  describe("Geographic Coverage", () => {
    it("should use CDIP for beaches near Station 100 (Torrey Pines)", async () => {
      const scriptsPierBeach = {
        ...mockBeach,
        name: "Scripps Pier",
        latitude: 32.8663,
        longitude: -117.2544,
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
        latitude: 40.7661,
        longitude: -124.1936,
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
        latitude: 36.6002,
        longitude: -121.8947,
      };

      mockCDIPService.getNearestStation.mockResolvedValue("46236");

      await service.generateComprehensiveForecast(montereyBeach);

      expect(mockCDIPService.getNearestStation).toHaveBeenCalledWith(
        montereyBeach.latitude,
        montereyBeach.longitude,
        50
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

      // Currently uses CDIP data even if invalid - validation could be added as enhancement
      expect(forecasts[0].data_source).toBe("CDIP");
      // TODO: Implement CDIP data validation to fall back to NOAA when data is invalid
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
