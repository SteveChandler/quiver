/**
 * Tests for TideExtremaDetector
 *
 * Covers:
 * - Interior extrema detection (highs and lows within data)
 * - Boundary extrema detection (first/last points)
 * - Plateau handling (a flat turn is one extreme; a flat step is none)
 * - Edge cases (empty, single point, two points)
 * - Unit conversion verification
 */

import {
  TideExtremaDetector,
  TideSample,
  TideExtreme,
} from "@/lib/services/noaa-coops/tide-extrema-detector";
import {
  LA_JOLLA_9410230_ROWS,
  TOURMALINE_9410196_ROWS,
  rowsVisibleAt,
} from "@/__tests__/fixtures/noaa-tide-series-20260930";

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

      it("detects one high at the middle of a flat top between lower neighbours", () => {
        // Rising -> flat top -> falling is slack water at high tide, not a
        // non-event: exactly one high, timed at the middle of the flat run.
        const start = new Date("2026-09-30T00:00:00.000Z");
        const samples = createSamples([1.0, 1.5, 1.5, 1.5, 1.0], start);
        const extrema = detector.detectExtrema(samples);

        const highs = extrema.filter((e) => e.type === "high");
        const lows = extrema.filter((e) => e.type === "low");

        expect(highs).toEqual([
          {
            time: Math.floor(Date.parse("2026-09-30T02:00:00.000Z") / 1000),
            height: 4.9,
            type: "high",
            name: "High",
          },
        ]);
        expect(lows.length).toBe(2);
      });

      it("detects one low at the middle of a flat bottom between higher neighbours", () => {
        const start = new Date("2026-09-30T00:00:00.000Z");
        const samples = createSamples([1.0, 0.4, 0.4, 1.0], start);
        const extrema = detector.detectExtrema(samples);

        expect(extrema.filter((e) => e.type === "low")).toEqual([
          {
            time: Math.floor(Date.parse("2026-09-30T01:30:00.000Z") / 1000),
            height: 1.3,
            type: "low",
            name: "Low",
          },
        ]);
      });

      it("does not call a flat step inside a rise a turning point", () => {
        // Boundary low, the 1.5 m high, boundary low; the 1.0 m step is neither.
        const samples = createSamples([0.5, 1.0, 1.0, 1.5, 1.0]);
        const extrema = detector.detectExtrema(samples);

        expect(extrema.map((e) => [e.type, e.height])).toEqual([
          ["low", 1.6],
          ["high", 4.9],
          ["low", 3.3],
        ]);
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
        expect(high).toMatchObject({ type: "high", name: "High" });
        // 1.0m * 3.28084 = 3.28084 ft, rounded to 3.3
        expect(high!.height).toBeCloseTo(3.3, 1);
      });

      it("should respect precision configuration", () => {
        const preciseDetector = new TideExtremaDetector({ precision: 2 });
        const samples = createSamples([0.5, 1.0, 0.5]);
        const extrema = preciseDetector.detectExtrema(samples);

        const high = extrema.find((e) => e.type === "high");
        expect(high).toMatchObject({ type: "high", name: "High" });
        // 1.0m * 3.28084 = 3.28 ft (2 decimal places)
        expect(high!.height).toBe(3.28);
      });
    });

    describe("NOAA hourly series", () => {
      const toSamples = (rows: readonly { ts: string; tide_height_m: number }[]) =>
        rows.map(({ ts, tide_height_m }) => ({ ts, tide_height_m }));
      const at = (iso: string) => Math.floor(Date.parse(iso) / 1000);

      it("finds Tourmaline's 9410196 high when two hours tie at the peak", () => {
        // The 20:01Z build read from 14:01Z; the tie at 18Z/19Z dropped this
        // high and the row interpolated low-to-low instead (2.8 ft at 18Z).
        const samples = toSamples(
          rowsVisibleAt(TOURMALINE_9410196_ROWS, "2026-09-30T20:01:27.368Z"),
        );

        expect(detector.detectExtrema(samples)).toEqual([
          { time: at("2026-09-30T15:00:00Z"), height: 3.8, type: "low", name: "Low" },
          { time: at("2026-09-30T18:30:00Z"), height: 6.1, type: "high", name: "High" },
          { time: at("2026-10-01T02:00:00Z"), height: 0.2, type: "low", name: "Low" },
          { time: at("2026-10-01T04:00:00Z"), height: 1.1, type: "high", name: "High" },
        ]);
      });

      it("keeps La Jolla's 9410230 single-point high where NOAA puts it", () => {
        const extrema = detector.detectExtrema(toSamples(LA_JOLLA_9410230_ROWS));

        expect(extrema.filter((e) => e.type === "high")[0]).toEqual({
          time: at("2026-09-30T18:00:00Z"),
          height: 5.9,
          type: "high",
          name: "High",
        });
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
        expect(high).toMatchObject({ type: "high", name: "High" });

        // The high is at index 1, which is 1 hour after start
        const expectedTime = Math.floor((now.getTime() + 3600000) / 1000);
        expect(high!.time).toBe(expectedTime);
      });
    });
  });
});
