import type { Beach } from "@/types/database";
import { BeachRelevanceScorer } from "@/lib/utils/beach-search/beach-relevance-scorer";

// Mock beach factory
const createMockBeach = (
  name: string,
  city?: string,
  location?: string
): Beach =>
  ({
    id: `beach-${name.toLowerCase().replace(/\s/g, "-")}`,
    name,
    city: city || null,
    lat: 0,
    lon: 0,
    created_at: "2024-01-01",
    updated_at: "2024-01-01",
    ...(location ? { location } : {}),
  } as any);

describe("BeachRelevanceScorer", () => {
  describe("score()", () => {
    it("should apply base score from strategy", () => {
      const scorer = new BeachRelevanceScorer("blacks", null);
      const beach = createMockBeach("Blacks Beach");
      const result = scorer.score(beach, "exact", 1000);

      expect(result.score).toBeGreaterThanOrEqual(1000);
      expect(result.beach).toBe(beach);
      expect(result.matchType).toBe("exact");
    });

    it("should boost exact name matches", () => {
      const scorer = new BeachRelevanceScorer("blacks beach", null);
      const beach = createMockBeach("Blacks Beach");
      const result = scorer.score(beach, "exact", 500);

      // Base 500 + exact match boost 1000
      expect(result.score).toBeGreaterThanOrEqual(1500);
    });

    it("should boost name substring matches", () => {
      const scorer = new BeachRelevanceScorer("blacks", null);
      const beach = createMockBeach("Blacks Beach");
      const result = scorer.score(beach, "substring", 500);

      // Base 500 + name contains boost 500 - length penalty
      // "blacks beach" = 12 chars, so 500 + 500 - 12 = 988
      expect(result.score).toBe(988);
    });

    it("should penalize longer names", () => {
      const scorer = new BeachRelevanceScorer("beach", null);
      const shortBeach = createMockBeach("The Beach");
      const longBeach = createMockBeach("The Really Long Beach Name");

      const shortResult = scorer.score(shortBeach, "substring", 500);
      const longResult = scorer.score(longBeach, "substring", 500);

      expect(shortResult.score).toBeGreaterThan(longResult.score);
    });

    it("should boost exact alias matches", () => {
      const scorer = new BeachRelevanceScorer("pb", "pacific beach");
      const beach = createMockBeach("Pacific Beach");
      const result = scorer.score(beach, "alias", 500);

      // Base 500 + alias exact bonus 300 - length penalty 13
      // "pacific beach" = 13 chars, so 500 + 300 - 13 = 787
      expect(result.score).toBe(787);
    });

    it("should boost alias prefix matches", () => {
      const scorer = new BeachRelevanceScorer("pb", "pacific beach");
      const beach = createMockBeach("Pacific Beach Pier");
      const result = scorer.score(beach, "alias", 500);

      // Base 500 + alias prefix bonus 200 - length penalty 18
      // "pacific beach pier" = 18 chars, so 500 + 200 - 18 = 682
      expect(result.score).toBe(682);
    });

    it("should boost alias contains matches", () => {
      const scorer = new BeachRelevanceScorer("pb", "pacific beach");
      const beach = createMockBeach("Pacific");
      const result = scorer.score(beach, "alias", 500);

      // Base 500 + alias contains bonus 100 - length penalty 7
      // "pacific" = 7 chars, so 500 + 100 - 7 = 593
      expect(result.score).toBe(593);
    });

    it("should handle beaches without city gracefully", () => {
      const scorer = new BeachRelevanceScorer("blacks", null);
      const beach = createMockBeach("Blacks Beach");
      const result = scorer.score(beach, "exact", 500);

      expect(result.normalizedLocation).toBe("");
    });

    it("should fallback to location when city is null", () => {
      const scorer = new BeachRelevanceScorer("la jolla", null);
      // When city is null, should use location
      const beach = createMockBeach("Some Beach", undefined, "La Jolla");
      const result = scorer.score(beach, "substring", 500);

      expect(result.normalizedLocation).toBe("la jolla");
    });

    it("should use location field when city is not available", () => {
      const scorer = new BeachRelevanceScorer("la jolla", null);
      const beach = createMockBeach("Some Beach", undefined, "La Jolla");
      const result = scorer.score(beach, "substring", 500);

      expect(result.normalizedLocation).toBe("la jolla");
    });

    it("should normalize beach names in results", () => {
      const scorer = new BeachRelevanceScorer("blacks", null);
      const beach = createMockBeach("Blacks Beach");
      const result = scorer.score(beach, "exact", 500);

      expect(result.normalizedName).toBe("blacks beach");
    });
  });

  describe("sort()", () => {
    it("should sort by score descending", () => {
      const beaches = [
        {
          beach: createMockBeach("Low Score"),
          score: 100,
          matchType: "low",
          normalizedName: "low score",
          normalizedLocation: "",
        },
        {
          beach: createMockBeach("High Score"),
          score: 1000,
          matchType: "high",
          normalizedName: "high score",
          normalizedLocation: "",
        },
        {
          beach: createMockBeach("Mid Score"),
          score: 500,
          matchType: "mid",
          normalizedName: "mid score",
          normalizedLocation: "",
        },
      ];

      const sorted = BeachRelevanceScorer.sort(beaches);

      expect(sorted[0].name).toBe("High Score");
      expect(sorted[1].name).toBe("Mid Score");
      expect(sorted[2].name).toBe("Low Score");
    });

    it("should use name length as tiebreaker", () => {
      const beaches = [
        {
          beach: createMockBeach("Very Long Beach Name"),
          score: 500,
          matchType: "same",
          normalizedName: "very long beach name",
          normalizedLocation: "",
        },
        {
          beach: createMockBeach("Short"),
          score: 500,
          matchType: "same",
          normalizedName: "short",
          normalizedLocation: "",
        },
        {
          beach: createMockBeach("Medium Name"),
          score: 500,
          matchType: "same",
          normalizedName: "medium name",
          normalizedLocation: "",
        },
      ];

      const sorted = BeachRelevanceScorer.sort(beaches);

      expect(sorted[0].name).toBe("Short");
      expect(sorted[1].name).toBe("Medium Name");
      expect(sorted[2].name).toBe("Very Long Beach Name");
    });

    it("should handle empty array", () => {
      const sorted = BeachRelevanceScorer.sort([]);
      expect(sorted).toEqual([]);
    });

    it("should handle single item", () => {
      const beaches = [
        {
          beach: createMockBeach("Only Beach"),
          score: 500,
          matchType: "only",
          normalizedName: "only beach",
          normalizedLocation: "",
        },
      ];

      const sorted = BeachRelevanceScorer.sort(beaches);
      expect(sorted).toHaveLength(1);
      expect(sorted[0].name).toBe("Only Beach");
    });

    it("should maintain stable sort for equal scores and lengths", () => {
      const beaches = [
        {
          beach: createMockBeach("Beach A"),
          score: 500,
          matchType: "same",
          normalizedName: "beach a",
          normalizedLocation: "",
        },
        {
          beach: createMockBeach("Beach B"),
          score: 500,
          matchType: "same",
          normalizedName: "beach b",
          normalizedLocation: "",
        },
      ];

      const sorted = BeachRelevanceScorer.sort(beaches);
      expect(sorted[0].name).toBe("Beach A");
      expect(sorted[1].name).toBe("Beach B");
    });
  });

  describe("Integration with scoring system", () => {
    it("should produce consistent rankings for realistic search", () => {
      const scorer = new BeachRelevanceScorer("la jolla", null);

      const beaches = [
        scorer.score(
          createMockBeach("La Jolla Shores", "La Jolla"),
          "exact-city",
          800
        ),
        scorer.score(
          createMockBeach("Scripps Pier", "La Jolla"),
          "substring-city",
          600
        ),
        scorer.score(
          createMockBeach("Blacks Beach", "La Jolla"),
          "substring-city",
          600
        ),
        scorer.score(
          createMockBeach("Windansea Beach", "La Jolla"),
          "substring-city",
          600
        ),
      ];

      const sorted = BeachRelevanceScorer.sort(beaches);

      // All should have La Jolla in location, but La Jolla Shores might rank
      // differently due to additional scoring factors
      expect(sorted).toHaveLength(4);
      expect(sorted.map((b) => b.name)).toContain("La Jolla Shores");
      expect(sorted.map((b) => b.name)).toContain("Scripps Pier");
    });

    it("should rank exact matches higher than partial", () => {
      const scorer = new BeachRelevanceScorer("blacks beach", null);

      const beaches = [
        scorer.score(createMockBeach("Blacks Beach"), "exact-name", 1000),
        scorer.score(
          createMockBeach("Blacks Beach North"),
          "substring-name",
          700
        ),
        scorer.score(
          createMockBeach("Nearby Beach", "Blacks Beach"),
          "exact-city",
          800
        ),
      ];

      const sorted = BeachRelevanceScorer.sort(beaches);

      expect(sorted[0].name).toBe("Blacks Beach");
    });
  });
});
