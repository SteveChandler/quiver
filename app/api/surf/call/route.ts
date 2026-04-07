import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  withAuth,
  withRateLimit,
  createSuccessResponse,
  validateOrError,
  type AuthenticatedContext,
} from '@/lib/middleware/api-wrappers';
import { getSpotSurfReport } from '@/actions/spot/spot-surf-report-actions';
import type { Beach } from '@/types/database';

export const dynamic = 'force-dynamic';
export const maxDuration = 15;

const QuerySchema = z.object({
  beachId: z.string().uuid({ message: 'beachId must be a valid UUID' }),
});

/**
 * GET /api/surf/call?beachId=<uuid>
 *
 * Returns a personalized surf-call verdict for a single beach.
 * Consumed by the Quiver Native app so the native surf call matches web exactly.
 *
 * Authentication: required (user session)
 * Rate limit: surf-discovery bucket (shared with /api/surf/discover)
 * Cache: private, 5 min
 */
async function surfCallHandler(
  request: NextRequest,
  { supabase }: AuthenticatedContext
): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const validation = validateOrError(QuerySchema, {
    beachId: searchParams.get('beachId') ?? undefined,
  });
  if ('error' in validation) {
    return validation.error;
  }

  const { beachId } = validation.data;

  const { data: beach, error: beachError } = await supabase
    .from('beaches')
    .select('*')
    .eq('id', beachId)
    .is('deleted_at', null)
    .single();

  if (beachError || !beach) {
    return NextResponse.json(
      { success: false, error: 'Beach not found' },
      { status: 404 }
    );
  }

  const result = await getSpotSurfReport(beach as unknown as Beach);
  if (!result) {
    return NextResponse.json(
      { success: false, error: 'Unable to compute surf call' },
      { status: 503 }
    );
  }

  const response = createSuccessResponse(result);
  response.headers.set('Cache-Control', 'private, max-age=300, stale-while-revalidate=900');
  return response;
}

export const GET = withRateLimit(
  withAuth(surfCallHandler, { errorMessage: 'Error computing surf call' }),
  'surf-discovery'
);
