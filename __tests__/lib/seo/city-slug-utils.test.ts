// __tests__/lib/seo/city-slug-utils.test.ts
import {
  buildCitySlug,
  detectCityCollisions,
  resolveCityFromSlug,
} from "@/lib/seo/city-slug-utils";

describe("detectCityCollisions", () => {
  it("returns empty map when no collisions", () => {
    const cities = [
      { city: "Santa Cruz", state: "CA" },
      { city: "Honolulu", state: "HI" },
    ];
    const collisions = detectCityCollisions(cities);
    expect(collisions.size).toBe(0);
  });

  it("detects cities that appear in multiple states", () => {
    const cities = [
      { city: "Newport", state: "CA" },
      { city: "Newport", state: "OR" },
      { city: "Newport", state: "RI" },
      { city: "Santa Cruz", state: "CA" },
    ];
    const collisions = detectCityCollisions(cities);
    expect(collisions.get("newport")).toBe(3);
    expect(collisions.has("santa-cruz")).toBe(false);
  });

  it("handles case-insensitive city names", () => {
    const cities = [
      { city: "NEWPORT BEACH", state: "CA" },
      { city: "Newport Beach", state: "OR" },
    ];
    const collisions = detectCityCollisions(cities);
    expect(collisions.get("newport-beach")).toBe(2);
  });
});

describe("buildCitySlug", () => {
  it("returns simple slug for unique city", () => {
    const collisions = new Map<string, number>();
    const slug = buildCitySlug("Santa Cruz", "CA", collisions);
    expect(slug).toBe("santa-cruz");
  });

  it("appends state suffix for colliding city", () => {
    const collisions = new Map([["newport", 3]]);
    const slug = buildCitySlug("Newport", "CA", collisions);
    expect(slug).toBe("newport-ca");
  });

  it("handles Newport Beach correctly", () => {
    const collisions = new Map([["newport-beach", 2]]);
    const slug = buildCitySlug("Newport Beach", "CA", collisions);
    expect(slug).toBe("newport-beach-ca");
  });

  it("lowercases state suffix", () => {
    const collisions = new Map([["newport", 2]]);
    const slug = buildCitySlug("Newport", "OR", collisions);
    expect(slug).toBe("newport-or");
  });
});

describe("resolveCityFromSlug", () => {
  it("parses simple slug without state suffix", () => {
    const result = resolveCityFromSlug("santa-cruz");
    expect(result).toEqual({
      cityPattern: "santa cruz",
      stateFilter: null,
    });
  });

  it("parses slug with state suffix", () => {
    const result = resolveCityFromSlug("newport-ca");
    expect(result).toEqual({
      cityPattern: "newport",
      stateFilter: "CA",
    });
  });

  it("parses multi-word city with state suffix", () => {
    const result = resolveCityFromSlug("newport-beach-ca");
    expect(result).toEqual({
      cityPattern: "newport beach",
      stateFilter: "CA",
    });
  });

  it("handles slug that ends with non-state suffix", () => {
    // "la-jolla" - the last part "jolla" is not a state slug
    // so the entire slug is treated as a city pattern
    const result = resolveCityFromSlug("la-jolla");
    expect(result).toEqual({
      cityPattern: "la jolla",
      stateFilter: null,
    });
  });

  it("handles ambiguous city name starting with state-like prefix", () => {
    // Edge case: "la" at the start looks like Louisiana abbreviation
    // but since we only check the LAST part, this parses correctly
    const result = resolveCityFromSlug("la");
    // Single-part slug can't have state suffix (needs parts.length > 1)
    expect(result).toEqual({
      cityPattern: "la",
      stateFilter: null,
    });
  });

  it("handles oregon state suffix", () => {
    const result = resolveCityFromSlug("newport-or");
    expect(result).toEqual({
      cityPattern: "newport",
      stateFilter: "OR",
    });
  });

  it("normalizes accented characters in slug", () => {
    // "rincón" with accent should be normalized to "rincon"
    const result = resolveCityFromSlug("rincón");
    expect(result).toEqual({
      cityPattern: "rincon",
      stateFilter: null,
    });
  });

  it("normalizes accented characters with state suffix", () => {
    // "rincón-pr" should normalize to "rincon" with PR state filter
    const result = resolveCityFromSlug("rincón-pr");
    expect(result).toEqual({
      cityPattern: "rincon",
      stateFilter: "PR",
    });
  });

  it("handles hyphenated city names", () => {
    // "cardiff-by-the-sea" should parse as full city pattern
    const result = resolveCityFromSlug("cardiff-by-the-sea");
    expect(result).toEqual({
      cityPattern: "cardiff by the sea",
      stateFilter: null,
    });
  });

  it("handles multiple accented characters", () => {
    // Various diacritics should all be stripped
    const result = resolveCityFromSlug("são-paulo");
    expect(result).toEqual({
      cityPattern: "sao paulo",
      stateFilter: null,
    });
  });
});
