import { BeachRelevanceScorer } from "@/lib/utils/beach-search/beach-relevance-scorer";
import { normalizeSearchText } from "@/lib/utils/text-normalization";
import type { ScoredBeach } from "@/lib/utils/beach-search/beach-relevance-scorer";
import { makeBeach } from "../../../fixtures/beach-search-fixtures";

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






