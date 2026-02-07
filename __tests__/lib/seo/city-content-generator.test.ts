import { generateCityContent } from "@/lib/seo/city-content-generator";
import { createBeachWithDefaults } from "@/lib/utils/beach-defaults";
import type { BeachWithMetrics, LocationStats } from "@/types/location";

function makeBeach(overrides: Partial<BeachWithMetrics> & { id: string; name: string }): BeachWithMetrics {
  return {
    ...createBeachWithDefaults({ id: overrides.id, name: overrides.name }),
    compositeScore: 0.5,
    recentIntelCount: 0,
    avgConfirmations: 0,
    ...overrides,
  } as BeachWithMetrics;
}

const baseStats: LocationStats = {
  locationName: "Del Mar",
  stateName: "California",
  countryName: "United States",
  totalBeaches: 3,
  averageRating: 4.2,
  totalReviews: 50,
  topBeaches: 1,
};

describe("generateCityContent", () => {
  describe("summary", () => {
    it("includes beach count and skill breakdown", () => {
      const beaches = [
        makeBeach({ id: "1", name: "Spot A", skill_level: "Beginner", average_rating: 4.5 }),
        makeBeach({ id: "2", name: "Spot B", skill_level: "Intermediate" }),
        makeBeach({ id: "3", name: "Spot C", skill_level: "Advanced" }),
      ];
      const { summary } = generateCityContent({
        cityName: "Del Mar",
        stateName: "California",
        stateSlug: "ca",
        stats: baseStats,
        beaches,
      });

      expect(summary).toContain("3 surf spots");
      expect(summary).toContain("1 beginner-friendly");
      expect(summary).toContain("1 intermediate");
      expect(summary).toContain("1 advanced");
    });

    it("pluralizes 'break' based on skill-counted total, not totalBeaches", () => {
      const beaches = [
        makeBeach({ id: "1", name: "Only Spot", skill_level: "Beginner", average_rating: 4.0 }),
      ];
      const { summary } = generateCityContent({
        cityName: "Test City",
        stateName: "California",
        stateSlug: "ca",
        stats: { ...baseStats, totalBeaches: 1 },
        beaches,
      });

      // 1 skill-counted break → singular "break"
      expect(summary).toContain("1 beginner-friendly break.");
    });

    it("handles 0 beaches gracefully", () => {
      const { summary } = generateCityContent({
        cityName: "Ghost Town",
        stateName: "California",
        stateSlug: "ca",
        stats: { ...baseStats, totalBeaches: 0 },
        beaches: [],
      });

      expect(summary).toContain("0 surf spots");
      expect(summary).not.toContain("undefined");
      expect(summary).not.toContain("null");
    });

    it("handles beaches with no skill_level data", () => {
      const beaches = [
        makeBeach({ id: "1", name: "Mystery Spot" }),
      ];
      const { summary } = generateCityContent({
        cityName: "Test City",
        stateName: "California",
        stateSlug: "ca",
        stats: { ...baseStats, totalBeaches: 1 },
        beaches,
      });

      // Falls back to simple sentence without skill breakdown
      expect(summary).toContain("1 surf spot");
      expect(summary).not.toContain("beginner");
    });

    it("includes water temperature for known states", () => {
      const { summary } = generateCityContent({
        cityName: "Test City",
        stateName: "California",
        stateSlug: "ca",
        stats: baseStats,
        beaches: [makeBeach({ id: "1", name: "Spot" })],
      });

      expect(summary).toContain("55-72");
      expect(summary).toContain("°F");
    });

    it("omits water temperature for unknown states", () => {
      const { summary } = generateCityContent({
        cityName: "Test City",
        stateName: "Unknown State",
        stateSlug: "xx",
        stats: baseStats,
        beaches: [makeBeach({ id: "1", name: "Spot" })],
      });

      expect(summary).not.toContain("°F");
    });

    it("includes top beach rating when available", () => {
      const beaches = [
        makeBeach({ id: "1", name: "Top Spot", average_rating: 4.8 }),
      ];
      const { summary } = generateCityContent({
        cityName: "Test City",
        stateName: "California",
        stateSlug: "ca",
        stats: baseStats,
        beaches,
      });

      expect(summary).toContain("Top Spot");
      expect(summary).toContain("4.8");
    });
  });

  describe("faqs", () => {
    it("returns 4 FAQ items", () => {
      const beaches = [
        makeBeach({ id: "1", name: "Spot A", skill_level: "Beginner" }),
        makeBeach({ id: "2", name: "Spot B", skill_level: "Intermediate" }),
      ];
      const { faqs } = generateCityContent({
        cityName: "Del Mar",
        stateName: "California",
        stateSlug: "ca",
        stats: baseStats,
        beaches,
      });

      expect(faqs).toHaveLength(4);
      expect(faqs[0].question).toContain("How many");
      expect(faqs[1].question).toContain("best surf spot");
      expect(faqs[2].question).toContain("beginner");
      expect(faqs[3].question).toContain("wetsuit");
    });

    it("produces beginner-positive FAQ when beginner spots exist", () => {
      const beaches = [
        makeBeach({ id: "1", name: "Chill Beach", skill_level: "Beginner" }),
      ];
      const { faqs } = generateCityContent({
        cityName: "Del Mar",
        stateName: "California",
        stateSlug: "ca",
        stats: baseStats,
        beaches,
      });

      const beginnerFaq = faqs.find((f) => f.question.includes("beginner"));
      expect(beginnerFaq?.answer).toContain("Yes");
      expect(beginnerFaq?.answer).toContain("Chill Beach");
    });

    it("produces beginner-negative FAQ when no beginner spots", () => {
      const beaches = [
        makeBeach({ id: "1", name: "Heavy Spot", skill_level: "Advanced" }),
      ];
      const { faqs } = generateCityContent({
        cityName: "Del Mar",
        stateName: "California",
        stateSlug: "ca",
        stats: baseStats,
        beaches,
      });

      const beginnerFaq = faqs.find((f) => f.question.includes("beginner"));
      expect(beginnerFaq?.answer).toContain("intermediate to advanced");
    });

    it("includes wetsuit fallback when no regional data", () => {
      const { faqs } = generateCityContent({
        cityName: "Del Mar",
        stateName: "Unknown",
        stateSlug: "xx",
        stats: baseStats,
        beaches: [makeBeach({ id: "1", name: "Spot" })],
      });

      const wetsuitFaq = faqs.find((f) => f.question.includes("wetsuit"));
      expect(wetsuitFaq?.answer).toContain("vary by season");
    });

    it("includes trunks season when available", () => {
      const { faqs } = generateCityContent({
        cityName: "Miami Beach",
        stateName: "Florida",
        stateSlug: "fl",
        stats: baseStats,
        beaches: [makeBeach({ id: "1", name: "Spot" })],
      });

      const wetsuitFaq = faqs.find((f) => f.question.includes("wetsuit"));
      expect(wetsuitFaq?.answer).toContain("trunks");
    });
  });
});
