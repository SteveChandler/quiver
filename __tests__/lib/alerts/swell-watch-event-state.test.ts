import fixturePolicy from "@/__tests__/fixtures/swell-watch-provisional-policy.json";
import {
  matchRegionalSwellEvent,
  calculateSwellWatchConsistency,
  type RegionalSwellEvaluation,
} from "@/lib/alerts/swell-watch/event-matcher";
import type { SwellWatchPolicy } from "@/lib/alerts/swell-watch/policy";

const policy = fixturePolicy as SwellWatchPolicy;
function evaluation(
  id: string | null,
  direction = 359,
  arrivalAt = "2026-09-06T12:00:00.000Z",
  peakAt = "2026-09-07T12:00:00.000Z",
): RegionalSwellEvaluation {
  return {
    regionKey: "southern-california",
    identity:
      id === null
        ? { kind: "immutable_issuance_unavailable", id: null }
        : { kind: "synthetic_fixture", id },
    peakAt,
    impact: {
      kind: "candidate",
      partition: {
        provider: "noaa",
        evaluationId: id ?? "unknown",
        forecastAt: "2026-09-06T12:00:00.000Z",
        sourceSlot: "s2",
        heightM: 1,
        periodS: 13,
        directionDeg: direction,
        completeness: "complete",
      },
      projectedFaceHeightFt: 2,
      heightRiseFt: 1.8,
      energyRatio: 2,
      arrivalAt,
      policyId: policy.profile_id,
      policyHash: policy.value_hash,
    },
  };
}

