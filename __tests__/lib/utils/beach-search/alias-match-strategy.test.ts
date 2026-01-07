import { AliasMatchStrategy } from "@/lib/utils/beach-search/strategies";
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




