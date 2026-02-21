/**
 * @jest-environment node
 *
 * Tests for POST /api/embed-impressions
 *
 * This route records anonymous embed widget impressions for outreach analytics.
 * No auth required — embed visitors are anonymous.
 */

import { POST } from '@/app/api/embed-impressions/route';
import { createSupabaseServiceRoleClient } from '@/lib/supabase/server';

// Mock service role client
jest.mock('@/lib/supabase/server', () => ({
  createSupabaseServiceRoleClient: jest.fn(),
}));

const mockInsert = jest.fn().mockReturnValue({ error: null });
const mockSupabase = {
  from: jest.fn(() => ({
    insert: mockInsert,
  })),
};

function makeRequest(
  body: unknown,
  headers: Record<string, string> = {}
): Request {
  return new Request('http://localhost/api/embed-impressions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-forwarded-for': `${Math.random().toString(36).slice(2)}.1.1.1`,
      ...headers,
    },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

describe('POST /api/embed-impressions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (createSupabaseServiceRoleClient as jest.Mock).mockReturnValue(mockSupabase);
    mockInsert.mockReturnValue({ error: null });
  });

  // ===========================================================================
  // Happy path
  // ===========================================================================

  it('returns 204 for valid tides impression', async () => {
    const request = makeRequest({ widgetType: 'tides', beachSlug: 'swamis' });
    const response = await POST(request);

    expect(response.status).toBe(204);
    expect(mockInsert).toHaveBeenCalledWith({
      widget_type: 'tides',
      beach_slug: 'swamis',
      referrer_domain: null,
    });
  });

  it('returns 204 for valid conditions impression', async () => {
    const request = makeRequest({ widgetType: 'conditions', beachSlug: 'blacks' });
    const response = await POST(request);

    expect(response.status).toBe(204);
    expect(mockInsert).toHaveBeenCalledWith({
      widget_type: 'conditions',
      beach_slug: 'blacks',
      referrer_domain: null,
    });
  });

  it('returns 204 for valid surf-terminal impression', async () => {
    const request = makeRequest({ widgetType: 'surf-terminal', beachSlug: 'blacks' });
    const response = await POST(request);

    expect(response.status).toBe(204);
    expect(mockInsert).toHaveBeenCalledWith({
      widget_type: 'surf-terminal',
      beach_slug: 'blacks',
      referrer_domain: null,
    });
  });

  it('returns 204 for valid ticker impression', async () => {
    const request = makeRequest({ widgetType: 'ticker', beachSlug: 'trestles' });
    const response = await POST(request);

    expect(response.status).toBe(204);
    expect(mockInsert).toHaveBeenCalledWith({
      widget_type: 'ticker',
      beach_slug: 'trestles',
      referrer_domain: null,
    });
  });

  it('includes security headers on 204 response', async () => {
    const request = makeRequest({ widgetType: 'tides', beachSlug: 'swamis' });
    const response = await POST(request);

    expect(response.status).toBe(204);
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(response.headers.get('Strict-Transport-Security')).toBeTruthy();
  });

  // ===========================================================================
  // Referrer extraction
  // ===========================================================================

  it('extracts referrer domain from Referer header', async () => {
    const request = makeRequest(
      { widgetType: 'tides', beachSlug: 'swamis' },
      { referer: 'https://birdsrocksurf.com/tide-info' }
    );
    const response = await POST(request);

    expect(response.status).toBe(204);
    expect(mockInsert).toHaveBeenCalledWith({
      widget_type: 'tides',
      beach_slug: 'swamis',
      referrer_domain: 'birdsrocksurf.com',
    });
  });

  it('sets referrer_domain to null when no Referer header', async () => {
    const request = makeRequest({ widgetType: 'tides', beachSlug: 'swamis' });
    const response = await POST(request);

    expect(response.status).toBe(204);
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ referrer_domain: null })
    );
  });

  it('handles malformed Referer header gracefully', async () => {
    const request = makeRequest(
      { widgetType: 'tides', beachSlug: 'swamis' },
      { referer: 'not-a-valid-url' }
    );
    const response = await POST(request);

    expect(response.status).toBe(204);
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ referrer_domain: null })
    );
  });

  // ===========================================================================
  // Validation
  // ===========================================================================

  it('returns 400 for invalid widgetType', async () => {
    const request = makeRequest({ widgetType: 'invalid', beachSlug: 'swamis' });
    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it('returns 400 for missing widgetType', async () => {
    const request = makeRequest({ beachSlug: 'swamis' });
    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it('returns 400 for missing beachSlug', async () => {
    const request = makeRequest({ widgetType: 'tides' });
    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it('returns 400 for beachSlug with invalid characters', async () => {
    const request = makeRequest({ widgetType: 'tides', beachSlug: 'Beach Name!' });
    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it('returns 400 for beachSlug exceeding max length', async () => {
    const longSlug = 'a'.repeat(201);
    const request = makeRequest({ widgetType: 'tides', beachSlug: longSlug });
    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it('accepts beachSlug at max length', async () => {
    const maxSlug = 'a'.repeat(200);
    const request = makeRequest({ widgetType: 'tides', beachSlug: maxSlug });
    const response = await POST(request);
    expect(response.status).toBe(204);
  });

  it('returns 400 for invalid JSON body', async () => {
    const request = makeRequest('not valid json');
    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  // ===========================================================================
  // Rate limiting
  // ===========================================================================

  it('allows requests under rate limit', async () => {
    const ip = '10.0.0.1';
    for (let i = 0; i < 5; i++) {
      const request = makeRequest(
        { widgetType: 'tides', beachSlug: 'swamis' },
        { 'x-forwarded-for': ip }
      );
      const response = await POST(request);
      expect(response.status).toBe(204);
    }
    expect(mockInsert).toHaveBeenCalledTimes(5);
  });

  it('returns 429 when rate limit exceeded', async () => {
    const ip = '10.0.0.99';

    // Send 30 requests (at the limit)
    for (let i = 0; i < 30; i++) {
      const request = makeRequest(
        { widgetType: 'tides', beachSlug: 'swamis' },
        { 'x-forwarded-for': ip }
      );
      const response = await POST(request);
      expect(response.status).toBe(204);
    }

    // 31st request should be rate limited
    const request = makeRequest(
      { widgetType: 'tides', beachSlug: 'swamis' },
      { 'x-forwarded-for': ip }
    );
    const response = await POST(request);
    expect(response.status).toBe(429);
  });

  it('includes security headers on 429 response', async () => {
    const ip = '10.0.0.100';

    // Exhaust rate limit
    for (let i = 0; i < 30; i++) {
      await POST(
        makeRequest(
          { widgetType: 'tides', beachSlug: 'swamis' },
          { 'x-forwarded-for': ip }
        )
      );
    }

    const response = await POST(
      makeRequest(
        { widgetType: 'tides', beachSlug: 'swamis' },
        { 'x-forwarded-for': ip }
      )
    );
    expect(response.status).toBe(429);
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(response.headers.get('Strict-Transport-Security')).toBeTruthy();
  });

  it('isolates rate limits per IP', async () => {
    const ip1 = '10.0.0.201';
    const ip2 = '10.0.0.202';

    // Exhaust IP 1
    for (let i = 0; i < 30; i++) {
      await POST(
        makeRequest(
          { widgetType: 'tides', beachSlug: 'swamis' },
          { 'x-forwarded-for': ip1 }
        )
      );
    }

    // IP 1 should be rate limited
    const response1 = await POST(
      makeRequest(
        { widgetType: 'tides', beachSlug: 'swamis' },
        { 'x-forwarded-for': ip1 }
      )
    );
    expect(response1.status).toBe(429);

    // IP 2 should still be allowed
    const response2 = await POST(
      makeRequest(
        { widgetType: 'tides', beachSlug: 'swamis' },
        { 'x-forwarded-for': ip2 }
      )
    );
    expect(response2.status).toBe(204);
  });

  // ===========================================================================
  // Error handling
  // ===========================================================================

  it('returns 500 when database insert fails', async () => {
    mockInsert.mockReturnValue({ error: { message: 'Database error' } });

    const request = makeRequest({ widgetType: 'tides', beachSlug: 'swamis' });
    const response = await POST(request);
    expect(response.status).toBe(500);
  });

  it('returns 500 when service role client throws', async () => {
    (createSupabaseServiceRoleClient as jest.Mock).mockImplementation(() => {
      throw new Error('Missing env vars');
    });

    const request = makeRequest({ widgetType: 'tides', beachSlug: 'swamis' });
    const response = await POST(request);
    expect(response.status).toBe(500);
  });
});
