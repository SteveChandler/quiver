/**
 * @jest-environment node
 *
 * Tests for /api/prefs/set route
 *
 * This route handles 1-tap preference updates from email buttons.
 * It verifies the token and updates the user's preferences.
 */

import { NextRequest } from 'next/server';
import { signEmailToken } from '@/lib/utils/email-token';

// Mock Supabase - using service role client since email links are clicked without auth session
const mockUpsert = jest.fn().mockResolvedValue({ error: null });
jest.mock('@/lib/supabase/server', () => ({
  createSupabaseServiceRoleClient: jest.fn(() => ({
    from: jest.fn(() => ({
      upsert: mockUpsert,
    })),
  })),
}));

// Mock environment
const TEST_SECRET = 'test-secret-key-that-is-at-least-32-characters-long';

describe('GET /api/prefs/set', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.EMAIL_TOKEN_SECRET = TEST_SECRET;
  });

  afterEach(() => {
    delete process.env.EMAIL_TOKEN_SECRET;
  });

  it('returns error for missing token', async () => {
    const { GET } = await import('@/app/api/prefs/set/route');
    const request = new NextRequest('http://localhost:3000/api/prefs/set?time=dawn');
    const response = await GET(request);

    expect(response.status).toBe(400);
    const html = await response.text();
    expect(html).toContain('Missing');
  });

  it('returns error for invalid token', async () => {
    const { GET } = await import('@/app/api/prefs/set/route');
    const request = new NextRequest(
      'http://localhost:3000/api/prefs/set?time=dawn&token=invalid'
    );
    const response = await GET(request);

    expect(response.status).toBe(400);
    const html = await response.text();
    expect(html).toContain('Invalid');
  });

  it('updates time preference with valid token', async () => {
    const { GET } = await import('@/app/api/prefs/set/route');
    const token = await signEmailToken(
      { user_id: 'user-123', purpose: 'prefs' },
      TEST_SECRET
    );

    const request = new NextRequest(
      `http://localhost:3000/api/prefs/set?time=dawn&token=${token}`
    );
    const response = await GET(request);

    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain('Saved');
  });

  it('updates skill level with valid token', async () => {
    const { GET } = await import('@/app/api/prefs/set/route');
    const token = await signEmailToken(
      { user_id: 'user-123', purpose: 'prefs' },
      TEST_SECRET
    );

    const request = new NextRequest(
      `http://localhost:3000/api/prefs/set?level=intermediate&token=${token}`
    );
    const response = await GET(request);

    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain('Saved');
  });

  it('updates expert skill level with valid token', async () => {
    const { GET } = await import('@/app/api/prefs/set/route');
    const token = await signEmailToken(
      { user_id: 'user-123', purpose: 'prefs' },
      TEST_SECRET
    );

    const request = new NextRequest(
      `http://localhost:3000/api/prefs/set?level=expert&token=${token}`
    );
    const response = await GET(request);

    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain('Saved');
  });

  it('updates email frequency with valid token', async () => {
    const { GET } = await import('@/app/api/prefs/set/route');
    const token = await signEmailToken(
      { user_id: 'user-123', purpose: 'prefs' },
      TEST_SECRET
    );

    const request = new NextRequest(
      `http://localhost:3000/api/prefs/set?frequency=only_good&token=${token}`
    );
    const response = await GET(request);

    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain('Saved');
  });

  it('rejects invalid preference values', async () => {
    const { GET } = await import('@/app/api/prefs/set/route');
    const token = await signEmailToken(
      { user_id: 'user-123', purpose: 'prefs' },
      TEST_SECRET
    );

    const request = new NextRequest(
      `http://localhost:3000/api/prefs/set?time=invalid_value&token=${token}`
    );
    const response = await GET(request);

    expect(response.status).toBe(400);
    const html = await response.text();
    expect(html).toContain('Invalid');
  });

  it('returns error when no preference is specified', async () => {
    const { GET } = await import('@/app/api/prefs/set/route');
    const token = await signEmailToken(
      { user_id: 'user-123', purpose: 'prefs' },
      TEST_SECRET
    );

    const request = new NextRequest(
      `http://localhost:3000/api/prefs/set?token=${token}`
    );
    const response = await GET(request);

    expect(response.status).toBe(400);
    const html = await response.text();
    expect(html).toContain('No');
  });

  it('handles database errors gracefully', async () => {
    mockUpsert.mockResolvedValueOnce({ error: { message: 'DB error' } });

    const { GET } = await import('@/app/api/prefs/set/route');
    const token = await signEmailToken(
      { user_id: 'user-123', purpose: 'prefs' },
      TEST_SECRET
    );

    const request = new NextRequest(
      `http://localhost:3000/api/prefs/set?time=dawn&token=${token}`
    );
    const response = await GET(request);

    expect(response.status).toBe(400);
    const html = await response.text();
    expect(html).toContain('Failed');
  });
});
