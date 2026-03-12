/**
 * POST /api/embed-impressions
 *
 * Records an anonymous embed widget impression for outreach analytics.
 * No auth required — embed visitors are anonymous.
 * Uses service role client to bypass RLS for writes.
 *
 * Request body: { widgetType: 'tides' | 'conditions' | 'surf-terminal' | 'ticker', beachSlug: string }
 * Response: 204 No Content
 */

import { createSupabaseServiceRoleClient } from '@/lib/supabase/server';
import {
  createValidationError,
  createErrorResponse,
  DEFAULT_SECURITY_HEADERS,
} from '@/lib/api-utils';

export const dynamic = 'force-dynamic';

// =============================================================================
// Rate Limiting (IP-based, in-memory, matching app/api/events/route.ts pattern)
// =============================================================================

const RATE_LIMIT = 30;
const RATE_WINDOW_MS = 60_000;
const MAX_ENTRIES = 10_000;

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const rateLimitOrder: string[] = [];

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (entry && entry.resetAt <= now) {
    rateLimitMap.delete(ip);
    const idx = rateLimitOrder.indexOf(ip);
    if (idx !== -1) rateLimitOrder.splice(idx, 1);
  }

  const current = rateLimitMap.get(ip);

  if (current) {
    if (current.count >= RATE_LIMIT) return false;
    current.count++;
    return true;
  }

  if (rateLimitMap.size >= MAX_ENTRIES) {
    const oldest = rateLimitOrder.shift();
    if (oldest) rateLimitMap.delete(oldest);
  }

  rateLimitOrder.push(ip);
  rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
  return true;
}

// =============================================================================
// Validation
// =============================================================================

const VALID_WIDGET_TYPES = ['tides', 'conditions', 'surf-terminal', 'ticker'] as const;
const SLUG_PATTERN = /^[a-z0-9-]+$/;
const MAX_SLUG_LENGTH = 200;

const INTERNAL_DOMAINS = ['localhost', 'www.quiversurf.app', 'dev.quiversurf.app', 'quiversurf.app'];

function extractReferrerDomain(request: Request): string | null {
  const referer = request.headers.get('referer');
  if (!referer) return null;
  try {
    const url = new URL(referer);
    return url.hostname || null;
  } catch {
    return null;
  }
}

function isInternalReferrer(domain: string | null): boolean {
  if (!domain) return false;
  return INTERNAL_DOMAINS.includes(domain);
}

// =============================================================================
// Handler
// =============================================================================

export async function POST(request: Request) {
  // 1. Rate limit by IP
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown';

  if (!checkRateLimit(ip)) {
    return new Response(null, { status: 429, headers: DEFAULT_SECURITY_HEADERS });
  }

  // 2. Parse body
  let body: { widgetType?: string; beachSlug?: string };
  try {
    body = await request.json();
  } catch {
    return createValidationError('Invalid JSON body');
  }

  const { widgetType, beachSlug } = body;

  // 3. Validate
  if (
    !widgetType ||
    !VALID_WIDGET_TYPES.includes(widgetType as (typeof VALID_WIDGET_TYPES)[number])
  ) {
    return createValidationError('Invalid widgetType');
  }

  if (
    !beachSlug ||
    typeof beachSlug !== 'string' ||
    beachSlug.length > MAX_SLUG_LENGTH ||
    !SLUG_PATTERN.test(beachSlug)
  ) {
    return createValidationError('Invalid beachSlug');
  }

  // 4. Extract referrer domain server-side — skip internal traffic
  const referrerDomain = extractReferrerDomain(request);
  if (isInternalReferrer(referrerDomain)) {
    return new Response(null, { status: 204, headers: DEFAULT_SECURITY_HEADERS });
  }

  // 5. Insert via service role (bypasses RLS)
  try {
    const supabase = createSupabaseServiceRoleClient();
    const { error } = await supabase.from('embed_impressions').insert({
      widget_type: widgetType,
      beach_slug: beachSlug,
      referrer_domain: referrerDomain,
    });

    if (error) {
      console.error('Error inserting embed impression:', error);
      return createErrorResponse('Failed to record impression', undefined, 500);
    }
  } catch (err) {
    console.error('Service role client error:', err);
    return createErrorResponse('Failed to record impression', undefined, 500);
  }

  // 6. Return no-content response (client-side is fire-and-forget via .catch(() => {}))
  return new Response(null, { status: 204, headers: DEFAULT_SECURITY_HEADERS });
}
