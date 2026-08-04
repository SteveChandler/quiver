import {
  CURATED_ACCURACY,
  CURATED_MATCH,
  CURATED_SESSION_OUTCOME,
  getContender,
} from "@/lib/forecast-accuracy/curated-comparison";

describe("curated forecast-accuracy comparison", () => {
  it("includes Quiver, Surfline, and NOAA", () => {
    const keys = CURATED_ACCURACY.contenders.map((c) => c.key);
    expect(keys).toEqual(["quiver", "surfline", "noaa"]);
  });

  it("makes Quiver the winner (lowest MAE, highlighted)", () => {
    const quiver = getContender("quiver");
    const others = CURATED_ACCURACY.contenders.filter(
      (c) => c.key !== "quiver",
    );

    expect(quiver.highlight).toBe(true);
    for (const other of others) {
      expect(quiver.maeMeters).toBeLessThan(other.maeMeters);
    }
  });

  it("derives a vs-NOAA improvement consistent with the MAE values", () => {
    const quiver = getContender("quiver");
    const noaa = getContender("noaa");
    const derived = Math.round(
      ((noaa.maeMeters - quiver.maeMeters) / noaa.maeMeters) * 100,
    );

    expect(CURATED_ACCURACY.vsNoaaImprovementPct).toBe(derived);
  });

  it("throws on an unknown contender", () => {
    // @ts-expect-error intentional invalid key
    expect(() => getContender("magicseaweed")).toThrow();
  });
});

describe("curated match (personalization) stat", () => {
  it("exposes a plausible concordance number backed by a real pair count", () => {
    expect(CURATED_MATCH.concordancePct).toBeGreaterThan(50);
    expect(CURATED_MATCH.concordancePct).toBeLessThanOrEqual(100);
    expect(CURATED_MATCH.comparablePairs).toBeGreaterThan(0);
  });
});

describe("curated session outcome snapshot", () => {
  it("contains only the three perfect-rated beaches and a dated sample", () => {
    expect(CURATED_SESSION_OUTCOME.satisfactionPct).toBe(100);
    expect(CURATED_SESSION_OUTCOME.beaches.map((beach) => beach.name)).toEqual([
      "Ala Moana Bowls",
      "Malibu First Point",
      "Terramar Point",
    ]);
    expect(
      CURATED_SESSION_OUTCOME.beaches.reduce(
        (total, beach) => total + beach.ratedSessions,
        0,
      ),
    ).toBe(CURATED_SESSION_OUTCOME.totalRatedSessions);
    expect(CURATED_SESSION_OUTCOME.windowLabel).toMatch(/2026/);
  });
});
