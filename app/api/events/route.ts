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

import { NextResponse } from 'next/server';
import {
  createSuccessResponse,
  createAuthError,
  createErrorResponse,
  withAuth,
  type OptionalAuthContext,
} from '@/lib/middleware/api-wrappers';
import {
  ANONYMOUS_ALLOWED_EVENTS,
  buildBfrApiEventMetadata,
  isBfrApiEventMetadata,
  PRE_AUTH_ONLY_EVENTS,
  VALID_EVENTS,
} from '@/lib/analytics/event-taxonomy';
import type {
  ImplicitEventType,
  TrackEventRequest,
} from '@/types/implicit-preferences';
import { getTrackingCache, setTrackingCache } from '@/lib/services/tracking-cache';
import { parseUserAgent } from '@/lib/utils/user-agent-parser';
import { isBot, isSuspiciousFingerprint } from '@/lib/utils/bot-detector';
import { createServiceRoleClient } from '@/lib/supabase';
import { getOwnAnalyticsTrackingAllowed } from '@/lib/analytics/consent';

export const dynamic = 'force-dynamic';

export {
  ANONYMOUS_ALLOWED_EVENTS,
  PRE_AUTH_ONLY_EVENTS,
  VALID_EVENTS,
};

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
function checkRateLimit(userId: string, limit: number = RATE_LIMIT): { allowed: boolean; remaining: number; resetAt: number } {
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
    if (current.count >= limit) {
      return { allowed: false, remaining: 0, resetAt };
    }

    // Increment count
    current.count++;
    return { allowed: true, remaining: limit - current.count, resetAt };
  }

  // New entry - apply LRU eviction if at capacity
  if (rateLimitMap.size >= MAX_RATE_LIMIT_ENTRIES) {
    const oldest = rateLimitOrder.shift();
    if (oldest) rateLimitMap.delete(oldest);
  }

  // Create new entry
  rateLimitOrder.push(userId);
  rateLimitMap.set(userId, { count: 1, resetAt });

  return { allowed: true, remaining: limit - 1, resetAt };
}

const ANON_RATE_LIMIT = 30; // Lower rate limit for anonymous users

import { isValidUUID } from '@/lib/utils/validation';

/**
 * Check if implicit tracking is allowed for a user.
 *
 * Only denials are cached. Retaining an allowed result would let tracking
 * continue after a user revokes consent until the cache expires.
 */
async function isTrackingAllowed(
  supabase: OptionalAuthContext['supabase'],
  userId: string
): Promise<boolean> {
  const cached = getTrackingCache(userId);
  if (cached && !cached.allowed && cached.expires > Date.now()) {
    return false;
  }

  try {
    const allowed = await getOwnAnalyticsTrackingAllowed(supabase, userId);
    if (!allowed) {
      setTrackingCache(userId, {
        allowed: false,
        expires: Date.now() + 5 * 60 * 1000,
      });
    }
    return allowed;
  } catch (error) {
    console.error('Error checking analytics consent:', error);
    return false;
  }
}

/**
 * POST /api/events
 *
 * Authentication: OPTIONAL via withAuth({ optional: true }). Two flows:
 *   • Authenticated (cookie OR Bearer) — writes user-scoped event via
 *     request-scoped supabase client. Native Bearer callers previously
 *     dropped silently because the route ignored Authorization headers.
 *   • Anonymous — requires body.sessionId, writes nullable user_id event
 *     via the service-role client (bypassing RLS). Unchanged.
 */
