/**
 * Unit tests for User Preference Update Cron Job API
 * Tests the nightly cron endpoint that updates user surf preferences
 */

import { POST, GET } from '@/app/api/cron/update-user-preferences/route';
import { NextRequest } from 'next/server';
import { computeUserPreferences } from '@/lib/services/preference-learning-service';

// Mock the preference learning service
jest.mock('@/lib/services/preference-learning-service', () => ({
  computeUserPreferences: jest.fn(),
}));

// Mock API response utilities
jest.mock('@/lib/api-response-utils', () => ({
  createSuccessResponse: jest.fn((data, message) => ({
    json: jest.fn(() =>
      Promise.resolve({
        success: true,
        data,
        message,
        timestamp: new Date().toISOString(),
      })
    ),
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

// Mock Supabase
const mockSupabaseClient = {
  from: jest.fn(() => {
    const mockChain = {
      select: jest.fn(() => mockChain),
      not: jest.fn(() => mockChain),
      gte: jest.fn(() =>
        Promise.resolve({
          data: [
            { user_id: 'user-1' },
            { user_id: 'user-2' },
            { user_id: 'user-3' },
            { user_id: 'user-1' }, // Duplicate to test uniqueness
          ],
          error: null,
        })
      ),
    };
    return mockChain;
  }),
};

jest.mock('@/lib/supabase/server', () => ({
  createSupabaseServiceRoleClient: jest.fn(() => mockSupabaseClient),
}));

describe('User Preference Update Cron Job API', () => {
  const mockRequest = (headers: Record<string, string> = {}) => {
    return {
      headers: {
        get: jest.fn((name: string) => headers[name] || null),
      },
      json: jest.fn(() => Promise.resolve({})),
    } as unknown as NextRequest;
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset environment to production for most tests
    process.env.VERCEL_ENV = 'production';

    // Reset mockSupabaseClient to default behavior (3 users)
    mockSupabaseClient.from = jest.fn(() => {
      const mockChain = {
        select: jest.fn(() => mockChain),
        not: jest.fn(() => mockChain),
        gte: jest.fn(() =>
          Promise.resolve({
            data: [
              { user_id: 'user-1' },
              { user_id: 'user-2' },
              { user_id: 'user-3' },
              { user_id: 'user-1' }, // Duplicate to test uniqueness
            ],
            error: null,
          })
        ),
      };
      return mockChain;
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
    // Clean up environment
    delete process.env.VERCEL_ENV;
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
        const { validateCronRequest } = require('@/lib/api-response-utils');
        validateCronRequest.mockReturnValueOnce(false);

        const request = mockRequest({
          authorization: 'Bearer invalid-secret',
        });

        const response = await POST(request);
        const data = await response.json();

        expect(data.success).toBe(false);
        expect(data.error).toBe('Unauthorized');
      });

      it('should accept requests with valid Vercel Cron header', async () => {
        const request = mockRequest({
          'x-vercel-cron': '1',
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
        mockSupabaseClient.from = jest.fn(() => {
          const mockChain = {
            select: jest.fn(() => mockChain),
            not: jest.fn(() => mockChain),
            gte: jest.fn(() =>
              Promise.resolve({
                data: [],
                error: null,
              })
            ),
          };
          return mockChain;
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

        mockSupabaseClient.from = jest.fn(() => {
          const mockChain = {
            select: jest.fn(() => mockChain),
            not: jest.fn(() => mockChain),
            gte: jest.fn(() =>
              Promise.resolve({
                data: users,
                error: null,
              })
            ),
          };
          return mockChain;
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
        mockSupabaseClient.from = jest.fn(() => {
          const mockChain = {
            select: jest.fn(() => mockChain),
            not: jest.fn(() => mockChain),
            gte: jest.fn(() =>
              Promise.resolve({
                data: null,
                error: { message: 'Connection timeout' },
              })
            ),
          };
          return mockChain;
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

      it('should complete within reasonable time for large batches', async () => {
        // Create 100 users
        const users = Array.from({ length: 100 }, (_, i) => ({
          user_id: `user-${i}`,
        }));

        mockSupabaseClient.from = jest.fn(() => {
          const mockChain = {
            select: jest.fn(() => mockChain),
            not: jest.fn(() => mockChain),
            gte: jest.fn(() =>
              Promise.resolve({
                data: users,
                error: null,
              })
            ),
          };
          return mockChain;
        });

        const startTime = Date.now();
        const request = mockRequest({
          authorization: 'Bearer valid-cron-secret',
        });

        await POST(request);
        const duration = Date.now() - startTime;

        // Should complete within 15 seconds (generous for test environment)
        expect(duration).toBeLessThan(15000);
      });
    });
  });

  describe('GET /api/cron/update-user-preferences', () => {
    describe('Health Check', () => {
      it('should return healthy status when services are operational', async () => {
        const request = mockRequest({
          authorization: 'Bearer valid-cron-secret',
        });

        const response = await GET(request);
        const data = await response.json();

        expect(data.success).toBe(true);
        expect(data.data.status).toBe('healthy');
        expect(data.data).toMatchObject({
          timestamp: expect.any(String),
          services: {
            database: true,
            preferencesTable: true,
          },
          stats: {
            totalPreferences: expect.any(Number),
          },
        });
      });

      it('should return degraded status when database is unavailable', async () => {
        mockSupabaseClient.from = jest.fn(() => ({
          select: jest.fn(() =>
            Promise.resolve({
              data: null,
              error: { message: 'Connection refused' },
              count: null,
            })
          ),
        }));

        const request = mockRequest({
          authorization: 'Bearer valid-cron-secret',
        });

        const response = await GET(request);
        const data = await response.json();

        expect(data.success).toBe(true);
        expect(data.data.status).toBe('degraded');
        expect(data.data.services.database).toBe(false);
      });

      it('should reject health checks in non-production environments', async () => {
        process.env.VERCEL_ENV = 'development';

        const request = mockRequest({
          authorization: 'Bearer valid-cron-secret',
        });

        const response = await GET(request);
        const data = await response.json();

        expect(data.success).toBe(false);
        expect(data.error).toContain('Forbidden');
      });

      it('should reject health checks without authentication', async () => {
        const { validateCronRequest } = require('@/lib/api-response-utils');
        validateCronRequest.mockReturnValueOnce(false);

        const request = mockRequest({});

        const response = await GET(request);
        const data = await response.json();

        expect(data.success).toBe(false);
        expect(data.error).toBe('Unauthorized');
      });
    });
  });
});
