/**
 * POST /api/events
 *
 * Records a user behavioral event for implicit preference learning.
 * Respects user privacy settings (allow_implicit_tracking).
 * Includes per-user rate limiting to prevent abuse.
 *
 * Request body: { eventType: ImplicitEventType, beachId?: string, metadata?: EventMetadata }
 * Response: { ok: boolean, status?: 'tracking_disabled' | 'rate_limited' }
 */

import { createAPIServerClient } from '@/lib/supabase/api-server-client';
import {
  createSuccessResponse,
  createAuthError,
  createErrorResponse,
} from '@/lib/api-utils';
import type {
  ImplicitEventType,
  TrackEventRequest,
} from '@/types/implicit-preferences';
import { getTrackingCache, setTrackingCache } from '@/lib/services/tracking-cache';

export const dynamic = 'force-dynamic';

// =============================================================================
// Rate Limiting Configuration
// =============================================================================

/**
 * IMPORTANT: Rate limiting is in-memory and ephemeral.
 * In serverless environments (Vercel), this resets on cold starts and
 * is not shared across function instances.
 *
 * This is acceptable for low-stakes tracking events where:
 * - Occasional duplicate events are tolerable
 * - Perfect rate limiting is not security-critical
 * - The cost of a distributed solution (Redis/Upstash) outweighs benefits
 *
 * For production abuse prevention at scale, consider migrating to
 * distributed rate limiting with Redis, Upstash, or similar.
 */

const RATE_LIMIT = 60; // Max events per window
const RATE_WINDOW_MS = 60_000; // 1 minute window
const MAX_RATE_LIMIT_ENTRIES = 10000; // LRU eviction threshold

// Per-user rate limit tracking with LRU eviction (ephemeral in serverless)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const rateLimitOrder: string[] = [];

/**
 * Check and update rate limit for a user
 * Returns true if within limits, false if rate limited
 */
function checkRateLimit(userId: string): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const entry = rateLimitMap.get(userId);

  // Reset if window expired
  if (entry && entry.resetAt <= now) {
    rateLimitMap.delete(userId);
    const idx = rateLimitOrder.indexOf(userId);
    if (idx !== -1) rateLimitOrder.splice(idx, 1);
  }

  const current = rateLimitMap.get(userId);
  const resetAt = current?.resetAt ?? now + RATE_WINDOW_MS;

  if (current) {
    // Check if over limit
    if (current.count >= RATE_LIMIT) {
      return { allowed: false, remaining: 0, resetAt };
    }

    // Increment count
    current.count++;
    return { allowed: true, remaining: RATE_LIMIT - current.count, resetAt };
  }

  // New entry - apply LRU eviction if at capacity
  if (rateLimitMap.size >= MAX_RATE_LIMIT_ENTRIES) {
    const oldest = rateLimitOrder.shift();
    if (oldest) rateLimitMap.delete(oldest);
  }

  // Create new entry
  rateLimitOrder.push(userId);
  rateLimitMap.set(userId, { count: 1, resetAt });

  return { allowed: true, remaining: RATE_LIMIT - 1, resetAt };
}

// =============================================================================
// Event Configuration
// =============================================================================

const VALID_EVENTS: ImplicitEventType[] = [
  // Implicit preference learning events
  'beach_view',
  'discovery_click',
  'discovery_skip',
  'forecast_check',
  'location_update',
  // Engagement tracking events
  'page_view',
  'forecast_interaction',
  'session_action',
  'profile_update',
  'onboarding_step',
  'cta_click',
  // Review tracking events
  'review_form_open',
  'review_form_abandon',
  'review_validation_error',
  'review_submit',
  // Social tracking events
  'social_follow',
  'social_like',
  'social_share',
  'social_invite_send',
  'social_invite_respond',
  'social_intel_confirm',
];

/**
 * Check if implicit tracking is allowed for a user
 * Uses 5-minute in-memory cache to reduce database queries
 */
async function isTrackingAllowed(
  supabase: Awaited<ReturnType<typeof createAPIServerClient>>,
  userId: string
): Promise<boolean> {
  // Check cache first (using LRU-aware getter)
  const cached = getTrackingCache(userId);
  if (cached && cached.expires > Date.now()) {
    return cached.allowed;
  }

  // Query database
  const { data } = await supabase
    .from('profiles')
    .select('allow_implicit_tracking')
    .eq('id', userId)
    .single();

  // Default to true if no preference set
  const allowed = data?.allow_implicit_tracking !== false;

  // Cache for 5 minutes (using LRU-aware setter)
  setTrackingCache(userId, {
    allowed,
    expires: Date.now() + 5 * 60 * 1000,
  });

  return allowed;
}

export async function POST(request: Request) {
  const supabase = await createAPIServerClient();

  // 1. Auth check
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return createAuthError('Unauthorized');
  }

  // 2. Rate limiting check
  const rateLimit = checkRateLimit(user.id);
  if (!rateLimit.allowed) {
    return new Response(
      JSON.stringify({
        ok: false,
        status: 'rate_limited',
        error: 'Too many requests. Please try again later.',
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'X-RateLimit-Limit': RATE_LIMIT.toString(),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': Math.ceil(rateLimit.resetAt / 1000).toString(),
          'Retry-After': Math.ceil((rateLimit.resetAt - Date.now()) / 1000).toString(),
        },
      }
    );
  }

  // 3. Privacy gatekeeper
  const allowed = await isTrackingAllowed(supabase, user.id);
  if (!allowed) {
    // Return success to client (don't retry) but don't write data
    return createSuccessResponse({ ok: true, status: 'tracking_disabled' });
  }

  // 4. Parse and validate request
  let body: TrackEventRequest;
  try {
    body = await request.json();
  } catch {
    return createErrorResponse('Invalid JSON body', undefined, 400);
  }

  const { eventType, beachId, metadata } = body;

  if (!eventType || !VALID_EVENTS.includes(eventType as ImplicitEventType)) {
    return createErrorResponse(
      `Invalid event type. Must be one of: ${VALID_EVENTS.join(', ')}`,
      undefined,
      400
    );
  }

  // 5. Insert event
  const { error: insertError } = await supabase.from('user_events').insert({
    user_id: user.id,
    event_type: eventType,
    beach_id: beachId || null,
    metadata: metadata || {},
  });

  if (insertError) {
    console.error('Error inserting event:', insertError);
    return createErrorResponse('Failed to record event', undefined, 500);
  }

  return createSuccessResponse({ ok: true });
}
