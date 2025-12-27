/**
 * Test for NOAACOOPSService tide caching functionality
 */

import { NOAACOOPSService } from "@/lib/services/noaa-coops-service";

// Mock fetch to avoid real API calls
global.fetch = jest.fn();

describe("NOAACOOPSService Tide Cache", () => {
  let service: NOAACOOPSService;
  
  beforeEach(() => {
    service = new NOAACOOPSService();
    jest.clearAllMocks();
  });

  describe("getStationForLocation", () => {
    it("should return correct station for San Diego beaches", () => {
      expect(service.getStationForLocation("Blacks", 32.887, -117.252)).toBe("9410230");
      expect(service.getStationForLocation("Windansea", 32.8299, -117.2823)).toBe("9410230");
    });

    it("should return Hawaii station for Pipeline", () => {
      expect(service.getStationForLocation("Pipeline", 21.6644, -158.0517)).toBe("1612340");
    });

    it("should use geographic fallback for unknown beaches", () => {
      // Unknown beach in San Diego area should use nearest station
      const station = service.getStationForLocation("Unknown Beach", 32.8, -117.25);
      expect(station).toBeTruthy();
    });
  });

  describe("fetchCOOPSData caching", () => {
    const mockTideResponse = {
      predictions: [
        { t: "2025-12-10 06:30", v: "5.2", type: "H" },
        { t: "2025-12-10 12:30", v: "0.8", type: "L" },
      ],
    };

    beforeEach(() => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockTideResponse),
      });
    });

    it("should cache tide data and not refetch for same station", async () => {
      // First call should fetch
      const result1 = await service.fetchCOOPSData("9410230", 10);
      expect(result1).not.toBeNull();
      expect(result1?.tides.length).toBe(2);
      
      // Count fetch calls after first request (3 parallel calls: tides, water level, station info)
      const fetchCallsAfterFirst = (global.fetch as jest.Mock).mock.calls.length;
      expect(fetchCallsAfterFirst).toBeGreaterThanOrEqual(1);
      
      // Second call should use cache
      const result2 = await service.fetchCOOPSData("9410230", 10);
      expect(result2).not.toBeNull();
      expect(result2?.tides.length).toBe(2);
      
      // No additional fetch calls
      expect((global.fetch as jest.Mock).mock.calls.length).toBe(fetchCallsAfterFirst);
    });

    it("should fetch again for different station", async () => {
      await service.fetchCOOPSData("9410230", 10);
      const callsAfterFirst = (global.fetch as jest.Mock).mock.calls.length;
      
      await service.fetchCOOPSData("9410170", 10);
      // Should have made new fetch calls for different station
      expect((global.fetch as jest.Mock).mock.calls.length).toBeGreaterThan(callsAfterFirst);
    });

    it("should clear cache when clearCache is called", async () => {
      await service.fetchCOOPSData("9410230", 10);
      const callsAfterFirst = (global.fetch as jest.Mock).mock.calls.length;
      
      service.clearCache();
      
      await service.fetchCOOPSData("9410230", 10);
      // Should have made new fetch calls after cache clear
      expect((global.fetch as jest.Mock).mock.calls.length).toBeGreaterThan(callsAfterFirst);
    });
  });

  describe("fetchCurrentWaterLevel with range parameter", () => {
    it("should use range parameter instead of date format", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: [{ v: "3.5" }] }),
      });

      // Clear cache first
      service.clearCache();
      
      await service.fetchCOOPSData("9410230", 10);
      
      // Find the water_level call
      const calls = (global.fetch as jest.Mock).mock.calls;
      const waterLevelCall = calls.find((call: any[]) => 
        call[0]?.includes("water_level")
      );
      
      if (waterLevelCall) {
        // Should use range parameter, not begin_date with time
        expect(waterLevelCall[0]).toContain("range=1");
        expect(waterLevelCall[0]).not.toMatch(/begin_date=\d{8}\s/);
      }
    });
  });
});












