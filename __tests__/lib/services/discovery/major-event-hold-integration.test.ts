/**
 * @jest-environment node
 */

jest.mock("server-only", () => ({}));

import {
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
    // The orchestrator assigns this before serialization (recommendationIdFor).
    recommendationId: `beach:${BEACH_IDS[index]}:${start}`,
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

describe("Surf Discovery major-event hold serialization boundary", () => {
  it("re-evaluates and sanitizes the post-calibration response on every serialization boundary", async () => {
    const serializedResponse = response([recommendation(0)]);
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

  it("still suppresses a resolved water-quality closure at the boundary", async () => {
    const serializedResponse = response([
      recommendation(0),
      recommendation(1),
    ]);
    const evaluate: jest.MockedFunction<EvaluateDiscoveryHoldCandidates> =
      jest.fn(async ({ candidates }) =>
        candidates.map(({ candidateId }: MajorEventHoldCandidate, index) =>
          index === 0 ? waterQualityBlocked(candidateId) : allow(candidateId),
        ),
      );

    const sanitized = await sanitizeSurfDiscoveryForSerializationMajorEventHold(
      serializedResponse,
      "beginner",
      evaluate,
    );

    expect(sanitized.recommendations.map(({ beach }) => beach.id)).toEqual([
      BEACH_IDS[1],
    ]);
  });
});
