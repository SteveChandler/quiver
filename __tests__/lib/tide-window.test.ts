/**
 * Tests for tide chart window calculation utility
 */

import {
  calculateTideWindow,
  filterToWindow,
  generateTicks,
  formatWindowDuration,
} from "@/lib/utils/tide-window";

describe("tide-window", () => {
  const HOUR_MS = 60 * 60 * 1000;
  const fixedNow = new Date("2025-10-12T12:00:00Z");

  describe("calculateTideWindow", () => {
    it("should calculate default 18-hour window with 1/3 bias", () => {
      const result = calculateTideWindow({ now: fixedNow });

      expect(result.nowTs).toBe(fixedNow.getTime());

      // With 18h window and 1/3 bias: 6h before, 12h after
      const expectedStart = fixedNow.getTime() - 6 * HOUR_MS;
      const expectedEnd = fixedNow.getTime() + 12 * HOUR_MS;

      expect(result.windowStart).toBe(expectedStart);
      expect(result.windowEnd).toBe(expectedEnd);

      // Default buffer is 1 hour
      expect(result.bufferStart).toBe(expectedStart - HOUR_MS);
      expect(result.bufferEnd).toBe(expectedEnd + HOUR_MS);
    });

    it("should handle custom window hours", () => {
      const result = calculateTideWindow({
        now: fixedNow,
        windowHours: 24,
        nowBias: 0.5,
      });

      // 24h window with 0.5 bias: 12h before, 12h after
      const expectedStart = fixedNow.getTime() - 12 * HOUR_MS;
      const expectedEnd = fixedNow.getTime() + 12 * HOUR_MS;

      expect(result.windowStart).toBe(expectedStart);
      expect(result.windowEnd).toBe(expectedEnd);
    });

    it("should handle nowBias = 0 (now at left edge)", () => {
      const result = calculateTideWindow({
        now: fixedNow,
        windowHours: 18,
        nowBias: 0,
      });

      // All 18 hours after "now"
      expect(result.windowStart).toBe(fixedNow.getTime());
      expect(result.windowEnd).toBe(fixedNow.getTime() + 18 * HOUR_MS);
    });

    it("should handle nowBias = 1 (now at right edge)", () => {
      const result = calculateTideWindow({
        now: fixedNow,
        windowHours: 18,
        nowBias: 1,
      });

      // All 18 hours before "now"
      expect(result.windowStart).toBe(fixedNow.getTime() - 18 * HOUR_MS);
      expect(result.windowEnd).toBe(fixedNow.getTime());
    });

    it("should handle custom buffer hours", () => {
      const result = calculateTideWindow({
        now: fixedNow,
        windowHours: 18,
        nowBias: 1 / 3,
        bufferHours: 2,
      });

      const expectedStart = fixedNow.getTime() - 6 * HOUR_MS;
      const expectedEnd = fixedNow.getTime() + 12 * HOUR_MS;

      expect(result.bufferStart).toBe(expectedStart - 2 * HOUR_MS);
      expect(result.bufferEnd).toBe(expectedEnd + 2 * HOUR_MS);
    });

    it("should handle zero buffer", () => {
      const result = calculateTideWindow({
        now: fixedNow,
        windowHours: 18,
        bufferHours: 0,
      });

      expect(result.bufferStart).toBe(result.windowStart);
      expect(result.bufferEnd).toBe(result.windowEnd);
    });

    it("should throw error for invalid windowHours", () => {
      expect(() => calculateTideWindow({ windowHours: 0 })).toThrow(
        "windowHours must be positive"
      );
      expect(() => calculateTideWindow({ windowHours: -5 })).toThrow(
        "windowHours must be positive"
      );
    });

    it("should throw error for invalid nowBias", () => {
      expect(() => calculateTideWindow({ nowBias: -0.1 })).toThrow(
        "nowBias must be between 0 and 1"
      );
      expect(() => calculateTideWindow({ nowBias: 1.5 })).toThrow(
        "nowBias must be between 0 and 1"
      );
    });

    it("should throw error for negative bufferHours", () => {
      expect(() => calculateTideWindow({ bufferHours: -1 })).toThrow(
        "bufferHours must be non-negative"
      );
    });

    it("should use current time when now is not provided", () => {
      const before = Date.now();
      const result = calculateTideWindow();
      const after = Date.now();

      expect(result.nowTs).toBeGreaterThanOrEqual(before);
      expect(result.nowTs).toBeLessThanOrEqual(after);
    });
  });

  describe("filterToWindow", () => {
    const bounds = calculateTideWindow({
      now: fixedNow,
      windowHours: 18,
      nowBias: 1 / 3,
      bufferHours: 1,
    });

    const createTestData = () => [
      { time: fixedNow.getTime() - 10 * HOUR_MS, value: 1 }, // Before buffer
      { time: fixedNow.getTime() - 6 * HOUR_MS, value: 2 }, // At window start
      { time: fixedNow.getTime(), value: 3 }, // At now
      { time: fixedNow.getTime() + 12 * HOUR_MS, value: 4 }, // At window end
      { time: fixedNow.getTime() + 20 * HOUR_MS, value: 5 }, // After buffer
    ];

    it("should filter to window with buffer by default", () => {
      const data = createTestData();
      const result = filterToWindow(data, bounds, true);

      // Should include points within buffer zone
      expect(result.length).toBeGreaterThan(2);
      expect(result).toContainEqual(data[1]);
      expect(result).toContainEqual(data[2]);
      expect(result).toContainEqual(data[3]);
    });

    it("should filter to window without buffer", () => {
      const data = createTestData();
      const result = filterToWindow(data, bounds, false);

      // Should only include points within window (not buffer)
      expect(result).toContainEqual(data[1]);
      expect(result).toContainEqual(data[2]);
      expect(result).toContainEqual(data[3]);
    });

    it("should handle Date objects", () => {
      const data = [
        { time: new Date(fixedNow.getTime() - 6 * HOUR_MS), value: 1 },
        { time: new Date(fixedNow.getTime()), value: 2 },
        { time: new Date(fixedNow.getTime() + 12 * HOUR_MS), value: 3 },
      ];
      const result = filterToWindow(data, bounds, false);

      expect(result.length).toBe(3);
    });

    it("should handle ISO string dates", () => {
      const data = [
        { time: new Date(fixedNow.getTime() - 6 * HOUR_MS).toISOString(), value: 1 },
        { time: fixedNow.toISOString(), value: 2 },
        { time: new Date(fixedNow.getTime() + 12 * HOUR_MS).toISOString(), value: 3 },
      ];
      const result = filterToWindow(data, bounds, false);

      expect(result.length).toBe(3);
    });

    it("should return empty array for empty input", () => {
      const result = filterToWindow([], bounds);

      expect(result).toEqual([]);
    });
  });

  describe("generateTicks", () => {
    const bounds = calculateTideWindow({
      now: fixedNow,
      windowHours: 18,
      nowBias: 1 / 3,
    });

    it("should generate ticks at 3-hour intervals by default", () => {
      const ticks = generateTicks(bounds);

      // 18-hour window should have ~6-7 ticks at 3-hour intervals
      expect(ticks.length).toBeGreaterThanOrEqual(6);
      expect(ticks.length).toBeLessThanOrEqual(8);

      // Check intervals are 3 hours
      for (let i = 1; i < ticks.length; i++) {
        expect(ticks[i] - ticks[i - 1]).toBe(3 * HOUR_MS);
      }
    });

    it("should generate ticks at custom intervals", () => {
      const ticks = generateTicks(bounds, 6);

      // 18-hour window should have ~3-4 ticks at 6-hour intervals
      expect(ticks.length).toBeGreaterThanOrEqual(3);
      expect(ticks.length).toBeLessThanOrEqual(4);

      // Check intervals are 6 hours
      for (let i = 1; i < ticks.length; i++) {
        expect(ticks[i] - ticks[i - 1]).toBe(6 * HOUR_MS);
      }
    });

    it("should generate ticks at 1-hour intervals", () => {
      const ticks = generateTicks(bounds, 1);

      // 18-hour window should have ~18-19 ticks at 1-hour intervals
      expect(ticks.length).toBeGreaterThanOrEqual(18);
      expect(ticks.length).toBeLessThanOrEqual(20);
    });

    it("should include ticks only within window", () => {
      const ticks = generateTicks(bounds);

      // All ticks should be within window bounds
      ticks.forEach(tick => {
        expect(tick).toBeGreaterThanOrEqual(bounds.windowStart);
        expect(tick).toBeLessThanOrEqual(bounds.windowEnd);
      });
    });
  });

  describe("formatWindowDuration", () => {
    it("should format 18-hour window", () => {
      const bounds = calculateTideWindow({
        now: fixedNow,
        windowHours: 18,
      });
      const result = formatWindowDuration(bounds);

      expect(result).toBe("18-Hour");
    });

    it("should format 24-hour window", () => {
      const bounds = calculateTideWindow({
        now: fixedNow,
        windowHours: 24,
      });
      const result = formatWindowDuration(bounds);

      expect(result).toBe("24-Hour");
    });

    it("should format 12-hour window", () => {
      const bounds = calculateTideWindow({
        now: fixedNow,
        windowHours: 12,
      });
      const result = formatWindowDuration(bounds);

      expect(result).toBe("12-Hour");
    });

    it("should round to nearest hour", () => {
      // Create bounds with slight imprecision
      const bounds = {
        windowStart: fixedNow.getTime(),
        windowEnd: fixedNow.getTime() + 17.7 * HOUR_MS,
        nowTs: fixedNow.getTime(),
        bufferStart: fixedNow.getTime(),
        bufferEnd: fixedNow.getTime() + 17.7 * HOUR_MS,
      };
      const result = formatWindowDuration(bounds);

      expect(result).toBe("18-Hour");
    });
  });
});
