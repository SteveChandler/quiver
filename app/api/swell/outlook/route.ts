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
import { withErrorNoStore } from "@/lib/middleware/api-wrappers/error-cache-wrapper";

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
    includeDays: true,
  });
  return NextResponse.json(outlook);
}

const handleGet = withNoStore(
  withRateLimit(withAuth(outlookHandler, { errorMessage: 'Error loading swell outlook' }), 'surf-discovery'),
);

export const GET = withErrorNoStore(handleGet, "/api/swell/outlook");
