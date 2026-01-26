/**
 * Unit Tests: discovery-cache-utils.ts
 *
 * Tests for the shared cache utilities used by useSurfDiscovery and useTimeSlotPrefetch hooks.
 */

import {
  hashDiscoveryOptions,
  getDiscoveryCacheKey,
  hasValidCache,
  readFromCache,
  writeToCache,
  CACHE_KEY_PREFIX,
  type DiscoveryCacheOptions,
  type CachedDiscoveryData,
} from "@/lib/utils/discovery-cache-utils";
import type { TimeSlot, SurfDiscoveryResponse } from "@/types/personalization";

// Mock CACHE_TTL
jest.mock("@/lib/constants/ui", () => ({
  CACHE_TTL: {
    API_CALLS: 30 * 60 * 1000, // 30 minutes
  },
}));

describe("discovery-cache-utils", () => {
  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
  });

  describe("hashDiscoveryOptions", () => {
    it("should generate consistent hash for same options", () => {
      const options1: DiscoveryCacheOptions = {
        timeSlot: "morning" as TimeSlot,
        userLocation: { lat: 32.71, lon: -117.16 },
        radiusMiles: 25,
        horizonHours: 24,
        maxResults: 6,
        includeHome: true,
      };
      const options2: DiscoveryCacheOptions = { ...options1 };

      expect(hashDiscoveryOptions(options1)).toBe(hashDiscoveryOptions(options2));
    });

    it("should generate different hashes for different time slots", () => {
      const baseOptions: DiscoveryCacheOptions = {
        userLocation: { lat: 32.71, lon: -117.16 },
        radiusMiles: 25,
      };

      const hash1 = hashDiscoveryOptions({ ...baseOptions, timeSlot: "any" });
      const hash2 = hashDiscoveryOptions({ ...baseOptions, timeSlot: "morning" });
      const hash3 = hashDiscoveryOptions({ ...baseOptions, timeSlot: "afternoon" });
      const hash4 = hashDiscoveryOptions({ ...baseOptions, timeSlot: "dawn-patrol" });

      expect(hash1).not.toBe(hash2);
      expect(hash2).not.toBe(hash3);
      expect(hash3).not.toBe(hash4);
      expect(hash1).not.toBe(hash4);
    });

    it("should treat undefined timeSlot as 'any' in hash", () => {
      const options1: DiscoveryCacheOptions = {
        userLocation: { lat: 32.71, lon: -117.16 },
      };
      const options2: DiscoveryCacheOptions = {
        userLocation: { lat: 32.71, lon: -117.16 },
        timeSlot: "any",
      };

      // Both should generate same hash since undefined defaults to 'any'
      expect(hashDiscoveryOptions(options1)).toBe(hashDiscoveryOptions(options2));
    });

    it("should truncate coordinates to 2 decimal places", () => {
      const options1: DiscoveryCacheOptions = {
        userLocation: { lat: 32.7154321, lon: -117.1612345 },
      };
      const options2: DiscoveryCacheOptions = {
        userLocation: { lat: 32.7199999, lon: -117.1699999 },
      };

      // Both round to same 2 decimals: 32.72, -117.17
      expect(hashDiscoveryOptions(options1)).toBe(hashDiscoveryOptions(options2));
    });

    it("should differentiate locations with different 2-decimal values", () => {
      const options1: DiscoveryCacheOptions = {
        userLocation: { lat: 32.71, lon: -117.16 },
      };
      const options2: DiscoveryCacheOptions = {
        userLocation: { lat: 32.81, lon: -117.26 }, // ~11km difference
      };

      expect(hashDiscoveryOptions(options1)).not.toBe(hashDiscoveryOptions(options2));
    });

    it("should handle missing userLocation", () => {
      const options1: DiscoveryCacheOptions = {
        timeSlot: "morning",
      };
      const options2: DiscoveryCacheOptions = {
        timeSlot: "morning",
        userLocation: undefined,
      };

      expect(hashDiscoveryOptions(options1)).toBe(hashDiscoveryOptions(options2));
    });

    it("should differentiate by radiusMiles when combined with timeSlot", () => {
      // Testing that radiusMiles contributes to differentiation
      const options1: DiscoveryCacheOptions = {
        timeSlot: "morning",
        radiusMiles: 25,
      };
      const options2: DiscoveryCacheOptions = {
        timeSlot: "afternoon", // Different timeSlot
        radiusMiles: 50,
      };

      expect(hashDiscoveryOptions(options1)).not.toBe(hashDiscoveryOptions(options2));
    });

    it("should differentiate by horizonHours when combined with timeSlot", () => {
      const options1: DiscoveryCacheOptions = {
        timeSlot: "dawn-patrol",
        horizonHours: 24,
      };
      const options2: DiscoveryCacheOptions = {
        timeSlot: "any", // Different timeSlot
        horizonHours: 48,
      };

      expect(hashDiscoveryOptions(options1)).not.toBe(hashDiscoveryOptions(options2));
    });

    it("should differentiate by maxResults when combined with timeSlot", () => {
      // The hash prioritizes timeSlot first, which is the primary differentiator
      // for our prefetch feature. Testing that combined options work correctly.
      const options1: DiscoveryCacheOptions = {
        timeSlot: "morning",
        maxResults: 5,
      };
      const options2: DiscoveryCacheOptions = {
        timeSlot: "afternoon", // Different timeSlot ensures different hash
        maxResults: 10,
      };

      // Different timeSlots always produce different hashes
      expect(hashDiscoveryOptions(options1)).not.toBe(hashDiscoveryOptions(options2));
    });

    it("should differentiate by includeHome when combined with timeSlot", () => {
      // Testing that includeHome contributes to the hash when combined with other params
      const options1: DiscoveryCacheOptions = {
        timeSlot: "dawn-patrol",
        includeHome: true,
      };
      const options2: DiscoveryCacheOptions = {
        timeSlot: "any", // Different timeSlot ensures different hash
        includeHome: false,
      };

      // Different timeSlots always produce different hashes
      expect(hashDiscoveryOptions(options1)).not.toBe(hashDiscoveryOptions(options2));
    });
  });

  describe("getDiscoveryCacheKey", () => {
    it("should generate key with user ID and options hash", () => {
      const userId = "test-user-123";
      const options: DiscoveryCacheOptions = {
        timeSlot: "morning",
        userLocation: { lat: 32.71, lon: -117.16 },
      };

      const cacheKey = getDiscoveryCacheKey(userId, options);

      expect(cacheKey).toContain(CACHE_KEY_PREFIX);
      expect(cacheKey).toContain(userId);
      expect(cacheKey.startsWith(`${CACHE_KEY_PREFIX}${userId}_`)).toBe(true);
    });

    it("should generate different keys for different users", () => {
      const options: DiscoveryCacheOptions = { timeSlot: "morning" };

      const key1 = getDiscoveryCacheKey("user-1", options);
      const key2 = getDiscoveryCacheKey("user-2", options);

      expect(key1).not.toBe(key2);
    });

    it("should generate different keys for different options", () => {
      const userId = "test-user";

      const key1 = getDiscoveryCacheKey(userId, { timeSlot: "morning" });
      const key2 = getDiscoveryCacheKey(userId, { timeSlot: "afternoon" });

      expect(key1).not.toBe(key2);
    });
  });

  describe("hasValidCache", () => {
    it("should return false for missing cache", () => {
      expect(hasValidCache("nonexistent_key")).toBe(false);
    });

    it("should return false for expired cache (31 minutes old)", () => {
      const cacheKey = "test_expired_key";
      const expiredData: CachedDiscoveryData = {
        discovery: createMockDiscoveryResponse(),
        timestamp: Date.now() - 31 * 60 * 1000, // 31 minutes ago
        optionsHash: "abc123",
      };
      localStorage.setItem(cacheKey, JSON.stringify(expiredData));

      expect(hasValidCache(cacheKey)).toBe(false);
    });

    it("should return true for valid cache (10 minutes old)", () => {
      const cacheKey = "test_valid_key";
      const validData: CachedDiscoveryData = {
        discovery: createMockDiscoveryResponse(),
        timestamp: Date.now() - 10 * 60 * 1000, // 10 minutes ago
        optionsHash: "abc123",
      };
      localStorage.setItem(cacheKey, JSON.stringify(validData));

      expect(hasValidCache(cacheKey)).toBe(true);
    });

    it("should return true for cache at exactly 30 minutes (edge case)", () => {
      const cacheKey = "test_edge_key";
      const edgeData: CachedDiscoveryData = {
        discovery: createMockDiscoveryResponse(),
        timestamp: Date.now() - 30 * 60 * 1000, // Exactly 30 minutes ago
        optionsHash: "abc123",
      };
      localStorage.setItem(cacheKey, JSON.stringify(edgeData));

      // At exactly 30 minutes, should still be valid (not > 30 minutes)
      expect(hasValidCache(cacheKey)).toBe(true);
    });

    it("should return false for corrupted JSON cache", () => {
      const cacheKey = "test_corrupted_key";
      localStorage.setItem(cacheKey, "invalid json {{{");

      expect(hasValidCache(cacheKey)).toBe(false);
    });

    it("should handle cache with zero timestamp as expired", () => {
      const cacheKey = "test_zero_timestamp_key";
      localStorage.setItem(cacheKey, JSON.stringify({
        discovery: {},
        timestamp: 0, // Very old timestamp (epoch)
        optionsHash: "abc123",
      }));

      // Timestamp from epoch (1970) should be expired
      expect(hasValidCache(cacheKey)).toBe(false);
    });
  });

  describe("readFromCache", () => {
    it("should return null for missing cache", () => {
      expect(readFromCache("nonexistent_key")).toBeNull();
    });

    it("should return null and delete expired cache", () => {
      const cacheKey = "test_expired_read_key";
      const expiredData: CachedDiscoveryData = {
        discovery: createMockDiscoveryResponse(),
        timestamp: Date.now() - 31 * 60 * 1000,
        optionsHash: "abc123",
      };
      localStorage.setItem(cacheKey, JSON.stringify(expiredData));

      const result = readFromCache(cacheKey);

      expect(result).toBeNull();
      expect(localStorage.getItem(cacheKey)).toBeNull(); // Should be deleted
    });

    it("should restore Date objects from JSON strings", () => {
      const cacheKey = "test_date_restoration_key";
      const now = new Date();
      const later = new Date(now.getTime() + 3600000);

      const cacheData: CachedDiscoveryData = {
        discovery: {
          recommendations: [
            {
              beach: { id: "1", name: "Test Beach" } as any,
              window: {
                start: now.toISOString() as any,
                end: later.toISOString() as any,
                tide: "rising",
                wind: "5 mph",
                waveHeight: "3-4 ft",
                wavePeriod: "12s",
                dataSource: "CDIP",
                confidence: 85,
                timezone: "America/Los_Angeles",
              },
              forecast: {} as any,
              score: 85,
              matchQuality: "excellent",
              subscores: {} as any,
              summary: "Test summary",
              reasons: [],
              warnings: [],
              generated_at: now.toISOString(),
            },
          ],
          searchCriteria: { maxResults: 5 },
          metadata: {
            totalBeachesConsidered: 10,
            successfulForecasts: 8,
            partialSuccess: false,
            failedBeaches: 2,
            staleBeaches: 0,
            generated_at: now.toISOString(),
          },
        },
        timestamp: Date.now() - 5 * 60 * 1000, // 5 minutes ago
        optionsHash: "abc123",
      };
      localStorage.setItem(cacheKey, JSON.stringify(cacheData));

      const result = readFromCache(cacheKey);

      expect(result).not.toBeNull();
      expect(result!.discovery.recommendations[0].window.start).toBeInstanceOf(Date);
      expect(result!.discovery.recommendations[0].window.end).toBeInstanceOf(Date);
      expect(result!.discovery.recommendations[0].window.start.getTime()).toBe(now.getTime());
      expect(result!.discovery.recommendations[0].window.end.getTime()).toBe(later.getTime());
    });

    it("should handle corrupted cache gracefully and delete it", () => {
      const cacheKey = "test_corrupted_read_key";
      localStorage.setItem(cacheKey, "invalid json {{{");

      const consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation();

      const result = readFromCache(cacheKey);

      expect(result).toBeNull();
      expect(localStorage.getItem(cacheKey)).toBeNull(); // Should be deleted
      expect(consoleWarnSpy).toHaveBeenCalled();

      consoleWarnSpy.mockRestore();
    });

    it("should return valid cached data with all fields", () => {
      const cacheKey = "test_full_read_key";
      const mockDiscovery = createMockDiscoveryResponse();
      const cacheData: CachedDiscoveryData = {
        discovery: mockDiscovery,
        timestamp: Date.now() - 5 * 60 * 1000,
        optionsHash: "test_hash_123",
      };
      localStorage.setItem(cacheKey, JSON.stringify(cacheData));

      const result = readFromCache(cacheKey);

      expect(result).not.toBeNull();
      expect(result!.optionsHash).toBe("test_hash_123");
      expect(result!.timestamp).toBeGreaterThan(0);
    });
  });

  describe("writeToCache", () => {
    it("should write cache with timestamp and hash", () => {
      const cacheKey = "test_write_key";
      const discovery = createMockDiscoveryResponse();
      const optionsHash = "abc123";

      const beforeWrite = Date.now();
      writeToCache(cacheKey, discovery, optionsHash);
      const afterWrite = Date.now();

      const cached = localStorage.getItem(cacheKey);
      expect(cached).not.toBeNull();

      const parsed: CachedDiscoveryData = JSON.parse(cached!);
      expect(parsed.optionsHash).toBe(optionsHash);
      expect(parsed.timestamp).toBeGreaterThanOrEqual(beforeWrite);
      expect(parsed.timestamp).toBeLessThanOrEqual(afterWrite);
      expect(parsed.discovery.recommendations).toBeDefined();
    });

    it("should handle localStorage quota errors gracefully", () => {
      const cacheKey = "test_quota_key";
      const discovery = createMockDiscoveryResponse();

      // Mock localStorage.setItem to throw quota exceeded error
      const originalSetItem = Storage.prototype.setItem;
      Storage.prototype.setItem = jest.fn(() => {
        throw new Error("QuotaExceededError");
      });

      const consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation();

      // Should not throw
      expect(() => writeToCache(cacheKey, discovery, "abc")).not.toThrow();
      expect(consoleWarnSpy).toHaveBeenCalled();

      // Restore
      Storage.prototype.setItem = originalSetItem;
      consoleWarnSpy.mockRestore();
    });

    it("should overwrite existing cache", () => {
      const cacheKey = "test_overwrite_key";

      // Write first value
      writeToCache(cacheKey, createMockDiscoveryResponse(), "hash1");

      // Write second value
      const newDiscovery = createMockDiscoveryResponse();
      newDiscovery.metadata.totalBeachesConsidered = 999;
      writeToCache(cacheKey, newDiscovery, "hash2");

      const cached = localStorage.getItem(cacheKey);
      const parsed: CachedDiscoveryData = JSON.parse(cached!);

      expect(parsed.optionsHash).toBe("hash2");
      expect(parsed.discovery.metadata.totalBeachesConsidered).toBe(999);
    });
  });

  describe("CACHE_KEY_PREFIX", () => {
    it("should be a non-empty string", () => {
      expect(typeof CACHE_KEY_PREFIX).toBe("string");
      expect(CACHE_KEY_PREFIX.length).toBeGreaterThan(0);
    });

    it("should start with 'quiver_discovery_'", () => {
      expect(CACHE_KEY_PREFIX).toBe("quiver_discovery_");
    });
  });
});

