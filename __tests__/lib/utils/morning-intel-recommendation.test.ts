import { describe, it, expect } from "@jest/globals";
import { getConservativeRecommendation } from "@/lib/utils/morning-intel-utils";
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





