/**
 * Unit tests for surf-score-utils.ts
 *
 * These are pure-function tests — no mocks needed.
 *
 * Key constants from the source:
 *   SHOULDER_KERNEL = [0.25, 0.5, 1.0, 0.5, 0.25]  (weightSum = 2.5)
 *   KERNEL_CENTER = 2  (offset range: -2 to +2 with circular wrapping)
 *
 *   Peak month: August (index 7) for sinusoidal temp model
 *   Trough month: February (index 1) for sinusoidal temp model
 */

import {
  applyShoulderSmoothing,
  waterTempComfortScore,
  crowdScore,
  computeCompositeScore,
  estimateMonthlyTemps,
  buildMonthlyScores,
} from "@/lib/utils/surf-score-utils";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a 12-element array of zeros, then set specific indices. */
function monthArray(overrides: Record<number, number> = {}): number[] {
  const arr = new Array(12).fill(0);
  for (const [idx, val] of Object.entries(overrides)) {
    arr[Number(idx)] = val;
  }
  return arr;
}

// ---------------------------------------------------------------------------
// applyShoulderSmoothing
// ---------------------------------------------------------------------------

describe("applyShoulderSmoothing", () => {
  /*
   * Convolution formula for month M:
   *   smoothed[M] = (
   *     0.25 * count[M-2] +
   *     0.5  * count[M-1] +
   *     1.0  * count[M]   +
   *     0.5  * count[M+1] +
   *     0.25 * count[M+2]
   *   ) / 2.5
   * with circular (Dec↔Jan) wrapping.
   */

  it("throws when given an array that is not exactly 12 elements", () => {
    expect(() => applyShoulderSmoothing([1, 2, 3])).toThrow();
    expect(() => applyShoulderSmoothing(new Array(13).fill(0))).toThrow();
  });

  it("returns all zeros for all-zero input", () => {
    const result = applyShoulderSmoothing(new Array(12).fill(0));
    expect(result).toHaveLength(12);
    result.forEach((v) => expect(v).toBe(0));
  });

  it("returns identical values for all-equal input", () => {
    // Each output = (0.25*5 + 0.5*5 + 1.0*5 + 0.5*5 + 0.25*5) / 2.5 = 5
    const result = applyShoulderSmoothing(new Array(12).fill(5));
    result.forEach((v) => expect(v).toBeCloseTo(5, 6));
  });

  it("single peak — adjacent months receive partial shoulder credit", () => {
    // Peak at index 6 (July) with value 10, all others 0.
    //   smoothed[6] = 10/2.5 = 4.0
    //   smoothed[5] = (0.5*10)/2.5 = 2.0   (one step prior)
    //   smoothed[7] = (0.5*10)/2.5 = 2.0   (one step after)
    //   smoothed[4] = (0.25*10)/2.5 = 1.0  (two steps prior)
    //   smoothed[8] = (0.25*10)/2.5 = 1.0  (two steps after)
    //   all others  = 0
    const input = monthArray({ 6: 10 });
    const result = applyShoulderSmoothing(input);

    expect(result).toHaveLength(12);
    expect(result[6]).toBeCloseTo(4.0, 6);
    expect(result[5]).toBeCloseTo(2.0, 6);
    expect(result[7]).toBeCloseTo(2.0, 6);
    expect(result[4]).toBeCloseTo(1.0, 6);
    expect(result[8]).toBeCloseTo(1.0, 6);

    // Months with no proximity to the peak must be zero
    [0, 1, 2, 3, 9, 10, 11].forEach((m) => expect(result[m]).toBe(0));

    // Adjacent months got partial credit (non-zero)
    expect(result[5]).toBeGreaterThan(0);
    expect(result[7]).toBeGreaterThan(0);
  });

  it("Dec↔Jan wrapping — peak in December bleeds into January", () => {
    // Peak at index 11 (December).
    //   smoothed[11] = (1.0*6)/2.5 = 2.4
    //   smoothed[0]  = (0.5*6)/2.5 = 1.2   ← January gets shoulder credit
    //   smoothed[10] = (0.5*6)/2.5 = 1.2   ← November gets shoulder credit
    //   smoothed[1]  = (0.25*6)/2.5 = 0.6  ← February gets shoulder credit
    //   smoothed[9]  = (0.25*6)/2.5 = 0.6  ← October gets shoulder credit
    const input = monthArray({ 11: 6 });
    const result = applyShoulderSmoothing(input);

    expect(result[11]).toBeCloseTo(2.4, 6);
    expect(result[0]).toBeCloseTo(1.2, 6);   // January — wraps correctly
    expect(result[10]).toBeCloseTo(1.2, 6);  // November
    expect(result[1]).toBeCloseTo(0.6, 6);   // February — two steps via wrap
    expect(result[9]).toBeCloseTo(0.6, 6);   // October

    // January must be > 0 (wrapping is working)
    expect(result[0]).toBeGreaterThan(0);

    // Months with no proximity are zero
    [2, 3, 4, 5, 6, 7, 8].forEach((m) => expect(result[m]).toBe(0));
  });

  it("overlapping shoulders — two peaks 3 months apart combine in the middle", () => {
    // Peaks at index 6 (July) and 9 (October), value 10.
    // Middle months 7 and 8 receive contributions from BOTH peaks:
    //
    //   smoothed[7] = (0.5*months[6] + 0.25*months[9]) / 2.5
    //               = (5 + 2.5) / 2.5 = 3.0
    //
    //   smoothed[8] = (0.25*months[6] + 0.5*months[9]) / 2.5
    //               = (2.5 + 5) / 2.5 = 3.0
    //
    // A single isolated peak would give only 1.0 to the two-step-away month,
    // so 3.0 confirms both peaks contribute.
    const input = monthArray({ 6: 10, 9: 10 });
    const result = applyShoulderSmoothing(input);

    expect(result[6]).toBeCloseTo(4.0, 6);
    expect(result[9]).toBeCloseTo(4.0, 6);
    expect(result[7]).toBeCloseTo(3.0, 6);
    expect(result[8]).toBeCloseTo(3.0, 6);

    // The middle months receive more than a single-peak two-step distance (1.0)
    expect(result[7]).toBeGreaterThan(1.0);
    expect(result[8]).toBeGreaterThan(1.0);
  });
});

