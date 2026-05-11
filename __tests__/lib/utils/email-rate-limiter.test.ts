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

const START_TIME = new Date("2026-01-01T00:00:00.000Z");

describe("email-rate-limiter", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(START_TIME);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe("RESEND_RATE_LIMIT_MS constant", () => {
    it("should be 600ms (2 req/s with buffer)", () => {
      expect(RESEND_RATE_LIMIT_MS).toBe(600);
    });
  });

  describe("sleep", () => {
    it("should resolve after specified time", async () => {
      let resolved = false;
      const sleepPromise = sleep(50).then(() => {
        resolved = true;
      });

      await jest.advanceTimersByTimeAsync(49);
      expect(resolved).toBe(false);

      await jest.advanceTimersByTimeAsync(1);
      await sleepPromise;
      expect(resolved).toBe(true);
    });
  });

  describe("SequentialRateLimiter", () => {
    describe("throttle", () => {
      it("should not wait on first call", async () => {
        const limiter = new SequentialRateLimiter(100);

        await limiter.throttle();

        expect(limiter.getRemainingWaitTime()).toBe(100);
      });

      it("should wait for remaining time on subsequent calls", async () => {
        const limiter = new SequentialRateLimiter(100);

        await limiter.throttle();
        await jest.advanceTimersByTimeAsync(30);

        let resolved = false;
        const throttlePromise = limiter.throttle().then(() => {
          resolved = true;
        });

        await jest.advanceTimersByTimeAsync(69);
        expect(resolved).toBe(false);

        await jest.advanceTimersByTimeAsync(1);
        await throttlePromise;

        expect(resolved).toBe(true);
        expect(limiter.getRemainingWaitTime()).toBe(100);
      });

      it("should not wait if interval has passed", async () => {
        const limiter = new SequentialRateLimiter(50);

        await limiter.throttle();
        await jest.advanceTimersByTimeAsync(60);

        await limiter.throttle();

        expect(limiter.getRemainingWaitTime()).toBe(50);
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
        await jest.advanceTimersByTimeAsync(60);
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
        await jest.advanceTimersByTimeAsync(60);

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

        await limiter.throttle();

        expect(limiter.getRemainingWaitTime()).toBe(100);
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

      await limiter.throttle();
      timestamps.push(Date.now());

      for (let i = 0; i < 2; i++) {
        const throttlePromise = limiter.throttle().then(() => {
          timestamps.push(Date.now());
        });

        await jest.advanceTimersByTimeAsync(50);
        await throttlePromise;
      }

      expect(timestamps).toHaveLength(3);
      expect(timestamps[1] - timestamps[0]).toBe(50);
      expect(timestamps[2] - timestamps[1]).toBe(50);
    });

    it("should account for processing time between operations", async () => {
      const limiter = new SequentialRateLimiter(50);
      const timestamps: number[] = [];

      await limiter.throttle();
      timestamps.push(Date.now());

      await jest.advanceTimersByTimeAsync(20);

      const throttlePromise = limiter.throttle().then(() => {
        timestamps.push(Date.now());
      });

      await jest.advanceTimersByTimeAsync(30);
      await throttlePromise;

      expect(timestamps[1] - timestamps[0]).toBe(50);
    });
  });
});
