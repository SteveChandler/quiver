/**
 * @jest-environment node
 *
 * Integration tests for IOOS observation fix implementation
 *
 * Tests the complete flow of fetchBuoyObservationWithFallback including:
 * - Cached-first strategy
 * - CDIP → IOOS fallback
 * - Station ranking
 * - Live fetch and cache writing
 * - Error recovery
 *
 * Also tests cron job helper functions
 */

import { ForecastDataSourceManager } from "@/lib/services/forecast/data-source-manager";
import { IOOSService, ParsedObservation } from "@/lib/services/ioos-service";
import { CDIPService } from "@/lib/services/cdip-service";
import { rankStations, StationCandidate } from "@/lib/services/ioos-station-scorer";
import type { IOOSStation } from "@/types/ioos";

// Mock fetch to control external API calls
global.fetch = jest.fn();

// Mock Supabase client - this will be redefined in beforeEach
let mockSupabaseClient: any;

const mockCreateSupabaseClient = jest.fn();

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: (...args: any[]) => mockCreateSupabaseClient(...args),
}));

describe("fetchBuoyObservationWithFallback integration", () => {
  let manager: ForecastDataSourceManager;
  let mockCDIPService: jest.Mocked<CDIPService>;
  let mockIOOSService: jest.Mocked<IOOSService>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create fresh Supabase mock for each test with jest.fn() handlers
    // that will be re-configured in individual tests
    const defaultMockChain = {
      select: jest.fn(() => ({
        in: jest.fn(() => ({
          gte: jest.fn(() => ({
            order: jest.fn(() => Promise.resolve({ data: [], error: null })),
          })),
        })),
        eq: jest.fn(() => ({
          limit: jest.fn(() => Promise.resolve({ data: [], error: null })),
        })),
        limit: jest.fn(() => Promise.resolve({ data: [], error: null })),
      })),
      upsert: jest.fn(() => ({
        then: jest.fn((cb) => {
          cb();
          return {
            catch: jest.fn(() => Promise.resolve()),
          };
        }),
      })),
      update: jest.fn(() => ({
        eq: jest.fn(() => Promise.resolve({ data: null, error: null })),
      })),
    };

    mockSupabaseClient = {
      from: jest.fn(() => defaultMockChain),
      rpc: jest.fn(() => ({
        limit: jest.fn(() => Promise.resolve({ data: [], error: null })),
      })),
    };

    mockCreateSupabaseClient.mockReturnValue(mockSupabaseClient);

    manager = new ForecastDataSourceManager();
    mockCDIPService = manager.getCDIPService() as jest.Mocked<CDIPService>;
    mockIOOSService = manager.getIOOSService() as jest.Mocked<IOOSService>;
  });

  describe("CDIP primary path", () => {
    it("should return CDIP observation when available", async () => {
      // Mock CDIP success
      jest.spyOn(mockCDIPService, "getNearestStation").mockResolvedValue("station_123");
      jest.spyOn(mockCDIPService, "fetchBuoyData").mockResolvedValue({
        stationId: "station_123",
        data: [
          {
            timestamp: "2026-01-22T12:00:00Z",
            significantWaveHeight: 2.5,
            peakWavePeriod: 14.0,
            peakWaveDirection: 270,
          },
        ],
        lastUpdated: "2026-01-22T12:00:00Z",
      });

      const result = await manager.fetchBuoyObservationWithFallback({
        latitude: 32.8,
        longitude: -117.2,
      });

      expect(result).not.toBeNull();
      expect(result?.source).toBe("CDIP");
      expect(result?.stationId).toBe("station_123");
      expect(result?.waveHeight).toBe(2.5);
      expect(result?.wavePeriod).toBe(14.0);
      expect(result?.waveDirection).toBe(270);
      expect(result?.waterTemp).toBeNull(); // CDIP doesn't provide water temp
    });

    it("should handle CDIP returning null station", async () => {
      // Mock CDIP returning no station
      jest.spyOn(mockCDIPService, "getNearestStation").mockResolvedValue(null);

      // Mock IOOS fallback returning empty list
      jest.spyOn(mockIOOSService, "findNearbyStations").mockResolvedValue([]);

      const result = await manager.fetchBuoyObservationWithFallback({
        latitude: 32.8,
        longitude: -117.2,
      });

      expect(result).toBeNull();
      expect(mockCDIPService.getNearestStation).toHaveBeenCalled();
      expect(mockIOOSService.findNearbyStations).toHaveBeenCalled();
    });

    it("should handle CDIP returning empty data array", async () => {
      // Mock CDIP with empty data
      jest.spyOn(mockCDIPService, "getNearestStation").mockResolvedValue("station_123");
      jest.spyOn(mockCDIPService, "fetchBuoyData").mockResolvedValue({
        stationId: "station_123",
        data: [],
        lastUpdated: "2026-01-22T12:00:00Z",
      });

      // Mock IOOS fallback
      jest.spyOn(mockIOOSService, "findNearbyStations").mockResolvedValue([]);

      const result = await manager.fetchBuoyObservationWithFallback({
        latitude: 32.8,
        longitude: -117.2,
      });

      expect(result).toBeNull();
    });

    it("should handle CDIP timeout gracefully", async () => {
      // Mock CDIP timeout (taking > 10 seconds)
      jest.spyOn(mockCDIPService, "getNearestStation").mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve("station_123"), 15000))
      );

      // Mock IOOS fallback
      jest.spyOn(mockIOOSService, "findNearbyStations").mockResolvedValue([]);

      const result = await manager.fetchBuoyObservationWithFallback({
        latitude: 32.8,
        longitude: -117.2,
      });

      // Should fall back to IOOS after CDIP timeout
      expect(result).toBeNull();
      expect(mockIOOSService.findNearbyStations).toHaveBeenCalled();
    });
  });

  describe("IOOS fallback path", () => {
    beforeEach(() => {
      // Mock CDIP failure for all IOOS fallback tests
      jest.spyOn(mockCDIPService, "getNearestStation").mockRejectedValue(
        new Error("CDIP unavailable")
      );
    });

    it("should return null when no IOOS stations found", async () => {
      jest.spyOn(mockIOOSService, "findNearbyStations").mockResolvedValue([]);

      const result = await manager.fetchBuoyObservationWithFallback({
        latitude: 21.5,
        longitude: -158.0,
      });

      expect(result).toBeNull();
    });
  });

  describe("cached-first strategy", () => {
    const mockStation: IOOSStation = {
      station_id: "ioos_station_789",
      source_network: "NDBC",
      name: "Test Buoy",
      latitude: 32.8,
      longitude: -117.2,
      sensors: ["wave_height", "wave_period"],
      has_wave_data: true,
      nearest_beach_id: "beach_456",
      distance_to_beach_km: 15.0,
      active: true,
      last_seen_at: "2026-01-22T12:00:00Z",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-22T12:00:00Z",
      variable_map: {
        wave_height: "sea_surface_wave_significant_height",
        wave_period: "sea_surface_wave_period",
      },
    };

    beforeEach(() => {
      // Mock CDIP failure
      jest.spyOn(mockCDIPService, "getNearestStation").mockRejectedValue(
        new Error("CDIP unavailable")
      );

      // Mock IOOS station discovery
      jest.spyOn(mockIOOSService, "findNearbyStations").mockResolvedValue([mockStation]);
    });

    it("should fetch live when cache is stale", async () => {
      const now = new Date("2026-01-22T12:00:00Z");
      const thirteenHoursAgo = new Date(now.getTime() - 13 * 3600_000).toISOString();

      // Mock stale cached observation (13 hours old, > 12 hour max cache age)
      const mockSupabaseFrom = mockSupabaseClient.from as jest.Mock;
      mockSupabaseFrom.mockReturnValueOnce({
        select: jest.fn(() => ({
          in: jest.fn(() => ({
            gte: jest.fn(() => ({
              order: jest.fn(() =>
                Promise.resolve({
                  data: [
                    {
                      station_id: "ioos_station_789",
                      observed_at: thirteenHoursAgo,
                      wave_height_m: 1.0,
                      wave_period_s: 10.0,
                      wave_direction_deg: 270,
                      water_temp_c: 18.0,
                    },
                  ],
                  error: null,
                })
              ),
            })),
          })),
        })),
      });

      // Mock live fetch
      const liveObs: ParsedObservation = {
        observedAt: "2026-01-22T11:30:00Z",
        waveHeightM: 2.5,
        wavePeriodS: 14.0,
        waveDirectionDeg: 285,
        waterTempC: 19.0,
        windSpeedMS: null,
        windDirectionDeg: null,
        raw: {},
      };

      jest.spyOn(mockIOOSService, "fetchObservationDynamic").mockResolvedValue(liveObs);

      const result = await manager.fetchBuoyObservationWithFallback({
        latitude: 32.8,
        longitude: -117.2,
      });

      expect(result).not.toBeNull();
      expect(result?.source).toBe("IOOS");
      expect(result?.waveHeight).toBe(2.5); // Should use live data
      expect(mockIOOSService.fetchObservationDynamic).toHaveBeenCalled();
    });

    it("should fetch live when no cached observation exists", async () => {
      // Mock no cached observations
      const mockSupabaseFrom = mockSupabaseClient.from as jest.Mock;
      mockSupabaseFrom.mockReturnValueOnce({
        select: jest.fn(() => ({
          in: jest.fn(() => ({
            gte: jest.fn(() => ({
              order: jest.fn(() =>
                Promise.resolve({
                  data: [],
                  error: null,
                })
              ),
            })),
          })),
        })),
      });

      // Mock live fetch
      const liveObs: ParsedObservation = {
        observedAt: "2026-01-22T12:00:00Z",
        waveHeightM: 3.0,
        wavePeriodS: 15.0,
        waveDirectionDeg: 290,
        waterTempC: 20.0,
        windSpeedMS: null,
        windDirectionDeg: null,
        raw: {},
      };

      jest.spyOn(mockIOOSService, "fetchObservationDynamic").mockResolvedValue(liveObs);

      const result = await manager.fetchBuoyObservationWithFallback({
        latitude: 32.8,
        longitude: -117.2,
      });

      expect(result).not.toBeNull();
      expect(result?.source).toBe("IOOS");
      expect(result?.waveHeight).toBe(3.0);
      expect(mockIOOSService.fetchObservationDynamic).toHaveBeenCalled();
    });
  });

  describe("station ranking", () => {
    beforeEach(() => {
      // Mock CDIP failure
      jest.spyOn(mockCDIPService, "getNearestStation").mockRejectedValue(
        new Error("CDIP unavailable")
      );
    });

    it("should respect maxLiveFetchAttempts when all stations have stale cache", async () => {
      const now = new Date("2026-01-22T12:00:00Z");

      // Create 5 stations all with stale cache
      const stations: IOOSStation[] = Array.from({ length: 5 }, (_, i) => ({
        station_id: `station_${i}`,
        source_network: "NDBC",
        name: `Station ${i}`,
        latitude: 32.8,
        longitude: -117.2,
        sensors: ["wave_height"],
        has_wave_data: true,
        nearest_beach_id: `beach_${i}`,
        distance_to_beach_km: 10.0 + i * 5,
        active: true,
        last_seen_at: "2026-01-22T00:00:00Z",
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-22T00:00:00Z",
        variable_map: { wave_height: "sea_surface_wave_significant_height" },
      }));

      jest.spyOn(mockIOOSService, "findNearbyStations").mockResolvedValue(stations);

      // Mock all cached observations as stale (13 hours old)
      const mockSupabaseFrom = mockSupabaseClient.from as jest.Mock;
      mockSupabaseFrom.mockReturnValueOnce({
        select: jest.fn(() => ({
          in: jest.fn(() => ({
            gte: jest.fn(() => ({
              order: jest.fn(() =>
                Promise.resolve({
                  data: stations.map((s) => ({
                    station_id: s.station_id,
                    observed_at: new Date(now.getTime() - 13 * 3600_000).toISOString(),
                    wave_height_m: 1.0,
                    wave_period_s: null,
                    wave_direction_deg: null,
                    water_temp_c: null,
                  })),
                  error: null,
                })
              ),
            })),
          })),
        })),
      });

      // Mock live fetch (all fail)
      jest.spyOn(mockIOOSService, "fetchObservationDynamic").mockResolvedValue(null);

      const result = await manager.fetchBuoyObservationWithFallback({
        latitude: 32.8,
        longitude: -117.2,
      });

      // Should only try maxLiveFetchAttempts (3) stations
      expect(mockIOOSService.fetchObservationDynamic).toHaveBeenCalledTimes(3);
      expect(result).toBeNull();
    });
  });

  describe("cache writing", () => {
    beforeEach(() => {
      // Mock CDIP failure
      jest.spyOn(mockCDIPService, "getNearestStation").mockRejectedValue(
        new Error("CDIP unavailable")
      );
    });

    it("should write to cache after successful live fetch", async () => {
      const mockStation: IOOSStation = {
        station_id: "ioos_station_cache_test",
        source_network: "NDBC",
        name: "Cache Test Station",
        latitude: 32.8,
        longitude: -117.2,
        sensors: ["wave_height", "wave_period"],
        has_wave_data: true,
        nearest_beach_id: "beach_123",
        distance_to_beach_km: 20.0,
        active: true,
        last_seen_at: "2026-01-22T12:00:00Z",
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-22T12:00:00Z",
        variable_map: {
          wave_height: "sea_surface_wave_significant_height",
          wave_period: "sea_surface_wave_period",
        },
      };

      jest.spyOn(mockIOOSService, "findNearbyStations").mockResolvedValue([mockStation]);

      // Mock no cached observation
      const mockSupabaseFrom = mockSupabaseClient.from as jest.Mock;
      mockSupabaseFrom.mockReturnValueOnce({
        select: jest.fn(() => ({
          in: jest.fn(() => ({
            gte: jest.fn(() => ({
              order: jest.fn(() =>
                Promise.resolve({
                  data: [],
                  error: null,
                })
              ),
            })),
          })),
        })),
      });

      // Mock successful live fetch
      const liveObs: ParsedObservation = {
        observedAt: "2026-01-22T12:00:00Z",
        waveHeightM: 2.8,
        wavePeriodS: 15.0,
        waveDirectionDeg: 290,
        waterTempC: 19.5,
        windSpeedMS: 5.0,
        windDirectionDeg: 280,
        raw: { test: "data" },
      };

      jest.spyOn(mockIOOSService, "fetchObservationDynamic").mockResolvedValue(liveObs);

      // Mock upsert
      const mockUpsert = jest.fn(() => ({
        then: jest.fn((cb) => {
          cb();
          return { catch: jest.fn(() => Promise.resolve()) };
        }),
      }));

      mockSupabaseFrom.mockReturnValueOnce({
        upsert: mockUpsert,
      });

      const result = await manager.fetchBuoyObservationWithFallback({
        latitude: 32.8,
        longitude: -117.2,
      });

      expect(result).not.toBeNull();
      expect(result?.waveHeight).toBe(2.8);

      // Should have called upsert to write to cache
      expect(mockUpsert).toHaveBeenCalledWith(
        {
          station_id: "ioos_station_cache_test",
          observed_at: "2026-01-22T12:00:00Z",
          wave_height_m: 2.8,
          wave_period_s: 15.0,
          wave_direction_deg: 290,
          water_temp_c: 19.5,
          wind_speed_ms: 5.0,
          wind_direction_deg: 280,
          raw_data: { test: "data" },
        },
        {
          onConflict: "station_id,observed_at",
          ignoreDuplicates: true,
        }
      );
    });

    it("should handle cache write failures gracefully", async () => {
      const mockStation: IOOSStation = {
        station_id: "ioos_station_fail_write",
        source_network: "NDBC",
        name: "Fail Write Station",
        latitude: 32.8,
        longitude: -117.2,
        sensors: ["wave_height"],
        has_wave_data: true,
        nearest_beach_id: "beach_456",
        distance_to_beach_km: 15.0,
        active: true,
        last_seen_at: "2026-01-22T12:00:00Z",
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-22T12:00:00Z",
        variable_map: { wave_height: "sea_surface_wave_significant_height" },
      };

      jest.spyOn(mockIOOSService, "findNearbyStations").mockResolvedValue([mockStation]);

      // Mock no cached observation
      const mockSupabaseFrom = mockSupabaseClient.from as jest.Mock;
      mockSupabaseFrom.mockReturnValueOnce({
        select: jest.fn(() => ({
          in: jest.fn(() => ({
            gte: jest.fn(() => ({
              order: jest.fn(() =>
                Promise.resolve({
                  data: [],
                  error: null,
                })
              ),
            })),
          })),
        })),
      });

      // Mock live fetch
      const liveObs: ParsedObservation = {
        observedAt: "2026-01-22T12:00:00Z",
        waveHeightM: 2.0,
        wavePeriodS: null,
        waveDirectionDeg: null,
        waterTempC: null,
        windSpeedMS: null,
        windDirectionDeg: null,
        raw: {},
      };

      jest.spyOn(mockIOOSService, "fetchObservationDynamic").mockResolvedValue(liveObs);

      // Mock cache write failure
      const mockUpsert = jest.fn(() => ({
        then: jest.fn((cb) => {
          cb();
          return {
            catch: jest.fn((errCb) => {
              errCb(new Error("Database write failed"));
              return Promise.resolve();
            }),
          };
        }),
      }));

      mockSupabaseFrom.mockReturnValueOnce({
        upsert: mockUpsert,
      });

      // Should still return observation even if cache write fails
      const result = await manager.fetchBuoyObservationWithFallback({
        latitude: 32.8,
        longitude: -117.2,
      });

      expect(result).not.toBeNull();
      expect(result?.waveHeight).toBe(2.0);
    });
  });

  describe("edge cases", () => {
    beforeEach(() => {
      // Mock CDIP failure
      jest.spyOn(mockCDIPService, "getNearestStation").mockRejectedValue(
        new Error("CDIP unavailable")
      );
    });

    it("should handle all stations being offline", async () => {
      const mockStation: IOOSStation = {
        station_id: "ioos_station_offline",
        source_network: "NDBC",
        name: "Offline Station",
        latitude: 32.8,
        longitude: -117.2,
        sensors: ["wave_height"],
        has_wave_data: true,
        nearest_beach_id: "beach_789",
        distance_to_beach_km: 25.0,
        active: true,
        last_seen_at: "2026-01-22T12:00:00Z",
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-22T12:00:00Z",
        variable_map: { wave_height: "sea_surface_wave_significant_height" },
      };

      jest.spyOn(mockIOOSService, "findNearbyStations").mockResolvedValue([mockStation]);

      // Mock no cached observations
      const mockSupabaseFrom = mockSupabaseClient.from as jest.Mock;
      mockSupabaseFrom.mockReturnValueOnce({
        select: jest.fn(() => ({
          in: jest.fn(() => ({
            gte: jest.fn(() => ({
              order: jest.fn(() =>
                Promise.resolve({
                  data: [],
                  error: null,
                })
              ),
            })),
          })),
        })),
      });

      // Mock live fetch returns null (station offline)
      jest.spyOn(mockIOOSService, "fetchObservationDynamic").mockResolvedValue(null);

      const result = await manager.fetchBuoyObservationWithFallback({
        latitude: 32.8,
        longitude: -117.2,
      });

      expect(result).toBeNull();
    });

    it("should handle stations with missing variable_map", async () => {
      const mockStation: IOOSStation = {
        station_id: "ioos_station_no_var_map",
        source_network: "NDBC",
        name: "No Variable Map Station",
        latitude: 32.8,
        longitude: -117.2,
        sensors: ["wave_height"],
        has_wave_data: true,
        nearest_beach_id: "beach_999",
        distance_to_beach_km: 30.0,
        active: true,
        last_seen_at: "2026-01-22T12:00:00Z",
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-22T12:00:00Z",
        // No variable_map
      };

      jest.spyOn(mockIOOSService, "findNearbyStations").mockResolvedValue([mockStation]);

      // Spy on fetchObservationDynamic to verify it's not called
      const fetchSpy = jest.spyOn(mockIOOSService, "fetchObservationDynamic");

      // Mock no cached observations
      const mockSupabaseFrom = mockSupabaseClient.from as jest.Mock;
      mockSupabaseFrom.mockReturnValueOnce({
        select: jest.fn(() => ({
          in: jest.fn(() => ({
            gte: jest.fn(() => ({
              order: jest.fn(() =>
                Promise.resolve({
                  data: [],
                  error: null,
                })
              ),
            })),
          })),
        })),
      });

      const result = await manager.fetchBuoyObservationWithFallback({
        latitude: 32.8,
        longitude: -117.2,
      });

      // Should skip station without variable_map
      expect(result).toBeNull();
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("should handle database errors when fetching cached observations", async () => {
      const mockStation: IOOSStation = {
        station_id: "ioos_station_db_error",
        source_network: "NDBC",
        name: "DB Error Station",
        latitude: 32.8,
        longitude: -117.2,
        sensors: ["wave_height"],
        has_wave_data: true,
        nearest_beach_id: "beach_db_err",
        distance_to_beach_km: 20.0,
        active: true,
        last_seen_at: "2026-01-22T12:00:00Z",
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-22T12:00:00Z",
        variable_map: { wave_height: "sea_surface_wave_significant_height" },
      };

      jest.spyOn(mockIOOSService, "findNearbyStations").mockResolvedValue([mockStation]);

      // Mock database error
      const mockSupabaseFrom = mockSupabaseClient.from as jest.Mock;
      mockSupabaseFrom.mockReturnValueOnce({
        select: jest.fn(() => ({
          in: jest.fn(() => ({
            gte: jest.fn(() => ({
              order: jest.fn(() =>
                Promise.resolve({
                  data: null,
                  error: { message: "Database connection failed" },
                })
              ),
            })),
          })),
        })),
      });

      const result = await manager.fetchBuoyObservationWithFallback({
        latitude: 32.8,
        longitude: -117.2,
      });

      // Should handle error gracefully and return null
      expect(result).toBeNull();
    });
  });
});

