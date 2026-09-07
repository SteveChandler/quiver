/** @jest-environment node */
import { evaluateSwellWatchShadow } from "@/lib/alerts/swell-watch/shadow-evaluation";
import { ingestAttestedSwellWatchCohort } from "@/lib/alerts/swell-watch/provider-impact-ingestion";
import { loadMatchedSwellWatchHistory } from "@/lib/alerts/swell-watch/persisted-history";
import { loadSwellWatchAudience } from "@/lib/alerts/swell-watch/audience";
import policy from "@/__tests__/fixtures/swell-watch-provisional-policy.json";

jest.mock("@/lib/alerts/swell-watch/provider-impact-ingestion", () => ({ ingestAttestedSwellWatchCohort: jest.fn() }));
jest.mock("@/lib/alerts/swell-watch/persisted-history", () => ({ loadMatchedSwellWatchHistory: jest.fn() }));
jest.mock("@/lib/alerts/swell-watch/audience", () => ({ loadSwellWatchAudience: jest.fn() }));
jest.mock("@/lib/notifications/enqueue", () => ({ enqueueNotification: () => { throw new Error("Forbidden enqueue"); } }));

const input = { providerBatchId: "batch", policy, now: "2026-09-06T00:00:00Z", forecastDays: 7,
  scopes: ["beach-a", "beach-b"].map((sourcePointId) => ({ sourcePointId, regionKey: "region", beach: {} })),
} as unknown as Parameters<typeof evaluateSwellWatchShadow>[0];
const rpc = jest.fn(() => { throw new Error("Forbidden control/queue RPC"); });
const client = { rpc } as unknown as Parameters<typeof evaluateSwellWatchShadow>[1];
const originalFlag = process.env.SWELL_WATCH_PUSH_ENABLED;

beforeEach(() => {
  jest.resetAllMocks();
  rpc.mockImplementation(((name: string) => {
    if (name !== "record_swell_watch_shadow_demand") throw new Error("Forbidden control/queue RPC");
    return { data: [{ observed_at: "2026-09-06T00:00:00Z", recorded_pairs_24h: 1 }], error: null };
  }) as never);
  delete process.env.SWELL_WATCH_PUSH_ENABLED;
  jest.mocked(ingestAttestedSwellWatchCohort).mockResolvedValue({ kind: "ingested", runs: input.scopes.map(() => ({
    source: { evaluationId: "genuine_completed:fixture" },
    events: [{ impact: { regionalEventId: "event", projectedFaceHeightFt: 6 } }],
  })) } as never);
  jest.mocked(loadMatchedSwellWatchHistory).mockResolvedValue({ confidence: 0.8,
    regionalEvent: { regionalEventId: "event", regionKey: "region", status: "stable", evaluationIds: [] } });
  jest.mocked(loadSwellWatchAudience).mockResolvedValue([
    { recipientUserId: "private-user", beachId: "beach-a", reason: "home" },
    { recipientUserId: "private-user", beachId: "beach-b", reason: "favorite" },
  ]);
});
afterEach(() => {
  if (originalFlag === undefined) delete process.env.SWELL_WATCH_PUSH_ENABLED;
  else process.env.SWELL_WATCH_PUSH_ENABLED = originalFlag;
});

it("projects one multi-beach recipient with sending disabled and retains no personal identifiers", async () => {
  const result = await evaluateSwellWatchShadow(input, client);
  expect(result).toMatchObject({ status: "evaluated", evaluationIds: ["genuine_completed:fixture"],
    policyHash: policy.value_hash, candidateCount: 2, stableRegionalEventCount: 1,
    preSafetyRecipientsThisEvaluation: 1, sendEligibility: "not_evaluated",
    projectedSendsRolling24Hours: null, deliveryHealth: null, enqueued: 0,
    safety: { reasonCode: null, missingMetrics: ["projected_send_window", "delivery_health"] } });
  expect(loadSwellWatchAudience).toHaveBeenCalledWith(client, ["beach-a", "beach-b"]);
  expect(JSON.stringify(result)).not.toMatch(/private-user|beach-a|beach-b/);
  expect(await evaluateSwellWatchShadow(input, client)).toEqual(result);
  expect(rpc).toHaveBeenCalledTimes(2);
  expect(rpc).toHaveBeenCalledWith("record_swell_watch_shadow_demand", { p_provider_batch_id: "batch",
    p_policy_hash: policy.value_hash, p_pairs: [{ regional_event_id: "event", recipient_id: "private-user" }] });
  expect(result.recordedDemand).toEqual({ observedAt: "2026-09-06T00:00:00Z", recipientEventPairs24Hours: 1 });
});

