/**
 * @jest-environment node
 *
 * Regression: a water-quality-held beach must be excluded from Week Scout
 * WITHOUT voiding the rest of the week.
 *
 * `rankDrafts` bakes a shared `rankedSpots` list into every window in a bucket
 * before the safety filter runs. When that filter drops a held beach's windows,
 * the survivors were left pointing at a beach that no longer had a window in
 * their bucket. `hasConsistentSecondaryMappings` (correctly) read that dangling
 * reference as a structurally untrustworthy response, so the hold adapter
 * pushed a null candidate and `resolveMajorEventHoldBoundary` voided EVERY
 * window for EVERY beach — one held spot took the whole surface dark with
 * `hold_state_unavailable`.
 *
 * Observed in production 2026-08-16: La Jolla Shores (county advisories) and
 * Hotel Del Coronado (owner-directed hold) each blanked the entire week.
 */

const mockEvaluateMajorEventHoldCandidates = jest.fn();
jest.mock('@/lib/recommendations/major-event-hold/service', () => ({
  evaluateMajorEventHoldCandidates: (...args: unknown[]) =>
    mockEvaluateMajorEventHoldCandidates(...args),
}));
jest.mock('@/lib/supabase/server', () => ({
  createSupabaseServiceRoleClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        in: jest.fn(async () => ({ data: [], error: null })),
      })),
    })),
  })),
}));

const mockRankBeaches = jest.fn();
jest.mock('@/lib/recommendations/selection', () => ({
  ...jest.requireActual('@/lib/recommendations/selection'),
  rankBeaches: (...args: unknown[]) => mockRankBeaches(...args),
}));

import {
  generateWeekScoutForecastForDays,
  type WeekScoutServiceDependencies,
} from '@/lib/services/discovery/week-scout';
import type { Beach } from '@/types/database';
import type { EnhancedForecastEntity } from '@/types/forecast';

const CLEAN_BEACH = '11111111-1111-4111-8111-111111111111';
const HELD_BEACH = '22222222-2222-4222-8222-222222222222';

function beach(id: string, name: string): Beach {
  return {
    id,
    name,
    lat: 21.3,
    lon: -157.8,
    is_private: false,
    skill_level: 'intermediate',
  } as Beach;
}

function forecast(beachId: string, forecastAt: string): EnhancedForecastEntity {
  return {
    id: `${beachId}:${forecastAt}`,
    beach_id: beachId,
    forecast_at: forecastAt,
    wave_height: '3.5',
    wave_period: '12s',
    wave_direction: 'NW',
    wind_speed: '5',
    wind_direction: 'E',
    tide_height: '1.4',
    tide_status: 'Rising',
    confidence_score: 82,
    data_source: 'NOAA_NWS',
    created_at: '2026-07-31T12:00:00.000Z',
    updated_at: '2026-07-31T13:30:00.000Z',
  } as EnhancedForecastEntity;
}

