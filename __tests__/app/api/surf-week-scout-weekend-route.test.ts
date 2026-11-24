/**
 * @jest-environment node
 */

jest.mock('server-only', () => ({}));
jest.mock('next/server', () => require('@/__tests__/setup/mock-next-server'));
jest.mock('@/lib/middleware/api-wrappers', () => {
  const actual = jest.requireActual('@/lib/middleware/api-wrappers');
  return { ...actual, withAuth: (handler: unknown) => handler, withRateLimit: (handler: unknown) => handler };
});

const mockBuildRanking = jest.fn();
jest.mock('@/lib/services/discovery/weekend-scout', () => ({
  buildWeekendScoutRanking: (...args: unknown[]) => mockBuildRanking(...args),
}));

import { NextRequest } from 'next/server';
import { POST } from '@/app/api/surf/week-scout/weekend/route';
import fixture from '@/__tests__/fixtures/weekend-scout-v1.json';

describe('POST /api/surf/week-scout/weekend', () => {
  const originalFlag = process.env.WEEKEND_WINDOW_ENABLED;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.WEEKEND_WINDOW_ENABLED = 'true';
    mockBuildRanking.mockResolvedValue({ status: 'no_qualifying_windows' });
  });

  afterAll(() => {
    if (originalFlag === undefined) delete process.env.WEEKEND_WINDOW_ENABLED;
    else process.env.WEEKEND_WINDOW_ENABLED = originalFlag;
  });

  it('returns a live non-persisted ranking with private no-store caching', async () => {
    const { snapshotId: _snapshotId, ...fields } = fixture;
    const ranking = {
      ...fields,
      origin: { kind: 'home_beach', beachId: fields.results[0].beachId, beachName: fields.results[0].beachName },
    };
    mockBuildRanking.mockResolvedValue({
      status: 'ready', ranking, maxDriveMinutes: 45, leadWindowTimezone: fields.timezone,
    });
    const response = await POST(
      new NextRequest('http://localhost/api/surf/week-scout/weekend', { method: 'POST' }),
      { user: { id: 'user-1' }, supabase: {}, params: {} } as never,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    const { data } = await response.json();
    expect(data).toEqual({ status: 'ready', ranking, maxDriveMinutes: 45 });
    expect(mockBuildRanking).toHaveBeenCalledWith('user-1');
  });

  it('returns 404 when Weekend Scout is disabled', async () => {
    delete process.env.WEEKEND_WINDOW_ENABLED;
    const response = await POST(
      new NextRequest('http://localhost/api/surf/week-scout/weekend', { method: 'POST' }),
      { user: { id: 'user-1' }, supabase: {}, params: {} } as never,
    );
    expect(response.status).toBe(404);
    expect(mockBuildRanking).not.toHaveBeenCalled();
  });
});
