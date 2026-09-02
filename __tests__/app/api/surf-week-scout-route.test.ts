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
jest.mock(
  '@/lib/services/discovery/week-scout',
  () => ({
    generateWeekScoutForecast: (...args: unknown[]) => mockGenerateWeekScoutForecast(...args),
  }),
);

import { NextRequest } from 'next/server';
import { POST } from '@/app/api/surf/week-scout/route';
import { LOCATION_MAX_AGE_MS } from '@/lib/services/discovery/weekend-scout';
import {
  WEEK_SCOUT_CONTRACT_BEACH_ID,
  WEEK_SCOUT_CONTRACT_FIXTURE,
  WEEK_SCOUT_CONTRACT_GENERATED_AT,
} from '@/__tests__/fixtures/week-scout-contract';

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
    mockGenerateWeekScoutForecast.mockResolvedValue(WEEK_SCOUT_CONTRACT_FIXTURE);
  });

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

  it('accepts legacy requests but evaluates only the first eight unique candidates in order', async () => {
    const candidateBeachIds = Array.from({ length: 12 }, (_, index) => (
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
        candidateBeachIds: candidateBeachIds.slice(0, 8),
      }),
    );
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
      windows: [expect.objectContaining({
        beachId: BEACH_A,
        forecast: expect.objectContaining({
          waveHeight: '3-4 ft',
          waterTemp: '78°F',
        }),
      })],
    });
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
              start: '2026-07-15T16:00:00.000Z',
              end: '2026-07-15T18:00:00.000Z',
              conditionScore: null,
              rankingScore: null,
              verdict: null,
              forecast: { waveHeight: '4 ft' },
            },
          ],
          bestWindowId: null,
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
    expect(body.data.recommendationAvailability).toEqual({
      state: 'none',
      reasonCode: 'major_event_hold',
      holdEpoch: 'held-epoch',
    });
  });
});
