import {
  getScoreColorClasses,
  getQualityLabel,
  getQualityConfig,
  SCORE_THRESHOLDS,
  QUALITY_CONFIG,
} from "@/lib/utils/score-color-utils";

describe("score-color-utils", () => {
  describe("SCORE_THRESHOLDS", () => {
    it("has correct threshold values", () => {
      expect(SCORE_THRESHOLDS.EPIC).toBe(80);
      expect(SCORE_THRESHOLDS.GOOD).toBe(60);
      expect(SCORE_THRESHOLDS.FAIR).toBe(40);
      expect(SCORE_THRESHOLDS.POOR).toBe(0);
    });
  });

  describe("getScoreColorClasses", () => {
    it("returns Epic config for scores >= 80", () => {
      const result80 = getScoreColorClasses(80);
      const result90 = getScoreColorClasses(90);
      const result100 = getScoreColorClasses(100);

      expect(result80.label).toBe("Epic");
      expect(result90.label).toBe("Epic");
      expect(result100.label).toBe("Epic");
      expect(result80.bg).toBe("bg-green-500");
      expect(result80.text).toContain("text-green");
      expect(result80.border).toContain("border-green");
    });

    it("returns Good config for scores 60-79", () => {
      const result60 = getScoreColorClasses(60);
      const result70 = getScoreColorClasses(70);
      const result79 = getScoreColorClasses(79);

      expect(result60.label).toBe("Good");
      expect(result70.label).toBe("Good");
      expect(result79.label).toBe("Good");
      expect(result60.bg).toBe("bg-blue-500");
      expect(result60.text).toContain("text-blue");
      expect(result60.border).toContain("border-blue");
    });

    it("returns Fair config for scores 40-59", () => {
      const result40 = getScoreColorClasses(40);
      const result50 = getScoreColorClasses(50);
      const result59 = getScoreColorClasses(59);

      expect(result40.label).toBe("Fair");
      expect(result50.label).toBe("Fair");
      expect(result59.label).toBe("Fair");
      expect(result40.bg).toBe("bg-yellow-500");
      expect(result40.text).toContain("text-yellow");
      expect(result40.border).toContain("border-yellow");
    });

    it("returns Poor config for scores < 40", () => {
      const result0 = getScoreColorClasses(0);
      const result20 = getScoreColorClasses(20);
      const result39 = getScoreColorClasses(39);

      expect(result0.label).toBe("Poor");
      expect(result20.label).toBe("Poor");
      expect(result39.label).toBe("Poor");
      expect(result0.bg).toBe("bg-gray-400");
      expect(result0.text).toContain("text-gray");
      expect(result0.border).toContain("border-gray");
    });

    it("handles boundary conditions correctly", () => {
      // Just below boundaries
      expect(getScoreColorClasses(79.9).label).toBe("Good");
      expect(getScoreColorClasses(59.9).label).toBe("Fair");
      expect(getScoreColorClasses(39.9).label).toBe("Poor");

      // At boundaries
      expect(getScoreColorClasses(80).label).toBe("Epic");
      expect(getScoreColorClasses(60).label).toBe("Good");
      expect(getScoreColorClasses(40).label).toBe("Fair");
    });

    it("handles edge cases", () => {
      // Negative scores should return Poor
      expect(getScoreColorClasses(-10).label).toBe("Poor");
      expect(getScoreColorClasses(-1).label).toBe("Poor");

      // Scores above 100 should return Epic
      expect(getScoreColorClasses(101).label).toBe("Epic");
      expect(getScoreColorClasses(150).label).toBe("Epic");

      // Zero should return Poor
      expect(getScoreColorClasses(0).label).toBe("Poor");
    });

    it("returns all required properties", () => {
      const result = getScoreColorClasses(75);

      expect(result).toHaveProperty("bg");
      expect(result).toHaveProperty("text");
      expect(result).toHaveProperty("border");
      expect(result).toHaveProperty("label");

      expect(typeof result.bg).toBe("string");
      expect(typeof result.text).toBe("string");
      expect(typeof result.border).toBe("string");
      expect(typeof result.label).toBe("string");
    });

    it("includes dark mode variants in text property", () => {
      const epicResult = getScoreColorClasses(85);
      const goodResult = getScoreColorClasses(65);
      const fairResult = getScoreColorClasses(45);

      expect(epicResult.text).toContain("dark:");
      expect(goodResult.text).toContain("dark:");
      expect(fairResult.text).toContain("dark:");
    });
  });

  describe("getQualityLabel", () => {
    it("returns correct labels for each tier", () => {
      expect(getQualityLabel(85)).toBe("Epic");
      expect(getQualityLabel(70)).toBe("Good");
      expect(getQualityLabel(50)).toBe("Fair");
      expect(getQualityLabel(30)).toBe("Poor");
    });

    it("is consistent with getScoreColorClasses", () => {
      for (const score of [0, 30, 40, 50, 60, 70, 80, 90, 100]) {
        expect(getQualityLabel(score)).toBe(getScoreColorClasses(score).label);
      }
    });
  });

  describe("getQualityConfig", () => {
    it("returns epic config for scores >= 80", () => {
      const result = getQualityConfig(85);
      expect(result.label).toBe("Epic");
      expect(result.minScore).toBe(80);
      expect(result.badgeClass).toContain("emerald");
      expect(result.textClass).toContain("emerald");
    });

    it("returns good config for scores 60-79", () => {
      const result = getQualityConfig(70);
      expect(result.label).toBe("Good");
      expect(result.minScore).toBe(60);
      expect(result.badgeClass).toContain("blue");
      expect(result.textClass).toContain("blue");
    });

    it("returns fair config for scores 40-59", () => {
      const result = getQualityConfig(50);
      expect(result.label).toBe("Fair");
      expect(result.minScore).toBe(40);
      expect(result.badgeClass).toContain("amber");
      expect(result.textClass).toContain("amber");
    });

    it("returns poor config for scores < 40", () => {
      const result = getQualityConfig(30);
      expect(result.label).toBe("Poor");
      expect(result.minScore).toBe(0);
      expect(result.badgeClass).toContain("gray");
      expect(result.textClass).toContain("gray");
    });

    it("handles boundary conditions correctly", () => {
      expect(getQualityConfig(79.9).label).toBe("Good");
      expect(getQualityConfig(80).label).toBe("Epic");
      expect(getQualityConfig(59.9).label).toBe("Fair");
      expect(getQualityConfig(60).label).toBe("Good");
      expect(getQualityConfig(39.9).label).toBe("Poor");
      expect(getQualityConfig(40).label).toBe("Fair");
    });
  });

  describe("QUALITY_CONFIG", () => {
    it("has correct structure for all tiers", () => {
      const tiers = ["epic", "good", "fair", "poor"] as const;

      for (const tier of tiers) {
        expect(QUALITY_CONFIG[tier]).toHaveProperty("label");
        expect(QUALITY_CONFIG[tier]).toHaveProperty("minScore");
        expect(QUALITY_CONFIG[tier]).toHaveProperty("badgeClass");
        expect(QUALITY_CONFIG[tier]).toHaveProperty("textClass");
      }
    });

    it("has correct minScore values", () => {
      expect(QUALITY_CONFIG.epic.minScore).toBe(80);
      expect(QUALITY_CONFIG.good.minScore).toBe(60);
      expect(QUALITY_CONFIG.fair.minScore).toBe(40);
      expect(QUALITY_CONFIG.poor.minScore).toBe(0);
    });

    it("has correct labels", () => {
      expect(QUALITY_CONFIG.epic.label).toBe("Epic");
      expect(QUALITY_CONFIG.good.label).toBe("Good");
      expect(QUALITY_CONFIG.fair.label).toBe("Fair");
      expect(QUALITY_CONFIG.poor.label).toBe("Poor");
    });
  });
});
