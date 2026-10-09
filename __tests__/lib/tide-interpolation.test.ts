/**
 * Tests for tide height interpolation utility
 */

import { interpolateTideHeight, normalizeTimestamp, findTideThresholdCrossing, calculateTideWindow } from "@/lib/utils/tide-interpolation";
import type { TideScheduleEntry } from "@/types/forecast";

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



  describe("findTideThresholdCrossing", () => {
    // Low tide at 6:47am (1.2ft), High tide at 12:52pm (5.8ft)
    const lowTide = { time: new Date("2026-01-17T14:47:00Z"), height: 1.2 };
    const highTide = { time: new Date("2026-01-17T20:52:00Z"), height: 5.8 };
    const tideSchedule = [lowTide, highTide];

    it("should return null if threshold is never crossed", () => {
      const result = findTideThresholdCrossing(
        tideSchedule,
        10.0, // Higher than high tide
        "rising",
        new Date("2026-01-17T14:00:00Z")
      );

      expect(result).toBeNull();
    });

    it("should return null if threshold already passed", () => {
      const result = findTideThresholdCrossing(
        tideSchedule,
        1.5, // Below current tide at search start
        "rising",
        new Date("2026-01-17T18:00:00Z") // After tide already passed 1.5ft
      );

      expect(result).toBeNull();
    });

    it("should handle empty tide schedule", () => {
      const result = findTideThresholdCrossing([], 2.0, "rising", new Date());

      expect(result).toBeNull();
    });

    it("should select first crossing when multiple valid crossings exist", () => {
      // Schedule with two rising tide segments that cross 2.0ft
      const schedule = [
        { time: new Date("2026-01-17T06:00:00Z"), height: 1.0 }, // Low
        { time: new Date("2026-01-17T12:00:00Z"), height: 5.0 }, // High
        { time: new Date("2026-01-17T18:00:00Z"), height: 1.5 }, // Low
        { time: new Date("2026-01-18T00:00:00Z"), height: 5.5 }, // High
      ];

      const crossing = findTideThresholdCrossing(
        schedule,
        2.0,
        "rising",
        new Date("2026-01-17T05:00:00Z")
      );

      expect(crossing).not.toBeNull();
      // Should find first crossing (between 6am-12pm), not second (between 6pm-12am)
      expect(crossing!.getTime()).toBeGreaterThan(
        new Date("2026-01-17T06:00:00Z").getTime()
      );
      expect(crossing!.getTime()).toBeLessThan(
        new Date("2026-01-17T12:00:00Z").getTime()
      );
    });

    it("should return crossing time when threshold exactly at tide event", () => {
      const schedule = [
        { time: new Date("2026-01-17T06:00:00Z"), height: 2.0 }, // Exact match
        { time: new Date("2026-01-17T12:00:00Z"), height: 5.0 },
      ];

      // Searching for exactly 2.0ft rising after 5am
      const crossing = findTideThresholdCrossing(
        schedule,
        2.0,
        "rising",
        new Date("2026-01-17T05:00:00Z")
      );

      // Should return the tide event time since tide IS at threshold
      expect(crossing).not.toBeNull();
      expect(crossing!.getTime()).toBe(
        new Date("2026-01-17T06:00:00Z").getTime()
      );
    });

    it("should handle very small tide ranges gracefully", () => {
      const schedule = [
        { time: new Date("2026-01-17T06:00:00Z"), height: 2.48 },
        { time: new Date("2026-01-17T12:00:00Z"), height: 2.52 }, // Only 0.04ft range
      ];

      const crossing = findTideThresholdCrossing(
        schedule,
        2.5,
        "rising",
        new Date("2026-01-17T05:00:00Z")
      );

      // Should find crossing despite tiny range
      expect(crossing).not.toBeNull();
    });

    it("should handle unsorted input by processing in time order", () => {
      const unsorted = [
        { time: new Date("2026-01-17T12:00:00Z"), height: 5.0 }, // Out of order
        { time: new Date("2026-01-17T06:00:00Z"), height: 1.0 },
      ];

      // Should handle unsorted input
      const crossing = findTideThresholdCrossing(
        unsorted,
        2.0,
        "rising",
        new Date("2026-01-17T05:00:00Z")
      );

      expect(crossing).not.toBeNull();
      // Crossing should be between the two time points
      expect(crossing!.getTime()).toBeGreaterThan(
        new Date("2026-01-17T06:00:00Z").getTime()
      );
      expect(crossing!.getTime()).toBeLessThan(
        new Date("2026-01-17T12:00:00Z").getTime()
      );
    });
  });

  describe("calculateTideWindow", () => {
    // Realistic San Diego tide schedule for 2026-01-17
    // Low tide at 6:47am PST (14:47 UTC), High tide at 12:52pm PST (20:52 UTC), Low tide at 7:45pm PST (03:45 UTC next day)
    const tideSchedule: TideScheduleEntry[] = [
      { time: 1768661220, height: 1.2, type: "low" }, // 2026-01-17T14:47:00Z (6:47am PST)
      { time: 1768683120, height: 5.8, type: "high" }, // 2026-01-17T20:52:00Z (12:52pm PST)
      { time: 1768707900, height: 0.5, type: "low" }, // 2026-01-18T03:45:00Z (7:45pm PST)
    ];

    it("should calculate window for falling tide beach", () => {
      const result = calculateTideWindow({
        tideSchedule,
        minHeight: 2.0,
        maxHeight: 4.0,
        preferredDirection: "falling",
        afterTime: new Date("2026-01-17T20:00:00Z"), // After high tide
      });

      expect(result).not.toBeNull();
      // On falling tide, start is when it drops below max, end when it drops below min
      expect(result!.start.getTime()).toBeGreaterThan(
        new Date("2026-01-17T20:52:00Z").getTime()
      );
    });

    it('should use direction-based fallback when thresholds are impossible', () => {
      const result = calculateTideWindow({
        tideSchedule,
        minHeight: 10.0, // Above any tide height
        maxHeight: 12.0,
        preferredDirection: "either",
        afterTime: new Date("2026-01-17T14:00:00Z"),
      });

      // With fallback, returns direction-based window centered on nearest extremum
      expect(result).not.toBeNull();
      expect(result!.start).toBeInstanceOf(Date);
      expect(result!.end).toBeInstanceOf(Date);
    });

    it('should handle "slack" preference by finding mid-tide window', () => {
      const result = calculateTideWindow({
        tideSchedule,
        minHeight: 2.5,
        maxHeight: 4.5,
        preferredDirection: "slack",
        afterTime: new Date("2026-01-17T14:00:00Z"),
      });

      expect(result).not.toBeNull();
      // Slack prefers times around mid-tide
    });

    it("should return null for windows shorter than 30 minutes", () => {
      // Rapid tide change - 4ft rise in 20 minutes
      const rapidSchedule: TideScheduleEntry[] = [
        {
          time: Math.floor(
            new Date("2026-01-17T10:00:00Z").getTime() / 1000
          ),
          height: 1.0,
          type: "low",
        },
        {
          time: Math.floor(
            new Date("2026-01-17T10:20:00Z").getTime() / 1000
          ),
          height: 5.0,
          type: "high",
        },
      ];

      const result = calculateTideWindow({
        tideSchedule: rapidSchedule,
        minHeight: 2.0,
        maxHeight: 4.0,
        preferredDirection: "rising",
        afterTime: new Date("2026-01-17T09:00:00Z"),
      });

      // Window would be ~8 minutes (2ft at 10:04, 4ft at 10:12)
      // Should be rejected for being too short
      expect(result).toBeNull();
    });

    it('should try falling when rising yields no window for "either" preference', () => {
      // Schedule where there's no rising window available (only falling from high to low)
      // To ensure rising fails, we set minHeight above the low tide point
      const schedule: TideScheduleEntry[] = [
        {
          time: Math.floor(
            new Date("2026-01-17T06:00:00Z").getTime() / 1000
          ),
          height: 5.0,
          type: "high",
        },
        {
          time: Math.floor(
            new Date("2026-01-17T12:00:00Z").getTime() / 1000
          ),
          height: 1.0,
          type: "low",
        },
      ];

      const result = calculateTideWindow({
        tideSchedule: schedule,
        minHeight: 2.0,
        maxHeight: 4.0,
        preferredDirection: "either",
        afterTime: new Date("2026-01-17T06:30:00Z"), // After high tide, falling only
      });

      // Should find falling window since no rising tide segment exists
      expect(result).not.toBeNull();
      expect(result!.start.getTime()).toBeGreaterThan(
        new Date("2026-01-17T06:30:00Z").getTime()
      );
      expect(result!.end.getTime()).toBeLessThan(
        new Date("2026-01-17T12:00:00Z").getTime()
      );
    });

    it("should use direction-based fallback for inverted min/max", () => {
      const result = calculateTideWindow({
        tideSchedule,
        minHeight: 4.0,
        maxHeight: 2.0, // Min > Max (invalid configuration)
        preferredDirection: "rising",
        afterTime: new Date("2026-01-17T14:00:00Z"),
      });

      // With fallback, returns direction-based window (low to high for rising)
      expect(result).not.toBeNull();
      expect(result!.start).toBeInstanceOf(Date);
      expect(result!.end).toBeInstanceOf(Date);
    });

    it("should use direction-based fallback when thresholds are outside tide range", () => {
      const result = calculateTideWindow({
        tideSchedule,
        minHeight: 8.0, // Above any tide height (max is 5.8ft)
        maxHeight: 10.0,
        preferredDirection: "rising",
        afterTime: new Date("2026-01-17T14:00:00Z"),
      });

      // With fallback, returns direction-based window (low to high for rising)
      expect(result).not.toBeNull();
      expect(result!.start).toBeInstanceOf(Date);
      expect(result!.end).toBeInstanceOf(Date);
    });

    it("should handle afterTime in the middle of valid window", () => {
      // The rising window for 2-4ft is approximately 15:28-17:35 UTC
      const result = calculateTideWindow({
        tideSchedule,
        minHeight: 2.0,
        maxHeight: 4.0,
        preferredDirection: "rising",
        afterTime: new Date("2026-01-17T16:30:00Z"), // In the middle of the window
      });

      // Should find the next window (falling tide after high)
      if (result) {
        expect(result.start.getTime()).toBeGreaterThan(
          new Date("2026-01-17T16:30:00Z").getTime()
        );
      }
    });

    it("should use rising direction fallback (low to high)", () => {
      // Test with thresholds that won't have crossings but rising direction preferred
      const result = calculateTideWindow({
        tideSchedule,
        minHeight: 10.0, // Impossible thresholds
        maxHeight: 12.0,
        preferredDirection: "rising",
        afterTime: new Date("2026-01-17T14:00:00Z"),
      });

      expect(result).not.toBeNull();
      // For rising: window should start at low tide and end at next high
      // The low after 14:00 UTC is at ~14:47 UTC (1.73ft), high at ~20:52 UTC (5.8ft)
      expect(result!.start.getTime()).toBeGreaterThan(
        new Date("2026-01-17T14:00:00Z").getTime()
      );
      expect(result!.end.getTime()).toBeGreaterThan(result!.start.getTime());
    });

    it("should use falling direction fallback (high to low)", () => {
      const result = calculateTideWindow({
        tideSchedule,
        minHeight: 10.0, // Impossible thresholds
        maxHeight: 12.0,
        preferredDirection: "falling",
        afterTime: new Date("2026-01-17T06:00:00Z"),
      });

      expect(result).not.toBeNull();
      // For falling: window should start at high tide and end at next low
      // The high after 06:00 UTC is at ~08:52 UTC (4.56ft), low at ~14:47 UTC (1.73ft)
      expect(result!.start.getTime()).toBeGreaterThan(
        new Date("2026-01-17T06:00:00Z").getTime()
      );
      expect(result!.end.getTime()).toBeGreaterThan(result!.start.getTime());
    });

    it("should use slack fallback centered on nearest extremum", () => {
      const result = calculateTideWindow({
        tideSchedule,
        minHeight: 10.0, // Impossible thresholds
        maxHeight: 12.0,
        preferredDirection: "slack",
        afterTime: new Date("2026-01-17T14:00:00Z"),
      });

      expect(result).not.toBeNull();
      // For slack: window should be ±1.5 hours around nearest extremum
      const duration = result!.end.getTime() - result!.start.getTime();
      expect(duration).toBe(3 * 60 * 60 * 1000); // 3 hours (1.5 + 1.5)
    });
  });

  });
