/**
 * @jest-environment node
 */

jest.mock("server-only", () => ({}));

import {
  enforceMajorEventHoldBeforeDiscoveryTruncation,
  sanitizeSurfDiscoveryForSerializationMajorEventHold,
  type EvaluateDiscoveryHoldCandidates,
} from "@/lib/services/discovery/major-event-hold";
import type {
  MajorEventHoldCandidate,
  MajorEventHoldCandidateDecision,
} from "@/lib/recommendations/major-event-hold/types";
import type {
  SurfDiscoveryRecommendation,
  SurfDiscoveryResponse,
} from "@/types/personalization";

const BEACH_IDS = [
  "11111111-1111-4111-8111-111111111111",
  "22222222-2222-4222-8222-222222222222",
  "33333333-3333-4333-8333-333333333333",
  "44444444-4444-4444-8444-444444444444",
] as const;
const STARTS = [
  "2026-07-19T18:00:00.000Z",
  "2026-07-19T19:00:00.000Z",
  "2026-07-19T20:00:00.000Z",
  "2026-07-19T21:00:00.000Z",
] as const;

function recommendation(
  index: number,
  overrides: Partial<SurfDiscoveryRecommendation> = {},
): SurfDiscoveryRecommendation {
  const start = STARTS[index];
  return {
    kind: "beach",
    customSpotId: null,
    visibility: null,
    isOwn: false,
    beach: {
      id: BEACH_IDS[index],
      name: `Beach ${index + 1}`,
      lat: 21.3,
      lon: -157.8,
    },
    window: {
      start: new Date(start),
      end: new Date(new Date(start).getTime() + 2 * 60 * 60 * 1000),
      tide: "Rising",
      wind: "5 mph E",
      waveHeight: "4 ft",
      wavePeriod: "14s",
      dataSource: "NOAA_NWS",
      confidence: 90 - index,
      timezone: "Pacific/Honolulu",
    },
    forecast: {
      beach_id: BEACH_IDS[index],
      forecast_at: start,
      wave_height: "4",
      wave_period: "14s",
      wind_speed: "5",
      wind_direction: "E",
    } as SurfDiscoveryRecommendation["forecast"],
    score: 95 - index * 5,
    matchQuality: "excellent",
    subscores: {
      waveHeightFit: 22,
      periodEnergyScore: 18,
      windAlignment: 19,
      tideFit: 14,
      affinityBonus: 0,
      personalizationBonus: 0,
      distancePenalty: 0,
    },
    summary: `Summary ${index + 1}`,
    reasons: [`Reason ${index + 1}`],
    warnings: [],
    similarity: null,
    generated_at: "2026-07-19T17:00:00.000Z",
    ...overrides,
  } as SurfDiscoveryRecommendation;
}

function allow(candidateId: string): MajorEventHoldCandidateDecision {
  return {
    candidateId,
    evaluation: {
      outcome: "allow",
      holdIds: [],
      holdEpoch: "epoch-1",
    },
    recommendationAvailability: {
      state: "available",
      holdEpoch: "epoch-1",
    },
  };
}

function blocked(candidateId: string): MajorEventHoldCandidateDecision {
  return {
    candidateId,
    evaluation: {
      outcome: "explicit_none",
      reasonCode: "major_event_hold",
      holdIds: ["hold-1"],
      expiresAt: "2026-07-21T00:00:00.000Z",
      holdEpoch: "epoch-1",
    },
    recommendationAvailability: {
      state: "none",
      reasonCode: "major_event_hold",
      expiresAt: "2026-07-21T00:00:00.000Z",
      holdEpoch: "epoch-1",
    },
  };
}

function waterQualityBlocked(
  candidateId: string,
): MajorEventHoldCandidateDecision {
  return {
    candidateId,
    evaluation: {
      outcome: "explicit_none",
      reasonCode: "water_quality_hold",
      holdIds: ["water-quality:held"],
      holdEpoch: "epoch-1",
    },
    recommendationAvailability: {
      state: "none",
      reasonCode: "water_quality_hold",
      holdEpoch: "epoch-1",
    },
  };
}

function response(
  recommendations: SurfDiscoveryRecommendation[],
): SurfDiscoveryResponse {
  return {
    recommendations,
    searchCriteria: { maxResults: 3 },
    metadata: {
      totalBeachesConsidered: recommendations.length,
      successfulForecasts: recommendations.length,
      partialSuccess: false,
      failedBeaches: 0,
      staleBeaches: 0,
      generated_at: "2026-07-19T17:00:00.000Z",
    },
    regionalCall: "Clean windows before lunch.",
  };
}

