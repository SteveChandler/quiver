import { persistableSessionDecision } from "@/lib/recommendations/canonical-decision/contract";

describe("persistableSessionDecision", () => {
  it("drops the display-only conditionLabel so strict older readers accept the payload", () => {
    const decision = { decisionId: "a".repeat(64), verdict: "go", conditionLabel: "EPIC" };
    const persisted = persistableSessionDecision(decision);

    expect(persisted).toEqual({ decisionId: "a".repeat(64), verdict: "go" });
    expect("conditionLabel" in (persisted as object)).toBe(false);
    expect(decision.conditionLabel).toBe("EPIC");
  });

  it.each([null, undefined, "not-an-object"])("passes %p through unchanged", (value) => {
    expect(persistableSessionDecision(value)).toBe(value);
  });

  it("returns a decision without new keys unchanged", () => {
    const decision = { decisionId: "b".repeat(64) };
    expect(persistableSessionDecision(decision)).toEqual(decision);
  });

  it("drops personalAdjustmentReason and the nested similarSessionCount", () => {
    const decision = {
      decisionId: "c".repeat(64),
      personalAdjustmentReason: "personal_adjusted_up",
      selection: { evidence: { personalMatch: { label: "GOOD", sessionCount: 30, similarSessionCount: 9 } } },
    };
    expect(persistableSessionDecision(decision)).toEqual({
      decisionId: "c".repeat(64),
      selection: { evidence: { personalMatch: { label: "GOOD", sessionCount: 30 } } },
    });
    expect(decision.selection.evidence.personalMatch.similarSessionCount).toBe(9);
  });
});
