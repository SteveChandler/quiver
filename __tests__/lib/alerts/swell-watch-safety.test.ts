import fixturePolicy from "@/__tests__/fixtures/swell-watch-provisional-policy.json";
import {
  calculateSwellWatchPolicyHash,
  type SwellWatchPolicy,
} from "@/lib/alerts/swell-watch/policy";
import {
  evaluateSwellWatchHolds,
  resolveSwellWatchControl,
  validateSwellWatchRelease,
  type SwellWatchSafetyStore,
} from "@/lib/alerts/swell-watch/safety-control";

const NOW = new Date("2026-09-04T12:00:00.000Z");

function productionPolicy(): SwellWatchPolicy {
  const policy: SwellWatchPolicy = {
    ...(fixturePolicy as SwellWatchPolicy),
    schema_version: "swell-watch-policy.v2",
    policy_values: { ...fixturePolicy.policy_values, volume_caps: { ...fixturePolicy.policy_values.volume_caps, projected_send_window_hours: 24 } },
    provenance: "production_approved",
    approval_evidence: {
      approval_id: "approval-1",
      evidence_hash: "e".repeat(64),
      reviewer: "reviewer-1",
      reviewed_at: "2026-09-03T12:00:00.000Z",
    },
    value_hash: "",
  };
  return {
    ...policy,
    value_hash: calculateSwellWatchPolicyHash(policy),
  };
}

function trustedStore(overrides: Partial<SwellWatchSafetyStore> = {}): {
  store: SwellWatchSafetyStore;
  transition: jest.Mock;
} {
  const policy = productionPolicy();
  const transition = jest.fn(async () => ({
    state: "held" as const,
    epoch: 2,
    reasonCode: "candidate_cap_exceeded",
  }));
  return {
    transition,
    store: {
      getControl: async () => ({
        state: "armed",
        epoch: 1,
        reasonCode: "operator_arm",
      }),
      getAuthority: async () => ({
        policyHash: policy.value_hash,
        approvalEvidenceHash: policy.approval_evidence?.evidence_hash ?? "",
        productionScope: "swell_watch_push",
        reviewer: "reviewer-1",
        notBefore: "2026-09-04T11:00:00.000Z",
        expiresAt: "2026-09-05T12:00:00.000Z",
        authorityEpoch: 1,
        revokedAt: null,
        supersededAt: null,
        approvalId: "approval-1",
      }),
      transition,
      ...overrides,
    },
  };
}

