/**
 * @jest-environment node
 */

jest.mock('server-only', () => ({}));
jest.mock('next/server', () => require('@/__tests__/setup/mock-next-server'));
jest.mock('@/lib/middleware/api-wrappers', () => {
  const actual = jest.requireActual('@/lib/middleware/api-wrappers');
  return { ...actual, withAuth: (handler: unknown) => handler, withRateLimit: (handler: unknown) => handler };
});

const mockLoadSnapshot = jest.fn();
jest.mock('@/lib/services/discovery/weekend-scout-snapshots', () => ({
  loadWeekendScoutSnapshot: (...args: unknown[]) => mockLoadSnapshot(...args),
}));

import fixture from '@/__tests__/fixtures/weekend-scout-v1.json';
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/surf/week-scout/snapshots/[snapshotId]/route';

describe('GET /api/surf/week-scout/snapshots/:snapshotId', () => {
  const originalFlag = process.env.WEEKEND_WINDOW_ENABLED;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.WEEKEND_WINDOW_ENABLED = 'true';
    mockLoadSnapshot.mockResolvedValue({ snapshot: fixture });
  });

  afterAll(() => {
    if (originalFlag === undefined) delete process.env.WEEKEND_WINDOW_ENABLED;
    else process.env.WEEKEND_WINDOW_ENABLED = originalFlag;
  });

  it('scopes retrieval to the authenticated owner and disables caching', async () => {
    const response = await GET(
      new NextRequest(`http://localhost/api/surf/week-scout/snapshots/${fixture.snapshotId}`),
      { user: { id: 'user-1' }, supabase: {}, params: { snapshotId: fixture.snapshotId } } as never,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(mockLoadSnapshot).toHaveBeenCalledWith('user-1', fixture.snapshotId);
  });

  it('returns 404 for a snapshot not owned by the caller', async () => {
    mockLoadSnapshot.mockResolvedValue(null);
    const response = await GET(
      new NextRequest(`http://localhost/api/surf/week-scout/snapshots/${fixture.snapshotId}`),
      { user: { id: 'user-2' }, supabase: {}, params: { snapshotId: fixture.snapshotId } } as never,
    );
    expect(response.status).toBe(404);
  });

  it('returns 404 without loading data when Weekend Scout is disabled', async () => {
    delete process.env.WEEKEND_WINDOW_ENABLED;
    const response = await GET(
      new NextRequest(`http://localhost/api/surf/week-scout/snapshots/${fixture.snapshotId}`),
      { user: { id: 'user-1' }, supabase: {}, params: { snapshotId: fixture.snapshotId } } as never,
    );
    expect(response.status).toBe(404);
    expect(mockLoadSnapshot).not.toHaveBeenCalled();
  });
});
