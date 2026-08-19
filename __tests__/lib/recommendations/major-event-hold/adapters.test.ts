/**
 * @jest-environment node
 */

import { sanitizeSurfDiscoveryForMajorEventHold } from "@/lib/recommendations/major-event-hold/adapters/surf-discovery";
import { sanitizeSurfCallForMajorEventHold } from "@/lib/recommendations/major-event-hold/adapters/surf-call";
import { sanitizeWeekScoutForMajorEventHold } from "@/lib/recommendations/major-event-hold/adapters/week-scout";
import {
  sanitizeBulkForecastForMajorEventHold,
  sanitizeScoredForecastForMajorEventHold,
  type BulkForecastCandidateBinding,
  type ScoredForecastGoldenWindowBinding,
  type ScoredForecastSlotBinding,
} from "@/lib/recommendations/major-event-hold/adapters/bulk-forecast";
import {
  buildDailyIntelMajorEventHoldCandidate,
  sanitizeCoachPicksForMajorEventHold,
  sanitizeDailyIntelForMajorEventHold,
  sanitizeLegacyV1RecommendationsForMajorEventHold,
} from "@/lib/recommendations/major-event-hold/adapters/legacy";
import {
  sanitizeIntentForecastForMajorEventHold,
  type IntentForecastHoldInput,
} from "@/lib/recommendations/major-event-hold/adapters/intent";
import type {
  MajorEventHoldCandidate,
  MajorEventHoldCandidateDecision,
} from "@/lib/recommendations/major-event-hold/types";
import type { SurfCallResult } from "@/lib/utils/surf-call-logic";
import type { WeekScoutResponse } from "@/lib/services/discovery/week-scout";
import type { SurfDiscoveryResponse } from "@/types/personalization";
import type {
  Recommendation,
  RecommendationsResponse,
  TopPick,
} from "@/types/api/recommendations";

const EPOCH = "hold-epoch-1";
const PRIMARY_BEACH_ID = "11111111-1111-4111-8111-111111111111";
const INCLUDED_BEACH_ID = "22222222-2222-4222-8222-222222222222";
const PRIMARY_START = "2026-07-19T18:00:00.000Z";
const PRIMARY_END = "2026-07-19T20:00:00.000Z";
const INCLUDED_START = "2026-07-19T19:00:00.000Z";
const INCLUDED_END = "2026-07-19T21:00:00.000Z";

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    Object.freeze(value);
    for (const nested of Object.values(value)) deepFreeze(nested);
  }
  return value;
}

function decision(
  candidateId: string,
  state: "allow" | "blocked" | "unavailable",
  holdEpoch = EPOCH,
  expiresAt = "2026-07-21T00:00:00.000Z",
): MajorEventHoldCandidateDecision {
  if (state === "allow") {
    return {
      candidateId,
      evaluation: {
        outcome: "allow",
        holdIds: [],
        holdEpoch,
      },
      recommendationAvailability: {
        state: "available",
        holdEpoch,
      },
    };
  }

  const reasonCode =
    state === "blocked" ? "major_event_hold" : "hold_state_unavailable";
  return {
    candidateId,
    evaluation: {
      outcome: "explicit_none",
      reasonCode,
      holdIds: state === "blocked" ? ["hold-1"] : [],
      expiresAt: state === "blocked" ? expiresAt : undefined,
      holdEpoch,
    },
    recommendationAvailability: {
      state: "none",
      reasonCode,
      expiresAt: state === "blocked" ? expiresAt : undefined,
      holdEpoch,
    },
  };
}

function shadowAllowDecision(
  candidateId: string,
): MajorEventHoldCandidateDecision {
  return {
    candidateId,
    evaluation: {
      outcome: "allow",
      holdIds: ["shadow-hold-1"],
      expiresAt: "2026-07-21T00:00:00.000Z",
      holdEpoch: EPOCH,
    },
    recommendationAvailability: {
      state: "available",
      holdEpoch: EPOCH,
    },
  };
}

function candidate(
  candidateId: string,
  beachId: string,
  startsAt: string,
  endsAt: string,
): MajorEventHoldCandidate {
  return { candidateId, beachId, startsAt, endsAt };
}

function discoveryCandidates(): MajorEventHoldCandidate[] {
  return [
    candidate("primary", PRIMARY_BEACH_ID, PRIMARY_START, PRIMARY_END),
    candidate("included", INCLUDED_BEACH_ID, INCLUDED_START, INCLUDED_END),
  ];
}

function weekScoutCandidates(): MajorEventHoldCandidate[] {
  return [
    candidate("window-primary", PRIMARY_BEACH_ID, PRIMARY_START, PRIMARY_END),
    candidate(
      "window-included",
      INCLUDED_BEACH_ID,
      "2026-07-19T18:30:00.000Z",
      "2026-07-19T20:30:00.000Z",
    ),
  ];
}

function discoveryRecommendation(
  recommendationId: string,
  beachId: string,
  waveHeight: string,
  startsAt: string,
  endsAt: string,
) {
  return {
    recommendationId,
    beach: { id: beachId, name: beachId },
    window: {
      start: new Date(startsAt),
      end: new Date(endsAt),
      tide: "Rising",
      wind: "5 mph E",
      waveHeight,
      wavePeriod: "14s",
      dataSource: "CDIP",
      confidence: 88,
      timezone: "Pacific/Honolulu",
    },
    forecast: {
      forecast_at: startsAt,
      wave_height: waveHeight,
      wave_period: "14s",
      wind_speed: "5",
      wind_direction: "E",
    },
    score: 91,
    matchQuality: "excellent",
    subscores: {
      waveHeightFit: 22,
      periodEnergyScore: 18,
      windAlignment: 19,
      tideFit: 14,
      affinityBonus: 8,
      personalizationBonus: 10,
      distancePenalty: 0,
    },
    summary: "Excellent surf window",
    reasons: ["Clean swell"],
    warnings: [],
    similarity: null,
    generated_at: "2026-07-19T17:00:00.000Z",
  };
}

function discoveryFixture(): SurfDiscoveryResponse {
  const primary = discoveryRecommendation(
    "primary",
    PRIMARY_BEACH_ID,
    "6 ft",
    PRIMARY_START,
    PRIMARY_END,
  );
  const included = discoveryRecommendation(
    "included",
    INCLUDED_BEACH_ID,
    "4 ft",
    INCLUDED_START,
    INCLUDED_END,
  );
  return {
    recommendations: [primary],
    includedRecommendations: [included],
    recommendationsV2: {
      state: "ready_today",
      generated_at: "2026-07-19T17:00:00.000Z",
      hero: {
        recommendation_id: "primary",
        source_state: "learned",
        beach: { id: PRIMARY_BEACH_ID, name: "Primary", lat: 1, lon: 2 },
        window: {
          start: PRIMARY_START,
          end: PRIMARY_END,
          timezone: "Pacific/Honolulu",
        },
        condition_score: 90,
        personal_match_score: 8,
        overall_score: 91,
        label: "Worth it",
        reason_type: "conditions",
        proof_summary: "Clean swell",
        evidence_facts: [],
        ranking_position: 1,
        fallback_horizon_hours: null,
        fallback_reason: null,
      },
      items: [
        {
          recommendation_id: "primary",
          source_state: "learned",
          beach: { id: PRIMARY_BEACH_ID, name: "Primary", lat: 1, lon: 2 },
          window: {
            start: PRIMARY_START,
            end: PRIMARY_END,
            timezone: "Pacific/Honolulu",
          },
          condition_score: 90,
          personal_match_score: 8,
          overall_score: 91,
          label: "Worth it",
          reason_type: "conditions",
          proof_summary: "Clean swell",
          evidence_facts: [],
          ranking_position: 1,
          fallback_horizon_hours: null,
          fallback_reason: null,
        },
        {
          recommendation_id: "included",
          source_state: "starter_fit",
          beach: { id: INCLUDED_BEACH_ID, name: "Included", lat: 3, lon: 4 },
          window: {
            start: INCLUDED_START,
            end: INCLUDED_END,
            timezone: "Pacific/Honolulu",
          },
          condition_score: 75,
          personal_match_score: 6,
          overall_score: 76,
          label: "Worth it",
          reason_type: "conditions",
          proof_summary: "Rideable",
          evidence_facts: [],
          ranking_position: 2,
          fallback_horizon_hours: null,
          fallback_reason: null,
        },
      ],
      watch_window: null,
      empty_state: { title: null, body: null, action_label: null },
    },
    searchCriteria: { maxResults: 5 },
    metadata: {
      totalBeachesConsidered: 2,
      successfulForecasts: 2,
      partialSuccess: false,
      failedBeaches: 0,
      staleBeaches: 0,
      generated_at: "2026-07-19T17:00:00.000Z",
    },
    regionalCall: "The region is firing today.",
    eveningTransition: {
      active: true,
      restOfToday: {
        summary: "Go now",
        conditions: "Excellent",
        waveHeight: "6 ft",
      },
      tomorrowRegionalCall: "More excellent surf tomorrow.",
    },
  } as unknown as SurfDiscoveryResponse;
}

const surfCallFixture: SurfCallResult = {
  verdict: "YES",
  bestWindowStart: "2026-07-19T18:00:00.000Z",
  bestWindowEnd: "2026-07-19T20:00:00.000Z",
  windowMinutes: 120,
  shortWindow: false,
  waveHeight: "6 ft",
  windDescription: "light offshore",
  windSpeed: "5 mph",
  windCompass: "E",
  windType: "offshore",
  tideDescription: "rising",
  tidePhase: "Rising",
  tideHeight: "2.4 ft",
  nextTideType: "High",
  nextTideAt: "2026-07-19T21:00:00.000Z",
  whySentence: "Excellent surf during the best window.",
  forecastConfidence: 88,
  lowForecastConfidence: false,
  score: 91,
  peakTime: "2026-07-19T19:00:00.000Z",
  trendTags: ["Clean Swell"],
  updatedAt: "2026-07-19T17:00:00.000Z",
  isCalibrated: true,
  rideableWavesPerHour: 8,
  dominantBeatIntervalS: 14,
  character: { label: "Clean", category: "medium-clean" },
  tiers: {
    beginner: {
      verdict: "NO",
      trail: "TOO BIG",
      bestWindowStart: null,
      bestWindowEnd: null,
    },
    intermediate: {
      verdict: "YES",
      trail: "GO SURF!",
      bestWindowStart: "2026-07-19T18:00:00.000Z",
      bestWindowEnd: "2026-07-19T20:00:00.000Z",
    },
    advanced: {
      verdict: "YES",
      trail: "GO SURF!",
      bestWindowStart: "2026-07-19T18:00:00.000Z",
      bestWindowEnd: "2026-07-19T20:00:00.000Z",
    },
  },
  userTier: "intermediate",
  skillSource: "profile",
  cautions: [],
};

const weekScoutFixture: WeekScoutResponse = {
  generatedAt: "2026-07-19T17:00:00.000Z",
  scorerVersion: "week-scout-v1",
  candidateFingerprint: "fingerprint",
  days: [
    {
      localDate: "2026-07-19",
      bestWindowId: "window-primary",
      exclusionReasons: [],
      windows: [
        {
          id: "window-primary",
          bucket: "morning",
          start: "2026-07-19T18:00:00.000Z",
          end: "2026-07-19T20:00:00.000Z",
          peakTime: "2026-07-19T19:00:00.000Z",
          beachId: PRIMARY_BEACH_ID,
          conditionScore: 91,
          rankingScore: 94,
          verdict: "worth_it",
          rideable: true,
          safe: true,
          confidence: 88,
          forecast: {
            waveHeight: "6 ft",
            period: "14s",
            swellDirection: "NW",
            windSpeed: "5 mph",
            windDirection: "E",
            tideHeightFt: 2.4,
            tidePhase: "Rising",
            freshnessAt: "2026-07-19T17:00:00.000Z",
          },
          takeaway: "Excellent clean swell.",
          rankedSpots: [
            {
              beachId: PRIMARY_BEACH_ID,
              beachName: "Primary",
              conditionScore: 91,
              rankingScore: 94,
              verdict: "worth_it",
              forecast: {
                waveHeight: null,
                period: null,
                swellDirection: null,
                windSpeed: null,
                windDirection: null,
              },
            },
          ],
        },
        {
          id: "window-included",
          bucket: "morning",
          start: "2026-07-19T18:30:00.000Z",
          end: "2026-07-19T20:30:00.000Z",
          peakTime: "2026-07-19T19:30:00.000Z",
          beachId: INCLUDED_BEACH_ID,
          conditionScore: 75,
          rankingScore: 78,
          verdict: "maybe",
          rideable: true,
          safe: true,
          confidence: 80,
          forecast: {
            waveHeight: "4 ft",
            period: "12s",
            swellDirection: "W",
            windSpeed: "7 mph",
            windDirection: "NE",
            tideHeightFt: 2.1,
            tidePhase: "Rising",
            freshnessAt: "2026-07-19T17:00:00.000Z",
          },
          takeaway: "A decent backup.",
          rankedSpots: [
            {
              beachId: PRIMARY_BEACH_ID,
              beachName: "Primary",
              conditionScore: 91,
              rankingScore: 94,
              verdict: "worth_it",
              forecast: {
                waveHeight: null,
                period: null,
                swellDirection: null,
                windSpeed: null,
                windDirection: null,
              },
            },
            {
              beachId: INCLUDED_BEACH_ID,
              beachName: "Included",
              conditionScore: 75,
              rankingScore: 78,
              verdict: "maybe",
              forecast: {
                waveHeight: null,
                period: null,
                swellDirection: null,
                windSpeed: null,
                windDirection: null,
              },
            },
          ],
        },
      ],
    },
  ],
};

const BULK_PRIMARY_CANDIDATE = candidate(
  "bulk-primary",
  PRIMARY_BEACH_ID,
  "2026-07-19T18:00:00.000Z",
  "2026-07-19T21:00:00.000Z",
);
const BULK_INCLUDED_CANDIDATE = candidate(
  "bulk-included",
  INCLUDED_BEACH_ID,
  "2026-07-19T19:00:00.000Z",
  "2026-07-19T22:00:00.000Z",
);

function bulkCandidates(): MajorEventHoldCandidate[] {
  return [BULK_PRIMARY_CANDIDATE, BULK_INCLUDED_CANDIDATE].map((item) => ({
    ...item,
  }));
}

function bulkBindings(): BulkForecastCandidateBinding[] {
  return [
    { beachId: PRIMARY_BEACH_ID, candidate: { ...BULK_PRIMARY_CANDIDATE } },
    {
      beachId: INCLUDED_BEACH_ID,
      candidate: { ...BULK_INCLUDED_CANDIDATE },
    },
  ];
}

