/**
 * POST /api/events/link
 *
 * Links anonymous events (tracked by sessionId) to an authenticated user.
 * Called after sign-in to attribute pre-auth behavior to the new account.
 *
 * Request body: { sessionId: string, signupContext?: SignupContextV2 }
 * Response: acquisition-safe link outcome fields
 */

import {
  createErrorResponse,
  createSuccessResponse,
  withAuth,
} from '@/lib/middleware/api-wrappers';
import { createServiceRoleClient } from '@/lib/supabase';
import { parseSignupContextV2 } from '@/lib/analytics/acquisition-context';

export const dynamic = 'force-dynamic';

import { isValidUUID } from '@/lib/utils/validation';

interface LinkAnonymousEventsResult {
  linked: number;
  attribution_outcome: string;
  signup_surface: string;
  evidence_source: string;
}

const EMPTY_LINK_RESULT: LinkAnonymousEventsResult = {
  linked: 0,
  attribution_outcome: 'no_evidence',
  signup_surface: 'unknown',
  evidence_source: 'none',
};

function normalizeLinkResult(data: unknown): LinkAnonymousEventsResult {
  if (!data || typeof data !== 'object') return EMPTY_LINK_RESULT;

  const result = data as Partial<LinkAnonymousEventsResult>;
  return {
    linked: typeof result.linked === 'number' ? result.linked : 0,
    attribution_outcome:
      typeof result.attribution_outcome === 'string'
        ? result.attribution_outcome
        : 'no_evidence',
    signup_surface:
      typeof result.signup_surface === 'string'
        ? result.signup_surface
        : 'unknown',
    evidence_source:
      typeof result.evidence_source === 'string'
        ? result.evidence_source
        : 'none',
  };
}

export const POST = withAuth(async (request, { user }) => {
  const body = await request.json();
  const { sessionId, signupContext } = body;

  if (!sessionId || typeof sessionId !== 'string' || !isValidUUID(sessionId)) {
    return createErrorResponse('Invalid or missing sessionId', undefined, 400);
  }

  let validatedSignupContext = null;
  if (signupContext !== undefined) {
    try {
      validatedSignupContext = parseSignupContextV2(signupContext);
    } catch {
      return createErrorResponse('Invalid signupContext', undefined, 400);
    }
  }

  const started = Date.now();
  const serviceClient = createServiceRoleClient();
  // Cast needed until generated types include the approval-gated v2 migration.
  const { data, error } = await (serviceClient.rpc as any)('link_anonymous_events_v2', {
    p_session_id: sessionId,
    p_user_id: user.id,
    p_signup_context: validatedSignupContext,
  });
  const duration_ms = Date.now() - started;
  const result = normalizeLinkResult(data);
  const events_updated = result.linked;

  // Structured log lets us measure the signup-handoff race: if p95 latency climbs
  // or events_updated=0 is common, events fired between signup and link land
  // stranded under the anonymous session_id. Ingested by Vercel log drains.
  console.log(JSON.stringify({
    event: 'events_link_attempt',
    session_id: sessionId,
    user_id: user.id,
    duration_ms,
    events_updated,
    attribution_outcome: result.attribution_outcome,
    signup_surface: result.signup_surface,
    evidence_source: result.evidence_source,
    outcome: error ? 'error' : (events_updated === 0 ? 'no-op' : 'success'),
  }));

  if (error) {
    console.error('Error linking anonymous events:', error);
    return createErrorResponse('Failed to link events', undefined, 500);
  }

  return createSuccessResponse({
    ok: true,
    linked: events_updated,
    attributionOutcome: result.attribution_outcome,
    signupSurface: result.signup_surface,
    evidenceSource: result.evidence_source,
  });
}, { errorMessage: 'Failed to link anonymous events' });
