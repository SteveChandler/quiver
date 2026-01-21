/**
 * @jest-environment node
 *
 * Tests for session log actions
 *
 * This tests the logSession server action that handles session logging
 * from email links. It verifies the token and saves session data.
 */

import { signEmailToken } from '@/lib/utils/email-token';

// Mock Supabase
const mockInsert = jest.fn().mockResolvedValue({ error: null });
jest.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: jest.fn(() =>
    Promise.resolve({
      from: jest.fn(() => ({
        insert: mockInsert,
      })),
    })
  ),
}));

// Mock environment
const TEST_SECRET = 'test-secret-key-that-is-at-least-32-characters-long';

describe('logSession', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.EMAIL_TOKEN_SECRET = TEST_SECRET;
  });

  afterEach(() => {
    delete process.env.EMAIL_TOKEN_SECRET;
  });

  describe('Token Validation', () => {
    it('returns error for missing token', async () => {
      const { logSession } = await import('@/app/session/log/actions');
      const result = await logSession(
        '',
        'beach-123',
        '2024-01-20T08:00:00Z',
        'good'
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Missing authentication token');
    });

    it('returns error for invalid token', async () => {
      const { logSession } = await import('@/app/session/log/actions');
      const result = await logSession(
        'invalid-token-string',
        'beach-123',
        '2024-01-20T08:00:00Z',
        'good'
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid or expired link');
    });

    it('returns error for wrong token purpose', async () => {
      const { logSession } = await import('@/app/session/log/actions');
      // Create a token with wrong purpose
      const token = await signEmailToken(
        { user_id: 'user-123', purpose: 'prefs' },
        TEST_SECRET
      );

      const result = await logSession(
        token,
        'beach-123',
        '2024-01-20T08:00:00Z',
        'good'
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid or expired link');
    });

    it('returns error when EMAIL_TOKEN_SECRET is not set', async () => {
      delete process.env.EMAIL_TOKEN_SECRET;

      const { logSession } = await import('@/app/session/log/actions');
      const result = await logSession(
        'some-token',
        'beach-123',
        '2024-01-20T08:00:00Z',
        'good'
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Email system not configured');
    });

    it('returns error for expired token', async () => {
      const { logSession } = await import('@/app/session/log/actions');
      // Create a token that expires immediately (0 days)
      const token = await signEmailToken(
        { user_id: 'user-123', purpose: 'log_session' },
        TEST_SECRET,
        0 // Expires immediately
      );

      // Wait a moment for token to expire
      await new Promise((resolve) => setTimeout(resolve, 1100));

      const result = await logSession(
        token,
        'beach-123',
        '2024-01-20T08:00:00Z',
        'good'
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid or expired link');
    });
  });

  describe('Success Cases', () => {
    it('creates session log with valid parameters', async () => {
      const { logSession } = await import('@/app/session/log/actions');
      const token = await signEmailToken(
        { user_id: 'user-123', purpose: 'log_session' },
        TEST_SECRET
      );

      const result = await logSession(
        token,
        'beach-456',
        '2024-01-20T08:00:00Z',
        'good',
        'Great session!',
        85
      );

      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
      expect(mockInsert).toHaveBeenCalledWith({
        user_id: 'user-123',
        beach_id: 'beach-456',
        window_start: '2024-01-20T08:00:00Z',
        rating: 'good',
        notes: 'Great session!',
        predicted_score: 85,
        source: 'email',
      });
    });

    it('allows null notes (optional parameter)', async () => {
      const { logSession } = await import('@/app/session/log/actions');
      const token = await signEmailToken(
        { user_id: 'user-123', purpose: 'log_session' },
        TEST_SECRET
      );

      const result = await logSession(
        token,
        'beach-456',
        '2024-01-20T08:00:00Z',
        'fired',
        undefined,
        90
      );

      expect(result.success).toBe(true);
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          notes: null,
          predicted_score: 90,
        })
      );
    });

    it('allows null predictedScore (optional parameter)', async () => {
      const { logSession } = await import('@/app/session/log/actions');
      const token = await signEmailToken(
        { user_id: 'user-123', purpose: 'log_session' },
        TEST_SECRET
      );

      const result = await logSession(
        token,
        'beach-456',
        '2024-01-20T08:00:00Z',
        'skip',
        'Too crowded',
        undefined
      );

      expect(result.success).toBe(true);
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          notes: 'Too crowded',
          predicted_score: null,
        })
      );
    });

    it('handles all rating values correctly', async () => {
      const { logSession } = await import('@/app/session/log/actions');
      const ratings: Array<'skip' | 'good' | 'fired'> = [
        'skip',
        'good',
        'fired',
      ];

      for (const rating of ratings) {
        mockInsert.mockClear();
        const token = await signEmailToken(
          { user_id: 'user-123', purpose: 'log_session' },
          TEST_SECRET
        );

        const result = await logSession(
          token,
          'beach-456',
          '2024-01-20T08:00:00Z',
          rating
        );

        expect(result.success).toBe(true);
        expect(mockInsert).toHaveBeenCalledWith(
          expect.objectContaining({
            rating,
          })
        );
      }
    });
  });

  describe('Database Errors', () => {
    it('returns error when database insert fails', async () => {
      mockInsert.mockResolvedValueOnce({
        error: { message: 'Database connection error' },
      });

      const { logSession } = await import('@/app/session/log/actions');
      const token = await signEmailToken(
        { user_id: 'user-123', purpose: 'log_session' },
        TEST_SECRET
      );

      const result = await logSession(
        token,
        'beach-456',
        '2024-01-20T08:00:00Z',
        'good'
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to save. Please try again.');
    });

    it('logs database errors to console', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const dbError = { message: 'Constraint violation', code: '23505' };
      mockInsert.mockResolvedValueOnce({ error: dbError });

      const { logSession } = await import('@/app/session/log/actions');
      const token = await signEmailToken(
        { user_id: 'user-123', purpose: 'log_session' },
        TEST_SECRET
      );

      await logSession(token, 'beach-456', '2024-01-20T08:00:00Z', 'good');

      expect(consoleSpy).toHaveBeenCalledWith('Failed to log session:', dbError);
      consoleSpy.mockRestore();
    });
  });
});