describe("Surf Discovery major-event hold integration", () => {
  it("evaluates the full sorted pool with verified experience and filters before maxResults", async () => {
    const ranked = [0, 1, 2, 3].map((index) => recommendation(index));
    const evaluate = jest.fn(
      async (input: {
        candidates: readonly MajorEventHoldCandidate[];
        profileExperience: unknown;
      }) =>
        input.candidates.map(({ candidateId }, index) =>
          index === 0 ? blocked(candidateId) : allow(candidateId),
        ),
    );

    const result = await enforceMajorEventHoldBeforeDiscoveryTruncation({
      recommendations: ranked,
      profileExperience: "beginner",
      maxResults: 3,
      isPrimaryEligible: () => true,
      evaluateCandidates: evaluate,
    });

    expect(evaluate).toHaveBeenCalledWith({
      candidates: expect.arrayContaining([
        {
          candidateId: `beach:${BEACH_IDS[0]}:${STARTS[0]}`,
          beachId: BEACH_IDS[0],
          startsAt: STARTS[0],
          endsAt: "2026-07-19T20:00:00.000Z",
        },
      ]),
      profileExperience: "beginner",
    });
    expect(evaluate.mock.calls[0][0].candidates).toHaveLength(4);
    expect(result.primaryRecommendations.map(({ beach }) => beach.name)).toEqual(
      ["Beach 2", "Beach 3", "Beach 4"],
    );
    expect(result.allAllowedRecommendations).toHaveLength(3);
    expect(result.recommendationAvailability).toEqual({
      state: "available",
      holdEpoch: "epoch-1",
    });
  });

  it("scopes a custom spot candidate to its curated nearest beach ID", async () => {
    const custom = recommendation(0, {
      kind: "custom_spot",
      customSpotId: "custom-spot-1",
      beach: {
        ...recommendation(0).beach,
        name: "Custom Reef",
      },
    });
    const evaluate = jest.fn(async (input: { candidates: readonly MajorEventHoldCandidate[] }) =>
      input.candidates.map(({ candidateId }) => allow(candidateId)),
    );

    await enforceMajorEventHoldBeforeDiscoveryTruncation({
      recommendations: [custom],
      profileExperience: "advanced",
      maxResults: 1,
      isPrimaryEligible: () => true,
      evaluateCandidates: evaluate,
    });

    expect(evaluate.mock.calls[0][0].candidates).toEqual([
      expect.objectContaining({
        candidateId: `custom:custom-spot-1:${STARTS[0]}`,
        beachId: BEACH_IDS[0],
      }),
    ]);
  });

  it("removes a water-quality-held beach from discovery before truncation", async () => {
    const ranked = [recommendation(0), recommendation(1), recommendation(2)];
    const evaluate = jest.fn(async ({ candidates }: {
      candidates: readonly MajorEventHoldCandidate[];
    }) => candidates.map(({ candidateId }, index) =>
      index === 0 ? waterQualityBlocked(candidateId) : allow(candidateId),
    ));

    const result = await enforceMajorEventHoldBeforeDiscoveryTruncation({
      recommendations: ranked,
      profileExperience: "beginner",
      maxResults: 3,
      isPrimaryEligible: () => true,
      evaluateCandidates: evaluate,
    });

    expect(result.primaryRecommendations.map(({ beach }) => beach.name)).toEqual([
      "Beach 2",
      "Beach 3",
    ]);
    expect(result.primaryRecommendations).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ beach: expect.objectContaining({ id: BEACH_IDS[0] }) })]),
    );
  });

  it("fails the whole pre-truncation pool closed for malformed decisions", async () => {
    const result = await enforceMajorEventHoldBeforeDiscoveryTruncation({
      recommendations: [recommendation(0), recommendation(1)],
      profileExperience: "intermediate",
      maxResults: 1,
      isPrimaryEligible: () => true,
      evaluateCandidates: jest.fn(async () => []),
    });

    expect(result.primaryRecommendations).toEqual([]);
    expect(result.allAllowedRecommendations).toEqual([]);
    expect(result.recommendationAvailability).toMatchObject({
      state: "none",
      reasonCode: "hold_state_unavailable",
    });
  });

  it("re-evaluates and sanitizes the post-calibration response on every serialization boundary", async () => {
    const ordinary = await enforceMajorEventHoldBeforeDiscoveryTruncation({
      recommendations: [recommendation(0)],
      profileExperience: "advanced",
      maxResults: 1,
      isPrimaryEligible: () => true,
      evaluateCandidates: jest.fn(async ({ candidates }) =>
        candidates.map(({ candidateId }) => allow(candidateId)),
      ),
    });
    const serializedResponse = response(ordinary.primaryRecommendations);
    const evaluate = jest
      .fn() as jest.MockedFunction<EvaluateDiscoveryHoldCandidates>;
    evaluate
      .mockImplementationOnce(async ({ candidates }) =>
        candidates.map(({ candidateId }: MajorEventHoldCandidate) =>
          allow(candidateId),
        ),
      )
      .mockImplementationOnce(async ({ candidates }) =>
        candidates.map(({ candidateId }: MajorEventHoldCandidate) =>
          blocked(candidateId),
        ),
      );

    const first = await sanitizeSurfDiscoveryForSerializationMajorEventHold(
      serializedResponse,
      "advanced",
      evaluate,
    );
    const second = await sanitizeSurfDiscoveryForSerializationMajorEventHold(
      serializedResponse,
      "advanced",
      evaluate,
    );

    expect(evaluate).toHaveBeenCalledTimes(2);
    expect(first.recommendations).toHaveLength(1);
    expect(second.recommendations).toEqual([]);
    expect(second.regionalCall).toBe("");
    expect(second.metadata).toEqual(serializedResponse.metadata);
    expect(second.recommendationAvailability).toMatchObject({
      state: "none",
      reasonCode: "major_event_hold",
    });
  });
});
