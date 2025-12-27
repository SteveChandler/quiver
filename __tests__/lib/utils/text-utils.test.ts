/**
 * Tests for Text Utilities
 *
 * Comprehensive test coverage for slugification and text manipulation functions.
 */

import { slugify, slugifyAscii, sanitizeBeachDescription } from "@/lib/utils/text-utils";

describe("Text Utilities", () => {
  describe("slugify", () => {
    it("should convert text to lowercase hyphenated slug", () => {
      expect(slugify("Malibu Beach")).toBe("malibu-beach");
      expect(slugify("San Diego")).toBe("san-diego");
    });

    it("should remove apostrophes", () => {
      expect(slugify("O'ahu's North Shore")).toBe("oahus-north-shore");
      expect(slugify("O'Neill Beach")).toBe("oneill-beach");
    });

    it("should handle special characters by replacing with hyphens", () => {
      expect(slugify("Hello, World!")).toBe("hello-world");
    });

    it("should trim leading and trailing hyphens", () => {
      expect(slugify("---test---")).toBe("test");
    });

    it("should handle empty and null-ish input", () => {
      expect(slugify("")).toBe("");
      expect(slugify(null as unknown as string)).toBe("");
      expect(slugify(undefined as unknown as string)).toBe("");
    });
  });

  describe("slugifyAscii", () => {
    it("should strip diacritics from accented characters", () => {
      expect(slugifyAscii("Rincón")).toBe("rincon");
      expect(slugifyAscii("São Paulo")).toBe("sao-paulo");
      expect(slugifyAscii("Malmö")).toBe("malmo");
      expect(slugifyAscii("Café")).toBe("cafe");
    });

    it("should handle hyphenated city names correctly", () => {
      expect(slugifyAscii("Cardiff-by-the-Sea")).toBe("cardiff-by-the-sea");
      expect(slugifyAscii("Cardiff by the Sea")).toBe("cardiff-by-the-sea");
    });

    it("should handle combined diacritics and hyphens", () => {
      expect(slugifyAscii("São-Paulo")).toBe("sao-paulo");
    });

    it("should produce lowercase output", () => {
      expect(slugifyAscii("RINCÓN")).toBe("rincon");
      expect(slugifyAscii("CARDIFF-BY-THE-SEA")).toBe("cardiff-by-the-sea");
    });

    it("should handle apostrophes like slugify", () => {
      expect(slugifyAscii("O'Neill Beach")).toBe("oneill-beach");
    });

    it("should handle empty and null-ish input", () => {
      expect(slugifyAscii("")).toBe("");
      expect(slugifyAscii(null as unknown as string)).toBe("");
      expect(slugifyAscii(undefined as unknown as string)).toBe("");
    });

    it("should handle strings with extra spaces", () => {
      expect(slugifyAscii("  Rincón  ")).toBe("rincon");
      expect(slugifyAscii("  Cardiff by the Sea  ")).toBe("cardiff-by-the-sea");
    });

    it("should handle numbers in location names", () => {
      expect(slugifyAscii("Beach 42")).toBe("beach-42");
      expect(slugifyAscii("Highway 101")).toBe("highway-101");
    });

    it("should handle multi-word names with special characters", () => {
      expect(slugifyAscii("Playa Hermosa ☀️")).toMatch(/^[a-z0-9-]+$/);
      expect(slugifyAscii("Malibu (Point Dume)")).toBe("malibu-point-dume");
    });

    it("should match slugify output for ASCII-only input", () => {
      const asciiStrings = [
        "San Diego",
        "Pacific Beach",
        "La Jolla",
        "Cardiff-by-the-Sea",
      ];

      asciiStrings.forEach((str) => {
        expect(slugifyAscii(str)).toBe(slugify(str));
      });
    });

    it("should produce different output than slugify for accented input", () => {
      // slugify produces "rinc-n" because it strips non-ASCII chars
      // slugifyAscii produces "rincon" because it normalizes first
      expect(slugify("Rincón")).toBe("rinc-n");
      expect(slugifyAscii("Rincón")).toBe("rincon");
    });
  });

  describe("Integration: Slug Matching", () => {
    it("should enable matching city slugs with diacritics", () => {
      // Simulating the use case: URL has "rincon", DB has "Rincón"
      const urlSlug = "rincon";
      const dbCityName = "Rincón";

      // The resolution logic: slugifyAscii(dbCityName) === urlSlug
      expect(slugifyAscii(dbCityName)).toBe(urlSlug);
    });

    it("should enable matching hyphenated city slugs", () => {
      // URL has "cardiff-by-the-sea", DB has "Cardiff-by-the-Sea"
      const urlSlug = "cardiff-by-the-sea";
      const dbCityName = "Cardiff-by-the-Sea";

      expect(slugifyAscii(dbCityName)).toBe(urlSlug);
    });
  });

  describe("sanitizeBeachDescription", () => {
    it("should strip leading markdown-bold beach name when it matches the provided name", () => {
      const desc =
        "**Terramar Point** represents rare North San Diego County point break.";
      expect(sanitizeBeachDescription(desc, "Terramar Point")).toBe(
        "Terramar Point represents rare North San Diego County point break."
      );
    });

    it("should preserve whitespace after the bolded name (including newlines)", () => {
      const desc = "**Terramar Point**\nrepresents rare North San Diego County point break.";
      expect(sanitizeBeachDescription(desc, "Terramar Point")).toBe(
        "Terramar Point\nrepresents rare North San Diego County point break."
      );
    });

    it("should not strip bold markup if the bolded segment doesn't match the beach name", () => {
      const desc = "**Not The Name** represents something else.";
      expect(sanitizeBeachDescription(desc, "Terramar Point")).toBe(desc);
    });

    it("should pass through descriptions without a leading bold segment", () => {
      const desc = "Terramar Point represents rare North San Diego County point break.";
      expect(sanitizeBeachDescription(desc, "Terramar Point")).toBe(desc);
    });

    it("should return null for null/undefined descriptions", () => {
      expect(sanitizeBeachDescription(null, "Terramar Point")).toBeNull();
      expect(sanitizeBeachDescription(undefined, "Terramar Point")).toBeNull();
    });
  });
});

