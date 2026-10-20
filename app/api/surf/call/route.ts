import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  withAuth,
  withRateLimit,
  createSuccessResponse,
  validateOrError,
  type OptionalAuthContext,
} from '@/lib/middleware/api-wrappers';
import type { RouteContext } from '@/lib/middleware/api-wrappers/types';
import { normalizeBoardClass } from '@/lib/domains/rideability';
import type { BoardClass } from '@/lib/domains/user-preferences';
import { runWithWaterQualityReadScope } from '@/lib/recommendations/major-event-hold/read-scope';
import { computeCanonicalSurfCall } from '@/lib/services/surf-call/canonical-surf-call';
import { retryAfterSeconds } from '@/lib/utils/retry-after';

export const dynamic = 'force-dynamic';
export const maxDuration = 15;

const QuerySchema = z.object({
  beachId: z.string().uuid({ message: 'beachId must be a valid UUID' }),
  forecastAt: z.string().datetime({ offset: true }).optional(),
  includeNow: z.enum(['1', 'true']).optional(),
});

function retryableDiscoveryResponse(error: unknown): NextResponse {
  const candidateCode =
    error && typeof error === 'object' && 'code' in error
      ? error.code
      : undefined;
  const code =
    candidateCode === 'timeout' ||
    candidateCode === 'forecast_unavailable' ||
    candidateCode === 'internal_error'
      ? candidateCode
      : 'internal_error';

  return NextResponse.json(
    {
      success: false,
      error: 'Recommendations are temporarily unavailable',
      code,
      retryable: true,
    },
    {
      status: code === 'timeout' ? 504 : 503,
      headers: { 'Retry-After': String(retryAfterSeconds()) },
    },
  );
}


/**
 * GET /api/surf/call?beachId=<uuid>&boardClass=<BoardClass>&includeNow=1
 *
 * Returns a personalized surf-call verdict for a single beach.
 * Consumed by the Quiver Native app so the native surf call matches web exactly.
 * `includeNow=1` additionally returns the beach's now-mode discovery
 * recommendation (`data.nowRecommendation`), the same object Home's
 * `/api/surf/discover?mode=now` returns, so Beach Detail grades "now" from the
 * producer Home labels with.
 * `data.waterQuality` is the requested beach's resolved water-quality hold,
 * including County kind/check time, optional County general rain advisory
 * start/last-rain/end times, or sample date; null means no resolved hold.
 *
 * Authentication: optional; anonymous requests receive the general surf call
 * Rate limit: surf-call for authenticated requests, public-default by IP for anonymous requests
 * Cache: private no-store; physical forecast computation remains internally cached.
 */
async function surfCallHandler(
  request: NextRequest,
  { user, supabase }: OptionalAuthContext
): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const validation = validateOrError(QuerySchema, {
    beachId: searchParams.get('beachId') ?? undefined,
    forecastAt: searchParams.get('forecastAt') ?? undefined,
    includeNow: searchParams.get('includeNow') ?? undefined,
  });
  if ('error' in validation) {
    return validation.error;
  }

  const { beachId, forecastAt, includeNow } = validation.data;
  const outcome = await computeCanonicalSurfCall({
    supabase,
    userId: user?.id ?? null,
    beachId,
    forecastAt,
    includeNow: Boolean(includeNow),
    boardClass: normalizeBoardClass(searchParams.get('boardClass')) as BoardClass | null,
    forceVerdict: searchParams.get('_forceVerdict'),
  });
  if (outcome.status === 'not_found') {
    return NextResponse.json(
      { success: false, error: 'Beach not found' },
      { status: 404 }
    );
  }
  if (outcome.status === 'unavailable') {
    return retryableDiscoveryResponse(outcome.error);
  }

  return createSuccessResponse(outcome.result);
}


const authenticatedRateLimitedGET = withRateLimit(
  (request, context) =>
    surfCallHandler(request, context as OptionalAuthContext),
  'surf-call',
);
const anonymousRateLimitedGET = withRateLimit(
  (request, context) =>
    surfCallHandler(request, context as OptionalAuthContext),
  'public-default',
);
const optionalGET = withAuth(
  async (request, context: OptionalAuthContext): Promise<NextResponse> =>
    (context.user ? authenticatedRateLimitedGET : anonymousRateLimitedGET)(
      request,
      context,
    ),
  {
    optional: true,
    rejectInvalidCredentials: true,
    errorMessage: 'Error computing surf call',
  },
);

export const GET = async (
  request: NextRequest,
  context?: RouteContext,
): Promise<NextResponse> => {
  // Discovery and the canonical decision each resolve water-quality holds;
  // the scope lets them share one read of each hold table per request.
  const response = await runWithWaterQualityReadScope(() =>
    optionalGET(request, context),
  );
  response.headers.delete('ETag');
  response.headers.set(
    'Cache-Control',
    'private, no-store, no-cache, must-revalidate',
  );
  return response;
};
