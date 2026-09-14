/** @jest-environment node */
import { historical, retainedRun, waikiki, hatteras } from "@/__tests__/helpers/swell-watch-retained";
import proposed from "@/docs/operations/swell-watch-no-send-producer-config-v2-proposed.json";
import { evaluateSwellWatchShadow } from "@/lib/alerts/swell-watch/shadow-evaluation";
import type { SwellWatchPolicy } from "@/lib/alerts/swell-watch/policy";

it.each(["complete_partitions.v1", "primary_partition_with_retained_unavailable_secondary.v1"] as const)(
  "replays the real captured cohort without writes under %s", async (qualificationRule) => {
  const replay = structuredClone(historical);
  expect(replay).toHaveLength(10);
  replay.reverse();
  expect(replay.map((item) => item.sourcePointId).sort()).toEqual(proposed.cohort.map((scope) => scope.sourcePointId).sort());
  for (const item of replay) {
    expect(item.run.source).toMatchObject({
      sourcePointId: item.sourcePointId,
      providerBatchId: "60b88e41-6cbf-415e-bafb-080a23eabcb5",
      evaluationId: "genuine_completed:dd28a1f3-119c-4349-a723-c871d8475d59",
      issuanceId: "2963872a-76f7-453b-a96d-e4c3ad82837b",
      revisionSetId: "e7c5bc11-61a9-4299-9ceb-a6a8315b6741",
    });
    expect(Date.parse(item.run.source.issuedAt)).toBe(Date.parse("2026-09-09T18:00:00Z"));
    expect(item.run.samples).toHaveLength(168);
    expect(item.run.samples.every((sample) => sample.components.length === 2)).toBe(true);
    const expectedMissing = item.sourcePointId === "d264fbf8-0525-4d31-adb5-9a0742eaeb7e" ? 24
      : item.sourcePointId === "f11ccd59-b778-4ea1-a8ff-88bffb447cd8" ? 1 : 0;
    expect(item.run.samples.flatMap((sample) => sample.components).filter((part) => part.unavailableReason)).toHaveLength(expectedMissing);
  }
  const bySource = new Map(replay.map((item) => [item.sourcePointId, item]));
  const first = replay[0].run.source;
  const scopes = proposed.cohort.map(({ sourcePointId, regionKey }) => {
    const item = bySource.get(sourcePointId)!;
    return { sourcePointId, regionKey, latitude: item.latitude, longitude: item.longitude, beach: item.beach };
  });
  const forbidden: string[] = [];
  const client = { from: () => { throw new Error("Forbidden replay table read"); }, rpc: async (name: string, args: Record<string, string>) => {
    if (name === "read_swell_watch_run_scope") return { data: { providerBatchId: first.providerBatchId, evaluationId: first.evaluationId,
      issuedAt: first.issuedAt, scopeHash: "a".repeat(64), expectedComponentCount: 3360,
      scopes: scopes.map((scope) => ({ ...scope, forecastDays: 7 })) }, error: null };
    if (name === "read_swell_watch_attested_run") return { data: bySource.get(args.p_source_point_id)!.run, error: null };
    forbidden.push(name); throw new Error(`Forbidden replay write: ${name}`);
  } };
  const result = await evaluateSwellWatchShadow({ qualificationRule, providerBatchId: first.providerBatchId, forecastDays: 7, now: "2026-09-10T00:00:00Z",
    policy: proposed.policy as SwellWatchPolicy, scopes: scopes as never }, client as never);
  expect(result).toMatchObject({ status: "suppressed", reason: "unbounded_episode", candidateCount: null,
    stableRegionalEventCount: null, preSafetyRecipientsThisEvaluation: null, enqueued: 0 });
  expect(result.scopeOutcomes).toHaveLength(10);
  expect(result.scopeOutcomes?.map((outcome) => outcome.sourcePointId)).toEqual(proposed.cohort.map((scope) => scope.sourcePointId));
  expect(result.scopeOutcomes?.filter((outcome) => outcome.status === "derived")).toHaveLength(qualificationRule === "complete_partitions.v1" ? 7 : 9);
  expect(result.scopeOutcomes?.filter((outcome) => outcome.reason === "incomplete_partition")).toHaveLength(qualificationRule === "complete_partitions.v1" ? 2 : 0);
  expect(result.scopeOutcomes?.filter((outcome) => outcome.reason === "unbounded_episode")).toHaveLength(1);
  expect(result.derivation).toEqual({ qualificationRule, version: "swell-watch-horizon-derivation.v2",
    samplingProfile: "ncep_gfswave016.native-1h-to-120h-3h-to-168h.v1", witness: "provider-linear-interpolation.v1",
    scopes: result.scopeOutcomes!.filter((s) => s.status === "derived").map((s) => ({ sourcePointId: s.sourcePointId, nativeFrames: 136, interpolatedFrames: 32, partitionCoverage: expect.objectContaining({ s1: expect.objectContaining({ observed: 168, unavailable: 0, absent: 0 }) }), events: expect.any(Array) })) });
  expect(result.scopeOutcomes?.every((s) => Object.keys(s).sort().join(",") === "reason,sourcePointId,status")).toBe(true);
  expect(forbidden).toEqual([]);
});

