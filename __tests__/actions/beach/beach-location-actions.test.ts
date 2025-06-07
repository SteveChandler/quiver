import {
  calculateDistanceInMiles,
  toRadians,
} from "@/actions/beach/beach-location-actions";

// Mock Supabase client
const mockSupabaseClient = {
  from: jest.fn(() => ({
    select: jest.fn(() => ({
      // This will be mocked in individual tests
    })),
  })),
};

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: jest.fn(() =>
    Promise.resolve(mockSupabaseClient)
  ),
}));

// Import after mocking
import { getNearbyBeaches } from "@/actions/beach/beach-location-actions";
import type { Beach } from "@/types/database";

const mockBeaches: Beach[] = [
  {
    id: "pacific-beach",
    name: "Pacific Beach",
    latitude: 32.7841,
    longitude: -117.2527,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
  },
  {
    id: "ocean-beach",
    name: "Ocean Beach",
    latitude: 32.7503,
    longitude: -117.2534,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
  },
  {
    id: "mission-beach",
    name: "Mission Beach",
    latitude: 32.7738,
    longitude: -117.2528,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
  },
  {
    id: "huntington-beach",
    name: "Huntington Beach",
    latitude: 33.6595,
    longitude: -117.9988,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
  },
  {
    id: "malibu-beach",
    name: "Malibu Beach",
    latitude: 34.0259,
    longitude: -118.7798,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
  },
];

