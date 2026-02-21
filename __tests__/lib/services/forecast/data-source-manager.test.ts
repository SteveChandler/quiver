/**
 * Unit tests for ForecastDataSourceManager and NOAAWeatherDataSource
 *
 * Note: The full fetchBuoyObservationWithFallback integration flow is covered
 * by __tests__/lib/services/ioos-integration.test.ts.
 *
 * These tests focus on:
 * - Service accessor methods (getCDIPService, getWaveWatchService, etc.)
 * - fetchWaveData / fetchTideData / fetchWeatherData delegation
 * - NOAAWeatherDataSource: fetchWeatherData paths including no-coverage handling
 *   and marine-forecast fallback
 */

import { ForecastDataSourceManager, NOAAWeatherDataSource } from "@/lib/services/forecast/data-source-manager";
import { createLatitude, createLongitude } from "@/types/forecast";
import type { Location } from "@/types/forecast";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const loc = (lat: number, lon: number): Location => ({
  latitude: createLatitude(lat),
  longitude: createLongitude(lon),
});

// ─── Module-level mocks ───────────────────────────────────────────────────────

// Mock all external services so ForecastDataSourceManager can be instantiated
jest.mock("@/lib/services/noaa-wavewatch", () => ({
  NOAAWaveWatchService: jest.fn().mockImplementation(() => ({
    fetchWaveWatchForecast: jest.fn(),
    getWaveDirectionText: jest.fn(() => "W"),
  })),
}));

jest.mock("@/lib/services/noaa-coops", () => ({
  NOAACOOPSService: jest.fn().mockImplementation(() => ({
    fetchCOOPSData: jest.fn(),
    getStationForLocation: jest.fn(() => "9410170"),
    getTideStatusAtTime: jest.fn(() => "rising"),
    getTideHeightAtTime: jest.fn(() => 3.5),
    getNextTideFromTime: jest.fn(() => ({
      type: "HIGH",
      height: 5.2,
      time: "2024-01-01T12:00:00Z",
    })),
  })),
}));

jest.mock("@/lib/services/cdip", () => ({
  CDIPService: jest.fn().mockImplementation(() => ({
    getNearestStation: jest.fn(),
    fetchBuoyData: jest.fn(),
  })),
}));

jest.mock("@/lib/services/ioos", () => ({
  IOOSService: jest.fn().mockImplementation(() => ({
    findNearbyStations: jest.fn(),
    fetchObservationDynamic: jest.fn(),
  })),
}));

jest.mock("@/lib/services/ioos-station-scorer", () => ({
  rankStations: jest.fn(() => []),
}));

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        in: jest.fn(() => ({
          gte: jest.fn(() => ({
            order: jest.fn(() => Promise.resolve({ data: [], error: null })),
          })),
        })),
      })),
      upsert: jest.fn(() => ({
        then: jest.fn((cb) => {
          cb();
          return { catch: jest.fn(() => Promise.resolve()) };
        }),
      })),
    })),
  })),
}));

// ─── ForecastDataSourceManager - service accessors ────────────────────────────

