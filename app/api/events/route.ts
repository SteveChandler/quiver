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
import { parseUserAgent } from '@/lib/utils/user-agent-parser';
import { isBot, isSuspiciousFingerprint } from '@/lib/utils/bot-detector';
import { createServiceRoleClient } from '@/lib/supabase';

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
  // Share tracking events
  'share_started',
  'share_completed',
  'share_link_copied',
  'share_image_saved',
  'cam_share',
  'share_intel_button_clicked',
  'share_intel_signin_prompt',
  'surf_plan_share',
  // Signup/auth conversion events
  'signup_cta_click',
  'signup_cta_view',
  'signin_cta_click',
  // Auth funnel events (fire before user is authenticated)
  'auth_modal_opened',
  'auth_modal_closed_without_action',
  'auth_method_selected',
  'auth_provider_selected',
  'signup_started',
  'signup_success',
  'login_success',
  'signup_form_submitted',
  // Home screen events
  'home_at_beach_click',
  'home_plan_weekend_click',
  'home_plan_weekend_no_recommendation',
  // Session logging events
  'session_log_start',
  'session_log_submit',
  'session_share_opened_post_save',
  'session_share_closed_post_save',
  // Onboarding/tour events
  'product_tour_started',
  'product_tour_completed',
  'product_tour_skipped',
  'product_tour_step_viewed',
  // Beach detail events
  'beach_search',
  'forecast_tab_click',
  'horizon_strip_day_selected',
  'match_score_teaser_click',
  'match_score_teaser_view',
  'set_home_beach',
  'map_marker_click',
  // Intel events
  'local_intel_tab_viewed',
  'intel_post_created',
  'intel_post_confirmed',
  'plan_session_from_intel',
  // Profile events
  'surf_profile_viewed',
  'surf_profile_progress_shown',
  // Discovery events
  'personalized_score_shown',
  'favorite_shown_in_carousel',
  'mini_log_teaser_click',
  'plan_unlock_click',
  // Social events
  'social_follow',
  'social_like',
  'social_invite_send',
  'social_invite_respond',
  'social_intel_confirm',
  // Tab and map engagement events
  'tab_view',
  'map_interaction',
  // Map engagement
  'map_ready',
  'map_load_failed',
  // Forecast reliability
  'forecast_ready',
  // Session log funnel
  'session_log_beach_selected',
  'session_log_rating_set',
  'session_log_photo_added',
  'session_log_abandon',
  // Search
  'beach_search_result_click',
  // Growth markers
  'first_beach_view_post_signup',
  // Empty states & impressions
  'empty_state_shown',
  'cta_impression',
  // Reliability
  'client_error',
  // Engagement depth (anon + auth)
  'scroll_depth',
  'time_on_page',
];

const ANONYMOUS_ALLOWED_EVENTS: ImplicitEventType[] = [
  'page_view', 'beach_view', 'tab_view', 'onboarding_step',
  // Conversion tracking (critical for understanding anon→authed funnel)
  'signup_cta_click', 'signup_cta_view', 'signin_cta_click', 'cta_click',
  // Auth funnel events (fire before user is authenticated — must be anonymous-allowed)
  'auth_modal_opened', 'auth_modal_closed_without_action',
  'auth_method_selected', 'auth_provider_selected',
  'signup_started', 'signup_success', 'login_success', 'signup_form_submitted',
  // Engagement signals from anonymous visitors
  'forecast_interaction', 'forecast_tab_click', 'horizon_strip_day_selected',
  'beach_search', 'beach_search_result_click', 'map_interaction', 'map_marker_click',
  'share_started', 'share_completed', 'share_link_copied',
  'match_score_teaser_view', 'match_score_teaser_click',
  // Map reliability (anon visitors hit the map immediately)
  'map_ready', 'map_load_failed',
  // Forecast reliability
  'forecast_ready',
  // Empty states + CTA impressions
  'empty_state_shown', 'cta_impression',
  // Client error capture
  'client_error',
  // Engagement depth
  'scroll_depth', 'time_on_page',
];

const ANON_RATE_LIMIT = 30; // Lower rate limit for anonymous users

import { isValidUUID } from '@/lib/utils/validation';

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

  // 2. Parse request body first (before auth check, needed for anonymous flow)
  let body: TrackEventRequest;
  try {
    body = await request.json();
  } catch {
    return createErrorResponse('Invalid JSON body', undefined, 400);
  }

  // 2a. Fingerprint-based bot filtering (requires body for viewportWidth)
  if (isSuspiciousFingerprint(ua, body.viewportWidth)) {
    return createSuccessResponse({ ok: true, status: 'bot_filtered' });
  }

  // 3. Device enrichment
  const enrichedMetadata = {
    ...(body.metadata || {}),
    _device: parseUserAgent(ua),
    ...(body.viewportWidth ? { _viewport_width: body.viewportWidth } : {}),
  };

  const { eventType, beachId } = body;

  // 4. Try auth
  const supabase = await createAPIServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (!authError && user) {
    // Authenticated flow

    // Rate limiting check
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
    // These events are only meaningful when tracking anon → authed conversion
    const PRE_AUTH_ONLY_EVENTS = [
      'signup_cta_view',
      'signup_cta_click',
      'signin_cta_click',
      'signup_form_submitted',
      'auth_modal_opened',
      'auth_modal_closed_without_action',
    ];

    if (PRE_AUTH_ONLY_EVENTS.includes(eventType)) {
      return createSuccessResponse({ ok: true, skipped: true });
    }

    // Insert event
    const { error: insertError } = await supabase.from('user_events').insert({
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
}
