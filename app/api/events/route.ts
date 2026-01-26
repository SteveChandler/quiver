/**
 * POST /api/events
 *
 * Records a user behavioral event for implicit preference learning.
 * Respects user privacy settings (allow_implicit_tracking).
 *
 * Request body: { eventType: ImplicitEventType, beachId?: string, metadata?: EventMetadata }
 * Response: { ok: boolean, status?: 'tracking_disabled' }
 */

import { createAPIServerClient } from '@/lib/supabase/server';
import {
  createSuccessResponse,
  createAuthError,
  createErrorResponse,
} from '@/lib/api-utils';
import type {
  ImplicitEventType,
  TrackEventRequest,
} from '@/types/implicit-preferences';
import { trackingAllowedCache } from '@/lib/services/tracking-cache';

export const dynamic = 'force-dynamic';

const VALID_EVENTS: ImplicitEventType[] = [
  'beach_view',
  'discovery_click',
  'discovery_skip',
  'forecast_check',
  'location_update',
];

/**
 * Check if implicit tracking is allowed for a user
 * Uses 5-minute in-memory cache to reduce database queries
 */
async function isTrackingAllowed(
  supabase: ReturnType<typeof createAPIServerClient>,
  userId: string
): Promise<boolean> {
  // Check cache first
  const cached = trackingAllowedCache.get(userId);
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

  // Cache for 5 minutes
  trackingAllowedCache.set(userId, {
    allowed,
    expires: Date.now() + 5 * 60 * 1000,
  });

  return allowed;
}

export async function POST(request: Request) {
  const supabase = createAPIServerClient();

  // 1. Auth check
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return createAuthError('Unauthorized');
  }

  // 2. Privacy gatekeeper
  const allowed = await isTrackingAllowed(supabase, user.id);
  if (!allowed) {
    // Return success to client (don't retry) but don't write data
    return createSuccessResponse({ ok: true, status: 'tracking_disabled' });
  }

  // 3. Parse and validate request
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

  // 4. Insert event
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
