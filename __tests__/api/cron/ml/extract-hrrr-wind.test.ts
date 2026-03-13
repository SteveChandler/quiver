/**
 * @jest-environment node
 */

import {
  setupCronTestEnvironment,
  createMockCronRequest,
  type CronTestEnvironment,
} from '@/__tests__/setup/cron-test-utils';
import { expectConsoleErrors } from '@/__tests__/setup/test-utils';

// ----- Mock: @supabase/supabase-js -----
const mockSelect = jest.fn();
const mockNot = jest.fn();
const mockEq = jest.fn();
const mockGte = jest.fn();
const mockLt = jest.fn();
const mockUpdate = jest.fn();
const mockFrom = jest.fn();

// Chainable query builder
function chainable(terminal?: () => any) {
  const chain: any = {};
  const methods = ['select', 'not', 'eq', 'gte', 'lt', 'update', 'from'];
  for (const m of methods) {
    chain[m] = jest.fn(() => chain);
  }
  // Override from to track table name
  chain.from = mockFrom.mockReturnValue(chain);
  chain.select = mockSelect.mockReturnValue(chain);
  chain.not = mockNot.mockReturnValue(chain);
  chain.eq = mockEq.mockReturnValue(chain);
  chain.gte = mockGte.mockReturnValue(chain);
  chain.lt = mockLt.mockReturnValue(chain);
  chain.update = mockUpdate.mockReturnValue(chain);
  // Terminal - resolve the promise
  if (terminal) {
    chain.then = (resolve: any) => resolve(terminal());
  }
  return chain;
}

// Build a configurable mock Supabase client
let mockBeachesResult: { data: any[] | null; error: any } = { data: [], error: null };
let mockUpdateResult: { data: any[] | null; error: any } = { data: [{ id: '1' }], error: null };

const mockSupabaseClient = {
  from: jest.fn((table: string) => {
    if (table === 'beaches') {
      return {
        select: jest.fn().mockReturnValue({
          not: jest.fn().mockReturnValue({
            not: jest.fn().mockResolvedValue(mockBeachesResult),
          }),
        }),
      };
    }
    if (table === 'enhanced_forecasts') {
      return {
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            gte: jest.fn().mockReturnValue({
              lt: jest.fn().mockReturnValue({
                select: jest.fn().mockResolvedValue(mockUpdateResult),
              }),
            }),
          }),
        }),
      };
    }
    return { select: jest.fn().mockResolvedValue({ data: [], error: null }) };
  }),
};

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => mockSupabaseClient),
}));

// ----- Mock: @/lib/ml/ml-service-client -----
const mockFetchWithRetry = jest.fn();
const mockWakeUpService = jest.fn();

jest.mock('@/lib/ml/ml-service-client', () => ({
  fetchWithRetry: (...args: any[]) => mockFetchWithRetry(...args),
  wakeUpService: (...args: any[]) => mockWakeUpService(...args),
}));

// Import route handler AFTER mocks
import { GET } from '@/app/api/cron/ml/extract-hrrr-wind/route';

