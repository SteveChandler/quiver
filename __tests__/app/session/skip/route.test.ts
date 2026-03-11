/**
 * @jest-environment node
 *
 * Tests for GET /session/skip
 *
 * 1-tap session skip from email links.
 * Verifies the token and renders a friendly dismissal page — no DB write.
 */

import { NextRequest } from 'next/server';
import { signEmailToken } from '@/lib/utils/email-token';

// No Supabase calls in the skip route, but mock the mailer client for getBaseUrl
jest.mock('@/lib/mailer/client', () => ({
  getBaseUrl: () => 'https://quiversurf.app',
}));

const TEST_SECRET = 'test-secret-key-that-is-at-least-32-characters-long';

describe('GET /session/skip', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.EMAIL_TOKEN_SECRET = TEST_SECRET;
  });

  afterEach(() => {
    delete process.env.EMAIL_TOKEN_SECRET;
  });

  describe('Token verification', () => {
    it('returns error when token is missing', async () => {
      const { GET } = await import('@/app/session/skip/route');
      const request = new NextRequest(
        'http://localhost:3000/session/skip?beach_id=beach-456'
      );

      const response = await GET(request);

      expect(response.status).toBe(400);
      const html = await response.text();
      expect(html).toContain('Invalid Link');
    });

    it('returns error for an invalid token', async () => {
      const { GET } = await import('@/app/session/skip/route');
      const request = new NextRequest(
        'http://localhost:3000/session/skip?token=bad-jwt&beach_id=beach-456'
      );

      const response = await GET(request);

      expect(response.status).toBe(400);
      const html = await response.text();
      expect(html).toContain('Invalid Link');
    });

    it('returns error when token has wrong purpose', async () => {
      const { GET } = await import('@/app/session/skip/route');
      const token = await signEmailToken(
        { user_id: 'user-123', purpose: 'save_window' }, // wrong purpose
        TEST_SECRET
      );
      const request = new NextRequest(
        `http://localhost:3000/session/skip?token=${token}&beach_id=beach-456`
      );

      const response = await GET(request);

      expect(response.status).toBe(400);
      const html = await response.text();
      expect(html).toContain('Invalid Link');
    });

    it('returns configuration error when EMAIL_TOKEN_SECRET is not set', async () => {
      delete process.env.EMAIL_TOKEN_SECRET;
      const { GET } = await import('@/app/session/skip/route');
      const request = new NextRequest(
        'http://localhost:3000/session/skip?token=some-token&beach_id=beach-456'
      );

      const response = await GET(request);

      expect(response.status).toBe(400);
      const html = await response.text();
      expect(html).toContain('Configuration Error');
    });
  });

  describe('Successful skip', () => {
    it('renders friendly dismissal page with forecast link when beach_id is provided', async () => {
      const { GET } = await import('@/app/session/skip/route');
      const token = await signEmailToken(
        { user_id: 'user-123', purpose: 'log_session' },
        TEST_SECRET
      );
      const request = new NextRequest(
        `http://localhost:3000/session/skip?token=${token}&beach_id=beach-456`
      );

      const response = await GET(request);

      expect(response.status).toBe(200);
      const html = await response.text();
      expect(html).toContain('No worries');
      expect(html).toContain('See the Forecast');
      // Beach-specific forecast URL
      expect(html).toContain('beach=beach-456');
    });

    it('renders dismissal page with map link when beach_id is omitted', async () => {
      const { GET } = await import('@/app/session/skip/route');
      const token = await signEmailToken(
        { user_id: 'user-123', purpose: 'log_session' },
        TEST_SECRET
      );
      const request = new NextRequest(
        `http://localhost:3000/session/skip?token=${token}`
      );

      const response = await GET(request);

      expect(response.status).toBe(200);
      const html = await response.text();
      expect(html).toContain('No worries');
      expect(html).toContain('See the Forecast');
      // Falls back to the map URL without a beach param
      expect(html).toContain('https://quiversurf.app/map');
      expect(html).not.toContain('beach=');
    });

    it('does not write anything to the database', async () => {
      // The skip route should have no Supabase imports at all.
      // If it did call Supabase, the unmocked client would throw — this test
      // passing without error is the assertion.
      const { GET } = await import('@/app/session/skip/route');
      const token = await signEmailToken(
        { user_id: 'user-123', purpose: 'log_session' },
        TEST_SECRET
      );
      const request = new NextRequest(
        `http://localhost:3000/session/skip?token=${token}&beach_id=beach-456`
      );

      await expect(GET(request)).resolves.toBeDefined();
    });
  });
});
