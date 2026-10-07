/** @jest-environment node */
import config from "@/docs/operations/swell-watch-no-send-producer-config-v2-proposed.json";
import retained from "@/__tests__/fixtures/swell-watch-retained-20260920/event-identity-fragments.json";
import { deriveAttestedSwellWatchRun } from "@/lib/alerts/swell-watch/attested-run";
import { calculateSwellWatchConsistency, matchRegionalSwellEvent, type RegionalSwellEvaluation } from "@/lib/alerts/swell-watch/event-matcher";
import type { SwellWatchQualificationRule } from "@/lib/alerts/swell-watch/native-sampling";
import type { SwellWatchPolicy } from "@/lib/alerts/swell-watch/policy";

const policy = config.policy as SwellWatchPolicy;
const SAN_DIEGO = "4b0cf129-c706-4e24-8210-2219defc5ea7";
const OUTER_BANKS = "d264fbf8-0525-4d31-adb5-9a0742eaeb7e";
type Run = (typeof retained.runs)[number];
type Tuple = [number, number, number];

async function derive(run: Run) {
  const samples = (run.s1 as Tuple[]).map((primary, hour) => ({
    forecastAt: new Date(Date.parse(run.issuedAt) + hour * 3_600_000).toISOString(),
    components: ([["s1", primary], ["s2", (run.s2 as Tuple[])[hour]]] as Array<["s1" | "s2", Tuple]>).map(([sourceSlot, [heightM, periodS, directionDeg]]) => ({
      sourceSlot, heightM, periodS, directionDeg, rawFieldProvenance: {}, timeProvenance: {},
      ...(heightM === 0 && periodS === 0 && directionDeg === 0 ? { unavailableReason: "provider_zero_tuple" } : {}),
    })),
  }));
  const attested = { source: { provider: "open_meteo", transportProvider: "open_meteo_single_runs", model: "ncep_gfswave016",
    upstreamModelProvider: "ncep", sourcePointId: run.sourcePointId, issuedAt: run.issuedAt, issuanceId: run.issuanceId,
    evaluationId: run.evaluationId, providerBatchId: run.providerBatchId, revisionSetId: run.revisionSetId },
  forecastDays: 7, selectedGrid: {}, samples };
  const beaches = retained.beaches as Record<string, { beach: Parameters<typeof deriveAttestedSwellWatchRun>[0]["beach"] }>;
  const derived = await deriveAttestedSwellWatchRun({ providerBatchId: run.providerBatchId, sourcePointId: run.sourcePointId,
    now: run.evaluatedAt, qualificationRule: retained.qualificationRule as SwellWatchQualificationRule,
    beach: beaches[run.sourcePointId].beach, policy }, { rpc: async () => ({ data: attested, error: null }) });
  if (derived.kind !== "derived") throw new Error(`Retained run was suppressed: ${derived.reason}`);
  return derived.events;
}

/** Mirrors the database resolver: latest reference per event, never two spans of one issuance in one event. */
async function replay(sourcePointId: string) {
  const persisted: Array<{ regionalEventId: string; evaluationIds: Set<string>; reference: RegionalSwellEvaluation }> = [];
  const issuances: Array<{ issuedAt: string; events: Array<{ id: string; arrivalAt: string; peakAt: string }> }> = [];
  for (const run of retained.runs.filter((item) => item.sourcePointId === sourcePointId)) {
    const events = [];
    for (const event of await derive(run)) {
      const evaluation: RegionalSwellEvaluation = { regionKey: "retained", identity: { kind: "genuine_completed", id: run.evaluationId },
        peakAt: event.peakAt, impact: event.impact };
      const matched = matchRegionalSwellEvent([evaluation], policy, {
        persistedEvents: persisted.filter((item) => !item.evaluationIds.has(run.evaluationId))
          .map((item) => ({ regionalEventId: item.regionalEventId, regionKey: "retained", aliases: [], reference: item.reference })),
        allocateId: () => `event-${persisted.length + 1}`,
      });
      if (matched.regionalEventId === null) throw new Error(`Unresolved identity: ${matched.reason}`);
      const existing = persisted.find((item) => item.regionalEventId === matched.regionalEventId);
      if (existing) { existing.reference = evaluation; existing.evaluationIds.add(run.evaluationId); }
      else persisted.push({ regionalEventId: matched.regionalEventId, evaluationIds: new Set([run.evaluationId]), reference: evaluation });
      events.push({ id: matched.regionalEventId, arrivalAt: event.arrivalAt, peakAt: event.peakAt });
    }
    issuances.push({ issuedAt: run.issuedAt, events });
  }
  return issuances;
}

function productionIds(sourcePointId: string): string[] {
  return [...new Set(retained.runs.filter((run) => run.sourcePointId === sourcePointId)
    .flatMap((run) => run.productionEvents.map((event) => event.regionalEventId)))];
}

function hoursBetween(left: string, right: string): number {
  return Math.abs(Date.parse(left) - Date.parse(right)) / 3_600_000;
}

