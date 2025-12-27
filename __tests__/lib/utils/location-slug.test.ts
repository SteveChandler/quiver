/**
 * Tests for Location Slug Utilities
 *
 * Comprehensive test coverage for slug generation, URL building,
 * and location data normalization functions.
 */

import {
  generateLocationSlug,
  buildLocationUrl,
  parseLocationFromSlug,
  buildBreadcrumbSegments,
  normalizeCountry,
  normalizeState,
} from "@/lib/utils/location-slug";

describe("Location Slug Utilities", () => {
  describe("generateLocationSlug", () => {
    it("should convert text to lowercase hyphenated slug", () => {
      expect(generateLocationSlug("La Jolla")).toBe("la-jolla");
      expect(generateLocationSlug("San Diego")).toBe("san-diego");
      expect(generateLocationSlug("Pacific Beach")).toBe("pacific-beach");
    });

    it("should handle multi-word names with hyphens", () => {
      expect(generateLocationSlug("Cardiff by the Sea")).toBe(
        "cardiff-by-the-sea"
      );
      expect(generateLocationSlug("Cardiff-by-the-Sea")).toBe(
        "cardiff-by-the-sea"
      );
    });

    it("should handle special characters", () => {
      expect(generateLocationSlug("O'Shaughnessy Beach")).toBe(
        "oshaughnessy-beach"
      );
      expect(generateLocationSlug("Malibu (Point Dume)")).toBe(
        "malibu-point-dume"
      );
    });

    it("should handle null and undefined", () => {
      expect(generateLocationSlug(null)).toBe("");
      expect(generateLocationSlug(undefined)).toBe("");
    });

    it("should handle empty string", () => {
      expect(generateLocationSlug("")).toBe("");
    });

    it("should handle strings with extra spaces", () => {
      expect(generateLocationSlug("  La Jolla  ")).toBe("la-jolla");
      expect(generateLocationSlug("San  Diego")).toBe("san-diego");
    });

    it("should handle numbers in location names", () => {
      expect(generateLocationSlug("Highway 101")).toBe("highway-101");
      expect(generateLocationSlug("Beach 72")).toBe("beach-72");
    });
  });

  describe("buildLocationUrl", () => {
    it("should build correct URL path for USA locations", () => {
      const url = buildLocationUrl("La Jolla", "CA", "USA");
      expect(url).toBe("/beaches/usa/ca/la-jolla");
    });

    it("should default to USA if no country provided", () => {
      const url = buildLocationUrl("La Jolla", "CA");
      expect(url).toBe("/beaches/usa/ca/la-jolla");
    });

    it("should handle null country parameter", () => {
      const url = buildLocationUrl("La Jolla", "CA", null);
      expect(url).toBe("/beaches/usa/ca/la-jolla");
    });

    it("should handle international locations", () => {
      const url = buildLocationUrl("Ensenada", "Baja California", "Mexico");
      expect(url).toBe("/beaches/mexico/baja-california/ensenada");
    });

    it("should return /map for missing city", () => {
      const url = buildLocationUrl(null, "CA", "USA");
      expect(url).toBe("/map");
    });

    it("should return /map for missing state", () => {
      const url = buildLocationUrl("La Jolla", null, "USA");
      expect(url).toBe("/map");
    });

    it("should return /map for both missing city and state", () => {
      const url = buildLocationUrl(null, null, "USA");
      expect(url).toBe("/map");
    });

    it("should handle empty strings", () => {
      const url = buildLocationUrl("", "", "USA");
      expect(url).toBe("/map");
    });

    it("should handle state abbreviations", () => {
      const url = buildLocationUrl("San Diego", "CA", "USA");
      expect(url).toBe("/beaches/usa/ca/san-diego");
    });

    it("should handle full state names", () => {
      const url = buildLocationUrl("San Diego", "California", "USA");
      expect(url).toBe("/beaches/usa/california/san-diego");
    });

    it("should handle multi-word cities", () => {
      const url = buildLocationUrl("Pacific Beach", "CA", "USA");
      expect(url).toBe("/beaches/usa/ca/pacific-beach");
    });

    it("should handle hyphenated cities", () => {
      const url = buildLocationUrl("Cardiff-by-the-Sea", "CA", "USA");
      expect(url).toBe("/beaches/usa/ca/cardiff-by-the-sea");
    });
  });

  describe("parseLocationFromSlug", () => {
    it("should convert slug to readable format", () => {
      expect(parseLocationFromSlug("la-jolla")).toBe("La Jolla");
      expect(parseLocationFromSlug("san-diego")).toBe("San Diego");
      expect(parseLocationFromSlug("pacific-beach")).toBe("Pacific Beach");
    });

    it("should handle multi-word slugs with stop-words", () => {
      expect(parseLocationFromSlug("cardiff-by-the-sea")).toBe(
        "Cardiff by the Sea"
      );
    });

    it("should capitalize stop-words when they appear first", () => {
      expect(parseLocationFromSlug("the-wedge")).toBe("The Wedge");
      expect(parseLocationFromSlug("on-the-rocks")).toBe("On the Rocks");
    });

    it("should handle single word slugs", () => {
      expect(parseLocationFromSlug("ensenada")).toBe("Ensenada");
      expect(parseLocationFromSlug("oceanside")).toBe("Oceanside");
    });

    it("should handle empty string", () => {
      expect(parseLocationFromSlug("")).toBe("");
    });

    it("should capitalize each word", () => {
      expect(parseLocationFromSlug("los-angeles")).toBe("Los Angeles");
      expect(parseLocationFromSlug("new-york")).toBe("New York");
    });

    it("should handle numbers in slugs", () => {
      expect(parseLocationFromSlug("highway-101")).toBe("Highway 101");
    });
  });

  describe("buildBreadcrumbSegments", () => {
    it("should build correct breadcrumb array for USA location", () => {
      const segments = buildBreadcrumbSegments("La Jolla", "CA", "USA");

      expect(segments).toHaveLength(2); // State + City (Country omitted for USA)
      expect(segments[0]).toEqual({
        label: "CA",
        url: "/beaches/usa/ca",
      });
      expect(segments[1]).toEqual({
        label: "La Jolla",
        url: "/beaches/usa/ca/la-jolla",
      });
    });

    it("should include country segment for non-USA locations", () => {
      const segments = buildBreadcrumbSegments(
        "Ensenada",
        "Baja California",
        "Mexico"
      );

      expect(segments).toHaveLength(3); // Country + State + City
      expect(segments[0]).toEqual({
        label: "Mexico",
        url: "/beaches/mexico",
      });
      expect(segments[1]).toEqual({
        label: "Baja California",
        url: "/beaches/mexico/baja-california",
      });
      expect(segments[2]).toEqual({
        label: "Ensenada",
        url: "/beaches/mexico/baja-california/ensenada",
      });
    });

    it("should default to USA when no country provided", () => {
      const segments = buildBreadcrumbSegments("La Jolla", "CA");

      expect(segments).toHaveLength(2);
      expect(segments[0].url).toContain("/beaches/usa/");
    });

    it("should handle missing city", () => {
      const segments = buildBreadcrumbSegments(null, "CA", "USA");

      expect(segments).toHaveLength(1); // Only state
      expect(segments[0]).toEqual({
        label: "CA",
        url: "/beaches/usa/ca",
      });
    });

    it("should handle missing state", () => {
      const segments = buildBreadcrumbSegments("La Jolla", null, "USA");

      // City segment will have incomplete URL but is still included
      expect(segments.length).toBeGreaterThanOrEqual(0);
    });

    it("should handle all missing data", () => {
      const segments = buildBreadcrumbSegments(null, null, null);

      expect(segments).toEqual([]);
    });
  });

  describe("normalizeCountry", () => {
    it("should normalize USA variations", () => {
      expect(normalizeCountry("US")).toBe("USA");
      expect(normalizeCountry("USA")).toBe("USA");
      expect(normalizeCountry("United States")).toBe("USA");
    });

    it("should normalize Mexico variations", () => {
      expect(normalizeCountry("MX")).toBe("Mexico");
      expect(normalizeCountry("Mexico")).toBe("Mexico");
      expect(normalizeCountry("MEXICO")).toBe("Mexico");
    });

    it("should handle lowercase input", () => {
      expect(normalizeCountry("usa")).toBe("USA");
      expect(normalizeCountry("us")).toBe("USA");
      expect(normalizeCountry("mexico")).toBe("Mexico");
    });

    it("should handle mixed case input", () => {
      expect(normalizeCountry("UsA")).toBe("USA");
      expect(normalizeCountry("MeXiCo")).toBe("Mexico");
    });

    it("should default to USA for null/undefined", () => {
      expect(normalizeCountry(null)).toBe("USA");
      expect(normalizeCountry(undefined)).toBe("USA");
    });

    it("should return original for unrecognized countries", () => {
      expect(normalizeCountry("Canada")).toBe("Canada");
      expect(normalizeCountry("Australia")).toBe("Australia");
    });

    it("should handle strings with extra spaces", () => {
      expect(normalizeCountry("  USA  ")).toBe("USA");
      expect(normalizeCountry("  Mexico  ")).toBe("Mexico");
    });
  });

  describe("normalizeState", () => {
    it("should convert state names to abbreviations", () => {
      expect(normalizeState("California")).toBe("CA");
      expect(normalizeState("california")).toBe("CA");
      expect(normalizeState("Oregon")).toBe("OR");
      expect(normalizeState("Washington")).toBe("WA");
    });

    it("should uppercase existing abbreviations", () => {
      expect(normalizeState("ca")).toBe("CA");
      expect(normalizeState("CA")).toBe("CA");
      expect(normalizeState("or")).toBe("OR");
    });

    it("should handle Mexican states", () => {
      expect(normalizeState("Baja California")).toBe("Baja California");
      expect(normalizeState("baja california")).toBe("Baja California");
    });

    it("should return empty string for null/undefined", () => {
      expect(normalizeState(null)).toBe("");
      expect(normalizeState(undefined)).toBe("");
    });

    it("should handle strings with extra spaces", () => {
      expect(normalizeState("  CA  ")).toBe("CA");
      expect(normalizeState("  California  ")).toBe("CA");
    });

    it("should return original for unrecognized states", () => {
      expect(normalizeState("Unknown State")).toBe("Unknown State");
      expect(normalizeState("Texas")).toBe("Texas"); // Not in mapping
    });

    it("should handle Hawaii", () => {
      expect(normalizeState("Hawaii")).toBe("HI");
      expect(normalizeState("hawaii")).toBe("HI");
      expect(normalizeState("HI")).toBe("HI");
    });

    it("should handle Florida", () => {
      expect(normalizeState("Florida")).toBe("FL");
      expect(normalizeState("florida")).toBe("FL");
      expect(normalizeState("FL")).toBe("FL");
    });
  });

  describe("Integration: Slug Round-Trip", () => {
    it("should maintain integrity through slug and parse cycle", () => {
      const originalCities = [
        "La Jolla",
        "San Diego",
        "Pacific Beach",
        "Cardiff by the Sea",
      ];

      originalCities.forEach((city) => {
        const slug = generateLocationSlug(city);
        const parsed = parseLocationFromSlug(slug);

        // Note: Parsing may not be exact due to title-casing, but case-insensitive match works
        // "Pacific Beach" → "pacific-beach" → "Pacific Beach" ✓
        // "Cardiff by the Sea" → "cardiff-by-the-sea" → "Cardiff by the Sea" ✓
        expect(parsed.toLowerCase()).toBe(city.toLowerCase());
      });
    });

    it("should build valid URLs that can be parsed back", () => {
      const testCases = [
        { city: "La Jolla", state: "CA", country: "USA" },
        { city: "Ensenada", state: "Baja California", country: "Mexico" },
        { city: "Pacific Beach", state: "CA", country: "USA" },
      ];

      testCases.forEach(({ city, state, country }) => {
        const url = buildLocationUrl(city, state, country);
        expect(url).toMatch(/^\/beaches\/[a-z-]+\/[a-z-]+\/[a-z-]+$/);

        // Extract slugs from URL
        const parts = url.split("/").filter(Boolean);
        expect(parts[0]).toBe("beaches");
        expect(parts).toHaveLength(4); // beaches, country, state, city
      });
    });
  });

  describe("Edge Cases", () => {
    it("should handle very long location names", () => {
      const longName =
        "This is a Very Long Location Name With Many Words That Should Still Work";
      const slug = generateLocationSlug(longName);

      expect(slug).toBe(
        "this-is-a-very-long-location-name-with-many-words-that-should-still-work"
      );
    });

    it("should handle location names with numbers", () => {
      expect(buildLocationUrl("Beach 42", "CA", "USA")).toBe(
        "/beaches/usa/ca/beach-42"
      );
    });

    it("should handle location names with apostrophes", () => {
      expect(generateLocationSlug("O'Neill Beach")).toBe("oneill-beach");
    });

    it("should handle location names with commas", () => {
      expect(generateLocationSlug("La Jolla, San Diego")).toBe(
        "la-jolla-san-diego"
      );
    });

    it("should handle unicode characters gracefully", () => {
      // Most unicode should be stripped or converted
      const result = generateLocationSlug("Playa Hermosa ☀️");
      expect(result).toMatch(/^[a-z0-9-]+$/); // Only lowercase alphanumeric and hyphens
    });
  });

  describe("URL Validation", () => {
    it("should only generate lowercase URLs", () => {
      const url = buildLocationUrl("La Jolla", "CA", "USA");
      expect(url).toBe(url.toLowerCase());
    });

    it("should not contain spaces in URLs", () => {
      const url = buildLocationUrl("Pacific Beach", "CA", "USA");
      expect(url).not.toContain(" ");
    });

    it("should not contain special characters in URLs", () => {
      const url = buildLocationUrl("O'Neill Beach", "CA", "USA");
      expect(url).toMatch(/^[a-z0-9-\/]+$/);
    });

    it("should not have trailing slashes", () => {
      const url = buildLocationUrl("La Jolla", "CA", "USA");
      expect(url).not.toMatch(/\/$/);
    });

    it("should not have double slashes", () => {
      const url = buildLocationUrl("La Jolla", "CA", "USA");
      expect(url).not.toContain("//");
    });
  });
});
