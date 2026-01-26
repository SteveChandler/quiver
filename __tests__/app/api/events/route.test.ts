/**
 * @jest-environment node
 *
 * Tests for POST /api/events
 *
 * This route records user behavioral events for implicit preference learning.
 * It respects user privacy settings (allow_implicit_tracking).
 */

import { POST, __clearTrackingCache } from '@/app/api/events/route';
import { createAPIServerClient } from '@/lib/supabase/server';

// Mock Supabase client
jest.mock('@/lib/supabase/server', () => ({
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
});
