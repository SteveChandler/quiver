import { FEATURE_CARDS, CONTENT } from "@/lib/constants/features";

describe("Features Constants", () => {
  describe("FEATURE_CARDS", () => {
    it("has the correct number of feature cards", () => {
      expect(FEATURE_CARDS).toHaveLength(7);
    });

    it("has all required properties for each feature card", () => {
      FEATURE_CARDS.forEach((card, index) => {
        expect(card).toHaveProperty("icon");
        expect(card).toHaveProperty("title");
        expect(card).toHaveProperty("description");
        expect(card).toHaveProperty("iconBgColor");
        expect(card).toHaveProperty("iconColor");
        expect(card).toHaveProperty("features");

        expect(typeof card.title).toBe("string");
        expect(typeof card.description).toBe("string");
        expect(typeof card.iconBgColor).toBe("string");
        expect(typeof card.iconColor).toBe("string");
        expect(Array.isArray(card.features)).toBe(true);

        // Check feature items structure
        card.features.forEach((feature) => {
          expect(feature).toHaveProperty("icon");
          expect(feature).toHaveProperty("text");
          expect(feature).toHaveProperty("color");
          expect(typeof feature.text).toBe("string");
          expect(typeof feature.color).toBe("string");
        });
      });
    });

    it("has correct titles for feature cards", () => {
      const expectedTitles = [
        "Your Surf Call",
        "Tuned to You",
        "What's Happening Now",
        "Spot Discovery",
        "Session Tracking",
        "Mobile Apps",
        "Community",
      ];
      const actualTitles = FEATURE_CARDS.map((card) => card.title);
      expect(actualTitles).toEqual(expectedTitles);
    });
  });

  describe("CONTENT", () => {
    it("has hero content structure", () => {
      expect(CONTENT.hero).toHaveProperty("title");
      expect(CONTENT.hero).toHaveProperty("subtitle");
      expect(CONTENT.hero).toHaveProperty("cta");

      expect(typeof CONTENT.hero.title).toBe("string");
      expect(typeof CONTENT.hero.subtitle).toBe("string");
      expect(typeof CONTENT.hero.cta).toBe("string");
    });

    it("has sections content structure", () => {
      const sections = ["social", "forecast", "features", "cta"] as const;
      const sectionsObj = CONTENT.sections as Record<string, { title: string; subtitle: string }>;

      sections.forEach((section) => {
        expect(CONTENT.sections).toHaveProperty(section);
        expect(sectionsObj[section]).toHaveProperty("title");
        expect(sectionsObj[section]).toHaveProperty("subtitle");

        expect(typeof sectionsObj[section].title).toBe("string");
        expect(typeof sectionsObj[section].subtitle).toBe("string");
      });
    });

    it("has forecast section CTAs", () => {
      expect(CONTENT.sections.forecast).toHaveProperty("primaryCta");
      expect(CONTENT.sections.forecast).toHaveProperty("secondaryCta");
      expect(typeof CONTENT.sections.forecast.primaryCta).toBe("string");
      expect(typeof CONTENT.sections.forecast.secondaryCta).toBe("string");
    });

    it("has non-empty content strings", () => {
      expect(CONTENT.hero.title.length).toBeGreaterThan(0);
      expect(CONTENT.hero.cta.length).toBeGreaterThan(0);

      Object.values(CONTENT.sections).forEach((section) => {
        expect(section.title.length).toBeGreaterThan(0);
        // subtitles are allowed to be empty (some sections rely on layout without subhead copy)
        expect(typeof section.subtitle).toBe("string");
      });
    });
  });
});
