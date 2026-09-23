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

  it("returns a decision without conditionLabel as the same object", () => {
    const decision = { decisionId: "b".repeat(64) };
    expect(persistableSessionDecision(decision)).toBe(decision);
  });
});