describe('Cron: extract-hrrr-wind', () => {
  let cronEnv: CronTestEnvironment;

  beforeEach(() => {
    cronEnv = setupCronTestEnvironment({
      additionalEnvVars: {
        ML_SERVICE_URL: 'https://ml.test.com',
        ML_INTERNAL_SECRET: 'test-ml-secret',
        NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
      },
    });
    jest.clearAllMocks();

    // Default: service is awake
    mockWakeUpService.mockResolvedValue(true);
  });

  afterEach(() => {
    cronEnv.cleanup();
  });

  // --- Auth ---

  it('rejects requests without valid Bearer token', async () => {
    const request = createMockCronRequest('/api/cron/ml/extract-hrrr-wind', {
      authMethod: 'none',
    });
    const response = await GET(request);
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBe('Unauthorized');
  });

  it('accepts valid Bearer token', async () => {
    mockBeachesResult = { data: [], error: null };
    const request = createMockCronRequest('/api/cron/ml/extract-hrrr-wind', {
      authMethod: 'bearer-token',
    });
    const response = await GET(request);
    // Should get past auth (200 with "No beaches found")
    expect(response.status).toBe(200);
  });

  // --- Env vars ---

  it('returns 500 when ML_SERVICE_URL is missing', async () => {
    delete process.env.ML_SERVICE_URL;
    const request = createMockCronRequest('/api/cron/ml/extract-hrrr-wind', {
      authMethod: 'bearer-token',
    });
    const response = await GET(request);
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error).toContain('not configured');
  });

  it('returns 500 when ML_INTERNAL_SECRET is missing', async () => {
    delete process.env.ML_INTERNAL_SECRET;
    const request = createMockCronRequest('/api/cron/ml/extract-hrrr-wind', {
      authMethod: 'bearer-token',
    });
    const response = await GET(request);
    expect(response.status).toBe(500);
  });

  // --- Wake up ---

  it('returns 503 when service will not wake up', async () => {
    mockWakeUpService.mockResolvedValue(false);

    const request = createMockCronRequest('/api/cron/ml/extract-hrrr-wind', {
      authMethod: 'bearer-token',
    });
    const response = await GET(request);
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body.error).toContain('unavailable');
    // Should have been called twice (initial + retry)
    expect(mockWakeUpService).toHaveBeenCalledTimes(2);
  });

  // --- No beaches ---

  it('handles no beaches found', async () => {
    mockBeachesResult = { data: [], error: null };
    const request = createMockCronRequest('/api/cron/ml/extract-hrrr-wind', {
      authMethod: 'bearer-token',
    });
    const response = await GET(request);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.extracted).toBe(0);
    expect(body.message).toContain('No beaches');
  });

  // --- CONUS filtering ---

  it('filters out non-CONUS beaches (e.g., Hawaii)', async () => {
    mockBeachesResult = {
      data: [
        // In CONUS range (San Diego)
        { id: 'beach-sd', lat: 32.8, lon: -117.3 },
        // Hawaii — outside CONUS range
        { id: 'beach-hi', lat: 21.3, lon: -157.8 },
        // Puerto Rico — outside CONUS range
        { id: 'beach-pr', lat: 18.4, lon: -66.1 },
      ],
      error: null,
    };

    // ML service returns results for the one CONUS beach
    mockFetchWithRetry.mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [
          {
            beach_id: 'beach-sd',
            wind_speed_ms: 5.0,
            wind_direction_deg: 270,
            wind_gust_ms: 8.0,
            forecast_hour: 1,
            model_run: '2026-02-28T12:00:00Z',
            valid_time: '2026-02-28T13:00:00Z',
          },
        ],
        count: 1,
      }),
    });

    mockUpdateResult = { data: [{ id: 'row-1' }], error: null };

    const request = createMockCronRequest('/api/cron/ml/extract-hrrr-wind', {
      authMethod: 'bearer-token',
    });
    const response = await GET(request);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.beaches_in_coverage).toBe(1);
    expect(body.extracted).toBe(1);
  });

  // --- ML service failure ---

  it('returns 502 when ML service request throws', async () => {
    mockBeachesResult = {
      data: [{ id: 'beach-1', lat: 34.0, lon: -118.5 }],
      error: null,
    };
    mockFetchWithRetry.mockRejectedValue(new Error('Connection refused'));

    const request = createMockCronRequest('/api/cron/ml/extract-hrrr-wind', {
      authMethod: 'bearer-token',
    });
    const response = await GET(request);
    // Route logs console.error for the failed ML request — acknowledge it
    expectConsoleErrors([/ML service request failed/]);
    expect(response.status).toBe(502);
    const body = await response.json();
    expect(body.error).toContain('failed');
  });

  it('returns 502 when ML service returns non-OK status', async () => {
    mockBeachesResult = {
      data: [{ id: 'beach-1', lat: 34.0, lon: -118.5 }],
      error: null,
    };
    mockFetchWithRetry.mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'Internal Server Error',
    });

    const request = createMockCronRequest('/api/cron/ml/extract-hrrr-wind', {
      authMethod: 'bearer-token',
    });
    const response = await GET(request);
    // Route logs console.error for the non-OK ML response — acknowledge it
    expectConsoleErrors([/ML service error/]);
    expect(response.status).toBe(502);
    const body = await response.json();
    expect(body.error).toContain('500');
  });

  // --- Wind conversion ---

  it('converts wind speed from m/s to mph correctly', async () => {
    mockBeachesResult = {
      data: [{ id: 'beach-1', lat: 34.0, lon: -118.5 }],
      error: null,
    };

    // 10 m/s * 2.237 = 22.37, rounds to 22 mph
    mockFetchWithRetry.mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [
          {
            beach_id: 'beach-1',
            wind_speed_ms: 10.0,
            wind_direction_deg: 180.7,
            wind_gust_ms: null,
            forecast_hour: 1,
            model_run: '2026-02-28T12:00:00Z',
            valid_time: '2026-02-28T13:00:00Z',
          },
        ],
        count: 1,
      }),
    });

    // Capture what gets passed to .update()
    let capturedUpdate: any = null;
    mockSupabaseClient.from.mockImplementation((table: string) => {
      if (table === 'beaches') {
        return {
          select: jest.fn().mockReturnValue({
            not: jest.fn().mockReturnValue({
              not: jest.fn().mockResolvedValue(mockBeachesResult),
            }),
          }),
        };
      }
      if (table === 'enhanced_forecasts') {
        return {
          update: jest.fn().mockImplementation((data: any) => {
            capturedUpdate = data;
            return {
              eq: jest.fn().mockReturnValue({
                gte: jest.fn().mockReturnValue({
                  lt: jest.fn().mockReturnValue({
                    select: jest.fn().mockResolvedValue({
                      data: [{ id: '1' }],
                      error: null,
                    }),
                  }),
                }),
              }),
            };
          }),
        };
      }
      return { select: jest.fn().mockResolvedValue({ data: [], error: null }) };
    });

    const request = createMockCronRequest('/api/cron/ml/extract-hrrr-wind', {
      authMethod: 'bearer-token',
    });
    const response = await GET(request);
    expect(response.status).toBe(200);

    // Verify wind conversion
    expect(capturedUpdate).toBeTruthy();
    expect(capturedUpdate.wind_speed).toBe('22 mph');
    expect(capturedUpdate.wind_direction).toBe('181');
    expect(capturedUpdate.wind_direction_deg).toBe(181);
  });

  // --- Counter accuracy ---

  it('counts actual matched rows from .select("id")', async () => {
    mockBeachesResult = {
      data: [{ id: 'beach-1', lat: 34.0, lon: -118.5 }],
      error: null,
    };

    mockFetchWithRetry.mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [
          {
            beach_id: 'beach-1',
            wind_speed_ms: 5.0,
            wind_direction_deg: 270,
            wind_gust_ms: null,
            forecast_hour: 1,
            model_run: '2026-02-28T12:00:00Z',
            valid_time: '2026-02-28T13:00:00Z',
          },
        ],
        count: 1,
      }),
    });

    // Return 3 matched rows to verify counter uses data.length, not ++
    mockSupabaseClient.from.mockImplementation((table: string) => {
      if (table === 'beaches') {
        return {
          select: jest.fn().mockReturnValue({
            not: jest.fn().mockReturnValue({
              not: jest.fn().mockResolvedValue(mockBeachesResult),
            }),
          }),
        };
      }
      if (table === 'enhanced_forecasts') {
        return {
          update: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              gte: jest.fn().mockReturnValue({
                lt: jest.fn().mockReturnValue({
                  select: jest.fn().mockResolvedValue({
                    data: [{ id: '1' }, { id: '2' }, { id: '3' }],
                    error: null,
                  }),
                }),
              }),
            }),
          }),
        };
      }
      return { select: jest.fn().mockResolvedValue({ data: [], error: null }) };
    });

    const request = createMockCronRequest('/api/cron/ml/extract-hrrr-wind', {
      authMethod: 'bearer-token',
    });
    const response = await GET(request);
    expect(response.status).toBe(200);
    const body = await response.json();
    // Should be 3 (from data.length), not 1 (from ++)
    expect(body.updated).toBe(3);
  });
});