export const POST = withAuth(
  async (
    request,
    { user, supabase }: OptionalAuthContext
  ) => {
  // 1. Bot filtering — silent 200 OK so bots don't learn they're detected
  const ua = request.headers.get('user-agent') || '';
  const acceptLanguage = request.headers.get('accept-language');

  // UA-based check (known bot patterns)
  if (isBot(ua)) {
    return createSuccessResponse({ ok: true, status: 'bot_filtered' });
  }

  // Header-based heuristics: real browsers always send Accept-Language.
  // Headless clients and programmatic requests commonly omit it.
  // Short or missing UAs are also a strong signal.
  if (!ua || ua.length < 15 || !acceptLanguage) {
    return createSuccessResponse({ ok: true, status: 'bot_filtered' });
  }

  // Headless browser / automation tool signatures not caught by isBot()
  const headlessPatterns = /headlesschrome|phantomjs|selenium|puppeteer|playwright|webdriver|chrome-lighthouse|pagespeed|lighthouse/i;
  if (headlessPatterns.test(ua)) {
    return createSuccessResponse({ ok: true, status: 'bot_filtered' });
  }

  // 2. Parse request body (needed for anonymous flow + fingerprint check)
  let body: TrackEventRequest;
  try {
    body = await request.json();
  } catch {
    return createErrorResponse('Invalid JSON body', undefined, 400);
  }

  // 2a. Fingerprint-based bot filtering (requires body for viewportWidth).
  // Founder account is exempt — keeps Steven's testing visible (he uses Chrome
  // DevTools mobile-emulation, which can collide with Pattern B's 614px width).
  const FOUNDER_USER_ID = '73040cff-afe9-4fa0-a874-2016203fc015';
  if (user?.id !== FOUNDER_USER_ID && isSuspiciousFingerprint(ua, body.viewportWidth)) {
    return createSuccessResponse({ ok: true, status: 'bot_filtered' });
  }

  const { eventType, beachId } = body;
  let eventMetadata = body.metadata;
  if (isBfrApiEventMetadata(eventType, eventMetadata)) {
    const validatedMetadata = buildBfrApiEventMetadata(
      eventType,
      eventMetadata,
    );
    if (!validatedMetadata) {
      return createErrorResponse('Invalid BFR event metadata', undefined, 400);
    }
    eventMetadata = validatedMetadata as TrackEventRequest['metadata'];
  }

  // 3. Device enrichment
  const enrichedMetadata = {
    ...(eventMetadata || {}),
    _device: parseUserAgent(ua),
    ...(body.viewportWidth ? { _viewport_width: body.viewportWidth } : {}),
  };

  // 4. Authenticated flow (user resolved by withAuth from cookie OR Bearer)
  if (user) {
    // Rate limiting check
    const rateLimit = checkRateLimit(user.id);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          ok: false,
          status: 'rate_limited',
          error: 'Too many requests. Please try again later.',
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': RATE_LIMIT.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': Math.ceil(rateLimit.resetAt / 1000).toString(),
            'Retry-After': Math.ceil((rateLimit.resetAt - Date.now()) / 1000).toString(),
          },
        }
      );
    }

    // Privacy gatekeeper
    const allowed = await isTrackingAllowed(supabase, user.id);
    if (!allowed) {
      return createSuccessResponse({ ok: true, status: 'tracking_disabled' });
    }

    // Validate event type
    if (!eventType || !VALID_EVENTS.includes(eventType as ImplicitEventType)) {
      return createErrorResponse(
        `Invalid event type. Must be one of: ${VALID_EVENTS.join(', ')}`,
        undefined,
        400
      );
    }

    // Pre-auth funnel events should not be recorded for authenticated users
    if (PRE_AUTH_ONLY_EVENTS.includes(eventType)) {
      return createSuccessResponse({ ok: true, skipped: true });
    }

    // Insert event
    const { error: insertError } = await (supabase as any).from('user_events').insert({
      user_id: user.id,
      event_type: eventType,
      beach_id: beachId || null,
      metadata: enrichedMetadata,
    });

    if (insertError) {
      console.error('Error inserting event:', insertError);
      return createErrorResponse('Failed to record event', undefined, 500);
    }

    return createSuccessResponse({ ok: true });
  }

  // 5. Anonymous flow — requires sessionId
  if (body.sessionId) {
    if (!isValidUUID(body.sessionId)) {
      return createErrorResponse('Invalid sessionId format', undefined, 400);
    }

    if (!eventType || !ANONYMOUS_ALLOWED_EVENTS.includes(eventType as ImplicitEventType)) {
      return createErrorResponse(
        `Event type not allowed for anonymous users. Must be one of: ${ANONYMOUS_ALLOWED_EVENTS.join(', ')}`,
        undefined,
        400
      );
    }

    const anonRateLimit = checkRateLimit(`anon:${body.sessionId}`, ANON_RATE_LIMIT);
    if (!anonRateLimit.allowed) {
      return NextResponse.json(
        {
          ok: false,
          status: 'rate_limited',
          error: 'Too many requests. Please try again later.',
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': ANON_RATE_LIMIT.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': Math.ceil(anonRateLimit.resetAt / 1000).toString(),
            'Retry-After': Math.ceil((anonRateLimit.resetAt - Date.now()) / 1000).toString(),
          },
        }
      );
    }

    const serviceClient = createServiceRoleClient();
    // Cast needed: session_id column and nullable user_id added by migration 20260301130001
    const { error: insertError } = await serviceClient.from('user_events').insert({
      user_id: null as any,
      session_id: body.sessionId,
      event_type: eventType,
      beach_id: beachId || null,
      metadata: enrichedMetadata,
    } as any);

    if (insertError) {
      console.error('Error inserting anonymous event:', insertError);
      return createErrorResponse('Failed to record event', undefined, 500);
    }

    // Auth failure detection: if a signup_cta_view fires for a session
    // that belongs to a user who signed up in the last 10 minutes, alert
    if (eventType === 'signup_cta_view' && body.sessionId) {
      try {
        const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
        const { data: recentSignup } = await serviceClient
          .from('user_events')
          .select('user_id, metadata')
          .eq('session_id', body.sessionId)
          .eq('event_type', 'signup_success')
          .gte('created_at', tenMinAgo)
          .limit(1)
          .single();

        if (recentSignup?.user_id) {
          const { data: profile } = await serviceClient
            .from('profiles')
            .select('full_name, email')
            .eq('id', recentSignup.user_id)
            .single();

          const { sendAuthFailureAlert } = await import('@/lib/services/new-user-alerts');
          sendAuthFailureAlert({
            userId: recentSignup.user_id,
            email: profile?.email || 'unknown',
            name: profile?.full_name || null,
            signupMethod: (recentSignup.metadata as Record<string, unknown>)?.method as string || 'unknown',
            minutesSinceSignup: 10,
            ctaSource: (enrichedMetadata as Record<string, unknown>)?.source as string || 'unknown',
          }).catch(() => {}); // Fire and forget
        }
      } catch {
        // Don't block event recording for alert failures
      }
    }

    return createSuccessResponse({ ok: true });
  }

  // 6. Neither authenticated nor anonymous sessionId
  return createAuthError('Unauthorized');
  },
  { optional: true, errorMessage: 'Failed to record event' }
);