// ---------------------------------------------------------------------------
// waterTempComfortScore
// ---------------------------------------------------------------------------

describe("waterTempComfortScore", () => {
  /*
   * Piecewise linear map from °F to 0-100 comfort:
   *   < 45          → 10  (flat floor)
   *   45 – 55       → 20 + ((t-45)/10)*20    (20 → 40)
   *   55 – 65       → 40 + ((t-55)/10)*30    (40 → 70)
   *   65 – 78       → 70 + ((t-65)/13)*30    (70 → 100)
   *   > 78          → 90  (post-peak fallback)
   */

  it("very cold water (40°F) returns the floor value of 10", () => {
    expect(waterTempComfortScore(40)).toBe(10);
    expect(waterTempComfortScore(0)).toBe(10);
    expect(waterTempComfortScore(44.9)).toBe(10);
  });

  it("cold water (50°F) returns approximately 30 — midpoint of 20-40 range", () => {
    // Math: 20 + ((50-45)/10)*20 = 20 + 10 = 30
    expect(waterTempComfortScore(50)).toBe(30);
  });

  it("boundary at 45°F returns 20 (start of second segment)", () => {
    // Math: 20 + ((45-45)/10)*20 = 20 + 0 = 20
    expect(waterTempComfortScore(45)).toBe(20);
  });

  it("boundary at 55°F returns 40 (end of second / start of third segment)", () => {
    // tempF <= 55 is caught before the third segment; Math: 20 + 20 = 40
    expect(waterTempComfortScore(55)).toBe(40);
  });

  it("moderate water (60°F) returns approximately 55 — midpoint of 40-70 range", () => {
    // Math: 40 + ((60-55)/10)*30 = 40 + 15 = 55
    expect(waterTempComfortScore(60)).toBe(55);
  });

  it("warm water (72°F) returns approximately 86 — within 70-100 range", () => {
    // Math: 70 + ((72-65)/13)*30 = 70 + (7/13)*30 = 70 + 16.15… ≈ 86.15 → 86
    expect(waterTempComfortScore(72)).toBe(86);
  });

  it("ideal water (78°F) returns 100 — top of the comfort ramp", () => {
    // Math: 70 + ((78-65)/13)*30 = 70 + 30 = 100
    expect(waterTempComfortScore(78)).toBe(100);
  });

  it("too-warm water (85°F, above 78) returns the post-peak fallback of 90", () => {
    expect(waterTempComfortScore(85)).toBe(90);
    expect(waterTempComfortScore(100)).toBe(90);
    expect(waterTempComfortScore(78.1)).toBe(90);
  });
});

