/**
 * Unit tests for beginner-seasonal-utils.ts
 *
 * Tests use RELATIVE ORDERING (not exact scores) so threshold tuning does
 * not break them. Structural and data-completeness tests use property checks
 * rather than hard-coded values.
 *
 * Tier classification:
 *   Tier 1 (state-profile) — CA, HI, FL, OR, WA, NJ, NC, TX  (full monthly data)
 *   Tier 2 (regional)       — PR, SC, ME, MA, RI, CT, NY, DE, MD, VA, GA, AL, MS, LA, NH
 *   Tier 3 (generic)        — any slug with no regional or profile data (e.g. "zz")
 */

import {
  getBeginnerSeasonalData,
  waveSmallnessScore,
  computeBeginnerMonthScore,
  scoreToTier,
} from "@/lib/utils/beginner-seasonal-utils";

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function findSeason(stateSlug: string, seasonName: string) {
  const result = getBeginnerSeasonalData(stateSlug);
  return result.seasons.find((s) => s.season === seasonName)!;
}

// ---------------------------------------------------------------------------
// waveSmallnessScore
// ---------------------------------------------------------------------------

describe("waveSmallnessScore", () => {
  it("returns a number between 0 and 100 for any valid range", () => {
    const inputs = ["1-2 ft", "2-4 ft", "3-5 ft", "4-8 ft", "6-12 ft", "8-15 ft"];
    for (const input of inputs) {
      const score = waveSmallnessScore(input);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    }
  });

  it("returns a higher score for smaller waves than larger waves", () => {
    const small = waveSmallnessScore("1-2 ft");
    const medium = waveSmallnessScore("3-5 ft");
    const large = waveSmallnessScore("6-12 ft");

    expect(small).toBeGreaterThan(medium);
    expect(medium).toBeGreaterThan(large);
  });

  it('"1-2 ft" scores higher than "3-5 ft"', () => {
    expect(waveSmallnessScore("1-2 ft")).toBeGreaterThan(waveSmallnessScore("3-5 ft"));
  });

  it('"3-5 ft" scores higher than "6-12 ft"', () => {
    expect(waveSmallnessScore("3-5 ft")).toBeGreaterThan(waveSmallnessScore("6-12 ft"));
  });

  it("returns the neutral fallback (50) for an unparseable input", () => {
    expect(waveSmallnessScore("unknown")).toBe(50);
    expect(waveSmallnessScore("")).toBe(50);
  });
});

// ---------------------------------------------------------------------------
// computeBeginnerMonthScore
// ---------------------------------------------------------------------------