describe("Beach Location Actions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("toRadians", () => {
    it("should convert degrees to radians correctly", () => {
      expect(toRadians(0)).toBe(0);
      expect(toRadians(90)).toBeCloseTo(Math.PI / 2, 10);
      expect(toRadians(180)).toBeCloseTo(Math.PI, 10);
      expect(toRadians(360)).toBeCloseTo(2 * Math.PI, 10);
      expect(toRadians(-90)).toBeCloseTo(-Math.PI / 2, 10);
    });

    it("should handle decimal degrees", () => {
      expect(toRadians(45.5)).toBeCloseTo(0.7941, 3);
      expect(toRadians(123.456)).toBeCloseTo(2.1547, 3);
    });
  });

  describe("calculateDistanceInMiles", () => {
    it("should calculate distance between identical points as 0", () => {
      const distance = calculateDistanceInMiles(
        32.7841,
        -117.2527,
        32.7841,
        -117.2527
      );
      expect(distance).toBe(0);
    });

    it("should calculate distance between Pacific Beach and Ocean Beach", () => {
      // Pacific Beach: 32.7841, -117.2527
      // Ocean Beach: 32.7503, -117.2534
      const distance = calculateDistanceInMiles(
        32.7841,
        -117.2527,
        32.7503,
        -117.2534
      );

      // These beaches are approximately 2.3 miles apart
      expect(distance).toBeCloseTo(2.3, 0);
    });

    it("should calculate distance between San Diego and Los Angeles", () => {
      // San Diego (approximate): 32.7157, -117.1611
      // Los Angeles (approximate): 34.0522, -118.2437
      const distance = calculateDistanceInMiles(
        32.7157,
        -117.1611,
        34.0522,
        -118.2437
      );

      // These cities are approximately 111 miles apart
      expect(distance).toBeCloseTo(111, 0);
    });

    it("should be symmetric (distance A to B equals distance B to A)", () => {
      const lat1 = 32.7841,
        lng1 = -117.2527;
      const lat2 = 32.7503,
        lng2 = -117.2534;

      const distanceAB = calculateDistanceInMiles(lat1, lng1, lat2, lng2);
      const distanceBA = calculateDistanceInMiles(lat2, lng2, lat1, lng1);

      expect(distanceAB).toBeCloseTo(distanceBA, 10);
    });

    it("should handle negative coordinates correctly", () => {
      // Test with coordinates in different hemispheres
      const distance = calculateDistanceInMiles(
        -33.8688,
        151.2093,
        51.5074,
        -0.1278
      );

      // Sydney to London is approximately 10,500+ miles
      expect(distance).toBeGreaterThan(10000);
    });

    it("should handle edge cases", () => {
      // Equator to North Pole (quarter of Earth's circumference)
      const distance = calculateDistanceInMiles(0, 0, 90, 0);
      expect(distance).toBeCloseTo(6218, 0); // Approximately quarter of Earth's circumference
    });
  });

  describe("getNearbyBeaches", () => {
    it("should return beaches within specified radius", async () => {
      // Mock successful Supabase response
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockResolvedValue({
          data: mockBeaches,
          error: null,
        }),
      });

      // Search from Pacific Beach location with 10-mile radius
      const result = await getNearbyBeaches(32.7841, -117.2527, 10);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();

      // Should include nearby San Diego beaches but exclude distant ones
      const beachNames = result.data!.map((beach) => beach.name);
      expect(beachNames).toContain("Pacific Beach");
      expect(beachNames).toContain("Ocean Beach");
      expect(beachNames).toContain("Mission Beach");
      expect(beachNames).not.toContain("Malibu Beach"); // Too far
    });

    it("should sort beaches by distance", async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockResolvedValue({
          data: mockBeaches,
          error: null,
        }),
      });

      // Search from Pacific Beach location
      const result = await getNearbyBeaches(32.7841, -117.2527, 50);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();

      // First beach should be Pacific Beach itself (distance 0)
      expect(result.data![0].name).toBe("Pacific Beach");

      // Distances should be in ascending order
      const distances = result.data!.map((beach) =>
        calculateDistanceInMiles(
          32.7841,
          -117.2527,
          beach.latitude,
          beach.longitude
        )
      );

      for (let i = 1; i < distances.length; i++) {
        expect(distances[i]).toBeGreaterThanOrEqual(distances[i - 1]);
      }
    });

    it("should use default radius of 50 miles", async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockResolvedValue({
          data: mockBeaches,
          error: null,
        }),
      });

      const result = await getNearbyBeaches(32.7841, -117.2527);

      expect(result.success).toBe(true);
      // With 50-mile radius, should include Mission Beach but not Malibu
      const beachNames = result.data!.map((beach) => beach.name);
      expect(beachNames).toContain("Mission Beach");
      expect(beachNames).not.toContain("Malibu Beach");
    });

    it("should return empty array when no beaches exist", async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      });

      const result = await getNearbyBeaches(32.7841, -117.2527, 10);

      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });

    it("should return empty array when no beaches within radius", async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockResolvedValue({
          data: mockBeaches,
          error: null,
        }),
      });

      // Search from a location far from all beaches with small radius
      const result = await getNearbyBeaches(40.7128, -74.006, 1); // New York with 1-mile radius

      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });

    it("should handle database errors", async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockResolvedValue({
          data: null,
          error: new Error("Database connection failed"),
        }),
      });

      const result = await getNearbyBeaches(32.7841, -117.2527, 10);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Database connection failed");
    });

    it("should handle null data from database", async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockResolvedValue({
          data: null,
          error: null,
        }),
      });

      const result = await getNearbyBeaches(32.7841, -117.2527, 10);

      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });

    it("should include distance property in returned beaches", async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockResolvedValue({
          data: mockBeaches.slice(0, 3), // Just first 3 beaches
          error: null,
        }),
      });

      const result = await getNearbyBeaches(32.7841, -117.2527, 50);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();

      // Check that distance property exists on returned beaches
      result.data!.forEach((beach) => {
        expect(beach).toHaveProperty("distance");
        expect(typeof (beach as any).distance).toBe("number");
        expect((beach as any).distance).toBeGreaterThanOrEqual(0);
      });
    });
  });

  describe("Integration tests", () => {
    it("should handle large datasets efficiently", async () => {
      // Create a large dataset of beaches
      const largeBeachList = Array.from({ length: 1000 }, (_, i) => ({
        id: `beach-${i}`,
        name: `Beach ${i}`,
        latitude: 32.7841 + (Math.random() - 0.5) * 2, // Random coords around San Diego
        longitude: -117.2527 + (Math.random() - 0.5) * 2,
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
      }));

      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockResolvedValue({
          data: largeBeachList,
          error: null,
        }),
      });

      const startTime = Date.now();
      const result = await getNearbyBeaches(32.7841, -117.2527, 50);
      const endTime = Date.now();

      expect(result.success).toBe(true);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
    });

    it("should maintain precision across different coordinate systems", async () => {
      const testCases = [
        { lat1: 0, lng1: 0, lat2: 0, lng2: 1 }, // Equator
        { lat1: 89, lng1: 0, lat2: 89, lng2: 1 }, // Near North Pole
        { lat1: -89, lng1: 0, lat2: -89, lng2: 1 }, // Near South Pole
        { lat1: 32.7841, lng1: -117.2527, lat2: 32.7842, lng2: -117.2528 }, // Very close points
      ];

      testCases.forEach(({ lat1, lng1, lat2, lng2 }) => {
        const distance = calculateDistanceInMiles(lat1, lng1, lat2, lng2);
        expect(Number.isFinite(distance)).toBe(true);
        expect(distance).toBeGreaterThanOrEqual(0);
      });
    });
  });
});
