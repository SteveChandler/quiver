import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  withAuth,
  withRateLimit,
  createSuccessResponse,
  validateOrError,
  type AuthenticatedContext,
} from '@/lib/middleware/api-wrappers';
import {
  getSpotSurfReport,
  type SpotSurfReportResult,
} from '@/actions/spot/spot-surf-report-actions';
import type { Beach } from '@/types/database';
import { applyForceVerdict } from '@/lib/utils/dev-force-verdict';
import { normalizeBoardClass } from '@/lib/domains/rideability';
import { entitlementFromRow } from '@/lib/alerts/entitlements';
import { getProfileExperienceLevel } from '@/lib/profile/skill-level';
import { resolveCanonicalSessionDecision } from '@/lib/recommendations/canonical-decision';
import type { CanonicalSessionDecision } from '@/lib/recommendations/canonical-decision/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 15;

const QuerySchema = z.object({
  beachId: z.string().uuid({ message: 'beachId must be a valid UUID' }),
});

type CanonicalSurfCallResponse = SpotSurfReportResult & {
  sessionDecision: CanonicalSessionDecision;
};

function applyCanonicalDecisionToSurfCall(
  result: SpotSurfReportResult,
  decision: CanonicalSessionDecision,
  requestedBeachId: string,
): CanonicalSurfCallResponse {
  const selection = decision.selection;
  const selectionMatchesRequest =
    decision.verdict !== 'no' &&
    selection !== null &&
    selection.beachId === requestedBeachId;

  if (!selectionMatchesRequest) {
    return {
      ...result,
      report: {
        ...result.report,
        verdict: 'NO',
        bestWindowStart: null,
        bestWindowEnd: null,
        windowMinutes: null,
        shortWindow: false,
        whySentence: '',
        score: 0,
        peakTime: null,
        trendTags: [],
        character: null,
        tiers: null,
      },
      sessionDecision: decision,
    };
  }

  return {
    ...result,
    report: {
      ...result.report,
      verdict: decision.verdict === 'go' ? 'YES' : 'MAYBE',
      bestWindowStart: selection.windowStart,
      bestWindowEnd: selection.windowEnd,
      peakTime: selection.windowStart,
    },
    sessionDecision: decision,
  };
}

/**
 * GET /api/surf/call?beachId=<uuid>&boardClass=<BoardClass>
 *
 * Returns a personalized surf-call verdict for a single beach.
 * Consumed by the Quiver Native app so the native surf call matches web exactly.
 *
 * Authentication: required (user session)
 * Rate limit: surf-discovery bucket (shared with /api/surf/discover)
 * Cache: private no-store; physical forecast computation remains internally cached.
 */
async function surfCallHandler(
  request: NextRequest,
  { user, supabase }: AuthenticatedContext
): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const validation = validateOrError(QuerySchema, {
    beachId: searchParams.get('beachId') ?? undefined,
  });
  if ('error' in validation) {
    return validation.error;
  }

  const { beachId } = validation.data;
  const boardClass = normalizeBoardClass(searchParams.get('boardClass'));

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
      'wind_offshore_deg, wind_offshore_tol_deg, ' +
      'wind_cross_shore_ok_kt, wind_onshore_bad_kt, ' +
      'swell_window_center_deg, swell_window_halfwidth_deg, ' +
      'swell_access_factors, wind_exposure_factors, ' +
      'preferred_tide_direction, preferred_tide_ft_min, ' +
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
  const typedBeach = beach as unknown as Beach;

  const rawResult = await getSpotSurfReport(
    typedBeach,
    boardClass,
    { user, supabase }
  );
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
  ) as SpotSurfReportResult;

  let profileExperience: unknown = null;
  try {
    profileExperience = await getProfileExperienceLevel(supabase, user.id);
  } catch {
    profileExperience = null;
  }
  const { data: entitlementRow } = await supabase
    .from('user_entitlements')
    .select('is_pro, is_trialing, billing_issue, expires_at')
    .eq('user_id', user.id)
    .maybeSingle();
  const isPro = entitlementFromRow(entitlementRow ?? null) === 'premium';
  const anchor = new Date();
  const anchorTime = anchor.toISOString();
  const sessionDecision = await resolveCanonicalSessionDecision({
    userId: user.id,
    profileExperience,
    anchorTime,
    scope: {
      kind: 'plan_next_session',
      windowStart: anchorTime,
      windowEnd: new Date(anchor.getTime() + 24 * 60 * 60 * 1000).toISOString(),
      timezone: typedBeach.timezone ?? 'UTC',
    },
    discoveryOptions: {
      userLocation:
        typedBeach.lat !== null && typedBeach.lon !== null
          ? { lat: typedBeach.lat, lon: typedBeach.lon }
          : undefined,
      horizonHours: 24,
      includeBeachIds: [beachId],
      isPro,
    },
  });

  return createSuccessResponse(
    applyCanonicalDecisionToSurfCall(result, sessionDecision, beachId),
  );
}

const protectedGET = withRateLimit(
  withAuth(surfCallHandler, { errorMessage: 'Error computing surf call' }),
  'surf-discovery'
);

export const GET = async (
  ...args: Parameters<typeof protectedGET>
): Promise<NextResponse> => {
  const response = await protectedGET(...args);
  response.headers.delete('ETag');
  response.headers.set(
    'Cache-Control',
    'private, no-store, no-cache, must-revalidate',
  );
  return response;
};
