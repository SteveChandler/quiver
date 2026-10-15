/**
 * @jest-environment node
 */

jest.mock('server-only', () => ({}));
jest.mock('next/server', () => require('@/__tests__/setup/mock-next-server'));

jest.mock('@/lib/middleware/api-wrappers', () => {
  const actual = jest.requireActual('@/lib/middleware/api-wrappers');
  return {
    ...actual,
    withAuth: (handler: unknown) => handler,
    withRateLimit: (handler: unknown) => handler,
  };
});

const mockGenerateWeekScoutForecast = jest.fn();
const mockBuildWeekendScoutCandidatePool = jest.fn();
const mockBuildDriveRangeCandidatePool = jest.fn();
jest.mock(
  '@/lib/services/discovery/week-scout',
  () => ({
    generateWeekScoutForecast: (...args: unknown[]) => mockGenerateWeekScoutForecast(...args),
  }),
);
jest.mock('@/lib/services/discovery/weekend-scout-candidate-pool', () => ({
  buildWeekendScoutCandidatePool: (...args: unknown[]) => mockBuildWeekendScoutCandidatePool(...args),
  buildDriveRangeCandidatePool: (...args: unknown[]) => mockBuildDriveRangeCandidatePool(...args),
}));

import { NextRequest } from 'next/server';
import { POST } from '@/app/api/surf/week-scout/route';
import { LOCATION_MAX_AGE_MS } from '@/lib/services/discovery/weekend-scout';
import {
  WEEK_SCOUT_CONTRACT_BEACH_ID,
  WEEK_SCOUT_CONTRACT_FIXTURE,
  WEEK_SCOUT_CONTRACT_GENERATED_AT,
  weekScoutPersonalCallViolations,
} from '@/__tests__/fixtures/week-scout-contract';
import { calculateDistanceInMiles } from '@/lib/utils/distance-utils';

const BEACH_A = WEEK_SCOUT_CONTRACT_BEACH_ID;
const BEACH_B = '22222222-2222-4222-8222-222222222222';

