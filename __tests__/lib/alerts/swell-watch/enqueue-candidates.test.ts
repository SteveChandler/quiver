/** @jest-environment node */
import { randomUUID } from "node:crypto";
import fixturePolicy from "@/__tests__/fixtures/swell-watch-provisional-policy.json";
import fixture from "@/__tests__/fixtures/swell-watch-v2.json";
import { enqueueAttestedSwellWatchCohort, enqueueSwellWatchCandidates, loadSwellWatchDeliveryHealth } from "@/lib/alerts/swell-watch/enqueue-candidates";
import { ingestAttestedSwellWatchCohort } from "@/lib/alerts/swell-watch/provider-impact-ingestion";
import { createSwellWatchObservability } from "@/lib/alerts/swell-watch/observability";
import { loadSwellWatchAudience } from "@/lib/alerts/swell-watch/audience";
import { loadMatchedSwellWatchHistory } from "@/lib/alerts/swell-watch/persisted-history";
import { parseSwellWatchNotificationPayload } from "@/lib/notifications/types/swell-watch-v2";
import { enqueueNotification } from "@/lib/notifications/enqueue";
import { calculateSwellWatchPolicyHash, type SwellWatchPolicy } from "@/lib/alerts/swell-watch/policy";

jest.mock("@/lib/alerts/swell-watch/audience", () => ({ loadSwellWatchAudience: jest.fn() }));
jest.mock("@/lib/alerts/swell-watch/persisted-history", () => ({ loadMatchedSwellWatchHistory: jest.fn() }));
jest.mock("@/lib/notifications/enqueue", () => ({ enqueueNotification: jest.fn() }));
jest.mock("@/lib/alerts/swell-watch/provider-impact-ingestion", () => ({ ingestAttestedSwellWatchCohort: jest.fn() }));

const audience = jest.mocked(loadSwellWatchAudience);
const enqueue = jest.mocked(enqueueNotification);
const originalFlag = process.env.SWELL_WATCH_PUSH_ENABLED;
const policy: SwellWatchPolicy = { ...fixturePolicy as SwellWatchPolicy, schema_version: "swell-watch-policy.v2",
  policy_values: { ...fixturePolicy.policy_values, volume_caps: { ...fixturePolicy.policy_values.volume_caps, projected_send_window_hours: 24 } },
  provenance: "production_approved", approval_evidence: {
  approval_id: "fixture", evidence_hash: "c".repeat(64), reviewer: "fixture", reviewed_at: new Date().toISOString(),
} };
policy.value_hash = calculateSwellWatchPolicyHash(policy);
const input = (): Parameters<typeof enqueueSwellWatchCandidates>[0] => ({ policy,
  candidates: [{ beachId: fixture.beach_id, regionalEvent: { regionalEventId: fixture.regional_event_id, regionKey: "fixture", status: "stable", evaluationIds: [] }, payload: fixture, projectedImpact: 6, confidence: 0.75 }],
  signals: { hasDiscontinuousData: false, hasMaterialDisagreement: false, stale: false, priorProjectedSendsInWindow: 0, providerFailures: { samples: 0, failures: 0 } },
});
const rpc = jest.fn(async (name: string) => ({ error: null, data: name === "swell_watch_get_production_authority" ? [{
  policy_hash: policy.value_hash, approval_id: "fixture", approval_evidence_hash: "c".repeat(64), reviewer: "fixture", production_scope: "swell_watch_push",
  authority_epoch: 1, not_before: "2000-01-01T00:00:00Z", expires_at: "2100-01-01T00:00:00Z",
}] : [{ state: "armed", epoch: 1, reason_code: "fixture" }] }));
const client = { rpc } as never;

beforeEach(() => {
  process.env.SWELL_WATCH_PUSH_ENABLED = "true";
  jest.clearAllMocks();
  audience.mockResolvedValue([{ recipientUserId: "recipient", beachId: fixture.beach_id, reason: "home" }]);
  enqueue.mockResolvedValue({ enqueued: true, eventId: "queued" });
});
afterEach(() => {
  if (originalFlag === undefined) delete process.env.SWELL_WATCH_PUSH_ENABLED;
  else process.env.SWELL_WATCH_PUSH_ENABLED = originalFlag;
});

