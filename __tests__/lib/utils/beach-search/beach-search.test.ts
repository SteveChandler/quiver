import { AliasMatchStrategy } from "@/lib/utils/beach-search/strategies";
import { ExactMatchStrategy } from "@/lib/utils/beach-search/strategies";
import { SubstringMatchStrategy } from "@/lib/utils/beach-search/strategies";
import { WordMatchStrategy } from "@/lib/utils/beach-search/strategies";
import { BeachRelevanceScorer } from "@/lib/utils/beach-search/beach-relevance-scorer";
import { normalizeSearchText } from "@/lib/utils/text-normalization";
import type { ScoredBeach } from "@/lib/utils/beach-search/beach-relevance-scorer";
import { makeBeach } from "../../../fixtures/beach-search-fixtures";

describe("AliasMatchStrategy", () => {
  const strategy = new AliasMatchStrategy();

  it("returns no match when aliasTarget is null", () => {
    const beach = makeBeach({ name: "Pacific Beach" });
    expect(strategy.matches(beach, "pb", null)).toEqual({ matches: false, score: 0 });
  });

  it("matches exact alias target (alias-exact)", () => {
    const beach = makeBeach({ name: "Pacific Beach" });
    expect(strategy.matches(beach, "pb", "pacific beach")).toEqual({
      matches: true,
      score: 900,
      matchType: "alias-exact",
    });
  });

  it("matches beach names that start with alias target (alias-prefix)", () => {
    const beach = makeBeach({ name: "Pacific Beach Pier" });
    expect(strategy.matches(beach, "pb", "pacific beach")).toEqual({
      matches: true,
      score: 850,
      matchType: "alias-prefix",
    });
  });

  it("matches when alias target starts with beach name (alias-contains)", () => {
    const beach = makeBeach({ name: "Pacific" });
    expect(strategy.matches(beach, "pb", "pacific beach")).toEqual({
      matches: true,
      score: 800,
      matchType: "alias-contains",
    });
  });
});

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

describe("BeachRelevanceScorer", () => {
  it("applies exact + includes boosts and a length penalty deterministically", () => {
    const normalizedSearch = normalizeSearchText("Black's Beach");
    const scorer = new BeachRelevanceScorer(normalizedSearch, null);

    const beach = makeBeach({ name: "Blacks Beach" });
    const scored = scorer.score(beach, "exact-name", 1000);

    const normalizedName = normalizeSearchText(beach.name);
    const expected =
      1000 +
      1000 + // exact match boost
      500 - // name includes boost
      normalizedName.length; // length penalty

    expect(scored.score).toBe(expected);
    expect(scored.matchType).toBe("exact-name");
    expect(scored.normalizedName).toBe(normalizedName);
  });

  it("applies alias bonus when aliasTarget matches", () => {
    const scorerWithAlias = new BeachRelevanceScorer("pb", "pacific beach");
    const scorerWithoutAlias = new BeachRelevanceScorer("pb", null);

    const beach = makeBeach({ name: "Pacific Beach" });
    const withAlias = scorerWithAlias.score(beach, "alias-exact", 900);
    const withoutAlias = scorerWithoutAlias.score(beach, "alias-exact", 900);

    expect(withAlias.score).toBeGreaterThan(withoutAlias.score);
    expect(withAlias.score - withoutAlias.score).toBe(300);
  });

  it("sorts by score desc, then by normalized name length asc", () => {
    const short = makeBeach({ id: "short", name: "PB" });
    const long = makeBeach({ id: "long", name: "Pacific Beach" });

    const scored: ScoredBeach[] = [
      {
        beach: long,
        score: 100,
        matchType: "test",
        normalizedName: normalizeSearchText(long.name),
        normalizedLocation: normalizeSearchText(long.city || ""),
      },
      {
        beach: short,
        score: 100,
        matchType: "test",
        normalizedName: normalizeSearchText(short.name),
        normalizedLocation: normalizeSearchText(short.city || ""),
      },
    ];

    expect(BeachRelevanceScorer.sort(scored).map((b) => b.id)).toEqual([
      "short",
      "long",
    ]);
  });
});