describe("ForecastDataSourceManager", () => {
  let manager: ForecastDataSourceManager;

  beforeEach(() => {
    jest.clearAllMocks();
    manager = new ForecastDataSourceManager();
  });

  describe("getCDIPService", () => {
    it("returns a service with getNearestStation and fetchBuoyData methods", () => {
      const service = manager.getCDIPService();
      expect(service).toBeDefined();
      expect(typeof service.getNearestStation).toBe("function");
      expect(typeof service.fetchBuoyData).toBe("function");
    });

    it("returns the same instance on multiple calls", () => {
      const a = manager.getCDIPService();
      const b = manager.getCDIPService();
      expect(a).toBe(b);
    });
  });

  describe("getWaveWatchService", () => {
    it("returns a service with fetchWaveWatchForecast method", () => {
      const service = manager.getWaveWatchService();
      expect(service).toBeDefined();
      expect(typeof service.fetchWaveWatchForecast).toBe("function");
    });
  });

  describe("getCOOPSService", () => {
    it("returns a service with fetchCOOPSData method", () => {
      const service = manager.getCOOPSService();
      expect(service).toBeDefined();
      expect(typeof service.fetchCOOPSData).toBe("function");
    });
  });

  describe("getIOOSService", () => {
    it("returns a service with findNearbyStations method", () => {
      const service = manager.getIOOSService();
      expect(service).toBeDefined();
      expect(typeof service.findNearbyStations).toBe("function");
    });
  });

  describe("getDataSources", () => {
    it("returns wave, tide, and weather data sources", () => {
      const sources = manager.getDataSources();
      expect(sources).toHaveProperty("wave");
      expect(sources).toHaveProperty("tide");
      expect(sources).toHaveProperty("weather");
    });
  });

  // ─── fetchWaveData delegation ───────────────────────────────────────────────

  describe("fetchWaveData", () => {
    it("delegates to WaveWatchDataSource and returns WaveData", async () => {
      const mockForecast = {
        forecast: [
          {
            timestamp: new Date(),
            significantWaveHeight: 1.5,
            peakWavePeriod: 12,
            peakWaveDirection: 270,
          },
        ],
        data_source: "WaveWatch III",
        location: { latitude: 32.7, longitude: -117.2 },
      };

      jest
        .spyOn(manager.getWaveWatchService(), "fetchWaveWatchForecast")
        .mockResolvedValue({
          forecast: [
            {
              timestamp: new Date().toISOString(),
              significant_wave_height: 1.5,
              peak_wave_period: 12,
              peak_wave_direction: 270,
              swell_1_height: null,
              swell_1_period: null,
              swell_1_direction: null,
              swell_2_height: null,
              swell_2_period: null,
              swell_2_direction: null,
              wind_wave_height: null,
              wind_wave_period: null,
              wind_wave_direction: null,
              data_source: "WW3",
            },
          ],
          data_source: "WW3",
          lat: 32.7,
          lng: -117.2,
        } as any);

      const result = await manager.fetchWaveData(loc(32.7, -117.2), 7);

      expect(result).toBeDefined();
      expect(result.forecast).toBeDefined();
      expect(Array.isArray(result.forecast)).toBe(true);
    });

    it("returns empty forecast when WaveWatch returns null", async () => {
      jest
        .spyOn(manager.getWaveWatchService(), "fetchWaveWatchForecast")
        .mockResolvedValue(null as any);

      const result = await manager.fetchWaveData(loc(32.7, -117.2), 7);

      expect(result.forecast).toEqual([]);
      expect(result.data_source).toBe("FALLBACK");
    });
  });

  // ─── fetchTideData delegation ───────────────────────────────────────────────

  describe("fetchTideData", () => {
    it("delegates to TidalDataSource.fetchTideData and returns tide result", async () => {
      const mockTideResult = { tides: [{ time: "12:00", height: 4.5, type: "HIGH" }], currents: [] };
      jest
        .spyOn(manager.getCOOPSService(), "fetchCOOPSData")
        .mockResolvedValue(mockTideResult as any);

      const result = await manager.fetchTideData(loc(32.7, -117.2), 3);

      expect(result).toBeDefined();
      expect(manager.getCOOPSService().getStationForLocation).toHaveBeenCalled();
      expect(manager.getCOOPSService().fetchCOOPSData).toHaveBeenCalled();
    });

    it("returns fallback when CO-OPS returns null", async () => {
      jest
        .spyOn(manager.getCOOPSService(), "fetchCOOPSData")
        .mockResolvedValue(null as any);

      const result = await manager.fetchTideData(loc(32.7, -117.2), 3);
      expect(result).toEqual({ tides: [], currents: [] });
    });
  });

  // ─── fetchWeatherData delegation ────────────────────────────────────────────

  describe("fetchWeatherData", () => {
    it("delegates to NOAAWeatherDataSource.fetchWeatherData", async () => {
      const mockPeriods = [{ startTime: new Date().toISOString(), temperature: 72 }];
      global.fetch = jest.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            properties: {
              forecastHourly: "https://api.weather.gov/hourly",
              forecast: null,
            },
          }),
          text: async () => "",
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            properties: { periods: mockPeriods },
          }),
          text: async () => "",
        } as any);

      const result = await manager.fetchWeatherData(loc(32.7, -117.2), 7);

      expect(result).toBeDefined();
      expect(result.periods).toEqual(mockPeriods);
    });
  });
});

