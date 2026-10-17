import { describe, it, expect } from "@jest/globals";
import { analyzeConditions, confidenceHeuristic, getConservativeRecommendation } from "@/lib/utils/morning-intel-utils";
import type { ConditionsAnalysis, ConditionEvaluation } from "@/types/morning-intel";

function evalFor(status: ConditionEvaluation["status"]): ConditionEvaluation {
  return {
    status,
    emoji: status === "optimal" ? "✅" : status === "acceptable" ? "⚠️" : "❌",
    message: "test",
  };
}

function makeConditions(
  swell: ConditionEvaluation["status"],
  wind: ConditionEvaluation["status"],
  tide: ConditionEvaluation["status"]
): ConditionsAnalysis {
  return {
    score: 0,
    swell: evalFor(swell),
    wind: evalFor(wind),
    tide: evalFor(tide),
  };
}

describe("getConservativeRecommendation", () => {
  it("returns worth_it only when all factors are optimal", () => {
    const rec = getConservativeRecommendation(
      makeConditions("optimal", "optimal", "optimal")
    );
    expect(rec.decision).toBe("worth_it");
    expect(rec.label).toBe("Worth it");
  });

  it("returns maybe when there are no poor factors but at least one acceptable", () => {
    const rec = getConservativeRecommendation(
      makeConditions("optimal", "acceptable", "optimal")
    );
    expect(rec.decision).toBe("maybe");
    expect(rec.reasons.join(" ")).toMatch(/wind/);
  });

  it("returns skip when any factor is poor", () => {
    const rec = getConservativeRecommendation(
      makeConditions("optimal", "poor", "acceptable")
    );
    expect(rec.decision).toBe("skip");
    expect(rec.reasons.join(" ")).toMatch(/wind/);
  });
});

describe("unknown wind is neutral", () => {
  const excludedWind: ConditionEvaluation = { status: "acceptable", emoji: "⚠️", message: "", excluded: true };

  it("leaves excluded wind out of the recommendation", () => {
    const rec = getConservativeRecommendation({ ...makeConditions("optimal", "optimal", "optimal"), wind: excludedWind });
    expect(rec).toMatchObject({ decision: "worth_it", reasons: ["all factors line up"] });

    const maybe = getConservativeRecommendation({ ...makeConditions("optimal", "optimal", "acceptable"), wind: excludedWind });
    expect(maybe.reasons).toEqual(["tide"]);
  });

  it("scales the score from the factors it knows", () => {
    const beach = { name: "No orientation" };
    const unknown = analyzeConditions(
      {
        swellDirection: null,
        wind: { speed: 12, direction: 0, cardinal: "N/A", offshore: false, description: "12 mph wind", relation: null },
        tide: { height: 3, direction: "rising" } as never,
      },
      beach
    );
    expect(unknown.wind.excluded).toBe(true);
    // Swell + tide only, scaled back to 10: same as two factors' average over three slots.
    const known = [unknown.swell, unknown.tide].map((e) => ({ optimal: 3.33, acceptable: 1.67, poor: 0 })[e.status]);
    expect(unknown.score).toBe(Math.round(((known[0] + known[1]) * 3) / 2));
  });

  it("missing wind fields do not lower confidence", () => {
    const row = { wave_height: 3, wave_period: 12, swell_height: 3, swell_period: 12, swell_direction: 270 };
    const withWind = [{ ...row, wind_speed: 5, wind_direction: 90 }] as never;
    const withoutWind = [{ ...row, wind_speed: null, wind_direction: null }] as never;
    const tides = [{}] as never;
    expect(confidenceHeuristic(withWind, tides)).toBe("High");
    expect(confidenceHeuristic(withoutWind, tides)).toBe("High");
  });
});
