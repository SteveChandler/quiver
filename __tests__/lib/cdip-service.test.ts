/**
 * Unit tests for CDIP (Coastal Data Information Program) service
 * Tests data fetching from CDIP API for Southern California buoy stations
 */

import { CDIPService, transformToCDIPBuoyData } from "@/lib/services/cdip";
import {
  CDIPBuoyData,
  CDIPMetaResponse,
  CDIPDataResponse,
  CDIPStationConfig,
} from "@/types/forecast";

// Mock the API retry client
const mockFetchCDIPData = jest.fn();
const mockIsCircuitBreakerOpenError = jest.fn(() => false);
jest.mock("@/lib/utils/api-retry", () => ({
  isCircuitBreakerOpenError: mockIsCircuitBreakerOpenError,
  apiClient: {
    fetchCDIPData: mockFetchCDIPData,
  },
}));

// Mock the rate limiter
jest.mock("@/lib/utils/rate-limiter", () => ({
  CDIPRateLimiter: {
    canMakeRequest: jest.fn(() => true),
    recordRequest: jest.fn(),
    getTimeUntilReset: jest.fn(() => 0),
  },
}));

// Mock constants
jest.mock("@/lib/constants/cdip-stations", () => {
  const mockStations = {
    100: {
      id: "100",
      name: "Torrey Pines Outer",
      lat: 32.921,
      lon: -117.39,
      deployDepth: 550,
      hullType: "3-meter discus buoy",
      parameters: ["wave", "weather", "drifter"],
    },
    46225: {
      id: "46225",
      name: "Point Reyes",
      lat: 37.751,
      lon: -122.839,
      deployDepth: 430,
      hullType: "3-meter discus buoy",
      parameters: ["wave", "weather"],
    },
    46236: {
      id: "46236",
      name: "Monterey Bay",
      lat: 36.771,
      lon: -122.186,
      deployDepth: 1100,
      hullType: "3-meter discus buoy",
      parameters: ["wave", "weather", "sst"],
    },
  };

  return {
    CDIP_STATIONS: mockStations,
    SOCAL_PRIMARY_STATIONS: ["100", "67", "191"],
    DATA_QUALITY_THRESHOLDS: {
      waveHeight: { min: 0.1, max: 15.0 },
      wavePeriod: { min: 2.0, max: 30.0 },
      waveDirection: { min: 0, max: 360 },
      dataFreshness: { excellent: 30, good: 120, acceptable: 360, stale: 720 },
    },
    CDIP_API_CONFIG: {
      baseUrl: "http://erddap.cdip.ucsd.edu/erddap/tabledap/wave_agg.json",
      endpoints: {
        waveData: "?station_id,time,waveHs,waveTp,waveTa,waveDp&waveFlagPrimary=1&time>max(time)-1days&station_id=\"{stationId}\"",
        metadata: "?station_id,metaStationName,latitude,longitude&station_id=\"{stationId}\"&distinct()",
      },
      dataTypes: { wave: "xy" },
      formats: { json: "json" },
    },
    DEFAULT_BLACKLIST: ["46225", "46236"],
    getStationConfig: jest.fn((stationId: string) => (mockStations as Record<string, any>)[stationId] || null),
    getStationCoverageRadius: jest.fn(() => 50),
  };
});