function request(body: unknown): NextRequest {
  return new NextRequest('http://localhost:3000/api/surf/week-scout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function callRoute(body: unknown, supabase: unknown = {}) {
  return POST(request(body), {
    user: { id: 'user-week-scout' },
    supabase,
    params: {},
  } as never);
}

describe('POST /api/surf/week-scout', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.WEEK_SCOUT_ENDPOINT_ENABLED = 'true';
    delete process.env.WEEK_SCOUT_SWELLS_ENABLED;
    delete process.env.WEEK_SCOUT_SWELLS_USER_ALLOWLIST;
    mockGenerateWeekScoutForecast.mockResolvedValue(WEEK_SCOUT_CONTRACT_FIXTURE);
    mockBuildWeekendScoutCandidatePool.mockResolvedValue({ candidates: [], incomplete: false });
    mockBuildDriveRangeCandidatePool.mockResolvedValue({
      candidates: [], enumeratedCount: 0, filteredOutCount: 0, cappedCount: 0, farthestNearbyMiles: null,
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  function tables(rows: Record<string, unknown>) {
    return jest.fn((table: string) => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: rows[table] ?? null, error: null }) }) }),
    }));
  }

  it('deduplicates candidate IDs and returns the exact private no-store response', async () => {
    const response = await callRoute({
      candidateBeachIds: [BEACH_B, BEACH_A, BEACH_B],
      localTimezone: 'Pacific/Honolulu',
      startLocalDate: '2026-07-15',
      dayCount: 7,
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe(
      'private, no-store, no-cache, must-revalidate',
    );
    expect(mockGenerateWeekScoutForecast).toHaveBeenCalledWith(
      'user-week-scout',
      {
        candidateBeachIds: [BEACH_B, BEACH_A],
        localTimezone: 'Pacific/Honolulu',
        startLocalDate: '2026-07-15',
        dayCount: 7,
      },
    );
  });

  it('passes the personal call through on windows, the day best and ranked spots', async () => {
    const response = await callRoute({
      candidateBeachIds: [BEACH_A], localTimezone: 'Pacific/Honolulu', startLocalDate: '2026-07-15', dayCount: 7,
    });
    const { data } = await response.json();
    const [day] = data.days;

    expect(weekScoutPersonalCallViolations(data)).toEqual([]);
    expect(day.windows[0]).toMatchObject({ verdict: 'worth_it', personalVerdict: 'go', personalLabel: 'GOOD' });
    expect(day.windows[0].rankedSpots[0]).toMatchObject({ personalVerdict: 'go', personalLabel: 'GOOD' });
    expect(day.bestDayWindow).toMatchObject({ personalVerdict: 'go', personalLabel: 'GOOD' });
  });

  it('flags a personal label that contradicts its verdict', () => {
    const [window] = WEEK_SCOUT_CONTRACT_FIXTURE.days[0].windows;
    const contradiction = {
      days: [{ windows: [{ ...window, verdict: 'maybe' as const, rankedSpots: [] }] }],
    };

    expect(weekScoutPersonalCallViolations(contradiction as never)).toEqual([
      `window ${window.id}: personalVerdict go is not maybe`,
    ]);
  });

  it('evaluates all 30 unique candidates before the service limits ranked results', async () => {
    const candidateBeachIds = Array.from({ length: 30 }, (_, index) => (
      `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`
    ));

    const response = await callRoute({
      candidateBeachIds,
      localTimezone: 'Pacific/Honolulu',
      startLocalDate: '2026-07-15',
      dayCount: 7,
    });

    expect(response.status).toBe(200);
    expect(mockGenerateWeekScoutForecast).toHaveBeenCalledWith(
      'user-week-scout',
      expect.objectContaining({
        candidateBeachIds,
      }),
    );
  });

  it('keeps legacy payloads free of complete-radius coverage metadata', async () => {
    mockGenerateWeekScoutForecast.mockResolvedValueOnce({
      ...WEEK_SCOUT_CONTRACT_FIXTURE,
      coverage: {
        days: [{
          localDate: '2026-07-15', eligible: 12, evaluated: 10, missing: 2, excluded: null,
          buckets: [
            { bucket: 'morning', eligible: 12, evaluated: 10, missing: 2, noWindow: 1, held: 0 },
            { bucket: 'midday', eligible: 12, evaluated: 10, missing: 2, noWindow: 0, held: 0 },
            { bucket: 'evening', eligible: 12, evaluated: 9, missing: 3, noWindow: 0, held: 1 },
          ],
        }],
      },
    });
    const response = await callRoute({
      candidateBeachIds: [BEACH_A], localTimezone: 'Pacific/Honolulu', startLocalDate: '2026-07-15', dayCount: 7,
    });
    expect((await response.json()).data.coverage).toBeUndefined();
  });

  it('enumerates an explicit map scope without a GPS snapshot', async () => {
    const from = jest.fn(() => ({ select: jest.fn(() => ({ eq: jest.fn(() => ({ maybeSingle: jest.fn(async () => ({ data: null, error: null })) })) })) }));
    mockBuildWeekendScoutCandidatePool.mockResolvedValue({
      candidates: [{
        beach: { id: BEACH_A, name: 'Map beach', slug: 'map-beach', lat: 32.05, lon: -117.15, timezone: 'America/Los_Angeles' },
        distanceMiles: 0,
      }],
      enumeratedCount: 1, hydratedCount: 1, filteredOutCount: 0, incomplete: false,
    });
    const response = await callRoute({
      candidateScope: { kind: 'complete-radius', mapBounds: { minLat: 32, maxLat: 32.1, minLon: -117.2, maxLon: -117.1 } },
      localTimezone: 'America/Los_Angeles', startLocalDate: '2026-07-15', dayCount: 7,
    }, { from });
    expect(response.status).toBe(200);
    expect(mockBuildWeekendScoutCandidatePool).toHaveBeenCalledWith('user-week-scout', expect.objectContaining({
      userLocation: { lat: 32.05, lon: -117.15 },
    }));
    const poolOptions = mockBuildWeekendScoutCandidatePool.mock.calls[0]?.[1];
    const cornerDistance = calculateDistanceInMiles(
      { lat: 32.05, lon: -117.15 },
      { lat: 32.1, lon: -117.1 },
    );
    expect(poolOptions.radiusMiles).toBeGreaterThan(cornerDistance);
    const body = await response.json();
    expect(body.data.candidateBeaches).toEqual([expect.objectContaining({ beachId: BEACH_A, distanceMiles: null })]);
    expect(body.data.coverage.scope.candidates).toEqual({ enumerated: 1, hydrated: 1, filteredOut: 0 });
  });

  it('applies distance friction from a fresh authenticated user location snapshot', async () => {
    const maybeSingle = jest.fn(async () => ({
      data: { lat: 32.2, lon: -116.91, captured_at: new Date().toISOString() },
      error: null,
    }));
    const eq = jest.fn(() => ({ maybeSingle }));
    const select = jest.fn(() => ({ eq }));
    const from = jest.fn(() => ({ select }));

    const response = await callRoute({
      candidateBeachIds: [BEACH_A],
      localTimezone: 'America/Tijuana',
      startLocalDate: '2026-07-15',
      dayCount: 7,
    }, { from });

    expect(response.status).toBe(200);
    expect(from).toHaveBeenCalledWith('user_location_snapshots');
    expect(select).toHaveBeenCalledWith('lat, lon, captured_at');
    expect(eq).toHaveBeenCalledWith('user_id', 'user-week-scout');
    expect(mockGenerateWeekScoutForecast).toHaveBeenCalledWith(
      'user-week-scout',
      expect.objectContaining({ userLocation: { lat: 32.2, lon: -116.91 } }),
    );
  });

  it.each([
    [null, 100],
    [60, 30],
  ])('uses the profile drive range (%p min) as the complete-radius scope without a map', async (maxDriveMinutes, expectedMiles) => {
    const from = tables({
      user_location_snapshots: { lat: 32, lon: -118, captured_at: new Date().toISOString() },
      profiles: { max_drive_minutes: maxDriveMinutes, home_beach_id: 'home-beach' },
    });

    const response = await callRoute({
      candidateScope: { kind: 'complete-radius' },
      localTimezone: 'America/Los_Angeles', startLocalDate: '2026-07-15', dayCount: 7,
    }, { from });

    expect(response.status).toBe(200);
    expect(mockBuildWeekendScoutCandidatePool).not.toHaveBeenCalled();
    expect(mockBuildDriveRangeCandidatePool).toHaveBeenCalledWith('user-week-scout', {
      anchor: { lat: 32, lon: -118 },
      homeBeachId: 'home-beach',
      maxDriveMinutes,
      filters: undefined,
    });
    expect(mockGenerateWeekScoutForecast).toHaveBeenCalledWith('user-week-scout', expect.objectContaining({
      userLocation: { lat: 32, lon: -118 },
      driveRadiusMiles: expectedMiles,
    }));
    const scope = (await response.json()).data.coverage.scope;
    expect(scope).toEqual(expect.objectContaining({ radiusMiles: expectedMiles, anchor: 'location' }));
  });

  it('ranks the drive-range scope from the Daily Call pool, with saved spots and distances', async () => {
    const from = tables({
      user_location_snapshots: { lat: 32.767, lon: -117.188, captured_at: new Date().toISOString() },
      profiles: { max_drive_minutes: 90, home_beach_id: 'home-beach' },
    });
    mockBuildDriveRangeCandidatePool.mockResolvedValueOnce({
      candidates: [
        { beach: { id: BEACH_A, name: 'Pacific Beach', slug: 'pacific-beach', lat: 32.797, lon: -117.258, timezone: 'America/Los_Angeles' }, distanceMiles: 4.6 },
        { beach: { id: BEACH_B, name: 'Oceanside Harbor', slug: 'oceanside-harbor', lat: 33.204, lon: -117.394, timezone: 'America/Los_Angeles' }, distanceMiles: 32.5 },
      ],
      enumeratedCount: 3,
      filteredOutCount: 1,
      cappedCount: 0,
      farthestNearbyMiles: null,
    });

    const response = await callRoute({
      candidateScope: { kind: 'complete-radius', filters: ['beach'], mapBounds: null },
      localTimezone: 'America/Los_Angeles', startLocalDate: '2026-07-15', dayCount: 7,
    }, { from });
    const { data } = await response.json();

    expect(response.status).toBe(200);
    expect(mockBuildDriveRangeCandidatePool).toHaveBeenCalledWith('user-week-scout', expect.objectContaining({
      filters: ['beach'],
    }));
    expect(mockGenerateWeekScoutForecast).toHaveBeenCalledWith('user-week-scout', expect.objectContaining({
      candidateBeachIds: [BEACH_A, BEACH_B],
      driveRadiusMiles: 45,
    }));
    expect(data.candidateBeaches.map(({ beachId, distanceMiles }: { beachId: string; distanceMiles: number }) => (
      [beachId, Math.round(distanceMiles)]
    ))).toEqual([[BEACH_A, 5], [BEACH_B, 33]]);
    expect(data.coverage.scope.candidates).toEqual({ enumerated: 3, hydrated: 3, filteredOut: 1, capped: 0 });
  });

  it('reports the distance actually covered when the nearest-beach cap bites', async () => {
    const from = tables({
      user_location_snapshots: { lat: 33.985, lon: -118.473, captured_at: new Date().toISOString() },
      profiles: { max_drive_minutes: null },
    });
    mockBuildDriveRangeCandidatePool.mockResolvedValueOnce({
      candidates: [], enumeratedCount: 99, filteredOutCount: 0, cappedCount: 49, farthestNearbyMiles: 51.2,
    });

    const response = await callRoute({
      candidateScope: { kind: 'complete-radius' },
      localTimezone: 'America/Los_Angeles', startLocalDate: '2026-07-15', dayCount: 7,
    }, { from });
    const scope = (await response.json()).data.coverage.scope;

    expect(scope.radiusMiles).toBe(100);
    expect(scope.coveredMiles).toBe(51.2);
    expect(scope.candidates).toEqual({ enumerated: 99, hydrated: 99, filteredOut: 0, capped: 49 });
    expect(mockGenerateWeekScoutForecast).toHaveBeenCalledWith('user-week-scout', expect.objectContaining({
      driveRadiusMiles: 100,
    }));
  });

  it('reports a widened scope and the nearest beach while ranking with the surfer\'s own range', async () => {
    const from = tables({
      user_location_snapshots: { lat: 39.88, lon: -75.24, captured_at: new Date().toISOString() },
      profiles: { max_drive_minutes: 90 },
    });
    const nearestBeach = { id: BEACH_A, name: '1st Street Jetty', slug: '1st-street-jetty', lat: 39.281, lon: -74.567, distanceMiles: 54.7 };
    mockBuildDriveRangeCandidatePool.mockResolvedValueOnce({
      candidates: [], enumeratedCount: 4, filteredOutCount: 0, cappedCount: 0, farthestNearbyMiles: null,
      widenedFromMiles: 45, nearestBeach,
    });

    const response = await callRoute({
      candidateScope: { kind: 'complete-radius' },
      localTimezone: 'America/New_York', startLocalDate: '2026-10-15', dayCount: 7,
    }, { from });
    const scope = (await response.json()).data.coverage.scope;

    expect(scope.radiusMiles).toBe(100);
    expect(scope.widenedFromMiles).toBe(45);
    expect(scope.nearestBeach).toEqual(nearestBeach);
    expect(mockGenerateWeekScoutForecast).toHaveBeenCalledWith('user-week-scout', expect.objectContaining({
      driveRadiusMiles: 45,
    }));
  });

  it('anchors the drive-range scope on the home beach when the location snapshot is not fresh', async () => {
    const from = tables({
      user_location_snapshots: { lat: 33.13, lon: -117.33, captured_at: new Date(Date.now() - 60 * 60 * 1000).toISOString() },
      profiles: { max_drive_minutes: 90, home_beach_id: 'home-beach' },
      beaches: { lat: 32.747, lon: -117.254 },
    });

    const response = await callRoute({
      candidateScope: { kind: 'complete-radius' },
      localTimezone: 'America/Los_Angeles', startLocalDate: '2026-07-15', dayCount: 7,
    }, { from });

    expect(response.status).toBe(200);
    expect(mockBuildDriveRangeCandidatePool).toHaveBeenCalledWith('user-week-scout', expect.objectContaining({
      anchor: { lat: 32.747, lon: -117.254 },
    }));
    expect(mockGenerateWeekScoutForecast).toHaveBeenCalledWith('user-week-scout', expect.objectContaining({
      userLocation: { lat: 32.747, lon: -117.254 },
    }));
    expect((await response.json()).data.coverage.scope.anchor).toBe('home');
  });

  it('centres the drive-range scope on a searched origin instead of the phone', async () => {
    const from = tables({
      user_location_snapshots: { lat: 32.767, lon: -117.188, captured_at: new Date().toISOString() },
      profiles: { max_drive_minutes: 90, home_beach_id: 'home-beach' },
    });

    const response = await callRoute({
      candidateScope: { kind: 'complete-radius', mapBounds: null, origin: { lat: 36.96, lon: -122.02 } },
      localTimezone: 'America/Los_Angeles', startLocalDate: '2026-07-15', dayCount: 7,
    }, { from });

    expect(response.status).toBe(200);
    expect(mockBuildDriveRangeCandidatePool).toHaveBeenCalledWith('user-week-scout', expect.objectContaining({
      anchor: { lat: 36.96, lon: -122.02 },
    }));
    expect(mockGenerateWeekScoutForecast).toHaveBeenCalledWith('user-week-scout', expect.objectContaining({
      userLocation: { lat: 36.96, lon: -122.02 },
    }));
    expect((await response.json()).data.coverage.scope.anchor).toBe('origin');
  });

  it('rejects an origin outside valid coordinates', async () => {
    const response = await callRoute({
      candidateScope: { kind: 'complete-radius', origin: { lat: 91, lon: 0 } },
      localTimezone: 'America/Los_Angeles', startLocalDate: '2026-07-15', dayCount: 7,
    }, {
      from: tables({
        user_location_snapshots: { lat: 32.767, lon: -117.188, captured_at: new Date().toISOString() },
        profiles: { max_drive_minutes: 90 },
      }),
    });

    expect(response.status).toBe(400);
    expect(mockGenerateWeekScoutForecast).not.toHaveBeenCalled();
  });

  it('rejects the drive-range scope with neither a fresh location nor a home beach', async () => {
    const from = tables({ profiles: { max_drive_minutes: 90, home_beach_id: null } });

    const response = await callRoute({
      candidateScope: { kind: 'complete-radius' },
      localTimezone: 'America/Los_Angeles', startLocalDate: '2026-07-15', dayCount: 7,
    }, { from });

    expect(response.status).toBe(400);
    expect(mockBuildDriveRangeCandidatePool).not.toHaveBeenCalled();
    expect(mockGenerateWeekScoutForecast).not.toHaveBeenCalled();
  });

  it('bounds installed-app candidate IDs to the drive-range pool', async () => {
    const anchor = { lat: 32.767, lon: -117.188 };
    const from = tables({
      profiles: { max_drive_minutes: 90, home_beach_id: 'home-beach' },
      user_location_snapshots: { ...anchor, captured_at: new Date().toISOString() },
    });
    mockBuildDriveRangeCandidatePool.mockResolvedValueOnce({
      candidates: [{ beach: { id: BEACH_A }, distanceMiles: 4.6 }],
    });

    const response = await callRoute({
      candidateBeachIds: [BEACH_A, BEACH_B], localTimezone: 'America/Los_Angeles', startLocalDate: '2026-07-15', dayCount: 7,
    }, { from });

    expect(response.status).toBe(200);
    expect(mockBuildDriveRangeCandidatePool).toHaveBeenCalledWith('user-week-scout', {
      anchor,
      homeBeachId: 'home-beach',
      maxDriveMinutes: 90,
      filters: undefined,
      widenEmptyRange: false,
    });
    expect(mockGenerateWeekScoutForecast).toHaveBeenCalledWith('user-week-scout', expect.objectContaining({
      candidateBeachIds: [BEACH_A],
      driveRadiusMiles: 45,
      userLocation: anchor,
    }));
  });

  it('keeps the K-40 candidate and excludes Ocean Beach Pier from a Baja drive-range pool', async () => {
    const elMorroK38 = { id: BEACH_A, lat: 32.23, lon: -116.93 };
    const oceanBeachPier = { id: BEACH_B, lat: 32.7494, lon: -117.2516 };
    const anchor = { lat: 32.2, lon: -116.9 };
    const from = tables({
      profiles: { max_drive_minutes: 90 },
      user_location_snapshots: { ...anchor, captured_at: new Date().toISOString() },
    });
    mockBuildDriveRangeCandidatePool.mockResolvedValueOnce({
      candidates: [{ beach: elMorroK38, distanceMiles: 3 }],
    });

    const response = await callRoute({
      candidateBeachIds: [oceanBeachPier.id, elMorroK38.id],
      localTimezone: 'America/Tijuana', startLocalDate: '2026-07-15', dayCount: 7,
    }, { from });

    expect(response.status).toBe(200);
    expect(mockBuildDriveRangeCandidatePool).toHaveBeenCalledWith('user-week-scout', {
      anchor,
      homeBeachId: null,
      maxDriveMinutes: 90,
      filters: undefined,
      widenEmptyRange: false,
    });
    expect(mockGenerateWeekScoutForecast).toHaveBeenCalledWith('user-week-scout', expect.objectContaining({
      candidateBeachIds: [elMorroK38.id],
      driveRadiusMiles: 45,
      userLocation: anchor,
    }));
  });

  it('uses the home beach as the installed-app pool anchor when the snapshot is stale', async () => {
    const anchor = { lat: 32.2, lon: -116.9 };
    const from = tables({
      profiles: { max_drive_minutes: 90, home_beach_id: 'home-beach' },
      user_location_snapshots: { lat: 32.7494, lon: -117.2516, captured_at: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString() },
      beaches: anchor,
    });
    mockBuildDriveRangeCandidatePool.mockResolvedValueOnce({
      candidates: [{ beach: { id: BEACH_A }, distanceMiles: 3 }],
    });

    const response = await callRoute({
      candidateBeachIds: [BEACH_A, BEACH_B], localTimezone: 'America/Tijuana', startLocalDate: '2026-07-15', dayCount: 7,
    }, { from });

    expect(response.status).toBe(200);
    expect(mockBuildDriveRangeCandidatePool).toHaveBeenCalledWith('user-week-scout', {
      anchor,
      homeBeachId: 'home-beach',
      maxDriveMinutes: 90,
      filters: undefined,
      widenEmptyRange: false,
    });
    expect(mockGenerateWeekScoutForecast).toHaveBeenCalledWith('user-week-scout', expect.objectContaining({
      candidateBeachIds: [BEACH_A],
      userLocation: anchor,
    }));
  });

  it('keeps installed-app candidate IDs unchanged without a snapshot or home beach', async () => {
    const from = tables({ profiles: { max_drive_minutes: 90, home_beach_id: null } });

    const response = await callRoute({
      candidateBeachIds: [BEACH_B, BEACH_A], localTimezone: 'America/Los_Angeles', startLocalDate: '2026-07-15', dayCount: 7,
    }, { from });

    expect(response.status).toBe(200);
    expect(mockBuildDriveRangeCandidatePool).not.toHaveBeenCalled();
    expect(mockGenerateWeekScoutForecast).toHaveBeenCalledWith('user-week-scout', {
      candidateBeachIds: [BEACH_B, BEACH_A],
      localTimezone: 'America/Los_Angeles', startLocalDate: '2026-07-15', dayCount: 7,
      driveRadiusMiles: 45,
    });
    expect((await response.json()).data).not.toHaveProperty('coverage');
  });

  it.each([
    ['home beach', 0],
    ['candidate pool', 1],
  ] as const)('preserves installed-app scoring when the %s lookup fails', async (failedLookup, expectedPoolLookups) => {
    const lookupError = new Error('Lookup unavailable');
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const from = jest.fn((table: string) => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({
        data: table === 'profiles'
          ? { max_drive_minutes: 90, home_beach_id: 'home-beach' }
          : table === 'beaches' ? { lat: 32.2, lon: -116.9 } : null,
        error: table === 'beaches' && failedLookup === 'home beach' ? lookupError : null,
      }) }) }),
    }));
    if (failedLookup === 'candidate pool') {
      mockBuildDriveRangeCandidatePool.mockRejectedValueOnce(lookupError);
    }

    const response = await callRoute({
      candidateBeachIds: [BEACH_B, BEACH_A], localTimezone: 'America/Tijuana', startLocalDate: '2026-07-15', dayCount: 7,
    }, { from });

    expect(response.status).toBe(200);
    expect(mockGenerateWeekScoutForecast).toHaveBeenCalledWith('user-week-scout', {
      candidateBeachIds: [BEACH_B, BEACH_A],
      localTimezone: 'America/Tijuana', startLocalDate: '2026-07-15', dayCount: 7,
      driveRadiusMiles: 45,
    });
    expect(consoleError).toHaveBeenCalledWith('Failed to bound legacy Week Scout candidates', expect.any(Error));
    expect(mockBuildDriveRangeCandidatePool).toHaveBeenCalledTimes(expectedPoolLookups);
  });

  it('skips installed-app bounding when the profile read fails', async () => {
    const anchor = { lat: 32.2, lon: -116.9 };
    const from = jest.fn((table: string) => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({
        data: table === 'profiles' ? null : { ...anchor, captured_at: new Date().toISOString() },
        error: table === 'profiles' ? { message: 'Profile unavailable' } : null,
      }) }) }),
    }));

    const response = await callRoute({
      candidateBeachIds: [BEACH_B, BEACH_A], localTimezone: 'America/Tijuana', startLocalDate: '2026-07-15', dayCount: 7,
    }, { from });

    expect(response.status).toBe(200);
    expect(mockBuildDriveRangeCandidatePool).not.toHaveBeenCalled();
    expect(from).not.toHaveBeenCalledWith('beaches');
    expect(mockGenerateWeekScoutForecast).toHaveBeenCalledWith('user-week-scout', {
      candidateBeachIds: [BEACH_B, BEACH_A],
      localTimezone: 'America/Tijuana', startLocalDate: '2026-07-15', dayCount: 7,
      userLocation: anchor,
    });
  });

  it('keeps installed-app candidate IDs when the drive-range pool is empty', async () => {
    const anchor = { lat: 32.2, lon: -116.9 };
    const from = tables({
      profiles: { max_drive_minutes: 90 },
      user_location_snapshots: { ...anchor, captured_at: new Date().toISOString() },
    });
    mockBuildDriveRangeCandidatePool.mockResolvedValueOnce({ candidates: [] });

    const response = await callRoute({
      candidateBeachIds: [BEACH_B, BEACH_A], localTimezone: 'America/Tijuana', startLocalDate: '2026-07-15', dayCount: 7,
    }, { from });

    expect(response.status).toBe(200);
    expect(mockBuildDriveRangeCandidatePool).toHaveBeenCalledTimes(1);
    expect(mockGenerateWeekScoutForecast).toHaveBeenCalledWith('user-week-scout', expect.objectContaining({
      candidateBeachIds: [BEACH_B, BEACH_A],
      driveRadiusMiles: 45,
      userLocation: anchor,
    }));
  });

  it('scores in-range pool candidates when no installed-app ID intersects the pool', async () => {
    const anchor = { lat: 32.2, lon: -116.9 };
    const from = tables({
      profiles: { max_drive_minutes: 90 },
      user_location_snapshots: { ...anchor, captured_at: new Date().toISOString() },
    });
    mockBuildDriveRangeCandidatePool.mockResolvedValueOnce({
      candidates: [{ beach: { id: BEACH_A }, distanceMiles: 3 }],
    });

    const response = await callRoute({
      candidateBeachIds: [BEACH_B], localTimezone: 'America/Tijuana', startLocalDate: '2026-07-15', dayCount: 7,
    }, { from });

    expect(response.status).toBe(200);
    expect(mockGenerateWeekScoutForecast).toHaveBeenCalledWith('user-week-scout', expect.objectContaining({
      candidateBeachIds: [BEACH_A],
      userLocation: anchor,
    }));
  });

  it('uses map center for enumeration while reporting actual user distance', async () => {
    const from = jest.fn((table: string) => {
      if (table === 'user_location_snapshots') {
        return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { lat: 32, lon: -118, captured_at: new Date().toISOString() }, error: null }) }) }) };
      }
      return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { max_drive_minutes: null }, error: null }) }) }) };
    });
    mockBuildWeekendScoutCandidatePool.mockResolvedValueOnce({
      candidates: [{
        beach: { id: BEACH_A, name: 'Map beach', slug: 'map-beach', lat: 32.05, lon: -117.15, timezone: 'America/Los_Angeles' },
        distanceMiles: 0,
      }],
      enumeratedCount: 1, hydratedCount: 1, filteredOutCount: 0, incomplete: false,
    });
    const response = await callRoute({
      candidateScope: { kind: 'complete-radius', mapBounds: { minLat: 32, maxLat: 32.1, minLon: -117.2, maxLon: -117.1 } },
      localTimezone: 'America/Los_Angeles', startLocalDate: '2026-07-15', dayCount: 7,
    }, { from });

    expect(response.status).toBe(200);
    expect(mockBuildWeekendScoutCandidatePool).toHaveBeenCalledWith('user-week-scout', expect.objectContaining({
      userLocation: { lat: 32.05, lon: -117.15 },
      nearbyLocation: { lat: 32, lon: -118 },
    }));
    expect((await response.json()).data.candidateBeaches[0].distanceMiles).toBeGreaterThan(40);
  });

  it('keeps map-corner candidates inside a conservatively expanded prefilter near the supported extent', async () => {
    mockBuildWeekendScoutCandidatePool.mockResolvedValueOnce({
      candidates: [], enumeratedCount: 0, hydratedCount: 0, filteredOutCount: 0, incomplete: false,
    });
    const response = await callRoute({
      candidateScope: {
        kind: 'complete-radius',
        // The latitude-only extent is roughly 98.5 miles, close enough to
        // exercise a radius-scaled (rather than fixed) geodesic margin.
        mapBounds: { minLat: 32, maxLat: 33.42, minLon: -117.1, maxLon: -117.1 },
      },
      localTimezone: 'America/Los_Angeles', startLocalDate: '2026-07-15', dayCount: 7,
    }, { from: jest.fn(() => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) })) });

    expect(response.status).toBe(200);
    const options = mockBuildWeekendScoutCandidatePool.mock.calls[0]?.[1];
    const center = { lat: 32.71, lon: -117.1 };
    const cornerDistance = calculateDistanceInMiles(center, { lat: 33.42, lon: -117.1 });
    expect(options.radiusMiles).toBeGreaterThan(cornerDistance * 1.005);
    expect(options.radiusMiles).toBeLessThanOrEqual(100);
  });

  it.each([
    ['stale', new Date(Date.now() - LOCATION_MAX_AGE_MS - 1).toISOString()],
    ['missing captured_at', undefined],
  ])('does not apply distance friction from a %s location snapshot', async (_label, capturedAt) => {
    const maybeSingle = jest.fn(async () => ({
      data: { lat: 32.2, lon: -116.91, captured_at: capturedAt },
      error: null,
    }));
    const from = jest.fn(() => ({
      select: () => ({
        eq: () => ({ maybeSingle }),
      }),
    }));

    const response = await callRoute({
      candidateBeachIds: [BEACH_A],
      localTimezone: 'America/Tijuana',
      startLocalDate: '2026-07-15',
      dayCount: 7,
    }, { from });

    expect(response.status).toBe(200);
    expect(mockGenerateWeekScoutForecast).toHaveBeenCalledWith(
      'user-week-scout',
      expect.not.objectContaining({ userLocation: expect.anything() }),
    );
  });

  it.each([
    ['an invalid timezone', {
      candidateBeachIds: [BEACH_A],
      localTimezone: 'Not/A_Timezone',
      startLocalDate: '2026-07-15',
      dayCount: 7,
    }],
    ['an invalid calendar date', {
      candidateBeachIds: [BEACH_A],
      localTimezone: 'Pacific/Honolulu',
      startLocalDate: '2026-02-30',
      dayCount: 7,
    }],
    ['a non-seven-day request', {
      candidateBeachIds: [BEACH_A],
      localTimezone: 'Pacific/Honolulu',
      startLocalDate: '2026-07-15',
      dayCount: 5,
    }],
  ])('rejects %s', async (_label, body) => {
    const response = await callRoute(body);

    expect(response.status).toBe(400);
    expect(mockGenerateWeekScoutForecast).not.toHaveBeenCalled();
  });

  it('rejects more than 30 unique candidate IDs', async () => {
    const candidateBeachIds = Array.from({ length: 31 }, (_, index) => (
      `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`
    ));

    const response = await callRoute({
      candidateBeachIds,
      localTimezone: 'Pacific/Honolulu',
      startLocalDate: '2026-07-15',
      dayCount: 7,
    });

    expect(response.status).toBe(400);
    expect(mockGenerateWeekScoutForecast).not.toHaveBeenCalled();
  });

  it('keeps the endpoint enabled for installed clients when the rollout flag is unset', async () => {
    delete process.env.WEEK_SCOUT_ENDPOINT_ENABLED;
    const response = await callRoute({
      candidateBeachIds: [BEACH_A],
      localTimezone: 'Pacific/Honolulu',
      startLocalDate: '2026-07-15',
      dayCount: 7,
    });

    expect(response.status).toBe(200);
    expect(mockGenerateWeekScoutForecast).toHaveBeenCalledWith(
      'user-week-scout',
      expect.objectContaining({ candidateBeachIds: [BEACH_A] }),
    );
    expect(response.headers.get('Cache-Control')).toBe(
      'private, no-store, no-cache, must-revalidate',
    );
  });

  it('returns the non-empty canonical mobile contract fixture', async () => {
    delete process.env.WEEK_SCOUT_ENDPOINT_ENABLED;
    const response = await callRoute({
      candidateBeachIds: [BEACH_A],
      localTimezone: 'Pacific/Honolulu',
      startLocalDate: '2026-07-15',
      dayCount: 7,
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data).toMatchObject({
      generatedAt: WEEK_SCOUT_CONTRACT_GENERATED_AT,
      recommendationAvailability: {
        state: 'available',
        holdEpoch: 'available-epoch',
      },
      sessionDecision: expect.objectContaining({
        verdict: 'go',
        selection: expect.objectContaining({ beachId: BEACH_A }),
      }),
    });
    expect(payload.data.days[0]).toMatchObject({
      bestWindowId: 'window-a',
      bestDayWindow: expect.objectContaining({ id: 'window-a' }),
      windows: [expect.objectContaining({
        beachId: BEACH_A,
        isBeachDayBest: true,
        displayWindowStart: '2026-07-15T16:00:00.000Z',
        displayWindowEnd: '2026-07-15T18:30:00.000Z',
        forecast: expect.objectContaining({
          waveHeight: '3-4 ft',
          waterTemp: '78°F',
        }),
      })],
    });
  });

  it('keeps swells out of the response and the request while the flag is off', async () => {
    const response = await callRoute({
      candidateBeachIds: [BEACH_A], localTimezone: 'Pacific/Honolulu', startLocalDate: '2026-07-15', dayCount: 7,
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(mockGenerateWeekScoutForecast.mock.calls[0][1]).not.toHaveProperty('includeSwells');
    // Even a service result carrying swells is not passed through.
    expect(payload.data).not.toHaveProperty('swells');
  });

  it('requests and returns the additive swells contract for an allowlisted user', async () => {
    process.env.WEEK_SCOUT_SWELLS_ENABLED = 'true';
    process.env.WEEK_SCOUT_SWELLS_USER_ALLOWLIST = 'someone-else, user-week-scout';
    const response = await callRoute({
      candidateBeachIds: [BEACH_A], localTimezone: 'Pacific/Honolulu', startLocalDate: '2026-07-15', dayCount: 7,
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(mockGenerateWeekScoutForecast).toHaveBeenCalledWith(
      'user-week-scout',
      expect.objectContaining({ includeSwells: true }),
    );
    expect(payload.data.swells).toEqual(WEEK_SCOUT_CONTRACT_FIXTURE.swells);
    const [swell] = payload.data.swells;
    expect(Object.keys(swell).sort()).toEqual([
      'arrivalAt', 'beaches', 'change', 'confidence', 'crossing', 'directionDeg', 'directionLabel', 'eventKey',
      'fadeAt', 'narrative', 'peakAt', 'peakLocalDate', 'peakOffshoreHeightFt', 'periodS', 'timezone', 'windAtPeak',
    ]);
    const windows = payload.data.days.flatMap(
      (day: { windows: Array<{ id: string; forecast: { waveHeight: string | null } }> }) => day.windows,
    );
    const named = windows.find(({ id }: { id: string }) => id === swell.beaches[0].bestWindow.windowId);
    // The row's height is the day strip's height for that same window.
    expect(swell.beaches[0].bestWindow.waveHeight).toBe(named.forecast.waveHeight);
    // Existing fields are untouched.
    expect(payload.data.days[0].bestWindowId).toBe('window-a');
  });

  it('keeps swells off for users outside a non-empty allowlist', async () => {
    process.env.WEEK_SCOUT_SWELLS_ENABLED = 'true';
    process.env.WEEK_SCOUT_SWELLS_USER_ALLOWLIST = 'someone-else';
    const response = await callRoute({
      candidateBeachIds: [BEACH_A], localTimezone: 'Pacific/Honolulu', startLocalDate: '2026-07-15', dayCount: 7,
    });
    expect(mockGenerateWeekScoutForecast.mock.calls[0][1]).not.toHaveProperty('includeSwells');
    expect((await response.json()).data).not.toHaveProperty('swells');
  });

  it('returns 404 without running discovery when the emergency kill switch is enabled', async () => {
    process.env.WEEK_SCOUT_ENDPOINT_ENABLED = 'false';
    const response = await callRoute({
      candidateBeachIds: [BEACH_A],
      localTimezone: 'Pacific/Honolulu',
      startLocalDate: '2026-07-15',
      dayCount: 7,
    });

    expect(response.status).toBe(404);
    expect(mockGenerateWeekScoutForecast).not.toHaveBeenCalled();
    expect(response.headers.get('Cache-Control')).toBe(
      'private, no-store, no-cache, must-revalidate',
    );
  });

  it('returns HTTP 200 explicit none with no best window for held results', async () => {
    mockGenerateWeekScoutForecast.mockResolvedValueOnce({
      generatedAt: '2026-07-15T18:00:00.000Z',
      scorerVersion: 'week-scout-v1',
      candidateFingerprint: 'candidate-fingerprint',
      days: [
        {
          localDate: '2026-07-15',
          windows: [
            {
              id: 'window-1',
              beachId: BEACH_A,
              isBeachDayBest: true,
              start: '2026-07-15T16:00:00.000Z',
              end: '2026-07-15T18:00:00.000Z',
              displayWindowStart: '2026-07-15T16:00:00.000Z',
              displayWindowEnd: '2026-07-15T18:00:00.000Z',
              conditionScore: null,
              rankingScore: null,
              verdict: null,
              forecast: { waveHeight: '4 ft' },
            },
          ],
          bestWindowId: null,
          bestDayWindow: null,
        },
      ],
      recommendationAvailability: {
        state: 'none',
        reasonCode: 'major_event_hold',
        holdEpoch: 'held-epoch',
      },
    });

    const response = await callRoute({
      candidateBeachIds: [BEACH_A],
      localTimezone: 'Pacific/Honolulu',
      startLocalDate: '2026-07-15',
      dayCount: 7,
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.days[0].bestWindowId).toBeNull();
    expect(body.data.days[0].bestDayWindow).toBeNull();
    expect(body.data.recommendationAvailability).toEqual({
      state: 'none',
      reasonCode: 'major_event_hold',
      holdEpoch: 'held-epoch',
    });
  });
});
