/**
 * Email Token Utility
 *
 * Creates and verifies signed JWT tokens for email actions.
 * These tokens allow users to perform actions (set preferences, save windows)
 * directly from email links without requiring login.
 */

import { SignJWT, jwtVerify, JWTPayload } from 'jose';

export type EmailTokenPurpose = 'prefs' | 'save_window' | 'log_session';

export interface EmailTokenPayload extends JWTPayload {
  user_id: string;
  purpose: EmailTokenPurpose;
}

const DEFAULT_EXPIRATION_DAYS = 7;

/**
 * Sign a JWT token for email actions
 *
 * @param payload - Token payload with user_id and purpose
 * @param secret - Secret key for signing (from EMAIL_TOKEN_SECRET env var)
 * @param expirationDays - Days until expiration (default 7)
 * @returns Signed JWT token string
 */
export async function signEmailToken(
  payload: EmailTokenPayload,
  secret: string,
  expirationDays: number = DEFAULT_EXPIRATION_DAYS
): Promise<string> {
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
 * Verify and decode an email token
 *
 * @param token - JWT token string from email link
 * @param secret - Secret key for verification
 * @returns Decoded payload or null if invalid/expired
 */
export async function verifyEmailToken(
  token: string,
  secret: string
): Promise<EmailTokenPayload | null> {
  try {
    const secretKey = new TextEncoder().encode(secret);

    const { payload } = await jwtVerify(token, secretKey);

    // Validate required fields
    if (!payload.user_id || !payload.purpose) {
      return null;
    }

    return payload as EmailTokenPayload;
  } catch {
    // Token invalid, expired, or wrong signature
    return null;
  }
}

/**
 * Get the secret from environment variables
 * Throws if not configured
 */
export function getEmailTokenSecret(): string {
  const secret = process.env.EMAIL_TOKEN_SECRET;
  if (!secret) {
    throw new Error('EMAIL_TOKEN_SECRET environment variable is not set');
  }
  return secret;
}