it("does no audience reads or writes when disabled", async () => {
  delete process.env.SWELL_WATCH_PUSH_ENABLED;
  expect(await enqueueSwellWatchCandidates(input(), client)).toEqual({ enqueued: 0, duplicates: 0, stoppedReason: "static_disabled" });
  expect(rpc).not.toHaveBeenCalled();
  expect(audience).not.toHaveBeenCalled();
  expect(enqueue).not.toHaveBeenCalled();
});

it("loads ledger counts and rejects missing, malformed or wrong-policy health", async () => {
  const data = { policy_hash: policy.value_hash, samples: 20, failures: 1, projected_sends: 7 };
  const read = jest.fn().mockResolvedValue({ data: [data], error: null });
  expect(await loadSwellWatchDeliveryHealth(policy.value_hash, { rpc: read }))
    .toEqual({ providerFailures: { samples: 20, failures: 1 }, priorProjectedSendsInWindow: 7 });
  expect(read).toHaveBeenCalledWith("read_swell_watch_delivery_health", { p_policy_hash: policy.value_hash });
  for (const invalid of [null, [], [data, data], [{ ...data, failures: 21 }],
    [{ ...data, samples: "20" }], [{ ...data, projected_sends: -1 }], [{ ...data, policy_hash: "a".repeat(64) }]]) {
    read.mockResolvedValue({ data: invalid, error: null });
    await expect(loadSwellWatchDeliveryHealth(policy.value_hash, { rpc: read })).rejects.toThrow("missing or inconsistent");
  }
  read.mockResolvedValue({ data: null, error: { message: "authority revoked" } });
  await expect(loadSwellWatchDeliveryHealth(policy.value_hash, { rpc: read })).rejects.toThrow("authority revoked");
});

it("ingests while disabled but never reaches matching, audience, health or send authority", async () => {
  delete process.env.SWELL_WATCH_PUSH_ENABLED;
  jest.mocked(ingestAttestedSwellWatchCohort).mockResolvedValueOnce({ kind: "ingested", runs: [{
    source: { evaluationId: "fixture" }, events: [{ impact: { regionalEventId: fixture.regional_event_id } }],
  }] } as never);
  const value = { providerBatchId: fixture.beach_id, forecastDays: 7, now: "2026-09-05T00:00:00.000Z", policy,
    scopes: [{ sourcePointId: fixture.beach_id, latitude: 32.8, longitude: -117.3, regionKey: "fixture",
      beach: { swell_window_center_deg: 170, swell_window_halfwidth_deg: 90 } }] };
  const diagnostics = createSwellWatchObservability();
  expect(await enqueueAttestedSwellWatchCohort(value, client, diagnostics))
    .toEqual({ enqueued: 0, duplicates: 0, stoppedReason: "static_disabled" });
  expect(ingestAttestedSwellWatchCohort).toHaveBeenCalledWith(value, client);
  expect(diagnostics.snapshot().stageCounts.detection).toBe(1);
  expect(loadMatchedSwellWatchHistory).not.toHaveBeenCalled();
  expect(rpc).not.toHaveBeenCalled();
  expect(audience).not.toHaveBeenCalled();
  expect(enqueue).not.toHaveBeenCalled();
});

it("uses the shared queue with exact S2 and permanent regional dedupe, without claiming receipts", async () => {
  expect(await enqueueSwellWatchCandidates(input(), client)).toEqual({ enqueued: 1, duplicates: 0, stoppedReason: null });
  expect(enqueue).toHaveBeenCalledWith({ type: "swell_watch", recipientUserId: "recipient", payload: fixture, dedupeKey: `swell_watch:${fixture.regional_event_id}`,
    swellWatchAuthority: { expectedEpoch: 1, policyHash: policy.value_hash } }, client);
  expect(rpc.mock.calls.map(([name]) => name)).toEqual(["swell_watch_get_automation_control", "swell_watch_get_production_authority", "swell_watch_get_automation_control", "swell_watch_get_production_authority"]);
});

it("stops on a durable database budget hold", async () => {
  enqueue.mockResolvedValueOnce({ enqueued: false, reason: "safety_rejected", message: "projected_send_cap_exceeded" });
  expect(await enqueueSwellWatchCandidates(input(), client)).toEqual({ enqueued: 0, duplicates: 0, stoppedReason: "projected_send_cap_exceeded" });
  expect(enqueue).toHaveBeenCalledTimes(1);
});

