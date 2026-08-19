import { buildHomeMorningCallPresentation, normalizeForecastPeriod } from "@/lib/notifications/home-morning-call-presentation";
import type { CanonicalSessionDecision } from "@/lib/recommendations/canonical-decision/types";

const decision = (
  verdict: CanonicalSessionDecision["verdict"],
  effects: CanonicalSessionDecision["effects"] = [],
): CanonicalSessionDecision => ({
  schemaVersion: "canonical-session-decision.v1",
  engineVersion: "rules.v1",
  decisionId: "a".repeat(64),
  createdAt: "2026-08-18T12:00:00.000Z",
  expiresAt: "2026-08-18T13:00:00.000Z",
  scope: { kind: "plan_next_session", windowStart: "2026-08-18T12:00:00.000Z", windowEnd: "2026-08-18T14:00:00.000Z", timezone: "UTC" },
  verdict,
  decisionBasis: "physical_fallback",
  reasonCode: verdict === "go" ? "selected_go" : verdict === "maybe" ? "selected_maybe" : "selected_no",
  selection: null,
  skillEligibility: { skill: "unknown", state: "insufficient_safety_data", reasonCodes: [] },
  holdEpoch: "test",
  effects,
});

describe("home morning call presentation", () => {
  it("normalizes all supported period forms", () => {
    expect(normalizeForecastPeriod("14")).toBe("14s");
    expect(normalizeForecastPeriod("14s")).toBe("14s");
    expect(normalizeForecastPeriod("14ss")).toBe("14s");
  });

  it("derives MAYBE copy from canonical effects, never warning text", () => {
    const output = buildHomeMorningCallPresentation(
      decision("maybe", [{ code: "crossing_swells", severity: "material", verdictCeiling: 65, message: "Crossing swells creating choppy conditions" }]),
      "Terramar Point",
      { wave_height: "2.5 ft", wave_period: "14ss" } as never,
    );
    expect(output.title).toBe("Terramar Point: Worth a look");
    expect(output.label).toBe("Maybe");
    expect(output.body).toContain("2.5 ft @ 14s");
    expect(output.body).toContain("Crossing swells creating choppy conditions");
  });

  it("keeps GO and NO presentation owned by the canonical verdict", () => {
    const forecast = { wave_height: "3 ft", wave_period: "14s" } as never;
    expect(buildHomeMorningCallPresentation(decision("go"), "Terramar Point", forecast)).toMatchObject({
      title: "Terramar Point: It's firing",
      label: "Worth it",
    });
    expect(buildHomeMorningCallPresentation(decision("no"), "Terramar Point", forecast)).toMatchObject({
      title: "Terramar Point: Rest up today",
      label: "Skip",
    });
  });
});
