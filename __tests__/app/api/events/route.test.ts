/**
 * @jest-environment node
 *
 * Tests for POST /api/events
 *
 * This route records user behavioral events for implicit preference learning.
 * It respects user privacy settings (allow_implicit_tracking).
 */

import { POST } from '@/app/api/events/route';
import { __clearTrackingCache } from '@/lib/services/tracking-cache';
import { createAPIServerClient } from '@/lib/supabase/api-server-client';

// Mock Supabase client
jest.mock('@/lib/supabase/api-server-client', () => ({
  createAPIServerClient: jest.fn(),
}));

const mockSupabase = {
  auth: {
    getUser: jest.fn(),
  },
  from: jest.fn((_table: string) => ({
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        single: jest.fn(),
      })),
    })),
    insert: jest.fn(() => ({
      error: null,
    })),
  })),
};

describe('POST /api/events', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    __clearTrackingCache(); // Clear the in-memory cache between tests
    (createAPIServerClient as jest.Mock).mockReturnValue(mockSupabase);
  });

  it('returns 401 for unauthenticated requests', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'Not authenticated' },
    });

    const request = new Request('http://localhost/api/events', {
      method: 'POST',
      body: JSON.stringify({ eventType: 'beach_view', beachId: '123' }),
    });

    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  it('returns 400 for invalid event type', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-123' } },
      error: null,
    });

    // User has tracking enabled
    mockSupabase.from.mockReturnValue({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn().mockResolvedValue({
            data: { allow_implicit_tracking: true },
            error: null,
          }),
        })),
      })),
      insert: jest.fn(() => ({ error: null })),
    });

    const request = new Request('http://localhost/api/events', {
      method: 'POST',
      body: JSON.stringify({ eventType: 'invalid_event' }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it('skips tracking when user has opted out', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-123' } },
      error: null,
    });

    const mockInsert = jest.fn();

    // User has opted out
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'profiles') {
        return {
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              single: jest.fn().mockResolvedValue({
                data: { allow_implicit_tracking: false },
                error: null,
              }),
            })),
          })),
          insert: jest.fn(() => ({ error: null })),
        };
      }
      return { insert: mockInsert, select: jest.fn() };
    });

    const request = new Request('http://localhost/api/events', {
      method: 'POST',
      body: JSON.stringify({ eventType: 'beach_view', beachId: '123' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.status).toBe('tracking_disabled');
    // Verify insert was NOT called
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('inserts event when tracking is allowed', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-123' } },
      error: null,
    });

    const mockInsert = jest.fn().mockResolvedValue({ error: null });
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'profiles') {
        return {
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              single: jest.fn().mockResolvedValue({
                data: { allow_implicit_tracking: true },
                error: null,
              }),
            })),
          })),
          insert: jest.fn(() => ({ error: null })),
        };
      }
      return { insert: mockInsert, select: jest.fn() };
    });

    const request = new Request('http://localhost/api/events', {
      method: 'POST',
      body: JSON.stringify({
        eventType: 'beach_view',
        beachId: '123',
        metadata: { duration_ms: 5000 },
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(mockInsert).toHaveBeenCalledWith({
      user_id: 'user-123',
      event_type: 'beach_view',
      beach_id: '123',
      metadata: { duration_ms: 5000 },
    });
  });

  it('returns 400 for invalid JSON', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-123' } },
      error: null,
    });

    // User has tracking enabled
    mockSupabase.from.mockReturnValue({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn().mockResolvedValue({
            data: { allow_implicit_tracking: true },
            error: null,
          }),
        })),
      })),
      insert: jest.fn(() => ({ error: null })),
    });

    const request = new Request('http://localhost/api/events', {
      method: 'POST',
      body: 'invalid json',
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it('handles missing event type', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-123' } },
      error: null,
    });

    // User has tracking enabled
    mockSupabase.from.mockReturnValue({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn().mockResolvedValue({
            data: { allow_implicit_tracking: true },
            error: null,
          }),
        })),
      })),
      insert: jest.fn(() => ({ error: null })),
    });

    const request = new Request('http://localhost/api/events', {
      method: 'POST',
      body: JSON.stringify({ beachId: '123' }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it('handles insert errors gracefully', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-123' } },
      error: null,
    });

    const mockInsert = jest.fn().mockResolvedValue({
      error: { message: 'Database error' },
    });

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'profiles') {
        return {
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              single: jest.fn().mockResolvedValue({
                data: { allow_implicit_tracking: true },
                error: null,
              }),
            })),
          })),
          insert: jest.fn(() => ({ error: null })),
        };
      }
      return { insert: mockInsert, select: jest.fn() };
    });

    const request = new Request('http://localhost/api/events', {
      method: 'POST',
      body: JSON.stringify({
        eventType: 'beach_view',
        beachId: '123',
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(500);
  });

  it('accepts all valid event types', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-123' } },
      error: null,
    });

    const mockInsert = jest.fn().mockResolvedValue({ error: null });
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'profiles') {
        return {
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              single: jest.fn().mockResolvedValue({
                data: { allow_implicit_tracking: true },
                error: null,
              }),
            })),
          })),
          insert: jest.fn(() => ({ error: null })),
        };
      }
      return { insert: mockInsert, select: jest.fn() };
    });

    const validEvents = [
      'beach_view',
      'discovery_click',
      'discovery_skip',
      'forecast_check',
      'location_update',
    ];

    for (const eventType of validEvents) {
      const request = new Request('http://localhost/api/events', {
        method: 'POST',
        body: JSON.stringify({ eventType }),
      });

      const response = await POST(request);
      expect(response.status).toBe(200);
    }
  });

  it('defaults to null for missing beachId', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-123' } },
      error: null,
    });

    const mockInsert = jest.fn().mockResolvedValue({ error: null });
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'profiles') {
        return {
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              single: jest.fn().mockResolvedValue({
                data: { allow_implicit_tracking: true },
                error: null,
              }),
            })),
          })),
          insert: jest.fn(() => ({ error: null })),
        };
      }
      return { insert: mockInsert, select: jest.fn() };
    });

    const request = new Request('http://localhost/api/events', {
      method: 'POST',
      body: JSON.stringify({ eventType: 'location_update' }),
    });

    await POST(request);

    expect(mockInsert).toHaveBeenCalledWith({
      user_id: 'user-123',
      event_type: 'location_update',
      beach_id: null,
      metadata: {},
    });
  });

  describe('rate limiting', () => {
    it('allows requests under rate limit', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-rate-test' } },
        error: null,
      });

      const mockInsert = jest.fn().mockResolvedValue({ error: null });
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'profiles') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                single: jest.fn().mockResolvedValue({
                  data: { allow_implicit_tracking: true },
                  error: null,
                }),
              })),
            })),
            insert: jest.fn(() => ({ error: null })),
          };
        }
        return { insert: mockInsert, select: jest.fn() };
      });

      // Send 10 requests (well under the 60/min limit)
      for (let i = 0; i < 10; i++) {
        const request = new Request('http://localhost/api/events', {
          method: 'POST',
          body: JSON.stringify({ eventType: 'beach_view', beachId: `beach-${i}` }),
        });

        const response = await POST(request);
        expect(response.status).toBe(200);
      }

      expect(mockInsert).toHaveBeenCalledTimes(10);
    });

    it('returns 429 when rate limit exceeded', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-rate-limit' } },
        error: null,
      });

      const mockInsert = jest.fn().mockResolvedValue({ error: null });
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'profiles') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                single: jest.fn().mockResolvedValue({
                  data: { allow_implicit_tracking: true },
                  error: null,
                }),
              })),
            })),
            insert: jest.fn(() => ({ error: null })),
          };
        }
        return { insert: mockInsert, select: jest.fn() };
      });

      // Send 60 requests (at the limit)
      for (let i = 0; i < 60; i++) {
        const request = new Request('http://localhost/api/events', {
          method: 'POST',
          body: JSON.stringify({ eventType: 'beach_view', beachId: `beach-${i}` }),
        });

        const response = await POST(request);
        expect(response.status).toBe(200);
      }

      // 61st request should be rate limited
      const rateLimitedRequest = new Request('http://localhost/api/events', {
        method: 'POST',
        body: JSON.stringify({ eventType: 'beach_view', beachId: 'beach-61' }),
      });

      const response = await POST(rateLimitedRequest);
      expect(response.status).toBe(429);

      const data = await response.json();
      expect(data.ok).toBe(false);
      expect(data.status).toBe('rate_limited');
      expect(data.error).toContain('Too many requests');
    });

    it('includes rate limit headers in 429 response', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-headers-test' } },
        error: null,
      });

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'profiles') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                single: jest.fn().mockResolvedValue({
                  data: { allow_implicit_tracking: true },
                  error: null,
                }),
              })),
            })),
            insert: jest.fn(() => ({ error: null })),
          };
        }
        return { insert: jest.fn().mockResolvedValue({ error: null }), select: jest.fn() };
      });

      // Exhaust rate limit
      for (let i = 0; i < 60; i++) {
        const request = new Request('http://localhost/api/events', {
          method: 'POST',
          body: JSON.stringify({ eventType: 'beach_view' }),
        });
        await POST(request);
      }

      // Check headers on rate-limited response
      const request = new Request('http://localhost/api/events', {
        method: 'POST',
        body: JSON.stringify({ eventType: 'beach_view' }),
      });

      const response = await POST(request);

      expect(response.headers.get('X-RateLimit-Limit')).toBe('60');
      expect(response.headers.get('X-RateLimit-Remaining')).toBe('0');
      expect(response.headers.get('X-RateLimit-Reset')).toBeTruthy();
      expect(response.headers.get('Retry-After')).toBeTruthy();

      // Verify Retry-After is a positive number
      const retryAfter = parseInt(response.headers.get('Retry-After') || '0', 10);
      expect(retryAfter).toBeGreaterThan(0);
      expect(retryAfter).toBeLessThanOrEqual(60);
    });

    it('isolates rate limits per user', async () => {
      const mockInsert = jest.fn().mockResolvedValue({ error: null });
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'profiles') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                single: jest.fn().mockResolvedValue({
                  data: { allow_implicit_tracking: true },
                  error: null,
                }),
              })),
            })),
            insert: jest.fn(() => ({ error: null })),
          };
        }
        return { insert: mockInsert, select: jest.fn() };
      });

      // User 1: send 60 requests
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-1-isolation' } },
        error: null,
      });

      for (let i = 0; i < 60; i++) {
        const request = new Request('http://localhost/api/events', {
          method: 'POST',
          body: JSON.stringify({ eventType: 'beach_view' }),
        });
        await POST(request);
      }

      // User 1 should be rate limited
      const user1Request = new Request('http://localhost/api/events', {
        method: 'POST',
        body: JSON.stringify({ eventType: 'beach_view' }),
      });
      const user1Response = await POST(user1Request);
      expect(user1Response.status).toBe(429);

      // User 2: should NOT be rate limited
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-2-isolation' } },
        error: null,
      });

      const user2Request = new Request('http://localhost/api/events', {
        method: 'POST',
        body: JSON.stringify({ eventType: 'beach_view' }),
      });
      const user2Response = await POST(user2Request);
      expect(user2Response.status).toBe(200);
    });
  });

  describe('tracking cache integration', () => {
    it('caches tracking preference after first check', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-cache-test' } },
        error: null,
      });

      const mockProfileSelect = jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn().mockResolvedValue({
            data: { allow_implicit_tracking: true },
            error: null,
          }),
        })),
      }));

      const mockInsert = jest.fn().mockResolvedValue({ error: null });
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'profiles') {
          return {
            select: mockProfileSelect,
            insert: jest.fn(() => ({ error: null })),
          };
        }
        return { insert: mockInsert, select: jest.fn() };
      });

      // First request - should query database
      const request1 = new Request('http://localhost/api/events', {
        method: 'POST',
        body: JSON.stringify({ eventType: 'beach_view' }),
      });
      await POST(request1);
      expect(mockProfileSelect).toHaveBeenCalledTimes(1);

      // Second request - should use cache
      const request2 = new Request('http://localhost/api/events', {
        method: 'POST',
        body: JSON.stringify({ eventType: 'beach_view' }),
      });
      await POST(request2);
      // Should still be 1 (cache hit)
      expect(mockProfileSelect).toHaveBeenCalledTimes(1);
    });

    it('defaults to tracking allowed when no profile preference', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-no-pref' } },
        error: null,
      });

      const mockInsert = jest.fn().mockResolvedValue({ error: null });
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'profiles') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                single: jest.fn().mockResolvedValue({
                  data: null, // No profile found
                  error: null,
                }),
              })),
            })),
            insert: jest.fn(() => ({ error: null })),
          };
        }
        return { insert: mockInsert, select: jest.fn() };
      });

      const request = new Request('http://localhost/api/events', {
        method: 'POST',
        body: JSON.stringify({ eventType: 'beach_view' }),
      });

      const response = await POST(request);
      expect(response.status).toBe(200);
      expect(mockInsert).toHaveBeenCalled();
    });

    it('defaults to tracking allowed when allow_implicit_tracking is null', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-null-pref' } },
        error: null,
      });

      const mockInsert = jest.fn().mockResolvedValue({ error: null });
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'profiles') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                single: jest.fn().mockResolvedValue({
                  data: { allow_implicit_tracking: null },
                  error: null,
                }),
              })),
            })),
            insert: jest.fn(() => ({ error: null })),
          };
        }
        return { insert: mockInsert, select: jest.fn() };
      });

      const request = new Request('http://localhost/api/events', {
        method: 'POST',
        body: JSON.stringify({ eventType: 'beach_view' }),
      });

      const response = await POST(request);
      expect(response.status).toBe(200);
      expect(mockInsert).toHaveBeenCalled();
    });
  });

  describe('all valid event types', () => {
    it('accepts all documented valid event types', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-event-types' } },
        error: null,
      });

      const mockInsert = jest.fn().mockResolvedValue({ error: null });
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'profiles') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                single: jest.fn().mockResolvedValue({
                  data: { allow_implicit_tracking: true },
                  error: null,
                }),
              })),
            })),
            insert: jest.fn(() => ({ error: null })),
          };
        }
        return { insert: mockInsert, select: jest.fn() };
      });

      const validEventTypes = [
        'beach_view',
        'discovery_click',
        'discovery_skip',
        'forecast_check',
        'location_update',
        'page_view',
        'forecast_interaction',
        'session_action',
        'profile_update',
        'onboarding_step',
        'cta_click',
      ];

      for (const eventType of validEventTypes) {
        jest.clearAllMocks();

        const request = new Request('http://localhost/api/events', {
          method: 'POST',
          body: JSON.stringify({ eventType }),
        });

        const response = await POST(request);
        expect(response.status).toBe(200);
        expect(mockInsert).toHaveBeenCalledWith({
          user_id: 'user-event-types',
          event_type: eventType,
          beach_id: null,
          metadata: {},
        });
      }
    });
  });

  describe('metadata handling', () => {
    it('stores complex metadata objects', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-metadata' } },
        error: null,
      });

      const mockInsert = jest.fn().mockResolvedValue({ error: null });
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'profiles') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                single: jest.fn().mockResolvedValue({
                  data: { allow_implicit_tracking: true },
                  error: null,
                }),
              })),
            })),
            insert: jest.fn(() => ({ error: null })),
          };
        }
        return { insert: mockInsert, select: jest.fn() };
      });

      const complexMetadata = {
        position: 0,
        score_shown: 95,
        alternatives_count: 5,
        session_id: 'abc-123',
        nested: {
          key1: 'value1',
          key2: 42,
        },
      };

      const request = new Request('http://localhost/api/events', {
        method: 'POST',
        body: JSON.stringify({
          eventType: 'discovery_click',
          beachId: 'beach-789',
          metadata: complexMetadata,
        }),
      });

      await POST(request);

      expect(mockInsert).toHaveBeenCalledWith({
        user_id: 'user-metadata',
        event_type: 'discovery_click',
        beach_id: 'beach-789',
        metadata: complexMetadata,
      });
    });

    it('handles empty metadata gracefully', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-empty-meta' } },
        error: null,
      });

      const mockInsert = jest.fn().mockResolvedValue({ error: null });
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'profiles') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                single: jest.fn().mockResolvedValue({
                  data: { allow_implicit_tracking: true },
                  error: null,
                }),
              })),
            })),
            insert: jest.fn(() => ({ error: null })),
          };
        }
        return { insert: mockInsert, select: jest.fn() };
      });

      const request = new Request('http://localhost/api/events', {
        method: 'POST',
        body: JSON.stringify({
          eventType: 'beach_view',
          metadata: {},
        }),
      });

      await POST(request);

      expect(mockInsert).toHaveBeenCalledWith({
        user_id: 'user-empty-meta',
        event_type: 'beach_view',
        beach_id: null,
        metadata: {},
      });
    });
  });
});
