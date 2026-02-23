import {
  ConditionTier,
  CONDITION_TIER_THRESHOLDS,
  getConditionTier,
  getScoreColorClass,
  getConditionBadge,
  buildHeadlineText,
  isTomorrowInTimezone,
} from "@/lib/utils/condition-tier-utils";

describe("condition-tier-utils", () => {
  describe("getConditionTier", () => {
    it("returns 'great' for scores >= 80", () => {
      expect(getConditionTier(80)).toBe("great");
      expect(getConditionTier(85)).toBe("great");
      expect(getConditionTier(100)).toBe("great");
    });

    it("returns 'good' for scores 60-79", () => {
      expect(getConditionTier(60)).toBe("good");
      expect(getConditionTier(70)).toBe("good");
      expect(getConditionTier(79)).toBe("good");
    });

    it("returns 'fair' for scores 40-59", () => {
      expect(getConditionTier(40)).toBe("fair");
      expect(getConditionTier(50)).toBe("fair");
      expect(getConditionTier(59)).toBe("fair");
    });

    it("returns 'marginal' for scores < 40", () => {
      expect(getConditionTier(0)).toBe("marginal");
      expect(getConditionTier(20)).toBe("marginal");
      expect(getConditionTier(39)).toBe("marginal");
    });

    it("handles boundary conditions correctly", () => {
      expect(getConditionTier(79.9)).toBe("good");
      expect(getConditionTier(80)).toBe("great");
      expect(getConditionTier(59.9)).toBe("fair");
      expect(getConditionTier(60)).toBe("good");
      expect(getConditionTier(39.9)).toBe("marginal");
      expect(getConditionTier(40)).toBe("fair");
    });
  });

  describe("getScoreColorClass", () => {
    it("returns orange for great tier", () => {
      expect(getScoreColorClass("great")).toBe("text-accent-orange");
    });

    it("returns orange for good tier", () => {
      expect(getScoreColorClass("good")).toBe("text-accent-orange");
    });

    it("returns amber for fair tier", () => {
      expect(getScoreColorClass("fair")).toBe("text-amber-400");
    });

    it("returns muted white for marginal tier", () => {
      expect(getScoreColorClass("marginal")).toBe("text-white/60");
    });
  });

  describe("getConditionBadge", () => {
    it("returns Great Conditions badge for great tier", () => {
      const badge = getConditionBadge("great");
      expect(badge).not.toBeNull();
      expect(badge?.label).toBe("Great Conditions");
      expect(badge?.className).toContain("emerald");
    });

    it("returns null for good tier (no badge shown)", () => {
      expect(getConditionBadge("good")).toBeNull();
    });

    it("returns Fair Conditions badge for fair tier", () => {
      const badge = getConditionBadge("fair");
      expect(badge).not.toBeNull();
      expect(badge?.label).toBe("Fair Conditions");
      expect(badge?.className).toContain("amber");
    });

    it("returns Marginal badge for marginal tier", () => {
      const badge = getConditionBadge("marginal");
      expect(badge).not.toBeNull();
      expect(badge?.label).toBe("Marginal");
      expect(badge?.className).toContain("white");
    });
  });

  describe("buildHeadlineText", () => {
    describe("today (isTomorrow = false)", () => {
      it("builds great tier headline", () => {
        const result = buildHeadlineText("Big Jetty", "great", false);
        expect(result.prefix).toBe("");
        expect(result.beachPart).toBe("Big Jetty");
        expect(result.connector).toBe("is your best bet at");
      });

      it("builds good tier headline", () => {
        const result = buildHeadlineText("Big Jetty", "good", false);
        expect(result.prefix).toBe("");
        expect(result.beachPart).toBe("Big Jetty");
        expect(result.connector).toBe("is a good option at");
      });

      it("builds fair tier headline", () => {
        const result = buildHeadlineText("Big Jetty", "fair", false);
        expect(result.prefix).toBe("Conditions are fair at ");
        expect(result.beachPart).toBe("Big Jetty");
        expect(result.connector).toBe("—");
      });

      it("builds marginal tier headline", () => {
        const result = buildHeadlineText("Big Jetty", "marginal", false);
        expect(result.prefix).toBe("Conditions are marginal at ");
        expect(result.beachPart).toBe("Big Jetty");
        expect(result.connector).toBe("—");
      });
    });

    describe("tomorrow (isTomorrow = true)", () => {
      it("builds headline with default tomorrow prefix", () => {
        const result = buildHeadlineText("Big Jetty", "great", true);
        expect(result.prefix).toBe("Skip today \u2014 tomorrow at ");
        expect(result.beachPart).toBe("Big Jetty");
      });

      it("builds headline with dawn-patrol time slot", () => {
        const result = buildHeadlineText("Big Jetty", "great", true, "dawn-patrol");
        expect(result.prefix).toBe("Skip today \u2014 tomorrow's dawn patrol at ");
      });

      it("builds headline with lunch-session time slot", () => {
        const result = buildHeadlineText("Big Jetty", "great", true, "lunch-session");
        expect(result.prefix).toBe("Skip today \u2014 tomorrow midday at ");
      });

      it("builds headline with afternoon time slot", () => {
        const result = buildHeadlineText("Big Jetty", "great", true, "afternoon");
        expect(result.prefix).toBe("Skip today \u2014 tomorrow afternoon at ");
      });

      it("builds fair tier headline for tomorrow", () => {
        const result = buildHeadlineText("Big Jetty", "fair", true);
        expect(result.prefix).toBe("Skip today \u2014 tomorrow at ");
        expect(result.connector).toBe("\u2014 conditions are fair at");
      });
    });
  });

  describe("isTomorrowInTimezone", () => {
    it("returns false for today", () => {
      const today = new Date();
      expect(isTomorrowInTimezone(today, "America/Los_Angeles")).toBe(false);
    });

    it("returns true for tomorrow", () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      expect(isTomorrowInTimezone(tomorrow, "America/Los_Angeles")).toBe(true);
    });

    it("returns false for past dates", () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      expect(isTomorrowInTimezone(yesterday, "America/Los_Angeles")).toBe(false);
    });

    it("returns true for dates far in future (treated as 'not today')", () => {
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);
      // Note: Function checks "not today AND in future", so this returns true
      // This is intentional - we treat any future non-today date as "tomorrow" for display
      expect(isTomorrowInTimezone(nextWeek, "America/Los_Angeles")).toBe(true);
    });
  });

  describe("CONDITION_TIER_THRESHOLDS", () => {
    it("exports correct threshold values", () => {
      expect(CONDITION_TIER_THRESHOLDS.great).toBe(80);
      expect(CONDITION_TIER_THRESHOLDS.good).toBe(60);
      expect(CONDITION_TIER_THRESHOLDS.fair).toBe(40);
      expect(CONDITION_TIER_THRESHOLDS.marginal).toBe(0);
    });
  });
});
