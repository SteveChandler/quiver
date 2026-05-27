/**
 * POST /api/events/link
 *
 * Links anonymous events (tracked by sessionId) to an authenticated user.
 * Called after sign-in to attribute pre-auth behavior to the new account.
 *
 * Request body: { sessionId: string }
 * Response: { ok: boolean, linked: number }
 */

import {
  createErrorResponse,
  createSuccessResponse,
  withAuth,
} from '@/lib/middleware/api-wrappers';
import { createServiceRoleClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

import { isValidUUID } from '@/lib/utils/validation';

export const POST = withAuth(async (request, { user }) => {
  const body = await request.json();
  const { sessionId } = body;

  if (!sessionId || typeof sessionId !== 'string' || !isValidUUID(sessionId)) {
    return createErrorResponse('Invalid or missing sessionId', undefined, 400);
  }

  const started = Date.now();
  const serviceClient = createServiceRoleClient();
  // Cast needed: link_anonymous_events function added by migration 20260301130001
  const { data, error } = await (serviceClient.rpc as any)('link_anonymous_events', {
    p_session_id: sessionId,
    p_user_id: user.id,
  });
  const duration_ms = Date.now() - started;
  const events_updated = (data as number) ?? 0;

  // Structured log lets us measure the signup-handoff race: if p95 latency climbs
  // or events_updated=0 is common, events fired between signup and link land
  // stranded under the anonymous session_id. Ingested by Vercel log drains.
  console.log(JSON.stringify({
    event: 'events_link_attempt',
    session_id: sessionId,
    user_id: user.id,
    duration_ms,
    events_updated,
    outcome: error ? 'error' : (events_updated === 0 ? 'no-op' : 'success'),
    error_message: error?.message,
  }));

  if (error) {
    console.error('Error linking anonymous events:', error);
    return createErrorResponse('Failed to link events', undefined, 500);
  }

  return createSuccessResponse({ ok: true, linked: events_updated });
}, { errorMessage: 'Failed to link anonymous events' });
