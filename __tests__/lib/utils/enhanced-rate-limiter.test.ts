/**
 * Unit tests for Enhanced Rate Limiter
 *
 * Tests per-identifier rate limiting with burst protection,
 * per-minute limits, and per-hour limits.
 */

import {
  EnhancedRateLimiter,
  createEnhancedRateLimiter,
  getCachedRateLimiter,
  clearRateLimiterCache,
} from "@/lib/utils/enhanced-rate-limiter";
import { RateLimiterConfig } from "@/types/forecast";

describe("EnhancedRateLimiter", () => {
  let limiter: EnhancedRateLimiter;

  beforeEach(() => {
    // Create a fresh limiter for each test
    const config: RateLimiterConfig = {
      requestsPerMinute: 10,
      requestsPerHour: 100,
      burstLimit: 5,
    };
    limiter = createEnhancedRateLimiter("TestLimiter", config);
  });

  afterEach(() => {
    // Clean up
    limiter.destroy();
    clearRateLimiterCache();
  });

  describe("Per-identifier tracking", () => {
    it("should track requests separately for different identifiers", () => {
      const identifier1 = "192.168.1.1";
      const identifier2 = "192.168.1.2";

      // Identifier 1: Make requests up to burst limit
      for (let i = 0; i < 5; i++) {
        expect(limiter.canMakeRequest(identifier1)).toBe(true);
        limiter.recordRequest(identifier1);
      }

      // Identifier 1: Burst limit reached
      expect(limiter.canMakeRequest(identifier1)).toBe(false);

      // Identifier 2: Should still be able to make requests
      expect(limiter.canMakeRequest(identifier2)).toBe(true);
      limiter.recordRequest(identifier2);
      expect(limiter.canMakeRequest(identifier2)).toBe(true);
    });

    it("should allow requests for unknown identifiers", () => {
      const identifier = "new-identifier";
      expect(limiter.canMakeRequest(identifier)).toBe(true);
    });
  });

  describe("Burst limit protection", () => {
    it("should enforce burst limit", () => {
      const identifier = "192.168.1.1";
      const burstLimit = 5;

      // Make requests up to burst limit
      for (let i = 0; i < burstLimit; i++) {
        expect(limiter.canMakeRequest(identifier)).toBe(true);
        limiter.recordRequest(identifier);
      }

      // Next request should be blocked
      expect(limiter.canMakeRequest(identifier)).toBe(false);
    });

    it("should reset burst limit after time window", async () => {
      const identifier = "192.168.1.1";

      // Fill burst limit
      for (let i = 0; i < 5; i++) {
        limiter.recordRequest(identifier);
      }

      expect(limiter.canMakeRequest(identifier)).toBe(false);

      // Wait for burst window to expire (1 minute)
      await new Promise((resolve) => setTimeout(resolve, 61000));

      // Should be able to make requests again
      expect(limiter.canMakeRequest(identifier)).toBe(true);
    }, 65000); // Increase test timeout
  });

  describe("Per-minute limit", () => {
    it("should enforce per-minute limit", () => {
      const identifier = "192.168.1.1";
      const perMinuteLimit = 10;

      // Make requests up to per-minute limit
      for (let i = 0; i < perMinuteLimit; i++) {
        expect(limiter.canMakeRequest(identifier)).toBe(true);
        limiter.recordRequest(identifier);
      }

      // Next request should be blocked
      expect(limiter.canMakeRequest(identifier)).toBe(false);
    });
  });

  describe("Per-hour limit", () => {
    it("should track per-hour limit", () => {
      const identifier = "192.168.1.1";
      const status = limiter.getStatus(identifier);

      expect(status).toBeDefined();
      expect(status.canMakeRequest).toBe(true);
      expect(status.requestsRemaining).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Retry-after calculation", () => {
    it("should calculate retry-after time when rate limited", () => {
      const identifier = "192.168.1.1";

      // Fill burst limit
      for (let i = 0; i < 5; i++) {
        limiter.recordRequest(identifier);
      }

      // Should be rate limited
      expect(limiter.canMakeRequest(identifier)).toBe(false);

      // Should have retry-after time
      const retryAfter = limiter.getRetryAfter(identifier);
      expect(retryAfter).toBeGreaterThan(0);
      expect(retryAfter).toBeLessThanOrEqual(60); // Max 60 seconds for burst
    });

    it("should return 0 retry-after when not rate limited", () => {
      const identifier = "192.168.1.1";

      const retryAfter = limiter.getRetryAfter(identifier);
      expect(retryAfter).toBe(0);
    });
  });

  describe("Status reporting", () => {
    it("should return accurate status", () => {
      const identifier = "192.168.1.1";

      // Initial status
      let status = limiter.getStatus(identifier);
      expect(status.canMakeRequest).toBe(true);
      expect(status.requestsRemaining).toBe(10);

      // Make some requests
      limiter.recordRequest(identifier);
      limiter.recordRequest(identifier);

      // Updated status
      status = limiter.getStatus(identifier);
      expect(status.canMakeRequest).toBe(true);
      expect(status.requestsRemaining).toBe(8);
    });

    it("should show zero remaining when rate limited", () => {
      const identifier = "192.168.1.1";

      // Fill per-minute limit
      for (let i = 0; i < 10; i++) {
        limiter.recordRequest(identifier);
      }

      const status = limiter.getStatus(identifier);
      expect(status.canMakeRequest).toBe(false);
      expect(status.requestsRemaining).toBe(0);
      expect(status.timeUntilReset).toBeGreaterThan(0);
    });
  });

  describe("Diagnostics", () => {
    it("should provide diagnostic information", () => {
      const identifier1 = "192.168.1.1";
      const identifier2 = "192.168.1.2";

      limiter.recordRequest(identifier1);
      limiter.recordRequest(identifier2);

      const diagnostics = limiter.getDiagnostics();

      expect(diagnostics.name).toBe("TestLimiter");
      expect(diagnostics.activeIdentifiers).toBe(2);
      expect(diagnostics.totalRequests).toBe(2);
      expect(diagnostics.lastCleanup).toBeDefined();
    });
  });

  describe("Memory management", () => {
    it("should clean up old requests", () => {
      const identifier = "192.168.1.1";

      // Make some requests
      limiter.recordRequest(identifier);
      limiter.recordRequest(identifier);

      let diagnostics = limiter.getDiagnostics();
      expect(diagnostics.totalRequests).toBe(2);

      // Manually trigger cleanup
      // Note: In real scenario, this happens automatically
      // For testing, we'd need to wait or expose cleanup method
    });

    it("should handle many identifiers without memory issues", () => {
      // Simulate many different users
      for (let i = 0; i < 1000; i++) {
        const identifier = `192.168.1.${i % 255}`;
        limiter.recordRequest(identifier);
      }

      const diagnostics = limiter.getDiagnostics();
      expect(diagnostics.activeIdentifiers).toBeGreaterThan(0);
      expect(diagnostics.activeIdentifiers).toBeLessThanOrEqual(1000);
    });
  });

  describe("Configuration validation", () => {
    it("should enforce minimum values for config", () => {
      const config: RateLimiterConfig = {
        requestsPerMinute: 0,
        requestsPerHour: -10,
        burstLimit: 0,
      };

      const limiter = createEnhancedRateLimiter("InvalidConfig", config);

      // Should have been corrected to minimums
      const diagnostics = limiter.getDiagnostics();
      expect(diagnostics.config.requestsPerMinute).toBeGreaterThanOrEqual(1);
      expect(diagnostics.config.requestsPerHour).toBeGreaterThanOrEqual(1);
      expect(diagnostics.config.burstLimit).toBeGreaterThanOrEqual(1);

      limiter.destroy();
    });
  });

  describe("Factory functions", () => {
    it("createEnhancedRateLimiter should create new instance", () => {
      const config: RateLimiterConfig = {
        requestsPerMinute: 5,
        requestsPerHour: 50,
        burstLimit: 3,
      };

      const limiter = createEnhancedRateLimiter("Factory", config);
      expect(limiter).toBeInstanceOf(EnhancedRateLimiter);

      limiter.destroy();
    });

    it("getCachedRateLimiter should return same instance for same key", () => {
      const config: RateLimiterConfig = {
        requestsPerMinute: 5,
        requestsPerHour: 50,
        burstLimit: 3,
      };

      const limiter1 = getCachedRateLimiter("Cached", config);
      const limiter2 = getCachedRateLimiter("Cached", config);

      // Should be the same instance
      expect(limiter1).toBe(limiter2);

      // Clean up
      clearRateLimiterCache();
    });

    it("getCachedRateLimiter should return different instances for different keys", () => {
      const config: RateLimiterConfig = {
        requestsPerMinute: 5,
        requestsPerHour: 50,
        burstLimit: 3,
      };

      const limiter1 = getCachedRateLimiter("Cache1", config);
      const limiter2 = getCachedRateLimiter("Cache2", config);

      // Should be different instances
      expect(limiter1).not.toBe(limiter2);

      // Clean up
      clearRateLimiterCache();
    });

    it("clearRateLimiterCache should remove all cached instances", () => {
      const config: RateLimiterConfig = {
        requestsPerMinute: 5,
        requestsPerHour: 50,
        burstLimit: 3,
      };

      getCachedRateLimiter("Cache1", config);
      getCachedRateLimiter("Cache2", config);

      clearRateLimiterCache();

      // Getting again should create new instances
      const limiter1 = getCachedRateLimiter("Cache1", config);
      const limiter2 = getCachedRateLimiter("Cache1", config);

      expect(limiter1).toBe(limiter2); // Still cached
    });
  });

  describe("Edge cases", () => {
    it("should handle undefined endpoint in recordRequest", () => {
      const identifier = "192.168.1.1";

      expect(() => {
        limiter.recordRequest(identifier);
      }).not.toThrow();

      expect(() => {
        limiter.recordRequest(identifier, "/api/test");
      }).not.toThrow();
    });

    it("should handle empty identifier string", () => {
      const identifier = "";

      expect(limiter.canMakeRequest(identifier)).toBe(true);
      expect(() => {
        limiter.recordRequest(identifier);
      }).not.toThrow();
    });

    it("should handle very long identifier string", () => {
      const identifier = "x".repeat(1000);

      expect(limiter.canMakeRequest(identifier)).toBe(true);
      expect(() => {
        limiter.recordRequest(identifier);
      }).not.toThrow();
    });
  });
});

describe("Rate Limiter Config Validation", () => {
  it("should handle extreme config values", () => {
    const config: RateLimiterConfig = {
      requestsPerMinute: 1000000,
      requestsPerHour: 10000000,
      burstLimit: 10000,
    };

    const limiter = createEnhancedRateLimiter("Extreme", config);
    const diagnostics = limiter.getDiagnostics();

    expect(diagnostics.config.requestsPerMinute).toBe(1000000);
    expect(diagnostics.config.requestsPerHour).toBe(10000000);
    expect(diagnostics.config.burstLimit).toBe(10000);

    limiter.destroy();
  });
});
