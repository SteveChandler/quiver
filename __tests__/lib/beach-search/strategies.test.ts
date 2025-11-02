import type { Beach } from "@/types/database";
import {
  ExactMatchStrategy,
  AliasMatchStrategy,
  SubstringMatchStrategy,
  WordMatchStrategy,
} from "@/lib/utils/beach-search/strategies";

// Mock beach data
const createMockBeach = (name: string, city?: string, location?: string): Beach => ({
  id: "test-id",
  name,
  city: city || null,
  lat: 0,
  lon: 0,
  created_at: "2024-01-01",
  updated_at: "2024-01-01",
  ...(location ? { location } : {}),
} as any);

describe("Beach Search Strategies", () => {
  describe("ExactMatchStrategy", () => {
    const strategy = new ExactMatchStrategy();

    it("should match exact name", () => {
      const beach = createMockBeach("Blacks Beach");
      const result = strategy.matches(beach, "blacks beach", null);

      expect(result.matches).toBe(true);
      expect(result.score).toBe(1000);
      expect(result.matchType).toBe("exact-name");
    });

    it("should match exact city", () => {
      const beach = createMockBeach("Some Beach", "La Jolla");
      const result = strategy.matches(beach, "la jolla", null);

      expect(result.matches).toBe(true);
      expect(result.score).toBe(800);
      expect(result.matchType).toBe("exact-city");
    });

    it("should match exact location field", () => {
      const beach = createMockBeach("Some Beach", undefined, "La Jolla");
      const result = strategy.matches(beach, "la jolla", null);

      expect(result.matches).toBe(true);
      expect(result.score).toBe(800);
    });

    it("should not match partial names", () => {
      const beach = createMockBeach("Blacks Beach");
      const result = strategy.matches(beach, "blacks", null);

      expect(result.matches).toBe(false);
      expect(result.score).toBe(0);
    });

    it("should be case insensitive", () => {
      const beach = createMockBeach("Blacks Beach");
      // Note: The search text should be normalized before being passed to strategies
      const result = strategy.matches(beach, "blacks beach", null);

      expect(result.matches).toBe(true);
    });
  });

  describe("AliasMatchStrategy", () => {
    const strategy = new AliasMatchStrategy();

    it("should match when alias target equals beach name", () => {
      const beach = createMockBeach("Pacific Beach");
      const result = strategy.matches(beach, "pb", "pacific beach");

      expect(result.matches).toBe(true);
      expect(result.score).toBe(900);
      expect(result.matchType).toBe("alias-exact");
    });

    it("should match when beach name starts with alias", () => {
      const beach = createMockBeach("Pacific Beach Pier");
      const result = strategy.matches(beach, "pb", "pacific beach");

      expect(result.matches).toBe(true);
      expect(result.score).toBe(850);
      expect(result.matchType).toBe("alias-prefix");
    });

    it("should match when alias contains beach name", () => {
      const beach = createMockBeach("Pacific");
      const result = strategy.matches(beach, "pb", "pacific beach");

      expect(result.matches).toBe(true);
      expect(result.score).toBe(800);
      expect(result.matchType).toBe("alias-contains");
    });

    it("should not match when no alias target", () => {
      const beach = createMockBeach("Pacific Beach");
      const result = strategy.matches(beach, "pacific", null);

      expect(result.matches).toBe(false);
      expect(result.score).toBe(0);
    });

    it("should not match unrelated alias", () => {
      const beach = createMockBeach("Windansea");
      const result = strategy.matches(beach, "pb", "pacific beach");

      expect(result.matches).toBe(false);
    });
  });

  describe("SubstringMatchStrategy", () => {
    const strategy = new SubstringMatchStrategy();

    it("should match substring in name", () => {
      const beach = createMockBeach("Scripps Pier");
      const result = strategy.matches(beach, "scripps", null);

      expect(result.matches).toBe(true);
      expect(result.score).toBe(700);
      expect(result.matchType).toBe("substring-name");
    });

    it("should match substring in city", () => {
      const beach = createMockBeach("Some Beach", "La Jolla");
      const result = strategy.matches(beach, "la jo", null);

      expect(result.matches).toBe(true);
      expect(result.score).toBe(600);
      expect(result.matchType).toBe("substring-city");
    });

    it("should match substring in location", () => {
      const beach = createMockBeach("Some Beach", undefined, "La Jolla");
      const result = strategy.matches(beach, "la jo", null);

      expect(result.matches).toBe(true);
      expect(result.score).toBe(600);
    });

    it("should match reverse substring (name in search)", () => {
      const beach = createMockBeach("Blacks");
      const result = strategy.matches(beach, "blacks beach san diego", null);

      expect(result.matches).toBe(true);
      expect(result.score).toBe(500);
      expect(result.matchType).toBe("substring-reverse");
    });

    it("should not match completely different text", () => {
      const beach = createMockBeach("Windansea");
      const result = strategy.matches(beach, "pacific", null);

      expect(result.matches).toBe(false);
    });

    it("should prioritize name match over city match", () => {
      const beach = createMockBeach("La Jolla Shores", "La Jolla");
      const result = strategy.matches(beach, "shores", null);

      expect(result.matchType).toBe("substring-name");
      expect(result.score).toBe(700);
    });
  });

  describe("WordMatchStrategy", () => {
    const strategy = new WordMatchStrategy();

    it("should match all words in name", () => {
      const beach = createMockBeach("La Jolla Shores");
      const result = strategy.matches(beach, "la shores", null);

      expect(result.matches).toBe(true);
      expect(result.score).toBe(400);
      expect(result.matchType).toBe("word-match-name");
    });

    it("should match all words in city", () => {
      const beach = createMockBeach("Some Beach", "Pacific Beach");
      const result = strategy.matches(beach, "pacific beach", null);

      expect(result.matches).toBe(true);
      expect(result.score).toBe(300);
      expect(result.matchType).toBe("word-match-city");
    });

    it("should match all words in location", () => {
      const beach = createMockBeach("Some Beach", undefined, "Pacific Beach");
      const result = strategy.matches(beach, "pacific beach", null);

      expect(result.matches).toBe(true);
      expect(result.score).toBe(300);
    });

    it("should not match single word searches", () => {
      const beach = createMockBeach("La Jolla Shores");
      const result = strategy.matches(beach, "shores", null);

      expect(result.matches).toBe(false);
      expect(result.score).toBe(0);
    });

    it("should not match when only some words match", () => {
      const beach = createMockBeach("La Jolla Shores");
      const result = strategy.matches(beach, "la windansea", null);

      expect(result.matches).toBe(false);
    });

    it("should handle word order independence", () => {
      const beach = createMockBeach("La Jolla Shores");
      const result = strategy.matches(beach, "shores la", null);

      expect(result.matches).toBe(true);
    });

    it("should handle partial word matches", () => {
      const beach = createMockBeach("Blacks Beach");
      const result = strategy.matches(beach, "black beach", null);

      expect(result.matches).toBe(true);
    });
  });

  describe("Strategy Priority", () => {
    it("should have correct priority order", () => {
      const exact = new ExactMatchStrategy();
      const alias = new AliasMatchStrategy();
      const substring = new SubstringMatchStrategy();
      const word = new WordMatchStrategy();

      expect(exact.priority).toBeGreaterThan(alias.priority);
      expect(alias.priority).toBeGreaterThan(substring.priority);
      expect(substring.priority).toBeGreaterThan(word.priority);
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty search", () => {
      const beach = createMockBeach("Blacks Beach");
      const exact = new ExactMatchStrategy();
      const word = new WordMatchStrategy();

      // Empty search won't match exact (different from empty)
      const exactResult = exact.matches(beach, "", null);
      expect(exactResult.matches).toBe(false);

      // Word strategy requires multiple words
      const wordResult = word.matches(beach, "", null);
      expect(wordResult.matches).toBe(false);
    });

    it("should handle beaches with no city/location", () => {
      const beach = createMockBeach("Blacks Beach");
      const strategy = new ExactMatchStrategy();
      const result = strategy.matches(beach, "san diego", null);

      expect(result.matches).toBe(false);
    });

    it("should handle special characters gracefully", () => {
      const beach = createMockBeach("O'Neill Beach");
      const strategy = new SubstringMatchStrategy();
      const result = strategy.matches(beach, "oneill", null);

      // Should match due to normalization
      expect(result.matches).toBe(true);
    });
  });
});
