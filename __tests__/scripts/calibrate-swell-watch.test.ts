import {
  calibrateFixturePolicy,
  calibrateSwellWatch,
  type CalibrationCorpus,
} from "@/scripts/calibrate-swell-watch";
import {
  calculateSwellWatchPolicyHash,
  validateProductionPolicyAuthority,
  verifySwellWatchPolicy,
  type SwellWatchPolicy,
} from "@/lib/alerts/swell-watch/policy";
import { readFileSync } from "node:fs";
import { join } from "node:path";

function provisionalPolicy(): SwellWatchPolicy {
  return JSON.parse(
    readFileSync(
      join(
        process.cwd(),
        "__tests__/fixtures/swell-watch-provisional-policy.json",
      ),
      "utf8",
    ),
  ) as SwellWatchPolicy;
}

function rehash(
  policy: Omit<SwellWatchPolicy, "value_hash">,
): SwellWatchPolicy {
  return {
    ...policy,
    value_hash: calculateSwellWatchPolicyHash(policy),
  };
}

const blockedCorpus: CalibrationCorpus = {
  rows: [
    {
      schema_version: "swell-watch-shadow-corpus.v1",
      dataset_hash: "fixture-only",
      window_start: "2026-08-01T00:00:00.000Z",
      window_end: "2026-08-31T23:59:59.999Z",
      observed_at: "2026-08-01T00:00:00.000Z",
      forecast_region_id: "region-a",
      beach_pseudonym: "beach-pseudonym-a",
      provider: "noaa",
      source_slot: "primary",
      evaluation_id: "fixture-evaluation-a",
      evaluation_reason: "available",
      issued_at: "2026-08-01T00:00:00.000Z",
      issuance_reason: "available",
      forecast_at: "2026-08-04T00:00:00.000Z",
      primary_height_ft: 4,
      primary_period_s: 12,
      primary_direction_deg: 280,
      secondary_height_ft: null,
      secondary_period_s: null,
      secondary_direction_deg: null,
      seam_bucket: "72h",
      outcome: "candidate",
      outcome_reason: "available",
      audience_evaluated: null,
      audience_reason: "audience_unavailable",
      recipient_count: 0,
      projected_send_count: 0,
      delivery_outcome: null,
      delivery_outcome_reason: "delivery_outcome_unavailable",
      provenance: "fixture",
    },
  ],
  manifest: {
    status: "blocked",
    corpus_hash: "fixture-only",
    coverage: {
      eligible_for_calibration: false,
      fixture_rows_present: true,
      assertions: { no_fixture_or_replay_evidence: false },
    },
  },
};

