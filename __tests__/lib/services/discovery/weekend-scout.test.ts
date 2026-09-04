/**
 * @jest-environment node
 */

import {
  buildWeekendScoutRanking,
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

function candidate(id: string, name: string, distanceMiles: number): WeekendScoutCandidate {
  return {
    beach: {
      id,
      name,
      slug: name.toLowerCase().replaceAll(' ', '-'),
      lat: 32.8,
      lon: -117.2,
      is_private: false,
      deleted_at: null,
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
    peakTime: '2026-07-25T15:00:00.000Z',
    beachId,
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
    scorerVersion: 'week-scout-v1:discovery-hero-v1',
    candidateFingerprint: 'fingerprint',
    days: [
      {
        localDate: '2026-07-25',
        windows,
        bestWindowId: windows[0]?.id ?? null,
        exclusionReasons: [],
      },
      {
        localDate: '2026-07-26',
        windows: [],
        bestWindowId: null,
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
    await expect(buildWeekendScoutRanking('user-1', missing)).resolves.toEqual({
      status: 'missing_location',
    });

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
        freshnessAt: '2026-07-24T18:30:00.000Z',
      },
    });
    expect(result.ranking.qualifyingCount).toBe(3);
    expect(result.ranking.contractVersion).toBe('weekend-scout-v1');
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

  it('uses the shared 100-mile radius when max drive time is unset', async () => {
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
      expect.objectContaining({ radiusMiles: 100 }),
    );
    if (result.status !== 'ready') throw new Error('expected ready');
    expect(result.maxDriveMinutes).toBe(200);
  });

  it.each([
    [-5, 15, 7.5],
    [500, 90, 45],
  ])(
    'clamps configured drive time %i to %i minutes',
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
