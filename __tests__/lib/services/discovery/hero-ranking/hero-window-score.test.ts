/**
 * Tests for `computeHeroWindowScore` and the window-evidence helpers.
 *
 * Asserts the two key behaviors from the plan:
 *  - fragility-vs-steady: a one-slot peak with weak setupSuitability does not
 *    beat a steadier window with strong setupSuitability.
 *  - longer-window-wins: at equal slot scores, a 4-hour window beats a
 *    1.5-hour window.
 */

import {
  computeHeroWindowScore,
  type HeroWindowScoreInput,
} from "@/lib/services/discovery/hero-ranking/hero-window-score";
import {
  computeWindowDurationScore,
  computeWindowPersistence,
} from "@/lib/services/discovery/hero-ranking/window-evidence";

describe("computeWindowPersistence", () => {
  it("returns 0 for an empty array", () => {
    expect(computeWindowPersistence([])).toBe(0);
  });

  it("returns 100 when all slots are equal (zero stddev)", () => {
    expect(computeWindowPersistence([75, 75, 75, 75])).toBe(100);
  });

  it("penalizes high-variance windows more than low-variance", () => {
    const steady = computeWindowPersistence([73, 75, 76, 74]);
    const fragile = computeWindowPersistence([82, 55, 50, 48]);
    expect(steady).toBeGreaterThan(fragile);
  });

  it("clamps to [0, 100]", () => {
    const v = computeWindowPersistence([0, 100, 0, 100]);
    expect(v).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThanOrEqual(100);
  });
});

describe("computeWindowDurationScore", () => {
  it.each([
    [0, 0],
    [1, 25],
    [2, 50],
    [3, 75],
    [4, 100],
  ])("hours=%i → score=%i", (hours, expected) => {
    expect(computeWindowDurationScore(hours)).toBe(expected);
  });

  it("caps at 100 for windows ≥ 4 hours", () => {
    expect(computeWindowDurationScore(6)).toBe(100);
    expect(computeWindowDurationScore(12)).toBe(100);
  });

  it("clamps negative inputs to 0", () => {
    expect(computeWindowDurationScore(-1)).toBe(0);
  });
});

describe("computeHeroWindowScore", () => {
  it("penalizes one-slot peaks vs steadier setup-correct windows", () => {
    const fragile = computeHeroWindowScore({
      representativeSlotScore: 82,
      setupSuitability: 50,
      windowSlotScores: [82, 55, 50, 48], // one peak then dies
      windowDurationHours: 1.5,
      tideFitAcrossWindow: 70,
      windQualityScore: 80,
    });
    const steady = computeHeroWindowScore({
      representativeSlotScore: 75,
      setupSuitability: 78,
      windowSlotScores: [73, 75, 76, 74],
      windowDurationHours: 4,
      tideFitAcrossWindow: 65,
      windQualityScore: 80,
    });
    expect(steady).toBeGreaterThan(fragile);
  });

  it("rewards longer viable windows over short ones at equal slot scores", () => {
    const baseline: Omit<HeroWindowScoreInput, "windowDurationHours" | "windowSlotScores"> = {
      representativeSlotScore: 75,
      setupSuitability: 75,
      tideFitAcrossWindow: 70,
      windQualityScore: 70,
    };
    const short = computeHeroWindowScore({
      ...baseline,
      windowSlotScores: [75, 75],
      windowDurationHours: 1.5,
    });
    const long = computeHeroWindowScore({
      ...baseline,
      windowSlotScores: [75, 75, 75, 75],
      windowDurationHours: 4,
    });
    expect(long).toBeGreaterThan(short);
  });

  it("clamps the result to [0, 100]", () => {
    const score = computeHeroWindowScore({
      representativeSlotScore: 100,
      setupSuitability: 100,
      windowSlotScores: [100, 100, 100, 100],
      windowDurationHours: 4,
      tideFitAcrossWindow: 100,
      windQualityScore: 100,
    });
    expect(score).toBeLessThanOrEqual(100);
    expect(score).toBeGreaterThanOrEqual(0);
  });
});
