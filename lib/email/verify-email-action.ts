import { verifyEmailToken, getEmailTokenSecret, EmailTokenPurpose } from '@/lib/utils/email-token';

export type VerificationResult =
  | { success: true; userId: string }
  | { success: false; error: string; errorType: 'config' | 'invalid' | 'expired' };

/**
 * Verifies an email action token and extracts the user ID.
 * Handles all common error cases with appropriate error messages.
 */
export async function verifyEmailActionToken(
  token: string | null,
  expectedPurpose: EmailTokenPurpose
): Promise<VerificationResult> {
  if (!token) {
    return { success: false, error: 'Missing authentication token', errorType: 'invalid' };
  }

  let secret: string;
  try {
    secret = getEmailTokenSecret();
  } catch {
    return { success: false, error: 'Email system not configured', errorType: 'config' };
  }

  const payload = await verifyEmailToken(token, secret);
  if (!payload || payload.purpose !== expectedPurpose) {
    return { success: false, error: 'Invalid or expired link', errorType: 'invalid' };
  }

  return { success: true, userId: payload.user_id };
}
