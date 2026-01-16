// __tests__/lib/seo/city-slug-utils.test.ts
import { buildCitySlug, detectCityCollisions } from "@/lib/seo/city-slug-utils";

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
