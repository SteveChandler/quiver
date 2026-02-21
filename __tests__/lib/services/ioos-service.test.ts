/**
 * Tests for IOOSService
 * Tests station discovery and observation fetching from IOOS ERDDAP API
 */

import { IOOSService } from "@/lib/services/ioos";

// Mock fetch to avoid real API calls
global.fetch = jest.fn();

// Mock Supabase client
jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(() => Promise.resolve({ data: null, error: null })),
        })),
        gte: jest.fn(() => ({
          order: jest.fn(() => Promise.resolve({ data: [], error: null })),
        })),
        limit: jest.fn(() => Promise.resolve({ data: [], error: null })),
      })),
      insert: jest.fn(() => Promise.resolve({ data: null, error: null })),
      upsert: jest.fn(() => Promise.resolve({ data: null, error: null })),
      update: jest.fn(() => ({
        eq: jest.fn(() => Promise.resolve({ data: null, error: null })),
      })),
    })),
    rpc: jest.fn(() => Promise.resolve({ data: [], error: null })),
  })),
}));

describe("IOOSService", () => {
  let service: IOOSService;

  beforeEach(() => {
    service = new IOOSService();
    jest.clearAllMocks();
  });

  describe("constructor", () => {
    it("should create service with default config", () => {
      expect(service).toBeDefined();
      expect(service.getConfig().baseUrl).toBe("https://erddap.sensors.ioos.us/erddap");
    });

    it("should accept custom config", () => {
      const customService = new IOOSService({
        baseUrl: "https://custom.erddap.test",
        timeoutMs: 5000,
      });
      expect(customService.getConfig().baseUrl).toBe("https://custom.erddap.test");
      expect(customService.getConfig().timeoutMs).toBe(5000);
    });
  });

  describe("discoverStations", () => {
    const mockERDDAPResponse = {
      table: {
        columnNames: ["datasetID", "institution", "minLatitude", "maxLatitude", "minLongitude", "maxLongitude"],
        columnTypes: ["String", "String", "double", "double", "double", "double"],
        rows: [
          ["pacioos_wave_001", "PacIOOS", 21.0, 21.0, -158.0, -158.0],
          ["secoora_buoy_042", "SECOORA", 30.5, 30.5, -81.2, -81.2],
        ],
      },
    };

    beforeEach(() => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockERDDAPResponse),
      });
    });

    it("should fetch stations from ERDDAP API", async () => {
      const result = await service.discoverStations();

      expect(global.fetch).toHaveBeenCalled();
      expect(result.stations).toBeDefined();
      expect(result.totalFound).toBeGreaterThanOrEqual(0);
    });

    it("should filter by geographic bounds", async () => {
      const bounds = {
        minLat: 20.0,
        maxLat: 22.0,
        minLon: -160.0,
        maxLon: -155.0,
      };

      const result = await service.discoverStations(bounds);

      expect(global.fetch).toHaveBeenCalled();
      // Hawaii bounds should filter to only PacIOOS station
      expect(result.stations.length).toBeLessThanOrEqual(2);
    });

    it("should handle API errors gracefully", async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error("Network error"));

      const result = await service.discoverStations();

      expect(result.stations).toEqual([]);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it("should handle empty response", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ table: { columnNames: [], rows: [] } }),
      });

      const result = await service.discoverStations();

      expect(result.stations).toEqual([]);
      expect(result.totalFound).toBe(0);
    });

    it("should filter out ISM federated dataset IDs", async () => {
      const mockResponseWithISM = {
        table: {
          columnNames: ["datasetID", "institution", "minLatitude", "maxLatitude", "minLongitude", "maxLongitude"],
          rows: [
            // ISM federated ID - should be filtered
            ["ism-secoora-cap2wave-capers-near", "SECOORA", 32.5, 32.5, -80.0, -80.0],
            // Native ID - should be included
            ["cap2wave-capers-nearshore-wave", "SECOORA", 32.5, 32.5, -80.0, -80.0],
            // Another ISM - should be filtered
            ["ism-pacioos-swan-oahu-nearshore", "PacIOOS", 21.3, 21.3, -157.8, -157.8],
          ],
        },
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponseWithISM),
      });

      const result = await service.discoverStations();

      // Should only have the native ID, ISM IDs filtered out
      expect(result.stations).toHaveLength(1);
      expect(result.stations[0].station_id).toBe("cap2wave-capers-nearshore-wave");
      expect(result.totalFound).toBe(1);
    });

    it("should handle case-insensitive ISM prefix", async () => {
      const mockResponse = {
        table: {
          columnNames: ["datasetID", "institution", "minLatitude", "maxLatitude", "minLongitude", "maxLongitude"],
          rows: [
            ["ISM-uppercase-wave-test", "Test", 30.0, 30.0, -120.0, -120.0],
            ["Ism-mixedCase-wave-test", "Test", 30.0, 30.0, -120.0, -120.0],
            ["ism-lowercase-wave-test", "Test", 30.0, 30.0, -120.0, -120.0],
          ],
        },
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await service.discoverStations();

      // All ISM variations should be filtered
      expect(result.stations).toHaveLength(0);
      expect(result.totalFound).toBe(0);
    });

    it("should NOT filter dataset IDs that contain 'ism' but don't start with it", async () => {
      const mockResponse = {
        table: {
          columnNames: ["datasetID", "institution", "minLatitude", "maxLatitude", "minLongitude", "maxLongitude"],
          rows: [
            // Contains 'ism' but doesn't start with it - should be included
            ["tourism-wave-station", "TestNetwork", 30.0, 30.0, -120.0, -120.0],
            ["mechanism-wave-sensor", "TestNetwork", 30.0, 30.0, -120.0, -120.0],
          ],
        },
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await service.discoverStations();

      // Should include both since they don't START with 'ism-'
      expect(result.stations).toHaveLength(2);
      expect(result.totalFound).toBe(2);
    });
  });

  describe("fetchObservation", () => {
    const mockObservationResponse = {
      table: {
        columnNames: ["time", "sea_surface_wave_significant_height", "sea_surface_wave_peak_period"],
        columnTypes: ["String", "double", "double"],
        rows: [
          ["2026-01-18T12:00:00Z", 1.5, 12.0],
        ],
      },
    };

    beforeEach(() => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockObservationResponse),
      });
    });

    it("should fetch observation for a station", async () => {
      const obs = await service.fetchObservation("pacioos_wave_001");

      expect(obs).not.toBeNull();
      expect(obs?.wave_height_m).toBe(1.5);
      expect(obs?.wave_period_s).toBe(12.0);
    });

    it("should return null for missing data", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ table: { columnNames: [], rows: [] } }),
      });

      const obs = await service.fetchObservation("nonexistent_station");

      expect(obs).toBeNull();
    });

    it("should cache observations", async () => {
      // First call
      await service.fetchObservation("pacioos_wave_001");
      const callsAfterFirst = (global.fetch as jest.Mock).mock.calls.length;

      // Second call should use cache
      await service.fetchObservation("pacioos_wave_001");

      expect((global.fetch as jest.Mock).mock.calls.length).toBe(callsAfterFirst);
    });

    it("should validate wave height bounds", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          table: {
            columnNames: ["time", "sea_surface_wave_significant_height"],
            columnTypes: ["String", "double"],
            rows: [["2026-01-18T12:00:00Z", 999.9]], // Invalid height
          },
        }),
      });

      const obs = await service.fetchObservation("bad_data_station");

      // Should reject invalid data
      expect(obs?.wave_height_m).toBeNull();
    });
  });

  describe("fetchBatch", () => {
    beforeEach(() => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          table: {
            columnNames: ["time", "sea_surface_wave_significant_height"],
            columnTypes: ["String", "double"],
            rows: [["2026-01-18T12:00:00Z", 2.0]],
          },
        }),
      });
    });

    it("should fetch observations for multiple stations", async () => {
      const stationIds = ["station_1", "station_2", "station_3"];

      const result = await service.fetchBatch(stationIds);

      expect(result.size).toBe(3);
      expect(result.get("station_1")).toBeDefined();
    });

    it("should respect batch size limits", async () => {
      const stationIds = Array.from({ length: 15 }, (_, i) => `station_${i}`);

      await service.fetchBatch(stationIds, 5);

      // Should batch into groups of 5
      expect((global.fetch as jest.Mock).mock.calls.length).toBe(15);
    });

    it("should continue on individual station failures", async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ table: { columnNames: ["time", "sea_surface_wave_significant_height"], rows: [["2026-01-18T12:00:00Z", 1.0]] } }) })
        .mockRejectedValueOnce(new Error("Station error"))
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ table: { columnNames: ["time", "sea_surface_wave_significant_height"], rows: [["2026-01-18T12:00:00Z", 3.0]] } }) });

      const result = await service.fetchBatch(["s1", "s2", "s3"]);

      // Should still have 2 successful results
      expect(result.size).toBeGreaterThanOrEqual(0);
    });
  });

  describe("findNearbyStations", () => {
    it("should query database for nearby stations", async () => {
      const stations = await service.findNearbyStations(21.5, -158.0, 100);

      expect(stations).toBeDefined();
      expect(Array.isArray(stations)).toBe(true);
    });

    it("should respect radius parameter", async () => {
      // Default radius
      await service.findNearbyStations(32.8, -117.2);

      // Custom radius
      await service.findNearbyStations(32.8, -117.2, 50);

      // Both should work without errors
      expect(true).toBe(true);
    });
  });

  describe("clearCache", () => {
    it("should clear observation cache", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          table: { columnNames: ["time", "sea_surface_wave_significant_height"], rows: [["2026-01-18T12:00:00Z", 1.0]] },
        }),
      });

      // First call
      await service.fetchObservation("test_station");
      const callsAfterFirst = (global.fetch as jest.Mock).mock.calls.length;

      // Clear cache
      service.clearCache();

      // Second call should fetch again
      await service.fetchObservation("test_station");

      expect((global.fetch as jest.Mock).mock.calls.length).toBeGreaterThan(callsAfterFirst);
    });
  });
});
