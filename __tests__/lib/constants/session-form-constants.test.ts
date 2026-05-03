import {
  getFormText,
  getModeStyles,
  getSectionConfig,
  getRatingDescription,
  SESSION_FORM_TEXT,
  MODE_STYLES,
  SKILL_GOALS,
  DURATION_OPTIONS,
  RATING_DESCRIPTIONS,
} from "@/lib/constants/session-form-constants";

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

  describe("getModeStyles", () => {
    it("should return green styles for log mode", () => {
      const styles = getModeStyles("log");
      expect(styles.headerBg).toBe("bg-green-50");
      expect(styles.headerText).toBe("text-green-800");
      expect(styles.buttonColor).toBe("bg-green-600 hover:bg-green-700");
    });
  });

  describe("getSectionConfig", () => {
    it("should return config for sections", () => {
      const locationConfig = getSectionConfig("location", "log");
      expect(locationConfig).toEqual({
        icon: "MapPin",
        required: true,
        order: 1,
      });
    });

    it("should return config for conditions section in log mode", () => {
      const conditionsConfig = getSectionConfig("conditions", "log");
      expect(conditionsConfig).toEqual({
        icon: "Activity",
        required: false,
        order: 5,
        showOnlyFor: "log",
      });
    });
  });

  describe("getRatingDescription", () => {
    it("should return correct wave quality descriptions", () => {
      expect(getRatingDescription("waveQuality", 1)).toBe(
        "Poor - Blown out/Flat"
      );
      expect(getRatingDescription("waveQuality", 3)).toBe(
        "Average - Decent waves"
      );
      expect(getRatingDescription("waveQuality", 5)).toBe(
        "Excellent - Epic session"
      );
    });

    it("should return correct crowd level descriptions", () => {
      expect(getRatingDescription("crowdLevel", 1)).toBe(
        "Empty - Solo session"
      );
      expect(getRatingDescription("crowdLevel", 3)).toBe(
        "Moderate - Some crowd"
      );
      expect(getRatingDescription("crowdLevel", 5)).toBe(
        "Packed - Very crowded"
      );
    });

    it("should return correct parking descriptions", () => {
      expect(getRatingDescription("parkingEase", 1)).toBe(
        "Difficult - No spots"
      );
      expect(getRatingDescription("parkingEase", 5)).toBe(
        "Perfect - Right there"
      );
    });

    it("should return correct performance descriptions", () => {
      expect(getRatingDescription("overallRating", 2)).toBe("Below Goals");
      expect(getRatingDescription("overallRating", 4)).toBe("Achieved Goals");
    });

    it("should return empty string for invalid ratings", () => {
      expect(getRatingDescription("waveQuality", 0)).toBe("");
      expect(getRatingDescription("waveQuality", 6)).toBe("");
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