// ---------------------------------------------------------------------------
// crowdScore
// ---------------------------------------------------------------------------

describe("crowdScore", () => {
  it('"low" crowd returns 100 (highest desirability)', () => {
    expect(crowdScore("low")).toBe(100);
  });

  it('"moderate" crowd returns 60', () => {
    expect(crowdScore("moderate")).toBe(60);
  });

  it('"high" crowd returns 30 (lowest desirability)', () => {
    expect(crowdScore("high")).toBe(30);
  });
});

// ---------------------------------------------------------------------------
// computeCompositeScore
// ---------------------------------------------------------------------------

describe("computeCompositeScore", () => {
  describe("Tier 3 — beach-only", () => {
    it("returns beachPeakScore directly when no options are given", () => {
      expect(computeCompositeScore(75)).toBe(75);
      expect(computeCompositeScore(0)).toBe(0);
      expect(computeCompositeScore(100)).toBe(100);
    });

    it("returns beachPeakScore directly when tier is explicitly 3", () => {
      expect(computeCompositeScore(82, { tier: 3 })).toBe(82);
    });

    it("rounds the result", () => {
      // 74.5 rounds to 75 in JS (Math.round)
      expect(computeCompositeScore(74.5, { tier: 3 })).toBe(75);
      // 74.4 rounds to 74
      expect(computeCompositeScore(74.4, { tier: 3 })).toBe(74);
    });
  });

  describe("Tier 1 — full state monthly blend (60% beach + 25% state + 10% water + 5% crowd)", () => {
    it("computes weighted blend with all components provided", () => {
      // 0.6*80 + 0.25*70 + 0.1*90 + 0.05*60 = 48 + 17.5 + 9 + 3 = 77.5 → 78
      expect(
        computeCompositeScore(80, {
          tier: 1,
          stateOverallScore: 70,
          waterTempComfort: 90,
          crowdBonus: 60,
        })
      ).toBe(78);
    });

    it("missing optional components default to 0", () => {
      // 0.6*80 + 0.25*0 + 0.1*0 + 0.05*0 = 48 → 48
      expect(computeCompositeScore(80, { tier: 1 })).toBe(48);
    });

    it("produces a lower score than Tier 3 when supplementary scores are moderate", () => {
      const tier1 = computeCompositeScore(100, {
        tier: 1,
        stateOverallScore: 70,
        waterTempComfort: 86,
        crowdBonus: 60,
      });
      const tier3 = computeCompositeScore(100, { tier: 3 });
      // Tier 3 = 100; Tier 1 blends with lower supplementary signals → < 100
      expect(tier1).toBeLessThan(tier3);
    });
  });

  describe("Tier 2 — regional temperature blend (80% beach + 15% water + 5% crowd)", () => {
    it("computes weighted blend with all components provided", () => {
      // 0.8*80 + 0.15*90 + 0.05*60 = 64 + 13.5 + 3 = 80.5 → 81
      expect(
        computeCompositeScore(80, {
          tier: 2,
          waterTempComfort: 90,
          crowdBonus: 60,
        })
      ).toBe(81);
    });

    it("missing optional components default to 0", () => {
      // 0.8*80 + 0.15*0 + 0.05*0 = 64 → 64
      expect(computeCompositeScore(80, { tier: 2 })).toBe(64);
    });

    it("water temp provides a floor even when beach peak is 0", () => {
      // 0.8*0 + 0.15*90 = 13.5 → 14
      expect(
        computeCompositeScore(0, { tier: 2, waterTempComfort: 90 })
      ).toBe(14);
    });
  });

  describe("clamping", () => {
    it("never exceeds 100", () => {
      expect(computeCompositeScore(120, { tier: 3 })).toBe(100);
      expect(
        computeCompositeScore(100, {
          tier: 1,
          stateOverallScore: 100,
          waterTempComfort: 100,
          crowdBonus: 100,
        })
      ).toBe(100);
    });

    it("never goes below 0", () => {
      expect(computeCompositeScore(-50, { tier: 3 })).toBe(0);
      expect(
        computeCompositeScore(-100, {
          tier: 1,
          stateOverallScore: -100,
          waterTempComfort: -100,
          crowdBonus: -100,
        })
      ).toBe(0);
    });
  });
});

