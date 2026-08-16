/**
 * @jest-environment node
 */

jest.mock('server-only', () => ({}));

const mockRun = jest.fn();
jest.mock('@/lib/cron/weekend-scout-runner', () => ({
  runWeekendScoutCron: (...args: unknown[]) => mockRun(...args),
}));
jest.mock('@/lib/cron/outcome', () => ({
  withCronOutcome: jest.fn(async (_options: unknown, handler: () => Promise<unknown>) => handler()),
}));
jest.mock('@/lib/cron/observability', () => ({
  withObservedCron: (_path: string, handler: unknown) => handler,
}));

import { GET } from '@/app/api/cron/weekend-window/route';

describe('GET /api/cron/weekend-window', () => {
  it('delegates to the Weekend Scout runner', async () => {
    const expected = Response.json({ success: true });
    mockRun.mockResolvedValue(expected);
    const request = new Request('http://localhost/api/cron/weekend-window');
    await expect(GET(request)).resolves.toBe(expected);
    expect(mockRun).toHaveBeenCalledWith(
      request,
      undefined,
      expect.objectContaining({
        unit: "windows_evaluated",
        expectedMin: 1,
      })
    );
  });
});
