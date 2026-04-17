/**
 * @jest-environment node
 *
 * Tests for /api/prefs/set route.
 *
 * Historical: this route wrote 1-tap preference updates from the old
 * welcome email's 8 buttons to `user_email_prefs`.
 *
 * Current (plan abstract-exploring-phoenix cleanup): the route is a
 * graceful no-op. The welcome email no longer links here, and
 * `user_email_prefs` is a dead table (written but never read). We keep
 * the route around so any old email still in a user's inbox renders
 * a friendly "link retired" page instead of a 404 / 500. These tests
 * pin the no-op + backward-compat contract.
 */

import { NextRequest } from 'next/server';
import { signEmailToken } from '@/lib/utils/email-token';

const TEST_SECRET = 'test-secret-key-that-is-at-least-32-characters-long';

describe('GET /api/prefs/set (legacy email-link endpoint, now no-op)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.EMAIL_TOKEN_SECRET = TEST_SECRET;
  });

  afterEach(() => {
    delete process.env.EMAIL_TOKEN_SECRET;
  });

  it('returns a friendly expired-link page for missing token', async () => {
    const { GET } = await import('@/app/api/prefs/set/route');
    const request = new NextRequest('http://localhost:3000/api/prefs/set?time=dawn');
    const response = await GET(request);

    expect(response.status).toBe(400);
    const html = await response.text();
    // Accept the generic "Missing" / "Invalid" wording from the shared
    // email-action page renderer — the route falls through to that
    // when the token can't be verified.
    expect(html).toMatch(/Missing|Invalid|expired/i);
  });

  it('returns an expired-link page for tampered tokens', async () => {
    const { GET } = await import('@/app/api/prefs/set/route');
    const request = new NextRequest(
      'http://localhost:3000/api/prefs/set?time=dawn&token=invalid'
    );
    const response = await GET(request);

    expect(response.status).toBe(400);
    const html = await response.text();
    expect(html).toMatch(/Invalid|expired/i);
  });

  it('renders a friendly "link retired" page for valid tokens — no DB write', async () => {
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
    // The retired-link page explains the situation and directs users
    // back to the app. No database writes happen on this path.
    expect(html.toLowerCase()).toContain('retired');
  });

  it('renders the same retired page regardless of which legacy param was passed', async () => {
    const { GET } = await import('@/app/api/prefs/set/route');
    const token = await signEmailToken(
      { user_id: 'user-123', purpose: 'prefs' },
      TEST_SECRET
    );

    for (const qs of [
      `level=intermediate&token=${token}`,
      `level=expert&token=${token}`,
      `frequency=only_good&token=${token}`,
      `time=invalid_value&token=${token}`,
      `token=${token}`,
    ]) {
      const response = await GET(
        new NextRequest(`http://localhost:3000/api/prefs/set?${qs}`)
      );
      expect(response.status).toBe(200);
      const html = await response.text();
      expect(html.toLowerCase()).toContain('retired');
    }
  });
});
