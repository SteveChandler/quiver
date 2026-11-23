/**
 * @jest-environment node
 */

import {
  buildWeekendScoutRanking,
  fetchWeekendScoutHomeBeach,
  type WeekendScoutDependencies,
} from '@/lib/services/discovery/weekend-scout';
import type { WeekendScoutCandidate } from '@/lib/services/discovery/weekend-scout-candidate-pool';
import type { WeekScoutWindowResponse } from '@/lib/services/discovery/week-scout';
import type {
  MajorEventHoldWeekScoutResponse,
} from '@/lib/recommendations/major-event-hold/adapters/week-scout';
import type { Beach } from '@/types/database';

const NEAR = '11111111-1111-4111-8111-111111111111';
const FAR = '22222222-2222-4222-8222-222222222222';
const THIRD = '33333333-3333-4333-8333-333333333333';
const FOURTH = '44444444-4444-4444-8444-444444444444';

function candidate(
  id: string,
  name: string,
  distanceMiles: number,
  timezone = 'America/Los_Angeles',
): WeekendScoutCandidate {
  return {
    beach: {
      id,
      name,
      slug: name.toLowerCase().replaceAll(' ', '-'),
      lat: 32.8,
      lon: -117.2,
      is_private: false,
      deleted_at: null,
      timezone,
    } as Beach,
    distanceMiles,
  };
}

function window(
  beachId: string,
  rankingScore: number,
  overrides: Partial<WeekScoutWindowResponse> = {},
): WeekScoutWindowResponse {
  return {
    id: `${beachId}-${rankingScore}`,
    bucket: 'morning',
    start: '2026-07-25T14:00:00.000Z',
    end: '2026-07-25T17:00:00.000Z',
    displayWindowStart: '2026-07-25T14:00:00.000Z',
    displayWindowEnd: '2026-07-25T16:30:00.000Z',
    peakTime: '2026-07-25T15:00:00.000Z',
    beachId,
    isBeachDayBest: true,
    conditionScore: rankingScore,
    rankingScore,
    verdict: 'worth_it',
    rideable: true,
    safe: true,
    confidence: 85,
    forecast: {
      waveHeight: '4.0',
      period: '13',
      swellDirection: 'NW',
      windSpeed: '4',
      windDirection: 'E',
      tideHeightFt: 2.1,
      tidePhase: 'rising',
      freshnessAt: '2026-07-24T18:30:00.000Z',
    },
    takeaway: 'Clean lines with light offshore wind.',
    rankedSpots: [],
    ...overrides,
  };
}

function forecast(windows: WeekScoutWindowResponse[]): MajorEventHoldWeekScoutResponse {
  return {
    generatedAt: '2026-07-24T20:00:00.000Z',
    scorerVersion: 'week-scout-v2:day-window-authority-v1',
    candidateFingerprint: 'fingerprint',
    days: [
      {
        localDate: '2026-07-25',
        windows,
        bestWindowId: windows[0]?.id ?? null,
        bestDayWindow: windows[0] ?? null,
        exclusionReasons: [],
      },
      {
        localDate: '2026-07-26',
        windows: [],
        bestWindowId: null,
        bestDayWindow: null,
        exclusionReasons: ['no_forecasts'],
      },
    ],
    recommendationAvailability: {
      state: 'available',
      holdEpoch: 'weekend-scout-test',
    },
  };
}

function dependencies(): WeekendScoutDependencies {
  const candidates = [
    candidate(NEAR, 'Good Nearby', 5),
    candidate(FAR, 'Exceptional Farther', 30),
    candidate(THIRD, 'Third Best', 8),
    candidate(FOURTH, 'Fourth Best', 2),
  ];

  return {
    now: new Date('2026-07-24T20:00:00.000Z'),
    fetchLocation: jest.fn(async () => ({
      lat: 32.81,
      lon: -117.27,
      timezone: 'America/Los_Angeles',
      capturedAt: '2026-07-24T19:55:00.000Z',
    })),
    fetchHomeBeach: jest.fn(async () => null),
    fetchUserContext: jest.fn(async () => ({
      maxDriveMinutes: 90,
      homeBeachId: NEAR,
      savedBeachIds: new Set([NEAR]),
    })),
    buildCandidatePool: jest.fn(async () => ({ candidates, totalCount: candidates.length, incomplete: false, wasTruncated: false })),
    generateForecast: jest.fn(async () => forecast([
      window(NEAR, 84),
      window(FAR, 94),
      window(THIRD, 80),
      window(FOURTH, 78),
      window(NEAR, 79, { bucket: 'evening' }),
    ])),
  };
}

