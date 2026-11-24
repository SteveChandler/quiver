/**
 * @jest-environment node
 *
 * The opt-in "worth the drive" row ranks the outer ring with the real Week
 * Scout generator, so holds, the personal call and the day best are the same
 * code path as the in-range list.
 */

jest.mock('server-only', () => ({}));
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
  generateWeekScoutForecast,
  generateWeekScoutForecastForDays,
  type WeekScoutServiceDependencies,
} from '@/lib/services/discovery/week-scout';
import { selectFartherOut, withinFartherOutBudget, type FartherOutCandidate } from '@/lib/services/discovery/week-scout-farther-out';
import { expectConsoleWarnings } from '@/__tests__/setup/test-utils';
import type { Beach } from '@/types/database';
import type { EnhancedForecastEntity } from '@/types/forecast';
import type { WindowSelectorOptions } from '@/lib/services/discovery/window-selector/types';

const ANCHOR = { lat: 21.3, lon: -157.8 };
const MILES_PER_DEGREE_LAT = 69.05;
const INNER_BEACH = '11111111-1111-4111-8111-111111111111';
const OUTER_BEACH = '33333333-3333-4333-8333-333333333333';
const HELD_BEACH = '22222222-2222-4222-8222-222222222222';
// 60 reads FAIR and 84 reads GOOD for an intermediate surfer under these stubs.
let SCORES: Record<string, number> = {};

function beach(id: string, name: string, milesNorth: number): Beach {
  return {
    id,
    name,
    lat: ANCHOR.lat + milesNorth / MILES_PER_DEGREE_LAT,
    lon: ANCHOR.lon,
    is_private: false,
    skill_level: 'intermediate',
    timezone: 'Pacific/Honolulu',
  } as Beach;
}

const INNER = beach(INNER_BEACH, 'Home Break', 2);
const OUTER = beach(OUTER_BEACH, 'Outer Point', 12);
// Nearer than the outer point, so it ranks first whenever it is not held.
const HELD = beach(HELD_BEACH, 'Held Reef', 10);
const ALL = [INNER, OUTER, HELD];

