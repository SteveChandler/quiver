import {
  isInPacificBeachCluster,
  getCachedClusterForecast,
  setCachedClusterForecast,
  invalidateClusterCache,
  getCacheStatus,
  findPacificBeach,
  PACIFIC_BEACH_CLUSTER,
} from "@/lib/beach-cluster-cache";
import type { Beach, Forecast } from "@/types/database";

// Mock data
const mockBeach: Beach = {
  id: "pacific-beach-id",
  name: "Pacific Beach",
  latitude: 32.7841,
  longitude: -117.2527,
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
};

const mockForecasts: Forecast[] = [
  {
    id: "forecast-1",
    beach_id: "pacific-beach-id",
    forecast_date: "2024-01-01",
    forecast_time: "06:00",
    wave_height: "3-4 ft",
    water_temp: "65°F",
    wind_speed: "10 mph",
    wind_direction: "SW",
    tide: "High",
    weather_condition: "Sunny",
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
  },
  {
    id: "forecast-2",
    beach_id: "pacific-beach-id",
    forecast_date: "2024-01-01",
    forecast_time: "12:00",
    wave_height: "4-5 ft",
    water_temp: "66°F",
    wind_speed: "12 mph",
    wind_direction: "W",
    tide: "Low",
    weather_condition: "Partly Cloudy",
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
  },
];

const mockBeaches: Beach[] = [
  mockBeach,
  {
    id: "ocean-beach-id",
    name: "Ocean Beach",
    latitude: 32.7503,
    longitude: -117.2534,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
  },
  {
    id: "mission-beach-id",
    name: "Mission Beach",
    latitude: 32.7738,
    longitude: -117.2528,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
  },
  {
    id: "sunset-cliffs-id",
    name: "Sunset Cliffs",
    latitude: 32.7155,
    longitude: -117.2531,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
  },
  {
    id: "other-beach-id",
    name: "Malibu Beach",
    latitude: 34.0259,
    longitude: -118.7798,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
  },
];