describe("swell watch safety control", () => {
  it("fails closed for a missing static enablement, control, or server authority", async () => {
    const policy = productionPolicy();
    const { store } = trustedStore({ getControl: async () => null });

    await expect(
      resolveSwellWatchControl({
        policy,
        staticEnabled: true,
        store,
        now: NOW,
      }),
    ).resolves.toMatchObject({ allowed: false, reasonCode: "control_unavailable" });

    const trusted = trustedStore();
    await expect(
      resolveSwellWatchControl({
        policy,
        staticEnabled: false,
        store: trusted.store,
        now: NOW,
      }),
    ).resolves.toMatchObject({ allowed: false, reasonCode: "static_disabled" });

    await expect(
      resolveSwellWatchControl({
        policy,
        staticEnabled: true,
        store: trustedStore({ getAuthority: async () => null }).store,
        now: NOW,
      }),
    ).resolves.toMatchObject({ allowed: false, reasonCode: "authority_unavailable" });
  });

  it("accepts only a valid server-loaded production authority at producer and release boundaries", async () => {
    const policy = productionPolicy();
    const { store } = trustedStore();

    await expect(
      resolveSwellWatchControl({ policy, staticEnabled: true, store, now: NOW }),
    ).resolves.toMatchObject({ allowed: true, epoch: 1 });
    await expect(
      validateSwellWatchRelease({
        policy,
        staticEnabled: true,
        store,
        now: NOW,
        event: { stable: true, actionable: true, forecastAt: "2026-09-04T10:00:00.000Z" },
        recipient: {
          relationshipActive: true,
          preferencesEnabled: true,
          activeDevice: true,
          dedupeAvailable: true,
        },
      }),
    ).resolves.toMatchObject({ allowed: true, epoch: 1 });
  });

  it("does not allow fixture, forged, stale, hash-mismatched, or revoked authority", async () => {
    const policy = productionPolicy();
    const cases: Array<[string, SwellWatchPolicy, Partial<SwellWatchSafetyStore>]> = [
      ["fixture", fixturePolicy as SwellWatchPolicy, {}],
      ["mismatch", policy, { getAuthority: async () => ({ ...((await trustedStore().store.getAuthority())!), policyHash: "f".repeat(64) }) }],
      ["expired", policy, { getAuthority: async () => ({ ...((await trustedStore().store.getAuthority())!), expiresAt: "2026-09-04T11:00:00.000Z" }) }],
      ["revoked", policy, { getAuthority: async () => ({ ...((await trustedStore().store.getAuthority())!), revokedAt: "2026-09-04T11:00:00.000Z" }) }],
    ];

    for (const [label, candidate, overrides] of cases) {
      const { store } = trustedStore(overrides);
      await expect(
        resolveSwellWatchControl({
          policy: candidate,
          staticEnabled: true,
          store,
          now: NOW,
        }),
      ).resolves.toMatchObject({ allowed: false, reasonCode: expect.any(String) });
    }
  });

  it("atomically holds threshold and continuity failures without exposing raw inputs", async () => {
    const { store, transition } = trustedStore();

    await expect(
      evaluateSwellWatchHolds({
        policy: productionPolicy(),
        store,
        expectedEpoch: 1,
        idempotencyKey: "hold-1",
        candidateCount: 51,
        recipientCount: 0,
        projectedSendCount: 0,
        hasDiscontinuousData: false,
        hasMaterialDisagreement: false,
        stale: false,
        providerFailures: { samples: 20, failures: 1 },
      }),
    ).resolves.toMatchObject({ held: true, reasonCode: "candidate_cap_exceeded" });
    expect(transition).toHaveBeenCalledWith(
      expect.objectContaining({ expectedEpoch: 1, reasonCode: "candidate_cap_exceeded" }),
    );
    expect(transition.mock.calls[0][0]).not.toHaveProperty("tokens");
  });

  it("uses validated policy values and a named system actor for automatic holds", async () => {
    const { store, transition } = trustedStore();
    const policy = productionPolicy();
    policy.policy_values.volume_caps.maximum_candidates_per_region = 1;
    policy.value_hash = calculateSwellWatchPolicyHash(policy);

    await expect(
      evaluateSwellWatchHolds({
        policy,
        store,
        expectedEpoch: 1,
        idempotencyKey: "hold-policy-values-1",
        candidateCount: 2,
        recipientCount: 0,
        projectedSendCount: 0,
        hasDiscontinuousData: false,
        hasMaterialDisagreement: false,
        stale: false,
        providerFailures: { samples: 0, failures: 0 },
      }),
    ).resolves.toMatchObject({ held: true, reasonCode: "candidate_cap_exceeded" });
    expect(transition).toHaveBeenCalledWith(expect.objectContaining({
      operatorUserId: undefined,
      systemActor: "swell_watch_provider_monitor",
    }));
  });

  it.each([
    { projectedSendCount: null }, { providerFailures: null },
    { projectedSendCount: null, providerFailures: null },
  ])("holds live processing when runtime metrics are missing: %p", async (missing) => {
    const { store, transition } = trustedStore();
    const input = { policy: productionPolicy(), store, expectedEpoch: 1, idempotencyKey: "missing-metric",
      candidateCount: 0, recipientCount: 0, projectedSendCount: 0, hasDiscontinuousData: false,
      hasMaterialDisagreement: false, stale: false, providerFailures: { samples: 0, failures: 0 }, ...missing };
    await expect(evaluateSwellWatchHolds(input as unknown as Parameters<typeof evaluateSwellWatchHolds>[0]))
      .resolves.toEqual({ held: true, reasonCode: "invalid_hold_input" });
    expect(transition).toHaveBeenCalledWith(expect.objectContaining({ operation: "hold", reasonCode: "invalid_hold_input" }));
  });

  it("rejects a post-enqueue revocation and stale release facts", async () => {
    const policy = productionPolicy();
    const { store } = trustedStore({
      getAuthority: async () => ({
        ...((await trustedStore().store.getAuthority())!),
        revokedAt: "2026-09-04T11:30:00.000Z",
      }),
    });
    await expect(
      validateSwellWatchRelease({
        policy,
        staticEnabled: true,
        store,
        now: NOW,
        event: { stable: true, actionable: true, forecastAt: "2026-09-04T01:00:00.000Z" },
        recipient: { relationshipActive: true, preferencesEnabled: true, activeDevice: true, dedupeAvailable: true },
      }),
    ).resolves.toMatchObject({ allowed: false, reasonCode: "authority_revoked" });
  });
});