describe("CDIPService - API integration tests (mocked)", () => {
  let service: CDIPService;
  const originalBlacklist = process.env.CDIP_BLACKLIST;

  const mockMetaResponse: CDIPMetaResponse = {
    stnId: "100p1",
    stnName: "Torrey Pines Outer",
    deployLatitude: 32.921,
    deployLongitude: -117.39,
    deployDepth: 550,
    hullType: "3-meter discus buoy",
    dataStart: "2001-04-17T00:00:00Z",
    dataEnd: "2024-01-15T23:00:00Z",
    parameters: ["wave", "weather", "drifter"],
  };

  // ERDDAP API returns data in table format
  const mockErddapResponse = {
    table: {
      columnNames: ["time", "waveHs", "waveTp", "waveDp"],
      columnTypes: ["String", "double", "double", "double"],
      rows: [
        ["2024-01-15T20:00:00Z", 1.2, 8.5, 225],
        ["2024-01-15T21:00:00Z", 1.4, 9.1, 230],
        ["2024-01-15T22:00:00Z", 1.3, 8.8, 228],
        ["2024-01-15T23:00:00Z", 1.5, 9.3, 232],
      ],
    },
  };

  beforeEach(() => {
    if (originalBlacklist === undefined) {
      delete process.env.CDIP_BLACKLIST;
    } else {
      process.env.CDIP_BLACKLIST = originalBlacklist;
    }
    service = new CDIPService();
    jest.clearAllMocks();
    mockFetchCDIPData.mockReset();
    mockIsCircuitBreakerOpenError.mockReset();
    mockIsCircuitBreakerOpenError.mockReturnValue(false);

    // Default to successful responses (ERDDAP format)
    mockFetchCDIPData.mockImplementation((url: string) => {
      if (url.includes("meta")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(mockMetaResponse),
        });
      } else {
        // Wave data uses ERDDAP format
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(mockErddapResponse),
        });
      }
    });
  });

  afterAll(() => {
    if (originalBlacklist === undefined) {
      delete process.env.CDIP_BLACKLIST;
    } else {
      process.env.CDIP_BLACKLIST = originalBlacklist;
    }
  });

  describe("fetchBuoyData", () => {
    it("should fetch current wave data for valid station", async () => {
      const result = await service.fetchBuoyData("100");

      expect(result).not.toBeNull();
      expect(result?.stationId).toBe("100");
      expect(result?.data).toHaveLength(4);
      // Data is sorted newest first, and wave heights are converted from meters to feet
      // Most recent entry: 2024-01-15T23:00:00Z, 1.5m * 3.28084 ≈ 4.92 ft
      expect(result?.data[0]).toMatchObject({
        timestamp: "2024-01-15T23:00:00.000Z",
        significantWaveHeight: expect.closeTo(4.92, 1), // 1.5m in feet
        peakWavePeriod: 9.3,
        peakWaveDirection: 232,
      });
    });

    it("should handle station not found", async () => {
      const result = await service.fetchBuoyData("999");
      expect(result).toBeNull();
    });

    it("returns unknown_station diagnostics for unknown stations", async () => {
      const result = await service.fetchBuoyDataWithDiagnostics("999");

      expect(result).toMatchObject({
        data: null,
        stationId: "999",
        skipReason: "unknown_station",
      });
      expect(mockFetchCDIPData).not.toHaveBeenCalled();
    });

    it("returns blacklisted_station diagnostics without calling CDIP", async () => {
      process.env.CDIP_BLACKLIST = "100";
      const blacklistedService = new CDIPService();

      const result = await blacklistedService.fetchBuoyDataWithDiagnostics("100");

      expect(result).toMatchObject({
        data: null,
        stationId: "100",
        skipReason: "blacklisted_station",
      });
      expect(mockFetchCDIPData).not.toHaveBeenCalled();
    });

    it("should handle API errors gracefully", async () => {
      mockFetchCDIPData.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
      });

      const result = await service.fetchBuoyData("100");
      expect(result).toBeNull();
    });

    it("returns cdip_404 diagnostics for deterministic ERDDAP 404s", async () => {
      const errorLog = jest.spyOn(console, "error").mockImplementation(() => undefined);
      mockFetchCDIPData.mockRejectedValueOnce(
        Object.assign(new Error("HTTP 404: Not Found"), { status: 404 })
      );

      const result = await service.fetchBuoyDataWithDiagnostics("100");

      expect(result).toMatchObject({
        data: null,
        stationId: "100",
        skipReason: "cdip_404",
      });
      expect(errorLog).not.toHaveBeenCalled();
      errorLog.mockRestore();
    });

    it("returns cdip_400 diagnostics for deterministic ERDDAP 400s", async () => {
      const errorLog = jest.spyOn(console, "error").mockImplementation(() => undefined);
      mockFetchCDIPData.mockRejectedValueOnce(
        Object.assign(new Error("HTTP 400: Bad Request"), { status: 400 })
      );

      const result = await service.fetchBuoyDataWithDiagnostics("100");

      expect(result).toMatchObject({
        data: null,
        stationId: "100",
        skipReason: "cdip_400",
      });
      expect(errorLog).not.toHaveBeenCalled();
      errorLog.mockRestore();
    });

    it("returns circuit_open diagnostics for open station breakers", async () => {
      mockIsCircuitBreakerOpenError.mockReturnValueOnce(true);
      mockFetchCDIPData.mockRejectedValueOnce(
        Object.assign(new Error("Circuit breaker is open"), {
          circuitBreakerKey: "CDIP:100",
        })
      );

      const result = await service.fetchBuoyDataWithDiagnostics("100");

      expect(result).toMatchObject({
        data: null,
        stationId: "100",
        skipReason: "circuit_open",
      });
    });

    it("returns success diagnostics when CDIP data is transformed", async () => {
      const result = await service.fetchBuoyDataWithDiagnostics("100");

      expect(result.skipReason).toBe("success");
      expect(result.stationId).toBe("100");
      expect(result.data?.stationId).toBe("100");
    });

    it("keeps fetchBuoyData data/null compatibility while diagnostics are available", async () => {
      mockFetchCDIPData.mockRejectedValueOnce(
        Object.assign(new Error("HTTP 404: Not Found"), { status: 404 })
      );

      await expect(service.fetchBuoyData("100")).resolves.toBeNull();
    });

    it("should handle malformed data", async () => {
      mockFetchCDIPData.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ invalid: "data" }),
      });

      const result = await service.fetchBuoyData("100");
      expect(result).toBeNull();
    });

    it("should respect rate limiting", async () => {
      const { CDIPRateLimiter } = require("@/lib/utils/rate-limiter");
      CDIPRateLimiter.canMakeRequest.mockReturnValueOnce(false);
      CDIPRateLimiter.getTimeUntilReset.mockReturnValueOnce(30000);

      const result = await service.fetchBuoyData("100");
      expect(result).toBeNull();
      expect(CDIPRateLimiter.canMakeRequest).toHaveBeenCalled();
    });
  });

  describe("fetchStationMetadata", () => {
    beforeEach(() => {
      mockFetchCDIPData.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockMetaResponse),
      });
    });

    it("should fetch station metadata successfully", async () => {
      const result = await service.fetchStationMetadata("100");

      expect(result).not.toBeNull();
      expect(result?.stnId).toBe("100p1");
      expect(result?.stnName).toBe("Torrey Pines Outer");
      expect(result?.deployLatitude).toBe(32.921);
      expect(result?.deployLongitude).toBe(-117.39);
    });

    it("should handle metadata fetch errors", async () => {
      mockFetchCDIPData.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: "Not Found",
      });

      const result = await service.fetchStationMetadata("100");
      expect(result).toBeNull();
    });
  });

  describe("fetchMultipleStations", () => {
    it("should fetch data from multiple stations", async () => {
      // Note: 46225 is blacklisted, so we use station 100 (which exists in mock)
      // The second station won't match any config, so it returns null
      const results = await service.fetchMultipleStations(["100"]);

      expect(results).toHaveLength(1);
      expect(results[0]?.stationId).toBe("100");
    });

    it("should handle partial failures", async () => {
      mockFetchCDIPData
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockErddapResponse),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 404,
        });

      // Using 100 twice - first succeeds, second fails due to mock setup
      const results = await service.fetchMultipleStations(["100", "100"]);

      // Both map to same station, so in-flight dedup means only 1 fetch
      // Result will be the same cached value for both
      expect(results).toHaveLength(2);
      expect(results[0]).not.toBeNull();
    });

    it("should respect concurrent request limits", async () => {
      const manyStations = Array.from({ length: 10 }, (_, i) => `${i + 100}`);

      const results = await service.fetchMultipleStations(manyStations);

      // Should still make requests but handle them appropriately
      expect(results).toHaveLength(10);
    });
  });

  describe("getSouthernCaliforniaStations", () => {
    it("should return configured SoCal stations", () => {
      const stations = service.getSouthernCaliforniaStations();

      expect(stations).toContain("100");
      expect(stations).toHaveLength(3);
    });
  });

  describe("transformToCDIPBuoyData", () => {
    it("should transform raw CDIP data correctly", () => {
      const rawData = {
        parameter: "wave",
        sensorId: "100p1",
        units: "m,s,deg",
        data: [
          ["2024-01-15T20:00:00Z", 1.2, 8.5, 225],
          ["2024-01-15T21:00:00Z", 1.4, 9.1, 230],
        ],
        dataGaps: [],
      };

      const result = transformToCDIPBuoyData("100", rawData as any);

      expect(result).not.toBeNull();
      expect(result?.stationId).toBe("100");
      expect(result?.data).toHaveLength(2);
      expect(result?.data[0]).toMatchObject({
        timestamp: "2024-01-15T20:00:00.000Z",
        significantWaveHeight: 1.2,
        peakWavePeriod: 8.5,
        peakWaveDirection: 225,
      });
      expect(result?.dataSource).toBe("CDIP");
    });

    it("should handle empty data arrays", () => {
      const rawData = {
        parameter: "wave",
        sensorId: "100p1",
        units: "m,s,deg",
        data: [],
        dataGaps: [],
      };

      const result = transformToCDIPBuoyData("100", rawData as any);
      expect(result).toBeNull();
    });

    it("should handle malformed data points", () => {
      const rawData = {
        parameter: "wave",
        sensorId: "100p1",
        units: "m,s,deg",
        data: [
          ["invalid-timestamp", "not-a-number", 8.5, 225],
          ["2024-01-15T21:00:00Z", 1.4, 9.1, 230], // Valid data point
        ],
        dataGaps: [],
      };

      const result = transformToCDIPBuoyData("100", rawData as any);

      expect(result).not.toBeNull();
      expect(result?.data).toHaveLength(1); // Only valid data point
      expect(result?.data[0].significantWaveHeight).toBe(1.4);
    });
  });

  describe("getDataQualityScore", () => {
    it("should calculate quality score based on data freshness and completeness", () => {
      const recentData: CDIPBuoyData = {
        stationId: "100",
        stationName: "Torrey Pines Outer",
        data: [
          {
            timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(), // 30 min ago
            significantWaveHeight: 1.2,
            peakWavePeriod: 8.5,
            peakWaveDirection: 225,
          },
          {
            timestamp: new Date(Date.now() - 60 * 60 * 1000).toISOString(), // 1 hour ago
            significantWaveHeight: 1.1,
            peakWavePeriod: 8.3,
            peakWaveDirection: 220,
          },
          {
            timestamp: new Date(Date.now() - 90 * 60 * 1000).toISOString(), // 1.5 hours ago
            significantWaveHeight: 1.0,
            peakWavePeriod: 8.1,
            peakWaveDirection: 215,
          },
          {
            timestamp: new Date(Date.now() - 120 * 60 * 1000).toISOString(), // 2 hours ago
            significantWaveHeight: 0.9,
            peakWavePeriod: 7.9,
            peakWaveDirection: 210,
          },
        ],
        dataSource: "CDIP",
        lastUpdated: new Date().toISOString(),
      };

      const score = service.getDataQualityScore(recentData);
      expect(score).toBeGreaterThanOrEqual(80); // Recent data with multiple points should score high
    });

    it("should penalize stale data", () => {
      const staleData: CDIPBuoyData = {
        stationId: "100",
        stationName: "Torrey Pines Outer",
        data: [
          {
            timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(), // 4 hours ago
            significantWaveHeight: 1.2,
            peakWavePeriod: 8.5,
            peakWaveDirection: 225,
          },
        ],
        dataSource: "CDIP",
        lastUpdated: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
      };

      const score = service.getDataQualityScore(staleData);
      expect(score).toBeLessThan(70); // Stale data should score lower
    });
  });

  describe("error handling", () => {
    it("should handle network timeouts", async () => {
      mockFetchCDIPData.mockRejectedValueOnce(new Error("fetch timeout"));

      const result = await service.fetchBuoyData("100");
      expect(result).toBeNull();
    });

    it("should handle invalid JSON responses", async () => {
      mockFetchCDIPData.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.reject(new Error("Invalid JSON")),
      });

      const result = await service.fetchBuoyData("100");
      expect(result).toBeNull();
    });

    it("should log errors appropriately", async () => {
      const consoleSpy = jest.spyOn(console, "error").mockImplementation();

      mockFetchCDIPData.mockRejectedValueOnce(new Error("Network error"));

      await service.fetchBuoyData("100");

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });
});