it("does not label missing coverage as zero demand", async () => {
  jest.mocked(ingestAttestedSwellWatchCohort).mockResolvedValueOnce({ kind: "suppressed", reason: "incomplete_partition", sourcePointId: "beach-a" });
  expect(await evaluateSwellWatchShadow(input, client)).toMatchObject({ status: "suppressed", reason: "incomplete_partition",
    evaluationIds: [], candidateCount: null, preSafetyRecipientsThisEvaluation: null, enqueued: 0 });
  expect(loadMatchedSwellWatchHistory).not.toHaveBeenCalled();
  expect(loadSwellWatchAudience).not.toHaveBeenCalled();
  expect(rpc).not.toHaveBeenCalled();
});

it("excludes unstable events and preserves their suppression reason", async () => {
  jest.mocked(loadMatchedSwellWatchHistory).mockResolvedValue({ confidence: null,
    regionalEvent: { regionalEventId: "event", regionKey: "region", status: "suppressed", reason: "continuity_broken", evaluationIds: [] } });
  expect(await evaluateSwellWatchShadow(input, client)).toMatchObject({ candidateCount: 2,
    stableRegionalEventCount: 0, preSafetyRecipientsThisEvaluation: 0, suppressionReasons: { continuity_broken: 2 } });
  expect(loadSwellWatchAudience).toHaveBeenCalledWith(client, []);
  expect(rpc).toHaveBeenCalledWith("record_swell_watch_shadow_demand", expect.objectContaining({ p_pairs: [] }));
});

it("rejects a stable event with unknown confidence before reading audience", async () => {
  jest.mocked(loadMatchedSwellWatchHistory).mockResolvedValueOnce({ confidence: null,
    regionalEvent: { regionalEventId: "event", regionKey: "region", status: "stable", evaluationIds: [] } });
  await expect(evaluateSwellWatchShadow(input, client)).rejects.toThrow("Invalid shadow candidate");
  expect(loadSwellWatchAudience).not.toHaveBeenCalled();
});

it("labels mixed stable/discontinuous demand as pre-safety, not eligible sends", async () => {
  jest.mocked(loadMatchedSwellWatchHistory).mockResolvedValueOnce({ confidence: null,
    regionalEvent: { regionalEventId: "event", regionKey: "region", status: "suppressed", reason: "continuity_broken", evaluationIds: [] } });
  expect(await evaluateSwellWatchShadow(input, client)).toMatchObject({ stableRegionalEventCount: 1,
    preSafetyRecipientsThisEvaluation: 1, sendEligibility: "not_evaluated",
    suppressionReasons: { continuity_broken: 1 }, projectedSendsRolling24Hours: null, enqueued: 0,
    safety: { reasonCode: "data_discontinuity", missingMetrics: ["projected_send_window", "delivery_health"] } });
  expect(rpc).toHaveBeenCalledTimes(1);
});

it("propagates missing database policy authority instead of reporting a completed evaluation", async () => {
  jest.mocked(ingestAttestedSwellWatchCohort).mockRejectedValueOnce(new Error("current matching policy authority is required"));
  await expect(evaluateSwellWatchShadow(input, client)).rejects.toThrow("current matching policy authority is required");
  expect(loadMatchedSwellWatchHistory).not.toHaveBeenCalled();
  expect(loadSwellWatchAudience).not.toHaveBeenCalled();
  expect(rpc).not.toHaveBeenCalled();
});

it.each([
  { data: [], error: null },
  { data: [{ observed_at: "invalid", recorded_pairs_24h: 1 }], error: null },
  { data: [{ observed_at: "2026-09-06T00:00:00Z", recorded_pairs_24h: "1" }], error: null },
  { data: null, error: { message: "private upstream error" } },
])("fails closed on invalid demand receipts: %p", async (response) => {
  rpc.mockReturnValueOnce(response as never);
  await expect(evaluateSwellWatchShadow(input, client)).rejects.toThrow("Shadow demand recording failed");
});
