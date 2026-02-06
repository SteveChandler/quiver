/**
 * Unit tests for email rate limiter utility
 * Tests sequential rate limiting for Resend API
 */

import {
  SequentialRateLimiter,
  createResendRateLimiter,
  sleep,
  RESEND_RATE_LIMIT_MS,
} from "@/lib/utils/email-rate-limiter";

describe("email-rate-limiter", () => {
  describe("RESEND_RATE_LIMIT_MS constant", () => {
    it("should be 600ms (2 req/s with buffer)", () => {
      expect(RESEND_RATE_LIMIT_MS).toBe(600);
    });
  });

  describe("sleep", () => {
    it("should resolve after specified time", async () => {
      const start = Date.now();
      await sleep(50);
      const elapsed = Date.now() - start;

      // Allow some tolerance for timing
      expect(elapsed).toBeGreaterThanOrEqual(45);
      expect(elapsed).toBeLessThan(100);
    });
  });

  describe("SequentialRateLimiter", () => {
    describe("throttle", () => {
      it("should not wait on first call", async () => {
        const limiter = new SequentialRateLimiter(100);
        const start = Date.now();
        await limiter.throttle();
        const elapsed = Date.now() - start;

        // First call should be immediate (< 10ms)
        expect(elapsed).toBeLessThan(10);
      });

      it("should wait for remaining time on subsequent calls", async () => {
        const limiter = new SequentialRateLimiter(100);

        await limiter.throttle();
        // Simulate some processing time
        await sleep(30);

        const start = Date.now();
        await limiter.throttle();
        const elapsed = Date.now() - start;

        // Should wait approximately 70ms (100 - 30)
        expect(elapsed).toBeGreaterThanOrEqual(60);
        expect(elapsed).toBeLessThan(100);
      });

      it("should not wait if interval has passed", async () => {
        const limiter = new SequentialRateLimiter(50);

        await limiter.throttle();
        // Wait longer than the interval
        await sleep(60);

        const start = Date.now();
        await limiter.throttle();
        const elapsed = Date.now() - start;

        // Should not wait
        expect(elapsed).toBeLessThan(10);
      });
    });

    describe("shouldWait", () => {
      it("should return false on first check", () => {
        const limiter = new SequentialRateLimiter(100);
        expect(limiter.shouldWait()).toBe(false);
      });

      it("should return true immediately after throttle", async () => {
        const limiter = new SequentialRateLimiter(100);
        await limiter.throttle();
        expect(limiter.shouldWait()).toBe(true);
      });

      it("should return false after interval has passed", async () => {
        const limiter = new SequentialRateLimiter(50);
        await limiter.throttle();
        await sleep(60);
        expect(limiter.shouldWait()).toBe(false);
      });
    });

    describe("getRemainingWaitTime", () => {
      it("should return 0 on first check", () => {
        const limiter = new SequentialRateLimiter(100);
        expect(limiter.getRemainingWaitTime()).toBe(0);
      });

      it("should return remaining time after throttle", async () => {
        const limiter = new SequentialRateLimiter(100);
        await limiter.throttle();

        const remaining = limiter.getRemainingWaitTime();
        expect(remaining).toBeGreaterThan(0);
        expect(remaining).toBeLessThanOrEqual(100);
      });

      it("should return 0 after interval has passed", async () => {
        const limiter = new SequentialRateLimiter(50);
        await limiter.throttle();
        await sleep(60);

        expect(limiter.getRemainingWaitTime()).toBe(0);
      });
    });

    describe("reset", () => {
      it("should allow immediate throttle after reset", async () => {
        const limiter = new SequentialRateLimiter(100);
        await limiter.throttle();

        expect(limiter.shouldWait()).toBe(true);

        limiter.reset();

        expect(limiter.shouldWait()).toBe(false);

        const start = Date.now();
        await limiter.throttle();
        const elapsed = Date.now() - start;

        expect(elapsed).toBeLessThan(10);
      });
    });
  });

  describe("createResendRateLimiter", () => {
    it("should create a limiter with 600ms interval", async () => {
      const limiter = createResendRateLimiter();

      await limiter.throttle();
      const remaining = limiter.getRemainingWaitTime();

      // Should be close to 600ms
      expect(remaining).toBeGreaterThan(580);
      expect(remaining).toBeLessThanOrEqual(600);
    });

    it("should create independent instances", async () => {
      const limiter1 = createResendRateLimiter();
      const limiter2 = createResendRateLimiter();

      await limiter1.throttle();

      // limiter2 should not be affected
      expect(limiter2.shouldWait()).toBe(false);
    });
  });

  describe("sequential email sending simulation", () => {
    it("should properly rate limit sequential operations", async () => {
      const limiter = new SequentialRateLimiter(50);
      const timestamps: number[] = [];

      // Simulate sending 3 emails
      for (let i = 0; i < 3; i++) {
        await limiter.throttle();
        timestamps.push(Date.now());
      }

      // Check intervals between sends
      const interval1 = timestamps[1] - timestamps[0];
      const interval2 = timestamps[2] - timestamps[1];

      // First email is immediate, subsequent ones should wait ~50ms
      expect(interval1).toBeGreaterThanOrEqual(45);
      expect(interval2).toBeGreaterThanOrEqual(45);
    });
  });
});
