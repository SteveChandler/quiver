/**
 * @jest-environment node
 *
 * Tests for POST /api/events
 *
 * This route records user behavioral events for implicit preference learning.
 * It respects user privacy settings (allow_implicit_tracking).
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { POST as _POST } from '@/app/api/events/route';
// Tests call POST with a plain Request for brevity; the real signature is
// NextRequest. Cast to loosen for the test harness only.
const POST = _POST as unknown as (req: Request, ctx?: any) => Promise<Response>;
import { __clearTrackingCache } from '@/lib/services/tracking-cache';
import { createServiceRoleClient } from '@/lib/supabase';

jest.mock('@/lib/supabase', () => ({
  createServiceRoleClient: jest.fn(),
}));

// Route is now withAuth({ optional: true }). The wrapper reads the user
// from `mockSupabaseClient.auth.getUser()` and passes the same client
// into the handler as `supabase`. Insert/profile lookups go through this
// client, matching the legacy createAPIServerClient-based test shape.
jest.mock('@/lib/middleware/api-wrappers', () => {
  const actual = jest.requireActual('@/lib/middleware/api-wrappers');
  return {
    ...actual,
    withAuth:
      (handler: any, options: any = {}) =>
      async (request: any, context: any) => {
        const { data, error } = await mockSupabase.auth.getUser();
        const user = error ? null : data?.user ?? null;
        if (!options.optional && !user) {
          return actual.createAuthError(
            options.authErrorMessage ?? 'Authentication required'
          );
        }
        const resolvedParams = context?.params
          ? typeof context.params === 'object' && 'then' in context.params
            ? await context.params
            : context.params
          : {};
        return await handler(request, {
          params: resolvedParams,
          user,
          supabase: mockSupabase,
        });
      },
  };
});

const mockAnalyticsConsentRpc = jest.fn().mockResolvedValue({
  data: true,
  error: null,
});

const mockSupabase = {
  auth: {
    getUser: jest.fn(),
  },
  rpc: mockAnalyticsConsentRpc,
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

/**
 * Default headers that simulate a real browser request.
 * The bot-filtering layer checks for Accept-Language (real browsers always send it)
 * and a plausible User-Agent. Tests that should reach the application logic need these.
 */
const BROWSER_HEADERS = {
  'Content-Type': 'application/json',
  'Accept-Language': 'en-US,en;q=0.9',
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
};

