import { SubstringMatchStrategy } from "@/lib/utils/beach-search/strategies";
import { normalizeSearchText } from "@/lib/utils/text-normalization";
import { makeBeach } from "../../../fixtures/beach-search-fixtures";

describe("SubstringMatchStrategy", () => {
  const strategy = new SubstringMatchStrategy();

  it("returns no match for empty search", () => {
    const beach = makeBeach({ name: "Scripps Pier" });
    expect(strategy.matches(beach, "", null)).toEqual({ matches: false, score: 0 });
  });

  it("matches when search is a substring of beach name", () => {
    const beach = makeBeach({ name: "Scripps Pier" });
    const normalizedSearch = normalizeSearchText("scripps");

    expect(strategy.matches(beach, normalizedSearch, null)).toEqual({
      matches: true,
      score: 700,
      matchType: "substring-name",
    });
  });

  it("matches when search is a substring of city or state", () => {
    const beach = makeBeach({ name: "Tourmaline", city: "San Diego", state: "CA" });
    const normalizedSearch = normalizeSearchText("diego");

    expect(strategy.matches(beach, normalizedSearch, null)).toEqual({
      matches: true,
      score: 600,
      matchType: "substring-city",
    });
  });

  it("matches when beach name is contained in search (reverse substring)", () => {
    const beach = makeBeach({ name: "Blacks Beach" });
    const normalizedSearch = normalizeSearchText("Blacks Beach San Diego");

    expect(strategy.matches(beach, normalizedSearch, null)).toEqual({
      matches: true,
      score: 500,
      matchType: "substring-reverse",
    });
  });
});




