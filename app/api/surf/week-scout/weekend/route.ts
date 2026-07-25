import { NextRequest, NextResponse } from 'next/server';
import {
  createSuccessResponse,
  withAuth,
  withRateLimit,
  type AuthenticatedContext,
} from '@/lib/middleware/api-wrappers';
import { buildWeekendScoutRanking } from '@/lib/services/discovery/weekend-scout';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

function privateNoStore(response: NextResponse): NextResponse {
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}

async function weekendScoutHandler(
  _request: NextRequest,
  { user }: AuthenticatedContext,
): Promise<NextResponse> {
  if (process.env.WEEKEND_WINDOW_ENABLED !== 'true') {
    return privateNoStore(NextResponse.json(
      { success: false, error: 'Weekend Scout is not enabled' },
      { status: 404 },
    ));
  }

  const result = await buildWeekendScoutRanking(user.id);
  return privateNoStore(createSuccessResponse(result));
}

export const POST = withRateLimit(
  withAuth(weekendScoutHandler, { errorMessage: 'Error generating Weekend Scout forecast' }),
  'surf-discovery',
);