describe("regional swell event state", () => {
  it("scores distinct genuine evaluations using circular direction and timing consistency", () => {
    const prior = evaluation("one", 359);
    const current = evaluation("two", 1);
    prior.identity = { kind: "genuine_completed", id: "one" };
    current.identity = { kind: "genuine_completed", id: "two" };
    expect(calculateSwellWatchConsistency(prior, current, policy)).toBe(0.92);
    current.peakAt = "2026-09-07T15:00:00.000Z";
    expect(calculateSwellWatchConsistency(prior, current, policy)).toBe(0.5);
    current.peakAt = "2026-09-08T12:00:00.000Z";
    expect(calculateSwellWatchConsistency(prior, current, policy)).toBeNull();
    expect(calculateSwellWatchConsistency(prior, prior, policy)).toBeNull();
    expect(calculateSwellWatchConsistency(evaluation("fixture"), current, policy)).toBeNull();
  });

  it("suppresses ambiguous persisted identities regardless of row order", () => {
    const persistedEvents = ["55555555-5555-4555-8555-555555555555", "66666666-6666-4666-8666-666666666666"].map((regionalEventId) => ({
      regionalEventId, regionKey: "southern-california", aliases: [], reference: evaluation("prior", 1),
    }));
    const allocateId = jest.fn();
    for (const events of [persistedEvents, [...persistedEvents].reverse()]) {
      expect(matchRegionalSwellEvent([evaluation("one"), evaluation("two", 1)], policy, {
        allowSyntheticFixture: true, persistedEvents: events, allocateId,
      })).toEqual({ regionalEventId: null, regionKey: "southern-california", evaluationIds: [], status: "suppressed", reason: "ambiguous_persisted_event" });
    }
    expect(allocateId).not.toHaveBeenCalled();
  });

  it("treats multiple compatible references to one persisted identity as one event", () => {
    const regionalEventId = "55555555-5555-4555-8555-555555555555";
    const allocateId = jest.fn();
    const result = matchRegionalSwellEvent([evaluation("one"), evaluation("two", 1)], policy, {
      allowSyntheticFixture: true, allocateId,
      persistedEvents: [1, 2].map((direction) => ({ regionalEventId, regionKey: "southern-california", aliases: [], reference: evaluation("prior", direction) })),
    });
    expect(result).toMatchObject({ regionalEventId, status: "stable" });
    expect(allocateId).not.toHaveBeenCalled();
  });

  it("requires two distinct coherent evaluation identities", () => {
    expect(
      matchRegionalSwellEvent([evaluation("one"), evaluation("one")], policy, {
        allowSyntheticFixture: true,
      }),
    ).toMatchObject({
      status: "candidate",
      reason: "insufficient_distinct_evaluations",
    });
    expect(
      matchRegionalSwellEvent(
        [evaluation("one"), evaluation("two", 1)],
        policy,
        { allowSyntheticFixture: true },
      ),
    ).toMatchObject({ status: "stable", evaluationIds: ["one", "two"] });
  });

  it("suppresses unknown provider issuance and contradictions", () => {
    expect(matchRegionalSwellEvent([evaluation(null)], policy)).toMatchObject({
      status: "suppressed",
      reason: "missing_immutable_issuance",
    });
    expect(
      matchRegionalSwellEvent(
        [evaluation("one"), evaluation("two", 120)],
        policy,
        { allowSyntheticFixture: true },
      ),
    ).toMatchObject({
      status: "candidate",
      reason: "insufficient_distinct_evaluations",
    });
  });

  it("requires contiguous coherent evaluations and retains a persisted UUID", () => {
    const first = {
      ...evaluation("one"),
      persistedRegionalEventId: "33333333-3333-4333-8333-333333333333",
    };
    const broken = {
      ...evaluation("two"),
      impact: {
        kind: "suppressed" as const,
        reason: "source_contradiction" as const,
      },
    };
    const resumed = {
      ...evaluation("three", 1),
      persistedRegionalEventId: "33333333-3333-4333-8333-333333333333",
    };
    expect(
      matchRegionalSwellEvent([first, broken, resumed], policy, {
        allowSyntheticFixture: true,
      }),
    ).toMatchObject({ status: "candidate", evaluationIds: ["three"] });
    expect(
      matchRegionalSwellEvent([first, resumed], policy, {
        allowSyntheticFixture: true,
      }),
    ).toMatchObject({
      status: "stable",
      regionalEventId: "33333333-3333-4333-8333-333333333333",
    });
  });

  it("allocates one opaque identity for a bounded episode and reuses a persisted alias", () => {
    const first = matchRegionalSwellEvent(
      [evaluation("one"), evaluation("two", 1)],
      policy,
      {
        allowSyntheticFixture: true,
        allocateId: () => "55555555-5555-4555-8555-555555555555",
      },
    );
    expect(first).toMatchObject({
      status: "stable",
      regionalEventId: "55555555-5555-4555-8555-555555555555",
    });

    const reranked = matchRegionalSwellEvent(
      [evaluation("three", 5), evaluation("four", 7)],
      policy,
      {
        allowSyntheticFixture: true,
        persistedEvents: [
          {
            regionalEventId: first.regionalEventId!,
            regionKey: "southern-california",
            aliases: first.aliases ?? [],
            reference: evaluation("two", 1),
          },
        ],
      },
    );
    expect(reranked.regionalEventId).toBe(first.regionalEventId);
  });

  it("does not let an old measurement alias or incompatible persisted ID join a new episode", () => {
    const oldReference = evaluation(
      "old-one",
      1,
      "2026-06-06T12:00:00.000Z",
      "2026-06-07T12:00:00.000Z",
    );
    const current = {
      ...evaluation("new-one"),
      persistedRegionalEventId: "55555555-5555-4555-8555-555555555555",
    };
    const result = matchRegionalSwellEvent([current], policy, {
      allowSyntheticFixture: true,
      persistedEvents: [
        {
          regionalEventId: "55555555-5555-4555-8555-555555555555",
          regionKey: "southern-california",
          aliases: ["55555555-5555-4555-8555-555555555555"],
          reference: oldReference,
        },
      ],
      allocateId: () => "66666666-6666-4666-8666-666666666666",
    });
    expect(result.regionalEventId).toBe("66666666-6666-4666-8666-666666666666");
  });
});
