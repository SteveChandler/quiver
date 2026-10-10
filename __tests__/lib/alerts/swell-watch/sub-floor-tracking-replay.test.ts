/** @jest-environment node */
import { gunzipSync } from "node:zlib";
import proposed from "@/docs/operations/swell-watch-no-send-producer-config-v2-proposed.json";
import floored from "@/docs/operations/swell-watch-no-send-producer-config-v3-proposed.json";
import { ingestAttestedSwellWatchCohort } from "@/lib/alerts/swell-watch/provider-impact-ingestion";
import { SUB_FLOOR_TRACKING_MODE } from "@/lib/alerts/swell-watch/native-sampling";
import type { SwellWatchPolicy } from "@/lib/alerts/swell-watch/policy";
import { swellWatchAttestedReplayGzipBase64 } from "@/__tests__/fixtures/swell-watch-attested-replay-20260910";

type ReplayItem = { sourcePointId: string; latitude: number; longitude: number; beach: Record<string, unknown>;
  run: { source: { evaluationId: string; issuedAt: string; providerBatchId: string }; samples: unknown[] } };
const replay = (JSON.parse(gunzipSync(Buffer.from(swellWatchAttestedReplayGzipBase64, "base64")).toString()).rows[0].value) as ReplayItem[];
const bySource = new Map(replay.map((item) => [item.sourcePointId, item]));
const first = replay[0].run.source;
const scopes = proposed.cohort.map(({ sourcePointId, regionKey }) => {
  const item = bySource.get(sourcePointId)!;
  return { sourcePointId, regionKey, latitude: item.latitude, longitude: item.longitude, beach: item.beach };
});

async function ingest(now: string, trackingMode?: typeof SUB_FLOOR_TRACKING_MODE, policy: SwellWatchPolicy = proposed.policy as SwellWatchPolicy) {
  const calls: Array<[string, unknown]> = [];
  const rpc = jest.fn(async (name: string, args: Record<string, string>) => {
    calls.push([name, args]);
    if (name === "read_swell_watch_run_scope") return { data: { providerBatchId: first.providerBatchId, evaluationId: first.evaluationId,
      issuedAt: first.issuedAt, scopeHash: "a".repeat(64), expectedComponentCount: 3360, scopes: scopes.map((scope) => ({ ...scope, forecastDays: 7 })) }, error: null };
    if (name === "read_swell_watch_attested_run") return { data: (bySource.get(args.p_source_point_id) as ReplayItem).run, error: null };
    if (name === "ingest_swell_watch_cohort") return { data: (args as unknown as { p_impacts: unknown[] }).p_impacts.map((_, ordinal) => ({ ordinal,
      regional_event_id: first.providerBatchId, event_state: "candidate" })), error: null };
    throw new Error(`Forbidden replay write: ${name}`);
  });
  const result = await ingestAttestedSwellWatchCohort({ qualificationRule: "complete_partitions.v1", providerBatchId: first.providerBatchId,
    forecastDays: 7, now, policy, scopes: scopes as never,
    ...(trackingMode ? { trackingMode } : {}) }, { rpc, from: jest.fn() as never } as never);
  return { result, calls };
}

describe.each(["2026-09-10T00:00:00Z", "2026-09-10T06:00:00Z"])("retained 2026-09-09T18Z issuance analysed at %s", (now) => {
  it("persists exactly the same events and diagnostics with tracking enabled, and adds only the tracking field", async () => {
    const baseline = await ingest(now);
    const tracked = await ingest(now, SUB_FLOOR_TRACKING_MODE);
    expect(baseline.result).not.toHaveProperty("trackingEvents");
    const { trackingEvents, ...trackedRest } = tracked.result as typeof tracked.result & { trackingEvents?: unknown[] };
    expect(trackedRest).toEqual(baseline.result);
    // Row ids are random per call; everything else sent to the database must match exactly.
    const stable = (calls: typeof baseline.calls) => JSON.parse(JSON.stringify(calls).replace(/"p_(impact|observation)_id":"[0-9a-f-]+"/g, '"p_$1_id":"id"'));
    expect(stable(tracked.calls)).toEqual(stable(baseline.calls));
    expect(Array.isArray(trackingEvents)).toBe(true);
    for (const event of trackingEvents as Array<{ sourcePointId: string; phase: string; arrivalWindow: { earliestAt: string } }>) {
      expect(["approaching", "in_progress"]).toContain(event.phase);
      expect((Date.parse(event.arrivalWindow.earliestAt) - Date.parse(now)) / 86_400_000).toBeLessThan(2);
    }
  });
});

describe("period floor on the retained 2026-09-09T18Z issuance", () => {
  it.each(["2026-09-10T00:00:00Z", "2026-09-10T06:00:00Z"])("drops the only sub-9 s event and the short-period suppression at %s", async (now) => {
    const approved = await ingest(now);
    const amended = await ingest(now, undefined, floored.policy as SwellWatchPolicy);
    const periods = (cohort: typeof approved.result) => (cohort as { runs: Array<{ events: Array<{ impact: { partition: { periodS: number } } }> }> })
      .runs.flatMap((run) => run.events.map((event) => event.impact.partition.periodS));
    expect(periods(approved.result)).toEqual([8.5]);
    expect(approved.result.scopeOutcomes.filter((outcome) => outcome.reason === "unbounded_episode")).toHaveLength(1);
    expect(periods(amended.result)).toEqual([]);
    expect(amended.result.scopeOutcomes.filter((outcome) => outcome.reason === "unbounded_episode")).toHaveLength(0);
    expect(amended.result.scopeOutcomes.filter((outcome) => outcome.status === "derived")).toHaveLength(8);
  });
});
