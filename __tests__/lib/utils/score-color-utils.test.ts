import {
  getScoreColorClasses,
  getQualityLabel,
  getQualityConfig,
  SCORE_THRESHOLDS,
  QUALITY_CONFIG,
} from "@/lib/utils/score-color-utils";

describe("score-color-utils", () => {
  describe("SCORE_THRESHOLDS", () => {
    it("matches the native score vocabulary thresholds while preserving POOR", () => {
      expect(SCORE_THRESHOLDS.EPIC).toBe(80);
      expect(SCORE_THRESHOLDS.GOOD).toBe(70);
      expect(SCORE_THRESHOLDS.FAIR).toBe(55);
      expect(SCORE_THRESHOLDS.RIDEABLE).toBe(40);
      expect(SCORE_THRESHOLDS.MEH).toBe(0);
      expect(SCORE_THRESHOLDS.POOR).toBe(0);
    });
  });

  describe("getScoreColorClasses", () => {
    it.each([
      [80, "EPIC"],
      [100, "EPIC"],
      [70, "GOOD"],
      [79.9, "GOOD"],
      [55, "FAIR"],
      [69.9, "FAIR"],
      [40, "RIDEABLE"],
      [54.9, "RIDEABLE"],
      [0, "MEH"],
      [39.9, "MEH"],
      [-1, "MEH"],
    ])("returns %s as %s", (score, label) => {
      expect(getScoreColorClasses(score).label).toBe(label);
    });

    it("returns brand-aligned classes instead of generic green success classes", () => {
      const classes = Object.entries(getScoreColorClasses(85))
        .filter(([key]) => key !== "paperBadge")
        .map(([, value]) => value)
        .join(" ");

      expect(classes).toContain("teal");
      expect(classes).not.toContain("green");
      expect(classes).not.toContain("#");
    });

    it("returns all required properties with dark-mode text variants", () => {
      const result = getScoreColorClasses(75);

      expect(result).toHaveProperty("bg");
      expect(result).toHaveProperty("text");
      expect(result).toHaveProperty("paperBadge");
      expect(result).toHaveProperty("border");
      expect(result).toHaveProperty("label");
      expect(result.text).toContain("dark:");
    });

    it("uses one opaque ink badge treatment in every score band", () => {
      const paperBadgeClasses = [0, 40, 55, 70, 80].map(
        (score) => getScoreColorClasses(score).paperBadge
      );

      expect(new Set(paperBadgeClasses)).toEqual(
        new Set(["bg-[#11100D] text-[#F4EBD8]"])
      );
    });
  });

  describe("getQualityLabel", () => {
    it("returns native uppercase labels for each tier", () => {
      expect(getQualityLabel(85)).toBe("EPIC");
      expect(getQualityLabel(70)).toBe("GOOD");
      expect(getQualityLabel(50)).toBe("RIDEABLE");
      expect(getQualityLabel(40)).toBe("RIDEABLE");
      expect(getQualityLabel(39)).toBe("MEH");
    });

    it("is consistent with getScoreColorClasses", () => {
      for (const score of [0, 29, 30, 39, 40, 59, 60, 79, 80, 100]) {
        expect(getQualityLabel(score)).toBe(getScoreColorClasses(score).label);
      }
    });
  });

  describe("getQualityConfig", () => {
    it.each([
      [85, "EPIC", 80],
      [70, "GOOD", 70],
      [50, "RIDEABLE", 40],
      [35, "MEH", 0],
      [20, "MEH", 0],
    ])("returns config for score %s", (score, label, minScore) => {
      const result = getQualityConfig(score);

      expect(result.label).toBe(label);
      expect(result.minScore).toBe(minScore);
    });

    it("keeps the poor key as a MEH compatibility alias", () => {
      expect(getQualityConfig(10)).toBe(QUALITY_CONFIG.poor);
      expect(QUALITY_CONFIG.poor.label).toBe("MEH");
      expect(QUALITY_CONFIG.poor.minScore).toBe(SCORE_THRESHOLDS.MEH);
    });
  });

  describe("QUALITY_CONFIG", () => {
    it("keeps legacy keys and adds rideable", () => {
      const tiers = ["epic", "good", "fair", "rideable", "poor"] as const;

      for (const tier of tiers) {
        expect(QUALITY_CONFIG[tier]).toHaveProperty("label");
        expect(QUALITY_CONFIG[tier]).toHaveProperty("minScore");
        expect(QUALITY_CONFIG[tier]).toHaveProperty("badgeClass");
        expect(QUALITY_CONFIG[tier]).toHaveProperty("textClass");
      }
    });

    it("has native labels", () => {
      expect(QUALITY_CONFIG.epic.label).toBe("EPIC");
      expect(QUALITY_CONFIG.good.label).toBe("GOOD");
      expect(QUALITY_CONFIG.fair.label).toBe("FAIR");
      expect(QUALITY_CONFIG.rideable.label).toBe("RIDEABLE");
      expect(QUALITY_CONFIG.poor.label).toBe("MEH");
    });
  });
});
