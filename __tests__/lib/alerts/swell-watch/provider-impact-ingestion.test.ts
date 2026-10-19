/** @jest-environment node */
import fixturePolicy from "@/__tests__/fixtures/swell-watch-provisional-policy.json";
import { capSwellWatchDerivationEvents, ingestAttestedSwellWatchCohort, ingestAttestedSwellWatchImpact } from "@/lib/alerts/swell-watch/provider-impact-ingestion";
import type { SwellWatchPolicy } from "@/lib/alerts/swell-watch/policy";
import proposed from "@/docs/operations/swell-watch-no-send-producer-config-v2-proposed.json";
import { gunzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import { swellWatchAttestedReplayGzipBase64 } from "@/__tests__/fixtures/swell-watch-attested-replay-20260910";


const id = "11111111-1111-4111-8111-111111111111";
const input: Parameters<typeof ingestAttestedSwellWatchImpact>[0] = {
  providerBatchId: id, sourcePointId: id, observationId: id, impactId: id, regionalEventId: id,
  forecastAt: "2026-09-08T00:00:00.000Z", sourceSlot: "s2", regionKey: "fixture-region", physicalKey: "fixture-event",
  peakAt: "2026-09-09T00:00:00.000Z",
  impact: { baselineHeightFt: 1, baselineEnergy: 8, arrivalAt: "2026-09-08T00:00:00.000Z", now: new Date("2026-09-05T00:00:00.000Z"),
    beach: { swell_window_center_deg: 170, swell_window_halfwidth_deg: 90 }, policy: fixturePolicy as SwellWatchPolicy, seamContinuous: true, sourceCoherent: true },
};
const rows = [
  { evaluation_id: `genuine_completed:${id}`, source_slot: "s1", height_m: 1, period_s: 9, direction_deg: 270 },
  { evaluation_id: `genuine_completed:${id}`, source_slot: "s2", height_m: 1.8, period_s: 13, direction_deg: 170 },
];
const from = jest.fn();
const identity = [{ regional_event_id: id, event_state: "candidate" }];
const identityReader = { from: from as never };

beforeEach(() => {
  jest.clearAllMocks();
});

describe("attested component impact ingestion", () => {
  it("persists valid feeds when other captured feeds fail derivation", async () => {
    const text = gunzipSync(Buffer.from(swellWatchAttestedReplayGzipBase64, "base64")).toString();
    const replay = JSON.parse(text).rows[0].value as Array<{ sourcePointId: string; latitude: number; longitude: number; beach: Record<string, unknown>; run: { source: { evaluationId: string; issuedAt: string; providerBatchId: string } } }>;
    const bySource = new Map(replay.map((item) => [item.sourcePointId, item]));
    const first = replay[0].run.source;
    const scopes = proposed.cohort.map(({ sourcePointId, regionKey }) => {
      const item = bySource.get(sourcePointId)!;
      return { sourcePointId, regionKey, latitude: item.latitude, longitude: item.longitude, beach: item.beach };
    });
    expect(new Set(replay.map((item) => item.sourcePointId)).size).toBe(10);
    expect(createHash("sha256").update(swellWatchAttestedReplayGzipBase64).digest("hex")).toBe("191897bdcb75cb1dfd4362bb8a6bdcbcba91ac23aff99a45a2f13ec821bad488");
    expect([...bySource.keys()].sort()).toEqual(proposed.cohort.map((scope) => scope.sourcePointId).sort());
    expect(replay.every((item) => item.run.source.providerBatchId === first.providerBatchId && item.run.source.evaluationId === first.evaluationId && item.run.source.issuedAt === "2026-09-09T18:00:00+00:00")).toBe(true);
    expect(replay.every((item) => (item.run as typeof item.run & { samples: unknown[] }).samples.length === 168)).toBe(true);
    const rpc = jest.fn(async (name: string, args: Record<string, string>) => {
      if (name === "read_swell_watch_run_scope") return { data: { providerBatchId: first.providerBatchId, evaluationId: first.evaluationId,
        issuedAt: first.issuedAt, scopeHash: "a".repeat(64), expectedComponentCount: 3360,
        scopes: scopes.map((scope) => ({ ...scope, forecastDays: 7 })) }, error: null };
      if (name === "read_swell_watch_attested_run") return { data: bySource.get(args.p_source_point_id)!.run, error: null };
      if (name === "ingest_swell_watch_cohort") return { data: (args as unknown as { p_impacts: unknown[] }).p_impacts.map((_, ordinal) => ({ ordinal,
        regional_event_id: first.providerBatchId, event_state: "candidate" })), error: null };
      throw new Error(`Forbidden replay write: ${name}`);
    });
    const result = await ingestAttestedSwellWatchCohort({ qualificationRule: "complete_partitions.v1", providerBatchId: first.providerBatchId, forecastDays: 7, now: "2026-09-10T00:00:00Z",
      policy: proposed.policy as SwellWatchPolicy, scopes: scopes as never }, { rpc, ...identityReader } as never);
    expect(result).toMatchObject({ kind: "ingested", runs: Array(7).fill(expect.objectContaining({ kind: "ingested" })) });
    expect(result.scopeOutcomes).toHaveLength(10);
    expect(result.scopeOutcomes.filter((outcome) => outcome.status === "derived")).toHaveLength(7);
    expect(result.scopeOutcomes.filter((outcome) => outcome.reason === "incomplete_partition")).toHaveLength(2);
    expect(result.scopeOutcomes.filter((outcome) => outcome.reason === "unbounded_episode")).toHaveLength(1);
    expect(rpc.mock.calls.map(([name]) => name)).toContain("ingest_swell_watch_cohort");
    expect(result.derivation?.scopes.flatMap((scope) => scope.events).every((event) => event.regionalEventId === first.providerBatchId)).toBe(true);
  });

  it("persists the exact attested S2, not headline S1, through the verified RPC only", async () => {
    const rpc = jest.fn().mockResolvedValueOnce({ data: rows, error: null }).mockResolvedValueOnce({ data: identity, error: null });
    const result = await ingestAttestedSwellWatchImpact(input, { rpc, ...identityReader });
    expect(result).toMatchObject({ kind: "candidate", regionalEventId: id, partition: { sourceSlot: "s2", heightM: 1.8, periodS: 13, directionDeg: 170 } });
    expect(rpc).toHaveBeenCalledTimes(2);
    expect(rpc).toHaveBeenNthCalledWith(1, "read_swell_watch_attested_components", { p_provider_batch_id: id, p_source_point_id: id, p_forecast_at: input.forecastAt });
    expect(rpc).toHaveBeenNthCalledWith(2, "resolve_and_ingest_swell_watch_evaluation", expect.objectContaining({ p_provider_batch_id: id, p_source_slot: "s2", p_height_m: 1.8, p_period_s: 13, p_direction_deg: 170, p_impact_hash: expect.stringMatching(/^[a-f0-9]{64}$/) }));
    expect(from).not.toHaveBeenCalled();
    expect(rpc.mock.calls[1][1]).not.toHaveProperty("p_regional_event_id");
    expect(result).toHaveProperty("eventState", "candidate");
  });

  it.each([
    [rows[0], rows[0]],
    [rows[0], { ...rows[1], evaluation_id: "synthetic_fixture:fake" }],
    [rows[0], { ...rows[1], period_s: null }],
  ])("rejects missing, contradictory or malformed component evidence without ingestion: %j", async (...data) => {
    const rpc = jest.fn().mockResolvedValue({ data, error: null });
    await expect(ingestAttestedSwellWatchImpact(input, { rpc, ...identityReader })).rejects.toThrow();
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(from).not.toHaveBeenCalled();
  });

  it.each([{ data: [] }, { data: [rows[0]] }, { data: [rows[1]] }])("suppresses unavailable partition scope without advancing an event: %j", async ({ data }) => {
    const rpc = jest.fn().mockResolvedValue({ data, error: null });
    await expect(ingestAttestedSwellWatchImpact(input, { rpc, ...identityReader })).resolves.toEqual({ kind: "suppressed", reason: "incomplete_partition" });
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("read_swell_watch_attested_components", expect.any(Object));
    expect(from).not.toHaveBeenCalled();
  });

  it("returns suppression without persistence for source discontinuity", async () => {
    const rpc = jest.fn().mockResolvedValue({ data: rows, error: null });
    await expect(ingestAttestedSwellWatchImpact({ ...input, impact: { ...input.impact, seamContinuous: false } }, { rpc, ...identityReader })).resolves.toEqual({ kind: "suppressed", reason: "seam_discontinuous" });
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(from).not.toHaveBeenCalled();
  });

  it("propagates revocation between read and write rather than claiming ingestion", async () => {
    const rpc = jest.fn().mockResolvedValueOnce({ data: rows, error: null }).mockResolvedValueOnce({ data: null, error: { message: "provider attestation revoked" } });
    await expect(ingestAttestedSwellWatchImpact(input, { rpc, ...identityReader })).rejects.toThrow("revoked");
    expect(rpc).toHaveBeenCalledTimes(2);
    expect(from).not.toHaveBeenCalled();
  });

  it("keeps the persisted impact hash stable across equivalent timestamp spellings", async () => {
    const rpc = jest.fn().mockImplementation(async (name: string) => ({ data: name === "read_swell_watch_attested_components" ? rows : identity, error: null }));
    await ingestAttestedSwellWatchImpact(input, { rpc, ...identityReader });
    await ingestAttestedSwellWatchImpact({ ...input, forecastAt: "2026-09-07T17:00:00-07:00", peakAt: "2026-09-08T17:00:00-07:00", impact: { ...input.impact, arrivalAt: "2026-09-07T17:00:00-07:00" } }, { rpc, ...identityReader });
    expect(rpc.mock.calls[1][1]).toEqual(rpc.mock.calls[3][1]);
  });

  it("does not read or write for an invalid clock or identity", async () => {
    const rpc = jest.fn();
    await expect(ingestAttestedSwellWatchImpact({ ...input, providerBatchId: "fake" }, { rpc, ...identityReader })).rejects.toThrow("Invalid");
    await expect(ingestAttestedSwellWatchImpact({ ...input, impact: { ...input.impact, now: new Date("invalid") } }, { rpc, ...identityReader })).rejects.toThrow("Invalid");
    expect(rpc).not.toHaveBeenCalled();
    expect(from).not.toHaveBeenCalled();
  });

  it("returns the persisted regional identity rather than the proposed retry ID", async () => {
    const rpc = jest.fn().mockResolvedValueOnce({ data: rows, error: null }).mockResolvedValueOnce({ data: identity, error: null });
    const actual = "22222222-2222-4222-8222-222222222222";
    rpc.mockReset().mockResolvedValueOnce({ data: rows, error: null }).mockResolvedValueOnce({ data: [{ regional_event_id: actual, event_state: "stable" }], error: null });
    expect(await ingestAttestedSwellWatchImpact(input, { rpc, ...identityReader })).toMatchObject({ regionalEventId: actual, eventState: "stable" });
  });

  it.each([null, [], [null], [{ regional_event_id: "invalid" }], [{ regional_event_id: id }], [{ regional_event_id: id, event_state: "unknown" }],
    [...identity, ...identity]].map((data) => ({ data })))("rejects missing or ambiguous persisted identity: %j", async ({ data }) => {
    const rpc = jest.fn().mockResolvedValueOnce({ data: rows, error: null }).mockResolvedValueOnce({ data: identity, error: null });
    rpc.mockReset().mockResolvedValueOnce({ data: rows, error: null }).mockResolvedValueOnce({ data, error: null });
    await expect(ingestAttestedSwellWatchImpact(input, { rpc, ...identityReader })).rejects.toThrow("missing or ambiguous");
  });

  it("does not fall back to the proposed identity when read-back fails", async () => {
    const rpc = jest.fn().mockResolvedValueOnce({ data: rows, error: null }).mockResolvedValueOnce({ data: identity, error: null });
    rpc.mockReset().mockResolvedValueOnce({ data: rows, error: null }).mockResolvedValueOnce({ data: null, error: { message: "resolution unavailable" } });
    await expect(ingestAttestedSwellWatchImpact(input, { rpc, ...identityReader })).rejects.toThrow("ingestion failed");
  });
});

it("caps persisted derivation events per scope and stays below the study result budget", () => {
  const window = { earliestAt: "2026-09-10T00:00:00.000Z", latestAt: "2026-09-10T01:00:00.000Z" };
  const derivation = {
    version: "swell-watch-horizon-derivation.v4", samplingProfile: "fixture", witness: "fixture",
    qualificationRule: "complete_partitions.v1", scopes: Array.from({ length: 10 }, (_, scopeIndex) => ({
      sourcePointId: `scope-${scopeIndex}`, nativeFrames: 136, interpolatedFrames: 32,
      boundaryDeferrals: [{ boundary: "minimum", sourceSlot: "s1", arrivalWindow: window }],
      partitionCoverage: { s1: { observed: 200, unavailable: 0, absent: 0, absentNativeFrames: [] },
        s2: { observed: 200, unavailable: 0, absent: 0, unavailableNativeFrames: [], absentNativeFrames: [] } },
      events: Array.from({ length: 200 }, (_, eventIndex) => ({ sourceSlot: "s1" as const,
        arrivalAt: new Date(Date.parse("2026-09-10T00:00:00.000Z") + eventIndex * 60_000).toISOString(),
        arrivalWindow: window, peakAt: window.latestAt, peakWindow: window, closureWindow: window, regionalEventId: null })),
    })),
  };

  const bounded = capSwellWatchDerivationEvents(derivation as never);

  expect(bounded.scopes).toHaveLength(10);
  expect(bounded.scopes.every((scope) => scope.events.length === 10)).toBe(true);
  expect(bounded.scopes.every((scope) => scope.eventsTruncated === 190)).toBe(true);
  expect(bounded.scopes.map((scope) => scope.boundaryDeferrals)).toEqual(derivation.scopes.map((scope) => scope.boundaryDeferrals));
  expect(Buffer.byteLength(JSON.stringify(bounded), "utf8")).toBeLessThan(64 * 1024);
});