describe("Beach Cluster Cache System", () => {
  beforeEach(() => {
    // Clear cache before each test
    invalidateClusterCache();
  });

  describe("isInPacificBeachCluster", () => {
    it("should identify Pacific Beach as part of the cluster", () => {
      expect(isInPacificBeachCluster("Pacific Beach")).toBe(true);
      expect(isInPacificBeachCluster("pacific beach")).toBe(true);
      expect(isInPacificBeachCluster("PACIFIC BEACH")).toBe(true);
    });

    it("should identify fallback beaches as part of the cluster", () => {
      expect(isInPacificBeachCluster("Ocean Beach")).toBe(true);
      expect(isInPacificBeachCluster("Mission Beach")).toBe(true);
      expect(isInPacificBeachCluster("Sunset Cliffs")).toBe(true);
      expect(isInPacificBeachCluster("Crystal Pier")).toBe(true);
      expect(isInPacificBeachCluster("Crystal Pier (Pacific Beach)")).toBe(
        true
      );
    });

    it("should handle case-insensitive matching", () => {
      expect(isInPacificBeachCluster("ocean beach")).toBe(true);
      expect(isInPacificBeachCluster("MISSION BEACH")).toBe(true);
      expect(isInPacificBeachCluster("sunset cliffs")).toBe(true);
    });

    it("should return false for beaches not in the cluster", () => {
      expect(isInPacificBeachCluster("Malibu Beach")).toBe(false);
      expect(isInPacificBeachCluster("Huntington Beach")).toBe(false);
      expect(isInPacificBeachCluster("")).toBe(false);
    });

    it("should handle partial name matches", () => {
      expect(isInPacificBeachCluster("Ocean Beach Pier")).toBe(true);
      expect(isInPacificBeachCluster("Mission Beach Boardwalk")).toBe(true);
    });
  });

  describe("Cache Operations", () => {
    it("should return null when no cache exists", () => {
      const cachedData = getCachedClusterForecast();
      expect(cachedData).toBeNull();
    });

    it("should store and retrieve cached data", () => {
      setCachedClusterForecast(mockForecasts, mockBeach);
      const cachedData = getCachedClusterForecast();

      expect(cachedData).not.toBeNull();
      expect(cachedData!.forecasts).toEqual(mockForecasts);
      expect(cachedData!.sourceBeach).toEqual(mockBeach);
      expect(cachedData!.timestamp).toBeDefined();
      expect(cachedData!.expiresAt).toBeDefined();
    });

    it("should invalidate cache", () => {
      setCachedClusterForecast(mockForecasts, mockBeach);
      expect(getCachedClusterForecast()).not.toBeNull();

      invalidateClusterCache();
      expect(getCachedClusterForecast()).toBeNull();
    });

    it("should expire cache after 4 hours", () => {
      // Mock Date.now to control time
      const originalNow = Date.now;
      const baseTime = 1640995200000; // 2022-01-01 00:00:00 UTC

      Date.now = jest.fn(() => baseTime);

      setCachedClusterForecast(mockForecasts, mockBeach);
      expect(getCachedClusterForecast()).not.toBeNull();

      // Advance time by 3 hours and 59 minutes (should still be valid)
      Date.now = jest.fn(() => baseTime + 3 * 60 * 60 * 1000 + 59 * 60 * 1000);
      expect(getCachedClusterForecast()).not.toBeNull();

      // Advance time by 4 hours and 1 minute (should be expired)
      Date.now = jest.fn(() => baseTime + 4 * 60 * 60 * 1000 + 1 * 60 * 1000);
      expect(getCachedClusterForecast()).toBeNull();

      // Restore original Date.now
      Date.now = originalNow;
    });
  });

  describe("getCacheStatus", () => {
    it("should return correct status when no cache exists", () => {
      const status = getCacheStatus();
      expect(status.isCached).toBe(false);
      expect(status.remainingTimeMs).toBe(0);
      expect(status.remainingTimeHuman).toBe("No cache");
      expect(status.sourceBeach).toBeUndefined();
    });

    it("should return correct status with valid cache", () => {
      setCachedClusterForecast(mockForecasts, mockBeach);
      const status = getCacheStatus();

      expect(status.isCached).toBe(true);
      expect(status.remainingTimeMs).toBeGreaterThan(0);
      expect(status.remainingTimeHuman).toContain("remaining");
      expect(status.sourceBeach).toBe(mockBeach.name);
    });

    it("should return expired status for expired cache", () => {
      const originalNow = Date.now;
      const baseTime = 1640995200000;

      Date.now = jest.fn(() => baseTime);
      setCachedClusterForecast(mockForecasts, mockBeach);

      // Advance time past expiration
      Date.now = jest.fn(() => baseTime + 5 * 60 * 60 * 1000);

      const status = getCacheStatus();
      expect(status.isCached).toBe(false);
      expect(status.remainingTimeMs).toBe(0);
      expect(status.remainingTimeHuman).toBe("Expired");

      Date.now = originalNow;
    });

    it("should format remaining time correctly", () => {
      const originalNow = Date.now;
      const baseTime = 1640995200000;

      Date.now = jest.fn(() => baseTime);
      setCachedClusterForecast(mockForecasts, mockBeach);

      // Check time 2 hours 30 minutes before expiration
      Date.now = jest.fn(() => baseTime + 1 * 60 * 60 * 1000 + 30 * 60 * 1000);

      const status = getCacheStatus();
      expect(status.remainingTimeHuman).toBe("2h 30m remaining");

      Date.now = originalNow;
    });
  });

  describe("findPacificBeach", () => {
    it("should find Pacific Beach by exact name", () => {
      const found = findPacificBeach(mockBeaches);
      expect(found).toEqual(mockBeach);
    });

    it("should find Pacific Beach by partial name", () => {
      const beachesWithPartialName = [
        ...mockBeaches.filter((b) => b.name !== "Pacific Beach"),
        {
          ...mockBeach,
          name: "Pacific Beach Pier Area",
        },
      ];

      const found = findPacificBeach(beachesWithPartialName);
      expect(found?.name).toBe("Pacific Beach Pier Area");
    });

    it("should return null when Pacific Beach is not found", () => {
      const beachesWithoutPacific = mockBeaches.filter(
        (b) => !b.name.toLowerCase().includes("pacific")
      );

      const found = findPacificBeach(beachesWithoutPacific);
      expect(found).toBeNull();
    });

    it("should return first match when multiple Pacific beaches exist", () => {
      const beachesWithMultiplePacific = [
        ...mockBeaches,
        {
          id: "pacific-beach-2",
          name: "Pacific Beach South",
          latitude: 32.78,
          longitude: -117.25,
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
        },
      ];

      const found = findPacificBeach(beachesWithMultiplePacific);
      expect(found?.name).toBe("Pacific Beach");
    });
  });

  describe("PACIFIC_BEACH_CLUSTER constant", () => {
    it("should have correct structure", () => {
      expect(PACIFIC_BEACH_CLUSTER.source).toBe("Pacific Beach");
      expect(PACIFIC_BEACH_CLUSTER.fallback_beaches).toContain("Ocean Beach");
      expect(PACIFIC_BEACH_CLUSTER.fallback_beaches).toContain("Mission Beach");
      expect(PACIFIC_BEACH_CLUSTER.fallback_beaches).toContain("Sunset Cliffs");
      expect(PACIFIC_BEACH_CLUSTER.fallback_beaches).toContain("Crystal Pier");
      expect(PACIFIC_BEACH_CLUSTER.fallback_beaches).toContain(
        "Crystal Pier (Pacific Beach)"
      );
    });

    it("should have all expected fallback beaches", () => {
      expect(PACIFIC_BEACH_CLUSTER.fallback_beaches).toHaveLength(5);
    });
  });

  describe("Integration scenarios", () => {
    it("should handle multiple cache operations in sequence", () => {
      // Initial cache set
      setCachedClusterForecast(mockForecasts, mockBeach);
      expect(getCachedClusterForecast()).not.toBeNull();

      // Update cache with new data
      const newForecasts = [
        ...mockForecasts,
        {
          ...mockForecasts[0],
          id: "forecast-3",
          forecast_time: "18:00",
        },
      ];

      setCachedClusterForecast(newForecasts, mockBeach);
      const cachedData = getCachedClusterForecast();
      expect(cachedData!.forecasts).toHaveLength(3);

      // Invalidate and check
      invalidateClusterCache();
      expect(getCachedClusterForecast()).toBeNull();
    });

    it("should handle empty forecasts array", () => {
      setCachedClusterForecast([], mockBeach);
      const cachedData = getCachedClusterForecast();

      expect(cachedData).not.toBeNull();
      expect(cachedData!.forecasts).toEqual([]);
      expect(cachedData!.sourceBeach).toEqual(mockBeach);
    });
  });
});
