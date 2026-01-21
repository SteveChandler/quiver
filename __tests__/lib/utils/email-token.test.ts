import { signEmailToken, verifyEmailToken, EmailTokenPayload } from '@/lib/utils/email-token';

describe('email-token', () => {
  const TEST_SECRET = 'test-secret-key-that-is-at-least-32-chars';

  describe('signEmailToken', () => {
    it('creates a valid JWT token', async () => {
      const payload: EmailTokenPayload = {
        user_id: 'user-123',
        purpose: 'prefs',
      };

      const token = await signEmailToken(payload, TEST_SECRET);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
    });

    it('includes expiration by default (7 days)', async () => {
      const payload: EmailTokenPayload = {
        user_id: 'user-123',
        purpose: 'prefs',
      };

      const token = await signEmailToken(payload, TEST_SECRET);
      const decoded = await verifyEmailToken(token, TEST_SECRET);

      expect(decoded).not.toBeNull();
      expect(decoded!.exp).toBeDefined();
      // Expiration should be ~7 days from now
      const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
      const expMs = decoded!.exp! * 1000;
      const diff = expMs - Date.now();
      expect(diff).toBeGreaterThan(sevenDaysMs - 60000); // Within 1 minute
      expect(diff).toBeLessThan(sevenDaysMs + 60000);
    });
  });

  describe('verifyEmailToken', () => {
    it('returns payload for valid token', async () => {
      const payload: EmailTokenPayload = {
        user_id: 'user-456',
        purpose: 'save_window',
      };

      const token = await signEmailToken(payload, TEST_SECRET);
      const decoded = await verifyEmailToken(token, TEST_SECRET);

      expect(decoded).not.toBeNull();
      expect(decoded!.user_id).toBe('user-456');
      expect(decoded!.purpose).toBe('save_window');
    });

    it('returns null for invalid token', async () => {
      const decoded = await verifyEmailToken('invalid.token.here', TEST_SECRET);
      expect(decoded).toBeNull();
    });

    it('returns null for wrong secret', async () => {
      const payload: EmailTokenPayload = {
        user_id: 'user-789',
        purpose: 'log_session',
      };

      const token = await signEmailToken(payload, TEST_SECRET);
      const decoded = await verifyEmailToken(token, 'wrong-secret-key-that-is-32-chars');

      expect(decoded).toBeNull();
    });

    it('returns null for expired token', async () => {
      const payload: EmailTokenPayload = {
        user_id: 'user-expired',
        purpose: 'prefs',
      };

      // Create token with 0 expiration (already expired)
      const token = await signEmailToken(payload, TEST_SECRET, 0);

      // Wait a tiny bit to ensure expiration
      await new Promise(resolve => setTimeout(resolve, 10));

      const decoded = await verifyEmailToken(token, TEST_SECRET);
      expect(decoded).toBeNull();
    });
  });
});