describe("computeBeginnerMonthScore", () => {
  it("returns a number between 0 and 100 for a typical summer month", () => {
    const score = computeBeginnerMonthScore({
      month: "July",
      waveHeightRange: "2-4 ft",
      waterTemp: 68,
      wetsuit: "spring suit",
      crowdLevel: "moderate",
      overallScore: 55,
      bestFor: "Summer surf",
    });

    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it("returns a number between 0 and 100 for a typical winter month", () => {
    const score = computeBeginnerMonthScore({
      month: "January",
      waveHeightRange: "6-12 ft",
      waterTemp: 48,
      wetsuit: "5/4mm + boots/gloves/hood",
      crowdLevel: "low",
      overallScore: 60,
      bestFor: "Winter storms",
    });

    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it("returns an integer", () => {
    const score = computeBeginnerMonthScore({
      month: "June",
      waveHeightRange: "1-3 ft",
      waterTemp: 75,
      wetsuit: "boardshorts",
      crowdLevel: "high",
      overallScore: 30,
      bestFor: "Summer begins",
    });

    expect(Number.isInteger(score)).toBe(true);
  });

  it("small warm waves score higher than large cold waves", () => {
    const beginnerFriendly = computeBeginnerMonthScore({
      month: "June",
      waveHeightRange: "1-3 ft",
      waterTemp: 78,
      wetsuit: "boardshorts",
      crowdLevel: "moderate",
      overallScore: 30,
      bestFor: "Warm, gentle surf",
    });

    const beginerUnfriendly = computeBeginnerMonthScore({
      month: "January",
      waveHeightRange: "8-15 ft",
      waterTemp: 46,
      wetsuit: "5/4mm + boots/gloves/hood",
      crowdLevel: "low",
      overallScore: 55,
      bestFor: "Big winter storms",
    });

    expect(beginnerFriendly).toBeGreaterThan(beginerUnfriendly);
  });
});

// ---------------------------------------------------------------------------
// scoreToTier
// ---------------------------------------------------------------------------

describe("scoreToTier", () => {
  it('score of 80 maps to tier "great"', () => {
    const { tier } = scoreToTier(80);
    expect(tier).toBe("great");
  });

  it('score of 50 maps to tier "decent"', () => {
    const { tier } = scoreToTier(50);
    expect(tier).toBe("decent");
  });

  it('score of 30 maps to tier "challenging"', () => {
    const { tier } = scoreToTier(30);
    expect(tier).toBe("challenging");
  });

  it('score of 65 maps to tier "great" (boundary)', () => {
    const { tier } = scoreToTier(65);
    expect(tier).toBe("great");
  });

  it('score of 64 maps to tier "decent" (just below great boundary)', () => {
    const { tier } = scoreToTier(64);
    expect(tier).toBe("decent");
  });

  it('score of 40 maps to tier "decent" (boundary)', () => {
    const { tier } = scoreToTier(40);
    expect(tier).toBe("decent");
  });

  it('score of 39 maps to tier "challenging" (just below decent boundary)', () => {
    const { tier } = scoreToTier(39);
    expect(tier).toBe("challenging");
  });

  it("always returns a non-empty color string", () => {
    const scores = [0, 30, 40, 50, 65, 80, 100];
    for (const score of scores) {
      const { color } = scoreToTier(score);
      expect(typeof color).toBe("string");
      expect(color.length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// getBeginnerSeasonalData
// ---------------------------------------------------------------------------

describe("getBeginnerSeasonalData", () => {
  // -------------------------------------------------------------------------
  // Structure: 4 seasons always returned
  // -------------------------------------------------------------------------

  describe("structure", () => {
    it("always returns exactly 4 seasons for a Tier 1 state", () => {
      const { seasons } = getBeginnerSeasonalData("ca");
      expect(seasons).toHaveLength(4);
    });

    it("always returns exactly 4 seasons for a Tier 2 state", () => {
      const { seasons } = getBeginnerSeasonalData("pr");
      expect(seasons).toHaveLength(4);
    });

    it("always returns exactly 4 seasons for a Tier 3 (unknown) state", () => {
      const { seasons } = getBeginnerSeasonalData("zz");
      expect(seasons).toHaveLength(4);
    });

    it("returned seasons are Spring, Summer, Fall, Winter in that order", () => {
      const { seasons } = getBeginnerSeasonalData("ca");
      expect(seasons.map((s) => s.season)).toEqual(["Spring", "Summer", "Fall", "Winter"]);
    });

    it("all scores are 0-100 for every season (CA)", () => {
      const { seasons } = getBeginnerSeasonalData("ca");
      for (const s of seasons) {
        expect(s.beginnerScore).toBeGreaterThanOrEqual(0);
        expect(s.beginnerScore).toBeLessThanOrEqual(100);
      }
    });

    it("all scores are 0-100 for every season (PR - Tier 2)", () => {
      const { seasons } = getBeginnerSeasonalData("pr");
      for (const s of seasons) {
        expect(s.beginnerScore).toBeGreaterThanOrEqual(0);
        expect(s.beginnerScore).toBeLessThanOrEqual(100);
      }
    });

    it("all scores are 0-100 for every season (unknown - Tier 3)", () => {
      const { seasons } = getBeginnerSeasonalData("zz");
      for (const s of seasons) {
        expect(s.beginnerScore).toBeGreaterThanOrEqual(0);
        expect(s.beginnerScore).toBeLessThanOrEqual(100);
      }
    });

    it("every season has a non-empty description string (CA)", () => {
      const { seasons } = getBeginnerSeasonalData("ca");
      for (const s of seasons) {
        expect(typeof s.description).toBe("string");
        expect(s.description.length).toBeGreaterThan(0);
      }
    });

    it("every season has a non-empty description string (PR)", () => {
      const { seasons } = getBeginnerSeasonalData("pr");
      for (const s of seasons) {
        expect(typeof s.description).toBe("string");
        expect(s.description.length).toBeGreaterThan(0);
      }
    });

    it("every season has a non-empty description string (unknown Tier 3)", () => {
      const { seasons } = getBeginnerSeasonalData("zz");
      for (const s of seasons) {
        expect(typeof s.description).toBe("string");
        expect(s.description.length).toBeGreaterThan(0);
      }
    });

    it("tier field on each season matches the score tier boundary", () => {
      const { seasons } = getBeginnerSeasonalData("ca");
      for (const s of seasons) {
        const { tier } = scoreToTier(s.beginnerScore);
        expect(s.tier).toBe(tier);
      }
    });
  });

  // -------------------------------------------------------------------------
  // Data source tiers
  // -------------------------------------------------------------------------

  describe("data source tiers", () => {
    it('CA returns dataSource "state-profile" (Tier 1)', () => {
      const { dataSource } = getBeginnerSeasonalData("ca");
      expect(dataSource).toBe("state-profile");
    });

    it('HI returns dataSource "state-profile" (Tier 1)', () => {
      const { dataSource } = getBeginnerSeasonalData("hi");
      expect(dataSource).toBe("state-profile");
    });

    it('FL returns dataSource "state-profile" (Tier 1)', () => {
      const { dataSource } = getBeginnerSeasonalData("fl");
      expect(dataSource).toBe("state-profile");
    });

    it('OR returns dataSource "state-profile" (Tier 1)', () => {
      const { dataSource } = getBeginnerSeasonalData("or");
      expect(dataSource).toBe("state-profile");
    });

    it('PR returns dataSource "state-profile" (Tier 1)', () => {
      const { dataSource } = getBeginnerSeasonalData("pr");
      expect(dataSource).toBe("state-profile");
    });

    it('unknown state "zz" returns dataSource "generic" (Tier 3)', () => {
      const { dataSource } = getBeginnerSeasonalData("zz");
      expect(dataSource).toBe("generic");
    });

    it("slug lookup is case-insensitive", () => {
      const lower = getBeginnerSeasonalData("ca");
      const upper = getBeginnerSeasonalData("CA");
      expect(lower.dataSource).toBe(upper.dataSource);
      expect(lower.seasons.map((s) => s.beginnerScore)).toEqual(
        upper.seasons.map((s) => s.beginnerScore)
      );
    });
  });

  // -------------------------------------------------------------------------
  // Data completeness
  // -------------------------------------------------------------------------

  describe("data completeness", () => {
    it("Tier 1 states have non-null waveRange, waterTempRange, wetsuit, crowdLevel for all seasons", () => {
      const tier1States = ["ca", "hi", "fl", "or"];
      for (const slug of tier1States) {
        const { seasons } = getBeginnerSeasonalData(slug);
        for (const s of seasons) {
          expect(s.waveRange).not.toBeNull();
          expect(s.waterTempRange).not.toBeNull();
          expect(s.wetsuit).not.toBeNull();
          expect(s.crowdLevel).not.toBeNull();
        }
      }
    });

    it("Tier 3 has null waveRange, waterTempRange, wetsuit, crowdLevel for all seasons", () => {
      const { seasons } = getBeginnerSeasonalData("zz");
      for (const s of seasons) {
        expect(s.waveRange).toBeNull();
        expect(s.waterTempRange).toBeNull();
        expect(s.wetsuit).toBeNull();
        expect(s.crowdLevel).toBeNull();
      }
    });

    it("Tier 1 waveRange values are parseable as 'N-M ft' strings", () => {
      const { seasons } = getBeginnerSeasonalData("ca");
      for (const s of seasons) {
        expect(s.waveRange).toMatch(/\d+-\d+ ft/);
      }
    });

    it("Tier 1 waterTempRange values contain two numbers", () => {
      const { seasons } = getBeginnerSeasonalData("ca");
      for (const s of seasons) {
        expect(s.waterTempRange).toMatch(/\d+-\d+/);
      }
    });

    it("each season has a months field matching expected format (e.g. 'Jun-Aug')", () => {
      const { seasons } = getBeginnerSeasonalData("ca");
      const monthsFields = seasons.map((s) => s.months);
      expect(monthsFields).toContain("Mar-May");
      expect(monthsFields).toContain("Jun-Aug");
      expect(monthsFields).toContain("Sep-Nov");
      expect(monthsFields).toContain("Dec-Feb");
    });
  });

  // -------------------------------------------------------------------------
  // Relative ordering — beginner-friendliness
  // -------------------------------------------------------------------------

  describe("relative ordering", () => {
    it("CA Summer scores higher than CA Winter for beginners (warm small waves vs cold big waves)", () => {
      const caSummer = findSeason("ca", "Summer");
      const caWinter = findSeason("ca", "Winter");

      // CA summer: 2-5 ft waves, 63-68°F water
      // CA winter: 4-10 ft waves, 56-58°F water
      expect(caSummer.beginnerScore).toBeGreaterThan(caWinter.beginnerScore);
    });

    it("HI Spring scores higher than HI Winter for beginners (small vs massive north shore waves)", () => {
      const hiSpring = findSeason("hi", "Spring");
      const hiWinter = findSeason("hi", "Winter");

      // HI spring: 2-5 ft waves, warm boardshort water
      // HI winter: 6-15 ft waves (north shore peak), still warm but huge surf
      expect(hiSpring.beginnerScore).toBeGreaterThan(hiWinter.beginnerScore);
    });

    it("FL Summer scores higher than FL Fall for beginners (small vs hurricane swells)", () => {
      const flSummer = findSeason("fl", "Summer");
      const flFall = findSeason("fl", "Fall");

      // FL summer: 1-3 ft waves, very warm water
      // FL fall: 3-8 ft hurricane swells
      expect(flSummer.beginnerScore).toBeGreaterThan(flFall.beginnerScore);
    });

    it("OR Summer scores higher than OR Winter for beginners (small vs massive winter storms)", () => {
      const orSummer = findSeason("or", "Summer");
      const orWinter = findSeason("or", "Winter");

      // OR summer: 2-4 ft waves, slightly warmer water
      // OR winter: 6-12 ft waves, near-freezing water
      expect(orSummer.beginnerScore).toBeGreaterThan(orWinter.beginnerScore);
    });

    it("WA Summer scores higher than WA Winter for beginners (same reason as OR)", () => {
      const waSummer = findSeason("wa", "Summer");
      const waWinter = findSeason("wa", "Winter");

      // WA summer: 2-4 ft waves, warmer (though still cold) water
      // WA winter: 6-12 ft waves, coldest water of the year
      expect(waSummer.beginnerScore).toBeGreaterThan(waWinter.beginnerScore);
    });

    it("NJ Summer scores higher than NJ Winter for beginners (mostly flat vs cold big nor'easters)", () => {
      const njSummer = findSeason("nj", "Summer");
      const njWinter = findSeason("nj", "Winter");

      // NJ summer: 1-2 ft waves, warm water
      // NJ winter: 3-6 ft waves, near-freezing water
      expect(njSummer.beginnerScore).toBeGreaterThan(njWinter.beginnerScore);
    });
  });
});
