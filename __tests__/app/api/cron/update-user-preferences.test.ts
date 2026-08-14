/**
 * Unit tests for User Preference Update Cron Job API
 * Tests the nightly cron endpoint that updates user surf preferences
 */

import { POST, GET } from '@/app/api/cron/update-user-preferences/route';
import { NextRequest } from 'next/server';
import { computeUserPreferences } from '@/lib/services/preference-learning-service';
import { readFileSync } from 'fs';

jest.mock("@/lib/cron/outcome", () => ({
  withCronOutcome: jest.fn(async (_options: unknown, handler: () => Promise<unknown>) => handler()),
}));

// Mock the preference learning service
jest.mock('@/lib/services/preference-learning-service', () => ({
  computeUserPreferences: jest.fn(),
}));

// Mock API response utilities
jest.mock('@/lib/middleware/api-wrappers', () => ({
  createSuccessResponse: jest.fn((data, status = 200) => ({
    json: jest.fn(() =>
      Promise.resolve({
        success: true,
        data,
        timestamp: new Date().toISOString(),
      })
    ),
    status,
  })),
  createErrorResponse: jest.fn((error, details, status = 500) => ({
    json: jest.fn(() =>
      Promise.resolve({
        success: false,
        error,
        details,
        timestamp: new Date().toISOString(),
      })
    ),
    status,
  })),
  validateCronRequest: jest.fn(() => true),
}));

// Mock chain type for Supabase queries
interface MockChain {
  select: jest.Mock<MockChain>;
  not: jest.Mock<MockChain>;
  eq: jest.Mock<MockChain | Promise<{ data: { id: string }[] | null; error: null }>>;
  gte: jest.Mock<Promise<{ data: { user_id: string }[] | null; error: { message: string } | null }>>;
}

// Helper to create a mock chain for session_forecast_snapshots
function createSessionsChain(
  data: { user_id: string }[] | null = [
    { user_id: "user-1" },
    { user_id: "user-2" },
    { user_id: "user-3" },
    { user_id: "user-1" }, // Duplicate to test uniqueness
  ],
  error: { message: string } | null = null
): MockChain {
  const chain: MockChain = {
    select: jest.fn(),
    not: jest.fn(),
    eq: jest.fn(),
    gte: jest.fn(() => Promise.resolve({ data, error })),
  };
  chain.select.mockReturnValue(chain);
  chain.not.mockReturnValue(chain);
  return chain;
}

// Helper to create a mock chain for profiles (NPC users)
function createProfilesChain(
  npcIds: string[] = [] // NPC user IDs to exclude
) {
  return {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn(() => Promise.resolve({
      data: npcIds.map(id => ({ id })),
      error: null
    })),
  };
}

// Mock Supabase
const mockSupabaseClient = {
  from: jest.fn((table: string) => {
    if (table === 'profiles') {
      return createProfilesChain();
    }
    return createSessionsChain();
  }),
};

jest.mock('@/lib/supabase/server', () => ({
  createSupabaseServiceRoleClient: jest.fn(() => mockSupabaseClient),
}));

