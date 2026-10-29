import { getConservativeRecommendation } from "@/lib/analyzers/conditions-analyzer";
import type { ConditionsAnalysis } from "@/types/morning-intel";

const optimal = { status: "optimal", excluded: false } as const;
const conditions = { swell: optimal, wind: optimal, tide: optimal } as unknown as ConditionsAnalysis;

describe("getConservativeRecommendation water quality", () => {
  it.each(["closure", "advisory"])("keeps the conditions call under a water-quality %s; the notice never changes it", (status) => {
    expect(getConservativeRecommendation(conditions, { status })).toEqual(getConservativeRecommendation(conditions));
    expect(getConservativeRecommendation(conditions, { status }).decision).toBe("worth_it");
  });
});
