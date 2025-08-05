/**
 * Unit tests for CDIP (Coastal Data Information Program) service
 * Tests data fetching from CDIP API for Southern California buoy stations
 */

import { CDIPService } from "@/lib/services/cdip-service";
import {
  CDIPBuoyData,
  CDIPMetaResponse,
  CDIPDataResponse,
  CDIPStationConfig,
} from "@/types/forecast";

// Mock fetch globally
global.fetch = jest.fn();

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
      latitude: 32.921,
      longitude: -117.39,
      deployDepth: 550,
      hullType: "3-meter discus buoy",
      parameters: ["wave", "weather", "drifter"],
    },
    46225: {
      id: "46225",
      name: "Point Reyes",
      latitude: 37.751,
      longitude: -122.839,
      deployDepth: 430,
      hullType: "3-meter discus buoy",
      parameters: ["wave", "weather"],
    },
    46236: {
      id: "46236",
      name: "Monterey Bay",
      latitude: 36.771,
      longitude: -122.186,
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
      baseUrl: "https://cdip.ucsd.edu/data_access/MEM_2dTo1d.cdip",
      dataTypes: { wave: "xy" },
      formats: { json: "json" },
    },
    getStationConfig: jest.fn((stationId) => mockStations[stationId] || null),
    getStationCoverageRadius: jest.fn(() => 50),
  };
});

describe("CDIPService", () => {
  let service: CDIPService;
  const mockFetch = global.fetch as jest.Mock;

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

  const mockDataResponse: CDIPDataResponse = {
    parameter: "wave",
    sensorId: "100p1",
    units: "m,s,deg",
    dataGaps: [],
    data: [
      ["2024-01-15T20:00:00Z", 1.2, 8.5, 225],
      ["2024-01-15T21:00:00Z", 1.4, 9.1, 230],
      ["2024-01-15T22:00:00Z", 1.3, 8.8, 228],
      ["2024-01-15T23:00:00Z", 1.5, 9.3, 232],
    ],
  };

  beforeEach(() => {
    service = new CDIPService();
    jest.clearAllMocks();
    mockFetch.mockClear();

    // Default to successful responses
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("param=meta")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(mockMetaResponse),
        });
      } else if (url.includes("param=xy")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(mockDataResponse),
        });
      } else {
        return Promise.resolve({
          ok: false,
          status: 404,
          statusText: "Not Found",
        });
      }
    });
  });

  describe("fetchBuoyData", () => {
    it("should fetch current wave data for valid station", async () => {
      const result = await service.fetchBuoyData("100");

      expect(result).not.toBeNull();
      expect(result?.stationId).toBe("100");
      expect(result?.data).toHaveLength(4);
      expect(result?.data[0]).toMatchObject({
        timestamp: "2024-01-15T20:00:00.000Z",
        significantWaveHeight: 1.2,
        peakWavePeriod: 8.5,
        peakWaveDirection: 225,
      });
    });

    it("should handle station not found", async () => {
      const result = await service.fetchBuoyData("999");
      expect(result).toBeNull();
    });

    it("should handle API errors gracefully", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
      });

      const result = await service.fetchBuoyData("100");
      expect(result).toBeNull();
    });

    it("should handle malformed data", async () => {
      mockFetch.mockResolvedValueOnce({
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
      mockFetch.mockResolvedValue({
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
      mockFetch.mockResolvedValueOnce({
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
      const results = await service.fetchMultipleStations(["100", "46225"]);

      expect(results).toHaveLength(2);
      expect(results[0]?.stationId).toBe("100");
      expect(results[1]?.stationId).toBe("46225");
    });

    it("should handle partial failures", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockDataResponse),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 404,
        });

      const results = await service.fetchMultipleStations(["100", "46225"]);

      expect(results).toHaveLength(2);
      expect(results[0]).not.toBeNull();
      expect(results[1]).toBeNull();
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
      };

      const result = service.transformToCDIPBuoyData("100", rawData);

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
      };

      const result = service.transformToCDIPBuoyData("100", rawData);
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
      };

      const result = service.transformToCDIPBuoyData("100", rawData);

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
        ],
        dataSource: "CDIP",
        lastUpdated: new Date().toISOString(),
      };

      const score = service.getDataQualityScore(recentData);
      expect(score).toBeGreaterThanOrEqual(80); // Recent data should score high
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
      mockFetch.mockRejectedValueOnce(new Error("fetch timeout"));

      const result = await service.fetchBuoyData("100");
      expect(result).toBeNull();
    });

    it("should handle invalid JSON responses", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.reject(new Error("Invalid JSON")),
      });

      const result = await service.fetchBuoyData("100");
      expect(result).toBeNull();
    });

    it("should log errors appropriately", async () => {
      const consoleSpy = jest.spyOn(console, "error").mockImplementation();

      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      await service.fetchBuoyData("100");

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });
});
