type CanonicalContractModule = {
  parseCanonicalSessionDecision: (value: unknown) => unknown;
};

function loadContract(): CanonicalContractModule {
  return require("@/lib/recommendations/canonical-decision/contract") as CanonicalContractModule;
}

function validDecision(): Record<string, unknown> {
  return {
    schemaVersion: "canonical-session-decision.v1",
    engineVersion: "rules.v1",
    decisionId: "a".repeat(64),
    createdAt: "2026-07-22T18:00:00.000Z",
    expiresAt: "2026-07-22T18:15:00.000Z",
    scope: {
      kind: "plan_next_session",
      windowStart: "2026-07-22T18:00:00.000Z",
      windowEnd: "2026-07-23T18:00:00.000Z",
      timezone: "America/Los_Angeles",
    },
    verdict: "go",
    reasonCode: "selected_go",
    selection: {
      candidateId: "candidate-1",
      beachId: "beach-1",
      beachName: "Safe Beach",
      windowStart: "2026-07-23T14:00:00.000Z",
      windowEnd: "2026-07-23T17:00:00.000Z",
      timezone: "America/Los_Angeles",
      forecastRef: {
        forecastId: "forecast-1",
        beachId: "beach-1",
        forecastAt: "2026-07-23T14:00:00.000Z",
      },
      skillEligibility: {
        skill: "intermediate",
        state: "eligible",
        reasonCodes: [],
      },
    },
    skillEligibility: {
      skill: "intermediate",
      state: "eligible",
      reasonCodes: [],
    },
    holdEpoch: "hold-epoch-1",
  };
}

describe("canonical session decision contract", () => {
  it("rejects confidence, score, and physical forecast values from the client-safe contract", () => {
    const { parseCanonicalSessionDecision } = loadContract();
    const decision = validDecision();
    decision.confidence = 30;
    const selection = decision.selection as Record<string, unknown>;
    selection.utilityScore = 82;
    selection.waveHeight = "3-4 ft";

    expect(() => parseCanonicalSessionDecision(decision)).toThrow();
  });

  it("rejects a verdict whose reason does not match the selected outcome", () => {
    const { parseCanonicalSessionDecision } = loadContract();
    const decision = validDecision();
    decision.verdict = "consider";

    expect(() => parseCanonicalSessionDecision(decision)).toThrow();
  });
});
