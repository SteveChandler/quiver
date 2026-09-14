/** @jest-environment node */
import { deriveSwellWatchHorizon } from "@/lib/alerts/swell-watch/horizon-derivation";
import { deriveAttestedSwellWatchRun } from "@/lib/alerts/swell-watch/attested-run";
import { resolveNativeSamplingProfile, selectNativeFrames, verifyInterpolationWitness } from "@/lib/alerts/swell-watch/native-sampling";
import { retainedRun, hatteras, waikiki, historical, sourceIdentity } from "@/__tests__/helpers/swell-watch-retained";
import config from "@/docs/operations/swell-watch-no-send-producer-config-v2-proposed.json";
import type { SwellWatchPolicy } from "@/lib/alerts/swell-watch/policy";
import type { SwellPartitionObservation } from "@/lib/alerts/swell-watch/partition-normalizer";

const complete = "complete_partitions.v1" as const;
const partial = "primary_partition_with_retained_unavailable_secondary.v1" as const;
const policy = config.policy as SwellWatchPolicy;
const issuedAt = "2026-09-13T12:00:00.000Z";
const at = (hour: number): string => new Date(Date.parse(issuedAt) + hour * 3_600_000).toISOString();
type Part = SwellPartitionObservation | { kind: "unavailable"; sourceSlot: "s2"; forecastAt: string; reason: "provider_zero_tuple" };
function frames(from = 78, to = 84): Part[][] {
  return Array.from({ length: 168 }, (_, hour) => ["s1", "s2"].map((slot, i) => ({
    provider: "open_meteo", evaluationId: "genuine_completed:fixture", sourceSlot: slot as "s1" | "s2",
    forecastAt: at(hour), heightM: i && hour >= from && hour <= to ? 1.5 : 0.3,
    periodS: i ? 13 : 9, directionDeg: i ? 170 : 260, completeness: "complete",
  })));
}
function gap(series: Part[][], from: number, to = from): void {
  for (let i = from; i <= to; i++) series[i][1] = { kind: "unavailable", sourceSlot: "s2", forecastAt: at(i), reason: "provider_zero_tuple" };
}
function derive(series: Part[][], qualificationRule: typeof complete | typeof partial = partial) {
  return deriveSwellWatchHorizon({ series, qualificationRule, now: issuedAt, policy,
    beach: { swell_window_center_deg: 170, swell_window_halfwidth_deg: 30 },
    sampling: { profile: resolveNativeSamplingProfile(sourceIdentity), issuedAt } });
}
it("retains unavailable coverage without tracking a gap far from events", () => {
  const series = frames(); gap(series, 5, 14); gap(series, 166, 167);
  const result = derive(series);
  expect(result.events).toHaveLength(1);
  expect(result.events[0].arrivalWindow).toEqual({ earliestAt: at(77), latestAt: at(78) });
  expect(result.derivation).toMatchObject({ qualificationRule: partial, partitionCoverage: {
    s1: { observed: 168, unavailable: 0 }, s2: { observed: 156, unavailable: 12, unavailableNativeFrames: [5,6,7,8,9,10,11,12,13,14] },
  } });
  expect(() => derive(series, complete)).toThrow("incomplete_partition");
});
it("bounds a fresh onset by the last complete native frame and rejects a gap over six hours", () => {
  const series = frames(); gap(series, 70, 77);
  expect(() => derive(series)).toThrow("arrival_window_unobserved");
  const bounded = frames(); gap(bounded, 73, 77);
  expect(derive(bounded).events[0].arrivalWindow).toEqual({ earliestAt: at(72), latestAt: at(78) });
});
it("rejects an actionable episode cut by unavailable closure", () => {
  const series = frames(); gap(series, 82, 90);
  expect(() => derive(series)).toThrow("episode_interrupted_by_unavailable_partition");
});
it("drops unobserved windows outside actionability and preserves boundary suppression", () => {
  const early = frames(20, 25); gap(early, 5, 19);
  expect(derive(early).events).toEqual([]);
  const boundary = frames(50, 55); gap(boundary, 40, 49);
  expect(() => derive(boundary)).toThrow("arrival_window_crosses_actionability");
});
it("rank swaps follow the active observation and never reconnect a dormant track", () => {
  const series = frames(78, 90);
  // The event moves s2 -> s1 for the gap, then back to s2. The other partition is dormant.
  for (let i = 80; i <= 82; i++) {
    series[i] = [{ ...series[i][1], sourceSlot: "s1" } as SwellPartitionObservation, series[i][0]];
    gap(series, i);
  }
  const result = derive(series);
  expect(result.events).toHaveLength(1);
  expect(result.events[0]).toMatchObject({ arrivalWindow: { earliestAt: at(77), latestAt: at(78) }, closureWindow: { earliestAt: at(90), latestAt: at(91) } });
  // If the event itself disappears, its reappearance cannot close the pre-gap episode.
  const interrupted = frames(78, 90); gap(interrupted, 80, 82);
  expect(() => derive(interrupted)).toThrow("episode_interrupted_by_unavailable_partition");
});
it.each([120, 123])("witness skips only the unavailable slot at bracket hour %i", (hour) => {
  const series = frames(); gap(series, hour);
  (series[122][1] as SwellPartitionObservation).heightM = 9;
  const selection = selectNativeFrames(series, resolveNativeSamplingProfile(sourceIdentity), issuedAt);
  expect(() => verifyInterpolationWitness(series, selection)).not.toThrow();
  (series[122][0] as SwellPartitionObservation).heightM = 9;
  expect(() => verifyInterpolationWitness(series, selection)).toThrow("sampling_profile_mismatch");
});
it("still witnesses the observed neighbour of an unavailable interpolation sample", () => {
  const series = frames(); gap(series, 121);
  const selection = selectNativeFrames(series, resolveNativeSamplingProfile(sourceIdentity), issuedAt);
  expect(() => verifyInterpolationWitness(series, selection)).not.toThrow();
  (series[122][1] as SwellPartitionObservation).heightM = 9;
  expect(() => verifyInterpolationWitness(series, selection)).toThrow("sampling_profile_mismatch");
});
it.each([complete, partial])("primary unavailable still suppresses under %s", async (qualificationRule) => {
  const data = retainedRun(waikiki);
  Object.assign(data.samples[5].components[0], { heightM: 0, periodS: 0, directionDeg: 0, unavailableReason: "provider_zero_tuple" });
  expect(await deriveAttestedSwellWatchRun({ providerBatchId: data.source.providerBatchId, sourcePointId: waikiki.sourcePointId,
    qualificationRule, now: waikiki.replayClockBounds[0], beach: waikiki.beach, policy }, { rpc: async () => ({ data, error: null }) }))
    .toEqual({ kind: "suppressed", reason: "incomplete_partition" });
});
it.each(hatteras.replayClockBounds)("replays retained Hatteras under both rules at %s", async (now) => {
  const data = retainedRun(hatteras);
  const input = { providerBatchId: data.source.providerBatchId, sourcePointId: hatteras.sourcePointId, now, beach: hatteras.beach, policy };
  const client = { rpc: async () => ({ data, error: null }) };
  expect(await deriveAttestedSwellWatchRun({ ...input, qualificationRule: complete }, client)).toEqual({ kind: "suppressed", reason: "incomplete_partition" });
  const result = await deriveAttestedSwellWatchRun({ ...input, qualificationRule: partial }, client);
  expect(result).toEqual({ kind: "suppressed", reason: "arrival_window_crosses_actionability" });
  expect(data.samples.flatMap((sample) => sample.components).filter((part) => part.unavailableReason))
    .toHaveLength(48);
});
it("replays historical sources under both rules with retained slot evidence", async () => {
  const outcomes = [];
  const oldEvents = []; const newEvents = [];
  for (const { run, beach, sourcePointId } of historical) {
    const input = { providerBatchId: run.source.providerBatchId, sourcePointId, now: "2026-09-10T00:00:00Z", beach, policy };
    const client = { rpc: async () => ({ data: run, error: null }) };
    const old = await deriveAttestedSwellWatchRun({ ...input, qualificationRule: complete }, client);
    const next = await deriveAttestedSwellWatchRun({ ...input, qualificationRule: partial }, client);
    const unavailable = run.samples.flatMap((s) => s.components).filter((p) => p.unavailableReason);
    outcomes.push({ sourcePointId, slots: unavailable.map((p) => p.sourceSlot), old: old.kind === "derived" ? "derived" : old.reason,
      next: next.kind === "derived" ? "derived" : next.reason });
    if (!unavailable.length) {
      oldEvents.push(old.kind === "derived" ? old.events : null);
      newEvents.push(next.kind === "derived" ? next.events : null);
    }
  }
  expect(oldEvents).toHaveLength(8);
  expect(newEvents).toEqual(oldEvents);
  expect(outcomes).toEqual(historical.map(({ sourcePointId }) => {
    const missing = sourcePointId === hatteras.sourcePointId ? 24 : sourcePointId === "f11ccd59-b778-4ea1-a8ff-88bffb447cd8" ? 1 : 0;
    const unchanged = sourcePointId === "e8a921b7-c2b5-4259-9e5c-bd06765f7ae4" ? "unbounded_episode" : "derived";
    return { sourcePointId, slots: Array(missing).fill("s2"), old: missing ? "incomplete_partition" : unchanged, next: unchanged };
  }));
});

it("suppresses tied partial-frame assignments without a rank tiebreak", () => {
  const series = frames(0, -1);
  Object.assign(series[78][1], { directionDeg: 240, periodS: 10 });
  Object.assign(series[79][0], { directionDeg: 250, periodS: 9.5 }); gap(series, 79);
  expect(() => derive(series)).toThrow("ambiguous_partition_path");
});
it("preserves complete-frame unbounded episodes under the amended rule", () => {
  const series = frames();
  for (let i = 78; i <= 84; i++) Object.assign(series[i][1], { periodS: 20 });
  expect(() => derive(series)).toThrow("unbounded_episode");
});
it("rejects an unavailable primary marker even at an excluded hour", () => {
  const series = frames();
  series[166][0] = { kind: "unavailable", sourceSlot: "s1", forecastAt: at(166), reason: "provider_zero_tuple" } as unknown as Part;
  expect(() => derive(series)).toThrow("incomplete_partition");
});