function pool(...beaches: Beach[]): FartherOutCandidate[] {
  return beaches.map((candidate) => ({
    beach: candidate,
    distanceMiles: (candidate.lat - ANCHOR.lat) * MILES_PER_DEGREE_LAT,
  }));
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

function dependencies(beaches: Beach[]): WeekScoutServiceDependencies {
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

  const selectBestWindows = jest.fn((options: WindowSelectorOptions) => (
    options.forecasts.map((sourceForecast) => {
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
    })
  ));

  return {
    now: new Date('2026-07-31T14:00:00.000Z'),
    fetchBeaches: jest.fn(async (ids: string[]) => beaches.filter((candidate) => ids.includes(candidate.id))),
    fetchForecasts: jest.fn(async () => rows),
    fetchSunTimes: jest.fn(async () => new Map()),
    fetchRankingContext: jest.fn(async () => ({
      implicitPrefs: null, learnedPrefs: null, affinityMap: new Map(), implicitWeight: 0,
    })),
    fetchSkill: jest.fn(async () => 'intermediate'),
    fetchMatchEvidence: jest.fn(async () => new Map()),
    calculatePersonalizationBonus: jest.fn(() => ({
      affinityBonus: 0,
      personalizationBonus: 0,
      reasons: [],
    })),
    selectBestWindows: selectBestWindows as unknown as WeekScoutServiceDependencies['selectBestWindows'],
    scoreWindowCondition: jest.fn((row: EnhancedForecastEntity) => SCORES[row.beach_id] ?? 60),
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

function allow({ candidates }: { candidates: Array<{ candidateId: string }> }) {
  return candidates.map(({ candidateId }) => ({
    candidateId,
    evaluation: { outcome: 'allow', holdIds: [], holdEpoch: 'farther-out-epoch' },
    recommendationAvailability: { state: 'available', holdEpoch: 'farther-out-epoch' },
  }));
}

const REQUEST = {
  localTimezone: 'Pacific/Honolulu',
  startLocalDate: '2026-07-31',
  dayCount: 7 as const,
  userLocation: ANCHOR,
  driveRadiusMiles: 7.5,
};

function rank(ids: string[]) {
  return generateWeekScoutForecastForDays('user-week-scout', { ...REQUEST, candidateBeachIds: ids }, dependencies(ALL));
}

describe('Week Scout farther-out selection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    SCORES = { [INNER_BEACH]: 60, [OUTER_BEACH]: 84, [HELD_BEACH]: 60 };
    mockRankBeaches.mockImplementation(async (items: unknown[]) => items);
    mockEvaluateMajorEventHoldCandidates.mockImplementation(allow);
  });

  it('names an outer beach whose best window is one label above the in-range best', async () => {
    const [inRange, outer] = await Promise.all([rank([INNER_BEACH]), rank([OUTER_BEACH])]);
    expect(inRange.days[0].bestDayWindow?.personalLabel).toBe('FAIR');

    const row = selectFartherOut(inRange, outer, pool(OUTER), ANCHOR).get('2026-07-31');

    expect(row).toEqual({
      beachId: OUTER_BEACH,
      beachName: 'Outer Point',
      waveHeight: outer.days[0].bestDayWindow!.forecast.waveHeight,
      personalLabel: 'GOOD',
      displayWindowStart: outer.days[0].bestDayWindow!.displayWindowStart,
      displayWindowEnd: outer.days[0].bestDayWindow!.displayWindowEnd,
      // 12 mi at half a mile a minute is 24 minutes, rounded to the nearest 5.
      driveMinutes: 25,
      direction: 'north',
    });
  });

  it('names no beach when the outer best has the same label', async () => {
    SCORES[OUTER_BEACH] = 60;
    const [inRange, outer] = await Promise.all([rank([INNER_BEACH]), rank([OUTER_BEACH])]);
    expect(outer.days[0].bestDayWindow?.personalLabel).toBe('FAIR');

    expect(selectFartherOut(inRange, outer, pool(OUTER), ANCHOR).size).toBe(0);
  });

  it('names no beach when a lower-ranked in-range beach already has the outer label', async () => {
    const [inRange, outer] = await Promise.all([rank([INNER_BEACH]), rank([OUTER_BEACH])]);
    const best = inRange.days[0].bestDayWindow!;
    const goodNearby = { ...best, id: `${best.id}-nearby`, personalLabel: 'GOOD' as const, personalVerdict: 'go' as const, verdict: 'worth_it' as const };
    const withGood = { ...inRange, days: [{ ...inRange.days[0], windows: [...inRange.days[0].windows, goodNearby] }] };
    expect(selectFartherOut({ ...inRange, days: [inRange.days[0]] }, outer, pool(OUTER), ANCHOR).size).toBe(1);

    expect(selectFartherOut(withGood, outer, pool(OUTER), ANCHOR).size).toBe(0);
  });

  it('never names a beach the safety filter holds, even when it would rank first', async () => {
    SCORES = { [INNER_BEACH]: 60, [OUTER_BEACH]: 60, [HELD_BEACH]: 95 };
    const unheld = await rank([OUTER_BEACH, HELD_BEACH]);
    const inRange = await rank([INNER_BEACH]);
    // Control: without the hold the held reef is the outer pick.
    expect(selectFartherOut(inRange, unheld, pool(OUTER, HELD), ANCHOR).get('2026-07-31')?.beachId).toBe(HELD_BEACH);

    mockRankBeaches.mockImplementation(async (items: Array<{ id: string }>) => items.filter((item) => item.id !== HELD_BEACH));
    const held = await rank([OUTER_BEACH, HELD_BEACH]);

    expect(held.days.flatMap((day) => day.windows).some((window) => window.beachId === HELD_BEACH)).toBe(false);
    expect(selectFartherOut(inRange, held, pool(OUTER, HELD), ANCHOR).size).toBe(0);
  });

  it('names no beach under a major-event hold on the outer ring', async () => {
    const inRange = await rank([INNER_BEACH]);
    mockEvaluateMajorEventHoldCandidates.mockImplementation(async ({ candidates }: { candidates: Array<{ candidateId: string }> }) =>
      candidates.map(({ candidateId }) => ({
        candidateId,
        evaluation: { outcome: 'explicit_none', reasonCode: 'major_event_hold', holdIds: ['hold-1'], holdEpoch: 'farther-out-epoch' },
        recommendationAvailability: { state: 'none', reasonCode: 'major_event_hold', holdEpoch: 'farther-out-epoch' },
      })));
    const outer = await rank([OUTER_BEACH]);

    expect(selectFartherOut(inRange, outer, pool(OUTER), ANCHOR).size).toBe(0);
  });

  it('names no beach on a day with no in-range best', async () => {
    const [inRange, outer] = await Promise.all([rank([INNER_BEACH]), rank([OUTER_BEACH])]);
    const empty = { ...inRange, days: inRange.days.map((day) => ({ ...day, bestWindowId: null, bestDayWindow: null })) };

    expect(selectFartherOut(empty, outer, pool(OUTER), ANCHOR).size).toBe(0);
  });

  it('names no beach when the outer best carries a "no" verdict', async () => {
    const [inRange, outer] = await Promise.all([rank([INNER_BEACH]), rank([OUTER_BEACH])]);
    const no = {
      ...outer,
      days: outer.days.map((day) => ({
        ...day,
        bestDayWindow: day.bestDayWindow && { ...day.bestDayWindow, personalVerdict: 'no' as const },
      })),
    };

    expect(selectFartherOut(inRange, no, pool(OUTER), ANCHOR).size).toBe(0);
  });

  it('gives the 4-way direction and drive minutes from the anchor', async () => {
    const [inRange, outer] = await Promise.all([rank([INNER_BEACH]), rank([OUTER_BEACH])]);
    const east = { beach: { ...OUTER, lat: ANCHOR.lat + 0.02, lon: ANCHOR.lon + 0.12 }, distanceMiles: 7.6 };

    expect(selectFartherOut(inRange, outer, [east], ANCHOR).get('2026-07-31')).toMatchObject({
      direction: 'east',
      driveMinutes: 20,
    });
  });

  it('leaves the in-range answer identical when the outer pass runs beside it', async () => {
    const main = { ...REQUEST, candidateBeachIds: [INNER_BEACH] };
    const alone = await generateWeekScoutForecast('user-week-scout', main, dependencies(ALL));
    const [beside] = await Promise.all([
      generateWeekScoutForecast('user-week-scout', main, dependencies(ALL)),
      rank([OUTER_BEACH, HELD_BEACH]),
    ]);

    expect(JSON.stringify(beside)).toBe(JSON.stringify(alone));
  });
});

describe('Week Scout farther-out wait budget', () => {
  it('returns a pass that settles inside the budget', async () => {
    const rows = new Map();
    await expect(withinFartherOutBudget(Promise.resolve(rows), 50)).resolves.toBe(rows);
  });

  it('gives up on a pass that runs past the budget', async () => {
    const never = new Promise<null>(() => undefined);
    await expect(withinFartherOutBudget(never, 10)).resolves.toBeNull();
    expectConsoleWarnings([/ran past its budget/]);
  });
});
