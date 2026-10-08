/**
 * Unit tests for rate limiting utility
 * Tests CDIP and NOAA API rate limiting functionality
 */

import { CDIPRateLimiter, NOAARateLimiter, RateLimiter } from "@/lib/utils/rate-limiter";

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
      rateLimiter = new RateLimiter("test", {
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
  });

  describe("CDIPRateLimiter", () => {

    it("should maintain singleton behavior", () => {
      // The singleton should provide consistent responses
      const status1 = CDIPRateLimiter.getStatus();
      const status2 = CDIPRateLimiter.getStatus();

      // Both calls should return the same instance's status
      expect(status1.requestsRemaining).toBe(status2.requestsRemaining);
    });
  });




});
