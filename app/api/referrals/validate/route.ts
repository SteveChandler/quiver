import { NextRequest, NextResponse } from 'next/server';
import { createAPIServerClient } from '@/lib/supabase/server';
import {
  handleApiError,
  createValidationError,
  DEFAULT_SECURITY_HEADERS,
} from '@/lib/api-utils';
import { createRateLimiter } from '@/lib/utils/rate-limiter';

/**
 * Rate limiter for referral code validation
 * Prevents brute force attacks by limiting validation attempts
 */
const referralValidationRateLimiter = createRateLimiter('ReferralValidation', {
  requestsPerMinute: 10, // 10 validation attempts per minute per instance
  requestsPerHour: 100, // 100 validation attempts per hour
  burstLimit: 5, // Allow small bursts of 5 rapid attempts
});

/**
 * Response type for referral code validation
 */
interface ValidationResponse {
  valid: boolean;
  message?: string;
}

/**
 * GET /api/referrals/validate
 *
 * Validates whether a referral code exists in the system.
 *
 * Query Parameters:
 * - code: The referral code to validate (required)
 *
 * Returns:
 * - { valid: true } if code exists
 * - { valid: false, message?: string } if code doesn't exist or validation fails
 *
 * Security:
 * - Rate limited to prevent brute force attacks
 * - Case-insensitive matching
 * - No sensitive data in response (user IDs not exposed)
 * - Input sanitization
 * - Uses Supabase RLS policies
 *
 * Performance:
 * - Uses database index: idx_profiles_referral_code_lower
 * - Target response time: <100ms
 *
 * @example
 * GET /api/referrals/validate?code=ABC123
 * → { "valid": true }
 *
 * GET /api/referrals/validate?code=INVALID
 * → { "valid": false }
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // Check rate limit
    if (!referralValidationRateLimiter.canMakeRequest()) {
      const timeUntilReset = referralValidationRateLimiter.getTimeUntilReset();
      console.warn('Referral validation rate limit exceeded', {
        timeUntilReset,
        url: request.url,
      });

      return NextResponse.json(
        {
          valid: false,
          message: 'Too many validation attempts. Please try again later.',
        },
        {
          status: 429, // Too Many Requests
          headers: {
            ...DEFAULT_SECURITY_HEADERS,
            'Retry-After': Math.ceil(timeUntilReset / 1000).toString(),
          },
        }
      );
    }

    // Record the request for rate limiting
    referralValidationRateLimiter.recordRequest('validate');

    // Extract and validate query parameter
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');

    // Validate required parameter
    if (!code) {
      return NextResponse.json(
        {
          valid: false,
          message: 'Referral code is required',
        },
        {
          status: 400,
          headers: DEFAULT_SECURITY_HEADERS,
        }
      );
    }

    // Sanitize input: trim whitespace
    const sanitizedCode = code.trim();

    // Validate code format
    if (sanitizedCode.length === 0) {
      return NextResponse.json(
        {
          valid: false,
          message: 'Referral code cannot be empty',
        },
        {
          status: 400,
          headers: DEFAULT_SECURITY_HEADERS,
        }
      );
    }

    // Limit code length to prevent abuse
    if (sanitizedCode.length > 20) {
      return NextResponse.json(
        {
          valid: false,
          message: 'Referral code is too long',
        },
        {
          status: 400,
          headers: DEFAULT_SECURITY_HEADERS,
        }
      );
    }

    // Create Supabase client
    const supabase = createAPIServerClient();

    // Query database for matching referral code
    // Uses case-insensitive matching with .ilike()
    // Database index: idx_profiles_referral_code_lower
    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .ilike('referral_code', sanitizedCode)
      .maybeSingle();

    // Handle database errors
    if (error) {
      console.error('Error validating referral code:', {
        error: error.message,
        code: sanitizedCode,
      });

      return NextResponse.json(
        {
          valid: false,
          message: 'Unable to validate code',
        },
        {
          status: 500,
          headers: DEFAULT_SECURITY_HEADERS,
        }
      );
    }

    // Return validation result
    // Note: We intentionally don't expose user ID for security
    const isValid = !!data;

    return NextResponse.json(
      {
        valid: isValid,
      },
      {
        status: 200,
        headers: {
          ...DEFAULT_SECURITY_HEADERS,
          // Cache valid responses for 5 minutes to reduce database load
          // Don't cache invalid responses to allow for code creation
          ...(isValid && {
            'Cache-Control': 'private, max-age=300',
          }),
        },
      }
    );
  } catch (error) {
    console.error('Unexpected error in referral validation:', error);
    // Return a properly typed error response
    return NextResponse.json(
      {
        valid: false,
        message: 'Failed to validate referral code',
      },
      {
        status: 500,
        headers: DEFAULT_SECURITY_HEADERS,
      }
    );
  }
}
