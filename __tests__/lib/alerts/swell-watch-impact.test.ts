import fixturePolicy from "@/__tests__/fixtures/swell-watch-provisional-policy.json";
import { evaluateSwellWatchImpact } from "@/lib/alerts/swell-watch/impact-evaluator";
import type { SwellPartitionObservation } from "@/lib/alerts/swell-watch/partition-normalizer";
import { calculateSwellWatchPolicyHash, validateProductionPolicyAuthority, type SwellWatchPolicy } from "@/lib/alerts/swell-watch/policy";

const policy = fixturePolicy as SwellWatchPolicy;
const partition: SwellPartitionObservation = {
  provider: "open_meteo",
  evaluationId: "fixture-evaluation-one",
  forecastAt: "2026-09-06T12:00:00.000Z",
  sourceSlot: "s2",
  heightM: 1,
  periodS: 13,
  directionDeg: 359,
  completeness: "complete",
};

function evaluate(
  overrides: Partial<Parameters<typeof evaluateSwellWatchImpact>[0]> = {},
) {
  return evaluateSwellWatchImpact({
    partition,
    baselineHeightFt: 1.5,
    baselineEnergy: 13,
    arrivalAt: "2026-09-06T12:00:00.000Z",
    now: new Date("2026-09-03T12:00:00.000Z"),
    beach: { swell_window_center_deg: 1, swell_window_halfwidth_deg: 30 },
    policy,
    seamContinuous: true,
    sourceCoherent: true,
    ...overrides,
  });
}

describe("evaluateSwellWatchImpact", () => {
  it("calculates under a hash-bound v2 policy without treating calculation as send approval", () => {
    const reviewed: SwellWatchPolicy = { ...policy, schema_version: "swell-watch-policy.v2", provenance: "production_approved",
      policy_values: { ...policy.policy_values, volume_caps: { ...policy.policy_values.volume_caps, projected_send_window_hours: 24 } },
      approval_evidence: { approval_id: "fixture-only", evidence_hash: "a".repeat(64), reviewer: "fixture-only", reviewed_at: "2026-09-03T00:00:00.000Z" } };
    reviewed.value_hash = calculateSwellWatchPolicyHash(reviewed);
    expect(evaluate({ policy: reviewed })).toMatchObject({ kind: "candidate", policyHash: reviewed.value_hash });
    expect(validateProductionPolicyAuthority(reviewed, null)).toMatchObject({ authorized: false });
    const strict = { ...reviewed, policy_values: { ...reviewed.policy_values, local_significance: { ...reviewed.policy_values.local_significance, minimum_height_rise_ft: 100 } } };
    expect(evaluate({ policy: strict })).toEqual({ kind: "suppressed", reason: "invalid_provisional_policy" });
    strict.value_hash = calculateSwellWatchPolicyHash(strict);
    expect(evaluate({ policy: strict })).toEqual({ kind: "suppressed", reason: "low_significance" });
    const pending = { ...reviewed, provenance: "pending_review" as const };
    pending.value_hash = calculateSwellWatchPolicyHash(pending);
    expect(evaluate({ policy: pending })).toEqual({ kind: "suppressed", reason: "invalid_provisional_policy" });
  });

  it("uses beach-relative rise, energy, exposure, and decomposed projection", () => {
    expect(evaluate()).toMatchObject({
      kind: "candidate",
      policyId: "swell-watch-provisional-fixture.v1",
      policyHash:
        "9a278ceca6c2fde80358e19258e2f6118e564735b8eb762266bd682c494df2ad",
    });
    expect(
      evaluate({
        beach: { swell_window_center_deg: 180, swell_window_halfwidth_deg: 10 },
      }),
    ).toEqual({ kind: "suppressed", reason: "non_impactful" });
  });

  it("fails closed for data discontinuity, contradiction, significance, and window boundaries", () => {
    expect(evaluate({ partition: null })).toEqual({
      kind: "suppressed",
      reason: "incomplete_partition",
    });
    expect(evaluate({ seamContinuous: false })).toEqual({
      kind: "suppressed",
      reason: "seam_discontinuous",
    });
    expect(evaluate({ sourceCoherent: false })).toEqual({
      kind: "suppressed",
      reason: "source_contradiction",
    });
    expect(evaluate({ baselineHeightFt: 3.5, baselineEnergy: 500 })).toEqual({
      kind: "suppressed",
      reason: "low_significance",
    });
    expect(evaluate({ arrivalAt: "2026-09-05T11:59:59.000Z" })).toEqual({
      kind: "suppressed",
      reason: "not_actionable",
    });
    expect(evaluate({ arrivalAt: "2026-09-08T12:00:01.000Z" })).toEqual({
      kind: "suppressed",
      reason: "not_actionable",
    });
  });

  it("does not silently accept a production or forged fixture policy", () => {
    expect(
      evaluate({ policy: { ...policy, provenance: "production_approved" } }),
    ).toEqual({ kind: "suppressed", reason: "invalid_provisional_policy" });
  });

  it("rejects non-finite baseline and malformed partition values", () => {
    expect(evaluate({ now: new Date("invalid") })).toEqual({ kind: "suppressed", reason: "not_actionable" });
    expect(evaluate({ baselineHeightFt: Number.NaN })).toEqual({
      kind: "suppressed",
      reason: "incomplete_partition",
    });
    expect(
      evaluate({ partition: { ...partition, directionDeg: 360 } }),
    ).toEqual({ kind: "suppressed", reason: "incomplete_partition" });
  });
});