it("rechecks the static kill switch after audience loading", async () => {
  audience.mockImplementationOnce(async () => { delete process.env.SWELL_WATCH_PUSH_ENABLED; return [{ recipientUserId: "recipient", beachId: fixture.beach_id, reason: "home" }]; });
  expect(await enqueueSwellWatchCandidates(input(), client)).toMatchObject({ enqueued: 0, stoppedReason: "static_disabled" });
  expect(enqueue).not.toHaveBeenCalled();
});

it("consolidates multiple beach matches into one home-beach announcement", async () => {
  const value = input();
  const favoriteId = randomUUID();
  value.candidates = [...value.candidates, { ...value.candidates[0], beachId: favoriteId, projectedImpact: 20, payload: { ...fixture, beach_id: favoriteId } }];
  audience.mockResolvedValueOnce([{ recipientUserId: "recipient", beachId: favoriteId, reason: "favorite" }, { recipientUserId: "recipient", beachId: fixture.beach_id, reason: "home" }]);
  expect(await enqueueSwellWatchCandidates(value, client)).toMatchObject({ enqueued: 1 });
  expect(enqueue).toHaveBeenCalledTimes(1);
  expect(enqueue).toHaveBeenCalledWith(expect.objectContaining({ payload: fixture }), client);
});

it("stops when control was reset and rearmed during audience loading", async () => {
  audience.mockImplementationOnce(async () => {
    rpc.mockResolvedValueOnce({ error: null, data: [{ state: "armed", epoch: 2, reason_code: "fixture" }] });
    return [{ recipientUserId: "recipient", beachId: fixture.beach_id, reason: "home" }];
  });
  expect(await enqueueSwellWatchCandidates(input(), client)).toMatchObject({ enqueued: 0, stoppedReason: "control_epoch_changed" });
  expect(enqueue).not.toHaveBeenCalled();
});

it("counts unstabilized regional candidates toward the candidate cap", async () => {
  const value = input();
  value.candidates = Array.from({ length: 51 }, () => {
    const id = randomUUID();
    return { ...value.candidates[0], confidence: null, regionalEvent: { ...value.candidates[0].regionalEvent, regionalEventId: id, status: "candidate" as const }, payload: { ...fixture, regional_event_id: id } };
  });
  expect(await enqueueSwellWatchCandidates(value, client)).toMatchObject({ enqueued: 0, stoppedReason: "candidate_cap_exceeded" });
  expect(enqueue).not.toHaveBeenCalled();
});

it("rejects unknown confidence for a stable event before audience or enqueue", async () => {
  const value = input();
  value.candidates = [{ ...value.candidates[0], confidence: null }];
  await expect(enqueueSwellWatchCandidates(value, client)).rejects.toThrow("Invalid Swell Watch candidate");
  expect(audience).not.toHaveBeenCalled();
  expect(enqueue).not.toHaveBeenCalled();
});

it.each([
  ["stale_run", "forecast_stale"],
  ["incomplete_partition", "data_discontinuity"],
  ["ambiguous_partition_path", "material_disagreement"],
])("holds the composed producer on %s without enqueue", async (reason, stoppedReason) => {
  jest.mocked(ingestAttestedSwellWatchCohort).mockResolvedValueOnce({ kind: "suppressed", reason, sourcePointId: fixture.beach_id });
  const read = jest.fn(async (name: string) => name === "read_swell_watch_delivery_health"
    ? { error: null, data: [{ policy_hash: policy.value_hash, samples: 0, failures: 0, projected_sends: 0 }] }
    : rpc(name));
  const value = { providerBatchId: fixture.beach_id, forecastDays: 7, now: "2026-09-05T00:00:00.000Z", policy,
    scopes: [{ sourcePointId: fixture.beach_id, latitude: 32.8, longitude: -117.3, regionKey: "fixture",
      beach: { swell_window_center_deg: 170, swell_window_halfwidth_deg: 90 } }] };
  const diagnostics = createSwellWatchObservability();
  expect(await enqueueAttestedSwellWatchCohort(value, { rpc: read } as never, diagnostics))
    .toEqual({ enqueued: 0, duplicates: 0, stoppedReason });
  expect(diagnostics.snapshot()).toMatchObject({ stageCounts: { suppression: 1, hold: 1, enqueue: 0 },
    reasonCounts: { [stoppedReason]: 1 }, correlations: [] });
  expect(read).toHaveBeenCalledWith("transition_swell_watch_automation_control", expect.objectContaining({
    p_operation: "hold", p_expected_epoch: 1, p_reason_code: stoppedReason,
  }));
  expect(enqueue).not.toHaveBeenCalled();
});

