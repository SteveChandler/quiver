import { FEATURE_CARDS, HERO_VIDEOS, CONTENT } from "@/lib/constants/features";

describe("Features Constants", () => {
  describe("FEATURE_CARDS", () => {
    it("has the correct number of feature cards", () => {
      expect(FEATURE_CARDS).toHaveLength(3);
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
        "Plan Sessions",
        "Rate Conditions",
        "Connect & Share",
      ];
      const actualTitles = FEATURE_CARDS.map((card) => card.title);
      expect(actualTitles).toEqual(expectedTitles);
    });
  });

  describe("HERO_VIDEOS", () => {
    it("has the correct number of video files", () => {
      expect(HERO_VIDEOS).toHaveLength(3);
    });

    it("contains valid video file paths", () => {
      HERO_VIDEOS.forEach((video) => {
        expect(typeof video).toBe("string");
        expect(video.startsWith("/")).toBe(true);
        expect(video.endsWith(".mp4")).toBe(true);
      });
    });
  });

  describe("CONTENT", () => {
    it("has hero content structure", () => {
      expect(CONTENT.hero).toHaveProperty("title");
      expect(CONTENT.hero).toHaveProperty("subtitle");
      expect(CONTENT.hero).toHaveProperty("cta");

      expect(Array.isArray(CONTENT.hero.title)).toBe(true);
      expect(CONTENT.hero.title).toHaveLength(3);
      expect(typeof CONTENT.hero.subtitle).toBe("string");
      expect(typeof CONTENT.hero.cta).toBe("string");
    });

    it("has sections content structure", () => {
      const sections = ["social", "forecast", "features", "cta"];

      sections.forEach((section) => {
        expect(CONTENT.sections).toHaveProperty(section);
        expect(CONTENT.sections[section]).toHaveProperty("title");
        expect(CONTENT.sections[section]).toHaveProperty("subtitle");

        expect(typeof CONTENT.sections[section].title).toBe("string");
        expect(typeof CONTENT.sections[section].subtitle).toBe("string");
      });
    });

    it("has forecast section link", () => {
      expect(CONTENT.sections.forecast).toHaveProperty("link");
      expect(typeof CONTENT.sections.forecast.link).toBe("string");
    });

    it("has non-empty content strings", () => {
      expect(CONTENT.hero.title.every((line) => line.length > 0)).toBe(true);
      expect(CONTENT.hero.subtitle.length).toBeGreaterThan(0);
      expect(CONTENT.hero.cta.length).toBeGreaterThan(0);

      Object.values(CONTENT.sections).forEach((section) => {
        expect(section.title.length).toBeGreaterThan(0);
        expect(section.subtitle.length).toBeGreaterThan(0);
      });
    });
  });
});