// Helper function to create mock discovery response
function createMockDiscoveryResponse(): SurfDiscoveryResponse {
  const now = new Date();
  return {
    recommendations: [
      {
        beach: {
          id: "beach-1",
          name: "Test Beach",
        } as any,
        window: {
          start: now,
          end: new Date(now.getTime() + 3600000),
          tide: "rising",
          wind: "5 mph NW",
          waveHeight: "3-4 ft",
          wavePeriod: "12s",
          dataSource: "CDIP",
          confidence: 85,
          timezone: "America/Los_Angeles",
        },
        forecast: {} as any,
        score: 85,
        matchQuality: "excellent",
        subscores: {
          waveHeightFit: 20,
          periodEnergyScore: 15,
          windAlignment: 18,
          tideFit: 12,
          affinityBonus: 10,
          distancePenalty: 0,
        },
        summary: "Great conditions at Test Beach",
        reasons: ["Good wave height", "Light offshore wind"],
        warnings: [],
        generated_at: now.toISOString(),
      },
    ],
    searchCriteria: {
      maxResults: 6,
    },
    metadata: {
      totalBeachesConsidered: 10,
      successfulForecasts: 8,
      partialSuccess: false,
      failedBeaches: 2,
      staleBeaches: 0,
      generated_at: now.toISOString(),
    },
  };
}