// ---------------------------------------------------------------------------
// estimateMonthlyTemps
// ---------------------------------------------------------------------------

describe("estimateMonthlyTemps", () => {
  /*
   * Sinusoidal model: temp[m] = avg + amplitude * cos(2π(m - 7) / 12)
   *   peak at m = 7 (August)
   *   trough at m = 1 (February)
   *
   * For "78-84": avg=81, amplitude=3
   *   temp[7] = 81 + 3*cos(0) = 84
   *   temp[1] = 81 + 3*cos(-π) = 78
   */

  it("returns null for null input", () => {
    expect(estimateMonthlyTemps(null)).toBeNull();
  });

  it("returns null for an empty string", () => {
    expect(estimateMonthlyTemps("")).toBeNull();
  });

  it("returns null for an invalid string (no dash)", () => {
    expect(estimateMonthlyTemps("78")).toBeNull();
    expect(estimateMonthlyTemps("not-a-number")).toBeNull();
  });

  it("returns null when low > high", () => {
    expect(estimateMonthlyTemps("84-78")).toBeNull();
  });

  it("valid range '78-84' — returns exactly 12 values, peaks in August, troughs in February", () => {
    const temps = estimateMonthlyTemps("78-84");

    expect(temps).not.toBeNull();
    expect(temps!).toHaveLength(12);

    // August (index 7) is the warmest month
    const augustTemp = temps![7];
    expect(augustTemp).toBeCloseTo(84, 5);

    // February (index 1) is the coldest month
    const februaryTemp = temps![1];
    expect(februaryTemp).toBeCloseTo(78, 5);

    // Peak must be the max; trough must be the min
    const max = Math.max(...temps!);
    const min = Math.min(...temps!);
    expect(augustTemp).toBeCloseTo(max, 5);
    expect(februaryTemp).toBeCloseTo(min, 5);
  });

  it("valid range '78-84' — all temps stay within the declared bounds", () => {
    const temps = estimateMonthlyTemps("78-84")!;
    temps.forEach((t) => {
      expect(t).toBeGreaterThanOrEqual(77.99); // floating point tolerance
      expect(t).toBeLessThanOrEqual(84.01);
    });
  });

  it("valid range '55-72' — temperatures stay within bounds and respect peak/trough", () => {
    // avg=63.5, amplitude=8.5
    // temp[7] = 72, temp[1] = 55
    const temps = estimateMonthlyTemps("55-72");

    expect(temps).not.toBeNull();
    expect(temps!).toHaveLength(12);

    expect(temps![7]).toBeCloseTo(72, 5);
    expect(temps![1]).toBeCloseTo(55, 5);

    temps!.forEach((t) => {
      expect(t).toBeGreaterThanOrEqual(54.99);
      expect(t).toBeLessThanOrEqual(72.01);
    });
  });

  it("parses ranges with extra whitespace around the dash", () => {
    const temps = estimateMonthlyTemps("78 - 84");
    expect(temps).not.toBeNull();
    expect(temps!).toHaveLength(12);
    expect(temps![7]).toBeCloseTo(84, 5);
  });

  it("parses ranges with decimal values", () => {
    const temps = estimateMonthlyTemps("55.5-71.5");
    expect(temps).not.toBeNull();
    expect(temps!).toHaveLength(12);
  });
});

// ---------------------------------------------------------------------------
// buildMonthlyScores
// ---------------------------------------------------------------------------

