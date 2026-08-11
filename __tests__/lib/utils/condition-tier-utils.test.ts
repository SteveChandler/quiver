import {
  ConditionTier,
  CONDITION_TIER_THRESHOLDS,
  getConditionTier,
  getScoreColorClass,
  getConditionBadge,
  buildHeadlineText,
  isFutureDayInTimezone,
  isEveningInTimezone,
} from "@/lib/utils/condition-tier-utils";

describe("condition-tier-utils", () => {
  describe("getConditionTier", () => {
    it("returns 'epic' for scores >= 80", () => {
      expect(getConditionTier(80)).toBe("epic");
      expect(getConditionTier(85)).toBe("epic");
      expect(getConditionTier(100)).toBe("epic");
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
      expect(getConditionTier(80)).toBe("epic");
      expect(getConditionTier(59.9)).toBe("fair");
      expect(getConditionTier(70)).toBe("good");
      expect(getConditionTier(39.9)).toBe("meh");
      expect(getConditionTier(40)).toBe("rideable");
    });
  });

  describe("getScoreColorClass", () => {
    it("returns orange for epic tier", () => {
      expect(getScoreColorClass("epic")).toBe("text-accent-orange");
    });

    it("returns orange for good tier", () => {
      expect(getScoreColorClass("good")).toBe("text-accent-orange");
    });

    it("returns amber for fair tier", () => {
      expect(getScoreColorClass("fair")).toBe("text-amber-400");
    });

    it("returns muted white for meh tier", () => {
      expect(getScoreColorClass("meh")).toBe("text-medium");
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

  describe("buildHeadlineText", () => {
    describe("today (isTomorrow = false)", () => {
      it("builds epic tier headline", () => {
        const result = buildHeadlineText("Big Jetty", "epic", false);
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

      it("builds meh tier headline", () => {
        const result = buildHeadlineText("Big Jetty", "meh", false);
        expect(result.prefix).toBe("Conditions are meh at ");
        expect(result.beachPart).toBe("Big Jetty");
        expect(result.connector).toBe("—");
      });
    });

    describe("tomorrow (isTomorrow = true)", () => {
      it("builds headline with default tomorrow prefix", () => {
        const result = buildHeadlineText("Big Jetty", "epic", true);
        expect(result.prefix).toBe("Skip today \u2014 tomorrow at ");
        expect(result.beachPart).toBe("Big Jetty");
      });

      it("builds headline with dawn-patrol time slot", () => {
        const result = buildHeadlineText("Big Jetty", "epic", true, "dawn-patrol");
        expect(result.prefix).toBe("Skip today \u2014 tomorrow's dawn patrol at ");
      });

      it("builds headline with lunch-session time slot", () => {
        const result = buildHeadlineText("Big Jetty", "epic", true, "lunch-session");
        expect(result.prefix).toBe("Skip today \u2014 tomorrow midday at ");
      });

      it("builds headline with afternoon time slot", () => {
        const result = buildHeadlineText("Big Jetty", "epic", true, "afternoon");
        expect(result.prefix).toBe("Skip today \u2014 tomorrow afternoon at ");
      });

      it("builds fair tier headline for tomorrow", () => {
        const result = buildHeadlineText("Big Jetty", "fair", true);
        expect(result.prefix).toBe("Skip today \u2014 tomorrow at ");
        expect(result.connector).toBe("\u2014 conditions are fair at");
      });
    });

    describe("tomorrow evening (isEvening = true)", () => {
      it("builds headline with plain tomorrow prefix", () => {
        const result = buildHeadlineText("Big Jetty", "epic", true, undefined, true);
        expect(result.prefix).toBe("Tomorrow at ");
        expect(result.beachPart).toBe("Big Jetty");
        expect(result.connector).toBe("is your best bet at");
      });

      it("builds headline with dawn-patrol time slot", () => {
        const result = buildHeadlineText("Big Jetty", "epic", true, "dawn-patrol", true);
        expect(result.prefix).toBe("Tomorrow's dawn patrol at ");
      });

      it("builds headline with lunch-session time slot", () => {
        const result = buildHeadlineText("Big Jetty", "epic", true, "lunch-session", true);
        expect(result.prefix).toBe("Tomorrow midday at ");
      });

      it("builds headline with afternoon time slot", () => {
        const result = buildHeadlineText("Big Jetty", "epic", true, "afternoon", true);
        expect(result.prefix).toBe("Tomorrow afternoon at ");
      });

      it("builds good tier headline for tomorrow evening", () => {
        const result = buildHeadlineText("Big Jetty", "good", true, undefined, true);
        expect(result.prefix).toBe("Tomorrow at ");
        expect(result.connector).toBe("is a good option at");
      });

      it("builds fair tier headline for tomorrow evening", () => {
        const result = buildHeadlineText("Big Jetty", "fair", true, undefined, true);
        expect(result.prefix).toBe("Tomorrow at ");
        expect(result.connector).toBe("\u2014 conditions are fair at");
      });

      it("builds meh tier headline for tomorrow evening", () => {
        const result = buildHeadlineText("Big Jetty", "meh", true, undefined, true);
        expect(result.prefix).toBe("Tomorrow at ");
        expect(result.connector).toBe("\u2014 conditions are meh at");
      });
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

  describe("isEveningInTimezone", () => {
    it("returns true when local time is 18:00 or later", () => {
      // Mock a time at 8 PM UTC — in UTC that's 20:00, well past 18
      jest.useFakeTimers();
      jest.setSystemTime(new Date("2026-02-28T20:00:00Z"));
      expect(isEveningInTimezone("UTC")).toBe(true);
      jest.useRealTimers();
    });

    it("returns false when local time is before 18:00", () => {
      // Mock a time at 10 AM UTC
      jest.useFakeTimers();
      jest.setSystemTime(new Date("2026-02-28T10:00:00Z"));
      expect(isEveningInTimezone("UTC")).toBe(false);
      jest.useRealTimers();
    });

    it("respects timezone offset", () => {
      // 1 AM UTC = 5 PM (17:00) Pacific (UTC-8) — not evening
      jest.useFakeTimers();
      jest.setSystemTime(new Date("2026-02-28T01:00:00Z"));
      expect(isEveningInTimezone("America/Los_Angeles")).toBe(false);
      jest.useRealTimers();
    });

    it("returns true at exactly 18:00 in timezone", () => {
      // 2 AM UTC = 6 PM (18:00) Pacific (PST, UTC-8) — evening
      jest.useFakeTimers();
      jest.setSystemTime(new Date("2026-02-28T02:00:00Z"));
      expect(isEveningInTimezone("America/Los_Angeles")).toBe(true);
      jest.useRealTimers();
    });

    it("returns false for invalid timezone (safe default)", () => {
      expect(isEveningInTimezone("Invalid/Timezone")).toBe(false);
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
