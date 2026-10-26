import { NextRequest, NextResponse } from 'next/server';

import {
  withAuth,
  withNoStore,
  withRateLimit,
  type AuthenticatedContext,
} from '@/lib/middleware/api-wrappers';
import { isSwellOutlookEnabled, isSwellOutlookUserAllowed } from '@/lib/flags/swell-outlook';
import { loadBriefingForOutlook } from '@/lib/services/discovery/swell-briefing-serve';
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
  const client = createSupabaseServiceRoleClient();
  const now = new Date();
  const outlook = await loadSwellOutlookForUser({
    client,
    userId: user.id,
    now,
    recordOpen: true,
    includeDays: true,
  });

  // Additive and optional: a reader with no saved edition gets exactly the
  // response it got before, and the native parser leaves the existing swell
  // list alone when `briefing` is absent.
  const briefing = await loadBriefingForOutlook({ client, userId: user.id, now });
  return NextResponse.json(briefing === null ? outlook : { ...outlook, briefing });
}

export const GET = withNoStore(
  withRateLimit(withAuth(outlookHandler, { errorMessage: 'Error loading swell outlook' }), 'surf-discovery'),
);