function bulkForecastFixture() {
  return {
    forecasts: {
      [PRIMARY_BEACH_ID]: 6,
      [INCLUDED_BEACH_ID]: 4,
    },
    displayForecasts: {
      [PRIMARY_BEACH_ID]: {
        label: "5-7ft",
        minFt: 5,
        maxFt: 7,
        forecastAt: BULK_PRIMARY_CANDIDATE.startsAt,
        context: "today_headline",
      },
      [INCLUDED_BEACH_ID]: {
        label: "3-5ft",
        minFt: 3,
        maxFt: 5,
        forecastAt: BULK_INCLUDED_CANDIDATE.startsAt,
        context: "selected_hour",
      },
    },
    waterTemps: {
      [PRIMARY_BEACH_ID]: "78 F",
      [INCLUDED_BEACH_ID]: "76 F",
    },
    currentWaterTemps: {
      [PRIMARY_BEACH_ID]: 78,
      [INCLUDED_BEACH_ID]: 76,
    },
    forecastWaterTemps: {
      [PRIMARY_BEACH_ID]: [78, 79],
      [INCLUDED_BEACH_ID]: [76, 77],
    },
    isCalibrated: {
      [PRIMARY_BEACH_ID]: true,
      [INCLUDED_BEACH_ID]: false,
    },
    conditionScores: {
      [PRIMARY_BEACH_ID]: 91,
      [INCLUDED_BEACH_ID]: 75,
    },
    conditionSummaries: {
      [PRIMARY_BEACH_ID]: "GOOD",
      [INCLUDED_BEACH_ID]: "FAIR",
    },
    swellPartitions: {
      [PRIMARY_BEACH_ID]: {
        s1Dir: 315,
        s1PeriodS: 14,
        s1HeightFt: 6,
        s2Dir: null,
        s2PeriodS: null,
        s2HeightFt: null,
        windDir: 90,
        windMph: 5,
      },
    },
    swellPartitionTimeline: {
      [PRIMARY_BEACH_ID]: [
        {
          s1Dir: 315,
          s1PeriodS: 14,
          s1HeightFt: 6,
          s2Dir: null,
          s2PeriodS: null,
          s2HeightFt: null,
          windDir: 90,
          windMph: 5,
        },
      ],
    },
    hourlySwellTimeline: {
      timestamps: ["2026-07-19T18:00:00.000Z"],
      partitionsByBeach: {
        [PRIMARY_BEACH_ID]: [
          {
            s1Dir: 315,
            s1PeriodS: 14,
            s1HeightFt: 6,
            s2Dir: null,
            s2PeriodS: null,
            s2HeightFt: null,
            windDir: 90,
            windMph: 5,
          },
        ],
      },
      hasMore: true,
      nextStart: "2026-07-19T19:00:00.000Z",
    },
    beachKeys: [PRIMARY_BEACH_ID, INCLUDED_BEACH_ID],
    metadata: { source: "enhanced_forecasts" },
  };
}

function bulkPhysicalSnapshot(
  response: Pick<
    ReturnType<typeof bulkForecastFixture>,
    | "forecasts"
    | "displayForecasts"
    | "waterTemps"
    | "currentWaterTemps"
    | "forecastWaterTemps"
    | "isCalibrated"
    | "swellPartitions"
    | "swellPartitionTimeline"
    | "hourlySwellTimeline"
    | "beachKeys"
    | "metadata"
  >,
) {
  return {
    forecasts: response.forecasts,
    displayForecasts: response.displayForecasts,
    waterTemps: response.waterTemps,
    currentWaterTemps: response.currentWaterTemps,
    forecastWaterTemps: response.forecastWaterTemps,
    isCalibrated: response.isCalibrated,
    swellPartitions: response.swellPartitions,
    swellPartitionTimeline: response.swellPartitionTimeline,
    hourlySwellTimeline: response.hourlySwellTimeline,
    beachKeys: response.beachKeys,
    metadata: response.metadata,
  };
}

interface BulkAdapterArgs {
  bindings: BulkForecastCandidateBinding[];
  candidates: MajorEventHoldCandidate[];
  decisions: MajorEventHoldCandidateDecision[];
}

function validBulkAdapterArgs(): BulkAdapterArgs {
  return {
    bindings: bulkBindings(),
    candidates: bulkCandidates(),
    decisions: [
      decision("bulk-primary", "allow"),
      decision("bulk-included", "allow"),
    ],
  };
}

const SLOT_ONE_START = "2026-07-19T18:00:00.000Z";
const SLOT_ONE_END = "2026-07-19T21:00:00.000Z";
const SLOT_TWO_START = SLOT_ONE_END;
const SLOT_TWO_END = "2026-07-20T00:00:00.000Z";
const GOLDEN_ALL_START = SLOT_ONE_START;
const GOLDEN_ALL_END = SLOT_TWO_END;
const GOLDEN_LATE_START = SLOT_TWO_START;
const GOLDEN_LATE_END = SLOT_TWO_END;

const SLOT_ONE_CANDIDATE = candidate(
  "slot-one",
  PRIMARY_BEACH_ID,
  SLOT_ONE_START,
  SLOT_ONE_END,
);
const SLOT_TWO_CANDIDATE = candidate(
  "slot-two",
  PRIMARY_BEACH_ID,
  SLOT_TWO_START,
  SLOT_TWO_END,
);
const GOLDEN_ALL_CANDIDATE = candidate(
  "golden-all",
  PRIMARY_BEACH_ID,
  GOLDEN_ALL_START,
  GOLDEN_ALL_END,
);
const GOLDEN_LATE_CANDIDATE = candidate(
  "golden-late",
  PRIMARY_BEACH_ID,
  GOLDEN_LATE_START,
  GOLDEN_LATE_END,
);

function scoredCandidates(): MajorEventHoldCandidate[] {
  return [
    SLOT_ONE_CANDIDATE,
    SLOT_TWO_CANDIDATE,
    GOLDEN_ALL_CANDIDATE,
    GOLDEN_LATE_CANDIDATE,
  ].map((item) => ({ ...item }));
}

function scoredSlotBindings(): ScoredForecastSlotBinding[] {
  return [
    { forecastAt: SLOT_ONE_START, candidate: { ...SLOT_ONE_CANDIDATE } },
    { forecastAt: SLOT_TWO_START, candidate: { ...SLOT_TWO_CANDIDATE } },
  ];
}

function scoredGoldenBindings(): ScoredForecastGoldenWindowBinding[] {
  return [
    {
      startTime: GOLDEN_ALL_START,
      endTime: GOLDEN_ALL_END,
      candidate: { ...GOLDEN_ALL_CANDIDATE },
    },
    {
      startTime: GOLDEN_LATE_START,
      endTime: GOLDEN_LATE_END,
      candidate: { ...GOLDEN_LATE_CANDIDATE },
    },
  ];
}

function scoredForecastFixture() {
  return {
    timeSlots: [
      {
        forecastAt: SLOT_ONE_START,
        surfHeight: { min: 5, max: 7 },
        swells: [{ height: 6, period: 14, direction: 315, compass: "NW" }],
        windSpeed: 5,
        windDirection: "E",
        windDirectionDeg: 90,
        isOffshore: true,
        tideHeight: 2.4,
        tideStatus: "rising",
        waterTemp: "78 F",
        airTemp: "80 F",
        compositeScore: 91,
        rideableWavesPerHour: 8,
        waveFrequencyConfidence: "high" as const,
        swellTrains: 1,
        dominantBeatIntervalS: 14,
        forecastDataConfidence: 88,
      },
      {
        forecastAt: SLOT_TWO_START,
        surfHeight: { min: 4, max: 6 },
        swells: [{ height: 5, period: 12, direction: 300, compass: "WNW" }],
        windSpeed: 7,
        windDirection: "NE",
        windDirectionDeg: 45,
        isOffshore: true,
        tideHeight: 2.1,
        tideStatus: "high",
        waterTemp: "78 F",
        airTemp: "79 F",
        compositeScore: 75,
        rideableWavesPerHour: 6,
        waveFrequencyConfidence: "medium" as const,
        swellTrains: 1,
        dominantBeatIntervalS: 12,
        forecastDataConfidence: 82,
      },
    ],
    goldenWindows: [
      {
        startTime: GOLDEN_ALL_START,
        endTime: GOLDEN_ALL_END,
        peakTime: SLOT_ONE_START,
        peakScore: 91,
        durationMinutes: 360,
        peakWavesPerHour: 8,
        waveFrequencyConfidence: "high",
      },
      {
        startTime: GOLDEN_LATE_START,
        endTime: GOLDEN_LATE_END,
        peakTime: SLOT_TWO_START,
        peakScore: 75,
        durationMinutes: 180,
        peakWavesPerHour: 6,
        waveFrequencyConfidence: "medium",
      },
    ],
    beach: {
      aspectDeg: 270,
      breakType: "reef",
      isCalibrated: true,
    },
    latestObservation: {
      observedAt: "2026-07-19T17:45:00.000Z",
      waveHeightFt: 6.2,
    },
    metadata: { generatedAt: "2026-07-19T17:50:00.000Z" },
  };
}

function scoredPhysicalSnapshot<
  TSlot extends { compositeScore: number | null },
>(response: {
  timeSlots: readonly TSlot[];
  beach: unknown;
  latestObservation: unknown;
  metadata: unknown;
}) {
  return {
    timeSlots: response.timeSlots.map(
      ({ compositeScore: _compositeScore, ...physical }) => physical,
    ),
    beach: response.beach,
    latestObservation: response.latestObservation,
    metadata: response.metadata,
  };
}

interface ScoredAdapterArgs {
  slotBindings: ScoredForecastSlotBinding[];
  goldenBindings: ScoredForecastGoldenWindowBinding[];
  candidates: MajorEventHoldCandidate[];
  decisions: MajorEventHoldCandidateDecision[];
}

function validScoredAdapterArgs(): ScoredAdapterArgs {
  return {
    slotBindings: scoredSlotBindings(),
    goldenBindings: scoredGoldenBindings(),
    candidates: scoredCandidates(),
    decisions: [
      decision("slot-one", "allow"),
      decision("slot-two", "allow"),
      decision("golden-all", "allow"),
      decision("golden-late", "allow"),
    ],
  };
}

const DAILY_INTEL_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const DAILY_INTEL_CANDIDATE_ID = `daily-intel:${DAILY_INTEL_ID}`;
const DAILY_INTEL_START = "2026-07-19T16:00:00.000Z";
const DAILY_INTEL_END = "2026-07-19T18:00:00.000Z";
const DAILY_INTEL_CANDIDATE = candidate(
  DAILY_INTEL_CANDIDATE_ID,
  PRIMARY_BEACH_ID,
  DAILY_INTEL_START,
  DAILY_INTEL_END,
);

function dailyIntelFixture() {
  return {
    id: DAILY_INTEL_ID,
    beach_id: PRIMARY_BEACH_ID,
    forecast_date: "2026-07-19",
    generated_at: "2026-07-19T15:00:00.000Z",
    generation_time: "05:00:00",
    created_at: "2026-07-19T15:00:01.000Z",
    updated_at: "2026-07-19T15:00:02.000Z",
    conditions_score: 9,
    confidence: "High",
    recommendation: "Worth it before the wind turns.",
    best_window_start: "06:00",
    best_window_end: "08:00:00",
    best_window_description: "Clean early window.",
    current_wave_height_label: "5-7 ft",
    best_window_wave_height_label: "6-8 ft",
    current_height_label: "5-7 ft",
    best_window_height_label: "6-8 ft",
    surf_min_ft: 5,
    surf_max_ft: 7,
    surf_description: "Head-high sets",
    primary_swell_height_ft: 6,
    primary_swell_period_s: 14,
    primary_swell_direction_deg: 315,
    primary_swell_direction_text: "NW",
    secondary_swell_height_ft: 2,
    secondary_swell_period_s: 9,
    secondary_swell_direction_deg: 270,
    secondary_swell_direction_text: "W",
    wind_speed_mph: 5,
    wind_direction_deg: 90,
    wind_direction_text: "E",
    wind_quality: "offshore",
    wind_description: "Light offshore",
    tide_height_ft: 2.4,
    tide_status: "rising",
    tide_time: "07:00",
    tide_optimal_range: "1.5-3 ft",
    next_tide_height_ft: 3.2,
    next_tide_time: "09:15",
    next_tide_type: "HIGH",
    raw_intel_data: {
      spotName: "Primary Beach",
      date: "2026-07-19",
      time: "05:00",
      recommendation: {
        decision: "worth_it",
        label: "Worth it",
        reasons: ["Clean swell"],
      },
      notes: "Paddle out early.",
      bestWindow: "06:00-08:00",
      confidence: "High",
      conditions: {
        score: 9,
        swell: { status: "optimal", emoji: "✅", message: "Clean" },
        wind: { status: "optimal", emoji: "✅", message: "Offshore" },
        tide: { status: "acceptable", emoji: "⚠️", message: "Rising" },
      },
      surf: { min: 5, max: 7, dominant: "head-high" },
      tide: {
        height: 2.4,
        direction: "rising",
        nextEvent: { type: "HIGH", height: 3.2, time: "09:15" },
      },
      swells: {
        primary: { height: 6, period: 14, direction: 315, cardinal: "NW" },
        secondary: { height: 2, period: 9, direction: 270, cardinal: "W" },
      },
      wind: {
        speed: 5,
        direction: 90,
        cardinal: "E",
        offshore: true,
        description: "offshore",
      },
      sources: { wave: true, tide: true, wind: true, swell: true },
      dataCompleteness: 1,
      waterQuality: { status: "good", latestSampleDate: "2026-07-18" },
      beach: { aspectDeg: 270, breakType: "reef" },
      debug: { recommendation: "physical-debug-key-must-remain" },
      payload: {
        kind: "morning_intel_v2",
        generatedAt: "2026-07-19T15:00:00.000Z",
        date: "2026-07-19",
        time: "05:00",
        recommendation: {
          decision: "worth_it",
          label: "Worth it",
          reasons: ["Clean swell"],
        },
        conditions: { score: 9 },
        bestWindow: "06:00-08:00",
        confidence: "High",
        surf: { min: 5, max: 7, dominant: "head-high" },
        tide: { height: 2.4, direction: "rising", nextEvent: null },
        wind: {
          speed: 5,
          direction: 90,
          cardinal: "E",
          offshore: true,
          description: "offshore",
        },
        swells: {
          primary: { height: 6, period: 14, direction: 315, cardinal: "NW" },
          secondary: null,
        },
        dataCompleteness: 1,
        sources: { wave: true, tide: true, wind: true, swell: true },
        beach: { aspectDeg: 270, windOffshoreDegUsed: 90 },
        waterQuality: { status: "good", latestSampleDate: "2026-07-18" },
        debug: { confidence: "physical-debug-key-must-remain" },
      },
    },
  };
}

type DailyIntelPhysicalSource = Omit<
  ReturnType<typeof dailyIntelFixture>,
  | "conditions_score"
  | "confidence"
  | "recommendation"
  | "best_window_start"
  | "best_window_end"
  | "best_window_description"
  | "best_window_wave_height_label"
  | "best_window_height_label"
  | "raw_intel_data"
>;

function dailyIntelPhysicalSnapshot(response: DailyIntelPhysicalSource) {
  return {
    identity: {
      id: response.id,
      beach_id: response.beach_id,
      forecast_date: response.forecast_date,
      generated_at: response.generated_at,
      generation_time: response.generation_time,
      created_at: response.created_at,
      updated_at: response.updated_at,
    },
    currentLabels: {
      current_wave_height_label: response.current_wave_height_label,
      current_height_label: response.current_height_label,
    },
    surf: {
      surf_min_ft: response.surf_min_ft,
      surf_max_ft: response.surf_max_ft,
      surf_description: response.surf_description,
    },
    swell: {
      primary_swell_height_ft: response.primary_swell_height_ft,
      primary_swell_period_s: response.primary_swell_period_s,
      primary_swell_direction_deg: response.primary_swell_direction_deg,
      primary_swell_direction_text: response.primary_swell_direction_text,
      secondary_swell_height_ft: response.secondary_swell_height_ft,
      secondary_swell_period_s: response.secondary_swell_period_s,
      secondary_swell_direction_deg: response.secondary_swell_direction_deg,
      secondary_swell_direction_text: response.secondary_swell_direction_text,
    },
    wind: {
      wind_speed_mph: response.wind_speed_mph,
      wind_direction_deg: response.wind_direction_deg,
      wind_direction_text: response.wind_direction_text,
      wind_quality: response.wind_quality,
      wind_description: response.wind_description,
    },
    tide: {
      tide_height_ft: response.tide_height_ft,
      tide_status: response.tide_status,
      tide_time: response.tide_time,
      tide_optimal_range: response.tide_optimal_range,
      next_tide_height_ft: response.next_tide_height_ft,
      next_tide_time: response.next_tide_time,
      next_tide_type: response.next_tide_type,
    },
  };
}

