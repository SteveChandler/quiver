/**
 * POST /api/events/link
 *
 * Links anonymous events (tracked by sessionId) to an authenticated user.
 * Called after sign-in to attribute pre-auth behavior to the new account.
 *
 * Request body: { sessionId: string }
 * Response: { ok: boolean, linked: number }
 */

import { withAuth } from '@/lib/middleware/api-wrappers';
import { createSuccessResponse, createErrorResponse } from '@/lib/api-utils';
import { createServiceRoleClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

import { isValidUUID } from '@/lib/utils/validation';

export const POST = withAuth(async (request, { user }) => {
  const body = await request.json();
  const { sessionId } = body;

  if (!sessionId || typeof sessionId !== 'string' || !isValidUUID(sessionId)) {
    return createErrorResponse('Invalid or missing sessionId', undefined, 400);
  }

  const serviceClient = createServiceRoleClient();
  // Cast needed: link_anonymous_events function added by migration 20260301130001
  const { data, error } = await (serviceClient.rpc as any)('link_anonymous_events', {
    p_session_id: sessionId,
    p_user_id: user.id,
  });

  if (error) {
    console.error('Error linking anonymous events:', error);
    return createErrorResponse('Failed to link events', undefined, 500);
  }

  return createSuccessResponse({ ok: true, linked: data ?? 0 });
}, { errorMessage: 'Failed to link anonymous events' });
