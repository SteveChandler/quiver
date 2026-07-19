import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  createSuccessResponse,
  createValidationError,
  withAuth,
  withRateLimit,
  type AuthenticatedContext,
} from '@/lib/middleware/api-wrappers';
import { loadWeekendScoutSnapshot } from '@/lib/services/discovery/weekend-scout-snapshots';

export const dynamic = 'force-dynamic';

function privateNoStore(response: NextResponse): NextResponse {
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}

async function snapshotHandler(
  _request: NextRequest,
  { user, params }: AuthenticatedContext,
): Promise<NextResponse> {
  if (process.env.WEEKEND_SCOUT_ENABLED !== 'true') {
    return privateNoStore(NextResponse.json(
      { success: false, error: 'Weekend Scout is not enabled' },
      { status: 404 },
    ));
  }

  const parsed = z.string().uuid().safeParse(params.snapshotId);
  if (!parsed.success) return privateNoStore(createValidationError('Invalid snapshot ID'));

  const stored = await loadWeekendScoutSnapshot(user.id, parsed.data);
  if (!stored) {
    return privateNoStore(NextResponse.json(
      { success: false, error: 'Weekend Scout snapshot not found' },
      { status: 404 },
    ));
  }

  return privateNoStore(createSuccessResponse(stored.snapshot));
}

export const GET = withRateLimit(
  withAuth(snapshotHandler, { errorMessage: 'Error loading Weekend Scout snapshot' }),
  'surf-discovery',
);
