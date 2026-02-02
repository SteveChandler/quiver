/**
 * Tests for TideExtremaDetector
 *
 * Covers:
 * - Interior extrema detection (highs and lows within data)
 * - Boundary extrema detection (first/last points)
 * - Plateau handling (no false positives)
 * - Edge cases (empty, single point, two points)
 * - Unit conversion verification
 */

import {
  TideExtremaDetector,
  TideSample,
  TideExtreme,
} from "@/lib/services/noaa-coops/tide-extrema-detector";

describe("TideExtremaDetector", () => {
  let detector: TideExtremaDetector;

  beforeEach(() => {
    detector = new TideExtremaDetector();
  });

  /**
   * Helper to create samples from heights (meters)
   */
  const createSamples = (heights: number[], startTime?: Date): TideSample[] => {
    const now = startTime || new Date();
    return heights.map((h, i) => ({
      ts: new Date(now.getTime() + i * 3600000).toISOString(),
      tide_height_m: h,
    }));
  };

  describe("detectExtrema", () => {
    describe("Interior extrema detection", () => {
      it("should detect a single high tide in the middle", () => {
        // Pattern: rising -> peak -> falling
        const samples = createSamples([0.5, 1.0, 1.5, 1.0, 0.5]);
        const extrema = detector.detectExtrema(samples);

        const highs = extrema.filter((e) => e.type === "high");
        expect(highs.length).toBe(1);
        // 1.5m * 3.28084 = 4.92 ft, rounded to 4.9
        expect(highs[0].height).toBeCloseTo(4.9, 1);
        expect(highs[0].name).toBe("High");
      });

      it("should detect a single low tide in the middle", () => {
        // Pattern: falling -> trough -> rising
        const samples = createSamples([1.5, 1.0, 0.5, 1.0, 1.5]);
        const extrema = detector.detectExtrema(samples);

        const lows = extrema.filter((e) => e.type === "low");
        expect(lows.length).toBe(1);
        // 0.5m * 3.28084 = 1.64 ft, rounded to 1.6
        expect(lows[0].height).toBeCloseTo(1.6, 1);
        expect(lows[0].name).toBe("Low");
      });

      it("should detect multiple highs and lows", () => {
        // Full tide cycle: low -> high -> low -> high
        const samples = createSamples([
          0.5, // start low
          1.0, // rising
          1.5, // HIGH
          1.0, // falling
          0.3, // LOW
          0.8, // rising
          1.4, // HIGH
          0.9, // falling
          0.4, // end low
        ]);
        const extrema = detector.detectExtrema(samples);

        const highs = extrema.filter((e) => e.type === "high");
        const lows = extrema.filter((e) => e.type === "low");

        // Should detect 2 interior highs and 1 interior low
        // Plus boundary extrema
        expect(highs.length).toBeGreaterThanOrEqual(2);
        expect(lows.length).toBeGreaterThanOrEqual(1);
      });
    });

    describe("Boundary extrema detection", () => {
      it("should detect high tide at first point when higher than second", () => {
        // Window starts at high tide
        const samples = createSamples([2.0, 1.5, 1.0, 0.5]);
        const extrema = detector.detectExtrema(samples);

        const highs = extrema.filter((e) => e.type === "high");
        expect(highs.length).toBeGreaterThanOrEqual(1);
        // First point: 2.0m * 3.28084 = 6.56 ft, rounded to 6.6
        expect(highs.some((h) => Math.abs(h.height - 6.6) < 0.1)).toBe(true);
      });

      it("should detect low tide at first point when lower than second", () => {
        // Window starts at low tide
        const samples = createSamples([0.0, 0.5, 1.0, 1.5]);
        const extrema = detector.detectExtrema(samples);

        const lows = extrema.filter((e) => e.type === "low");
        expect(lows.length).toBeGreaterThanOrEqual(1);
        expect(lows.some((l) => l.height === 0)).toBe(true);
      });

      it("should detect high tide at last point when higher than second-to-last", () => {
        // Window ends at high tide
        const samples = createSamples([0.5, 1.0, 1.5, 2.0]);
        const extrema = detector.detectExtrema(samples);

        const highs = extrema.filter((e) => e.type === "high");
        expect(highs.length).toBeGreaterThanOrEqual(1);
        // Last point: 2.0m * 3.28084 = 6.56 ft, rounded to 6.6
        expect(highs.some((h) => Math.abs(h.height - 6.6) < 0.1)).toBe(true);
      });

      it("should detect low tide at last point when lower than second-to-last", () => {
        // Window ends at low tide
        const samples = createSamples([1.5, 1.0, 0.5, 0.0]);
        const extrema = detector.detectExtrema(samples);

        const lows = extrema.filter((e) => e.type === "low");
        expect(lows.length).toBeGreaterThanOrEqual(1);
        expect(lows.some((l) => l.height === 0)).toBe(true);
      });

      it("should detect extrema at both boundaries", () => {
        // Window: high -> falling -> low
        const samples = createSamples([2.0, 1.0, 0.0]);
        const extrema = detector.detectExtrema(samples);

        const highs = extrema.filter((e) => e.type === "high");
        const lows = extrema.filter((e) => e.type === "low");

        expect(highs.length).toBe(1);
        expect(lows.length).toBe(1);
      });
    });

    describe("Plateau handling (no false positives)", () => {
      it("should not detect extrema for all equal heights", () => {
        // Flat line - no extrema
        const samples = createSamples([1.5, 1.5, 1.5, 1.5]);
        const extrema = detector.detectExtrema(samples);

        expect(extrema.length).toBe(0);
      });

      it("should not detect false extrema in plateau regions", () => {
        // Pattern: rising -> plateau -> falling
        const samples = createSamples([1.0, 1.5, 1.5, 1.5, 1.0]);
        const extrema = detector.detectExtrema(samples);

        // Should only detect boundary extrema, not multiple highs in the plateau
        // First point (1.0) is lower than second (1.5) -> low boundary
        // Last point (1.0) is lower than second-to-last (1.5) -> low boundary
        const highs = extrema.filter((e) => e.type === "high");
        const lows = extrema.filter((e) => e.type === "low");

        // No interior highs (plateau is flat)
        // Lows at boundaries
        expect(highs.length).toBe(0);
        expect(lows.length).toBe(2);
      });

      it("should handle plateau followed by clear extrema", () => {
        // Pattern: plateau -> peak -> trough -> peak
        const samples = createSamples([1.0, 1.0, 1.5, 0.8, 1.3]);
        const extrema = detector.detectExtrema(samples);

        // 1.5 is higher than both neighbors (1.0 and 0.8) -> interior high
        // 0.8 is lower than both neighbors (1.5 and 1.3) -> interior low
        const highs = extrema.filter((e) => e.type === "high");
        const lows = extrema.filter((e) => e.type === "low");

        expect(highs.length).toBeGreaterThanOrEqual(1);
        expect(lows.length).toBeGreaterThanOrEqual(1);
      });
    });

    describe("Edge cases", () => {
      it("should return empty array for empty input", () => {
        const extrema = detector.detectExtrema([]);
        expect(extrema).toEqual([]);
      });

      it("should return empty array for single point", () => {
        const samples = createSamples([1.5]);
        const extrema = detector.detectExtrema(samples);
        expect(extrema).toEqual([]);
      });

      it("should handle two points - different heights", () => {
        const samples = createSamples([1.0, 2.0]);
        const extrema = detector.detectExtrema(samples);

        // First point lower -> low boundary
        // Last point higher -> high boundary
        expect(extrema.length).toBe(2);
        expect(extrema.filter((e) => e.type === "low").length).toBe(1);
        expect(extrema.filter((e) => e.type === "high").length).toBe(1);
      });

      it("should handle two points - equal heights", () => {
        const samples = createSamples([1.5, 1.5]);
        const extrema = detector.detectExtrema(samples);

        // No extrema for equal heights
        expect(extrema.length).toBe(0);
      });
    });

    describe("Unit conversion", () => {
      it("should convert meters to feet correctly", () => {
        // 1.0m should be approximately 3.3ft
        const samples = createSamples([0.5, 1.0, 0.5]);
        const extrema = detector.detectExtrema(samples);

        const high = extrema.find((e) => e.type === "high");
        expect(high).toBeDefined();
        // 1.0m * 3.28084 = 3.28084 ft, rounded to 3.3
        expect(high!.height).toBeCloseTo(3.3, 1);
      });

      it("should respect precision configuration", () => {
        const preciseDetector = new TideExtremaDetector({ precision: 2 });
        const samples = createSamples([0.5, 1.0, 0.5]);
        const extrema = preciseDetector.detectExtrema(samples);

        const high = extrema.find((e) => e.type === "high");
        expect(high).toBeDefined();
        // 1.0m * 3.28084 = 3.28 ft (2 decimal places)
        expect(high!.height).toBe(3.28);
      });
    });

    describe("Time handling", () => {
      it("should sort results by time", () => {
        // Create a pattern that would have boundary extrema before interior
        const samples = createSamples([2.0, 1.0, 0.5, 1.0, 1.5]);
        const extrema = detector.detectExtrema(samples);

        // Verify sorted by time
        for (let i = 1; i < extrema.length; i++) {
          expect(extrema[i].time).toBeGreaterThanOrEqual(extrema[i - 1].time);
        }
      });

      it("should convert timestamps to unix seconds", () => {
        const now = new Date();
        const samples = createSamples([0.5, 1.5, 0.5], now);
        const extrema = detector.detectExtrema(samples);

        const high = extrema.find((e) => e.type === "high");
        expect(high).toBeDefined();

        // The high is at index 1, which is 1 hour after start
        const expectedTime = Math.floor((now.getTime() + 3600000) / 1000);
        expect(high!.time).toBe(expectedTime);
      });
    });
  });
});
