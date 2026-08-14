/**
 * @jest-environment node
 */

import {
  buildRegionalMajorEventHoldCandidates,
  sanitizeRegionalForecastForMajorEventHold,
} from "@/lib/recommendations/major-event-hold/adapters/regional";
import type {
  MajorEventHoldCandidateDecision,
} from "@/lib/recommendations/major-event-hold/types";
import { evaluateMajorEventHoldCandidates } from "@/lib/recommendations/major-event-hold/service";
import type {
  DaySummary,
  RegionalForecastSummary,
} from "@/lib/utils/regional-forecast-utils";
import { aggregateRegionalForecast } from "@/lib/utils/regional-forecast-utils";
import type { Beach } from "@/types/database";
import type { EnhancedForecastEntity } from "@/types/forecast";
import type { SurfWindowRecommendation } from "@/types/session-intelligence";

const EPOCH = "regional-hold-epoch";
const STARTS_AT = "2026-07-20T00:00:00.000Z";
const ENDS_AT = "2026-07-21T00:00:00.000Z";
const BEACH_IDS = [
  "11111111-1111-4111-8111-111111111111",
  "22222222-2222-4222-8222-222222222222",
  "33333333-3333-4333-8333-333333333333",
  "44444444-4444-4444-8444-444444444444",
  "55555555-5555-4555-8555-555555555555",
  "66666666-6666-4666-8666-666666666666",
  "77777777-7777-4777-8777-777777777777",
] as const;
const REGION_FIXTURE = {
  slug: "san-diego",
  name: "San Diego",
  title: "San Diego surf forecast",
  metaDescription: "San Diego surf forecast",
  states: ["ca"],
  centerLat: 32.8,
  centerLon: -117.2,
  zoom: 10,
};

function decision(
  candidateId: string,
  outcome: "allow" | "block",
): MajorEventHoldCandidateDecision {
  if (outcome === "allow") {
    return {
      candidateId,
      evaluation: {
        outcome: "allow",
        holdIds: [],
        holdEpoch: EPOCH,
      },
      recommendationAvailability: {
        state: "available",
        holdEpoch: EPOCH,
      },
    };
  }

  return {
    candidateId,
    evaluation: {
      outcome: "explicit_none",
      reasonCode: "major_event_hold",
      holdIds: ["hold-1"],
      expiresAt: ENDS_AT,
      holdEpoch: EPOCH,
    },
    recommendationAvailability: {
      state: "none",
      reasonCode: "major_event_hold",
      expiresAt: ENDS_AT,
      holdEpoch: EPOCH,
    },
  };
}

function waterQualityDecision(
  candidateId: string,
): MajorEventHoldCandidateDecision {
  return {
    candidateId,
    evaluation: {
      outcome: "explicit_none",
      reasonCode: "water_quality_hold",
      holdIds: ["water-quality:held"],
      holdEpoch: EPOCH,
    },
    recommendationAvailability: {
      state: "none",
      reasonCode: "water_quality_hold",
      holdEpoch: EPOCH,
    },
  };
}

function surfWindow(
  beachId: string,
  index: number,
  confidence: "low" | "high" = "high",
): SurfWindowRecommendation {
  return {
    windowId: `window-${index}`,
    rank: index + 1,
    beach: {
      id: beachId,
      name: `Beach ${index + 1}`,
      slug: `beach-${index + 1}`,
      city: "San Diego",
      state: "CA",
      country: "USA",
      region: "san-diego",
      lat: 32.8,
      lon: -117.2,
      photoUrl: null,
    },
    startIso: STARTS_AT,
    endIso: ENDS_AT,
    peakIso: "2026-07-20T12:00:00.000Z",
    forecastAt: STARTS_AT,
    localTimeLabel: "5:00 AM–7:00 AM",
    score: 90 - index,
    verdict: "Worth it",
    headline: `Surf Beach ${index + 1}`,
    wave: {
      height: "4-6 ft",
      period: "14s",
      direction: "SW",
      summary: "4-6 ft at 14s from SW",
    },
    wind: {
      speed: "5 mph",
      direction: "E",
      quality: "offshore",
      summary: "Light offshore wind",
    },
    tide: {
      status: "Rising",
      height: "2.1 ft",
      nextTideAt: null,
      trend: "rising",
      summary: "Rising tide",
    },
    bestFor: ["intermediate"],
    positives: ["Clean swell"],
    watchouts: [],
    dataNotes: [],
    confidence: {
      level: confidence,
      score: confidence === "low" ? 30 : 90,
      summary: "Internal data quality",
      reasons: [],
    },
    sources: {
      forecastModel: true,
      tide: true,
      buoy: false,
      cam: false,
      userReport: false,
      localSpotIntel: false,
    },
    appDeepLink: null,
    universalLink: null,
    canonicalWebUrl: null,
  };
}