const LEGACY_QUERY_TIME = "2026-07-19T18:00:00.000Z";

function legacyRecommendation(
  spotId: string,
  name: string,
  score: number,
): Recommendation {
  return {
    spotId,
    name,
    distance_km: 3.5,
    score,
    reasons: ["Clean swell"],
    wave: { ht_ft: 6, period_s: 14 },
    wind: { dir_deg: 90, kts: 4 },
    tide: { height_ft: 2.4, status: "rising" },
    best_time_window: "06:00-08:00",
  };
}

function legacyTopPick(recommendation: Recommendation, rank: number): TopPick {
  return {
    ...recommendation,
    rank,
    isTopPick: true,
    snapshot: {
      timestamp: LEGACY_QUERY_TIME,
      conditions: {
        wave: recommendation.wave,
        wind: recommendation.wind,
        tide: recommendation.tide,
      },
      quality_indicators: {
        data_freshness: "current",
        forecast_age_hours: 1,
        confidence_level: "high",
      },
    },
  };
}

function legacyFixture(): RecommendationsResponse {
  const primary = legacyRecommendation(PRIMARY_BEACH_ID, "Primary", 91);
  const included = legacyRecommendation(INCLUDED_BEACH_ID, "Included", 75);
  return {
    recommendations: [primary, included],
    top_picks: [legacyTopPick(primary, 2), legacyTopPick(included, 7)],
    metadata: {
      query_time: LEGACY_QUERY_TIME,
      location: { lat: 21.3, lon: -157.8 },
      total_spots_analyzed: 2,
      user_skill: "expert",
      degradation: { fallback_to_simple_query: true },
    },
  };
}

function legacyCandidate(spotId: string): MajorEventHoldCandidate {
  return candidate(
    `legacy-v1:${spotId}:${LEGACY_QUERY_TIME}`,
    spotId,
    LEGACY_QUERY_TIME,
    "2026-07-19T18:00:00.001Z",
  );
}

function legacyCandidates(): MajorEventHoldCandidate[] {
  return [
    legacyCandidate(PRIMARY_BEACH_ID),
    legacyCandidate(INCLUDED_BEACH_ID),
  ];
}

function legacyContextAt(queryTime: string): {
  response: RecommendationsResponse;
  candidates: MajorEventHoldCandidate[];
  decisions: MajorEventHoldCandidateDecision[];
} {
  const response = legacyFixture();
  response.metadata.query_time = queryTime;
  response.top_picks = response.top_picks.map((topPick) => ({
    ...topPick,
    snapshot: { ...topPick.snapshot, timestamp: queryTime },
  }));
  const queryTimeMs = Date.parse(queryTime);
  const endsAt = Number.isFinite(queryTimeMs)
    ? new Date(queryTimeMs + 1).toISOString()
    : "2026-07-19T18:00:00.001Z";
  const candidates = response.recommendations.map(({ spotId }) =>
    candidate(`legacy-v1:${spotId}:${queryTime}`, spotId, queryTime, endsAt),
  );
  return {
    response,
    candidates,
    decisions: candidates.map(({ candidateId }) =>
      decision(candidateId, "allow"),
    ),
  };
}

interface LegacyAdapterArgs {
  candidates: unknown[];
  decisions: MajorEventHoldCandidateDecision[];
}

function validLegacyAdapterArgs(): LegacyAdapterArgs {
  return {
    candidates: legacyCandidates(),
    decisions: [
      decision(`legacy-v1:${PRIMARY_BEACH_ID}:${LEGACY_QUERY_TIME}`, "allow"),
      decision(`legacy-v1:${INCLUDED_BEACH_ID}:${LEGACY_QUERY_TIME}`, "allow"),
    ],
  };
}

function coachDecision(
  state: "allow" | "unavailable",
  holdEpoch = EPOCH,
): MajorEventHoldCandidateDecision {
  if (state === "allow") {
    return {
      candidateId: null,
      evaluation: { outcome: "allow", holdIds: [], holdEpoch },
      recommendationAvailability: { state: "available", holdEpoch },
    };
  }
  return {
    candidateId: null,
    evaluation: {
      outcome: "explicit_none",
      reasonCode: "hold_state_unavailable",
      holdIds: [],
      holdEpoch,
    },
    recommendationAvailability: {
      state: "none",
      reasonCode: "hold_state_unavailable",
      holdEpoch,
    },
  };
}

function coachPicksFixture() {
  return {
    picks: [
      {
        beach_id: PRIMARY_BEACH_ID,
        beach_name: "Primary",
        coach_score: 91,
        wave_height_ft: 6,
        period_s: 14,
        wind_mph: 5,
      },
    ],
    metadata: { radius_km: 80, source: "get_coach_picks" },
  };
}

interface TestIntentPick {
  beachId: string;
  name: string;
  slug: string;
  waveHeight: string;
  windDirection: string;
  score: number;
  citySlug: string;
  stateSlug: string;
}

const INTENT_PEAK_TIMES = [
  "2026-07-19T18:00:00.000Z",
  "2026-07-19T19:00:00.000Z",
  "2026-07-19T20:00:00.000Z",
  "2026-07-19T21:00:00.000Z",
  "2026-07-19T22:00:00.000Z",
] as const;

function intentCandidateAt(index: number): MajorEventHoldCandidate {
  const peakTime = new Date(INTENT_PEAK_TIMES[index]);
  return candidate(
    `intent-${index + 1}`,
    index % 2 === 0 ? PRIMARY_BEACH_ID : INCLUDED_BEACH_ID,
    new Date(peakTime.getTime() - 30 * 60 * 1000).toISOString(),
    new Date(peakTime.getTime() + 30 * 60 * 1000).toISOString(),
  );
}

function intentForecastFixture(): IntentForecastHoldInput<TestIntentPick> {
  return {
    items: INTENT_PEAK_TIMES.map((peakTime, index) => ({
      candidate: intentCandidateAt(index),
      peakTime,
      topPick: {
        beachId: index % 2 === 0 ? PRIMARY_BEACH_ID : INCLUDED_BEACH_ID,
        name: `Beach ${index + 1}`,
        slug: `beach-${index + 1}`,
        waveHeight: `${6 - index * 0.5} ft`,
        windDirection: `${5 + index} mph`,
        score: 95 - index * 5,
        citySlug: "honolulu",
        stateSlug: "hi",
      },
    })),
    bestWindow: {
      start: "8:00 AM",
      end: "9:00 AM",
      reason: "offshore winds, good swell angle",
    },
    bestWindowSourceCandidateId: "intent-1",
    conditions: {
      tide: "Rising",
      wind: "5 mph E",
      swell: "6 ft at 14s",
    },
    isTomorrow: true,
  };
}

function intentCandidates(): MajorEventHoldCandidate[] {
  return INTENT_PEAK_TIMES.map((_peakTime, index) => intentCandidateAt(index));
}

function intentDecisions(
  overrides: Partial<Record<string, "allow" | "blocked" | "unavailable">> = {},
): MajorEventHoldCandidateDecision[] {
  return intentCandidates().map(({ candidateId }) =>
    decision(candidateId, overrides[candidateId] ?? "allow"),
  );
}

interface IntentAdapterArgs {
  input: IntentForecastHoldInput<TestIntentPick>;
  candidates: unknown[];
  decisions: MajorEventHoldCandidateDecision[];
}

function validIntentAdapterArgs(): IntentAdapterArgs {
  return {
    input: intentForecastFixture(),
    candidates: intentCandidates(),
    decisions: intentDecisions(),
  };
}

