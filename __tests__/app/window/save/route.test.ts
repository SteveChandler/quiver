/**
 * @jest-environment node
 *
 * Tests for /window/save route
 *
 * This route handles 1-tap window saving from email links.
 * It verifies the token and saves the window to the database.
 */

import { NextRequest } from 'next/server';
import { signEmailToken } from '@/lib/utils/email-token';

// Mock Supabase - using service role client since email links are clicked without auth session
const mockInsert = jest.fn().mockResolvedValue({ error: null });
jest.mock('@/lib/supabase/server', () => ({
  createSupabaseServiceRoleClient: jest.fn(() => ({
    from: jest.fn(() => ({
      insert: mockInsert,
    })),
  })),
}));

// Mock environment
const TEST_SECRET = 'test-secret-key-that-is-at-least-32-characters-long';

describe('GET /window/save', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.EMAIL_TOKEN_SECRET = TEST_SECRET;
  });

  afterEach(() => {
    delete process.env.EMAIL_TOKEN_SECRET;
  });

  it('returns error for missing token', async () => {
    const { GET } = await import('@/app/window/save/route');
    const request = new NextRequest(
      'http://localhost:3000/window/save?beach_id=123&start=2026-01-20T06:30:00Z&end=2026-01-20T08:00:00Z'
    );
    const response = await GET(request);

    expect(response.status).toBe(400);
    const html = await response.text();
    expect(html).toContain('Missing');
  });

  it('returns error for missing beach_id', async () => {
    const { GET } = await import('@/app/window/save/route');
    const token = await signEmailToken(
      { user_id: 'user-123', purpose: 'save_window' },
      TEST_SECRET
    );

    const request = new NextRequest(
      `http://localhost:3000/window/save?token=${token}&start=2026-01-20T06:30:00Z&end=2026-01-20T08:00:00Z`
    );
    const response = await GET(request);

    expect(response.status).toBe(400);
    const html = await response.text();
    expect(html).toContain('Missing');
  });

  it('saves window with valid params', async () => {
    const { GET } = await import('@/app/window/save/route');
    const token = await signEmailToken(
      { user_id: 'user-123', purpose: 'save_window' },
      TEST_SECRET
    );

    const request = new NextRequest(
      `http://localhost:3000/window/save?token=${token}&beach_id=beach-456&start=2026-01-20T06:30:00Z&end=2026-01-20T08:00:00Z`
    );
    const response = await GET(request);

    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain('Saved');
  });

  it('handles duplicate saves gracefully', async () => {
    mockInsert.mockResolvedValueOnce({ error: { code: '23505' } });

    const { GET } = await import('@/app/window/save/route');
    const token = await signEmailToken(
      { user_id: 'user-123', purpose: 'save_window' },
      TEST_SECRET
    );

    const request = new NextRequest(
      `http://localhost:3000/window/save?token=${token}&beach_id=beach-456&start=2026-01-20T06:30:00Z&end=2026-01-20T08:00:00Z`
    );
    const response = await GET(request);

    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain('already saved');
  });

  it('returns error for invalid dates', async () => {
    const { GET } = await import('@/app/window/save/route');
    const token = await signEmailToken(
      { user_id: 'user-123', purpose: 'save_window' },
      TEST_SECRET
    );

    const request = new NextRequest(
      `http://localhost:3000/window/save?token=${token}&beach_id=beach-456&start=invalid&end=2026-01-20T08:00:00Z`
    );
    const response = await GET(request);

    expect(response.status).toBe(400);
    const html = await response.text();
    expect(html).toContain('Invalid');
  });

  it('handles database errors gracefully', async () => {
    mockInsert.mockResolvedValueOnce({ error: { message: 'DB error', code: '12345' } });

    const { GET } = await import('@/app/window/save/route');
    const token = await signEmailToken(
      { user_id: 'user-123', purpose: 'save_window' },
      TEST_SECRET
    );

    const request = new NextRequest(
      `http://localhost:3000/window/save?token=${token}&beach_id=beach-456&start=2026-01-20T06:30:00Z&end=2026-01-20T08:00:00Z`
    );
    const response = await GET(request);

    expect(response.status).toBe(400);
    const html = await response.text();
    expect(html).toContain('Failed');
  });

  it('returns error for invalid token', async () => {
    const { GET } = await import('@/app/window/save/route');
    const request = new NextRequest(
      'http://localhost:3000/window/save?token=invalid-token&beach_id=beach-456&start=2026-01-20T06:30:00Z&end=2026-01-20T08:00:00Z'
    );
    const response = await GET(request);

    expect(response.status).toBe(400);
    const html = await response.text();
    expect(html).toContain('Invalid');
  });

  it('returns error for wrong token purpose', async () => {
    const { GET } = await import('@/app/window/save/route');
    const token = await signEmailToken(
      { user_id: 'user-123', purpose: 'prefs' }, // Wrong purpose
      TEST_SECRET
    );
    const request = new NextRequest(
      `http://localhost:3000/window/save?token=${token}&beach_id=beach-456&start=2026-01-20T06:30:00Z&end=2026-01-20T08:00:00Z`
    );
    const response = await GET(request);

    expect(response.status).toBe(400);
    const html = await response.text();
    expect(html).toContain('Invalid');
  });
});