describe('POST /api/events', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAnalyticsConsentRpc.mockResolvedValue({ data: true, error: null });
    __clearTrackingCache(); // Clear the in-memory cache between tests
  });

  it('uses the shared API wrapper module for response helpers', () => {
    const source = readFileSync(
      join(process.cwd(), 'app/api/events/route.ts'),
      'utf8'
    );

    expect(source).not.toMatch(/@\/lib\/api-utils/);
    expect(source).toMatch(/@\/lib\/middleware\/api-wrappers/);
  });

  it('returns 401 for unauthenticated requests', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'Not authenticated' },
    });

    const request = new Request('http://localhost/api/events', {
      method: 'POST',
      headers: BROWSER_HEADERS,
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
      headers: BROWSER_HEADERS,
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
    mockAnalyticsConsentRpc.mockResolvedValueOnce({
      data: false,
      error: null,
    });

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
      headers: BROWSER_HEADERS,
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
      headers: BROWSER_HEADERS,
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
      metadata: expect.objectContaining({ duration_ms: 5000, _device: expect.any(Object) }),
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
      headers: BROWSER_HEADERS,
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
      headers: BROWSER_HEADERS,
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
      headers: BROWSER_HEADERS,
      body: JSON.stringify({
        eventType: 'beach_view',
        beachId: '123',
      }),
    });

    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    try {
      const response = await POST(request);

      expect(response.status).toBe(500);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error inserting event:',
        { message: 'Database error' }
      );
    } finally {
      consoleErrorSpy.mockRestore();
    }
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
        headers: BROWSER_HEADERS,
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
      headers: BROWSER_HEADERS,
      body: JSON.stringify({ eventType: 'location_update' }),
    });

    await POST(request);

    expect(mockInsert).toHaveBeenCalledWith({
      user_id: 'user-123',
      event_type: 'location_update',
      beach_id: null,
      metadata: expect.objectContaining({ _device: expect.any(Object) }),
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
          headers: BROWSER_HEADERS,
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
          headers: BROWSER_HEADERS,
          body: JSON.stringify({ eventType: 'beach_view', beachId: `beach-${i}` }),
        });

        const response = await POST(request);
        expect(response.status).toBe(200);
      }

      // 61st request should be rate limited
      const rateLimitedRequest = new Request('http://localhost/api/events', {
        method: 'POST',
        headers: BROWSER_HEADERS,
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
          headers: BROWSER_HEADERS,
          body: JSON.stringify({ eventType: 'beach_view' }),
        });
        await POST(request);
      }

      // Check headers on rate-limited response
      const request = new Request('http://localhost/api/events', {
        method: 'POST',
        headers: BROWSER_HEADERS,
        body: JSON.stringify({ eventType: 'beach_view' }),
      });

      const response = await POST(request);

      expect(response.headers.get('X-RateLimit-Limit')).toBe('60');
      expect(response.headers.get('X-RateLimit-Remaining')).toBe('0');
      const rateLimitReset = response.headers.get('X-RateLimit-Reset');
      const retryAfterHeader = response.headers.get('Retry-After');
      expect(rateLimitReset).not.toBeNull();
      expect(retryAfterHeader).not.toBeNull();

      // Verify Retry-After is a positive number
      const retryAfter = parseInt(retryAfterHeader || '0', 10);
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
          headers: BROWSER_HEADERS,
          body: JSON.stringify({ eventType: 'beach_view' }),
        });
        await POST(request);
      }

      // User 1 should be rate limited
      const user1Request = new Request('http://localhost/api/events', {
        method: 'POST',
        headers: BROWSER_HEADERS,
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
        headers: BROWSER_HEADERS,
        body: JSON.stringify({ eventType: 'beach_view' }),
      });
      const user2Response = await POST(user2Request);
      expect(user2Response.status).toBe(200);
    });
  });

  describe('tracking cache integration', () => {
    it('rechecks an allowed preference so revocation takes effect immediately', async () => {
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

      mockAnalyticsConsentRpc
        .mockResolvedValueOnce({ data: true, error: null })
        .mockResolvedValueOnce({ data: false, error: null });

      const request1 = new Request('http://localhost/api/events', {
        method: 'POST',
        headers: BROWSER_HEADERS,
        body: JSON.stringify({ eventType: 'beach_view' }),
      });
      const response1 = await POST(request1);
      expect(response1.status).toBe(200);
      expect(mockAnalyticsConsentRpc).toHaveBeenCalledTimes(1);
      expect(mockInsert).toHaveBeenCalledTimes(1);

      const request2 = new Request('http://localhost/api/events', {
        method: 'POST',
        headers: BROWSER_HEADERS,
        body: JSON.stringify({ eventType: 'beach_view' }),
      });
      const response2 = await POST(request2);
      const data2 = await response2.json();

      expect(response2.status).toBe(200);
      expect(data2.data.status).toBe('tracking_disabled');
      expect(mockAnalyticsConsentRpc).toHaveBeenCalledTimes(2);
      expect(mockInsert).toHaveBeenCalledTimes(1);
    });

    it('caches a disabled preference without retaining positive consent', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-disabled-cache-test' } },
        error: null,
      });
      mockAnalyticsConsentRpc.mockResolvedValue({ data: false, error: null });

      const request1 = new Request('http://localhost/api/events', {
        method: 'POST',
        headers: BROWSER_HEADERS,
        body: JSON.stringify({ eventType: 'beach_view' }),
      });
      const request2 = new Request('http://localhost/api/events', {
        method: 'POST',
        headers: BROWSER_HEADERS,
        body: JSON.stringify({ eventType: 'beach_view' }),
      });

      await POST(request1);
      await POST(request2);

      expect(mockAnalyticsConsentRpc).toHaveBeenCalledTimes(1);
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
        headers: BROWSER_HEADERS,
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
        headers: BROWSER_HEADERS,
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
        // Review tracking events
        'review_form_open',
        'review_form_abandon',
        'review_validation_error',
        'review_submit',
        // Share tracking events
        'share_started',
        'share_completed',
        'share_link_opened',
        'share_link_copied',
        'share_image_saved',
        'cam_share',
        'share_intel_button_clicked',
        'share_intel_signin_prompt',
        'surf_plan_share',
        // Invite acquisition funnel events
        'invite_link_opened',
        'invite_open_app_clicked',
        'invite_app_store_clicked',
        'invite_continue_web_clicked',
        'invite_consumed',
        // Signup/auth conversion events (pre-auth-only events excluded — tested separately)
        // Note: signin_cta_click moved to PRE_AUTH_ONLY_EVENTS, tested in
        // "pre-auth-only events" describe block below.
        // Auth modal funnel events (pre-auth-only events excluded — tested separately)
        'auth_provider_selected',
        // Home screen events
        'home_at_beach_click',
        'home_plan_weekend_click',
        'home_plan_weekend_no_recommendation',
        // Session logging events
        'session_log_start',
        'session_log_form_view',
        'session_log_submit',
        'session_created',
        'session_log_validation_failed',
        'session_spot_search_no_results',
        'session_custom_spot_cta_tapped',
        'session_custom_spot_returned',
        'session_share_opened_post_save',
        'session_share_closed_post_save',
        // Onboarding/tour events
        'product_tour_started',
        'product_tour_completed',
        'product_tour_skipped',
        'product_tour_step_viewed',
        // Beach detail events
        'beach_search',
        'forecast_tab_click',
        'horizon_strip_day_selected',
        'match_score_teaser_click',
        'match_score_teaser_view',
        'set_home_beach',
        'map_marker_click',
        // Intel events
        'local_intel_tab_viewed',
        'intel_post_created',
        'intel_post_confirmed',
        'plan_session_from_intel',
        // Profile events
        'surf_profile_viewed',
        'surf_profile_progress_shown',
        // Discovery events
        'personalized_score_shown',
        'favorite_shown_in_carousel',
        'mini_log_teaser_click',
        'plan_unlock_click',
        // Social events
        'social_follow',
        'social_like',
        'social_invite_send',
        'social_invite_respond',
        'social_intel_confirm',
        // Tab and map engagement events
        'tab_view',
        'map_interaction',
        // Paywall + trial funnel (native)
        'paywall_opened',
        'paywall_dismissed',
        'paywall_purchase_started',
        'paywall_purchase_success',
        'paywall_purchase_failed',
        'paywall_ready',
        'onboarding_paywall_skipped',
        'onboarding_trial_started',
        'push_permission_denied',
        'push_token_fetch_failed',
        'push_device_registration_failed',
        'push_device_registered',
      ];

      const realDateNow = Date.now;
      let timeOffset = 0;
      jest.spyOn(Date, 'now').mockImplementation(() => realDateNow() + timeOffset);

      for (let i = 0; i < validEventTypes.length; i++) {
        const eventType = validEventTypes[i];
        // Advance past rate limit window every 50 events to avoid 429s
        if (i > 0 && i % 50 === 0) {
          timeOffset += 61_000;
        }
        jest.clearAllMocks();

        const request = new Request('http://localhost/api/events', {
          method: 'POST',
          headers: BROWSER_HEADERS,
          body: JSON.stringify({ eventType }),
        });

        const response = await POST(request);
        expect(response.status).toBe(200);
        expect(mockInsert).toHaveBeenCalledWith({
          user_id: 'user-event-types',
          event_type: eventType,
          beach_id: null,
          metadata: expect.objectContaining({ _device: expect.any(Object) }),
        });
      }

      jest.spyOn(Date, 'now').mockRestore();
    });
  });

  describe('pre-auth-only events', () => {
    // PRE_AUTH_ONLY_EVENTS are pre-auth funnel events that should be silently
    // dropped when fired by an authenticated user (shared device, stale tab,
    // nav ghost-render, etc.). Dropping them keeps the funnel measurements
    // honest. See plan vast-dancing-whale for the 584% mismatch this closes.
    const PRE_AUTH_ONLY_EVENTS = [
      'signup_cta_view',
      'signup_cta_click',
      'signin_cta_click',
      'signup_form_submitted',
      'login_form_submitted',
      'login_failed',
      'signup_failed',
      'auth_modal_opened',
      'auth_modal_closed_without_action',
    ];

    it.each(PRE_AUTH_ONLY_EVENTS)(
      'drops %s for authenticated users (returns 200, no insert)',
      async (eventType) => {
        mockSupabase.auth.getUser.mockResolvedValue({
          data: { user: { id: 'user-pre-auth' } },
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
          headers: BROWSER_HEADERS,
          body: JSON.stringify({ eventType }),
        });

        const response = await POST(request);
        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body).toMatchObject({
          success: true,
          data: { ok: true, skipped: true },
        });
        expect(mockInsert).not.toHaveBeenCalled();
      }
    );
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
        headers: BROWSER_HEADERS,
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
        metadata: expect.objectContaining({ ...complexMetadata, _device: expect.any(Object) }),
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
        headers: BROWSER_HEADERS,
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
        metadata: expect.objectContaining({ _device: expect.any(Object) }),
      });
    });
  });

  describe('device enrichment and bot filtering', () => {
    it('enriches metadata with _device info', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-device' } },
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
        headers: BROWSER_HEADERS,
        body: JSON.stringify({ eventType: 'beach_view' }),
      });

      await POST(request);

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            _device: expect.objectContaining({
              device_type: expect.any(String),
              os: expect.any(String),
              browser: expect.any(String),
            }),
          }),
        })
      );
    });

    it('filters bot requests silently via UA pattern', async () => {
      const request = new Request('http://localhost/api/events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept-Language': 'en-US',
          'User-Agent': 'Googlebot/2.1 (+http://www.google.com/bot.html)',
        },
        body: JSON.stringify({ eventType: 'page_view' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.status).toBe('bot_filtered');
    });

    it('filters requests missing Accept-Language header', async () => {
      const request = new Request('http://localhost/api/events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          // No Accept-Language — bot heuristic
        },
        body: JSON.stringify({ eventType: 'page_view' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.status).toBe('bot_filtered');
    });

    it('filters requests with suspiciously short User-Agent', async () => {
      const request = new Request('http://localhost/api/events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept-Language': 'en-US',
          'User-Agent': 'curl/7.0',
        },
        body: JSON.stringify({ eventType: 'page_view' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.status).toBe('bot_filtered');
    });

    it('filters headless browser signatures', async () => {
      const request = new Request('http://localhost/api/events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept-Language': 'en-US',
          'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/113.0.5672.63 Safari/537.36',
        },
        body: JSON.stringify({ eventType: 'page_view' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.status).toBe('bot_filtered');
    });

    it('accepts anonymous events with valid sessionId', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Not authenticated' },
      });

      const mockServiceInsert = jest.fn().mockResolvedValue({ error: null });
      (createServiceRoleClient as jest.Mock).mockReturnValue({
        from: jest.fn(() => ({ insert: mockServiceInsert })),
      });

      const request = new Request('http://localhost/api/events', {
        method: 'POST',
        headers: BROWSER_HEADERS,
        body: JSON.stringify({
          eventType: 'page_view',
          sessionId: '12345678-1234-1234-1234-123456789012',
        }),
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(mockServiceInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: null,
          session_id: '12345678-1234-1234-1234-123456789012',
          event_type: 'page_view',
        })
      );
    });

    it('rejects unsafe metadata for an anonymous BFR event', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Not authenticated' },
      });
      const mockServiceInsert = jest.fn().mockResolvedValue({ error: null });
      (createServiceRoleClient as jest.Mock).mockReturnValue({
        from: jest.fn(() => ({ insert: mockServiceInsert })),
      });

      const request = new Request('http://localhost/api/events', {
        method: 'POST',
        headers: BROWSER_HEADERS,
        body: JSON.stringify({
          eventType: 'beach_follow_saved_local',
          sessionId: '22345678-1234-4234-8234-123456789012',
          metadata: {
            email: 'surfer@example.com',
            lat: 32.1,
            handoff_token: 'secret',
          },
        }),
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
      expect(mockServiceInsert).not.toHaveBeenCalled();
    });

    it('accepts and stores a valid event-specific BFR enum payload', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Not authenticated' },
      });
      const mockServiceInsert = jest.fn().mockResolvedValue({ error: null });
      (createServiceRoleClient as jest.Mock).mockReturnValue({
        from: jest.fn(() => ({ insert: mockServiceInsert })),
      });

      const request = new Request('http://localhost/api/events', {
        method: 'POST',
        headers: BROWSER_HEADERS,
        body: JSON.stringify({
          eventType: 'beach_follow_saved_local',
          sessionId: '32345678-1234-4234-8234-123456789012',
          metadata: {
            audience_class: 'general_utility',
            page_type: 'beach_detail',
            experiment_key: 'bfr-follow-holdout-v1',
            experiment_arm: 'treatment',
            topic: 'surf',
          },
        }),
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(mockServiceInsert).toHaveBeenCalledWith(expect.objectContaining({
        event_type: 'beach_follow_saved_local',
        metadata: expect.objectContaining({
          audience_class: 'general_utility',
          page_type: 'beach_detail',
          experiment_key: 'bfr-follow-holdout-v1',
          experiment_arm: 'treatment',
          topic: 'surf',
        }),
      }));
    });

    it('rejects email-like and token-like values in every BFR string slot', async () => {
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

      const webBase = {
        audience_class: 'general_utility',
        page_type: 'beach_detail',
        experiment_key: 'bfr-follow-holdout-v1',
        experiment_arm: 'treatment',
      };
      const nativeChannel = {
        source: 'exact_call',
        _platform: 'native-ios',
        app_version: '1.2.3+45',
        expo_update_id: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
        expo_channel: 'production',
        expo_runtime_version: '0123456789abcdef0123456789abcdef01234567',
        expo_is_embedded_launch: true,
        expo_is_emergency_launch: false,
        is_emulator: false,
        launch_primer_session_id: '62345678-1234-4234-8234-123456789012',
      };
      const fixtures: Array<{
        eventType: string;
        metadata: Record<string, unknown>;
      }> = [
        {
          eventType: 'beach_follow_started',
          metadata: { ...webBase, topic: 'surf' },
        },
        {
          eventType: 'beach_follow_saved_local',
          metadata: { ...webBase, topic: 'surf' },
        },
        {
          eventType: 'beach_follow_sync_started',
          metadata: { ...webBase, audience_class: 'existing_web_user' },
        },
        {
          eventType: 'beach_follow_sync_completed',
          metadata: { ...webBase, audience_class: 'existing_web_user' },
        },
        {
          eventType: 'follow_topic_changed',
          metadata: { ...webBase, topic: 'surf' },
        },
        {
          eventType: 'visitor_intent_selected',
          metadata: {
            ...webBase,
            intent_state: 'explicit',
            intent_reason: 'explicit_surfing',
          },
        },
        {
          eventType: 'surf_intent_qualified',
          metadata: {
            ...webBase,
            audience_class: 'surf_qualified',
            intent_state: 'inferred',
            intent_reason: 'high_intent_action',
          },
        },
        {
          eventType: 'my_coast_viewed',
          metadata: {
            ...webBase,
            page_type: 'my_coast',
            intent_state: 'unknown',
            intent_reason: 'no_evidence',
          },
        },
        {
          eventType: 'my_coast_beach_opened',
          metadata: {
            ...webBase,
            page_type: 'my_coast',
            intent_state: 'unknown',
            intent_reason: 'no_evidence',
            topic: 'surf',
          },
        },
        {
          eventType: 'app_handoff_link_opened',
          metadata: {
            handoff_id: '33333333-3333-4333-8333-333333333333',
            source: 'exact_call',
            surface: 'beach_detail',
            placement: 'exact_call',
            platform: 'ios',
            handoff_context: 'exact_call',
            fallback_classification: 'invalid',
            reason: 'malformed',
            cta_family: 'app_handoff',
            page_type: 'other',
            query_intent: 'other',
          },
        },
        {
          eventType: 'app_handoff_native_open',
          metadata: {
            handoff_id: '33333333-3333-4333-8333-333333333333',
            ...nativeChannel,
            surface: 'beach_detail',
            placement: 'exact_call',
            handoff_context: 'exact_call',
          },
        },
        {
          eventType: 'watched_call_context_resolved',
          metadata: {
            handoff_id: '33333333-3333-4333-8333-333333333333',
            fallback_classification: 'invalid',
            reason: 'malformed',
            ...nativeChannel,
            source: 'launch-primer',
          },
        },
      ];
      const forbiddenValues = ['surfer@example.com', 'Bearer secret-token'];
      const failures: string[] = [];
      let caseIndex = 0;

      for (const fixture of fixtures) {
        caseIndex += 1;
        mockSupabase.auth.getUser.mockResolvedValue({
          data: { user: { id: `bfr-string-slot-${caseIndex}` } },
          error: null,
        });
        const baselineResponse = await POST(new Request(
          'http://localhost/api/events',
          {
            method: 'POST',
            headers: BROWSER_HEADERS,
            body: JSON.stringify(fixture),
          }
        ));
        if (baselineResponse.status !== 200) {
          failures.push(
            `${fixture.eventType} baseline returned ${baselineResponse.status}`
          );
        }

        const stringKeys = Object.entries(fixture.metadata)
          .filter(([, value]) => typeof value === 'string')
          .map(([key]) => key);
        for (const key of stringKeys) {
          for (const forbiddenValue of forbiddenValues) {
            caseIndex += 1;
            mockSupabase.auth.getUser.mockResolvedValue({
              data: { user: { id: `bfr-string-slot-${caseIndex}` } },
              error: null,
            });
            const request = new Request('http://localhost/api/events', {
              method: 'POST',
              headers: BROWSER_HEADERS,
              body: JSON.stringify({
                eventType: fixture.eventType,
                metadata: { ...fixture.metadata, [key]: forbiddenValue },
              }),
            });

            const response = await POST(request);
            if (response.status !== 400) {
              failures.push(
                `${fixture.eventType}.${key} accepted ${JSON.stringify(forbiddenValue)} with ${response.status}`
              );
            }
          }
        }
      }

      expect(failures).toEqual([]);
    });

    it('rejects secret-token in every exact-call channel and runtime slot', async () => {
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
      const nativeOpen = {
        handoff_id: '33333333-3333-4333-8333-333333333333',
        source: 'exact_call',
        surface: 'beach_detail',
        placement: 'exact_call',
        handoff_context: 'exact_call',
        expo_channel: 'production',
        expo_runtime_version: '0123456789abcdef0123456789abcdef01234567',
      };
      const resolution = {
        handoff_id: '33333333-3333-4333-8333-333333333333',
        fallback_classification: 'exact',
        source: 'launch-primer',
        expo_channel: 'production',
        expo_runtime_version: '0123456789abcdef0123456789abcdef01234567',
      };
      const failures: string[] = [];
      let caseIndex = 0;

      for (const fixture of [
        { eventType: 'app_handoff_native_open', metadata: nativeOpen },
        { eventType: 'watched_call_context_resolved', metadata: resolution },
      ]) {
        for (const key of ['source', 'expo_channel', 'expo_runtime_version']) {
          caseIndex += 1;
          mockSupabase.auth.getUser.mockResolvedValue({
            data: { user: { id: `closed-channel-${caseIndex}` } },
            error: null,
          });
          const response = await POST(new Request('http://localhost/api/events', {
            method: 'POST',
            headers: BROWSER_HEADERS,
            body: JSON.stringify({
              eventType: fixture.eventType,
              metadata: { ...fixture.metadata, [key]: 'secret-token' },
            }),
          }));
          if (response.status !== 400) {
            failures.push(`${fixture.eventType}.${key} returned ${response.status}`);
          }
        }
      }

      expect(failures).toEqual([]);
      expect(mockInsert).not.toHaveBeenCalled();
    });

    it('preserves the real legacy native first-open payload with launch-primer enrichment', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Not authenticated' },
      });
      const mockServiceInsert = jest.fn().mockResolvedValue({ error: null });
      (createServiceRoleClient as jest.Mock).mockReturnValue({
        from: jest.fn(() => ({ insert: mockServiceInsert })),
      });
      const sessionId = '92345678-1234-4234-8234-123456789012';
      const metadata = {
        source: 'native_app',
        native_install_id: sessionId,
        build: '42',
        platform: 'ios',
        os_version: '18.3',
        device_model_class: 'iPhone',
        device_type: '1',
        device_year_class: 2024,
        install_attribution_outcome: 'unavailable',
        _platform: 'native-ios',
        app_version: '1.0.2',
        expo_update_id: null,
        expo_channel: 'production',
        expo_runtime_version:
          '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
        expo_is_embedded_launch: true,
        expo_is_emergency_launch: false,
        is_emulator: false,
        launch_primer_session_id: sessionId,
      };

      const response = await POST(new Request('http://localhost/api/events', {
        method: 'POST',
        headers: BROWSER_HEADERS,
        body: JSON.stringify({
          eventType: 'native_app_first_open',
          sessionId,
          metadata,
        }),
      }));

      expect(response.status).toBe(200);
      expect(mockServiceInsert).toHaveBeenCalledWith(expect.objectContaining({
        event_type: 'native_app_first_open',
        metadata: expect.objectContaining(metadata),
      }));
    });

    it('preserves the real legacy app-handoff view payload with a plain handoff ID', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Not authenticated' },
      });
      const mockServiceInsert = jest.fn().mockResolvedValue({ error: null });
      (createServiceRoleClient as jest.Mock).mockReturnValue({
        from: jest.fn(() => ({ insert: mockServiceInsert })),
      });
      const metadata = {
        cta_family: 'app_handoff',
        page_type: 'other',
        query_intent: 'other',
        seo_landing_page: false,
        source: 'landing_hero',
        surface: 'landing-page',
        placement: 'hero_primary',
        handoff_id: '33333333-3333-4333-8333-333333333333',
        platform: 'desktop',
      };

      const response = await POST(new Request('http://localhost/api/events', {
        method: 'POST',
        headers: BROWSER_HEADERS,
        body: JSON.stringify({
          eventType: 'app_handoff_view',
          sessionId: 'a2345678-1234-4234-8234-123456789012',
          metadata,
        }),
      }));

      expect(response.status).toBe(200);
      expect(mockServiceInsert).toHaveBeenCalledWith(expect.objectContaining({
        event_type: 'app_handoff_view',
        metadata: expect.objectContaining(metadata),
      }));
    });

    it('rejects the exact F27 bypass payload before the legacy path', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Not authenticated' },
      });
      const mockServiceInsert = jest.fn().mockResolvedValue({ error: null });
      (createServiceRoleClient as jest.Mock).mockReturnValue({
        from: jest.fn(() => ({ insert: mockServiceInsert })),
      });

      const response = await POST(new Request('http://localhost/api/events', {
        method: 'POST',
        headers: BROWSER_HEADERS,
        body: JSON.stringify({
          eventType: 'app_handoff_native_open',
          sessionId: '42345678-1234-4234-8234-123456789012',
          metadata: {
            handoff_id: '33333333-3333-4333-8333-333333333333',
            source: 'exact_call',
            expo_channel: 'secret-token',
            email: 'surfer@example.com',
          },
        }),
      }));

      expect(response.status).toBe(400);
      expect(mockServiceInsert).not.toHaveBeenCalled();
    });

    it('rejects unreviewed exact-call receipt metadata', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Not authenticated' },
      });
      const mockServiceInsert = jest.fn().mockResolvedValue({ error: null });
      (createServiceRoleClient as jest.Mock).mockReturnValue({
        from: jest.fn(() => ({ insert: mockServiceInsert })),
      });

      const request = new Request('http://localhost/api/events', {
        method: 'POST',
        headers: BROWSER_HEADERS,
        body: JSON.stringify({
          eventType: 'app_handoff_native_open',
          sessionId: '42345678-1234-4234-8234-123456789012',
          metadata: {
            handoff_id: '33333333-3333-4333-8333-333333333333',
            source: 'exact_call',
            surface: 'beach_detail',
            placement: 'exact_call',
            handoff_context: 'exact_call',
            email: 'surfer@example.com',
          },
        }),
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
      expect(mockServiceInsert).not.toHaveBeenCalled();
    });

    it('accepts the bounded native exact-call receipt shape', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Not authenticated' },
      });
      const mockServiceInsert = jest.fn().mockResolvedValue({ error: null });
      (createServiceRoleClient as jest.Mock).mockReturnValue({
        from: jest.fn(() => ({ insert: mockServiceInsert })),
      });

      const request = new Request('http://localhost/api/events', {
        method: 'POST',
        headers: BROWSER_HEADERS,
        body: JSON.stringify({
          eventType: 'app_handoff_native_open',
          sessionId: '62345678-1234-4234-8234-123456789012',
          metadata: {
            handoff_id: '33333333-3333-4333-8333-333333333333',
            source: 'exact_call',
            surface: 'beach_detail',
            placement: 'exact_call',
            handoff_context: 'exact_call',
            _platform: 'native-ios',
            app_version: '1.0.2',
            expo_update_id: null,
            expo_channel: 'production',
            expo_runtime_version: '0123456789abcdef0123456789abcdef01234567',
            expo_is_embedded_launch: true,
            expo_is_emergency_launch: false,
            is_emulator: false,
            launch_primer_session_id:
              '62345678-1234-4234-8234-123456789012',
          },
        }),
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(mockServiceInsert).toHaveBeenCalledWith(expect.objectContaining({
        event_type: 'app_handoff_native_open',
        metadata: expect.objectContaining({
          handoff_id: '33333333-3333-4333-8333-333333333333',
          handoff_context: 'exact_call',
        }),
      }));
    });

    it('accepts the bounded web exact-call start shape', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Not authenticated' },
      });
      const mockServiceInsert = jest.fn().mockResolvedValue({ error: null });
      (createServiceRoleClient as jest.Mock).mockReturnValue({
        from: jest.fn(() => ({ insert: mockServiceInsert })),
      });

      const request = new Request('http://localhost/api/events', {
        method: 'POST',
        headers: BROWSER_HEADERS,
        body: JSON.stringify({
          eventType: 'app_handoff_link_opened',
          sessionId: '82345678-1234-4234-8234-123456789012',
          metadata: {
            handoff_id: '33333333-3333-4333-8333-333333333333',
            source: 'exact_call',
            surface: 'beach_detail',
            handoff_context: 'exact_call',
            fallback_classification: 'exact',
            cta_family: 'app_handoff',
            page_type: 'other',
            query_intent: 'other',
            seo_landing_page: false,
            viewport_width: 390,
          },
        }),
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(mockServiceInsert).toHaveBeenCalledWith(expect.objectContaining({
        event_type: 'app_handoff_link_opened',
        metadata: expect.objectContaining({
          handoff_id: '33333333-3333-4333-8333-333333333333',
          fallback_classification: 'exact',
        }),
      }));
    });

    it('accepts a valid anonymous watched-call resolution payload', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Not authenticated' },
      });
      const mockServiceInsert = jest.fn().mockResolvedValue({ error: null });
      (createServiceRoleClient as jest.Mock).mockReturnValue({
        from: jest.fn(() => ({ insert: mockServiceInsert })),
      });

      const request = new Request('http://localhost/api/events', {
        method: 'POST',
        headers: BROWSER_HEADERS,
        body: JSON.stringify({
          eventType: 'watched_call_context_resolved',
          sessionId: '52345678-1234-4234-8234-123456789012',
          metadata: {
            handoff_id: '33333333-3333-4333-8333-333333333333',
            fallback_classification: 'beach_only',
            reason: 'expired',
            source: 'launch-primer',
            _platform: 'native-ios',
            app_version: '1.0.2',
            expo_update_id: null,
            expo_channel: 'production',
            expo_runtime_version:
              '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
            expo_is_embedded_launch: true,
            expo_is_emergency_launch: false,
            is_emulator: false,
            launch_primer_session_id:
              '52345678-1234-4234-8234-123456789012',
          },
        }),
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(mockServiceInsert).toHaveBeenCalledWith(expect.objectContaining({
        event_type: 'watched_call_context_resolved',
        metadata: expect.objectContaining({
          handoff_id: '33333333-3333-4333-8333-333333333333',
          fallback_classification: 'beach_only',
          reason: 'expired',
        }),
      }));
    });

    it('rejects an impossible watched-call classification and reason pair', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Not authenticated' },
      });
      const mockServiceInsert = jest.fn().mockResolvedValue({ error: null });
      (createServiceRoleClient as jest.Mock).mockReturnValue({
        from: jest.fn(() => ({ insert: mockServiceInsert })),
      });

      const request = new Request('http://localhost/api/events', {
        method: 'POST',
        headers: BROWSER_HEADERS,
        body: JSON.stringify({
          eventType: 'watched_call_context_resolved',
          sessionId: '72345678-1234-4234-8234-123456789012',
          metadata: {
            handoff_id: '33333333-3333-4333-8333-333333333333',
            fallback_classification: 'exact',
            reason: 'expired',
          },
        }),
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
      expect(mockServiceInsert).not.toHaveBeenCalled();
    });

    it('accepts anonymous cam share events with visitor context', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Not authenticated' },
      });

      const mockServiceInsert = jest.fn().mockResolvedValue({ error: null });
      (createServiceRoleClient as jest.Mock).mockReturnValue({
        from: jest.fn(() => ({ insert: mockServiceInsert })),
      });

      const request = new Request('http://localhost/api/events', {
        method: 'POST',
        headers: BROWSER_HEADERS,
        body: JSON.stringify({
          eventType: 'cam_share',
          sessionId: '12345678-1234-1234-1234-123456789012',
          viewportWidth: 390,
          metadata: {
            content_type: 'cam',
            method: 'native_share',
          },
        }),
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(mockServiceInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: null,
          session_id: '12345678-1234-1234-1234-123456789012',
          event_type: 'cam_share',
          metadata: expect.objectContaining({
            content_type: 'cam',
            method: 'native_share',
            _viewport_width: 390,
          }),
        })
      );
    });

    it('accepts anonymous invite CTA events with token_hash metadata', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Not authenticated' },
      });

      const mockServiceInsert = jest.fn().mockResolvedValue({ error: null });
      (createServiceRoleClient as jest.Mock).mockReturnValue({
        from: jest.fn(() => ({ insert: mockServiceInsert })),
      });

      const request = new Request('http://localhost/api/events', {
        method: 'POST',
        headers: BROWSER_HEADERS,
        body: JSON.stringify({
          eventType: 'invite_app_store_clicked',
          sessionId: '12345678-1234-1234-1234-123456789012',
          metadata: {
            token_hash: 'hash-1',
            inviter_id: 'inviter-id',
            surface: 'invite_landing',
            destination_type: 'app_store',
            browser_session_id: 'browser-session-1',
            platform: 'ios',
          },
        }),
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(mockServiceInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: null,
          session_id: '12345678-1234-1234-1234-123456789012',
          event_type: 'invite_app_store_clicked',
          metadata: expect.objectContaining({
            token_hash: 'hash-1',
            destination_type: 'app_store',
          }),
        }),
      );
    });

    it('rejects non-allowed event types for anonymous users', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Not authenticated' },
      });

      const request = new Request('http://localhost/api/events', {
        method: 'POST',
        headers: BROWSER_HEADERS,
        body: JSON.stringify({
          eventType: 'session_log_submit',
          sessionId: '12345678-1234-1234-1234-123456789012',
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(400);
    });

    it('returns 401 when neither auth nor sessionId', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Not authenticated' },
      });

      const request = new Request('http://localhost/api/events', {
        method: 'POST',
        headers: BROWSER_HEADERS,
        body: JSON.stringify({ eventType: 'page_view' }),
      });

      const response = await POST(request);
      expect(response.status).toBe(401);
    });
  });
});
