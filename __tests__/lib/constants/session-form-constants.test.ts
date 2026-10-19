import { getFormText, SESSION_FORM_TEXT, MODE_STYLES, SKILL_GOALS, DURATION_OPTIONS, RATING_DESCRIPTIONS } from "@/lib/constants/session-form-constants";

describe("Session Form Constants", () => {
  describe("getFormText", () => {
    it("should return logging text for log mode", () => {
      const text = getFormText("log");
      expect(text.pageTitle).toBe("Log Session");
      expect(text.submitButton).toBe("Log Session");
      expect(text.showConditions).toBe(true);
      expect(text.showPerformanceRating).toBe(true);
    });
  });




  describe("Constants Structure", () => {
    it("should have all required skill goals", () => {
      expect(SKILL_GOALS).toContain("Pop-ups");
      expect(SKILL_GOALS).toContain("Tube Riding");
      expect(SKILL_GOALS).toContain("Cutbacks");
      expect(SKILL_GOALS).toContain("Duck Dives");
      expect(SKILL_GOALS).toContain("Bottom Turns");
      expect(SKILL_GOALS).toContain("Carving");
      expect(SKILL_GOALS).toContain("Reading Waves");
      expect(SKILL_GOALS).toContain("Endurance");
    });

    it("should have duration options from 30 minutes to 4+ hours", () => {
      expect(DURATION_OPTIONS[0]).toEqual({ value: 30, label: "30 minutes" });
      expect(DURATION_OPTIONS[DURATION_OPTIONS.length - 1]).toEqual({
        value: 240,
        label: "4+ hours",
      });
    });

    it("should have complete rating descriptions", () => {
      expect(Object.keys(RATING_DESCRIPTIONS)).toEqual([
        "waveQuality",
        "crowdLevel",
        "parkingEase",
        "overallRating",
      ]);
    });

    it("SESSION_FORM_TEXT exposes log mode", () => {
      expect(SESSION_FORM_TEXT.log).toBeDefined();
      expect(SESSION_FORM_TEXT.log.pageTitle).toBe("Log Session");
    });

    it("MODE_STYLES exposes log mode", () => {
      expect(MODE_STYLES.log).toBeDefined();
      expect(MODE_STYLES.log.headerBg).toBe("bg-green-50");
    });
  });
});
