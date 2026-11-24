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
const mockGenerateWeekScoutForecastForDays = jest.fn();
const mockBuildDriveRangeCandidatePool = jest.fn();
jest.mock('@/lib/services/discovery/week-scout', () => ({
  generateWeekScoutForecast: (...args: unknown[]) => mockGenerateWeekScoutForecast(...args),
  generateWeekScoutForecastForDays: (...args: unknown[]) => mockGenerateWeekScoutForecastForDays(...args),
}));
jest.mock('@/lib/services/discovery/weekend-scout-candidate-pool', () => ({
  buildWeekendScoutCandidatePool: jest.fn(),
  buildDriveRangeCandidatePool: (...args: unknown[]) => mockBuildDriveRangeCandidatePool(...args),
}));

import { NextRequest } from 'next/server';
import { POST } from '@/app/api/surf/week-scout/route';
import { resetWeekScoutAnswerReuseForTests } from '@/lib/services/discovery/week-scout-answer-reuse';
import { WEEK_SCOUT_CONTRACT_FIXTURE } from '@/__tests__/fixtures/week-scout-contract';
import type { CanonicalWeekScoutResponse } from '@/lib/services/discovery/week-scout';
import { expectConsoleWarnings } from '@/__tests__/setup/test-utils';

const INNER_BEACH = '11111111-1111-4111-8111-111111111111';
const OUTER_BEACH = '33333333-3333-4333-8333-333333333333';
const ANCHOR = { lat: 32.75, lon: -117.25 };
const MILES_PER_DEGREE_LAT = 69.05;
type Label = 'EPIC' | 'GOOD' | 'FAIR' | 'RIDEABLE' | 'MEH';

function poolBeach(id: string, name: string, milesNorth: number) {
  return {
    beach: { id, name, slug: id, lat: ANCHOR.lat + milesNorth / MILES_PER_DEGREE_LAT, lon: ANCHOR.lon, timezone: 'America/Los_Angeles' },
    distanceMiles: milesNorth,
  };
}

function pool(candidates: unknown[]) {
  return { candidates, enumeratedCount: candidates.length, filteredOutCount: 0, cappedCount: 0, farthestNearbyMiles: null };
}

/** The contract fixture with its day best relabelled and moved to `beachId`. */
function answer(label: Label, beachId = INNER_BEACH, overrides: Partial<CanonicalWeekScoutResponse> = {}): CanonicalWeekScoutResponse {
  const copy = JSON.parse(JSON.stringify(WEEK_SCOUT_CONTRACT_FIXTURE)) as CanonicalWeekScoutResponse;
  const verdict = label === 'GOOD' || label === 'EPIC' ? 'go' : label === 'MEH' ? 'no' : 'maybe';
  for (const day of copy.days) {
    if (!day.bestDayWindow) continue;
    day.bestDayWindow = { ...day.bestDayWindow, beachId, personalLabel: label, personalVerdict: verdict };
  }
  return { ...copy, ...overrides };
}

function tables(maxDriveMinutes: number | null) {
  const rows: Record<string, unknown> = {
    profiles: { max_drive_minutes: maxDriveMinutes, home_beach_id: null, experience_level: 'intermediate' },
    user_location_snapshots: { ...ANCHOR, captured_at: new Date().toISOString() },
  };
  return {
    from: jest.fn((table: string) => ({
      select: jest.fn(() => ({ eq: () => ({ maybeSingle: async () => ({ data: rows[table] ?? null, error: null }) }) })),
    })),
  };
}

const BODY = {
  candidateScope: { kind: 'complete-radius' },
  localTimezone: 'America/Los_Angeles',
  startLocalDate: '2026-07-15',
  dayCount: 7,
};

