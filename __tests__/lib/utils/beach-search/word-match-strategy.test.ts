import { WordMatchStrategy } from "@/lib/utils/beach-search/strategies";
import { normalizeSearchText } from "@/lib/utils/text-normalization";
import { makeBeach } from "../../../fixtures/beach-search-fixtures";

describe("WordMatchStrategy", () => {
  const strategy = new WordMatchStrategy();

  it("does not apply to single-word searches", () => {
    const beach = makeBeach({ name: "Blacks Beach" });
    const normalizedSearch = normalizeSearchText("blacks");
    expect(strategy.matches(beach, normalizedSearch, null)).toEqual({
      matches: false,
      score: 0,
    });
  });

  it("matches when all search words match in the beach name (partial word matching)", () => {
    const beach = makeBeach({ name: "Blacks Beach" });
    const normalizedSearch = normalizeSearchText("black beach");

    expect(strategy.matches(beach, normalizedSearch, null)).toEqual({
      matches: true,
      score: 400,
      matchType: "word-match-name",
    });
  });

  it("matches when all search words match in the city or state name", () => {
    const beach = makeBeach({ name: "Tourmaline", city: "San Diego", state: "California" });
    const normalizedSearch = normalizeSearchText("san diego");

    expect(strategy.matches(beach, normalizedSearch, null)).toEqual({
      matches: true,
      score: 300,
      matchType: "word-match-city",
    });
  });
});