describe("swell-watch calibration", () => {
  it("binds the approved rolling window to v2 without rewriting historical v1", () => {
    const historical = provisionalPolicy();
    const policy = rehash({ ...historical, schema_version: "swell-watch-policy.v2", provenance: "pending_review",
      policy_values: { ...historical.policy_values, volume_caps: { ...historical.policy_values.volume_caps, projected_send_window_hours: 24 } } });
    expect(verifySwellWatchPolicy(historical)).toBe(true);
    expect(historical.value_hash).toBe("9a278ceca6c2fde80358e19258e2f6118e564735b8eb762266bd682c494df2ad");
    expect(verifySwellWatchPolicy(policy)).toBe(true);
    expect(policy.value_hash).not.toBe(historical.value_hash);
    for (const hours of [undefined, null, 0, 12, 48, "24"]) {
      const changed = { ...policy, policy_values: { ...policy.policy_values, volume_caps: { ...policy.policy_values.volume_caps, projected_send_window_hours: hours } } } as SwellWatchPolicy;
      expect(calculateSwellWatchPolicyHash(changed)).not.toBe(policy.value_hash);
      expect(verifySwellWatchPolicy(rehash(changed))).toBe(false);
    }
    expect(verifySwellWatchPolicy(rehash({ ...policy, schema_version: "swell-watch-policy.v1" }))).toBe(false);
  });

  it("emits deterministic provisional fixture policy without claiming production approval", () => {
    const policy = provisionalPolicy();

    expect(calibrateFixturePolicy(policy)).toEqual({
      status: "provisional_fixture",
      profile_id: "swell-watch-provisional-fixture.v1",
      policy_hash:
        "9a278ceca6c2fde80358e19258e2f6118e564735b8eb762266bd682c494df2ad",
      production_approved: false,
      reviewer: null,
      limitations: [
        "fixture values are deterministic test inputs, not observed safe thresholds",
      ],
    });
    expect(calibrateFixturePolicy(policy)).toEqual(
      calibrateFixturePolicy(policy),
    );
  });

  it("rejects a fully bound legacy production policy without a defined send window", () => {
    const policy = rehash({ ...provisionalPolicy(), provenance: "production_approved", approval_evidence: {
      approval_id: "fixture-approval", evidence_hash: "a".repeat(64), reviewer: "fixture-reviewer", reviewed_at: "2026-09-03T00:00:00.000Z",
    } });
    expect(verifySwellWatchPolicy(policy)).toBe(true);
    expect(validateProductionPolicyAuthority(policy, {
      policy_hash: policy.value_hash, approval_id: "fixture-approval", approval_evidence_hash: "a".repeat(64),
      reviewer: "fixture-reviewer", production_scope: "swell_watch_push", authority_epoch: 1,
      not_before: "2026-09-03T00:00:00.000Z", expires_at: "2026-09-05T00:00:00.000Z",
    }, { now: new Date("2026-09-04T00:00:00.000Z") })).toEqual({
      authorized: false, reason: "production policy requires the approved rolling 24-hour send window",
    });
  });

  it("rejects malformed values even after recomputing their hashes", () => {
    const policy = provisionalPolicy();
    const negativeCap = rehash({
      ...policy,
      policy_values: {
        ...policy.policy_values,
        volume_caps: {
          ...policy.policy_values.volume_caps,
          maximum_recipients_per_event: -1,
        },
      },
    });
    const invalidWindow = rehash({
      ...policy,
      policy_values: {
        ...policy.policy_values,
        actionability: {
          minimum_days_before_arrival: 1,
          maximum_days_before_arrival: 6,
        },
      },
    });
    const invalidFailureRate = rehash({
      ...policy,
      policy_values: {
        ...policy.policy_values,
        provider_failure_hold: {
          ...policy.policy_values.provider_failure_hold,
          maximum_failure_rate: Number.NaN,
        },
      },
    });
    const invalidEnum = rehash({
      ...policy,
      provenance: "not-a-provenance" as "provisional_fixture",
    });

    expect(verifySwellWatchPolicy(negativeCap)).toBe(false);
    expect(verifySwellWatchPolicy(invalidWindow)).toBe(false);
    expect(verifySwellWatchPolicy(invalidFailureRate)).toBe(false);
    expect(verifySwellWatchPolicy(invalidEnum)).toBe(false);
    expect(() => calibrateFixturePolicy(negativeCap)).toThrow(
      "fixture policy hash is invalid",
    );
    expect(calculateSwellWatchPolicyHash(policy)).toBe(policy.value_hash);
  });

  it("keeps production authorization fail-closed without an independently loaded approval", () => {
    const policy = provisionalPolicy();
    const forgedProduction = rehash({
      ...policy,
      provenance: "production_approved",
      approval_evidence: {
        approval_id: "fabricated-approval",
        evidence_hash: "a".repeat(64),
        reviewer: "fabricated-reviewer",
        reviewed_at: "2026-09-03T00:00:00.000Z",
      },
    });

    expect(verifySwellWatchPolicy(forgedProduction)).toBe(true);
    expect(
      validateProductionPolicyAuthority(forgedProduction, {
        armed: true,
        policy_hash: forgedProduction.value_hash,
        trusted_policy_hash: forgedProduction.value_hash,
        approval_id: "fabricated-approval",
        approval_evidence_hash: "a".repeat(64),
      }),
    ).toEqual({
      authorized: false,
      reason:
        "independently trusted production approval is unavailable until Plan 06",
    });
    for (const authority of [
      null,
      {
        armed: true,
        policy_hash: "stale",
        trusted_policy_hash: "mismatch",
        approval_id: "missing",
        approval_evidence_hash: "missing",
      },
    ]) {
      expect(
        validateProductionPolicyAuthority(forgedProduction, authority),
      ).toEqual({
        authorized: false,
        reason:
          "independently trusted production approval is unavailable until Plan 06",
      });
    }
  });

  it("fails closed without an approved, coverage-complete retained corpus", () => {
    expect(calibrateSwellWatch(blockedCorpus)).toEqual({
      status: "blocked",
      corpus_hash: "fixture-only",
      profile: null,
      profile_hash: null,
      blockers: ["manifest coverage is not eligible for calibration"],
    });
  });

  it("does not emit a profile from fixture or incomplete manifest data", () => {
    const incompleteManifest = {
      ...blockedCorpus,
      manifest: {
        ...blockedCorpus.manifest,
        status: "ready" as const,
        coverage: {
          eligible_for_calibration: false,
          fixture_rows_present: false,
          assertions: { retained_days_at_least_30: false },
        },
      },
    };

    expect(calibrateSwellWatch(incompleteManifest).profile).toBeNull();
    expect(calibrateSwellWatch(incompleteManifest).profile_hash).toBeNull();
  });

  it("rejects a mismatched artifact hash without emitting an output profile", () => {
    const tamperedManifest = {
      ...blockedCorpus,
      manifest: {
        ...blockedCorpus.manifest,
        status: "ready" as const,
        corpus_hash: "different-artifact",
        coverage: {
          eligible_for_calibration: true,
          fixture_rows_present: false,
          assertions: { retained_days_at_least_30: true },
        },
      },
    };

    expect(calibrateSwellWatch(tamperedManifest)).toMatchObject({
      status: "blocked",
      profile: null,
      profile_hash: null,
      blockers: expect.arrayContaining([
        "manifest corpus hash does not match sanitized rows",
      ]),
    });
  });
});
