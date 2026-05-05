/**
 * E2E Test Helpers for Email Token Operations
 *
 * These helpers allow E2E tests to generate valid email tokens
 * for testing the preference setting flow.
 *
 * NOTE: This requires EMAIL_TOKEN_SECRET to be set in the E2E test environment
 * and match the server's EMAIL_TOKEN_SECRET.
 */

// Dynamic import for jose (ES Module) to work with CommonJS E2E environment
let SignJWT: typeof import('jose').SignJWT;

async function loadJose() {
  if (!SignJWT) {
    const jose = await import('jose');
    SignJWT = jose.SignJWT;
  }
}

export type EmailTokenPurpose = 'prefs' | 'save_window' | 'log_session' | 'invite';

export interface EmailTokenPayload {
  user_id: string;
  purpose: EmailTokenPurpose;
}

/**
 * Get the email token secret from environment variables
 *
 * For E2E tests, this reads from the test environment.
 * The secret must match the server's EMAIL_TOKEN_SECRET.
 */
function getTestTokenSecret(): string {
  const secret = process.env.EMAIL_TOKEN_SECRET;
  if (!secret) {
    throw new Error(
      'EMAIL_TOKEN_SECRET not set. ' +
      'Add EMAIL_TOKEN_SECRET to your .env.playwright file. ' +
      'This must match the server environment variable.'
    );
  }
  return secret;
}

/**
 * Generate a valid email token for testing
 *
 * This creates a JWT token that will be verified by the /prefs/set endpoint.
 *
 * @param payload - Token payload with user_id and purpose
 * @param expirationDays - Days until expiration (default 7)
 * @returns Signed JWT token string
 *
 * @example
 * const token = await generateTestEmailToken({
 *   user_id: 'test-user-123',
 *   purpose: 'prefs'
 * });
 */
export async function generateTestEmailToken(
  payload: EmailTokenPayload,
  expirationDays: number = 7
): Promise<string> {
  await loadJose();

  const secret = getTestTokenSecret();
  const secretKey = new TextEncoder().encode(secret);

  const jwt = await new SignJWT({
    user_id: payload.user_id,
    purpose: payload.purpose,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${expirationDays}d`)
    .sign(secretKey);

  return jwt;
}

/**
 * Generate a preference token for a test user
 *
 * Convenience wrapper for generating preference-specific tokens.
 *
 * @param userId - The user ID (can be any string for testing)
 * @returns Signed JWT token for preference updates
 */
export async function generatePrefsToken(userId: string = 'e2e-test-user'): Promise<string> {
  return generateTestEmailToken({ user_id: userId, purpose: 'prefs' });
}

/**
 * Generate an invite token for a test inviter.
 */
export async function generateInviteToken(userId: string): Promise<string> {
  return generateTestEmailToken({ user_id: userId, purpose: 'invite' });
}

/**
 * Check if email token testing is available
 *
 * Returns true if EMAIL_TOKEN_SECRET is configured in the test environment.
 * Tests can use this to skip when the secret is not available.
 */
export function isEmailTokenTestingAvailable(): boolean {
  return !!process.env.EMAIL_TOKEN_SECRET;
}