it.each([{ allIncomplete: false, sourceCount: 2 }, { allIncomplete: true, sourceCount: 2 }, { allIncomplete: false, sourceCount: 10 }])(
  "preflights retained Waikiki and Hatteras without any write (all incomplete: $allIncomplete, sources: $sourceCount)", async ({ allIncomplete, sourceCount }) => {
  const fixtures = [waikiki, hatteras, ...Array.from({ length: sourceCount - 2 }, (_, index) => ({ ...waikiki,
    sourcePointId: `10000000-0000-4000-8000-${String(index).padStart(12, "0")}` }))];
  const scopes = fixtures.map((f) => ({ sourcePointId: f.sourcePointId, regionKey: "retained-replay",
    latitude: f.semanticPayload.latitude, longitude: f.semanticPayload.longitude, beach: f.beach }));
  const runs = fixtures.map(retainedRun);
  if (allIncomplete) Object.assign(runs[0].samples[139].components[0], { heightM: 0, periodS: 0, directionDeg: 0, unavailableReason: "provider_zero_tuple" });
  const first = runs[0].source;
  const forbidden = jest.fn();
  const client = { from: () => { throw new Error("Forbidden table read"); }, rpc: async (name: string, args: Record<string, string>) => {
    if (name === "read_swell_watch_run_scope") return { error: null, data: { providerBatchId: first.providerBatchId,
      evaluationId: first.evaluationId, issuedAt: first.issuedAt, scopeHash: "a".repeat(64), expectedComponentCount: sourceCount * 336,
      scopes: scopes.map((scope) => ({ ...scope, forecastDays: 7 })) } };
    if (name === "read_swell_watch_attested_run") return { error: null, data: runs.find((r) => r.source.sourcePointId === args.p_source_point_id) };
    forbidden(name); throw new Error(`Forbidden replay write: ${name}`);
  } };
  const result = await evaluateSwellWatchShadow({ qualificationRule: "complete_partitions.v1", providerBatchId: first.providerBatchId, forecastDays: 7,
    now: waikiki.replayClockBounds[0], policy: proposed.policy as SwellWatchPolicy, scopes }, client as never);
  expect(result).toMatchObject({ status: "suppressed", reason: "incomplete_partition", candidateCount: null,
    derivation: allIncomplete ? null : { version: "swell-watch-horizon-derivation.v2" } });
  expect(result.scopeOutcomes).toEqual(fixtures.map(({ sourcePointId }) => ({ sourcePointId,
    status: allIncomplete || sourcePointId === hatteras.sourcePointId ? "suppressed" : "derived",
    reason: allIncomplete || sourcePointId === hatteras.sourcePointId ? "incomplete_partition" : null })));
  expect(forbidden).not.toHaveBeenCalled();
  if (allIncomplete) return;
  const expectedEvent = { sourceSlot: "s1", arrivalAt: "2026-09-18T18:00:00.000Z",
    arrivalWindow: { earliestAt: "2026-09-18T15:00:00.000Z", latestAt: "2026-09-18T18:00:00.000Z" },
    peakAt: "2026-09-18T18:00:00.000Z",
    peakWindow: { earliestAt: "2026-09-18T18:00:00.000Z", latestAt: "2026-09-18T21:00:00.000Z" },
    closureWindow: { earliestAt: "2026-09-20T00:00:00.000Z", latestAt: "2026-09-20T03:00:00.000Z" }, regionalEventId: null };
  expect(result.derivation?.scopes).toEqual(fixtures.filter((f) => f.sourcePointId !== hatteras.sourcePointId)
    .map(({ sourcePointId }) => ({ sourcePointId, nativeFrames: 136, interpolatedFrames: 32, partitionCoverage: { s1: { observed: 168, unavailable: 0, absent: 0 }, s2: { observed: 168, unavailable: 0, absent: 0, unavailableNativeFrames: [], absentNativeFrames: [] } }, events: [expectedEvent] })));
  expect(result.scopeOutcomes).toHaveLength(sourceCount);
  expect(result.derivation?.scopes.flatMap((scope) => scope.events)).toHaveLength(sourceCount - 1);
  // Pretty JSON overestimates jsonb::text whitespace, leaving ample room below SQL's 131072-byte limit.
  expect(Buffer.byteLength(JSON.stringify(result, null, 2))).toBeLessThan(32_768);
});
