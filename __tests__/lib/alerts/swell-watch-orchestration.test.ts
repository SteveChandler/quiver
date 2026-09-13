import fixturePolicy from "@/__tests__/fixtures/swell-watch-provisional-policy.json";
import { selectSwellWatchAudience, type SwellWatchAudienceRows } from "@/lib/alerts/swell-watch/audience";
import { matchRegionalSwellEvent, type RegionalSwellEvaluation } from "@/lib/alerts/swell-watch/event-matcher";
import { evaluateSwellWatchImpact } from "@/lib/alerts/swell-watch/impact-evaluator";
import { normalizeSwellPartitions, type SwellPartitionInput } from "@/lib/alerts/swell-watch/partition-normalizer";
import { consolidateRegionalSwellEvents, consolidateSwellWatchRecipients, type RegionalBeachCandidate, type SwellWatchRecipientCandidate } from "@/lib/alerts/swell-watch/regional-consolidator";
import { evaluateSwellWatchHolds, type SwellWatchSafetyStore } from "@/lib/alerts/swell-watch/safety-control";

const EVENT_ID = "11111111-1111-4111-8111-111111111111";
const NOW = new Date("2026-07-01T00:00:00.000Z");
const policy = fixturePolicy as any;
const partition = (evaluationId: string, sourceSlot: "s1" | "s2", periodS: number, directionDeg: number) => ({ provider: "noaa" as const, evaluationId, forecastAt: "2026-07-04T00:00:00.000Z", sourceSlot, heightM: 2, periodS, directionDeg });
const impact = (value: ReturnType<typeof partition>, activePolicy = policy) => ({
  partition: { ...value, completeness: "complete" as const },
  baselineHeightFt: 1, baselineEnergy: 8, arrivalAt: value.forecastAt, now: NOW,
  beach: { swell_window_center_deg: 170, swell_window_halfwidth_deg: 90 }, policy: activePolicy, seamContinuous: true, sourceCoherent: true,
});
const store = () => ({
  getControl: async () => ({ state: "armed" as const, epoch: 1, reasonCode: "fixture" }),
  getAuthority: async () => null,
  transition: jest.fn().mockResolvedValue({ state: "held" as const, epoch: 2, reasonCode: "candidate_cap_exceeded" }),
});

function candidate(beachId: string, activePolicy = policy) {
  const prior = evaluateSwellWatchImpact(impact(partition("fixture-a", "s2", 13, 170), activePolicy));
  if (prior.kind !== "candidate") throw new Error("fixture must qualify");
  return {
    beachId, regionKey: "region-a", s1: partition("fixture-b", "s1", 9, 270), partition: partition("fixture-b", "s2", 13, 170), peakAt: "2026-07-04T03:00:00.000Z", confidence: 0.75,
    persistedRegionalEventId: EVENT_ID,
    history: [{ regionKey: "region-a", identity: { kind: "synthetic_fixture" as const, id: "fixture-a" }, impact: prior, peakAt: "2026-07-04T03:00:00.000Z" }],
    impact: { baselineHeightFt: 1, baselineEnergy: 8, arrivalAt: "2026-07-04T00:00:00.000Z", beach: { swell_window_center_deg: 170, swell_window_halfwidth_deg: 90 }, policy: activePolicy, seamContinuous: true, sourceCoherent: true },
  };
}

