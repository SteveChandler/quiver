/** @jest-environment node */
import fixturePolicy from "@/__tests__/fixtures/swell-watch-provisional-policy.json";
import { calculateSwellWatchConsistency, matchRegionalSwellEvent, type RegionalSwellEvaluation } from "@/lib/alerts/swell-watch/event-matcher";
import type { SwellWatchPolicy } from "@/lib/alerts/swell-watch/policy";

const policy = fixturePolicy as SwellWatchPolicy;
const priorId = "11111111-1111-4111-8111-111111111111";
const currentId = "22222222-2222-4222-8222-222222222222";
const canonicalId = "33333333-3333-4333-8333-333333333333";
const aliasId = "44444444-4444-4444-8444-444444444444";

function evaluation(id: string, persistedRegionalEventId?: string): RegionalSwellEvaluation {
  return { regionKey: "fixture", identity: { kind: "genuine_completed", id }, persistedRegionalEventId,
    peakAt: "2026-09-08T06:00:00Z", impact: { kind: "candidate", policyHash: policy.value_hash, arrivalAt: "2026-09-08T00:00:00Z",
      partition: { provider: "open_meteo", evaluationId: id, forecastAt: "2026-09-08T00:00:00Z", sourceSlot: "s2",
        heightM: 1.8, periodS: 13, directionDeg: 170, completeness: "complete" } } };
}

it("does not derive consistency from non-current history", () => {
  expect(calculateSwellWatchConsistency({ ...evaluation(priorId), current: false }, evaluation(currentId), policy)).toBeNull();
});

it("resolves a persisted alias to its canonical event", () => {
  const matched = matchRegionalSwellEvent([evaluation(currentId, aliasId)], policy, {
    persistedEvents: [{ regionalEventId: canonicalId, regionKey: "fixture", aliases: [aliasId], reference: evaluation(priorId) }],
  });
  expect(matched.regionalEventId).toBe(canonicalId);
});