function fixture(): RegionalForecastSummary {
  const day: DaySummary = {
    date: new Date(STARTS_AT),
    dateString: "2026-07-20",
    dayOfWeek: "Monday",
    score: 87,
    avgWaveHeight: 4.25,
    waveRange: [3.5, 6],
    dominantWindDirection: "E",
    windConditions: "offshore",
    dominantTideStatus: "Rising",
    bestTimeSlot: "dawn-patrol",
    topBeaches: BEACH_IDS.map((id, index) => ({
      id,
      name: `Beach ${index + 1}`,
      slug: `beach-${index + 1}`,
      score: 95 - index,
      waveHeight: 6 - index * 0.25,
      windowStart: STARTS_AT,
      windowEnd: ENDS_AT,
    })),
    beachesWithGoodConditions: 7,
  };

  return {
    region: REGION_FIXTURE,
    generatedAt: new Date("2026-07-19T12:00:00.000Z"),
    days: [day],
    bestDay: day,
    upcomingSwells: [],
    beachConditions: BEACH_IDS.map((beachId, index) => ({
      beachId,
      beachName: `Beach ${index + 1}`,
      beachSlug: `beach-${index + 1}`,
      state: "CA",
      city: "San Diego",
      country: "USA",
      currentScore: 95 - index,
      currentWaveHeight: 6 - index * 0.25,
      currentWindowStart: STARTS_AT,
      currentWindowEnd: ENDS_AT,
      trend: "steady",
      bestDay: "Monday",
      bestDayScore: 95 - index,
    })),
    bestSurfWindows: BEACH_IDS.map((beachId, index) =>
      surfWindow(beachId, index),
    ),
    photoUrl: null,
    photoBeachName: null,
    secondaryPhotoUrl: null,
    secondaryPhotoBeachName: null,
    stats: {
      totalBeaches: 7,
      beachesWithData: 7,
      avgRegionScore: 87,
    },
  };
}