describe('User Preference Update Cron Job API', () => {
  const routeSource = readFileSync(
    'app/api/cron/update-user-preferences/route.ts',
    'utf8'
  );
  let consoleLogSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;
  let consoleWarnSpy: jest.SpyInstance;

  const mockRequest = (
    headers: Record<string, string> = {},
    url = 'http://localhost/api/cron/update-user-preferences'
  ) => {
    const nextUrl = new URL(url);
    return {
      url,
      nextUrl,
      headers: {
        get: jest.fn((name: string) => headers[name] || null),
      },
      json: jest.fn(() => Promise.resolve({})),
    } as unknown as NextRequest;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    require('@/lib/middleware/api-wrappers').validateCronRequest.mockReturnValue(true);

    // Reset environment to production for most tests
    process.env.VERCEL_ENV = "production";

    // Reset mockSupabaseClient to default behavior (3 users, no NPCs)
    mockSupabaseClient.from = jest.fn((table: string) => {
      if (table === 'profiles') {
        return createProfilesChain([]);
      }
      return createSessionsChain();
    });

    // Default: computeUserPreferences succeeds
    (computeUserPreferences as jest.Mock).mockResolvedValue({
      wave_min_ft: 2.0,
      wave_max_ft: 6.0,
      wave_period_min_s: 10.0,
      wave_period_max_s: 14.0,
      max_wind_mph: 12.0,
      preferred_wind_directions: [270, 315],
      preferred_tide_statuses: ['incoming', 'high'],
      confidence: 0.75,
      sample_size: 15,
    });
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();

    // Clean up environment
    delete process.env.VERCEL_ENV;
  });

  it('uses the API wrapper barrel for response helpers and cron request validation', () => {
    expect(routeSource).not.toContain('@/lib/api-utils');
    expect(routeSource).toContain('@/lib/middleware/api-wrappers');
  });

  describe('POST /api/cron/update-user-preferences', () => {
    describe('Authentication & Authorization', () => {
      it('should reject requests in non-production environments', async () => {
        process.env.VERCEL_ENV = 'development';

        const request = mockRequest({
          authorization: 'Bearer valid-cron-secret',
        });

        const response = await POST(request);
        const data = await response.json();

        expect(data.success).toBe(false);
        expect(data.error).toContain('Forbidden');
        expect(data.details).toContain('development');
      });

      it('should reject requests without valid authentication', async () => {
        const { validateCronRequest } = require('@/lib/middleware/api-wrappers');
        validateCronRequest.mockReturnValue(false);

        const request = mockRequest({
          authorization: 'Bearer invalid-secret',
        });

        const response = await POST(request);
        const data = await response.json();

        expect(data.success).toBe(false);
        expect(data.error).toBe('Unauthorized');
      });

      it('should accept requests with valid Bearer cron token', async () => {
        const request = mockRequest({
          authorization: 'Bearer test-cron-secret',
        });

        const response = await POST(request);
        const data = await response.json();

        expect(data.success).toBe(true);
      });

      it('should accept requests with valid Bearer token', async () => {
        const request = mockRequest({
          authorization: 'Bearer valid-cron-secret',
        });

        const response = await POST(request);
        const data = await response.json();

        expect(data.success).toBe(true);
      });
    });

    describe('User Query & Batch Processing', () => {
      it('should query users with rated sessions from session_forecast_snapshots', async () => {
        const request = mockRequest({
          authorization: 'Bearer valid-cron-secret',
        });

        await POST(request);

        expect(mockSupabaseClient.from).toHaveBeenCalledWith(
          'session_forecast_snapshots'
        );
      });

      it('should deduplicate user IDs from query results', async () => {
        const request = mockRequest({
          authorization: 'Bearer valid-cron-secret',
        });

        const response = await POST(request);
        const data = await response.json();

        // Mock returns 4 records but only 3 unique user IDs
        expect(data.data.totalUsers).toBe(3);
      });

      it('should handle empty result set gracefully', async () => {
        mockSupabaseClient.from = jest.fn((table: string) => {
          if (table === 'profiles') {
            return createProfilesChain([]);
          }
          return createSessionsChain([]);
        });

        const request = mockRequest({
          authorization: 'Bearer valid-cron-secret',
        });

        const response = await POST(request);
        const data = await response.json();

        expect(data.success).toBe(true);
        expect(data.data.totalUsers).toBe(0);
        expect(data.data.successful).toBe(0);
        expect(data.data.failed).toBe(0);
        expect(data.data.skipped).toBe(0);
      });

      it('should process users in batches of 10', async () => {
        // Create 25 unique users to test batching
        const users = Array.from({ length: 25 }, (_, i) => ({
          user_id: `user-${i}`,
        }));

        mockSupabaseClient.from = jest.fn((table: string) => {
          if (table === 'profiles') {
            return createProfilesChain([]);
          }
          return createSessionsChain(users);
        });

        const request = mockRequest({
          authorization: 'Bearer valid-cron-secret',
        });

        const response = await POST(request);
        const data = await response.json();

        expect(data.data.totalUsers).toBe(25);
        expect(computeUserPreferences).toHaveBeenCalledTimes(25);
      });
    });

    describe('Preference Computation', () => {
      it('should call computeUserPreferences for each user', async () => {
        const request = mockRequest({
          authorization: 'Bearer valid-cron-secret',
        });

        await POST(request);

        expect(computeUserPreferences).toHaveBeenCalledTimes(3);
        expect(computeUserPreferences).toHaveBeenCalledWith('user-1');
        expect(computeUserPreferences).toHaveBeenCalledWith('user-2');
        expect(computeUserPreferences).toHaveBeenCalledWith('user-3');
      });

      it('should count successful preference updates', async () => {
        const request = mockRequest({
          authorization: 'Bearer valid-cron-secret',
        });

        const response = await POST(request);
        const data = await response.json();

        expect(data.success).toBe(true);
        expect(data.data.successful).toBe(3);
        expect(data.data.failed).toBe(0);
        expect(data.data.skipped).toBe(0);
      });

      it('should count skipped users (insufficient data)', async () => {
        (computeUserPreferences as jest.Mock)
          .mockResolvedValueOnce({
            wave_min_ft: 2.0,
            wave_max_ft: 6.0,
            confidence: 0.75,
            sample_size: 15,
          })
          .mockResolvedValueOnce(null) // User 2: insufficient data
          .mockResolvedValueOnce({
            wave_min_ft: 3.0,
            wave_max_ft: 8.0,
            confidence: 0.65,
            sample_size: 12,
          });

        const request = mockRequest({
          authorization: 'Bearer valid-cron-secret',
        });

        const response = await POST(request);
        const data = await response.json();

        expect(data.success).toBe(true);
        expect(data.data.successful).toBe(2);
        expect(data.data.skipped).toBe(1);
        expect(data.data.failed).toBe(0);
      });
    });

    describe('Error Handling', () => {
      it('should continue processing after individual user failures', async () => {
        (computeUserPreferences as jest.Mock)
          .mockResolvedValueOnce({ confidence: 0.75, sample_size: 15 }) // User 1: success
          .mockRejectedValueOnce(new Error('Database connection timeout')) // User 2: error
          .mockResolvedValueOnce({ confidence: 0.65, sample_size: 12 }); // User 3: success

        const request = mockRequest({
          authorization: 'Bearer valid-cron-secret',
        });

        const response = await POST(request);
        const data = await response.json();

        expect(data.success).toBe(true);
        expect(data.data.successful).toBe(2);
        expect(data.data.failed).toBe(1);
        expect(data.data.failures).toHaveLength(1);
        expect(data.data.failures[0]).toMatchObject({
          userId: 'user-2',
          error: 'Database connection timeout',
        });
      });

      it('should collect all failures for reporting', async () => {
        (computeUserPreferences as jest.Mock)
          .mockRejectedValueOnce(new Error('Error 1'))
          .mockRejectedValueOnce(new Error('Error 2'))
          .mockRejectedValueOnce(new Error('Error 3'));

        const request = mockRequest({
          authorization: 'Bearer valid-cron-secret',
        });

        const response = await POST(request);
        const data = await response.json();

        expect(data.success).toBe(true); // Job completes despite failures
        expect(data.data.successful).toBe(0);
        expect(data.data.failed).toBe(3);
        expect(data.data.failures).toHaveLength(3);
      });

      it('should handle Supabase query errors', async () => {
        mockSupabaseClient.from = jest.fn((table: string) => {
          if (table === 'profiles') {
            return createProfilesChain([]);
          }
          return createSessionsChain(null, { message: "Connection timeout" });
        });

        const request = mockRequest({
          authorization: 'Bearer valid-cron-secret',
        });

        const response = await POST(request);
        const data = await response.json();

        expect(data.success).toBe(false);
        expect(data.details).toMatchObject({
          error: expect.stringContaining('Failed to query eligible users'),
        });
      });
    });

    describe('Performance & Monitoring', () => {
      it('should report execution duration', async () => {
        const request = mockRequest({
          authorization: 'Bearer valid-cron-secret',
        });

        const response = await POST(request);
        const data = await response.json();

        expect(data.data.duration).toMatch(/^\d+ms$/);
      });

      it('should include comprehensive result summary', async () => {
        const request = mockRequest({
          authorization: 'Bearer valid-cron-secret',
        });

        const response = await POST(request);
        const data = await response.json();

        expect(data.data).toMatchObject({
          totalUsers: expect.any(Number),
          successful: expect.any(Number),
          failed: expect.any(Number),
          skipped: expect.any(Number),
          duration: expect.any(String),
          failures: expect.any(Array),
        });
      });

    });
  });

  describe('GET /api/cron/update-user-preferences', () => {
    describe('Main Update Handler (Vercel Cron uses GET)', () => {
      it('should process users the same as POST', async () => {
        const request = mockRequest({
          authorization: 'Bearer valid-cron-secret',
        });

        const response = await GET(request);
        const data = await response.json();

        expect(data.success).toBe(true);
        expect(data.data.successful).toBe(3);
      });

      it('should reject in non-production environments', async () => {
        process.env.VERCEL_ENV = 'development';

        const request = mockRequest({
          authorization: 'Bearer valid-cron-secret',
        });

        const response = await GET(request);
        const data = await response.json();

        expect(data.success).toBe(false);
        expect(data.error).toContain('Forbidden');
      });

      it('should reject without authentication', async () => {
        const { validateCronRequest } = require('@/lib/middleware/api-wrappers');
        validateCronRequest.mockReturnValue(false);

        const request = mockRequest({});

        const response = await GET(request);
        const data = await response.json();

        expect(data.success).toBe(false);
        expect(data.error).toBe('Unauthorized');
      });
    });
  });

  describe('NPC/Bot User Filtering', () => {
    it('should exclude NPC users (is_mock = true) from preference learning', async () => {
      // Set up: user-2 is an NPC
      mockSupabaseClient.from = jest.fn((table: string) => {
        if (table === 'profiles') {
          return createProfilesChain(['user-2']); // user-2 is NPC
        }
        return createSessionsChain([
          { user_id: 'user-1' },
          { user_id: 'user-2' }, // NPC - should be excluded
          { user_id: 'user-3' },
        ]);
      });

      const request = mockRequest({
        authorization: 'Bearer valid-cron-secret',
      });

      const response = await POST(request);
      const data = await response.json();

      // Only user-1 and user-3 should be processed (user-2 excluded)
      expect(data.data.totalUsers).toBe(2);
      expect(computeUserPreferences).toHaveBeenCalledTimes(2);
      expect(computeUserPreferences).toHaveBeenCalledWith('user-1');
      expect(computeUserPreferences).toHaveBeenCalledWith('user-3');
      expect(computeUserPreferences).not.toHaveBeenCalledWith('user-2');
    });

    it('should handle case where all users are NPCs', async () => {
      mockSupabaseClient.from = jest.fn((table: string) => {
        if (table === 'profiles') {
          return createProfilesChain(['user-1', 'user-2', 'user-3']); // All NPCs
        }
        return createSessionsChain([
          { user_id: 'user-1' },
          { user_id: 'user-2' },
          { user_id: 'user-3' },
        ]);
      });

      const request = mockRequest({
        authorization: 'Bearer valid-cron-secret',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(data.data.totalUsers).toBe(0);
      expect(data.data.message).toContain('No eligible users');
      expect(computeUserPreferences).not.toHaveBeenCalled();
    });

    it('should process all users when there are no NPCs', async () => {
      mockSupabaseClient.from = jest.fn((table: string) => {
        if (table === 'profiles') {
          return createProfilesChain([]); // No NPCs
        }
        return createSessionsChain([
          { user_id: 'user-1' },
          { user_id: 'user-2' },
          { user_id: 'user-3' },
        ]);
      });

      const request = mockRequest({
        authorization: 'Bearer valid-cron-secret',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(data.data.totalUsers).toBe(3);
      expect(computeUserPreferences).toHaveBeenCalledTimes(3);
    });

    it('should include NPC users for manual includeMock runs', async () => {
      mockSupabaseClient.from = jest.fn((table: string) => {
        if (table === 'profiles') {
          return createProfilesChain(['user-2']);
        }
        return createSessionsChain([
          { user_id: 'user-1' },
          { user_id: 'user-2' },
          { user_id: 'user-3' },
        ]);
      });

      const request = mockRequest(
        { authorization: 'Bearer valid-cron-secret' },
        'http://localhost/api/cron/update-user-preferences?includeMock=true'
      );

      const response = await POST(request);
      const data = await response.json();

      expect(data.data.totalUsers).toBe(3);
      expect(data.data.includeMockUsers).toBe(true);
      expect(computeUserPreferences).toHaveBeenCalledWith('user-1');
      expect(computeUserPreferences).toHaveBeenCalledWith('user-2');
      expect(computeUserPreferences).toHaveBeenCalledWith('user-3');
    });
  });
});