it.each([true, false])("preserves available beach metadata without inventing it (%s)", async (hasMetadata) => {
  jest.mocked(ingestAttestedSwellWatchCohort).mockResolvedValueOnce({ kind: "ingested", runs: [{
    source: { evaluationId: "fixture" }, events: [{ arrivalAt: fixture.arrival_at, peakAt: fixture.peak_at,
      impact: { regionalEventId: fixture.regional_event_id, projectedFaceHeightFt: 6,
        partition: { forecastAt: fixture.forecast_at, heightM: 1.8, periodS: 13, directionDeg: 170 } } }],
  }] } as never);
  jest.mocked(loadMatchedSwellWatchHistory).mockResolvedValueOnce({
    regionalEvent: input().candidates[0].regionalEvent, confidence: 0.75,
  } as never);
  const read = jest.fn(async (name: string) => name === "read_swell_watch_delivery_health"
    ? { error: null, data: [{ policy_hash: policy.value_hash, samples: 0, failures: 0, projected_sends: 0 }] }
    : rpc(name));
  const value = { providerBatchId: fixture.beach_id, forecastDays: 7, now: "2026-09-05T00:00:00.000Z", policy,
    scopes: [{ sourcePointId: fixture.beach_id, latitude: 32.8, longitude: -117.3, regionKey: "fixture",
      ...(hasMetadata ? { slug: "blacks", timezone: "America/Los_Angeles" } : {}),
      beach: { swell_window_center_deg: 170, swell_window_halfwidth_deg: 90 } }] };
  expect(await enqueueAttestedSwellWatchCohort(value, { rpc: read } as never))
    .toEqual({ enqueued: 1, duplicates: 0, stoppedReason: null });
  const { beach_slug: _slug, copy_context: _context, ...withoutMetadata } = fixture;
  expect(enqueue).toHaveBeenCalledTimes(1);
  expect(enqueue.mock.calls[0][0].payload).toEqual(hasMetadata ? fixture : withoutMetadata);
  expect(parseSwellWatchNotificationPayload(enqueue.mock.calls[0][0].payload).body).toBe(hasMetadata
    ? "Productivity has been cancelled. Arrives Tuesday. Peaks Wednesday."
    : "Productivity has been cancelled.");
});

it("rejects mismatched payload identity before audience reads or writes", async () => {
  const value = input();
  value.candidates = [{ ...value.candidates[0], beachId: randomUUID() }];
  await expect(enqueueSwellWatchCandidates(value, client)).rejects.toThrow("Invalid Swell Watch candidate");
  expect(audience).not.toHaveBeenCalled();
  expect(enqueue).not.toHaveBeenCalled();
});

it("holds before enqueue when projected sends exceed the policy cap", async () => {
  const value = input();
  value.signals.priorProjectedSendsInWindow = policy.policy_values.volume_caps.maximum_projected_sends_per_window;
  expect(await enqueueSwellWatchCandidates(value, client)).toMatchObject({ enqueued: 0, stoppedReason: "projected_send_cap_exceeded" });
  expect(rpc).toHaveBeenCalledWith("transition_swell_watch_automation_control", expect.objectContaining({ p_operation: "hold", p_expected_epoch: 1, p_system_actor: "swell_watch_provider_monitor" }));
  expect(enqueue).not.toHaveBeenCalled();
});

it("counts duplicates but surfaces non-duplicate queue failures", async () => {
  enqueue.mockResolvedValueOnce({ enqueued: false, reason: "duplicate" });
  expect(await enqueueSwellWatchCandidates(input(), client)).toMatchObject({ enqueued: 0, duplicates: 1 });
  enqueue.mockResolvedValueOnce({ enqueued: false, reason: "internal_error", message: "fixture" });
  await expect(enqueueSwellWatchCandidates(input(), client)).rejects.toThrow("internal_error");
});
