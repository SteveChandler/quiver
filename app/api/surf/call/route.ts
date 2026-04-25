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
import { applyForceVerdict } from '@/lib/utils/dev-force-verdict';

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

  // Narrow column list — only what getSpotSurfReport, selectBestWindow, and
  // computeSurfCall actually read. Skips the heavy text/jsonb columns
  // (description, terrain_*, access_tips, geog, etc.) that the surf-call
  // chain doesn't touch but `select('*')` would otherwise pull on every
  // 5-min refetch from the native client.
  const { data: beach, error: beachError } = await supabase
    .from('beaches')
    .select(
      'id, name, slug, lat, lon, city, state, country, region, ' +
      'timezone, break_type, skill_level, cdip_station, cdip_eligible, ' +
      'wind_offshore_deg, swell_window_center_deg, swell_access_factors, ' +
      'wind_exposure_factors, preferred_tide_direction, preferred_tide_ft_min, ' +
      'preferred_tide_ft_max, tide_direction_sensitivity, preference_model, ' +
      'features, hazards, average_rating, review_count, deleted_at',
    )
    .eq('id', beachId)
    .is('deleted_at', null)
    .single();

  if (beachError || !beach) {
    return NextResponse.json(
      { success: false, error: 'Beach not found' },
      { status: 404 }
    );
  }

  const rawResult = await getSpotSurfReport(beach as unknown as Beach);
  if (!rawResult) {
    return NextResponse.json(
      { success: false, error: 'Unable to compute surf call' },
      { status: 503 }
    );
  }

  const result = applyForceVerdict(
    rawResult,
    searchParams.get('_forceVerdict'),
    process.env.NODE_ENV !== 'production',
  );

  const response = createSuccessResponse(result);
  response.headers.set('Cache-Control', 'private, max-age=300, stale-while-revalidate=900');
  return response;
}

export const GET = withRateLimit(
  withAuth(surfCallHandler, { errorMessage: 'Error computing surf call' }),
  'surf-discovery'
);