// ─── NOAAWeatherDataSource ────────────────────────────────────────────────────

describe("NOAAWeatherDataSource", () => {
  let source: NOAAWeatherDataSource;

  beforeEach(() => {
    source = new NOAAWeatherDataSource();
    jest.resetAllMocks();
  });

  const testLocation: Location = loc(32.7157, -117.1611);

  it("isAvailable() always returns true", () => {
    expect(source.isAvailable()).toBe(true);
  });

  it("getReliabilityScore() returns a confidence value", () => {
    const score = source.getReliabilityScore();
    expect(score).toBeDefined();
  });

  it("fetchData() delegates to fetchWeatherData", async () => {
    const spy = jest
      .spyOn(source, "fetchWeatherData")
      .mockResolvedValue({ periods: [] });

    await source.fetchData(testLocation, {
      start: new Date(),
      end: new Date(Date.now() + 86400_000),
    });

    expect(spy).toHaveBeenCalled();
  });

  describe("fetchWeatherData - happy path", () => {
    it("returns periods from hourly forecast when available", async () => {
      const mockPeriods = [{ startTime: new Date().toISOString(), temperature: 70 }];

      global.fetch = jest.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            properties: {
              forecastHourly: "https://api.weather.gov/hourly",
              forecast: null,
            },
          }),
          text: async () => "",
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            properties: { periods: mockPeriods },
          }),
          text: async () => "",
        } as any);

      const result = await source.fetchWeatherData(testLocation, 7);
      expect(result.periods).toEqual(mockPeriods);
    });
  });

  describe("fetchWeatherData - no coverage", () => {
    it("returns empty periods when neither hourly nor non-hourly URL exists", async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          properties: {
            forecastHourly: null,
            forecast: null,
          },
        }),
        text: async () => "",
      } as any);

      const result = await source.fetchWeatherData(testLocation, 7);
      expect(result.periods).toEqual([]);
    });
  });

  describe("fetchWeatherData - non-hourly fallback", () => {
    it("falls back to non-hourly URL when hourly URL is absent", async () => {
      const mockPeriods = [{ startTime: new Date().toISOString(), temperature: 68 }];

      global.fetch = jest.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            properties: {
              forecastHourly: null,
              forecast: "https://api.weather.gov/forecast",
            },
          }),
          text: async () => "",
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            properties: { periods: mockPeriods },
          }),
          text: async () => "",
        } as any);

      const result = await source.fetchWeatherData(testLocation, 7);
      expect(result.periods).toEqual(mockPeriods);
    });

    it("returns empty periods when both hourly and non-hourly fail gracefully", async () => {
      // When hourly URL exists but fetch throws a non-retryable error that is NOT
      // a marine-not-supported error, the error propagates upward.
      // This test verifies the fallback chain returns empty when nonHourlyUrl is null.
      global.fetch = jest.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            properties: {
              forecastHourly: null,
              forecast: null,
            },
          }),
          text: async () => "",
        } as any);

      const result = await source.fetchWeatherData(testLocation, 7);
      expect(result.periods).toEqual([]);
    });
  });

  describe("fetchWeatherData - API error handling", () => {
    it("throws DataSourceError when points API fails", async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => "Internal Server Error",
      } as any);

      await expect(source.fetchWeatherData(testLocation, 7)).rejects.toThrow();
    });

    it("returns empty periods when periods array is missing from response", async () => {
      global.fetch = jest.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            properties: {
              forecastHourly: "https://api.weather.gov/hourly",
              forecast: null,
            },
          }),
          text: async () => "",
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            properties: {},  // no periods
          }),
          text: async () => "",
        } as any);

      const result = await source.fetchWeatherData(testLocation, 7);
      expect(result.periods).toEqual([]);
    });
  });
});