it("records the production fragmentation this fixture was retained for", () => {
  expect(productionIds(SAN_DIEGO)).toHaveLength(4);
  expect(productionIds(OUTER_BANKS)).toHaveLength(7);
  const [first, second] = retained.runs.filter((run) => run.sourcePointId === SAN_DIEGO);
  // Arrival stayed inside the 6 h tolerance; the peak of a flat swell moved 9 h and broke the endpoint match.
  expect(hoursBetween(first.productionEvents[0].arrivalAt, second.productionEvents[0].arrivalAt)).toBe(6);
  expect(hoursBetween(first.productionEvents[0].peakAt, second.productionEvents[0].peakAt)).toBe(9);
  // The second span of one issuance always received a fresh identity, even when it repeated the prior issuance.
  expect(second.productionEvents[1].arrivalAt).toBe(first.productionEvents[0].arrivalAt);
  expect(second.productionEvents[1].regionalEventId).not.toBe(first.productionEvents[0].regionalEventId);
});

it("rejoins a swell that one provider frame split inside an issuance", async () => {
  const [, split] = retained.runs.filter((run) => run.sourcePointId === SAN_DIEGO);
  const events = await derive(split);
  expect(split.productionEvents).toHaveLength(2);
  expect(events).toHaveLength(1);
  const arrivalAt = new Date(split.productionEvents[0].arrivalAt).toISOString();
  expect(events[0]).toMatchObject({ arrivalAt, peakAt: new Date(split.productionEvents[1].peakAt).toISOString() });
  expect(events[0].impact).toMatchObject({ arrivalAt, partition: { heightM: 1.02, periodS: 12.75, directionDeg: 207 } });
  expect(Date.parse(events[0].closureWindow.latestAt)).toBeGreaterThan(Date.parse(events[0].peakAt));
});

it("keeps the San Diego swell of 24-25 September on one identity across issuances", async () => {
  const issuances = await replay(SAN_DIEGO);
  expect(issuances.map((issuance) => issuance.events.map((event) => event.id))).toEqual([["event-1"], ["event-1"], ["event-1"], [], []]);
});

it("keeps the Outer Banks swell of 25 September on one identity without absorbing its neighbours", async () => {
  const issuances = await replay(OUTER_BANKS);
  expect(issuances.map((issuance) => issuance.events.map((event) => event.id))).toEqual([
    ["event-1"],
    // The provider reports no swell partition for 19 h between these spans; they stay distinct.
    ["event-1", "event-2"],
    ["event-2"],
    ["event-2"],
    // A 9.8 s forerunner a day and a half earlier is a different event.
    ["event-3", "event-2"],
  ]);
  const main = issuances.flatMap((issuance) => issuance.events).filter((event) => event.id === "event-2");
  expect(main.map((event) => event.arrivalAt)).toEqual(["2026-09-25T15:00:00.000Z", "2026-09-25T09:00:00.000Z",
    "2026-09-25T12:00:00.000Z", "2026-09-25T06:00:00.000Z"]);
});

describe("distinct swells", () => {
  function evaluation(id: string, arrivalAt: string, peakAt: string, directionDeg = 207, periodS = 13): RegionalSwellEvaluation {
    return { regionKey: "retained", identity: { kind: "genuine_completed", id }, peakAt,
      impact: { kind: "candidate", policyHash: policy.value_hash, arrivalAt,
        partition: { provider: "open_meteo", evaluationId: id, forecastAt: peakAt, sourceSlot: "s1", heightM: 1, periodS, directionDeg, completeness: "complete" } } };
  }
  const prior = evaluation("genuine_completed:a", "2026-09-24T22:00:00Z", "2026-09-25T03:00:00Z");

  it("matches a moved peak and a moved arrival of the same span", () => {
    expect(calculateSwellWatchConsistency(prior, evaluation("genuine_completed:b", "2026-09-24T16:00:00Z", "2026-09-24T18:00:00Z"), policy)).not.toBeNull();
    expect(calculateSwellWatchConsistency(prior, evaluation("genuine_completed:b", "2026-09-25T09:00:00Z", "2026-09-25T20:00:00Z"), policy)).toBe(0);
  });

  it("keeps a swell from the same direction a few days later separate", () => {
    expect(calculateSwellWatchConsistency(prior, evaluation("genuine_completed:b", "2026-09-27T22:00:00Z", "2026-09-28T03:00:00Z"), policy)).toBeNull();
    expect(calculateSwellWatchConsistency(prior, evaluation("genuine_completed:b", "2026-09-25T10:00:00Z", "2026-09-25T20:00:00Z"), policy)).toBeNull();
  });

  it("keeps simultaneous swells from different directions or periods separate", () => {
    expect(calculateSwellWatchConsistency(prior, evaluation("genuine_completed:b", "2026-09-24T22:00:00Z", "2026-09-25T03:00:00Z", 233), policy)).toBeNull();
    expect(calculateSwellWatchConsistency(prior, evaluation("genuine_completed:b", "2026-09-24T22:00:00Z", "2026-09-25T03:00:00Z", 207, 15.1), policy)).toBeNull();
  });
});