type FixtureCandidate = ReturnType<typeof candidate>;
async function runFixture(input: { candidates: FixtureCandidate[]; audience: SwellWatchAudienceRows; activePolicy: any; signals: { hasDiscontinuousData: boolean; hasMaterialDisagreement: boolean; stale: boolean; providerFailures: { samples: number; failures: number } }; safetyStore: SwellWatchSafetyStore; expectedEpoch: number; holdKey: string; simulateEnqueue?: (recipient: string, event: string, beach: string) => Promise<"enqueued" | "duplicate"> }) {
  const regional: RegionalBeachCandidate[] = [];
  const recipients: SwellWatchRecipientCandidate[] = [];
  const lead = new Map<string, string>();
  const selectedSourceSlots: Array<"s1" | "s2"> = [];
  for (const item of input.candidates) {
    const normalized = normalizeSwellPartitions([item.s1, item.partition] as SwellPartitionInput[]);
    if (normalized.kind === "suppressed") continue;
    const selected = normalized.observations.find((observation) => observation.sourceSlot === "s2");
    if (!selected) continue;
    selectedSourceSlots.push(selected.sourceSlot);
    const result = evaluateSwellWatchImpact({ ...item.impact, partition: selected, now: NOW });
    if (result.kind === "suppressed") continue;
    const current: RegionalSwellEvaluation = { regionKey: item.regionKey, identity: { kind: "synthetic_fixture", id: item.partition.evaluationId }, impact: result, peakAt: item.peakAt, persistedRegionalEventId: item.persistedRegionalEventId };
    const event = matchRegionalSwellEvent([...item.history, current], input.activePolicy, { allowSyntheticFixture: true });
    regional.push({ beachId: item.beachId, regionalEvent: event });
    if (event.status !== "stable" || !event.regionalEventId) continue;
    lead.set(item.beachId, item.beachId);
    for (const member of selectSwellWatchAudience([item.beachId], input.audience)) recipients.push({ recipientUserId: member.recipientUserId, regionalEventId: event.regionalEventId, beachId: member.beachId, reason: member.reason, projectedImpact: result.projectedFaceHeightFt, confidence: item.confidence });
  }
  const regionalEvents = consolidateRegionalSwellEvents(regional);
  const consolidated = consolidateSwellWatchRecipients(recipients);
  const hold = await evaluateSwellWatchHolds({ policy: input.activePolicy, store: input.safetyStore, expectedEpoch: input.expectedEpoch, idempotencyKey: input.holdKey, candidateCount: regional.length, recipientCount: consolidated.length, projectedSendCount: consolidated.length, ...input.signals });
  if (hold.held || !input.simulateEnqueue) return { regionalEvents, recipients: consolidated, hold, selectedSourceSlots, simulatedEnqueued: 0, simulatedDuplicates: 0 };
  let simulatedEnqueued = 0; let simulatedDuplicates = 0;
  for (const recipient of consolidated) {
    const result = await input.simulateEnqueue(recipient.recipientUserId, recipient.regionalEventId, lead.get(recipient.leadBeachId) ?? recipient.leadBeachId);
    if (result === "enqueued") simulatedEnqueued += 1; else simulatedDuplicates += 1;
  }
  return { regionalEvents, recipients: consolidated, hold, selectedSourceSlots, simulatedEnqueued, simulatedDuplicates };
}

describe("pure Swell Watch fixture composition without persistence or release", () => {
  it("stabilizes two synthetic evaluations, consolidates recipients, and simulates one enqueue", async () => {
    const enqueue = jest.fn().mockResolvedValue("enqueued");
    const result = await runFixture({
      candidates: [candidate("beach-a"), candidate("beach-b")], activePolicy: policy, safetyStore: store(), expectedEpoch: 1, holdKey: "fixture-hold-a", simulateEnqueue: enqueue, signals: { hasDiscontinuousData: false, hasMaterialDisagreement: false, stale: false, providerFailures: { samples: 0, failures: 0 } },
      audience: { profiles: [{ id: "user-a", homeBeachId: "beach-a", notifPushEnabled: true, notifForecastAlerts: true }], favorites: [{ userId: "user-a", beachId: "beach-b", alertsEnabled: true }], rules: [], devices: [{ userId: "user-a" }] },
    });
    expect(result.regionalEvents).toEqual([expect.objectContaining({ regionalEventId: EVENT_ID, beachIds: ["beach-a", "beach-b"] })]);
    expect(result.recipients).toEqual([expect.objectContaining({ recipientUserId: "user-a", regionalEventId: EVENT_ID, leadBeachId: "beach-a" })]);
    expect(result.selectedSourceSlots).toEqual(["s2", "s2"]);
    expect(enqueue).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ simulatedEnqueued: 1, simulatedDuplicates: 0, hold: { held: false } });
  });

  it("holds stable fixture candidates for an explicit discontinuity signal before enqueue", async () => {
    const safety = store();
    const enqueue = jest.fn();
    const result = await runFixture({
      candidates: [candidate("beach-a"), candidate("beach-b")], activePolicy: policy, safetyStore: safety, expectedEpoch: 1, holdKey: "fixture-hold-b", simulateEnqueue: enqueue, signals: { hasDiscontinuousData: true, hasMaterialDisagreement: false, stale: false, providerFailures: { samples: 0, failures: 0 } },
      audience: { profiles: [], favorites: [], rules: [], devices: [] },
    });
    expect(result.regionalEvents).toEqual([expect.objectContaining({ status: "stable" })]);
    expect(result.hold.held).toBe(true);
    expect(enqueue).not.toHaveBeenCalled();
    expect(safety.transition).toHaveBeenCalledWith(expect.objectContaining({ reasonCode: "data_discontinuity" }));
  });

  it("counts a simulated duplicate callback without claiming a second enqueue", async () => {
    const enqueue = jest.fn().mockResolvedValue("duplicate");
    const result = await runFixture({
      candidates: [candidate("beach-a")], activePolicy: policy, safetyStore: store(), expectedEpoch: 1, holdKey: "fixture-hold-c", simulateEnqueue: enqueue, signals: { hasDiscontinuousData: false, hasMaterialDisagreement: false, stale: false, providerFailures: { samples: 0, failures: 0 } },
      audience: { profiles: [{ id: "user-a", homeBeachId: "beach-a", notifPushEnabled: true, notifForecastAlerts: true }], favorites: [], rules: [], devices: [{ userId: "user-a" }] },
    });
    expect(enqueue).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ simulatedEnqueued: 0, simulatedDuplicates: 1, hold: { held: false } });
  });
});
