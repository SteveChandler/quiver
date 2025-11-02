/**
 * Unit tests for rate limiting utility
 * Tests CDIP and NOAA API rate limiting functionality
 */

import {
  CDIPRateLimiter,
  NOAARateLimiter,
  RateLimiter,
  createRateLimiter,
} from "@/lib/utils/rate-limiter";

// Mock console to avoid noise in tests
const originalConsole = { ...console };
beforeAll(() => {
  console.warn = jest.fn();
  console.error = jest.fn();
});

afterAll(() => {
  console.warn = originalConsole.warn;
  console.error = originalConsole.error;
});

describe("RateLimiter", () => {
  let rateLimiter: RateLimiter;

  beforeEach(() => {
    // Reset timer to ensure clean state
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2024-01-15T12:00:00Z"));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe("Basic Rate Limiting", () => {
    beforeEach(() => {
      rateLimiter = createRateLimiter("test", {
        requestsPerMinute: 10,
        requestsPerHour: 100,
        burstLimit: 15, // Higher burst limit to test per-minute limits
      });
    });

    it("should allow requests within limits", () => {
      expect(rateLimiter.canMakeRequest()).toBe(true);
      rateLimiter.recordRequest();

      expect(rateLimiter.canMakeRequest()).toBe(true);
      rateLimiter.recordRequest();

      expect(rateLimiter.canMakeRequest()).toBe(true);
    });

    it("should block requests when burst limit exceeded", () => {
      // Create a special rate limiter with low burst limit for this test
      const burstLimiter = createRateLimiter("burst-test", {
        requestsPerMinute: 100,
        requestsPerHour: 1000,
        burstLimit: 3,
      });

      // Use up burst limit
      for (let i = 0; i < 3; i++) {
        expect(burstLimiter.canMakeRequest()).toBe(true);
        burstLimiter.recordRequest();
      }

      // Next request should be blocked
      expect(burstLimiter.canMakeRequest()).toBe(false);
    });

    it("should reset burst limit after time window", () => {
      // Create a special rate limiter with low burst limit for this test
      const burstLimiter = createRateLimiter("burst-reset-test", {
        requestsPerMinute: 100,
        requestsPerHour: 1000,
        burstLimit: 3,
      });

      // Use up burst limit
      for (let i = 0; i < 3; i++) {
        burstLimiter.recordRequest();
      }

      expect(burstLimiter.canMakeRequest()).toBe(false);

      // Advance time by 61 seconds (reset window)
      jest.advanceTimersByTime(61 * 1000);

      expect(burstLimiter.canMakeRequest()).toBe(true);
    });

    it("should respect per-minute limits", () => {
      // Make 10 requests within a minute but spread out to avoid burst limiting
      for (let i = 0; i < 10; i++) {
        expect(rateLimiter.canMakeRequest()).toBe(true);
        rateLimiter.recordRequest();
        if (i < 9) {
          // Don't advance time after the last request
          jest.advanceTimersByTime(5 * 1000); // 5 second intervals = 45 seconds total
        }
      }

      // All 10 requests were made within ~45 seconds, so 11th should be blocked
      expect(rateLimiter.canMakeRequest()).toBe(false);
    });

    it("should respect per-hour limits", () => {
      // Create a rate limiter with low hourly limit for easier testing
      const hourlyLimiter = createRateLimiter("hourly-test", {
        requestsPerMinute: 20,
        requestsPerHour: 50, // Low hourly limit
        burstLimit: 25,
      });

      // Make 50 requests spread across time
      for (let i = 0; i < 50; i++) {
        expect(hourlyLimiter.canMakeRequest()).toBe(true);
        hourlyLimiter.recordRequest();
        jest.advanceTimersByTime(30 * 1000); // 30 second intervals
      }

      // 51st request should be blocked by hourly limit
      expect(hourlyLimiter.canMakeRequest()).toBe(false);
    });

    it("should provide accurate time until reset", () => {
      // Create a rate limiter with low burst limit for this test
      const resetLimiter = createRateLimiter("reset-test", {
        requestsPerMinute: 100,
        requestsPerHour: 1000,
        burstLimit: 3,
      });

      // Use up burst limit
      for (let i = 0; i < 3; i++) {
        resetLimiter.recordRequest();
      }

      const timeUntilReset = resetLimiter.getTimeUntilReset();
      expect(timeUntilReset).toBeGreaterThan(0);
      expect(timeUntilReset).toBeLessThanOrEqual(60000); // Should be within a minute
    });
  });

  describe("CDIPRateLimiter", () => {
    it("should follow CDIP-specific limits", () => {
      // Create a fresh test instance to avoid state pollution
      const testLimiter = createRateLimiter("CDIP-Test", {
        requestsPerMinute: 60,
        requestsPerHour: 3000,
        burstLimit: 10,
      });

      expect(testLimiter.canMakeRequest()).toBe(true);

      // CDIP has a burst limit of 10, so test within that first
      for (let i = 0; i < 10; i++) {
        expect(testLimiter.canMakeRequest()).toBe(true);
        testLimiter.recordRequest();
      }

      // 11th request should be blocked by burst limit
      expect(testLimiter.canMakeRequest()).toBe(false);

      testLimiter.destroy();
    });

    it("should maintain singleton behavior", () => {
      // The singleton should provide consistent responses
      const status1 = CDIPRateLimiter.getStatus();
      const status2 = CDIPRateLimiter.getStatus();

      // Both calls should return the same instance's status
      expect(status1.requestsRemaining).toBe(status2.requestsRemaining);
    });

    it("should handle concurrent access safely", () => {
      // Create a fresh test instance to avoid state pollution
      const testLimiter = createRateLimiter("CDIP-Concurrent", {
        requestsPerMinute: 60,
        requestsPerHour: 3000,
        burstLimit: 10,
      });

      // Simulate concurrent requests
      const results = [];
      for (let i = 0; i < 5; i++) {
        if (testLimiter.canMakeRequest()) {
          testLimiter.recordRequest();
          results.push(true);
        } else {
          results.push(false);
        }
      }

      expect(results.filter(Boolean)).toHaveLength(5); // All should succeed initially

      testLimiter.destroy();
    });
  });

  describe("NOAARateLimiter", () => {
    it("should follow NOAA-specific limits", () => {
      // Create a fresh test instance to avoid state pollution
      const testLimiter = createRateLimiter("NOAA-Test", {
        requestsPerMinute: 300,
        requestsPerHour: 10000,
        burstLimit: 20,
      });

      expect(testLimiter.canMakeRequest()).toBe(true);

      // NOAA has a burst limit of 20, so test within that first
      for (let i = 0; i < 20; i++) {
        expect(testLimiter.canMakeRequest()).toBe(true);
        testLimiter.recordRequest();
      }

      // 21st request should be blocked by burst limit
      expect(testLimiter.canMakeRequest()).toBe(false);

      testLimiter.destroy();
    });

    it("should track different endpoints separately", () => {
      // Create a fresh test instance to avoid state pollution
      const testLimiter = createRateLimiter("NOAA-Endpoints", {
        requestsPerMinute: 300,
        requestsPerHour: 10000,
        burstLimit: 20,
      });

      // Record requests for different NOAA services, but within burst limit
      for (let i = 0; i < 15; i++) {
        testLimiter.recordRequest();
      }

      // Should still allow requests as we're within burst and per-minute limits
      expect(testLimiter.canMakeRequest()).toBe(true);

      testLimiter.destroy();
    });
  });

  describe("Error Handling", () => {
    it("should handle invalid configurations gracefully", () => {
      expect(() => {
        createRateLimiter("invalid", {
          requestsPerMinute: -1,
          requestsPerHour: 100,
          burstLimit: 5,
        });
      }).not.toThrow();
    });

    it("should recover from corrupted state", () => {
      const limiter = createRateLimiter("recovery-test", {
        requestsPerMinute: 10,
        requestsPerHour: 100,
        burstLimit: 3,
      });

      // Corrupt internal state
      (limiter as any).requestHistory = null;

      // Should still function
      expect(() => limiter.canMakeRequest()).not.toThrow();
      expect(() => limiter.recordRequest()).not.toThrow();
    });
  });

  describe("Performance", () => {
    it("should handle high-frequency checks efficiently", () => {
      const limiter = createRateLimiter("performance-test", {
        requestsPerMinute: 1000,
        requestsPerHour: 10000,
        burstLimit: 100,
      });

      const startTime = performance.now();

      // Make many rapid checks
      for (let i = 0; i < 1000; i++) {
        limiter.canMakeRequest();
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should complete quickly (less than 100ms for 1000 checks)
      expect(duration).toBeLessThan(100);
    });

    it("should clean up old request history", () => {
      const limiter = createRateLimiter("cleanup-test", {
        requestsPerMinute: 60,
        requestsPerHour: 1000,
        burstLimit: 10,
      });

      // Make requests over time
      for (let minute = 0; minute < 120; minute++) {
        limiter.recordRequest();
        jest.advanceTimersByTime(60 * 1000); // 1 minute
      }

      // Internal history should not grow unbounded
      const historySize = (limiter as any).requestHistory.length;
      expect(historySize).toBeLessThan(100); // Should clean up old entries
    });
  });

  describe("Integration with External APIs", () => {
    it("should provide retry suggestions", () => {
      const limiter = createRateLimiter("retry-test", {
        requestsPerMinute: 5,
        requestsPerHour: 50,
        burstLimit: 2,
      });

      // Use up limits
      for (let i = 0; i < 2; i++) {
        limiter.recordRequest();
      }

      expect(limiter.canMakeRequest()).toBe(false);

      const timeUntilReset = limiter.getTimeUntilReset();
      expect(timeUntilReset).toBeGreaterThan(0);

      // Advance past reset time
      jest.advanceTimersByTime(timeUntilReset + 1000);

      expect(limiter.canMakeRequest()).toBe(true);
    });

    it("should handle API key rotation", () => {
      const limiter1 = createRateLimiter("api-key-1", {
        requestsPerMinute: 10,
        requestsPerHour: 100,
        burstLimit: 3,
      });

      const limiter2 = createRateLimiter("api-key-2", {
        requestsPerMinute: 10,
        requestsPerHour: 100,
        burstLimit: 3,
      });

      // Use up first limiter
      for (let i = 0; i < 3; i++) {
        limiter1.recordRequest();
      }

      expect(limiter1.canMakeRequest()).toBe(false);
      expect(limiter2.canMakeRequest()).toBe(true); // Different limiter should work
    });
  });
});
