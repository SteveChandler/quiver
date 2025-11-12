import {
  SKILL_LEVEL_STYLES,
  CROWD_LEVEL_STYLES,
  getSkillLevelStyle,
  getCrowdLevelStyle,
} from "@/lib/constants/beach-badge-styles";

describe("beach-badge-styles", () => {
  describe("SKILL_LEVEL_STYLES constant", () => {
    it("should have defined styles for all skill levels", () => {
      expect(SKILL_LEVEL_STYLES.Beginner).toBeDefined();
      expect(SKILL_LEVEL_STYLES.Intermediate).toBeDefined();
      expect(SKILL_LEVEL_STYLES.Advanced).toBeDefined();
      expect(SKILL_LEVEL_STYLES.Expert).toBeDefined();
    });

    it("should have correct Tailwind classes for each level", () => {
      expect(SKILL_LEVEL_STYLES.Beginner).toContain("bg-blue-50");
      expect(SKILL_LEVEL_STYLES.Beginner).toContain("text-ocean-blue");

      expect(SKILL_LEVEL_STYLES.Intermediate).toContain("bg-orange-50");
      expect(SKILL_LEVEL_STYLES.Intermediate).toContain("text-orange-600");

      expect(SKILL_LEVEL_STYLES.Advanced).toContain("bg-red-50");
      expect(SKILL_LEVEL_STYLES.Advanced).toContain("text-red-600");

      expect(SKILL_LEVEL_STYLES.Expert).toContain("bg-red-50");
      expect(SKILL_LEVEL_STYLES.Expert).toContain("text-red-700");
    });
  });

  describe("CROWD_LEVEL_STYLES constant", () => {
    it("should have defined styles for all crowd levels", () => {
      expect(CROWD_LEVEL_STYLES.Uncrowded).toBeDefined();
      expect(CROWD_LEVEL_STYLES.Moderate).toBeDefined();
      expect(CROWD_LEVEL_STYLES.Crowded).toBeDefined();
    });

    it("should have correct Tailwind classes for each level", () => {
      expect(CROWD_LEVEL_STYLES.Uncrowded).toContain("bg-green-50");
      expect(CROWD_LEVEL_STYLES.Uncrowded).toContain("text-green-700");

      expect(CROWD_LEVEL_STYLES.Moderate).toContain("bg-yellow-50");
      expect(CROWD_LEVEL_STYLES.Moderate).toContain("text-yellow-700");

      expect(CROWD_LEVEL_STYLES.Crowded).toContain("bg-red-50");
      expect(CROWD_LEVEL_STYLES.Crowded).toContain("text-red-700");
    });
  });

  describe("getSkillLevelStyle", () => {
    it("should return correct style for valid skill levels", () => {
      expect(getSkillLevelStyle("Beginner")).toBe(SKILL_LEVEL_STYLES.Beginner);
      expect(getSkillLevelStyle("Intermediate")).toBe(SKILL_LEVEL_STYLES.Intermediate);
      expect(getSkillLevelStyle("Advanced")).toBe(SKILL_LEVEL_STYLES.Advanced);
      expect(getSkillLevelStyle("Expert")).toBe(SKILL_LEVEL_STYLES.Expert);
    });

    it("should return Intermediate style as default for unknown levels", () => {
      expect(getSkillLevelStyle("Unknown")).toBe(SKILL_LEVEL_STYLES.Intermediate);
      expect(getSkillLevelStyle("")).toBe(SKILL_LEVEL_STYLES.Intermediate);
      expect(getSkillLevelStyle("Invalid")).toBe(SKILL_LEVEL_STYLES.Intermediate);
    });

    it("should be case-sensitive", () => {
      expect(getSkillLevelStyle("beginner")).toBe(SKILL_LEVEL_STYLES.Intermediate);
      expect(getSkillLevelStyle("BEGINNER")).toBe(SKILL_LEVEL_STYLES.Intermediate);
      expect(getSkillLevelStyle("Beginner")).toBe(SKILL_LEVEL_STYLES.Beginner);
    });
  });

  describe("getCrowdLevelStyle", () => {
    it("should return correct style for valid crowd levels", () => {
      expect(getCrowdLevelStyle("Uncrowded")).toBe(CROWD_LEVEL_STYLES.Uncrowded);
      expect(getCrowdLevelStyle("Moderate")).toBe(CROWD_LEVEL_STYLES.Moderate);
      expect(getCrowdLevelStyle("Crowded")).toBe(CROWD_LEVEL_STYLES.Crowded);
    });

    it("should return Moderate style as default for unknown levels", () => {
      expect(getCrowdLevelStyle("Unknown")).toBe(CROWD_LEVEL_STYLES.Moderate);
      expect(getCrowdLevelStyle("")).toBe(CROWD_LEVEL_STYLES.Moderate);
      expect(getCrowdLevelStyle("Invalid")).toBe(CROWD_LEVEL_STYLES.Moderate);
    });

    it("should be case-sensitive", () => {
      expect(getCrowdLevelStyle("uncrowded")).toBe(CROWD_LEVEL_STYLES.Moderate);
      expect(getCrowdLevelStyle("UNCROWDED")).toBe(CROWD_LEVEL_STYLES.Moderate);
      expect(getCrowdLevelStyle("Uncrowded")).toBe(CROWD_LEVEL_STYLES.Uncrowded);
    });
  });

  describe("Style consistency", () => {
    it("should have consistent border-transparent for all skill levels", () => {
      Object.values(SKILL_LEVEL_STYLES).forEach((style) => {
        expect(style).toContain("border-transparent");
      });
    });

    it("should have border colors for all crowd levels", () => {
      expect(CROWD_LEVEL_STYLES.Uncrowded).toContain("border-green-");
      expect(CROWD_LEVEL_STYLES.Moderate).toContain("border-yellow-");
      expect(CROWD_LEVEL_STYLES.Crowded).toContain("border-red-");
    });

    it("should have background and text color for all styles", () => {
      const allStyles = {
        ...SKILL_LEVEL_STYLES,
        ...CROWD_LEVEL_STYLES,
      };

      Object.values(allStyles).forEach((style) => {
        expect(style).toMatch(/bg-\w+-\d+/); // Has background color
        // Text color can be either standard format (text-color-###) or custom (text-color-name)
        expect(style).toMatch(/text-[\w-]+/); // Has text color (standard or custom)
      });
    });
  });
});
