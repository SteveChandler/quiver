/** @jest-environment node */
jest.mock('server-only', () => ({}));
jest.mock('next/server', () => require('@/__tests__/setup/mock-next-server'));
jest.mock('@/lib/middleware/api-wrappers', () => ({
  ...jest.requireActual('@/lib/middleware/api-wrappers'),
  withAuth: (handler: unknown) => handler,
  withRateLimit: (handler: unknown) => handler,
}));

// The route runs the real Week Scout service; only its I/O is replaced.
let mockDependencies: WeekScoutServiceDependencies;
jest.mock('@/lib/services/discovery/week-scout', () => {
  const actual = jest.requireActual('@/lib/services/discovery/week-scout');
  return {
    ...actual,
    generateWeekScoutForecast: (userId: string, input: WeekScoutRequest) =>
      actual.generateWeekScoutForecast(userId, input, mockDependencies),
  };
});
const mockEvaluateMajorEventHoldCandidates = jest.fn();
jest.mock('@/lib/recommendations/major-event-hold/service', () => ({
  evaluateMajorEventHoldCandidates: (...args: unknown[]) => mockEvaluateMajorEventHoldCandidates(...args),
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

import { NextRequest } from 'next/server';
import { POST } from '@/app/api/surf/week-scout/route';
import type { WeekScoutRequest, WeekScoutServiceDependencies } from '@/lib/services/discovery/week-scout';
import { expectConsoleWarnings } from '@/__tests__/setup/test-utils';
import { TIMEZONE, localDate } from '@/__tests__/helpers/swell-events';
import { BLACKS, SCRIPPS, weekScoutSwellDependencies } from '@/__tests__/helpers/week-scout-swells';

async function callRoute(): Promise<Response> {
  const supabase = {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({ maybeSingle: jest.fn(async () => ({ data: null, error: null })) })),
      })),
    })),
  };
  return POST(new NextRequest('http://localhost/api/surf/week-scout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      candidateBeachIds: [BLACKS, SCRIPPS], localTimezone: TIMEZONE, startLocalDate: localDate(0), dayCount: 7,
    }),
  }), { user: { id: 'user-swells' }, supabase, params: {} } as never);
}

describe('POST /api/surf/week-scout swells', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.WEEK_SCOUT_SWELLS_ENABLED = 'true';
    delete process.env.WEEK_SCOUT_SWELLS_USER_ALLOWLIST;
    mockDependencies = weekScoutSwellDependencies();
    mockEvaluateMajorEventHoldCandidates.mockImplementation(
      async ({ candidates }: { candidates: Array<{ candidateId: string }> }) => candidates.map(({ candidateId }) => ({
        candidateId,
        evaluation: { outcome: 'allow', holdIds: [], holdEpoch: 'swells-epoch' },
        recommendationAvailability: { state: 'available', holdEpoch: 'swells-epoch' },
      })),
    );
  });

  afterEach(() => {
    delete process.env.WEEK_SCOUT_SWELLS_ENABLED;
  });

  it('returns swells end to end when the flag is on', async () => {
    const response = await callRoute();
    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload.data.swells).toHaveLength(1);
    expect(payload.data.swells[0]).toMatchObject({ directionLabel: 'W', crossing: null });
  });

  it('still answers 200 with the full week, minus swells, when swells fail', async () => {
    mockDependencies.loadSwellSnapshots = jest.fn(async () => { throw new Error('relation does not exist'); });
    const response = await callRoute();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.data).not.toHaveProperty('swells');
    expect(payload.data.days).toHaveLength(7);
    expectConsoleWarnings([/swell snapshots failed; omitting swells/]);
  });

  it('leaves the field absent when the flag is off', async () => {
    delete process.env.WEEK_SCOUT_SWELLS_ENABLED;
    const response = await callRoute();
    expect((await response.json()).data).not.toHaveProperty('swells');
    expect(mockDependencies.loadSwellSnapshots).not.toHaveBeenCalled();
  });
});
