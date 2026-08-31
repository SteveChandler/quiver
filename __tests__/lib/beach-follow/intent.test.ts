import {
  SURF_SPECIFIC_SIGNAL_THRESHOLD,
  qualifyBeachIntent,
} from "@/lib/beach-follow/intent";

describe("beach-follow intent qualification", () => {
  it("keeps utility-only traffic unknown", () => {
    expect(
      qualifyBeachIntent(null, {
        utilityPageViewCount: 3,
        surfSpecificSignalCount: 0,
      })
    ).toEqual({
      state: "unknown",
      intent: null,
      evidenceSource: "utility_page",
      reason: "utility_only",
    });
  });

  it("does not infer surfing from one surf-specific page", () => {
    expect(
      qualifyBeachIntent(null, {
        utilityPageViewCount: 0,
        surfSpecificSignalCount: SURF_SPECIFIC_SIGNAL_THRESHOLD - 1,
      })
    ).toEqual({
      state: "unknown",
      intent: null,
      evidenceSource: "surf_specific_signals",
      reason: "insufficient_surf_signals",
    });
  });

  it("infers surfing from multiple surf-specific signals", () => {
    expect(
      qualifyBeachIntent(null, {
        utilityPageViewCount: 1,
        surfSpecificSignalCount: SURF_SPECIFIC_SIGNAL_THRESHOLD,
      })
    ).toEqual({
      state: "inferred",
      intent: "surfing",
      evidenceSource: "surf_specific_signals",
      reason: "multiple_surf_signals",
    });
  });

  it.each([
    ["spotComparison", "spot_comparison"],
    ["detailedSwellWindTideOpen", "detailed_surf_conditions"],
    ["surfAlertSaved", "surf_alert_saved"],
    ["exactSurfWindowHandoff", "exact_surf_window_handoff"],
  ] as const)("infers surfing from high-intent action %s", (flag, source) => {
    expect(
      qualifyBeachIntent(null, {
        utilityPageViewCount: 0,
        surfSpecificSignalCount: 0,
        [flag]: true,
      })
    ).toEqual({
      state: "inferred",
      intent: "surfing",
      evidenceSource: source,
      reason: "high_intent_action",
    });
  });

  it("records explicit surfing", () => {
    expect(
      qualifyBeachIntent("surfing", {
        utilityPageViewCount: 0,
        surfSpecificSignalCount: 0,
      })
    ).toEqual({
      state: "explicit",
      intent: "surfing",
      evidenceSource: "explicit_choice",
      reason: "explicit_surfing",
    });
  });

  it("keeps explicit non-surf intent instead of defaulting to surf", () => {
    const result = qualifyBeachIntent("swimming", {
      utilityPageViewCount: 0,
      surfSpecificSignalCount: 0,
    });

    expect(result).toEqual({
      state: "explicit",
      intent: "swimming",
      evidenceSource: "explicit_choice",
      reason: "explicit_non_surf",
    });
    expect(result.intent).not.toBe("surfing");
  });

  it("lets an explicit non-surf choice override inferred surf evidence", () => {
    expect(
      qualifyBeachIntent("fishing", {
        utilityPageViewCount: 0,
        surfSpecificSignalCount: 10,
        surfAlertSaved: true,
      })
    ).toMatchObject({
      state: "explicit",
      intent: "fishing",
      evidenceSource: "explicit_choice",
      reason: "explicit_non_surf",
    });
  });

  it.each([
    "not-a-beach-intent",
    "surfer@example.com",
    "Bearer secret-token",
  ])("ignores invalid explicit choice %s and continues inference", (choice) => {
    const result = qualifyBeachIntent(choice, {
      utilityPageViewCount: 0,
      surfSpecificSignalCount: SURF_SPECIFIC_SIGNAL_THRESHOLD,
    });

    expect(result).toEqual({
      state: "inferred",
      intent: "surfing",
      evidenceSource: "surf_specific_signals",
      reason: "multiple_surf_signals",
    });
    expect(JSON.stringify(result)).not.toContain(choice);
  });

  it("returns unknown when there is no evidence", () => {
    expect(
      qualifyBeachIntent(null, {
        utilityPageViewCount: 0,
        surfSpecificSignalCount: 0,
      })
    ).toEqual({
      state: "unknown",
      intent: null,
      evidenceSource: "none",
      reason: "no_evidence",
    });
  });
});
