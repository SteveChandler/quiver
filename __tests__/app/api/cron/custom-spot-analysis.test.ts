/** @jest-environment node */

const mockValidateCronRequest = jest.fn(() => true);
const mockProcessBatch = jest.fn();

jest.mock('@/lib/cron/observability', () => ({
  withObservedCron:
    (_route: string, handler: (request: Request) => Promise<Response>) => handler,
}));

jest.mock('@/lib/middleware/api-wrappers', () => ({
  validateCronRequest: mockValidateCronRequest,
}));

jest.mock('@/lib/services/custom-spot-analysis/processor', () => ({
  processCustomSpotAnalysisBatch: mockProcessBatch,
}));

jest.mock('@/lib/services/custom-spot-analysis/supabase-store', () => ({
  SupabaseCustomSpotAnalysisStore: jest.fn(),
}));

describe('custom spot analysis cron', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockValidateCronRequest.mockReturnValue(true);
    mockProcessBatch.mockResolvedValue({
      claimed: 1, completed: 1, cached: 0, retried: 0, failed: 0, stale: 0,
    });
  });

  it('requires cron authentication', async () => {
    mockValidateCronRequest.mockReturnValue(false);
    const { GET } = await import('@/app/api/cron/custom-spot-analysis/route');

    const response = await GET(new Request('https://example.com/api/cron/custom-spot-analysis'));

    expect(response.status).toBe(401);
    expect(mockProcessBatch).not.toHaveBeenCalled();
  });

  it('processes a bounded batch without returning spot identifiers', async () => {
    const { GET } = await import('@/app/api/cron/custom-spot-analysis/route');

    const response = await GET(
      new Request('https://example.com/api/cron/custom-spot-analysis?batchSize=500')
    );

    expect(response.status).toBe(200);
    expect(mockProcessBatch).toHaveBeenCalledWith(expect.anything(), 500);
    expect(await response.json()).toEqual({
      ok: true,
      summary: { claimed: 1, completed: 1, cached: 0, retried: 0, failed: 0, stale: 0 },
    });
  });

  it('returns a privacy-safe failure', async () => {
    mockProcessBatch.mockRejectedValue(new Error('precise coordinates'));
    const { GET } = await import('@/app/api/cron/custom-spot-analysis/route');

    const response = await GET(new Request('https://example.com/api/cron/custom-spot-analysis'));

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      ok: false,
      error: 'custom_spot_analysis_unavailable',
    });
  });
});