function dependencies(): WeekScoutServiceDependencies {
  const beaches = [beach(CLEAN_BEACH, 'Clean Break'), beach(HELD_BEACH, 'Held Break')];
  const rows = new Map<string, EnhancedForecastEntity[]>(
    beaches.map((candidate) => [
      candidate.id,
      [
        forecast(candidate.id, '2026-07-31T16:00:00.000Z'),
        forecast(candidate.id, '2026-07-31T20:00:00.000Z'),
        forecast(candidate.id, '2026-08-01T00:00:00.000Z'),
      ],
    ]),
  );

  return {
    now: new Date('2026-07-31T14:00:00.000Z'),
    fetchBeaches: jest.fn(async () => beaches),
    fetchForecasts: jest.fn(async () => rows),
    fetchSunTimes: jest.fn(async () => new Map()),
    fetchPreferences: jest.fn(async () => null),
    fetchSkill: jest.fn(async () => 'intermediate'),
    fetchPersonalizationContext: jest.fn(async () => null),
    calculatePersonalizationBonus: jest.fn(() => ({
      affinityBonus: 0,
      personalizationBonus: 0,
      reasons: [],
    })),
    selectBestWindow: jest.fn(({ forecasts }) => {
      const sourceForecast = forecasts[0];
      const start = new Date(sourceForecast.forecast_at);
      return {
        start,
        end: new Date(start.getTime() + 2 * 60 * 60 * 1000),
        peakTime: new Date(start.getTime() + 60 * 60 * 1000),
        tide: sourceForecast.tide_status ?? 'Unknown',
        wind: `${sourceForecast.wind_speed} ${sourceForecast.wind_direction}`,
        waveHeight: sourceForecast.wave_height ?? 'Unknown',
        wavePeriod: sourceForecast.wave_period ?? 'Unknown',
        dataSource: sourceForecast.data_source ?? 'unknown',
        confidence: sourceForecast.confidence_score ?? 0,
        timezone: 'Pacific/Honolulu',
        sourceForecast,
      };
    }),
    scoreWindowCondition: jest.fn(() => 84),
    scoreBeach: jest.fn(() => ({
      total: 80,
      matchQuality: 'excellent',
      subscores: {
        waveHeightFit: 22,
        periodEnergyScore: 18,
        windAlignment: 19,
        tideFit: 14,
        affinityBonus: 0,
        personalizationBonus: 0,
        distancePenalty: 0,
      },
      reasons: ['Clean wind and solid period'],
      warnings: [],
    })),
    beachToSpotProfile: jest.fn(() => ({ kind: 'beach' } as never)),
    rankWindows: jest.fn((recommendations) => ({
      reranked: recommendations,
      diagnostics: recommendations.map((recommendation, index) => ({
        beachSlug: recommendation.beach.id,
        representativeSlotScore: recommendation.score,
        setupSuitability: 80,
        windAlignment: recommendation.subscores.windAlignment,
        tideFit: recommendation.subscores.tideFit,
        waveHeightFit: recommendation.subscores.waveHeightFit,
        periodEnergyScore: recommendation.subscores.periodEnergyScore,
        affinityBonus: recommendation.subscores.affinityBonus,
        windowDurationHours: 2,
        windowPersistence: 100,
        heroWindowScore: 85,
        finalRank: index,
        isHero: index === 0,
        sharedSetupSignal: {
          directionDeg: 315,
          periodS: 12,
          source: 'cluster-majority',
        },
      })),
    })),
  };
}

describe('Week Scout with a water-quality-held beach', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Stand in for the real safety filter, which drops held beaches.
    mockRankBeaches.mockImplementation(async (items: Array<{ id: string }>) =>
      items.filter((item) => item.id !== HELD_BEACH),
    );
    mockEvaluateMajorEventHoldCandidates.mockImplementation(
      async ({ candidates }: { candidates: Array<{ candidateId: string }> }) =>
        candidates.map(({ candidateId }) => ({
          candidateId,
          evaluation: {
            outcome: 'allow',
            holdIds: [],
            holdEpoch: 'held-beach-test-epoch',
          },
          recommendationAvailability: {
            state: 'available',
            holdEpoch: 'held-beach-test-epoch',
          },
        })),
    );
  });

  async function run() {
    return generateWeekScoutForecastForDays(
      'user-week-scout',
      {
        candidateBeachIds: [CLEAN_BEACH, HELD_BEACH],
        localTimezone: 'Pacific/Honolulu',
        startLocalDate: '2026-07-31',
        dayCount: 2,
      },
      dependencies(),
    );
  }

  it('drops the held beach without voiding the surviving windows', async () => {
    const response = await run();
    const windows = response.days.flatMap((day) => day.windows);

    expect(windows.length).toBeGreaterThan(0);
    expect(windows.every((window) => window.beachId !== HELD_BEACH)).toBe(true);
    // The whole point: survivors keep their verdicts instead of being blanked.
    expect(windows.some((window) => window.verdict !== null)).toBe(true);
    expect(
      response.recommendationAvailability?.reasonCode,
    ).not.toBe('hold_state_unavailable');
  });

  it('leaves no rankedSpots pointing at a beach with no window in that bucket', async () => {
    const response = await run();

    // Guard first: when the bug fires the adapter blanks every rankedSpots
    // list, so a pure consistency check would pass over empty arrays and stay
    // green on the bug. Require real entries before asserting they are sound.
    const totalRankedSpots = response.days
      .flatMap((day) => day.windows)
      .reduce((sum, window) => sum + window.rankedSpots.length, 0);
    expect(totalRankedSpots).toBeGreaterThan(0);

    for (const day of response.days) {
      for (const window of day.windows) {
        for (const spot of window.rankedSpots) {
          const sameBucket = day.windows.filter(
            (candidate) =>
              candidate.bucket === window.bucket &&
              candidate.beachId === spot.beachId,
          );
          // Exactly one — the invariant hasConsistentSecondaryMappings enforces.
          expect(sameBucket).toHaveLength(1);
        }
        expect(
          window.rankedSpots.some((spot) => spot.beachId === HELD_BEACH),
        ).toBe(false);
      }
    }
  });
});