describe('buildWeekendScoutRanking', () => {
  it('returns explicit missing and stale location states', async () => {
    const missing = dependencies();
    missing.fetchLocation = jest.fn(async () => null);
    missing.fetchUserContext = jest.fn(async () => ({
      homeBeachId: null, maxDriveMinutes: 90, savedBeachIds: new Set<string>(),
    }));
    await expect(buildWeekendScoutRanking('user-1', missing)).resolves.toEqual({
      status: 'missing_location',
    });
    expect(missing.fetchHomeBeach).not.toHaveBeenCalled();

    const stale = dependencies();
    stale.fetchLocation = jest.fn(async () => ({
      lat: 32.81,
      lon: -117.27,
      timezone: 'America/Los_Angeles',
      capturedAt: '2026-07-23T19:59:59.999Z',
    }));
    await expect(buildWeekendScoutRanking('user-1', stale)).resolves.toEqual({
      status: 'stale_location',
    });

    const future = dependencies();
    future.fetchLocation = jest.fn(async () => ({
      lat: 32.81,
      lon: -117.27,
      timezone: 'America/Los_Angeles',
      capturedAt: '2026-07-24T20:05:00.001Z',
    }));
    await expect(buildWeekendScoutRanking('user-1', future)).resolves.toEqual({
      status: 'stale_location',
    });
  });

  it.each([
    ['missing', null],
    ['stale', '2026-07-23T19:59:59.999Z'],
  ])('uses the home beach when the phone fix is %s', async (_reason, capturedAt) => {
    const deps = dependencies();
    deps.now = new Date('2026-07-27T02:00:00.000Z');
    deps.fetchLocation = jest.fn(async () => capturedAt ? {
      lat: 32.81, lon: -117.27, timezone: 'UTC', capturedAt,
    } : null);
    deps.fetchHomeBeach = jest.fn(async () => ({
      id: NEAR, name: 'Home Beach', lat: 21.3, lon: -157.8, timezone: 'Pacific/Honolulu',
    }));

    const result = await buildWeekendScoutRanking('user-1', deps);

    expect(deps.fetchHomeBeach).toHaveBeenCalledWith(NEAR);
    expect(deps.buildCandidatePool).toHaveBeenCalledWith('user-1', {
      userLocation: { lat: 21.3, lon: -157.8 }, radiusMiles: 45,
    });
    expect(deps.generateForecast).toHaveBeenCalledWith('user-1', expect.objectContaining({
      localTimezone: 'Pacific/Honolulu', startLocalDate: '2026-07-25',
    }));
    expect(result).toMatchObject({
      status: 'ready',
      ranking: {
        contractVersion: 'weekend-scout-v1',
        origin: { kind: 'home_beach', beachId: NEAR, beachName: 'Home Beach' },
        weekendEnd: '2026-07-26',
        locationCapturedAt: '2026-07-24T20:00:00.000Z',
      },
      leadWindowTimezone: 'America/Los_Angeles',
    });
  });

  it('keeps a fresh phone fix even when a home beach is available', async () => {
    const deps = dependencies();
    deps.fetchHomeBeach = jest.fn(async () => ({
      id: NEAR, name: 'Home Beach', lat: 21.3, lon: -157.8, timezone: 'Pacific/Honolulu',
    }));
    expect(await buildWeekendScoutRanking('user-1', deps)).toMatchObject({
      status: 'ready',
      ranking: {
        origin: { kind: 'location' },
        locationCapturedAt: '2026-07-24T19:55:00.000Z',
      },
    });
    expect(deps.fetchHomeBeach).not.toHaveBeenCalled();
  });

  it.each([
    { lat: 91 },
    { lon: -181 },
    { timezone: null },
    { timezone: 'Invalid/Zone' },
  ])('keeps the skip for an unusable home beach (%j)', async (overrides) => {
    const deps = dependencies();
    deps.fetchLocation = jest.fn(async () => null);
    deps.fetchHomeBeach = jest.fn(async () => ({
      id: NEAR, name: 'Home Beach', lat: 21.3, lon: -157.8, timezone: 'Pacific/Honolulu',
      ...overrides,
    }));
    await expect(buildWeekendScoutRanking('user-1', deps)).resolves.toEqual({ status: 'missing_location' });
    expect(deps.buildCandidatePool).not.toHaveBeenCalled();
  });

  it('filters out deleted and private home beaches and propagates read errors', async () => {
    const maybeSingle = jest.fn()
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: null, error: { message: 'connection lost' } });
    const query = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      is: jest.fn().mockReturnThis(),
      or: jest.fn().mockReturnThis(),
      maybeSingle,
    };
    const supabase = { from: jest.fn(() => query) } as unknown as Parameters<typeof fetchWeekendScoutHomeBeach>[1];

    await expect(fetchWeekendScoutHomeBeach(NEAR, supabase)).resolves.toBeNull();
    await expect(fetchWeekendScoutHomeBeach(NEAR, supabase)).rejects.toThrow('connection lost');
    expect(query.eq).toHaveBeenCalledWith('id', NEAR);
    expect(query.is).toHaveBeenCalledWith('deleted_at', null);
    expect(query.or).toHaveBeenCalledWith('is_private.is.null,is_private.eq.false');
  });

  it('scores every current-location candidate and ranks three unique qualifying beaches', async () => {
    const deps = dependencies();
    const result = await buildWeekendScoutRanking('user-1', deps);

    expect(deps.buildCandidatePool).toHaveBeenCalledWith('user-1', {
      userLocation: { lat: 32.81, lon: -117.27 },
      radiusMiles: 45,
    });
    expect(deps.generateForecast).toHaveBeenCalledWith('user-1', {
      candidateBeachIds: [NEAR, FAR, THIRD, FOURTH],
      localTimezone: 'America/Los_Angeles',
      startLocalDate: '2026-07-25',
      dayCount: 2,
    });
    expect(result.status).toBe('ready');
    if (result.status !== 'ready') throw new Error('expected ready');
    expect(result.ranking.results.map((item) => item.beachId)).toEqual([
      FAR,
      NEAR,
      THIRD,
    ]);
    expect(result.ranking.results[0].rankingScore).toBe(90);
    expect(result.ranking.results[1]).toMatchObject({
      sourceLabels: ['nearby', 'home', 'saved'],
      bestWindow: {
        localLabel: 'Saturday morning',
        displayWindowStart: '2026-07-25T14:00:00.000Z',
        displayWindowEnd: '2026-07-25T16:30:00.000Z',
        freshnessAt: '2026-07-24T18:30:00.000Z',
      },
    });
    expect(result.ranking.qualifyingCount).toBe(3);
    expect(result.ranking.contractVersion).toBe('weekend-scout-v1');
  });

  it('labels a result in the beach timezone when it differs from the location', async () => {
    const deps = dependencies();
    deps.buildCandidatePool = jest.fn(async () => ({
      candidates: [candidate(NEAR, 'Hawaii Beach', 5, 'Pacific/Honolulu')],
      totalCount: 1,
      incomplete: false,
      wasTruncated: false,
    }));
    deps.generateForecast = jest.fn(async () => forecast([
      window(NEAR, 84, {
        start: '2026-07-25T06:00:00.000Z',
        end: '2026-07-25T09:00:00.000Z',
        displayWindowStart: '2026-07-25T06:00:00.000Z',
        displayWindowEnd: '2026-07-25T08:30:00.000Z',
        peakTime: '2026-07-25T07:00:00.000Z',
      }),
    ]));

    const result = await buildWeekendScoutRanking('user-1', deps);

    expect(result.status).toBe('ready');
    if (result.status !== 'ready') throw new Error('expected ready');
    expect(result.ranking.results[0].bestWindow.localLabel).toBe('Friday morning');
  });

  it('applies the quality floor before selecting a beach best window', async () => {
    const deps = dependencies();
    deps.buildCandidatePool = jest.fn(async () => ({
      candidates: [candidate(NEAR, 'Good Nearby', 5), candidate(FAR, 'Exceptional Farther', 30)],
      totalCount: 2,
      incomplete: false,
      wasTruncated: false,
    }));
    deps.generateForecast = jest.fn(async () => forecast([
      window(NEAR, 99, { safe: false }),
      window(NEAR, 84),
      window(FAR, 98, { rideable: false }),
      window(FAR, 97, { verdict: 'maybe' }),
    ]));

    const result = await buildWeekendScoutRanking('user-1', deps);

    expect(result.status).toBe('ready');
    if (result.status !== 'ready') throw new Error('expected ready');
    expect(result.ranking.results).toHaveLength(1);
    expect(result.ranking.results[0]).toMatchObject({ beachId: NEAR, rankingScore: 84 });
  });

  it('leads a beach with its day best instead of a higher-scoring preview', async () => {
    const deps = dependencies();
    const missingMarker = window(NEAR, 100, { bucket: 'midday' });
    delete (missingMarker as Partial<WeekScoutWindowResponse>).isBeachDayBest;
    deps.buildCandidatePool = jest.fn(async () => ({
      candidates: [candidate(NEAR, 'Good Nearby', 5)],
      totalCount: 1,
      incomplete: false,
      wasTruncated: false,
    }));
    deps.generateForecast = jest.fn(async () => forecast([
      missingMarker,
      window(NEAR, 99, { bucket: 'evening', isBeachDayBest: false }),
      window(NEAR, 98, { isBeachDayBest: null as never }),
      window(NEAR, 84),
    ]));

    const result = await buildWeekendScoutRanking('user-1', deps);

    expect(result.status).toBe('ready');
    if (result.status !== 'ready') throw new Error('expected ready');
    expect(result.ranking.results[0]).toMatchObject({
      beachId: NEAR,
      rankingScore: 84,
      bestWindow: { localLabel: 'Saturday morning' },
    });
  });

  it('breaks equal adjusted scores by distance and then beach ID', async () => {
    const deps = dependencies();
    deps.buildCandidatePool = jest.fn(async () => ({
      candidates: [
        candidate(FAR, 'Far', 20),
        candidate(THIRD, 'Third ID', 5),
        candidate(NEAR, 'First ID', 5),
      ],
      totalCount: 3,
      incomplete: false,
      wasTruncated: false,
    }));
    deps.generateForecast = jest.fn(async () => forecast([
      window(FAR, 82),
      window(THIRD, 80),
      window(NEAR, 80),
    ]));

    const result = await buildWeekendScoutRanking('user-1', deps);

    expect(result.status).toBe('ready');
    if (result.status !== 'ready') throw new Error('expected ready');
    expect(result.ranking.results.map((item) => item.beachId)).toEqual([NEAR, THIRD, FAR]);
  });

  it('suppresses incomplete, empty, and zero-quality rankings', async () => {
    const truncated = dependencies();
    truncated.buildCandidatePool = jest.fn(async () => ({
      candidates: [candidate(NEAR, 'Good Nearby', 5)],
      totalCount: 1,
      incomplete: true,
      wasTruncated: true,
    }));
    await expect(buildWeekendScoutRanking('user-1', truncated)).resolves.toEqual({
      status: 'candidate_limit_reached',
    });

    const empty = dependencies();
    empty.buildCandidatePool = jest.fn(async () => ({ candidates: [], totalCount: 0, incomplete: false, wasTruncated: false }));
    await expect(buildWeekendScoutRanking('user-1', empty)).resolves.toEqual({
      status: 'no_candidates',
    });

    const noQuality = dependencies();
    noQuality.generateForecast = jest.fn(async () => forecast([
      window(NEAR, 99, { safe: false }),
      window(FAR, 85, { verdict: 'maybe' }),
    ]));
    await expect(buildWeekendScoutRanking('user-1', noQuality)).resolves.toEqual({
      status: 'no_qualifying_windows',
    });
  });

  it('uses the shared 30-mile radius when max drive time is never set', async () => {
    const deps = dependencies();
    deps.fetchUserContext = jest.fn(async () => ({
      maxDriveMinutes: null,
      homeBeachId: null,
      savedBeachIds: new Set<string>(),
    }));

    const result = await buildWeekendScoutRanking('user-1', deps);

    expect(result.status).toBe('ready');
    expect(deps.buildCandidatePool).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ radiusMiles: 30 }),
    );
    if (result.status !== 'ready') throw new Error('expected ready');
    expect(result.maxDriveMinutes).toBe(60);
  });

  it.each([
    [Number.NaN, 60, 30],
    [Infinity, 60, 30],
    [0, 60, 30],
    [-5, 60, 30],
    [10.5, 11, 5.5],
    [30, 30, 15],
    [60, 60, 30],
    [200, 200, 100],
    [500, 200, 100],
  ])(
    'resolves configured drive time %p to %i minutes and the shared radius',
    async (configured, expectedMinutes, expectedMiles) => {
      const deps = dependencies();
      deps.fetchUserContext = jest.fn(async () => ({
        maxDriveMinutes: configured,
        homeBeachId: null,
        savedBeachIds: new Set<string>(),
      }));

      const result = await buildWeekendScoutRanking('user-1', deps);

      expect(result.status).toBe('ready');
      expect(deps.buildCandidatePool).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({ radiusMiles: expectedMiles }),
      );
      if (result.status !== 'ready') throw new Error('expected ready');
      expect(result.maxDriveMinutes).toBe(expectedMinutes);
    },
  );
});
