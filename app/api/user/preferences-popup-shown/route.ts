import { NextResponse } from 'next/server';
import { createAPIServerClient } from '@/lib/supabase/server';

/**
 * Simple in-memory rate limiter
 * In production, consider using Redis or similar for distributed rate limiting
 */
const rateLimitMap = new Map<string, number>();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute in milliseconds

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const lastRequestTime = rateLimitMap.get(userId);

  if (lastRequestTime && now - lastRequestTime < RATE_LIMIT_WINDOW) {
    return false; // Rate limit exceeded
  }

  rateLimitMap.set(userId, now);

  // Cleanup old entries periodically (simple memory management)
  if (rateLimitMap.size > 10000) {
    const cutoff = now - RATE_LIMIT_WINDOW;
    for (const [key, time] of rateLimitMap.entries()) {
      if (time < cutoff) {
        rateLimitMap.delete(key);
      }
    }
  }

  return true; // Request allowed
}

/**
 * POST /api/user/preferences-popup-shown
 *
 * Marks the preferences v2 announcement popup as shown for the authenticated user.
 * Updates the profiles.preferences_v2_shown_at timestamp to the current time.
 *
 * Authentication: Required
 * Rate Limit: 1 request per minute per user
 *
 * @returns { success: boolean, message?: string }
 */
export async function POST() {
  const supabase = createAPIServerClient();

  // Verify user authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { success: false, message: 'Unauthorized' },
      { status: 401 }
    );
  }

  // Check rate limit
  if (!checkRateLimit(user.id)) {
    return NextResponse.json(
      { success: false, message: 'Rate limit exceeded. Please try again later.' },
      { status: 429 }
    );
  }

  try {
    // Update preferences_v2_shown_at to current timestamp
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ preferences_v2_shown_at: new Date().toISOString() })
      .eq('id', user.id);

    if (updateError) {
      console.error('Failed to update preferences_v2_shown_at:', updateError);
      return NextResponse.json(
        { success: false, message: 'Failed to update profile' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Unexpected error updating preferences_v2_shown_at:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