describe("station ranking logic", () => {
  it("should prioritize freshness over all other factors", () => {
    const now = new Date("2026-01-22T12:00:00Z");

    const candidates: StationCandidate[] = [
      {
        stationId: "old_complete_close",
        distanceKm: 5.0,
        network: "NDBC",
        latestObservedAt: new Date(now.getTime() - 13 * 3600_000), // 13 hours old
        hasWaveHeight: true,
        hasPeriod: true,
        hasDirection: true,
      },
      {
        stationId: "fresh_incomplete_far",
        distanceKm: 100.0,
        network: "unknown",
        latestObservedAt: new Date(now.getTime() - 1 * 3600_000), // 1 hour old
        hasWaveHeight: true,
        hasPeriod: false,
        hasDirection: false,
      },
    ];

    const ranked = rankStations(candidates, now);

    // Fresh station should win despite being far and incomplete
    expect(ranked[0].stationId).toBe("fresh_incomplete_far");
  });

  it("should prioritize completeness when freshness is equal", () => {
    const now = new Date("2026-01-22T12:00:00Z");
    const oneHourAgo = new Date(now.getTime() - 3600_000);

    const candidates: StationCandidate[] = [
      {
        stationId: "complete_far",
        distanceKm: 100.0,
        network: "unknown",
        latestObservedAt: oneHourAgo,
        hasWaveHeight: true,
        hasPeriod: true,
        hasDirection: true,
      },
      {
        stationId: "incomplete_close",
        distanceKm: 10.0,
        network: "unknown",
        latestObservedAt: oneHourAgo,
        hasWaveHeight: true,
        hasPeriod: false,
        hasDirection: false,
      },
    ];

    const ranked = rankStations(candidates, now);

    // Complete station should win despite being far
    expect(ranked[0].stationId).toBe("complete_far");
  });

  it("should prioritize distance when freshness and completeness are equal", () => {
    const now = new Date("2026-01-22T12:00:00Z");
    const oneHourAgo = new Date(now.getTime() - 3600_000);

    const candidates: StationCandidate[] = [
      {
        stationId: "far_unknown_network",
        distanceKm: 100.0,
        network: "unknown",
        latestObservedAt: oneHourAgo,
        hasWaveHeight: true,
        hasPeriod: true,
        hasDirection: true,
      },
      {
        stationId: "close_unknown_network",
        distanceKm: 10.0,
        network: "unknown",
        latestObservedAt: oneHourAgo,
        hasWaveHeight: true,
        hasPeriod: true,
        hasDirection: true,
      },
    ];

    const ranked = rankStations(candidates, now);

    // Close station should win
    expect(ranked[0].stationId).toBe("close_unknown_network");
  });

  it("should apply network bonus when all else is equal", () => {
    const now = new Date("2026-01-22T12:00:00Z");
    const oneHourAgo = new Date(now.getTime() - 3600_000);

    const candidates: StationCandidate[] = [
      {
        stationId: "unknown_network",
        distanceKm: 50.0,
        network: "unknown",
        latestObservedAt: oneHourAgo,
        hasWaveHeight: true,
        hasPeriod: true,
        hasDirection: true,
      },
      {
        stationId: "ndbc_network",
        distanceKm: 50.0,
        network: "NDBC",
        latestObservedAt: oneHourAgo,
        hasWaveHeight: true,
        hasPeriod: true,
        hasDirection: true,
      },
    ];

    const ranked = rankStations(candidates, now);

    // NDBC station should win due to network bonus
    expect(ranked[0].stationId).toBe("ndbc_network");
  });
});
