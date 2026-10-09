import { NextRequest, NextResponse } from 'next/server';

import {
  withAuth,
  withNoStore,
  withRateLimit,
  type AuthenticatedContext,
} from '@/lib/middleware/api-wrappers';
import { isSwellOutlookEnabled, isSwellOutlookUserAllowed } from '@/lib/flags/swell-outlook';
import { loadSwellOutlookForUser } from '@/lib/services/discovery/swell-outlook-loader';
import { createSupabaseServiceRoleClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// Native clients parse the bare SwellOutlookResponse; do not wrap it in a success envelope.
async function outlookHandler(_request: NextRequest, { user }: AuthenticatedContext): Promise<NextResponse> {
  if (!isSwellOutlookEnabled() || !isSwellOutlookUserAllowed(user.id)) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  const outlook = await loadSwellOutlookForUser({
    client: createSupabaseServiceRoleClient(),
    userId: user.id,
    now: new Date(),
    recordOpen: true,
  });
  return NextResponse.json(outlook);
}

export const GET = withNoStore(
  withRateLimit(withAuth(outlookHandler, { errorMessage: 'Error loading swell outlook' }), 'surf-discovery'),
);
