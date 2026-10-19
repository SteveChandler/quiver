import { ConditionTier, CONDITION_TIER_THRESHOLDS, getConditionTier, getConditionBadge, isFutureDayInTimezone } from "@/lib/utils/condition-tier-utils";

describe("condition-tier-utils", () => {
  describe("getConditionTier", () => {
    it("returns 'good' for scores >= 80 while EPIC is off, never 'epic'", () => {
      expect(getConditionTier(80)).toBe("good");
      expect(getConditionTier(85)).toBe("good");
      expect(getConditionTier(100)).toBe("good");
      for (let score = 0; score <= 100; score += 0.5) {
        expect(getConditionTier(score)).not.toBe("epic");
      }
    });

    it("returns 'good' for scores 70-79", () => {
      expect(getConditionTier(70)).toBe("good");
      expect(getConditionTier(79)).toBe("good");
    });

    it("returns 'fair' for scores 55-69", () => {
      expect(getConditionTier(55)).toBe("fair");
      expect(getConditionTier(60)).toBe("fair");
      expect(getConditionTier(69)).toBe("fair");
    });

    it("returns 'rideable' for scores 40-54", () => {
      expect(getConditionTier(40)).toBe("rideable");
      expect(getConditionTier(50)).toBe("rideable");
      expect(getConditionTier(54)).toBe("rideable");
    });

    it("returns 'meh' for scores < 40", () => {
      expect(getConditionTier(0)).toBe("meh");
      expect(getConditionTier(20)).toBe("meh");
      expect(getConditionTier(39)).toBe("meh");
    });

    it("handles boundary conditions correctly", () => {
      expect(getConditionTier(79.9)).toBe("good");
      expect(getConditionTier(80)).toBe("good");
      expect(getConditionTier(59.9)).toBe("fair");
      expect(getConditionTier(70)).toBe("good");
      expect(getConditionTier(39.9)).toBe("meh");
      expect(getConditionTier(40)).toBe("rideable");
    });
  });


  describe("getConditionBadge", () => {
    it("returns EPIC Conditions badge for epic tier", () => {
      const badge = getConditionBadge("epic");
      expect(badge).not.toBeNull();
      expect(badge?.label).toBe("EPIC Conditions");
      expect(badge?.className).toContain("emerald");
    });

    it("returns null for good tier (no badge shown)", () => {
      expect(getConditionBadge("good")).toBeNull();
    });

    it("returns Fair Conditions badge for fair tier", () => {
      const badge = getConditionBadge("fair");
      expect(badge).not.toBeNull();
      expect(badge?.label).toBe("FAIR Conditions");
      expect(badge?.className).toContain("amber");
    });

    it("returns MEH badge for meh tier", () => {
      const badge = getConditionBadge("meh");
      expect(badge).not.toBeNull();
      expect(badge?.label).toBe("MEH Conditions");
      expect(badge?.className).toContain("white");
    });
  });


  describe("isFutureDayInTimezone", () => {
    it("returns false for today", () => {
      const today = new Date();
      expect(isFutureDayInTimezone(today, "America/Los_Angeles")).toBe(false);
    });

    it("returns true for tomorrow", () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      expect(isFutureDayInTimezone(tomorrow, "America/Los_Angeles")).toBe(true);
    });

    it("returns false for past dates", () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      expect(isFutureDayInTimezone(yesterday, "America/Los_Angeles")).toBe(false);
    });

    it("returns true for dates far in future (treated as 'not today')", () => {
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);
      // Note: Function checks "not today AND in future", so this returns true
      // This is intentional - we treat any future non-today date as "tomorrow" for display
      expect(isFutureDayInTimezone(nextWeek, "America/Los_Angeles")).toBe(true);
    });
  });


  describe("CONDITION_TIER_THRESHOLDS", () => {
    it("exports correct threshold values", () => {
      expect(CONDITION_TIER_THRESHOLDS.epic).toBe(80);
      expect(CONDITION_TIER_THRESHOLDS.good).toBe(70);
      expect(CONDITION_TIER_THRESHOLDS.fair).toBe(55);
      expect(CONDITION_TIER_THRESHOLDS.rideable).toBe(40);
      expect(CONDITION_TIER_THRESHOLDS.meh).toBe(0);
    });
  });
});
