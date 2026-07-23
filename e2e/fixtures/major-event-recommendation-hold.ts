import type { RecommendationAvailability } from "@/lib/recommendations/major-event-hold/types";
import type { CanonicalSessionDecision } from "@/lib/recommendations/canonical-decision";

export type MajorEventHoldFixturePhase =
  | "available"
  | "held"
  | "cancelled";

export const HOLD_TEST_BEACH_ID = "11111111-1111-4111-8111-111111111111";
export const HOLD_TEST_BEACH_NAME = "Major Event Test Beach";
export const OBJECTIVE_WAVE_HEIGHT = "4-5ft";
export const HOLD_TEST_CANDIDATE_ID = "recommendation:major-event-e2e";

function recommendationAvailability(
  phase: MajorEventHoldFixturePhase,
): RecommendationAvailability {
  if (phase === "held") {
    return {
      state: "none" as const,
      reasonCode: "major_event_hold" as const,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      holdEpoch: "enforce:resolved:major-event-e2e",
    };
  }

  return {
    state: "available" as const,
    holdEpoch:
      phase === "cancelled"
        ? "enforce:resolved:major-event-cancelled-e2e"
        : "enforce:resolved:before-major-event-e2e",
  };
}

export function createCanonicalSessionDecisionFixture(input: {
  phase: MajorEventHoldFixturePhase;
  candidateId: string;
  beachId: string;
  beachName: string;
  windowStart: string;
  windowEnd: string;
  timezone: string;
  forecastId: string;
  forecastAt: string;
}): CanonicalSessionDecision {
  const availability = recommendationAvailability(input.phase);
  const held = input.phase === "held";
  const createdAt = new Date().toISOString();
  return {
    schemaVersion: "canonical-session-decision.v1",
    engineVersion: "rules.v1",
    decisionId: input.phase === "held"
      ? "b".repeat(64)
      : input.phase === "cancelled"
        ? "c".repeat(64)
        : "a".repeat(64),
    createdAt,
    expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    scope: {
      kind: "plan_next_session",
      windowStart: createdAt,
      windowEnd: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      timezone: input.timezone,
    },
    verdict: held ? "no" : "go",
    reasonCode: held ? "major_event_hold" : "selected_go",
    selection: held
      ? null
      : {
          candidateId: input.candidateId,
          beachId: input.beachId,
          beachName: input.beachName,
          windowStart: input.windowStart,
          windowEnd: input.windowEnd,
          timezone: input.timezone,
          forecastRef: {
            forecastId: input.forecastId,
            beachId: input.beachId,
            forecastAt: input.forecastAt,
          },
          skillEligibility: {
            skill: "intermediate",
            state: "eligible",
            reasonCodes: [],
          },
        },
    skillEligibility: held
      ? {
          skill: "intermediate",
          state: "ineligible",
          reasonCodes: ["major_event_hold"],
        }
      : {
          skill: "intermediate",
          state: "eligible",
          reasonCodes: [],
        },
    holdEpoch: availability.holdEpoch,
  };
}