describe("buildMonthlyScores", () => {
  describe("output shape and value constraints", () => {
    it("always returns exactly 12 values", () => {
      const result = buildMonthlyScores(monthArray({ 6: 5 }));
      expect(result).toHaveLength(12);
    });

    it("all returned values are integers", () => {
      const result = buildMonthlyScores(monthArray({ 0: 10, 6: 8, 11: 7 }));
      result.forEach((v) => expect(Number.isInteger(v)).toBe(true));
    });

    it("all returned values are between 0 and 100 (inclusive)", () => {
      const result = buildMonthlyScores(monthArray({ 0: 10, 6: 8, 11: 7 }));
      result.forEach((v) => {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(100);
      });
    });
  });

  describe("Tier 3 — no supplementary data", () => {
    it("all-zero monthCounts returns all zeros", () => {
      const result = buildMonthlyScores(new Array(12).fill(0));
      result.forEach((v) => expect(v).toBe(0));
    });

    it("single-peak month normalizes to 100 at the peak", () => {
      const result = buildMonthlyScores(monthArray({ 6: 10 }));
      // After smoothing, month 6 is the max → normalized to 100 → Tier 3 = 100
      expect(result[6]).toBe(100);
    });

    it("smoothing spreads credit to adjacent months (no binary cliff)", () => {
      const result = buildMonthlyScores(monthArray({ 6: 10 }));
      // Month 5 and 7 receive shoulder credit (> 0, < 100)
      expect(result[5]).toBeGreaterThan(0);
      expect(result[7]).toBeGreaterThan(0);
      expect(result[5]).toBeLessThan(100);
      expect(result[7]).toBeLessThan(100);
    });
  });

  describe("Tier 2 — regional temperature data", () => {
    it("water temp provides a score floor even when beach count is 0 for that month", () => {
      // monthCounts has zeros in summer; waterTempRange still gives those months
      // a non-zero score from the 15% water-temp component.
      const monthCounts = monthArray({ 0: 6, 1: 6, 2: 6, 11: 6 }); // winter peaks
      const result = buildMonthlyScores(monthCounts, undefined, undefined, "78-84");

      // Summer months (e.g. June = index 5) have zero raw count
      // but should not be exactly 0 because water temp contributes
      // 0.8*0 + 0.15*waterTempComfortScore(~82.5) = ~0.15*90 = 13.5 → 14
      expect(result[5]).toBeGreaterThan(0);
      expect(result[6]).toBeGreaterThan(0);
    });

    it("all-zero monthCounts with waterTempRange returns near-zero (not exactly 0) scores", () => {
      const result = buildMonthlyScores(
        new Array(12).fill(0),
        undefined,
        undefined,
        "78-84"
      );
      // All beach peaks are 0; water temp is warm year-round → some floor
      result.forEach((v) => {
        expect(v).toBeGreaterThan(0);
        expect(v).toBeLessThanOrEqual(100);
      });
    });

    it("produces different month ordering than Tier 3 when supplementary data is provided", () => {
      const monthCounts = monthArray({ 0: 6, 1: 6, 11: 6 });
      const tier3 = buildMonthlyScores(monthCounts);
      const tier2 = buildMonthlyScores(
        monthCounts,
        undefined,
        undefined,
        "55-72"
      );

      // At least one month should differ between Tier 2 and Tier 3
      const different = tier3.some((v, i) => v !== tier2[i]);
      expect(different).toBe(true);
    });
  });

  describe("Tier 1 — full state monthly data", () => {
    it("produces different scores than Tier 3 for the same monthCounts", () => {
      const monthCounts = monthArray({ 6: 10 });

      // stateMonthly with moderate-but-not-perfect scores
      const stateMonthly = Array.from({ length: 12 }, () => ({
        overallScore: 70,
        waterTemp: 72,
        crowdLevel: "moderate" as const,
      }));

      const tier1 = buildMonthlyScores(monthCounts, stateMonthly);
      const tier3 = buildMonthlyScores(monthCounts);

      // Tier 1 peak: 0.6*100 + 0.25*70 + 0.1*86 + 0.05*60 = 89
      // Tier 3 peak: 100
      expect(tier1[6]).toBeLessThan(tier3[6]);

      // They should differ in at least one month
      const different = tier1.some((v, i) => v !== tier3[i]);
      expect(different).toBe(true);
    });

    it("all returned values are integers between 0 and 100", () => {
      const stateMonthly = Array.from({ length: 12 }, (_, i) => ({
        overallScore: 50 + i * 3,
        waterTemp: 60 + i,
        crowdLevel: (["low", "moderate", "high"] as const)[i % 3],
      }));

      const result = buildMonthlyScores(
        monthArray({ 3: 10, 9: 8 }),
        stateMonthly
      );

      result.forEach((v) => {
        expect(Number.isInteger(v)).toBe(true);
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(100);
      });
    });
  });

  describe("Rincón (Puerto Rico) winter-peak scenario", () => {
    /*
     * Rincón-style setup: 6 beaches all contributing peak months in
     * Jan (0), Feb (1), Mar (2), Dec (11).
     * waterTempRange "78-84" (warm Caribbean water year-round).
     *
     * Expected structural properties after Tier-2 blending:
     *   - Peak months (Jan, Feb) score highest
     *   - Off-season months (Jun–Sep) score lowest but NOT zero (water temp floor)
     *   - No month is exactly 0 (Caribbean water temp keeps a floor)
     *   - No binary cliff pattern (not all months 0 or 100)
     */
    const monthCounts = [6, 6, 6, 0, 0, 0, 0, 0, 0, 0, 0, 6]; // Jan, Feb, Mar, Dec
    const waterTempRange = "78-84";

    let scores: number[];

    beforeAll(() => {
      scores = buildMonthlyScores(
        monthCounts,
        undefined,
        undefined,
        waterTempRange
      );
    });

    it("returns exactly 12 scores", () => {
      expect(scores).toHaveLength(12);
    });

    it("all scores are integers between 0 and 100", () => {
      scores.forEach((v) => {
        expect(Number.isInteger(v)).toBe(true);
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(100);
      });
    });

    it("peak months (Jan and Feb) score higher than off-season months (Jun–Sep)", () => {
      const peakScore = Math.min(scores[0], scores[1]); // Jan and Feb both at max normalized
      const offSeasonMax = Math.max(scores[5], scores[6], scores[7], scores[8]);
      expect(peakScore).toBeGreaterThan(offSeasonMax);
    });

    it("no month scores exactly 0 — warm water provides a floor", () => {
      scores.forEach((v) => expect(v).toBeGreaterThan(0));
    });

    it("scores are not binary (no month is exactly 0 or the only value is 100)", () => {
      const unique = new Set(scores);
      // Should have more than 2 distinct values (not a binary 0/100 cliff)
      expect(unique.size).toBeGreaterThan(2);
    });

    it("Dec (index 11) and Mar (index 2) score similarly (symmetric smoothing)", () => {
      // Both are one-step shoulders off the Jan/Feb peak cluster
      // After smoothing and normalization they should be equal or very close
      expect(Math.abs(scores[11] - scores[2])).toBeLessThanOrEqual(2);
    });

    it("shoulder months (Apr=3, Nov=10) score between off-season and peak", () => {
      const shoulderScore = Math.min(scores[3], scores[10]);
      const peakScore = Math.min(scores[0], scores[1]);
      const offSeasonScore = Math.max(scores[5], scores[6]);

      expect(shoulderScore).toBeGreaterThan(offSeasonScore);
      expect(shoulderScore).toBeLessThan(peakScore);
    });
  });
});

