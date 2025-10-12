/**
 * Tests for tide height interpolation utility
 */

import {
  interpolateTideHeight,
  findBracketingPoints,
  normalizeTimestamp,
} from "@/lib/utils/tide-interpolation";

describe("tide-interpolation", () => {
  describe("normalizeTimestamp", () => {
    it("should handle Unix timestamps", () => {
      const timestamp = 1697097600000; // Oct 12, 2023
      expect(normalizeTimestamp(timestamp)).toBe(timestamp);
    });

    it("should handle Date objects", () => {
      const date = new Date("2025-10-12T10:00:00Z");
      expect(normalizeTimestamp(date)).toBe(date.getTime());
    });

    it("should handle ISO strings", () => {
      const iso = "2025-10-12T10:00:00Z";
      const expected = new Date(iso).getTime();
      expect(normalizeTimestamp(iso)).toBe(expected);
    });
  });

  describe("interpolateTideHeight", () => {
    const baseTime = new Date("2025-10-12T08:00:00Z");

    const createDataPoints = () => [
      { time: baseTime, height: 3.5 },
      { time: new Date(baseTime.getTime() + 6 * 60 * 60 * 1000), height: 1.2 }, // +6 hours
    ];

    it("should interpolate height at midpoint", () => {
      const data = createDataPoints();
      const midpoint = new Date(baseTime.getTime() + 3 * 60 * 60 * 1000); // +3 hours
      const result = interpolateTideHeight(data, midpoint);

      expect(result).toBeCloseTo(2.35, 1); // Midpoint between 3.5 and 1.2
    });

    it("should return exact height for exact timestamp match", () => {
      const data = createDataPoints();
      const result = interpolateTideHeight(data, baseTime);

      expect(result).toBe(3.5);
    });

    it("should handle timestamp at end of range", () => {
      const data = createDataPoints();
      const endTime = new Date(baseTime.getTime() + 6 * 60 * 60 * 1000);
      const result = interpolateTideHeight(data, endTime);

      expect(result).toBe(1.2);
    });

    it("should clamp to first point if before range", () => {
      const data = createDataPoints();
      const beforeTime = new Date(baseTime.getTime() - 60 * 60 * 1000); // -1 hour
      const result = interpolateTideHeight(data, beforeTime);

      expect(result).toBe(3.5);
    });

    it("should clamp to last point if after range", () => {
      const data = createDataPoints();
      const afterTime = new Date(baseTime.getTime() + 10 * 60 * 60 * 1000); // +10 hours
      const result = interpolateTideHeight(data, afterTime);

      expect(result).toBe(1.2);
    });

    it("should return null for empty data", () => {
      const result = interpolateTideHeight([], new Date());

      expect(result).toBeNull();
    });

    it("should return height of single point", () => {
      const data = [{ time: baseTime, height: 4.2 }];
      const result = interpolateTideHeight(data, new Date());

      expect(result).toBe(4.2);
    });

    it("should handle mixed time formats", () => {
      const data = [
        { time: baseTime.getTime(), height: 3.5 }, // Unix timestamp
        { time: "2025-10-12T14:00:00Z", height: 1.2 }, // ISO string
      ];
      const midpoint = new Date("2025-10-12T11:00:00Z");
      const result = interpolateTideHeight(data, midpoint);

      expect(result).toBeCloseTo(2.35, 1);
    });

    it("should filter out invalid points", () => {
      const data = [
        { time: baseTime, height: 3.5 },
        { time: "invalid", height: 2.0 }, // Should be filtered
        { time: new Date(baseTime.getTime() + 6 * 60 * 60 * 1000), height: 1.2 },
      ];
      const midpoint = new Date(baseTime.getTime() + 3 * 60 * 60 * 1000);
      const result = interpolateTideHeight(data, midpoint);

      // Should interpolate between first and last valid points
      expect(result).toBeCloseTo(2.35, 1);
    });

    it("should handle three-quarter interpolation", () => {
      const data = createDataPoints();
      // 4.5 hours = 75% of the way from 3.5 to 1.2
      const threeQuarters = new Date(baseTime.getTime() + 4.5 * 60 * 60 * 1000);
      const result = interpolateTideHeight(data, threeQuarters);

      const expected = 3.5 + (1.2 - 3.5) * 0.75;
      expect(result).toBeCloseTo(expected, 1);
    });

    it("should work with many data points", () => {
      const data = [];
      for (let i = 0; i < 24; i++) {
        data.push({
          time: new Date(baseTime.getTime() + i * 60 * 60 * 1000),
          height: 2 + Math.sin((i / 6) * Math.PI) * 2, // Sinusoidal pattern
        });
      }

      const testTime = new Date(baseTime.getTime() + 12.5 * 60 * 60 * 1000);
      const result = interpolateTideHeight(data, testTime);

      expect(result).not.toBeNull();
      expect(typeof result).toBe("number");
    });
  });

  describe("findBracketingPoints", () => {
    const baseTime = new Date("2025-10-12T08:00:00Z");

    const createDataPoints = () => [
      { time: baseTime, height: 3.5 },
      { time: new Date(baseTime.getTime() + 3 * 60 * 60 * 1000), height: 2.5 },
      { time: new Date(baseTime.getTime() + 6 * 60 * 60 * 1000), height: 1.2 },
    ];

    it("should find correct bracketing points", () => {
      const data = createDataPoints();
      const testTime = new Date(baseTime.getTime() + 1.5 * 60 * 60 * 1000);
      const result = findBracketingPoints(data, testTime);

      expect(result).not.toBeNull();
      expect(result!.before).toEqual(data[0]);
      expect(result!.after).toEqual(data[1]);
    });

    it("should return null for insufficient data", () => {
      const data = [{ time: baseTime, height: 3.5 }];
      const result = findBracketingPoints(data, new Date());

      expect(result).toBeNull();
    });

    it("should return null for empty data", () => {
      const result = findBracketingPoints([], new Date());

      expect(result).toBeNull();
    });

    it("should handle time at exact boundary", () => {
      const data = createDataPoints();
      const testTime = data[1].time;
      const result = findBracketingPoints(data, testTime);

      expect(result).not.toBeNull();
      // When time is exactly on a boundary, it finds the bracketing points around it
      expect(result!.before).toEqual(data[0]);
      expect(result!.after).toEqual(data[1]);
    });

    it("should return null if time is outside range", () => {
      const data = createDataPoints();
      const beforeTime = new Date(baseTime.getTime() - 60 * 60 * 1000);
      const result = findBracketingPoints(data, beforeTime);

      expect(result).toBeNull();
    });
  });
});
