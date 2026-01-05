import { ExactMatchStrategy } from "@/lib/utils/beach-search/strategies";
import { normalizeSearchText } from "@/lib/utils/text-normalization";
import { makeBeach } from "../../../fixtures/beach-search-fixtures";

describe("ExactMatchStrategy", () => {
  const strategy = new ExactMatchStrategy();

  it("returns no match for empty search", () => {
    const beach = makeBeach({ name: "Blacks Beach" });
    expect(strategy.matches(beach, "", null)).toEqual({ matches: false, score: 0 });
  });

  it("matches exact beach name (punctuation-insensitive via normalization)", () => {
    const beach = makeBeach({ name: "Black's Beach" });
    const normalizedSearch = normalizeSearchText("Blacks Beach");

    expect(strategy.matches(beach, normalizedSearch, null)).toEqual({
      matches: true,
      score: 1000,
      matchType: "exact-name",
    });
  });

  it("matches exact city name", () => {
    const beach = makeBeach({ name: "Windansea", city: "La Jolla" });
    const normalizedSearch = normalizeSearchText("LA JOLLA");

    expect(strategy.matches(beach, normalizedSearch, null)).toEqual({
      matches: true,
      score: 800,
      matchType: "exact-city",
    });
  });
});



