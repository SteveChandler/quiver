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
    it("should return planning text for plan mode", () => {
      const text = getFormText("plan");
      expect(text.pageTitle).toBe("Plan Session");
      expect(text.submitButton).toBe("Plan Session");
      expect(text.showInviteFriends).toBe(true);
      expect(text.showConditions).toBe(false);
      expect(text.showPerformanceRating).toBe(false);
    });

    it("should return logging text for log mode", () => {
      const text = getFormText("log");
      expect(text.pageTitle).toBe("Log Session");
      expect(text.submitButton).toBe("Log Session");
      expect(text.showInviteFriends).toBe(false);
      expect(text.showConditions).toBe(true);
      expect(text.showPerformanceRating).toBe(true);
    });

    it("should have different language for plan vs log", () => {
      const planText = getFormText("plan");
      const logText = getFormText("log");

      expect(planText.location).toBe("Where will you surf?");
      expect(logText.location).toBe("Where did you surf?");

      expect(planText.dateTime).toBe("When will you surf?");
      expect(logText.dateTime).toBe("When did you surf?");
    });
  });

  describe("getModeStyles", () => {
    it("should return blue styles for plan mode", () => {
      const styles = getModeStyles("plan");
      expect(styles.headerBg).toBe("bg-blue-50");
      expect(styles.headerText).toBe("text-blue-800");
      expect(styles.buttonColor).toBe("bg-blue-600 hover:bg-blue-700");
    });

    it("should return green styles for log mode", () => {
      const styles = getModeStyles("log");
      expect(styles.headerBg).toBe("bg-green-50");
      expect(styles.headerText).toBe("text-green-800");
      expect(styles.buttonColor).toBe("bg-green-600 hover:bg-green-700");
    });
  });

  describe("getSectionConfig", () => {
    it("should return config for sections available in both modes", () => {
      const locationConfig = getSectionConfig("location", "plan");
      expect(locationConfig).toEqual({
        icon: "MapPin",
        required: true,
        order: 1,
      });

      const locationConfigLog = getSectionConfig("location", "log");
      expect(locationConfigLog).toEqual(locationConfig);
    });

    it("should return null for conditions section in plan mode", () => {
      const conditionsConfig = getSectionConfig("conditions", "plan");
      expect(conditionsConfig).toBeNull();
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
  });

  describe("Mode Consistency", () => {
    it("should have consistent core structure between modes", () => {
      const planText = SESSION_FORM_TEXT.plan;
      const logText = SESSION_FORM_TEXT.log;

      // Check that both modes have essential properties
      const essentialProps = [
        "pageTitle",
        "pageDescription",
        "location",
        "dateTime",
        "equipment",
        "goals",
        "notes",
        "notesPlaceholder",
        "durationLabel",
        "submitButton",
        "successMessage",
        "showInviteFriends",
        "showConditions",
        "showPerformanceRating",
      ];

      essentialProps.forEach((prop) => {
        expect(planText).toHaveProperty(prop);
        expect(logText).toHaveProperty(prop);
      });

      // Log mode should have additional properties
      expect(logText).toHaveProperty("finishMessage");
      expect(logText).toHaveProperty("conditions");
    });

    it("should have consistent style structure between modes", () => {
      const planStyles = MODE_STYLES.plan;
      const logStyles = MODE_STYLES.log;

      // Check that both modes have the same style properties
      const planKeys = Object.keys(planStyles);
      const logKeys = Object.keys(logStyles);

      expect(planKeys.sort()).toEqual(logKeys.sort());
    });
  });
});