// ---------------------------------------------------------------------------
// Integration: end-to-end properties across the full pipeline
// ---------------------------------------------------------------------------

describe("Integration — full pipeline properties", () => {
  it("buildMonthlyScores never produces the binary cliff pattern for a realistic beach", () => {
    // A beach with strong winter peak — should have a gradient, not just 0s and 100s
    const monthCounts = monthArray({ 11: 10, 0: 10, 1: 8, 2: 5 });
    const result = buildMonthlyScores(
      monthCounts,
      undefined,
      undefined,
      "58-68"
    );

    const unique = new Set(result);
    // Expect at least 4 distinct values across 12 months
    expect(unique.size).toBeGreaterThanOrEqual(4);

    // All values are within bounds
    result.forEach((v) => {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    });
  });

  it("applyShoulderSmoothing + normalization preserve the peak month as the highest scorer in Tier 3", () => {
    // Month 3 (April) has the highest raw count
    const monthCounts = monthArray({ 3: 20, 5: 5, 9: 3 });
    const result = buildMonthlyScores(monthCounts);

    // After smoothing and normalization, month 3 must still be the top scorer
    const maxScore = Math.max(...result);
    expect(result[3]).toBe(maxScore);
  });

  it("buildMonthlyScores with Tier 1 data never exceeds 100 or goes below 0", () => {
    const stateMonthly = Array.from({ length: 12 }, () => ({
      overallScore: 150, // deliberately out-of-range input
      waterTemp: 85,     // extremely warm
      crowdLevel: "low" as const,
    }));

    const result = buildMonthlyScores(
      monthArray({ 6: 10 }),
      stateMonthly
    );

    result.forEach((v) => {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    });
  });
});