export function createMajorEventDiscoveryFixture(
  phase: MajorEventHoldFixturePhase,
): Record<string, unknown> {
  const generatedAt = new Date().toISOString();
  const start = new Date(Date.now() + 60 * 60 * 1000);
  const end = new Date(Date.now() + 3 * 60 * 60 * 1000);
  const recommendation = {
    recommendationId: HOLD_TEST_CANDIDATE_ID,
    beach: {
      id: HOLD_TEST_BEACH_ID,
      name: HOLD_TEST_BEACH_NAME,
      slug: "major-event-test-beach",
      city: "San Diego",
      state: "CA",
      lat: 32.7702,
      lon: -117.2525,
      region: "California",
    },
    window: {
      start: start.toISOString(),
      end: end.toISOString(),
      tide: "Rising",
      wind: "5 mph NE",
      waveHeight: OBJECTIVE_WAVE_HEIGHT,
      wavePeriod: "14s",
      dataSource: "NOAA_NWS",
      confidence: 10,
      timezone: "America/Los_Angeles",
    },
    forecast: {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      beach_id: HOLD_TEST_BEACH_ID,
      forecast_date: generatedAt.slice(0, 10),
      forecast_time: "12:00",
      wave_height: OBJECTIVE_WAVE_HEIGHT,
      wave_period: "14",
      water_temp: "63",
      wind_speed: "5",
      wind_direction: "NE",
      tide_height: "2.8",
      tide_status: "Rising",
      confidence_score: 10,
      data_source: "NOAA_NWS",
      created_at: generatedAt,
      updated_at: generatedAt,
    },
    score: 91,
    matchQuality: "excellent",
    subscores: {
      waveHeightFit: 22,
      periodEnergyScore: 18,
      windAlignment: 16,
      tideFit: 11,
      affinityBonus: 6,
      personalizationBonus: 0,
      distancePenalty: 0,
    },
    summary: "Worth paddling out for a clean major-event test window.",
    reasons: ["Strong period", "Offshore winds"],
    warnings: [],
    waveHeightBadge: OBJECTIVE_WAVE_HEIGHT,
    distanceMiles: 2,
    similarity: null,
    generated_at: generatedAt,
  };

  return {
    success: true,
    timestamp: generatedAt,
    data: {
      // The held fixture deliberately carries stale positive fields. The fresh
      // explicit-none boundary must win over every one of them in the browser.
      recommendations: [recommendation],
      includedRecommendations: [recommendation],
      searchCriteria: { maxResults: 6 },
      metadata: {
        totalBeachesConsidered: 1,
        successfulForecasts: 1,
        partialSuccess: false,
        failedBeaches: 0,
        staleBeaches: 0,
        generated_at: generatedAt,
      },
      regionalCall: "Clean lines are worth the paddle.",
      lockedBestSpotTeaser: {
        beachName: HOLD_TEST_BEACH_NAME,
        scoreBand: "excellent",
      },
      recommendationAvailability: recommendationAvailability(phase),
      sessionDecision: createCanonicalSessionDecisionFixture({
        phase,
        candidateId: HOLD_TEST_CANDIDATE_ID,
        beachId: HOLD_TEST_BEACH_ID,
        beachName: HOLD_TEST_BEACH_NAME,
        windowStart: start.toISOString(),
        windowEnd: end.toISOString(),
        timezone: "America/Los_Angeles",
        forecastId: recommendation.forecast.id,
        forecastAt: start.toISOString(),
      }),
    },
  };
}

export function createMajorEventBulkForecastFixture(
  beachIds: readonly string[],
  phase: MajorEventHoldFixturePhase,
): Record<string, unknown> {
  const forecastAt = new Date();
  forecastAt.setUTCMinutes(0, 0, 0);
  const held = phase === "held";

  return {
    success: true,
    data: {
      forecasts: Object.fromEntries(
        beachIds.map((beachId) => [beachId, OBJECTIVE_WAVE_HEIGHT]),
      ),
      displayForecasts: Object.fromEntries(
        beachIds.map((beachId) => [
          beachId,
          {
            label: OBJECTIVE_WAVE_HEIGHT,
            minFt: 4,
            maxFt: 5,
            forecastAt: forecastAt.toISOString(),
            context: "today_headline",
          },
        ]),
      ),
      waterTemps: Object.fromEntries(
        beachIds.map((beachId) => [beachId, "63"]),
      ),
      isCalibrated: Object.fromEntries(
        beachIds.map((beachId) => [beachId, true]),
      ),
      conditionScores: held
        ? {}
        : Object.fromEntries(beachIds.map((beachId) => [beachId, 91])),
      conditionSummaries: Object.fromEntries(
        beachIds.map((beachId) => [beachId, held ? "UNKNOWN" : "GOOD"]),
      ),
      swellPartitions: Object.fromEntries(
        beachIds.map((beachId) => [
          beachId,
          {
            s1Dir: 270,
            swellDirOm: 270,
            s1PeriodS: 14,
            s1HeightFt: 3.5,
            s2Dir: null,
            s2PeriodS: null,
            s2HeightFt: null,
            windDir: 45,
            windMph: 8,
          },
        ]),
      ),
      swellPartitionTimeline: {},
      recommendationAvailability: recommendationAvailability(phase),
    },
  };
}
