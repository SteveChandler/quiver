import { buildSurfCallShareData, ShareData } from "@/lib/share/share-data-builder";
import type { SurfDiscoveryRecommendation } from "@/types/personalization";

// Mock the utility functions to avoid complex dependencies
jest.mock("@/lib/utils/rating-formatters", () => ({
  formatDiscoveryScore: (score: number) => (score / 10).toFixed(1),
}));

jest.mock("@/lib/utils/date-time", () => ({
  formatTimeWindowCompact: () => "7-10am",
}));

describe("buildSurfCallShareData", () => {
  const createMockRecommendation = (
    overrides: Partial<SurfDiscoveryRecommendation> = {}
  ): SurfDiscoveryRecommendation => {
    const now = new Date();
    return {
      beach: {
        id: "test-beach-id",
        name: "Big Jetty",
        slug: "big-jetty",
        timezone: "America/Los_Angeles",
        center_lat: 33.0,
        center_lng: -117.0,
      },
      score: 85,
      window: {
        start: now,
        end: new Date(now.getTime() + 3 * 60 * 60 * 1000), // 3 hours later
        timezone: "America/Los_Angeles",
      },
      matchQuality: "high" as const,
      recommendationLabel: "Great morning surf",
      message: "Good wave size (3.9ft), Good swell energy.",
      conditionBadges: [
        { label: "Clean Swell", contribution: 10 },
        { label: "Light Offshore", contribution: 8 },
      ],
      waveHeightBadge: "3-5ft",
      ...overrides,
    } as SurfDiscoveryRecommendation;
  };

  describe("successful share data generation", () => {
    it("returns ShareData for valid recommendation", () => {
      const recommendation = createMockRecommendation();
      const result = buildSurfCallShareData({ recommendation });

      expect(result).not.toBeNull();
      expect(result?.beachName).toBe("Big Jetty");
      expect(result?.title).toBe("Check out Big Jetty!");
      expect(result?.imageUrl).toContain("/api/og/surf-call");
    });

    it("includes score in image URL", () => {
      const recommendation = createMockRecommendation({ score: 85 });
      const result = buildSurfCallShareData({ recommendation });

      expect(result?.imageUrl).toContain("score=85");
    });

    it("includes beach name in image URL", () => {
      const recommendation = createMockRecommendation();
      const result = buildSurfCallShareData({ recommendation });

      expect(result?.imageUrl).toContain("beach=Big");
    });

    it("includes wave height in image URL", () => {
      const recommendation = createMockRecommendation({ waveHeightBadge: "3-5ft" });
      const result = buildSurfCallShareData({ recommendation });

      expect(result?.imageUrl).toContain("waveHeight=3-5ft");
    });

    it("includes message in image URL", () => {
      const recommendation = createMockRecommendation({
        message: "Good wave size",
      });
      const result = buildSurfCallShareData({ recommendation });

      expect(result?.imageUrl).toContain("message=Good");
    });
  });

  describe("condition tier handling", () => {
    it("sets verdict to YES for great conditions (score >= 80)", () => {
      const recommendation = createMockRecommendation({ score: 85 });
      const result = buildSurfCallShareData({ recommendation });

      expect(result?.imageUrl).toContain("verdict=YES");
    });

    it("sets verdict to YES for good conditions (score 60-79)", () => {
      const recommendation = createMockRecommendation({ score: 70 });
      const result = buildSurfCallShareData({ recommendation });

      expect(result?.imageUrl).toContain("verdict=YES");
    });

    it("sets verdict to MAYBE for fair conditions (score 40-59)", () => {
      const recommendation = createMockRecommendation({ score: 50 });
      const result = buildSurfCallShareData({ recommendation });

      expect(result?.imageUrl).toContain("verdict=MAYBE");
    });

    it("sets verdict to NO for marginal conditions (score < 40)", () => {
      const recommendation = createMockRecommendation({ score: 30 });
      const result = buildSurfCallShareData({ recommendation });

      expect(result?.imageUrl).toContain("verdict=NO");
    });

    it("includes conditionLabel for great tier", () => {
      const recommendation = createMockRecommendation({ score: 85 });
      const result = buildSurfCallShareData({ recommendation });

      expect(result?.imageUrl).toContain("conditionLabel=Great");
    });
  });

  describe("time slot handling", () => {
    it("builds share data without time slot", () => {
      const recommendation = createMockRecommendation();
      const result = buildSurfCallShareData({ recommendation });

      expect(result).not.toBeNull();
    });

    it("builds share data with morning time slot", () => {
      const recommendation = createMockRecommendation();
      const result = buildSurfCallShareData({
        recommendation,
        timeSlot: "lunch-session",
      });

      expect(result).not.toBeNull();
    });

    it("builds share data with dawn-patrol time slot", () => {
      const recommendation = createMockRecommendation();
      const result = buildSurfCallShareData({
        recommendation,
        timeSlot: "dawn-patrol",
      });

      expect(result).not.toBeNull();
    });
  });

  describe("edge cases", () => {
    it("returns null for null recommendation", () => {
      const result = buildSurfCallShareData({
        recommendation: null as unknown as SurfDiscoveryRecommendation,
      });

      expect(result).toBeNull();
    });

    it("returns null for undefined recommendation", () => {
      const result = buildSurfCallShareData({
        recommendation: undefined as unknown as SurfDiscoveryRecommendation,
      });

      expect(result).toBeNull();
    });

    it("handles missing optional fields gracefully", () => {
      const recommendation = createMockRecommendation({
        message: undefined,
        conditionBadges: undefined,
        waveHeightBadge: undefined,
      });
      const result = buildSurfCallShareData({ recommendation });

      expect(result).not.toBeNull();
      expect(result?.beachName).toBe("Big Jetty");
    });

    it("handles empty condition badges array", () => {
      const recommendation = createMockRecommendation({
        conditionBadges: [],
      });
      const result = buildSurfCallShareData({ recommendation });

      expect(result).not.toBeNull();
    });

    it("limits condition badges to 3", () => {
      const recommendation = createMockRecommendation({
        conditionBadges: [
          { label: "Tag1", contribution: 10 },
          { label: "Tag2", contribution: 9 },
          { label: "Tag3", contribution: 8 },
          { label: "Tag4", contribution: 7 },
          { label: "Tag5", contribution: 6 },
        ],
      });
      const result = buildSurfCallShareData({ recommendation });

      // Should only include first 3 tags
      expect(result?.imageUrl).toContain("Tag1");
      expect(result?.imageUrl).toContain("Tag2");
      expect(result?.imageUrl).toContain("Tag3");
      expect(result?.imageUrl).not.toContain("Tag4");
      expect(result?.imageUrl).not.toContain("Tag5");
    });
  });

  describe("text generation", () => {
    it("generates correct title format", () => {
      const recommendation = createMockRecommendation();
      const result = buildSurfCallShareData({ recommendation });

      expect(result?.title).toBe("Check out Big Jetty!");
    });

    it("generates text with score", () => {
      const recommendation = createMockRecommendation({ score: 85 });
      const result = buildSurfCallShareData({ recommendation });

      expect(result?.text).toContain("8.5/10");
    });

    it("includes beach name in text", () => {
      const recommendation = createMockRecommendation();
      const result = buildSurfCallShareData({ recommendation });

      expect(result?.text).toContain("Big Jetty");
    });
  });

  describe("error handling", () => {
    it("returns null and logs error on exception", () => {
      const consoleSpy = jest.spyOn(console, "error").mockImplementation();

      // Create a recommendation that will cause an error
      const badRecommendation = {
        beach: null, // This will cause an error when accessing beach.name
      } as unknown as SurfDiscoveryRecommendation;

      const result = buildSurfCallShareData({ recommendation: badRecommendation });

      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith(
        "[buildSurfCallShareData] Error building share data:",
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });
});
