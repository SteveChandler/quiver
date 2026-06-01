/**
 * @jest-environment node
 *
 * Tests for GET /session/confirm
 *
 * 1-tap session confirmation from email links.
 * Verifies the token, deduplicates within 24h, and logs the session.
 */

import { NextRequest } from 'next/server';
import { readFileSync } from 'fs';
import { join } from 'path';
import { signEmailToken } from '@/lib/utils/email-token';
import { expectConsoleErrors } from '@/__tests__/setup/test-utils';

// Mock Supabase — service role client (email links clicked without auth session)
const mockSelect = jest.fn();
const mockInsert = jest.fn().mockResolvedValue({ error: null });

jest.mock('@/lib/supabase/server', () => ({
  createSupabaseServiceRoleClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lt: jest.fn().mockReturnThis(),
        limit: mockSelect,
      })),
      insert: mockInsert,
    })),
  })),
}));

const TEST_SECRET = 'test-secret-key-that-is-at-least-32-characters-long';
const VALID_BEACH_UUID = 'a1b2c3d4-e5f6-4890-abcd-ef1234567890';

/** A recent date (yesterday) that's always within the 7-day validity window. */
function recentDate(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}
const RECENT_DATE = recentDate();

describe('GET /session/confirm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.EMAIL_TOKEN_SECRET = TEST_SECRET;
    // Default: no existing session log (no duplicate)
    mockSelect.mockResolvedValue({ data: [], error: null });
  });

  afterEach(() => {
    delete process.env.EMAIL_TOKEN_SECRET;
  });

  describe('Source guard', () => {
    it('uses the API wrapper barrel for UUID validation', () => {
      const routeSource = readFileSync(
        join(process.cwd(), 'app/session/confirm/route.ts'),
        'utf8'
      );

      expect(routeSource).not.toContain('@/lib/api-utils');
      expect(routeSource).toContain('@/lib/middleware/api-wrappers');
    });
  });

  describe('Parameter validation', () => {
    it('returns error when beach_id is missing', async () => {
      const { GET } = await import('@/app/session/confirm/route');
      const token = await signEmailToken(
        { user_id: 'user-123', purpose: 'log_session' },
        TEST_SECRET
      );
      const request = new NextRequest(
        `http://localhost:3000/session/confirm?token=${token}&date=${RECENT_DATE}`
      );

      const response = await GET(request);

      expect(response.status).toBe(400);
      const html = await response.text();
      expect(html).toContain('Missing');
    });

    it('returns error when date is missing', async () => {
      const { GET } = await import('@/app/session/confirm/route');
      const token = await signEmailToken(
        { user_id: 'user-123', purpose: 'log_session' },
        TEST_SECRET
      );
      const request = new NextRequest(
        `http://localhost:3000/session/confirm?token=${token}&beach_id=${VALID_BEACH_UUID}`
      );

      const response = await GET(request);

      expect(response.status).toBe(400);
      const html = await response.text();
      expect(html).toContain('Missing');
    });

    it('returns error when both beach_id and date are missing', async () => {
      const { GET } = await import('@/app/session/confirm/route');
      const request = new NextRequest(
        'http://localhost:3000/session/confirm?token=sometoken'
      );

      const response = await GET(request);

      expect(response.status).toBe(400);
      const html = await response.text();
      expect(html).toContain('Missing');
    });

    it('returns error when beach_id is not a valid UUID', async () => {
      const { GET } = await import('@/app/session/confirm/route');
      const request = new NextRequest(
        `http://localhost:3000/session/confirm?token=sometoken&beach_id=not-a-uuid&date=${RECENT_DATE}`
      );

      const response = await GET(request);

      expect(response.status).toBe(400);
      const html = await response.text();
      expect(html).toContain('Invalid beach identifier');
    });
  });

  describe('Token verification', () => {
    it('returns error when token is missing', async () => {
      const { GET } = await import('@/app/session/confirm/route');
      const request = new NextRequest(
        `http://localhost:3000/session/confirm?beach_id=${VALID_BEACH_UUID}&date=${RECENT_DATE}`
      );

      const response = await GET(request);

      expect(response.status).toBe(400);
      const html = await response.text();
      expect(html).toContain('Invalid Link');
    });

    it('returns error for an invalid token', async () => {
      const { GET } = await import('@/app/session/confirm/route');
      const request = new NextRequest(
        `http://localhost:3000/session/confirm?token=not-a-valid-jwt&beach_id=${VALID_BEACH_UUID}&date=${RECENT_DATE}`
      );

      const response = await GET(request);

      expect(response.status).toBe(400);
      const html = await response.text();
      expect(html).toContain('Invalid Link');
    });

    it('returns error when token has wrong purpose', async () => {
      const { GET } = await import('@/app/session/confirm/route');
      const token = await signEmailToken(
        { user_id: 'user-123', purpose: 'save_window' }, // wrong purpose
        TEST_SECRET
      );
      const request = new NextRequest(
        `http://localhost:3000/session/confirm?token=${token}&beach_id=${VALID_BEACH_UUID}&date=${RECENT_DATE}`
      );

      const response = await GET(request);

      expect(response.status).toBe(400);
      const html = await response.text();
      expect(html).toContain('Invalid Link');
    });

    it('returns configuration error when EMAIL_TOKEN_SECRET is not set', async () => {
      delete process.env.EMAIL_TOKEN_SECRET;
      const { GET } = await import('@/app/session/confirm/route');
      const request = new NextRequest(
        `http://localhost:3000/session/confirm?token=some-token&beach_id=${VALID_BEACH_UUID}&date=${RECENT_DATE}`
      );

      const response = await GET(request);

      expect(response.status).toBe(400);
      const html = await response.text();
      expect(html).toContain('Configuration Error');
    });
  });

  describe('Date validation', () => {
    it('returns error for an invalid date string', async () => {
      const { GET } = await import('@/app/session/confirm/route');
      const token = await signEmailToken(
        { user_id: 'user-123', purpose: 'log_session' },
        TEST_SECRET
      );
      const request = new NextRequest(
        `http://localhost:3000/session/confirm?token=${token}&beach_id=${VALID_BEACH_UUID}&date=not-a-date`
      );

      const response = await GET(request);

      expect(response.status).toBe(400);
      const html = await response.text();
      expect(html).toContain('Invalid Date');
    });

    it('returns error for a future date', async () => {
      const { GET } = await import('@/app/session/confirm/route');
      const token = await signEmailToken(
        { user_id: 'user-123', purpose: 'log_session' },
        TEST_SECRET
      );
      // Use a date far in the future
      const futureDate = '2099-01-01';
      const request = new NextRequest(
        `http://localhost:3000/session/confirm?token=${token}&beach_id=${VALID_BEACH_UUID}&date=${futureDate}`
      );

      const response = await GET(request);

      expect(response.status).toBe(400);
      const html = await response.text();
      expect(html).toContain('Invalid Date');
    });

    it('returns error for a date more than 7 days in the past', async () => {
      const { GET } = await import('@/app/session/confirm/route');
      const token = await signEmailToken(
        { user_id: 'user-123', purpose: 'log_session' },
        TEST_SECRET
      );
      // Use a date well in the past
      const staleDate = '2020-01-01';
      const request = new NextRequest(
        `http://localhost:3000/session/confirm?token=${token}&beach_id=${VALID_BEACH_UUID}&date=${staleDate}`
      );

      const response = await GET(request);

      expect(response.status).toBe(400);
      const html = await response.text();
      expect(html).toContain('Link Expired');
    });
  });

  describe('Duplicate detection', () => {
    it('returns already-logged page when session exists for the same day', async () => {
      mockSelect.mockResolvedValueOnce({ data: [{ id: 99 }], error: null });

      const { GET } = await import('@/app/session/confirm/route');
      const token = await signEmailToken(
        { user_id: 'user-123', purpose: 'log_session' },
        TEST_SECRET
      );
      const request = new NextRequest(
        `http://localhost:3000/session/confirm?token=${token}&beach_id=${VALID_BEACH_UUID}&date=${RECENT_DATE}`
      );

      const response = await GET(request);

      expect(response.status).toBe(200);
      const html = await response.text();
      expect(html).toContain('Already Logged');
      expect(mockInsert).not.toHaveBeenCalled();
    });

    it('returns already-logged page on unique constraint violation (race condition)', async () => {
      mockInsert.mockResolvedValueOnce({ error: { code: '23505', message: 'unique violation' } });

      const { GET } = await import('@/app/session/confirm/route');
      const token = await signEmailToken(
        { user_id: 'user-123', purpose: 'log_session' },
        TEST_SECRET
      );
      const request = new NextRequest(
        `http://localhost:3000/session/confirm?token=${token}&beach_id=${VALID_BEACH_UUID}&date=${RECENT_DATE}`
      );

      const response = await GET(request);

      expect(response.status).toBe(200);
      const html = await response.text();
      expect(html).toContain('Already Logged');
    });

    it('returns error when the duplicate-check query fails', async () => {
      mockSelect.mockResolvedValueOnce({ data: null, error: { message: 'DB error' } });

      const { GET } = await import('@/app/session/confirm/route');
      const token = await signEmailToken(
        { user_id: 'user-123', purpose: 'log_session' },
        TEST_SECRET
      );
      const request = new NextRequest(
        `http://localhost:3000/session/confirm?token=${token}&beach_id=${VALID_BEACH_UUID}&date=${RECENT_DATE}`
      );

      const response = await GET(request);

      // The route logs a console.error for the DB check failure — declare it intentional
      expectConsoleErrors([/Failed to check for duplicate session log/]);

      expect(response.status).toBe(400);
      const html = await response.text();
      expect(html).toContain('Something Went Wrong');
    });
  });

  describe('Successful session logging', () => {
    it('creates session log with correct fields and returns success page', async () => {
      const { GET } = await import('@/app/session/confirm/route');
      const token = await signEmailToken(
        { user_id: 'user-123', purpose: 'log_session' },
        TEST_SECRET
      );
      const request = new NextRequest(
        `http://localhost:3000/session/confirm?token=${token}&beach_id=${VALID_BEACH_UUID}&date=${RECENT_DATE}`
      );

      const response = await GET(request);

      expect(response.status).toBe(200);
      const html = await response.text();
      expect(html).toContain('Session Logged');
      expect(html).toContain('View Your Sessions');

      expect(mockInsert).toHaveBeenCalledWith({
        user_id: 'user-123',
        beach_id: VALID_BEACH_UUID,
        window_start: expect.stringContaining(RECENT_DATE),
        rating: 'good',
        source: 'email',
      });
    });

    it('returns error page when insert fails with a non-duplicate DB error', async () => {
      mockInsert.mockResolvedValueOnce({ error: { code: '42501', message: 'permission denied' } });

      const { GET } = await import('@/app/session/confirm/route');
      const token = await signEmailToken(
        { user_id: 'user-123', purpose: 'log_session' },
        TEST_SECRET
      );
      const request = new NextRequest(
        `http://localhost:3000/session/confirm?token=${token}&beach_id=${VALID_BEACH_UUID}&date=${RECENT_DATE}`
      );

      const response = await GET(request);

      // The route calls console.error on insert failure — declare it intentional
      expectConsoleErrors([/Failed to create session log/]);

      expect(response.status).toBe(400);
      const html = await response.text();
      expect(html).toContain('Log Failed');
    });
  });
});