describe("regional major-event hold adapter", () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it("binds off-hour regional rows to their actual server forecast slots", () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-07-19T12:00:00.000Z"));
    const beach = {
      id: BEACH_IDS[0],
      name: "Local Day Beach",
      slug: "local-day-beach",
      city: "San Diego",
      state: "CA",
      country: "USA",
    } as Beach;
    const forecasts = ["07:30:00", "10:30:00"].map(
      (time, index) =>
        ({
          id: `forecast-${index}`,
          beach_id: beach.id,
          forecast_at: `2026-07-20T${time}.000Z`,
          forecast_date: "2026-07-19",
          wave_height: "4.5",
          wave_period: "14",
          wave_direction: "SW",
          wind_speed: "5",
          wind_direction: "E",
          tide_status: "Rising",
          confidence_score: 90,
        }) as EnhancedForecastEntity,
    );

    const summary = aggregateRegionalForecast(
      REGION_FIXTURE,
      [beach],
      new Map([[beach.id, forecasts]]),
    );
    const candidates = buildRegionalMajorEventHoldCandidates(summary);

    expect(summary.days[0].dateString).toBe("2026-07-20");
    expect(summary.days[0].topBeaches[0]).toMatchObject({
      windowStart: "2026-07-20T07:30:00.000Z",
      windowEnd: "2026-07-20T13:30:00.000Z",
    });
    expect(summary.beachConditions[0]).toMatchObject({
      currentWindowStart: "2026-07-20T07:30:00.000Z",
      currentWindowEnd: "2026-07-20T13:30:00.000Z",
    });
    expect(candidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          beachId: beach.id,
          startsAt: "2026-07-20T07:30:00.000Z",
          endsAt: "2026-07-20T13:30:00.000Z",
        }),
      ]),
    );
  });

  it("fails regional binding closed when a slot interval is ambiguous", () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-07-19T12:00:00.000Z"));
    const beach = {
      id: BEACH_IDS[0],
      name: "Ambiguous Beach",
      slug: "ambiguous-beach",
      city: "San Diego",
      state: "CA",
      country: "USA",
    } as Beach;
    const forecast = {
      id: "forecast-only",
      beach_id: beach.id,
      forecast_at: "2026-07-20T07:30:00.000Z",
      forecast_date: "2026-07-20",
      wave_height: "4.5",
      wave_period: "14",
      wave_direction: "SW",
      wind_speed: "5",
      wind_direction: "E",
      tide_status: "Rising",
      confidence_score: 90,
    } as EnhancedForecastEntity;

    const summary = aggregateRegionalForecast(
      REGION_FIXTURE,
      [beach],
      new Map([[beach.id, [forecast]]]),
    );

    expect(summary.days[0].topBeaches[0].windowStart).toBeUndefined();
    expect(summary.beachConditions[0].currentWindowStart).toBeUndefined();
    expect(buildRegionalMajorEventHoldCandidates(summary)).toEqual([]);
  });

  it.each(["off", "shadow"] as const)(
    "preserves legacy recommendations for an unbindable positive pool in %s mode",
    async (mode) => {
      const summary = fixture();
      summary.days[0].topBeaches[0].windowStart = undefined;
      const candidates = buildRegionalMajorEventHoldCandidates(summary);
      const decisions = await evaluateMajorEventHoldCandidates(
        {
          candidates: [null],
          profileExperience: null,
          mode,
        },
        { audit: jest.fn() },
      );

      const result = sanitizeRegionalForecastForMajorEventHold(
        summary,
        candidates,
        decisions,
      );

      expect(result.recommendationAvailability.state).toBe("available");
      expect(result.days[0].topBeaches.map(({ id }) => id)).toEqual(
        BEACH_IDS.slice(0, 5),
      );
      expect(result.bestSurfWindows).toHaveLength(5);
      expect(result.beachConditions).toHaveLength(7);
    },
  );

  it("fails the same unbindable positive pool closed in enforce mode", async () => {
    const summary = fixture();
    summary.days[0].topBeaches[0].windowStart = undefined;
    const candidates = buildRegionalMajorEventHoldCandidates(summary);
    const decisions = await evaluateMajorEventHoldCandidates(
      {
        candidates: [null],
        profileExperience: null,
        mode: "enforce",
      },
      { audit: jest.fn() },
    );

    const result = sanitizeRegionalForecastForMajorEventHold(
      summary,
      candidates,
      decisions,
    );

    expect(result.recommendationAvailability).toMatchObject({
      state: "none",
      reasonCode: "hold_state_unavailable",
    });
    expect(result.days[0].topBeaches).toEqual([]);
    expect(result.bestSurfWindows).toEqual([]);
    expect(result.beachConditions).toEqual([]);
  });

  it("filters each complete regional candidate pool before applying display limits", () => {
    const summary = fixture();
    const candidates = buildRegionalMajorEventHoldCandidates(summary);
    const blockedBeachIds = new Set<string>(BEACH_IDS.slice(0, 2));
    const decisions = candidates.map((candidate) =>
      decision(
        candidate.candidateId,
        blockedBeachIds.has(candidate.beachId) ? "block" : "allow",
      ),
    );

    const result = sanitizeRegionalForecastForMajorEventHold(
      summary,
      candidates,
      decisions,
    );

    expect(result.days[0].topBeaches.map(({ id }) => id)).toEqual(
      BEACH_IDS.slice(2),
    );
    expect(result.bestSurfWindows?.map(({ beach, rank }) => [beach.id, rank])).toEqual(
      BEACH_IDS.slice(2).map((id, index) => [id, index + 1]),
    );
    expect(result.beachConditions.map(({ beachId }) => beachId)).toEqual(
      BEACH_IDS.slice(2),
    );
    expect(result.recommendationAvailability).toEqual({
      state: "available",
      holdEpoch: EPOCH,
    });
  });

  it("removes a water-quality-held beach from regional best-days output", () => {
    const summary = fixture();
    const candidates = buildRegionalMajorEventHoldCandidates(summary);
    const heldBeachId = BEACH_IDS[0];
    const decisions = candidates.map((candidate) =>
      candidate.beachId === heldBeachId
        ? waterQualityDecision(candidate.candidateId)
        : decision(candidate.candidateId, "allow"),
    );

    const result = sanitizeRegionalForecastForMajorEventHold(
      summary,
      candidates,
      decisions,
    );

    expect(result.days.flatMap(({ topBeaches }) => topBeaches).map(({ id }) => id)).not.toContain(
      heldBeachId,
    );
    expect(result.bestSurfWindows?.map(({ beach }) => beach.id)).not.toContain(
      heldBeachId,
    );
    expect(result.beachConditions.map(({ beachId }) => beachId)).not.toContain(
      heldBeachId,
    );
  });

  it("fails closed without erasing objective daily wave, wind, or tide data", () => {
    const summary = fixture();
    const candidates = buildRegionalMajorEventHoldCandidates(summary);
    const mismatchedDecisions = candidates
      .slice(1)
      .map((candidate) => decision(candidate.candidateId, "allow"));

    const result = sanitizeRegionalForecastForMajorEventHold(
      summary,
      candidates,
      mismatchedDecisions,
    );

    expect(result.days[0]).toMatchObject({
      score: 0,
      avgWaveHeight: 4.25,
      waveRange: [3.5, 6],
      dominantWindDirection: "E",
      windConditions: "offshore",
      dominantTideStatus: "Rising",
      topBeaches: [],
      beachesWithGoodConditions: 0,
    });
    expect(result.bestSurfWindows).toEqual([]);
    expect(result.beachConditions).toEqual([]);
    expect(result.recommendationAvailability).toMatchObject({
      state: "none",
      reasonCode: "hold_state_unavailable",
    });
  });

  it("keeps confidence inert when the hold authorizes the surf windows", () => {
    const summary = fixture();
    summary.bestSurfWindows = [
      surfWindow(BEACH_IDS[0], 0, "low"),
      surfWindow(BEACH_IDS[1], 1, "high"),
    ];
    const candidates = buildRegionalMajorEventHoldCandidates(summary);
    const decisions = candidates.map((candidate) =>
      decision(candidate.candidateId, "allow"),
    );

    const result = sanitizeRegionalForecastForMajorEventHold(
      summary,
      candidates,
      decisions,
    );

    expect(result.bestSurfWindows?.map(({ beach }) => beach.id)).toEqual([
      BEACH_IDS[0],
      BEACH_IDS[1],
    ]);
    expect(JSON.stringify(result)).not.toMatch(/low confidence/i);
  });
});