async function callRoute(query: string, maxDriveMinutes: number | null = 15) {
  const request = new NextRequest(`http://localhost:3000/api/surf/week-scout${query}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(BODY),
  });
  return POST(request, { user: { id: 'user-week-scout' }, supabase: tables(maxDriveMinutes), params: {} } as never);
}

async function data(query: string, maxDriveMinutes?: number | null) {
  const response = await callRoute(query, maxDriveMinutes);
  expect(response.status).toBe(200);
  return (await response.json()).data;
}

function withoutFartherOut(payload: { days: Array<Record<string, unknown>> }) {
  return { ...payload, days: payload.days.map(({ fartherOut: _fartherOut, ...day }) => day) };
}

describe('POST /api/surf/week-scout?fartherOut=1', () => {
  beforeEach(() => {
    resetWeekScoutAnswerReuseForTests();
    jest.clearAllMocks();
    process.env.WEEK_SCOUT_ENDPOINT_ENABLED = 'true';
    delete process.env.WEEK_SCOUT_FARTHER_OUT;
    mockGenerateWeekScoutForecast.mockImplementation(async () => answer('FAIR'));
    mockGenerateWeekScoutForecastForDays.mockImplementation(async () => answer('GOOD', OUTER_BEACH));
    mockBuildDriveRangeCandidatePool.mockImplementation(async (_userId: string, options: { maxDriveMinutes: number | null }) => (
      options.maxDriveMinutes === 45
        ? pool([poolBeach(OUTER_BEACH, 'Outer Point', 12)])
        : pool([poolBeach(INNER_BEACH, 'Home Break', 2)])
    ));
  });

  afterEach(() => {
    delete process.env.WEEK_SCOUT_FARTHER_OUT;
  });

  it('adds the row when the outer best is a label above, and changes nothing else', async () => {
    const withRow = await data('?fartherOut=1');
    const mainArgs = mockGenerateWeekScoutForecast.mock.calls[0];
    resetWeekScoutAnswerReuseForTests();
    const withoutRow = await data('');

    expect(withRow.days[0].fartherOut).toEqual({
      beachId: OUTER_BEACH,
      beachName: 'Outer Point',
      waveHeight: WEEK_SCOUT_CONTRACT_FIXTURE.days[0].bestDayWindow!.forecast.waveHeight,
      personalLabel: 'GOOD',
      displayWindowStart: WEEK_SCOUT_CONTRACT_FIXTURE.days[0].bestDayWindow!.displayWindowStart,
      displayWindowEnd: WEEK_SCOUT_CONTRACT_FIXTURE.days[0].bestDayWindow!.displayWindowEnd,
      driveMinutes: 25,
      direction: 'north',
    });
    expect(JSON.stringify(withoutFartherOut(withRow))).toBe(JSON.stringify(withoutRow));
    expect(mockGenerateWeekScoutForecast.mock.calls[1]).toEqual(mainArgs);
    expect(mockBuildDriveRangeCandidatePool).toHaveBeenCalledWith('user-week-scout', expect.objectContaining({
      anchor: ANCHOR, maxDriveMinutes: 45, widenEmptyRange: false, beyondMiles: 7.5, nearbyCap: 20,
    }));
    expect(mockGenerateWeekScoutForecastForDays).toHaveBeenCalledWith('user-week-scout', {
      localTimezone: 'America/Los_Angeles',
      startLocalDate: '2026-07-15',
      dayCount: 7,
      userLocation: ANCHOR,
      driveRadiusMiles: 7.5,
      requirePerRowFreshness: true,
      candidateBeachIds: [OUTER_BEACH],
    });
  });

  it('adds no row when the outer best has the same label', async () => {
    mockGenerateWeekScoutForecastForDays.mockImplementation(async () => answer('FAIR', OUTER_BEACH));
    expect((await data('?fartherOut=1')).days[0].fartherOut).toBeUndefined();
    expect(mockGenerateWeekScoutForecastForDays).toHaveBeenCalledTimes(1);
  });

  it('adds no row when the outer best is below the in-range best', async () => {
    mockGenerateWeekScoutForecast.mockImplementation(async () => answer('GOOD'));
    mockGenerateWeekScoutForecastForDays.mockImplementation(async () => answer('FAIR', OUTER_BEACH));
    expect((await data('?fartherOut=1')).days[0].fartherOut).toBeUndefined();
    expect(mockGenerateWeekScoutForecastForDays).toHaveBeenCalledTimes(1);
  });

  it('runs no outer pass without the param', async () => {
    const payload = await data('');
    expect(payload.days[0].fartherOut).toBeUndefined();
    expect(mockGenerateWeekScoutForecastForDays).not.toHaveBeenCalled();
    expect(mockBuildDriveRangeCandidatePool).toHaveBeenCalledTimes(1);
  });

  it('runs no outer pass under the kill switch', async () => {
    process.env.WEEK_SCOUT_FARTHER_OUT = 'false';
    expect((await data('?fartherOut=1')).days[0].fartherOut).toBeUndefined();
    expect(mockGenerateWeekScoutForecastForDays).not.toHaveBeenCalled();
    expect(mockBuildDriveRangeCandidatePool).toHaveBeenCalledTimes(1);
  });

  it.each([45, 90, null])('runs no outer pass for a %p-minute drive range', async (maxDriveMinutes) => {
    expect((await data('?fartherOut=1', maxDriveMinutes)).days[0].fartherOut).toBeUndefined();
    expect(mockGenerateWeekScoutForecastForDays).not.toHaveBeenCalled();
  });

  it('adds no row when the outer ring is held', async () => {
    mockGenerateWeekScoutForecastForDays.mockImplementation(async () => answer('GOOD', OUTER_BEACH, {
      recommendationAvailability: { state: 'none', reasonCode: 'major_event_hold', holdEpoch: 'held-epoch' },
    }));
    expect((await data('?fartherOut=1')).days[0].fartherOut).toBeUndefined();
    expect(mockGenerateWeekScoutForecastForDays).toHaveBeenCalledTimes(1);
  });

  it('adds no row when the outer best is unsafe', async () => {
    const unsafe = answer('GOOD', OUTER_BEACH);
    unsafe.days[0].bestDayWindow!.safe = false;
    mockGenerateWeekScoutForecastForDays.mockResolvedValue(unsafe);
    expect((await data('?fartherOut=1')).days[0].fartherOut).toBeUndefined();
    expect(mockGenerateWeekScoutForecastForDays).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['ranking', () => mockGenerateWeekScoutForecastForDays.mockRejectedValue(new Error('outer ranking failed'))],
    ['pool', () => mockBuildDriveRangeCandidatePool.mockImplementation(async (_userId: string, options: { maxDriveMinutes: number | null }) => {
      if (options.maxDriveMinutes === 45) throw new Error('outer pool failed');
      return pool([poolBeach(INNER_BEACH, 'Home Break', 2)]);
    })],
  ])('serves the normal answer when the outer %s fails', async (_stage, fail) => {
    const normal = await data('');
    resetWeekScoutAnswerReuseForTests();
    fail();

    const payload = await data('?fartherOut=1');
    expectConsoleWarnings([/farther-out pass failed/]);

    expect(payload.days.some((day: Record<string, unknown>) => 'fartherOut' in day)).toBe(false);
    expect(JSON.stringify(payload)).toBe(JSON.stringify(normal));
    // The outer pass did start; its failure is what the answer survived.
    expect(mockBuildDriveRangeCandidatePool).toHaveBeenCalledWith('user-week-scout', expect.objectContaining({ maxDriveMinutes: 45 }));
  });

  it('still fails the request when the main ranking fails', async () => {
    mockGenerateWeekScoutForecast.mockRejectedValue(new Error('main ranking failed'));
    await expect(callRoute('?fartherOut=1')).rejects.toThrow('main ranking failed');
    expect(mockGenerateWeekScoutForecastForDays).toHaveBeenCalledTimes(1);
  });
});