describe("major-event hold adapters", () => {
  it("discovery removes blocked legacy, included, and V2 candidates and clears regional positives", () => {
    const input = deepFreeze(structuredClone(discoveryFixture()));

    const result = sanitizeSurfDiscoveryForMajorEventHold(
      input,
      discoveryCandidates(),
      [decision("primary", "blocked"), decision("included", "blocked")],
    );

    expect(result.recommendationAvailability).toEqual({
      state: "none",
      reasonCode: "major_event_hold",
      expiresAt: "2026-07-21T00:00:00.000Z",
      holdEpoch: EPOCH,
    });
    expect(result.recommendations).toEqual([]);
    expect(result.includedRecommendations).toEqual([]);
    expect(result.recommendationsV2).toMatchObject({
      state: "no_good_window",
      hero: null,
      items: [],
      watch_window: null,
      empty_state: { title: null, body: null, action_label: null },
    });
    expect(result.regionalCall).toBe("");
    expect(result.eveningTransition).toBeUndefined();
    expect(input).toEqual(discoveryFixture());
  });

  it("discovery keeps only explicitly allowed candidates for mixed decisions", () => {
    const input = deepFreeze(structuredClone(discoveryFixture()));

    const result = sanitizeSurfDiscoveryForMajorEventHold(
      input,
      discoveryCandidates(),
      [decision("primary", "blocked"), decision("included", "allow")],
    );

    expect(result.recommendationAvailability).toEqual({
      state: "available",
      holdEpoch: EPOCH,
    });
    expect(result.recommendations).toEqual([]);
    expect(
      result.includedRecommendations?.map((item) => item.recommendationId),
    ).toEqual(["included"]);
    expect(
      result.recommendationsV2?.items.map((item) => item.recommendation_id),
    ).toEqual(["included"]);
    expect(result.recommendationsV2?.hero).toBeNull();
    expect(result.regionalCall).toBe("");
    expect(result.eveningTransition).toBeUndefined();
    expect(result.lockedBestSpotTeaser).toBeNull();
  });

  it("preserves a common server resolution snapshot through the decision boundary", () => {
    const resolutionAsOf = "2026-07-20T12:00:00.000Z";
    const decisions = [
      decision("primary", "blocked"),
      decision("included", "allow"),
    ].map((value) => ({
      ...value,
      recommendationAvailability: {
        ...value.recommendationAvailability,
        resolutionAsOf,
      },
    }));

    const result = sanitizeSurfDiscoveryForMajorEventHold(
      deepFreeze(structuredClone(discoveryFixture())),
      discoveryCandidates(),
      decisions,
    );

    expect(result.recommendationAvailability).toEqual({
      state: "available",
      holdEpoch: EPOCH,
      resolutionAsOf,
    });
  });

  it("preserves discovery recommendations for a realistic shadow allow decision", () => {
    const input = deepFreeze(structuredClone(discoveryFixture()));

    const result = sanitizeSurfDiscoveryForMajorEventHold(
      input,
      discoveryCandidates(),
      [shadowAllowDecision("primary"), decision("included", "allow")],
    );

    expect(result.recommendationAvailability).toEqual({
      state: "available",
      holdEpoch: EPOCH,
    });
    expect(result.recommendations).toEqual(input.recommendations);
    expect(result.includedRecommendations).toEqual(
      input.includedRecommendations,
    );
    expect(result.recommendationsV2).toEqual(input.recommendationsV2);
    expect(result.regionalCall).toBe(input.regionalCall);
  });

  it.each([
    ["recommendations", "recommendations"],
    ["included recommendations", "includedRecommendations"],
    ["V2 items", "v2Items"],
  ] as const)(
    "fails discovery closed for duplicate IDs within %s",
    (_label, container) => {
      const response = discoveryFixture();
      if (container === "recommendations") {
        response.recommendations.push(
          structuredClone(response.recommendations[0]),
        );
      } else if (container === "includedRecommendations") {
        response.includedRecommendations?.push(
          structuredClone(response.includedRecommendations[0]),
        );
      } else {
        response.recommendationsV2?.items.push(
          structuredClone(response.recommendationsV2.items[0]),
        );
      }

      const result = sanitizeSurfDiscoveryForMajorEventHold(
        deepFreeze(structuredClone(response)),
        discoveryCandidates(),
        [decision("primary", "allow"), decision("included", "allow")],
      );

      expect(result.recommendationAvailability).toMatchObject({
        state: "none",
        reasonCode: "hold_state_unavailable",
      });
      expect(result.recommendations).toEqual([]);
      expect(result.includedRecommendations).toEqual([]);
      expect(result.recommendationsV2?.items).toEqual([]);
    },
  );

  it("fails discovery closed for a duplicate candidate across legacy recommendation lists", () => {
    const response = discoveryFixture();
    response.includedRecommendations?.push(
      structuredClone(response.recommendations[0]),
    );

    const result = sanitizeSurfDiscoveryForMajorEventHold(
      deepFreeze(structuredClone(response)),
      discoveryCandidates(),
      [decision("primary", "allow"), decision("included", "allow")],
    );

    expect(result.recommendationAvailability).toMatchObject({
      state: "none",
      reasonCode: "hold_state_unavailable",
    });
    expect(result.recommendations).toEqual([]);
    expect(result.includedRecommendations).toEqual([]);
  });

  it.each([
    [
      "beach",
      (response: SurfDiscoveryResponse) => {
        if (response.recommendationsV2?.hero) {
          response.recommendationsV2.hero.beach.id = INCLUDED_BEACH_ID;
        }
      },
    ],
    [
      "start time",
      (response: SurfDiscoveryResponse) => {
        if (response.recommendationsV2?.hero) {
          response.recommendationsV2.hero.window.start = INCLUDED_START;
        }
      },
    ],
    [
      "end time",
      (response: SurfDiscoveryResponse) => {
        if (response.recommendationsV2?.hero) {
          response.recommendationsV2.hero.window.end = INCLUDED_END;
        }
      },
    ],
  ] as const)(
    "fails discovery closed when repeated representations disagree on %s",
    (_label, mutate) => {
      const response = discoveryFixture();
      mutate(response);

      const result = sanitizeSurfDiscoveryForMajorEventHold(
        deepFreeze(structuredClone(response)),
        discoveryCandidates(),
        [decision("primary", "allow"), decision("included", "allow")],
      );

      expect(result.recommendationAvailability).toMatchObject({
        state: "none",
        reasonCode: "hold_state_unavailable",
      });
      expect(result.recommendations).toEqual([]);
      expect(result.recommendationsV2?.items).toEqual([]);
    },
  );

  it.each([
    "",
    "not-an-instant",
    "2026-07-21T00:00:00.000",
    "July 21, 2026 00:00:00+00:00",
    "2026-02-30T00:00:00.000Z",
    "2025-02-29T00:00:00.000Z",
    "2026-13-01T00:00:00.000Z",
    "2026-07-21T24:00:00.000Z",
    "2026-07-21T00:60:00.000Z",
    "2026-07-21T00:00:60.000Z",
    "2026-07-21T00:00:00.000+24:00",
    "2026-07-21T00:00:00.000+10:60",
  ])("fails the whole boundary closed for invalid expiry %p", (expiresAt) => {
    const result = sanitizeSurfDiscoveryForMajorEventHold(
      deepFreeze(structuredClone(discoveryFixture())),
      discoveryCandidates(),
      [
        decision("primary", "blocked", EPOCH, expiresAt),
        decision("included", "blocked"),
      ],
    );

    expect(result.recommendationAvailability).toMatchObject({
      state: "none",
      reasonCode: "hold_state_unavailable",
    });
  });

  it("accepts a leap-day expiry in a real leap year", () => {
    const expiresAt = "2028-02-29T00:00:00.000Z";
    const result = sanitizeSurfDiscoveryForMajorEventHold(
      deepFreeze(structuredClone(discoveryFixture())),
      discoveryCandidates(),
      [
        decision("primary", "blocked", EPOCH, expiresAt),
        decision("included", "blocked", EPOCH, expiresAt),
      ],
    );

    expect(result.recommendationAvailability).toEqual({
      state: "none",
      reasonCode: "major_event_hold",
      expiresAt,
      holdEpoch: EPOCH,
    });
  });

  it.each([
    [
      "allow with expiry but no shadow hold IDs",
      () => ({
        ...decision("primary", "allow"),
        evaluation: {
          ...decision("primary", "allow").evaluation,
          expiresAt: "2026-07-21T00:00:00.000Z",
        },
      }),
    ],
    [
      "allow with shadow hold IDs but no expiry",
      () => ({
        ...decision("primary", "allow"),
        evaluation: {
          ...decision("primary", "allow").evaluation,
          holdIds: ["hold-1"],
        },
      }),
    ],
    [
      "allow with duplicate shadow hold IDs",
      () => ({
        ...shadowAllowDecision("primary"),
        evaluation: {
          ...shadowAllowDecision("primary").evaluation,
          holdIds: ["hold-1", "hold-1"],
        },
      }),
    ],
    [
      "allow with serialized availability expiry",
      () => ({
        ...decision("primary", "allow"),
        recommendationAvailability: {
          ...decision("primary", "allow").recommendationAvailability,
          expiresAt: "2026-07-21T00:00:00.000Z",
        },
      }),
    ],
    [
      "major-event block with no hold IDs",
      () => ({
        ...decision("primary", "blocked"),
        evaluation: {
          ...decision("primary", "blocked").evaluation,
          holdIds: [],
        },
      }),
    ],
    [
      "major-event block with duplicate hold IDs",
      () => ({
        ...decision("primary", "blocked"),
        evaluation: {
          ...decision("primary", "blocked").evaluation,
          holdIds: ["hold-1", "hold-1"],
        },
      }),
    ],
    [
      "major-event block with no expiry",
      () => ({
        ...decision("primary", "blocked"),
        evaluation: {
          ...decision("primary", "blocked").evaluation,
          expiresAt: undefined,
        },
        recommendationAvailability: {
          ...decision("primary", "blocked").recommendationAvailability,
          expiresAt: undefined,
        },
      }),
    ],
    [
      "unavailable decision with hold IDs",
      () => ({
        ...decision("primary", "unavailable"),
        evaluation: {
          ...decision("primary", "unavailable").evaluation,
          holdIds: ["hold-1"],
        },
      }),
    ],
    [
      "unavailable decision with expiry",
      () => ({
        ...decision("primary", "unavailable"),
        evaluation: {
          ...decision("primary", "unavailable").evaluation,
          expiresAt: "2026-07-21T00:00:00.000Z",
        },
        recommendationAvailability: {
          ...decision("primary", "unavailable").recommendationAvailability,
          expiresAt: "2026-07-21T00:00:00.000Z",
        },
      }),
    ],
  ] as const)("fails the whole boundary closed for %s", (_label, build) => {
    const malformed = build() as MajorEventHoldCandidateDecision;
    const result = sanitizeSurfDiscoveryForMajorEventHold(
      deepFreeze(structuredClone(discoveryFixture())),
      discoveryCandidates(),
      [malformed, decision("included", "allow")],
    );

    expect(result.recommendationAvailability).toMatchObject({
      state: "none",
      reasonCode: "hold_state_unavailable",
    });
    expect(result.recommendations).toEqual([]);
  });

  it("selects the latest blocked expiry by instant instead of lexical order", () => {
    const lexicallyLaterButEarlierInstant = "2026-07-21T01:00:00+14:00";
    const lexicallyEarlierButLaterInstant = "2026-07-20T23:30:00-10:00";

    const result = sanitizeSurfDiscoveryForMajorEventHold(
      deepFreeze(structuredClone(discoveryFixture())),
      discoveryCandidates(),
      [
        decision("primary", "blocked", EPOCH, lexicallyLaterButEarlierInstant),
        decision("included", "blocked", EPOCH, lexicallyEarlierButLaterInstant),
      ],
    );

    expect(result.recommendationAvailability).toEqual({
      state: "none",
      reasonCode: "major_event_hold",
      expiresAt: lexicallyEarlierButLaterInstant,
      holdEpoch: EPOCH,
    });
  });

  it.each([
    ["a missing mapping", [decision("primary", "allow")]],
    [
      "a mismatched extra mapping",
      [
        decision("primary", "allow"),
        decision("included", "allow"),
        decision("other", "allow"),
      ],
    ],
    [
      "inconsistent epochs",
      [decision("primary", "allow"), decision("included", "allow", "epoch-2")],
    ],
    [
      "an unavailable decision",
      [decision("primary", "allow"), decision("included", "unavailable")],
    ],
    [
      "a malformed decision",
      [
        decision("primary", "allow"),
        { candidateId: "included" } as MajorEventHoldCandidateDecision,
      ],
    ],
    [
      "a malformed expiry",
      [
        decision("primary", "allow"),
        {
          ...decision("included", "blocked"),
          evaluation: {
            ...decision("included", "blocked").evaluation,
            expiresAt: 123,
          },
          recommendationAvailability: {
            ...decision("included", "blocked").recommendationAvailability,
            expiresAt: 123,
          },
        } as unknown as MajorEventHoldCandidateDecision,
      ],
    ],
  ])(
    "discovery fails the whole boundary closed for %s",
    (_label, decisions) => {
      const result = sanitizeSurfDiscoveryForMajorEventHold(
        deepFreeze(structuredClone(discoveryFixture())),
        discoveryCandidates(),
        decisions,
      );

      expect(result.recommendationAvailability).toMatchObject({
        state: "none",
        reasonCode: "hold_state_unavailable",
      });
      expect(result.recommendations).toEqual([]);
      expect(result.includedRecommendations).toEqual([]);
      expect(result.recommendationsV2?.items).toEqual([]);
    },
  );

  it.each([
    [
      "missing",
      () => [
        {
          candidateId: "primary",
          beachId: PRIMARY_BEACH_ID,
          startsAt: PRIMARY_START,
        } as unknown as MajorEventHoldCandidate,
        discoveryCandidates()[1],
      ],
    ],
    [
      "malformed",
      () => [
        { ...discoveryCandidates()[0], startsAt: "not-an-instant" },
        discoveryCandidates()[1],
      ],
    ],
    [
      "mismatched",
      () => [
        {
          ...discoveryCandidates()[0],
          startsAt: "2026-07-19T17:00:00.000Z",
        },
        discoveryCandidates()[1],
      ],
    ],
  ] as const)(
    "fails discovery closed for %s service candidate time context",
    (_label, buildCandidates) => {
      const result = sanitizeSurfDiscoveryForMajorEventHold(
        deepFreeze(structuredClone(discoveryFixture())),
        buildCandidates(),
        [decision("primary", "allow"), decision("included", "allow")],
      );

      expect(result.recommendationAvailability).toMatchObject({
        state: "none",
        reasonCode: "hold_state_unavailable",
      });
      expect(result.recommendations).toEqual([]);
    },
  );

  it("fails discovery closed when service candidate beach context mismatches the response", () => {
    const candidates = discoveryCandidates();
    candidates[0] = { ...candidates[0], beachId: INCLUDED_BEACH_ID };

    const result = sanitizeSurfDiscoveryForMajorEventHold(
      deepFreeze(structuredClone(discoveryFixture())),
      candidates,
      [decision("primary", "allow"), decision("included", "allow")],
    );

    expect(result.recommendationAvailability).toMatchObject({
      state: "none",
      reasonCode: "hold_state_unavailable",
    });
    expect(result.recommendations).toEqual([]);
  });

  it("surf call keeps physical conditions but clears positive recommendation semantics", () => {
    const input = deepFreeze(structuredClone(surfCallFixture));

    const result = sanitizeSurfCallForMajorEventHold(
      input,
      {
        candidateId: "surf-call-primary",
        beachId: PRIMARY_BEACH_ID,
        authorizedTier: "intermediate",
      },
      [
        candidate(
          "surf-call-primary",
          PRIMARY_BEACH_ID,
          PRIMARY_START,
          PRIMARY_END,
        ),
      ],
      [decision("surf-call-primary", "blocked")],
    );

    expect(result.recommendationAvailability).toMatchObject({
      state: "none",
      reasonCode: "major_event_hold",
    });
    expect(result).toMatchObject({
      verdict: "NO",
      bestWindowStart: null,
      bestWindowEnd: null,
      windowMinutes: null,
      shortWindow: false,
      whySentence: "",
      score: 0,
      peakTime: null,
      trendTags: [],
      character: null,
      tiers: null,
    });
    expect({
      waveHeight: result.waveHeight,
      windDescription: result.windDescription,
      windSpeed: result.windSpeed,
      windCompass: result.windCompass,
      windType: result.windType,
      tideDescription: result.tideDescription,
      tidePhase: result.tidePhase,
      tideHeight: result.tideHeight,
      nextTideType: result.nextTideType,
      nextTideAt: result.nextTideAt,
      forecastConfidence: result.forecastConfidence,
      lowForecastConfidence: result.lowForecastConfidence,
      isCalibrated: result.isCalibrated,
      rideableWavesPerHour: result.rideableWavesPerHour,
      dominantBeatIntervalS: result.dominantBeatIntervalS,
    }).toEqual({
      waveHeight: input.waveHeight,
      windDescription: input.windDescription,
      windSpeed: input.windSpeed,
      windCompass: input.windCompass,
      windType: input.windType,
      tideDescription: input.tideDescription,
      tidePhase: input.tidePhase,
      tideHeight: input.tideHeight,
      nextTideType: input.nextTideType,
      nextTideAt: input.nextTideAt,
      forecastConfidence: input.forecastConfidence,
      lowForecastConfidence: input.lowForecastConfidence,
      isCalibrated: input.isCalibrated,
      rideableWavesPerHour: input.rideableWavesPerHour,
      dominantBeatIntervalS: input.dominantBeatIntervalS,
    });
    expect(input).toEqual(surfCallFixture);
  });

  it("surf call preserves only the verified viewer tier when explicitly allowed", () => {
    const input = deepFreeze(structuredClone(surfCallFixture));
    const result = sanitizeSurfCallForMajorEventHold(
      input,
      {
        candidateId: "surf-call-primary",
        beachId: PRIMARY_BEACH_ID,
        authorizedTier: "intermediate",
      },
      [
        candidate(
          "surf-call-primary",
          PRIMARY_BEACH_ID,
          PRIMARY_START,
          PRIMARY_END,
        ),
      ],
      [decision("surf-call-primary", "allow")],
    );

    expect(result.recommendationAvailability).toEqual({
      state: "available",
      holdEpoch: EPOCH,
    });
    expect(result.tiers?.intermediate).toEqual(input.tiers?.intermediate);
    expect(result.tiers?.beginner).toEqual({
      verdict: "NO",
      trail: "",
      bestWindowStart: null,
      bestWindowEnd: null,
    });
    expect(result.tiers?.advanced).toEqual({
      verdict: "NO",
      trail: "",
      bestWindowStart: null,
      bestWindowEnd: null,
    });
  });

  it("prevents an advanced viewer from serializing positive beginner or intermediate tiers", () => {
    const input = structuredClone(surfCallFixture);
    input.userTier = "expert";
    if (!input.tiers) throw new Error("expected tier fixture");
    input.tiers.beginner = {
      verdict: "YES",
      trail: "GO SURF!",
      bestWindowStart: PRIMARY_START,
      bestWindowEnd: PRIMARY_END,
    };
    input.tiers.intermediate = {
      verdict: "MAYBE",
      trail: "KEEP WATCHING",
      bestWindowStart: PRIMARY_START,
      bestWindowEnd: PRIMARY_END,
    };

    const result = sanitizeSurfCallForMajorEventHold(
      deepFreeze(input),
      {
        candidateId: "surf-call-primary",
        beachId: PRIMARY_BEACH_ID,
        authorizedTier: "advanced",
      },
      [
        candidate(
          "surf-call-primary",
          PRIMARY_BEACH_ID,
          PRIMARY_START,
          PRIMARY_END,
        ),
      ],
      [decision("surf-call-primary", "allow")],
    );

    expect(result.recommendationAvailability.state).toBe("available");
    expect(result.tiers?.advanced).toEqual(input.tiers.advanced);
    expect(result.tiers?.beginner).toEqual({
      verdict: "NO",
      trail: "",
      bestWindowStart: null,
      bestWindowEnd: null,
    });
    expect(result.tiers?.intermediate).toEqual({
      verdict: "NO",
      trail: "",
      bestWindowStart: null,
      bestWindowEnd: null,
    });
  });

  it("removes tier ladders for a public or unknown-cohort surf call", () => {
    const input = deepFreeze(structuredClone(surfCallFixture));
    const result = sanitizeSurfCallForMajorEventHold(
      input,
      {
        candidateId: "surf-call-primary",
        beachId: PRIMARY_BEACH_ID,
        authorizedTier: null,
      },
      [
        candidate(
          "surf-call-primary",
          PRIMARY_BEACH_ID,
          PRIMARY_START,
          PRIMARY_END,
        ),
      ],
      [decision("surf-call-primary", "allow")],
    );

    expect(result.recommendationAvailability.state).toBe("available");
    expect(result.tiers).toBeNull();
    expect(result.verdict).toBe(input.verdict);
  });

  it("fails a selected positive tier closed when its time differs from the service candidate", () => {
    const input = structuredClone(surfCallFixture);
    input.userTier = "advanced";
    if (!input.tiers) throw new Error("expected tier fixture");
    input.tiers.advanced = {
      ...input.tiers.advanced,
      bestWindowStart: "2026-07-19T19:00:00.000Z",
    };

    const result = sanitizeSurfCallForMajorEventHold(
      deepFreeze(input),
      {
        candidateId: "surf-call-primary",
        beachId: PRIMARY_BEACH_ID,
        authorizedTier: "advanced",
      },
      [
        candidate(
          "surf-call-primary",
          PRIMARY_BEACH_ID,
          PRIMARY_START,
          PRIMARY_END,
        ),
      ],
      [decision("surf-call-primary", "allow")],
    );

    expect(result.recommendationAvailability).toMatchObject({
      state: "none",
      reasonCode: "hold_state_unavailable",
    });
    expect(result.verdict).toBe("NO");
    expect(result.tiers).toBeNull();
  });

  it("fails tier semantics closed when the verified tier disagrees with response.userTier", () => {
    const result = sanitizeSurfCallForMajorEventHold(
      deepFreeze(structuredClone(surfCallFixture)),
      {
        candidateId: "surf-call-primary",
        beachId: PRIMARY_BEACH_ID,
        authorizedTier: "advanced",
      },
      [
        candidate(
          "surf-call-primary",
          PRIMARY_BEACH_ID,
          PRIMARY_START,
          PRIMARY_END,
        ),
      ],
      [decision("surf-call-primary", "allow")],
    );

    expect(result.recommendationAvailability).toMatchObject({
      state: "none",
      reasonCode: "hold_state_unavailable",
    });
    expect(result.tiers).toBeNull();
  });

  it.each([
    [
      "missing",
      {
        candidateId: "surf-call-primary",
        beachId: PRIMARY_BEACH_ID,
        startsAt: PRIMARY_START,
      } as unknown as MajorEventHoldCandidate,
    ],
    [
      "malformed",
      candidate(
        "surf-call-primary",
        PRIMARY_BEACH_ID,
        "not-an-instant",
        PRIMARY_END,
      ),
    ],
    [
      "mismatched",
      candidate(
        "surf-call-primary",
        PRIMARY_BEACH_ID,
        "2026-07-19T17:00:00.000Z",
        PRIMARY_END,
      ),
    ],
  ] as const)(
    "fails surf call closed for %s service candidate time context",
    (_label, holdCandidate) => {
      const result = sanitizeSurfCallForMajorEventHold(
        deepFreeze(structuredClone(surfCallFixture)),
        {
          candidateId: "surf-call-primary",
          beachId: PRIMARY_BEACH_ID,
          authorizedTier: "intermediate",
        },
        [holdCandidate],
        [decision("surf-call-primary", "allow")],
      );

      expect(result.recommendationAvailability).toMatchObject({
        state: "none",
        reasonCode: "hold_state_unavailable",
      });
      expect(result.verdict).toBe("NO");
      expect(result.bestWindowStart).toBeNull();
    },
  );

  it("fails surf call closed when serialized beach context mismatches the service candidate", () => {
    const result = sanitizeSurfCallForMajorEventHold(
      deepFreeze(structuredClone(surfCallFixture)),
      {
        candidateId: "surf-call-primary",
        beachId: INCLUDED_BEACH_ID,
        authorizedTier: "intermediate",
      },
      [
        candidate(
          "surf-call-primary",
          PRIMARY_BEACH_ID,
          PRIMARY_START,
          PRIMARY_END,
        ),
      ],
      [decision("surf-call-primary", "allow")],
    );

    expect(result.recommendationAvailability).toMatchObject({
      state: "none",
      reasonCode: "hold_state_unavailable",
    });
    expect(result.verdict).toBe("NO");
  });

  it("week scout preserves objective forecast conditions and clears blocked recommendation semantics", () => {
    const input = deepFreeze(structuredClone(weekScoutFixture));

    const result = sanitizeWeekScoutForMajorEventHold(
      input,
      weekScoutCandidates(),
      [
        decision("window-primary", "blocked"),
        decision("window-included", "blocked"),
      ],
    );

    expect(result.recommendationAvailability).toMatchObject({
      state: "none",
      reasonCode: "major_event_hold",
    });
    expect(result.days[0].bestWindowId).toBeNull();
    expect(result.days[0].exclusionReasons).toEqual([]);
    expect(result.days[0].windows).toHaveLength(2);
    for (const window of result.days[0].windows) {
      expect(window.conditionScore).toBeNull();
      expect(window.rankingScore).toBeNull();
      expect(window.verdict).toBeNull();
      expect(window.takeaway).toBeNull();
      expect(window.rideable).toBeNull();
      expect(window.safe).toBeNull();
      expect(window.rankedSpots).toEqual([]);
    }
    expect(
      result.days[0].windows.map((window) => ({
        id: window.id,
        bucket: window.bucket,
        start: window.start,
        end: window.end,
        peakTime: window.peakTime,
        beachId: window.beachId,
        confidence: window.confidence,
        forecast: window.forecast,
      })),
    ).toEqual(
      input.days[0].windows.map((window) => ({
        id: window.id,
        bucket: window.bucket,
        start: window.start,
        end: window.end,
        peakTime: window.peakTime,
        beachId: window.beachId,
        confidence: window.confidence,
        forecast: window.forecast,
      })),
    );
    expect(input).toEqual(weekScoutFixture);
  });

  it("week scout retains only allowed positive semantics for mixed decisions", () => {
    const input = deepFreeze(structuredClone(weekScoutFixture));
    const result = sanitizeWeekScoutForMajorEventHold(
      input,
      weekScoutCandidates(),
      [
        decision("window-primary", "blocked"),
        decision("window-included", "allow"),
      ],
    );

    expect(result.recommendationAvailability).toEqual({
      state: "available",
      holdEpoch: EPOCH,
    });
    expect(result.days[0].bestWindowId).toBe("window-included");
    expect(result.days[0].windows[0]).toMatchObject({
      id: "window-primary",
      conditionScore: null,
      rankingScore: null,
      verdict: null,
      takeaway: null,
      rankedSpots: [],
    });
    expect(result.days[0].windows[1]).toEqual({
      ...input.days[0].windows[1],
      rankedSpots: [input.days[0].windows[1].rankedSpots[1]],
    });
  });

  it("marks only the fully held day when another day keeps the response available", () => {
    const firstDay = structuredClone(weekScoutFixture.days[0]);
    const secondDay = structuredClone(weekScoutFixture.days[0]);
    secondDay.localDate = "2026-07-20";
    secondDay.bestWindowId = "window-primary-day-two";
    secondDay.windows = secondDay.windows.map((window) => ({
      ...window,
      id: `${window.id}-day-two`,
      start: window.start.replace("2026-07-19", "2026-07-20"),
      end: window.end.replace("2026-07-19", "2026-07-20"),
      peakTime: window.peakTime.replace("2026-07-19", "2026-07-20"),
    }));
    const input: WeekScoutResponse = {
      ...structuredClone(weekScoutFixture),
      days: [firstDay, secondDay],
    };
    const candidates = input.days.flatMap((day) =>
      day.windows.map((window) =>
        candidate(window.id, window.beachId, window.start, window.end),
      ),
    );

    const result = sanitizeWeekScoutForMajorEventHold(
      deepFreeze(input),
      candidates,
      [
        decision("window-primary", "blocked"),
        decision("window-included", "blocked"),
        decision("window-primary-day-two", "allow"),
        decision("window-included-day-two", "allow"),
      ],
    );

    expect(result.recommendationAvailability).toEqual({
      state: "available",
      holdEpoch: EPOCH,
    });
    expect(result.days[0]).toMatchObject({
      bestWindowId: null,
      exclusionReasons: ["major_event_hold"],
    });
    expect(result.days[1]).toMatchObject({
      bestWindowId: "window-primary-day-two",
      exclusionReasons: [],
    });
  });

  it.each([
    [
      "missing",
      () => [
        {
          candidateId: "window-primary",
          beachId: PRIMARY_BEACH_ID,
          startsAt: PRIMARY_START,
        } as unknown as MajorEventHoldCandidate,
        weekScoutCandidates()[1],
      ],
    ],
    [
      "malformed",
      () => [
        { ...weekScoutCandidates()[0], endsAt: "not-an-instant" },
        weekScoutCandidates()[1],
      ],
    ],
    [
      "mismatched",
      () => [
        {
          ...weekScoutCandidates()[0],
          endsAt: "2026-07-19T20:15:00.000Z",
        },
        weekScoutCandidates()[1],
      ],
    ],
  ] as const)(
    "fails Week Scout closed for %s service candidate time context",
    (_label, buildCandidates) => {
      const result = sanitizeWeekScoutForMajorEventHold(
        deepFreeze(structuredClone(weekScoutFixture)),
        buildCandidates(),
        [
          decision("window-primary", "allow"),
          decision("window-included", "allow"),
        ],
      );

      expect(result.recommendationAvailability).toMatchObject({
        state: "none",
        reasonCode: "hold_state_unavailable",
      });
      expect(result.days[0].bestWindowId).toBeNull();
      expect(result.days[0].windows[0].conditionScore).toBeNull();
    },
  );

  it("fails Week Scout closed when service candidate beach context mismatches the window", () => {
    const candidates = weekScoutCandidates();
    candidates[0] = { ...candidates[0], beachId: INCLUDED_BEACH_ID };

    const result = sanitizeWeekScoutForMajorEventHold(
      deepFreeze(structuredClone(weekScoutFixture)),
      candidates,
      [
        decision("window-primary", "allow"),
        decision("window-included", "allow"),
      ],
    );

    expect(result.recommendationAvailability).toMatchObject({
      state: "none",
      reasonCode: "hold_state_unavailable",
    });
    expect(result.days[0].bestWindowId).toBeNull();
  });

  it("bulk forecast clears blocked condition semantics and preserves all physical data", () => {
    const original = bulkForecastFixture();
    const input = deepFreeze(structuredClone(original));

    const result = sanitizeBulkForecastForMajorEventHold(
      input,
      bulkBindings(),
      bulkCandidates(),
      [
        decision("bulk-primary", "blocked"),
        decision("bulk-included", "blocked"),
      ],
    );

    expect(result.recommendationAvailability).toEqual({
      state: "none",
      reasonCode: "major_event_hold",
      expiresAt: "2026-07-21T00:00:00.000Z",
      holdEpoch: EPOCH,
    });
    expect(result.conditionScores).toEqual({});
    expect(result.conditionSummaries).toEqual({
      [PRIMARY_BEACH_ID]: "UNKNOWN",
      [INCLUDED_BEACH_ID]: "UNKNOWN",
    });
    expect(bulkPhysicalSnapshot(result)).toEqual(
      bulkPhysicalSnapshot(original),
    );
    expect(input).toEqual(original);
  });

  it("bulk forecast keeps only explicitly allowed condition semantics for a mixed batch", () => {
    const input = deepFreeze(structuredClone(bulkForecastFixture()));

    const result = sanitizeBulkForecastForMajorEventHold(
      input,
      bulkBindings(),
      bulkCandidates(),
      [decision("bulk-primary", "blocked"), decision("bulk-included", "allow")],
    );

    expect(result.recommendationAvailability).toEqual({
      state: "available",
      holdEpoch: EPOCH,
    });
    expect(result.conditionScores).toEqual({
      [INCLUDED_BEACH_ID]: 75,
    });
    expect(result.conditionSummaries).toEqual({
      [PRIMARY_BEACH_ID]: "UNKNOWN",
      [INCLUDED_BEACH_ID]: "FAIR",
    });
    expect(bulkPhysicalSnapshot(result)).toEqual(bulkPhysicalSnapshot(input));
  });

  it("bulk forecast preserves all condition semantics for ordinary and shadow allows", () => {
    const input = deepFreeze(structuredClone(bulkForecastFixture()));

    const result = sanitizeBulkForecastForMajorEventHold(
      input,
      bulkBindings(),
      bulkCandidates(),
      [shadowAllowDecision("bulk-primary"), decision("bulk-included", "allow")],
    );

    expect(result.recommendationAvailability).toEqual({
      state: "available",
      holdEpoch: EPOCH,
    });
    expect(result.conditionScores).toEqual(input.conditionScores);
    expect(result.conditionSummaries).toEqual(input.conditionSummaries);
    expect(bulkPhysicalSnapshot(result)).toEqual(bulkPhysicalSnapshot(input));
  });

  it.each([
    ["an ordinary", decision("bulk-primary", "allow")],
    ["a shadow", shadowAllowDecision("bulk-primary")],
  ] as const)(
    "bulk forecast permits an unbound UNKNOWN-only beach for %s allow",
    (_label, allowDecision) => {
      const routeResponse = bulkForecastFixture();
      Reflect.deleteProperty(routeResponse.conditionScores, INCLUDED_BEACH_ID);
      routeResponse.conditionSummaries[INCLUDED_BEACH_ID] = "UNKNOWN";
      const input = deepFreeze(structuredClone(routeResponse));

      const result = sanitizeBulkForecastForMajorEventHold(
        input,
        [bulkBindings()[0]],
        [bulkCandidates()[0]],
        [allowDecision],
      );

      expect(result.recommendationAvailability).toEqual({
        state: "available",
        holdEpoch: EPOCH,
      });
      expect(result.conditionScores).toEqual({
        [PRIMARY_BEACH_ID]: 91,
      });
      expect(result.conditionSummaries).toEqual({
        [PRIMARY_BEACH_ID]: "GOOD",
        [INCLUDED_BEACH_ID]: "UNKNOWN",
      });
      expect(bulkPhysicalSnapshot(result)).toEqual(bulkPhysicalSnapshot(input));
      expect(input).toEqual(routeResponse);
    },
  );

  it("bulk forecast blocks the bound positive beach without changing an unbound no-data beach", () => {
    const routeResponse = bulkForecastFixture();
    Reflect.deleteProperty(routeResponse.conditionScores, INCLUDED_BEACH_ID);
    routeResponse.conditionSummaries[INCLUDED_BEACH_ID] = "UNKNOWN";
    const input = deepFreeze(structuredClone(routeResponse));

    const result = sanitizeBulkForecastForMajorEventHold(
      input,
      [bulkBindings()[0]],
      [bulkCandidates()[0]],
      [decision("bulk-primary", "blocked")],
    );

    expect(result.recommendationAvailability).toMatchObject({
      state: "none",
      reasonCode: "major_event_hold",
    });
    expect(result.conditionScores).toEqual({});
    expect(result.conditionSummaries).toEqual({
      [PRIMARY_BEACH_ID]: "UNKNOWN",
      [INCLUDED_BEACH_ID]: "UNKNOWN",
    });
    expect(bulkPhysicalSnapshot(result)).toEqual(bulkPhysicalSnapshot(input));
  });

  it("bulk forecast permits an unbound undefined score with an UNKNOWN summary", () => {
    const routeResponse = bulkForecastFixture();
    const input = deepFreeze({
      ...structuredClone(routeResponse),
      conditionScores: {
        [PRIMARY_BEACH_ID]: 91,
        [INCLUDED_BEACH_ID]: undefined,
      },
      conditionSummaries: {
        [PRIMARY_BEACH_ID]: "GOOD",
        [INCLUDED_BEACH_ID]: "UNKNOWN",
      },
    });

    const result = sanitizeBulkForecastForMajorEventHold(
      input,
      [bulkBindings()[0]],
      [bulkCandidates()[0]],
      [decision("bulk-primary", "allow")],
    );

    expect(result.recommendationAvailability).toEqual({
      state: "available",
      holdEpoch: EPOCH,
    });
    expect(result.conditionScores).toEqual(input.conditionScores);
    expect(result.conditionSummaries).toEqual(input.conditionSummaries);
  });

  it("fails the whole bulk boundary closed for an unbound positive summary", () => {
    const routeResponse = bulkForecastFixture();
    Reflect.deleteProperty(routeResponse.conditionScores, INCLUDED_BEACH_ID);
    const input = deepFreeze(structuredClone(routeResponse));

    const result = sanitizeBulkForecastForMajorEventHold(
      input,
      [bulkBindings()[0]],
      [bulkCandidates()[0]],
      [decision("bulk-primary", "allow")],
    );

    expect(result.recommendationAvailability).toMatchObject({
      state: "none",
      reasonCode: "hold_state_unavailable",
    });
    expect(result.conditionScores).toEqual({});
    expect(result.conditionSummaries).toEqual({
      [PRIMARY_BEACH_ID]: "UNKNOWN",
      [INCLUDED_BEACH_ID]: "UNKNOWN",
    });
  });

  it("fails the whole bulk boundary closed when a binding targets an UNKNOWN-only beach", () => {
    const routeResponse = bulkForecastFixture();
    Reflect.deleteProperty(routeResponse.conditionScores, INCLUDED_BEACH_ID);
    routeResponse.conditionSummaries[INCLUDED_BEACH_ID] = "UNKNOWN";
    const input = deepFreeze(structuredClone(routeResponse));

    const result = sanitizeBulkForecastForMajorEventHold(
      input,
      bulkBindings(),
      bulkCandidates(),
      [decision("bulk-primary", "allow"), decision("bulk-included", "allow")],
    );

    expect(result.recommendationAvailability).toMatchObject({
      state: "none",
      reasonCode: "hold_state_unavailable",
    });
    expect(result.conditionScores).toEqual({});
    expect(result.conditionSummaries).toEqual({
      [PRIMARY_BEACH_ID]: "UNKNOWN",
      [INCLUDED_BEACH_ID]: "UNKNOWN",
    });
  });

  it.each([
    [
      "a missing binding",
      (args: BulkAdapterArgs) => {
        args.bindings.pop();
      },
    ],
    [
      "an extra binding",
      (args: BulkAdapterArgs) => {
        args.bindings.push({
          beachId: "33333333-3333-4333-8333-333333333333",
          candidate: candidate(
            "bulk-extra",
            "33333333-3333-4333-8333-333333333333",
            PRIMARY_START,
            PRIMARY_END,
          ),
        });
      },
    ],
    [
      "a duplicate binding",
      (args: BulkAdapterArgs) => {
        args.bindings.push(structuredClone(args.bindings[0]));
      },
    ],
    [
      "a missing candidate",
      (args: BulkAdapterArgs) => {
        args.candidates.pop();
      },
    ],
    [
      "an extra candidate",
      (args: BulkAdapterArgs) => {
        args.candidates.push(
          candidate(
            "bulk-extra",
            "33333333-3333-4333-8333-333333333333",
            PRIMARY_START,
            PRIMARY_END,
          ),
        );
      },
    ],
    [
      "a duplicate candidate",
      (args: BulkAdapterArgs) => {
        args.candidates.push(structuredClone(args.candidates[0]));
      },
    ],
    [
      "a missing decision",
      (args: BulkAdapterArgs) => {
        args.decisions.pop();
      },
    ],
    [
      "an extra decision",
      (args: BulkAdapterArgs) => {
        args.decisions.push(decision("bulk-extra", "allow"));
      },
    ],
    [
      "a duplicate decision",
      (args: BulkAdapterArgs) => {
        args.decisions.push(structuredClone(args.decisions[0]));
      },
    ],
    [
      "an inconsistent epoch",
      (args: BulkAdapterArgs) => {
        args.decisions[1] = decision("bulk-included", "allow", "epoch-2");
      },
    ],
    [
      "an unavailable decision",
      (args: BulkAdapterArgs) => {
        args.decisions[1] = decision("bulk-included", "unavailable");
      },
    ],
    [
      "a binding beach mismatch",
      (args: BulkAdapterArgs) => {
        args.bindings[0] = {
          ...args.bindings[0],
          beachId: INCLUDED_BEACH_ID,
        };
      },
    ],
    [
      "a binding time mismatch",
      (args: BulkAdapterArgs) => {
        args.bindings[0] = {
          ...args.bindings[0],
          candidate: {
            ...args.bindings[0].candidate,
            startsAt: "2026-07-19T17:00:00.000Z",
          },
        };
      },
    ],
  ] as const)(
    "fails the whole bulk boundary closed for %s",
    (_label, mutate) => {
      const args = validBulkAdapterArgs();
      mutate(args);
      const input = deepFreeze(structuredClone(bulkForecastFixture()));

      const result = sanitizeBulkForecastForMajorEventHold(
        input,
        args.bindings,
        args.candidates,
        args.decisions,
      );

      expect(result.recommendationAvailability).toMatchObject({
        state: "none",
        reasonCode: "hold_state_unavailable",
      });
      expect(result.conditionScores).toEqual({});
      expect(result.conditionSummaries).toEqual({
        [PRIMARY_BEACH_ID]: "UNKNOWN",
        [INCLUDED_BEACH_ID]: "UNKNOWN",
      });
      expect(bulkPhysicalSnapshot(result)).toEqual(bulkPhysicalSnapshot(input));
    },
  );

  it("scored forecast clears blocked slot scores and golden windows while preserving physical data", () => {
    const original = scoredForecastFixture();
    const input = deepFreeze(structuredClone(original));

    const result = sanitizeScoredForecastForMajorEventHold(
      input,
      PRIMARY_BEACH_ID,
      scoredSlotBindings(),
      scoredGoldenBindings(),
      scoredCandidates(),
      [
        decision("slot-one", "blocked"),
        decision("slot-two", "blocked"),
        decision("golden-all", "blocked"),
        decision("golden-late", "blocked"),
      ],
    );

    expect(result.recommendationAvailability).toMatchObject({
      state: "none",
      reasonCode: "major_event_hold",
    });
    expect(result.timeSlots.map((slot) => slot.compositeScore)).toEqual([
      null,
      null,
    ]);
    expect(result.goldenWindows).toEqual([]);
    expect(scoredPhysicalSnapshot(result)).toEqual(
      scoredPhysicalSnapshot(original),
    );
    expect(input).toEqual(original);
  });

  it("scored forecast keeps explicitly allowed scores and removes golden windows overlapping blocked slots", () => {
    const input = deepFreeze(structuredClone(scoredForecastFixture()));

    const result = sanitizeScoredForecastForMajorEventHold(
      input,
      PRIMARY_BEACH_ID,
      scoredSlotBindings(),
      scoredGoldenBindings(),
      scoredCandidates(),
      [
        decision("slot-one", "blocked"),
        decision("slot-two", "allow"),
        decision("golden-all", "allow"),
        decision("golden-late", "allow"),
      ],
    );

    expect(result.recommendationAvailability).toEqual({
      state: "available",
      holdEpoch: EPOCH,
    });
    expect(result.timeSlots.map((slot) => slot.compositeScore)).toEqual([
      null,
      75,
    ]);
    expect(
      result.goldenWindows.map((window) => [window.startTime, window.endTime]),
    ).toEqual([[GOLDEN_LATE_START, GOLDEN_LATE_END]]);
    expect(scoredPhysicalSnapshot(result)).toEqual(
      scoredPhysicalSnapshot(input),
    );
  });

  it("scored forecast preserves ordinary and shadow-allowed scores and windows", () => {
    const input = deepFreeze(structuredClone(scoredForecastFixture()));

    const result = sanitizeScoredForecastForMajorEventHold(
      input,
      PRIMARY_BEACH_ID,
      scoredSlotBindings(),
      scoredGoldenBindings(),
      scoredCandidates(),
      [
        shadowAllowDecision("slot-one"),
        decision("slot-two", "allow"),
        decision("golden-all", "allow"),
        decision("golden-late", "allow"),
      ],
    );

    expect(result.recommendationAvailability).toEqual({
      state: "available",
      holdEpoch: EPOCH,
    });
    expect(result.timeSlots).toEqual(input.timeSlots);
    expect(result.goldenWindows).toEqual(input.goldenWindows);
    expect(scoredPhysicalSnapshot(result)).toEqual(
      scoredPhysicalSnapshot(input),
    );
  });

  it.each([
    [
      "a missing slot binding",
      (args: ScoredAdapterArgs) => {
        args.slotBindings.pop();
      },
    ],
    [
      "an extra slot binding",
      (args: ScoredAdapterArgs) => {
        args.slotBindings.push({
          forecastAt: "2026-07-20T03:00:00.000Z",
          candidate: candidate(
            "slot-extra",
            PRIMARY_BEACH_ID,
            "2026-07-20T03:00:00.000Z",
            "2026-07-20T06:00:00.000Z",
          ),
        });
      },
    ],
    [
      "a duplicate slot binding",
      (args: ScoredAdapterArgs) => {
        args.slotBindings.push(structuredClone(args.slotBindings[0]));
      },
    ],
    [
      "a malformed slot binding",
      (args: ScoredAdapterArgs) => {
        args.slotBindings[0] = null as unknown as ScoredForecastSlotBinding;
      },
    ],
    [
      "a missing golden binding",
      (args: ScoredAdapterArgs) => {
        args.goldenBindings.pop();
      },
    ],
    [
      "a duplicate golden binding",
      (args: ScoredAdapterArgs) => {
        args.goldenBindings.push(structuredClone(args.goldenBindings[0]));
      },
    ],
    [
      "a slot beach mismatch",
      (args: ScoredAdapterArgs) => {
        args.slotBindings[0] = {
          ...args.slotBindings[0],
          candidate: {
            ...args.slotBindings[0].candidate,
            beachId: INCLUDED_BEACH_ID,
          },
        };
      },
    ],
    [
      "a slot start mismatch",
      (args: ScoredAdapterArgs) => {
        args.slotBindings[0] = {
          ...args.slotBindings[0],
          candidate: {
            ...args.slotBindings[0].candidate,
            startsAt: "2026-07-19T17:00:00.000Z",
          },
        };
      },
    ],
    [
      "a non-exact slot start representation",
      (args: ScoredAdapterArgs) => {
        const equivalentStart = "2026-07-19T08:00:00-10:00";
        args.slotBindings[0] = {
          ...args.slotBindings[0],
          candidate: {
            ...args.slotBindings[0].candidate,
            startsAt: equivalentStart,
          },
        };
        args.candidates[0] = {
          ...args.candidates[0],
          startsAt: equivalentStart,
        };
      },
    ],
    [
      "a slot end mismatch",
      (args: ScoredAdapterArgs) => {
        args.slotBindings[0] = {
          ...args.slotBindings[0],
          candidate: {
            ...args.slotBindings[0].candidate,
            endsAt: "2026-07-19T20:00:00.000Z",
          },
        };
      },
    ],
    [
      "a golden time mismatch",
      (args: ScoredAdapterArgs) => {
        args.goldenBindings[0] = {
          ...args.goldenBindings[0],
          endTime: "2026-07-19T23:00:00.000Z",
        };
      },
    ],
  ] as const)(
    "fails the whole scored boundary closed for %s",
    (_label, mutate) => {
      const args = validScoredAdapterArgs();
      mutate(args);
      const input = deepFreeze(structuredClone(scoredForecastFixture()));

      const result = sanitizeScoredForecastForMajorEventHold(
        input,
        PRIMARY_BEACH_ID,
        args.slotBindings,
        args.goldenBindings,
        args.candidates,
        args.decisions,
      );

      expect(result.recommendationAvailability).toMatchObject({
        state: "none",
        reasonCode: "hold_state_unavailable",
      });
      expect(
        result.timeSlots.every((slot) => slot.compositeScore === null),
      ).toBe(true);
      expect(result.goldenWindows).toEqual([]);
      expect(scoredPhysicalSnapshot(result)).toEqual(
        scoredPhysicalSnapshot(input),
      );
    },
  );

  it("builds an exact Daily Intel candidate from a verified beach timezone", () => {
    expect(
      buildDailyIntelMajorEventHoldCandidate(
        dailyIntelFixture(),
        "Pacific/Honolulu",
      ),
    ).toEqual(DAILY_INTEL_CANDIDATE);

    expect(
      buildDailyIntelMajorEventHoldCandidate(
        {
          ...dailyIntelFixture(),
          best_window_start: "06:15:30.125789",
          best_window_end: "08:45",
        },
        "America/Los_Angeles",
      ),
    ).toEqual(
      candidate(
        DAILY_INTEL_CANDIDATE_ID,
        PRIMARY_BEACH_ID,
        "2026-07-19T13:15:30.125Z",
        "2026-07-19T15:45:00.000Z",
      ),
    );
  });

  it("rolls an overnight Daily Intel window to the next local civil day", () => {
    expect(
      buildDailyIntelMajorEventHoldCandidate(
        {
          ...dailyIntelFixture(),
          best_window_start: "23:30:00",
          best_window_end: "01:15:00",
        },
        "Pacific/Honolulu",
      ),
    ).toEqual(
      candidate(
        DAILY_INTEL_CANDIDATE_ID,
        PRIMARY_BEACH_ID,
        "2026-07-20T09:30:00.000Z",
        "2026-07-20T11:15:00.000Z",
      ),
    );
  });

  it.each([
    ["an invalid timezone", dailyIntelFixture(), "Mars/Olympus_Mons"],
    [
      "a nonexistent DST civil time",
      {
        ...dailyIntelFixture(),
        forecast_date: "2026-03-08",
        best_window_start: "02:30",
        best_window_end: "03:30",
      },
      "America/Los_Angeles",
    ],
    [
      "an ambiguous DST-fold start",
      {
        ...dailyIntelFixture(),
        forecast_date: "2026-11-01",
        best_window_start: "01:30",
        best_window_end: "03:00",
      },
      "America/New_York",
    ],
    [
      "an ambiguous DST-fold end",
      {
        ...dailyIntelFixture(),
        forecast_date: "2026-11-01",
        best_window_start: "00:30",
        best_window_end: "01:30",
      },
      "America/New_York",
    ],
    [
      "an equal start and end",
      {
        ...dailyIntelFixture(),
        best_window_start: "06:00",
        best_window_end: "06:00:00",
      },
      "Pacific/Honolulu",
    ],
    [
      "an invalid local date",
      { ...dailyIntelFixture(), forecast_date: "2026-02-30" },
      "Pacific/Honolulu",
    ],
    [
      "a malformed Postgres time",
      { ...dailyIntelFixture(), best_window_start: "6 AM" },
      "Pacific/Honolulu",
    ],
    [
      "a missing identity",
      { ...dailyIntelFixture(), id: "" },
      "Pacific/Honolulu",
    ],
  ] as const)(
    "rejects Daily Intel candidate context with %s",
    (_label, intel, timezone) => {
      expect(
        buildDailyIntelMajorEventHoldCandidate(intel, timezone),
      ).toBeNull();
    },
  );

  it.each([
    ["blocked", decision(DAILY_INTEL_CANDIDATE_ID, "blocked")],
    ["unavailable", decision(DAILY_INTEL_CANDIDATE_ID, "unavailable")],
  ] as const)(
    "Daily Intel clears positive prose for a %s decision and preserves physical data",
    (_label, holdDecision) => {
      const original = dailyIntelFixture();
      const input = deepFreeze(structuredClone(original));

      const result = sanitizeDailyIntelForMajorEventHold(
        input,
        "Pacific/Honolulu",
        [{ ...DAILY_INTEL_CANDIDATE }],
        [holdDecision],
      );

      expect(result.recommendationAvailability).toMatchObject({
        state: "none",
        reasonCode:
          holdDecision.evaluation.reasonCode === "major_event_hold"
            ? "major_event_hold"
            : "hold_state_unavailable",
      });
      expect(result).toMatchObject({
        conditions_score: null,
        confidence: null,
        recommendation: null,
        best_window_start: null,
        best_window_end: null,
        best_window_description: null,
        best_window_wave_height_label: null,
        best_window_height_label: null,
      });
      expect(dailyIntelPhysicalSnapshot(result)).toEqual(
        dailyIntelPhysicalSnapshot(original),
      );

      const sanitizedRaw = result.raw_intel_data as Record<string, unknown>;
      const sanitizedPayload = sanitizedRaw.payload as Record<string, unknown>;
      for (const key of [
        "recommendation",
        "notes",
        "bestWindow",
        "confidence",
        "conditions",
      ]) {
        expect(sanitizedRaw).not.toHaveProperty(key);
      }
      for (const key of [
        "recommendation",
        "bestWindow",
        "confidence",
        "conditions",
      ]) {
        expect(sanitizedPayload).not.toHaveProperty(key);
      }
      expect(sanitizedRaw).toMatchObject({
        surf: original.raw_intel_data.surf,
        tide: original.raw_intel_data.tide,
        swells: original.raw_intel_data.swells,
        wind: original.raw_intel_data.wind,
        sources: original.raw_intel_data.sources,
        dataCompleteness: original.raw_intel_data.dataCompleteness,
        waterQuality: original.raw_intel_data.waterQuality,
        beach: original.raw_intel_data.beach,
      });
      expect(sanitizedRaw).not.toHaveProperty("debug");
      expect(sanitizedPayload).toMatchObject({
        surf: original.raw_intel_data.payload.surf,
        tide: original.raw_intel_data.payload.tide,
        swells: original.raw_intel_data.payload.swells,
        wind: original.raw_intel_data.payload.wind,
        sources: original.raw_intel_data.payload.sources,
        dataCompleteness: original.raw_intel_data.payload.dataCompleteness,
        waterQuality: original.raw_intel_data.payload.waterQuality,
        beach: original.raw_intel_data.payload.beach,
      });
      expect(sanitizedPayload).not.toHaveProperty("debug");
      expect(input).toEqual(original);
    },
  );

  it("Daily Intel allowlists nested raw physical fields and drops unknown deep prose", () => {
    const fixture = dailyIntelFixture();
    const raw = fixture.raw_intel_data;
    const input = deepFreeze({
      ...structuredClone(fixture),
      raw_intel_data: {
        ...structuredClone(raw),
        unknownDeep: {
          nested: {
            recommendation: "LEAK_ROOT_DEEP_RECOMMENDATION",
            score: 99,
            confidence: "LEAK_ROOT_DEEP_CONFIDENCE",
            prose: "LEAK_ROOT_DEEP_PROSE",
          },
        },
        surf: {
          ...structuredClone(raw.surf),
          recommendation: "LEAK_SURF_RECOMMENDATION",
          prose: "LEAK_SURF_PROSE",
        },
        tide: {
          ...structuredClone(raw.tide),
          bestWindow: "LEAK_TIDE_WINDOW",
          nextEvent: {
            ...structuredClone(raw.tide.nextEvent),
            recommendation: "LEAK_TIDE_EVENT_RECOMMENDATION",
          },
        },
        wind: {
          ...structuredClone(raw.wind),
          conditions: "LEAK_WIND_CONDITIONS",
          score: 100,
        },
        swells: {
          ...structuredClone(raw.swells),
          primary: {
            ...structuredClone(raw.swells.primary),
            confidence: "LEAK_SWELL_CONFIDENCE",
          },
        },
        payload: {
          ...structuredClone(raw.payload),
          unknownDeep: {
            recommendation: "LEAK_PAYLOAD_DEEP_RECOMMENDATION",
          },
          surf: {
            ...structuredClone(raw.payload.surf),
            recommendation: "LEAK_PAYLOAD_SURF_RECOMMENDATION",
          },
          tide: {
            ...structuredClone(raw.payload.tide),
            prose: "LEAK_PAYLOAD_TIDE_PROSE",
          },
          wind: {
            ...structuredClone(raw.payload.wind),
            score: 100,
          },
        },
      },
    });

    const result = sanitizeDailyIntelForMajorEventHold(
      input,
      "Pacific/Honolulu",
      [{ ...DAILY_INTEL_CANDIDATE }],
      [decision(DAILY_INTEL_CANDIDATE_ID, "blocked")],
    );
    const sanitizedRaw = result.raw_intel_data as Record<string, unknown>;
    const sanitizedPayload = sanitizedRaw.payload as Record<string, unknown>;
    const serialized = JSON.stringify(result.raw_intel_data);

    expect(serialized).not.toContain("LEAK_");
    expect(sanitizedRaw.surf).toEqual(raw.surf);
    expect(sanitizedRaw.tide).toEqual(raw.tide);
    expect(sanitizedRaw.wind).toEqual(raw.wind);
    expect(sanitizedRaw.swells).toEqual(raw.swells);
    expect(sanitizedPayload.surf).toEqual(raw.payload.surf);
    expect(sanitizedPayload.tide).toEqual(raw.payload.tide);
    expect(sanitizedPayload.wind).toEqual(raw.payload.wind);
    expect(sanitizedRaw).not.toHaveProperty("unknownDeep");
    expect(sanitizedPayload).not.toHaveProperty("unknownDeep");
    expect(input.raw_intel_data.unknownDeep.nested.recommendation).toBe(
      "LEAK_ROOT_DEEP_RECOMMENDATION",
    );
  });

  it.each([
    ["an array", [{ recommendation: "LEAK_ARRAY" }]],
    ["a primitive", "LEAK_PRIMITIVE"],
    ["null", null],
  ] as const)(
    "Daily Intel replaces %s raw intel with null while blocked",
    (_label, rawIntelData) => {
      const input = deepFreeze({
        ...structuredClone(dailyIntelFixture()),
        raw_intel_data: structuredClone(rawIntelData),
      });
      const result = sanitizeDailyIntelForMajorEventHold(
        input,
        "Pacific/Honolulu",
        [{ ...DAILY_INTEL_CANDIDATE }],
        [decision(DAILY_INTEL_CANDIDATE_ID, "blocked")],
      );

      expect(result.raw_intel_data).toBeNull();
      expect(input.raw_intel_data).toEqual(rawIntelData);
    },
  );

  it("Daily Intel drops a malformed raw payload instead of passing it through", () => {
    const raw = dailyIntelFixture().raw_intel_data;
    const input = deepFreeze({
      ...structuredClone(dailyIntelFixture()),
      raw_intel_data: {
        ...structuredClone(raw),
        payload: ["LEAK_MALFORMED_PAYLOAD"],
      },
    });
    const result = sanitizeDailyIntelForMajorEventHold(
      input,
      "Pacific/Honolulu",
      [{ ...DAILY_INTEL_CANDIDATE }],
      [decision(DAILY_INTEL_CANDIDATE_ID, "blocked")],
    );

    expect(result.raw_intel_data).not.toHaveProperty("payload");
    expect(JSON.stringify(result.raw_intel_data)).not.toContain(
      "LEAK_MALFORMED_PAYLOAD",
    );
  });

  it.each([
    ["ordinary", decision(DAILY_INTEL_CANDIDATE_ID, "allow")],
    ["shadow", shadowAllowDecision(DAILY_INTEL_CANDIDATE_ID)],
  ] as const)(
    "Daily Intel preserves the exact response for a %s allow",
    (_label, holdDecision) => {
      const input = deepFreeze(structuredClone(dailyIntelFixture()));
      const result = sanitizeDailyIntelForMajorEventHold(
        input,
        "Pacific/Honolulu",
        [{ ...DAILY_INTEL_CANDIDATE }],
        [holdDecision],
      );
      const { recommendationAvailability, ...preserved } = result;

      expect(recommendationAvailability).toEqual({
        state: "available",
        holdEpoch: EPOCH,
      });
      expect(preserved).toEqual(input);
    },
  );

  it.each([
    ["a missing candidate", [], []],
    [
      "an extra candidate",
      [
        DAILY_INTEL_CANDIDATE,
        candidate(
          "daily-intel:extra",
          INCLUDED_BEACH_ID,
          PRIMARY_START,
          PRIMARY_END,
        ),
      ],
      [
        decision(DAILY_INTEL_CANDIDATE_ID, "allow"),
        decision("daily-intel:extra", "allow"),
      ],
    ],
    [
      "a duplicate candidate",
      [DAILY_INTEL_CANDIDATE, DAILY_INTEL_CANDIDATE],
      [decision(DAILY_INTEL_CANDIDATE_ID, "allow")],
    ],
    [
      "a non-exact candidate window",
      [
        {
          ...DAILY_INTEL_CANDIDATE,
          startsAt: "2026-07-19T06:00:00.000-10:00",
        },
      ],
      [decision(DAILY_INTEL_CANDIDATE_ID, "allow")],
    ],
    [
      "a duplicate decision",
      [DAILY_INTEL_CANDIDATE],
      [
        decision(DAILY_INTEL_CANDIDATE_ID, "allow"),
        decision(DAILY_INTEL_CANDIDATE_ID, "allow"),
      ],
    ],
  ] as const)(
    "fails the whole Daily Intel boundary closed for %s",
    (_label, candidates, decisions) => {
      const input = deepFreeze(structuredClone(dailyIntelFixture()));
      const result = sanitizeDailyIntelForMajorEventHold(
        input,
        "Pacific/Honolulu",
        candidates,
        decisions,
      );

      expect(result.recommendationAvailability).toMatchObject({
        state: "none",
        reasonCode: "hold_state_unavailable",
      });
      expect(result.recommendation).toBeNull();
      expect(result.conditions_score).toBeNull();
      expect(dailyIntelPhysicalSnapshot(result)).toEqual(
        dailyIntelPhysicalSnapshot(input),
      );
    },
  );

  it("fails Daily Intel closed when the supplied timezone cannot reproduce its window", () => {
    const input = deepFreeze(structuredClone(dailyIntelFixture()));
    const result = sanitizeDailyIntelForMajorEventHold(
      input,
      "Invalid/Timezone",
      [{ ...DAILY_INTEL_CANDIDATE }],
      [decision(DAILY_INTEL_CANDIDATE_ID, "allow")],
    );

    expect(result.recommendationAvailability).toMatchObject({
      state: "none",
      reasonCode: "hold_state_unavailable",
    });
    expect(result.best_window_start).toBeNull();
  });

  it("legacy V1 clears all recommendation arrays when every candidate is blocked", () => {
    const original = legacyFixture();
    const input = deepFreeze(structuredClone(original));
    const result = sanitizeLegacyV1RecommendationsForMajorEventHold(
      input,
      legacyCandidates(),
      [
        decision(
          `legacy-v1:${PRIMARY_BEACH_ID}:${LEGACY_QUERY_TIME}`,
          "blocked",
        ),
        decision(
          `legacy-v1:${INCLUDED_BEACH_ID}:${LEGACY_QUERY_TIME}`,
          "blocked",
        ),
      ],
    );

    expect(result.recommendationAvailability).toMatchObject({
      state: "none",
      reasonCode: "major_event_hold",
    });
    expect(result.recommendations).toEqual([]);
    expect(result.top_picks).toEqual([]);
    expect(result.metadata).toEqual(original.metadata);
    expect(input).toEqual(original);
  });

  it.each([
    [
      "ordinary",
      [
        decision(`legacy-v1:${PRIMARY_BEACH_ID}:${LEGACY_QUERY_TIME}`, "allow"),
        decision(
          `legacy-v1:${INCLUDED_BEACH_ID}:${LEGACY_QUERY_TIME}`,
          "allow",
        ),
      ],
    ],
    [
      "shadow",
      [
        shadowAllowDecision(
          `legacy-v1:${PRIMARY_BEACH_ID}:${LEGACY_QUERY_TIME}`,
        ),
        shadowAllowDecision(
          `legacy-v1:${INCLUDED_BEACH_ID}:${LEGACY_QUERY_TIME}`,
        ),
      ],
    ],
  ] as const)(
    "legacy V1 preserves allowed rows and metadata while reranking top picks for %s allows",
    (_label, decisions) => {
      const input = deepFreeze(structuredClone(legacyFixture()));
      const result = sanitizeLegacyV1RecommendationsForMajorEventHold(
        input,
        legacyCandidates(),
        decisions,
      );
      const { recommendationAvailability, ...preserved } = result;

      expect(recommendationAvailability).toEqual({
        state: "available",
        holdEpoch: EPOCH,
      });
      expect(preserved).toEqual({
        ...input,
        top_picks: input.top_picks.map((topPick, index) => ({
          ...topPick,
          rank: index + 1,
        })),
      });
    },
  );

  it.each([
    ["parseable non-ISO text", "July 19, 2026 18:00:00Z"],
    ["a missing zone", "2026-07-19T18:00:00"],
    ["February 30", "2026-02-30T18:00:00Z"],
    ["a non-leap February 29", "2025-02-29T18:00:00Z"],
    ["hour 24", "2026-07-19T24:00:00Z"],
    ["an offset hour above 23", "2026-07-19T18:00:00+24:00"],
    ["an offset minute above 59", "2026-07-19T18:00:00+10:60"],
  ] as const)(
    "legacy V1 rejects metadata.query_time with %s",
    (_label, queryTime) => {
      const context = legacyContextAt(queryTime);
      const result = sanitizeLegacyV1RecommendationsForMajorEventHold(
        deepFreeze(structuredClone(context.response)),
        context.candidates,
        context.decisions,
      );

      expect(result.recommendationAvailability).toMatchObject({
        state: "none",
        reasonCode: "hold_state_unavailable",
      });
      expect(result.recommendations).toEqual([]);
      expect(result.top_picks).toEqual([]);
    },
  );

  it("legacy V1 retains an exact valid offset start and canonical plus-one-millisecond end", () => {
    const queryTime = "2026-07-19T08:00:00-10:00";
    const context = legacyContextAt(queryTime);
    const input = deepFreeze(structuredClone(context.response));
    const result = sanitizeLegacyV1RecommendationsForMajorEventHold(
      input,
      context.candidates,
      context.decisions,
    );

    expect(context.candidates[0]).toMatchObject({
      startsAt: queryTime,
      endsAt: "2026-07-19T18:00:00.001Z",
    });
    expect(result.recommendationAvailability).toEqual({
      state: "available",
      holdEpoch: EPOCH,
    });
    expect(result.recommendations).toEqual(input.recommendations);
    expect(result.top_picks).toEqual(
      input.top_picks.map((topPick, index) => ({
        ...topPick,
        rank: index + 1,
      })),
    );
  });

  it("legacy V1 filters blocked rows and reranks surviving top picks", () => {
    const input = deepFreeze(structuredClone(legacyFixture()));
    const result = sanitizeLegacyV1RecommendationsForMajorEventHold(
      input,
      legacyCandidates(),
      [
        decision(
          `legacy-v1:${PRIMARY_BEACH_ID}:${LEGACY_QUERY_TIME}`,
          "blocked",
        ),
        decision(
          `legacy-v1:${INCLUDED_BEACH_ID}:${LEGACY_QUERY_TIME}`,
          "allow",
        ),
      ],
    );

    expect(result.recommendationAvailability).toEqual({
      state: "available",
      holdEpoch: EPOCH,
    });
    expect(result.recommendations).toEqual([input.recommendations[1]]);
    expect(result.top_picks).toEqual([{ ...input.top_picks[1], rank: 1 }]);
    expect(result.metadata).toEqual(input.metadata);
  });

  it.each([
    [
      "a missing candidate",
      (args: LegacyAdapterArgs) => {
        args.candidates.pop();
      },
    ],
    [
      "an extra candidate",
      (args: LegacyAdapterArgs) => {
        args.candidates.push(
          candidate(
            `legacy-v1:33333333-3333-4333-8333-333333333333:${LEGACY_QUERY_TIME}`,
            "33333333-3333-4333-8333-333333333333",
            LEGACY_QUERY_TIME,
            "2026-07-19T18:00:00.001Z",
          ),
        );
      },
    ],
    [
      "a duplicate candidate",
      (args: LegacyAdapterArgs) => {
        args.candidates.push(structuredClone(args.candidates[0]));
      },
    ],
    [
      "a non-exact candidate start",
      (args: LegacyAdapterArgs) => {
        args.candidates[0] = {
          ...(args.candidates[0] as MajorEventHoldCandidate),
          startsAt: "2026-07-19T08:00:00.000-10:00",
        };
      },
    ],
    [
      "a candidate end other than exact query time plus one millisecond",
      (args: LegacyAdapterArgs) => {
        args.candidates[0] = {
          ...(args.candidates[0] as MajorEventHoldCandidate),
          endsAt: "2026-07-19T18:00:00.002Z",
        };
      },
    ],
    [
      "a missing decision",
      (args: LegacyAdapterArgs) => {
        args.decisions.pop();
      },
    ],
    [
      "an extra decision",
      (args: LegacyAdapterArgs) => {
        args.decisions.push(decision("legacy-v1:extra", "allow"));
      },
    ],
    [
      "a duplicate decision",
      (args: LegacyAdapterArgs) => {
        args.decisions.push(structuredClone(args.decisions[0]));
      },
    ],
    [
      "an inconsistent decision epoch",
      (args: LegacyAdapterArgs) => {
        args.decisions[1] = decision(
          `legacy-v1:${INCLUDED_BEACH_ID}:${LEGACY_QUERY_TIME}`,
          "allow",
          "epoch-2",
        );
      },
    ],
  ] as const)(
    "fails the whole legacy V1 boundary closed for %s",
    (_label, mutate) => {
      const args = validLegacyAdapterArgs();
      mutate(args);
      const input = deepFreeze(structuredClone(legacyFixture()));
      const result = sanitizeLegacyV1RecommendationsForMajorEventHold(
        input,
        args.candidates,
        args.decisions,
      );

      expect(result.recommendationAvailability).toMatchObject({
        state: "none",
        reasonCode: "hold_state_unavailable",
      });
      expect(result.recommendations).toEqual([]);
      expect(result.top_picks).toEqual([]);
      expect(result.metadata).toEqual(input.metadata);
    },
  );

  it.each([
    [
      "a duplicate recommendation",
      (response: RecommendationsResponse) => {
        response.recommendations.push(
          structuredClone(response.recommendations[0]),
        );
      },
    ],
    [
      "a top pick with no recommendation",
      (response: RecommendationsResponse) => {
        response.top_picks[0] = {
          ...response.top_picks[0],
          spotId: "33333333-3333-4333-8333-333333333333",
        };
      },
    ],
    [
      "a top pick with mismatched query time",
      (response: RecommendationsResponse) => {
        response.top_picks[0] = {
          ...response.top_picks[0],
          snapshot: {
            ...response.top_picks[0].snapshot,
            timestamp: "2026-07-19T18:00:00.001Z",
          },
        };
      },
    ],
  ] as const)("fails legacy V1 closed for %s", (_label, mutate) => {
    const response = legacyFixture();
    mutate(response);
    const result = sanitizeLegacyV1RecommendationsForMajorEventHold(
      deepFreeze(structuredClone(response)),
      legacyCandidates(),
      validLegacyAdapterArgs().decisions,
    );

    expect(result.recommendationAvailability).toMatchObject({
      state: "none",
      reasonCode: "hold_state_unavailable",
    });
    expect(result.recommendations).toEqual([]);
    expect(result.top_picks).toEqual([]);
  });

  it.each([
    ["off", coachDecision("allow", "off-epoch")],
    ["shadow invalid-context", coachDecision("allow", "shadow-epoch")],
  ] as const)(
    "Coach Picks preserves nonempty picks for a valid %s allow",
    (_label, holdDecision) => {
      const input = deepFreeze(structuredClone(coachPicksFixture()));
      const result = sanitizeCoachPicksForMajorEventHold(input, [holdDecision]);

      expect(result.picks).toEqual(input.picks);
      expect(result.metadata).toEqual(input.metadata);
      expect(result.recommendationAvailability).toEqual(
        holdDecision.recommendationAvailability,
      );
      expect(result).not.toHaveProperty("evaluation");
      expect(result).not.toHaveProperty("evidence");
      expect(input).toEqual(coachPicksFixture());
    },
  );

  it("Coach Picks clears nonempty picks for a valid enforce invalid-context decision", () => {
    const input = deepFreeze(structuredClone(coachPicksFixture()));
    const result = sanitizeCoachPicksForMajorEventHold(input, [
      coachDecision("unavailable", "enforce-epoch"),
    ]);

    expect(result.picks).toEqual([]);
    expect(result.metadata).toEqual(input.metadata);
    expect(result.recommendationAvailability).toEqual({
      state: "none",
      reasonCode: "hold_state_unavailable",
      holdEpoch: "enforce-epoch",
    });
  });

  it.each([
    ["a missing decision", []],
    ["an extra decision", [coachDecision("allow"), coachDecision("allow")]],
    [
      "a non-null candidate ID",
      [{ ...coachDecision("allow"), candidateId: "invented-window" }],
    ],
    [
      "a mismatched epoch",
      [
        {
          ...coachDecision("allow"),
          recommendationAvailability: {
            state: "available" as const,
            holdEpoch: "other-epoch",
          },
        },
      ],
    ],
    [
      "major-event hold evidence for an invalid candidate",
      [
        {
          candidateId: null,
          evaluation: {
            outcome: "explicit_none" as const,
            reasonCode: "major_event_hold" as const,
            holdIds: ["internal-hold-id"] as string[],
            expiresAt: "2026-07-21T00:00:00.000Z",
            holdEpoch: EPOCH,
          },
          recommendationAvailability: {
            state: "none" as const,
            reasonCode: "major_event_hold" as const,
            expiresAt: "2026-07-21T00:00:00.000Z",
            holdEpoch: EPOCH,
          },
        },
      ],
    ],
  ] as const)(
    "Coach Picks fails closed without leaking internals for %s",
    (_label, decisions) => {
      const input = deepFreeze(structuredClone(coachPicksFixture()));
      const result = sanitizeCoachPicksForMajorEventHold(input, decisions);

      expect(result.picks).toEqual([]);
      expect(result.metadata).toEqual(input.metadata);
      expect(result.recommendationAvailability).toEqual({
        state: "none",
        reasonCode: "hold_state_unavailable",
        holdEpoch: "hold-state-unavailable",
      });
      expect(JSON.stringify(result)).not.toContain("internal-hold-id");
      expect(result).not.toHaveProperty("evaluation");
    },
  );

  it.each([
    ["ordinary allows", intentDecisions()],
    [
      "shadow would-block allows",
      intentCandidates().map(({ candidateId }) =>
        shadowAllowDecision(candidateId),
      ),
    ],
  ] as const)(
    "Intent Forecast preserves the original top three and bestWindow for %s",
    (_label, decisions) => {
      const input = deepFreeze(structuredClone(intentForecastFixture()));

      const result = sanitizeIntentForecastForMajorEventHold(
        input,
        intentCandidates(),
        decisions,
      );

      expect(result.topPicks).toEqual(
        input.items.slice(0, 3).map(({ topPick }) => topPick),
      );
      expect(result.bestWindow).toBe(input.bestWindow);
      expect(result.conditions).toBe(input.conditions);
      expect(result.isTomorrow).toBe(input.isTomorrow);
      expect(result.recommendationAvailability).toEqual({
        state: "available",
        holdEpoch: EPOCH,
      });
      expect(input).toEqual(intentForecastFixture());
    },
  );

  it("Intent Forecast removes a blocked rank one before truncating and keeps rank four", () => {
    const input = deepFreeze(structuredClone(intentForecastFixture()));
    const candidates = deepFreeze(structuredClone(intentCandidates()));
    const decisions = deepFreeze(
      structuredClone(intentDecisions({ "intent-1": "blocked" })),
    );

    const result = sanitizeIntentForecastForMajorEventHold(
      input,
      candidates,
      decisions,
    );

    expect(result.topPicks.map(({ name }) => name)).toEqual([
      "Beach 2",
      "Beach 3",
      "Beach 4",
    ]);
    expect(result.bestWindow).toBeNull();
    expect(result.conditions).toEqual(input.conditions);
    expect(result.isTomorrow).toBe(true);
    expect(result.recommendationAvailability).toEqual({
      state: "available",
      holdEpoch: EPOCH,
    });
    expect(input).toEqual(intentForecastFixture());
    expect(candidates).toEqual(intentCandidates());
    expect(decisions).toEqual(intentDecisions({ "intent-1": "blocked" }));
  });

  it("Intent Forecast removes a blocked rank two before truncating without rebuilding bestWindow", () => {
    const input = deepFreeze(structuredClone(intentForecastFixture()));

    const result = sanitizeIntentForecastForMajorEventHold(
      input,
      intentCandidates(),
      intentDecisions({ "intent-2": "blocked" }),
    );

    expect(result.topPicks.map(({ name }) => name)).toEqual([
      "Beach 1",
      "Beach 3",
      "Beach 4",
    ]);
    expect(result.bestWindow).toEqual(input.bestWindow);
    expect(result.bestWindow).toBe(input.bestWindow);
    expect(result.conditions).toBe(input.conditions);
    expect(result.isTomorrow).toBe(input.isTomorrow);
    expect(result.recommendationAvailability).toEqual({
      state: "available",
      holdEpoch: EPOCH,
    });
  });

  it("Intent Forecast clears every positive when all ranked candidates are blocked", () => {
    const input = deepFreeze(structuredClone(intentForecastFixture()));
    const allBlocked = Object.fromEntries(
      intentCandidates().map(({ candidateId }) => [candidateId, "blocked"]),
    ) as Record<string, "blocked">;

    const result = sanitizeIntentForecastForMajorEventHold(
      input,
      intentCandidates(),
      intentDecisions(allBlocked),
    );

    expect(result.topPicks).toEqual([]);
    expect(result.bestWindow).toBeNull();
    expect(result.conditions).toEqual(input.conditions);
    expect(result.isTomorrow).toBe(input.isTomorrow);
    expect(result.recommendationAvailability).toEqual({
      state: "none",
      reasonCode: "major_event_hold",
      expiresAt: "2026-07-21T00:00:00.000Z",
      holdEpoch: EPOCH,
    });
  });

  it.each([
    [
      "an unresolved hold decision",
      (args: IntentAdapterArgs) => {
        args.decisions[0] = decision("intent-1", "unavailable");
      },
    ],
    [
      "a malformed allow decision",
      (args: IntentAdapterArgs) => {
        args.decisions[0] = {
          ...decision("intent-1", "allow"),
          recommendationAvailability: {
            state: "none",
            reasonCode: "hold_state_unavailable",
            holdEpoch: EPOCH,
          },
        };
      },
    ],
    [
      "a missing service candidate",
      (args: IntentAdapterArgs) => {
        args.candidates.pop();
      },
    ],
    [
      "an extra service candidate and decision",
      (args: IntentAdapterArgs) => {
        args.candidates.push(
          candidate(
            "intent-extra",
            "33333333-3333-4333-8333-333333333333",
            "2026-07-19T22:30:00.000Z",
            "2026-07-19T23:30:00.000Z",
          ),
        );
        args.decisions.push(decision("intent-extra", "allow"));
      },
    ],
    [
      "a duplicate service candidate",
      (args: IntentAdapterArgs) => {
        args.candidates.push(structuredClone(args.candidates[0]));
      },
    ],
    [
      "a service candidate with a mismatched ID",
      (args: IntentAdapterArgs) => {
        args.candidates[0] = {
          ...(args.candidates[0] as MajorEventHoldCandidate),
          candidateId: "intent-mismatch",
        };
      },
    ],
    [
      "a service candidate with a mismatched beach",
      (args: IntentAdapterArgs) => {
        args.candidates[0] = {
          ...(args.candidates[0] as MajorEventHoldCandidate),
          beachId: INCLUDED_BEACH_ID,
        };
      },
    ],
    [
      "a service candidate with a non-exact start representation",
      (args: IntentAdapterArgs) => {
        args.candidates[0] = {
          ...(args.candidates[0] as MajorEventHoldCandidate),
          startsAt: "2026-07-19T07:30:00.000-10:00",
        };
      },
    ],
    [
      "a service candidate with a non-exact end representation",
      (args: IntentAdapterArgs) => {
        args.candidates[0] = {
          ...(args.candidates[0] as MajorEventHoldCandidate),
          endsAt: "2026-07-19T08:30:00.000-10:00",
        };
      },
    ],
    [
      "a top pick bound to a different beach",
      (args: IntentAdapterArgs) => {
        const first = args.input.items[0];
        args.input = {
          ...args.input,
          items: [
            { ...first, topPick: args.input.items[1].topPick },
            ...args.input.items.slice(1),
          ],
        };
      },
    ],
    [
      "a candidate binding whose window is not peakTime plus or minus thirty minutes",
      (args: IntentAdapterArgs) => {
        const first = args.input.items[0];
        const malformedCandidate = {
          ...first.candidate,
          startsAt: "2026-07-19T17:31:00.000Z",
        };
        args.input = {
          ...args.input,
          items: [
            { ...first, candidate: malformedCandidate },
            ...args.input.items.slice(1),
          ],
        };
        args.candidates[0] = malformedCandidate;
      },
    ],
    [
      "a display-local peak time",
      (args: IntentAdapterArgs) => {
        const first = args.input.items[0];
        args.input = {
          ...args.input,
          items: [
            { ...first, peakTime: "8:00 AM" },
            ...args.input.items.slice(1),
          ],
        };
      },
    ],
    [
      "a duplicate ranked candidate binding",
      (args: IntentAdapterArgs) => {
        args.input = {
          ...args.input,
          items: [...args.input.items, structuredClone(args.input.items[0])],
        };
      },
    ],
    [
      "a missing decision",
      (args: IntentAdapterArgs) => {
        args.decisions.pop();
      },
    ],
    [
      "an extra decision",
      (args: IntentAdapterArgs) => {
        args.decisions.push(decision("intent-extra", "allow"));
      },
    ],
    [
      "a duplicate decision",
      (args: IntentAdapterArgs) => {
        args.decisions.push(structuredClone(args.decisions[0]));
      },
    ],
    [
      "a mismatched decision ID",
      (args: IntentAdapterArgs) => {
        args.decisions[0] = decision("intent-mismatch", "allow");
      },
    ],
    [
      "an inconsistent decision epoch",
      (args: IntentAdapterArgs) => {
        args.decisions[1] = decision("intent-2", "allow", "epoch-2");
      },
    ],
    [
      "a bestWindow bound to the wrong existing ranked candidate",
      (args: IntentAdapterArgs) => {
        args.input = {
          ...args.input,
          bestWindowSourceCandidateId: "intent-2",
        };
      },
    ],
    [
      "a missing bestWindow source binding",
      (args: IntentAdapterArgs) => {
        args.input = {
          ...args.input,
          bestWindowSourceCandidateId: "intent-missing",
        };
      },
    ],
    [
      "a bestWindow without a source binding",
      (args: IntentAdapterArgs) => {
        args.input = { ...args.input, bestWindowSourceCandidateId: null };
      },
    ],
    [
      "a source binding without a bestWindow",
      (args: IntentAdapterArgs) => {
        args.input = { ...args.input, bestWindow: null };
      },
    ],
  ] as const)("Intent Forecast fails closed for %s", (_label, mutate) => {
    const args = validIntentAdapterArgs();
    mutate(args);
    const inputSnapshot = structuredClone(args.input);
    const candidatesSnapshot = structuredClone(args.candidates);
    const decisionsSnapshot = structuredClone(args.decisions);
    const input = deepFreeze(args.input);
    const candidates = deepFreeze(args.candidates);
    const decisions = deepFreeze(args.decisions);

    const result = sanitizeIntentForecastForMajorEventHold(
      input,
      candidates,
      decisions,
    );

    expect(result.topPicks).toEqual([]);
    expect(result.bestWindow).toBeNull();
    expect(result.conditions).toEqual(input.conditions);
    expect(result.isTomorrow).toBe(input.isTomorrow);
    expect(result.recommendationAvailability).toMatchObject({
      state: "none",
      reasonCode: "hold_state_unavailable",
    });
    expect(input).toEqual(inputSnapshot);
    expect(candidates).toEqual(candidatesSnapshot);
    expect(decisions).toEqual(decisionsSnapshot);
  });

  it("Intent Forecast keeps an empty input empty and conservative", () => {
    const fixture = intentForecastFixture();
    const input = deepFreeze({
      ...fixture,
      items: [],
      bestWindow: null,
      bestWindowSourceCandidateId: null,
    });

    const result = sanitizeIntentForecastForMajorEventHold(input, [], []);

    expect(result).toEqual({
      bestWindow: null,
      topPicks: [],
      conditions: fixture.conditions,
      isTomorrow: true,
      recommendationAvailability: {
        state: "none",
        reasonCode: "hold_state_unavailable",
        holdEpoch: "hold-state-unavailable",
      },
    });
  });
});
