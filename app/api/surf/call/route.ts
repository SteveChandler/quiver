import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  withAuth,
  withRateLimit,
  createSuccessResponse,
  validateOrError,
  type AuthenticatedContext,
} from '@/lib/middleware/api-wrappers';
import type { SpotSurfReportResult } from '@/actions/spot/spot-surf-report-actions';
import type { Beach } from '@/types/database';
import { applyForceVerdict } from '@/lib/utils/dev-force-verdict';
import { normalizeBoardClass } from '@/lib/domains/rideability';
import { entitlementFromRow } from '@/lib/alerts/entitlements';
import { getProfileExperienceLevel } from '@/lib/profile/skill-level';
import { resolveCanonicalSessionDecisionContext } from '@/lib/recommendations/canonical-decision';
import type { CanonicalSessionDecision } from '@/lib/recommendations/canonical-decision/types';
import type { SurfDiscoveryRecommendation } from '@/types/personalization';
import { buildForecastRecommendationContext } from '@/lib/services/forecast-recommendation-context';
import {
  computeSurfCall,
  computeSurfCallTiers,
} from '@/lib/utils/surf-call-logic';
import { isFutureDayInTimezone } from '@/lib/utils/condition-tier-utils';
import { checkBoardFit } from '@/lib/domains/scoring/discovery-adapter';
import type { BoardClass, SkillLevel } from '@/lib/domains/user-preferences';
import type { RecommendationAvailability } from '@/lib/recommendations/major-event-hold/types';
import { resolveScopedRecommendationAvailability } from '@/lib/services/discovery/discovery-availability';
import {
  FORECAST_ALIGNMENT_TOLERANCE_MINUTES,
  resolveForecastAlignment,
  type SurfCallForecastAlignment,
} from '@/lib/services/discovery/forecast-alignment';

export const dynamic = 'force-dynamic';
export const maxDuration = 15;

const QuerySchema = z.object({
  beachId: z.string().uuid({ message: 'beachId must be a valid UUID' }),
  forecastAt: z.string().datetime({ offset: true }).optional(),
});

type CanonicalSurfCallResponse = SpotSurfReportResult & {
  sessionDecision: CanonicalSessionDecision;
  forecastAlignment?: SurfCallForecastAlignment;
};

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
    { status: code === 'timeout' ? 504 : 503 },
  );
}

async function readForecastAlignment(
  supabase: AuthenticatedContext['supabase'],
  beachId: string,
  requestedForecastAt: string,
): Promise<SurfCallForecastAlignment> {
  const requestedMs = Date.parse(requestedForecastAt);
  const toleranceMs = FORECAST_ALIGNMENT_TOLERANCE_MINUTES * 60 * 1000;
  const { data, error } = await supabase
    .from('enhanced_forecasts')
    .select('forecast_at')
    .eq('beach_id', beachId)
    .gte('forecast_at', new Date(requestedMs - toleranceMs).toISOString())
    .lte('forecast_at', new Date(requestedMs + toleranceMs).toISOString())
    .order('forecast_at', { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return resolveForecastAlignment(
    data ?? [],
    requestedForecastAt,
  ).alignment;
}

function appendBoardNote(whySentence: string, boardNote: string | null): string {
  if (!boardNote) return whySentence;
  const sentence = `Board fit: ${boardNote}.`;
  return whySentence ? `${whySentence} ${sentence}` : sentence;
}

function safetyReason(decision: CanonicalSessionDecision): string {
  switch (decision.reasonCode) {
    case 'water_quality_closure':
      return 'Water quality is closed at this spot.';
    case 'major_event_hold':
      return 'This call is paused while major-event conditions are unresolved.';
    case 'beach_skill_exceeds_user':
      return 'This break is above your current skill level.';
    case 'wave_height_exceeds_skill':
      return 'The forecast wave height is above your current skill range.';
    case 'missing_beach_skill':
    case 'missing_wave_height':
    case 'unknown_skill':
    case 'invalid_candidate':
    case 'hold_state_unavailable':
      return 'Safety information is incomplete, so Quiver is holding this call.';
    case 'no_candidates':
      return 'No safe surf window is available.';
    default:
      return 'Quiver is holding this call for safety.';
  }
}

function buildCanonicalSurfCall(
  decision: CanonicalSessionDecision,
  requestedBeachId: string,
  recommendations: SurfDiscoveryRecommendation[],
  beach: Beach,
  now: Date,
  profileExperience: SkillLevel | null,
  boardClass: BoardClass | null,
  recommendationAvailability: RecommendationAvailability,
): CanonicalSurfCallResponse {
  const selection = decision.selection;
  const selectedRecommendation = selection
    ? recommendations.find(
        (recommendation) =>
          recommendation.recommendationId === selection.candidateId &&
          recommendation.beach.id === requestedBeachId,
      ) ?? null
    : null;
  const objectiveRecommendation =
    selectedRecommendation ??
    recommendations.find(
      (recommendation) => recommendation.beach.id === requestedBeachId,
    ) ??
    null;
  const window = objectiveRecommendation?.window ?? null;
  const forecasts = objectiveRecommendation
    ? [objectiveRecommendation.forecast]
    : [];
  const timezone = window?.timezone ?? beach.timezone ?? 'UTC';
  const isTomorrow = window
    ? isFutureDayInTimezone(window.start, timezone)
    : false;
  const baseline = computeSurfCall(
    window,
    forecasts,
    beach,
    { isTomorrow },
  );
  const exactSelection =
    selection !== null &&
    selectedRecommendation !== null &&
    selection.beachId === requestedBeachId;
  const forecastContext = exactSelection && window
    ? buildForecastRecommendationContext({
        beach,
        forecasts,
        window,
        now,
        timezone,
      })
    : null;
  const boardNote =
    exactSelection && window && profileExperience && boardClass
      ? checkBoardFit(
          Number.parseFloat(window.waveHeight),
          profileExperience,
          boardClass,
        ).note
      : null;
  const personalReasons =
    selection?.evidence.personalMatch?.reasons.join(' ') ?? '';
  const whySentence = appendBoardNote(
    decision.decisionBasis === 'safety_override'
      ? safetyReason(decision)
      : personalReasons || baseline.whySentence,
    boardNote,
  );
  const report = {
    ...baseline,
    verdict:
      decision.verdict === 'go'
        ? 'YES' as const
        : decision.verdict === 'maybe'
          ? 'MAYBE' as const
          : 'NO' as const,
    bestWindowStart: exactSelection ? selection.windowStart : null,
    bestWindowEnd: exactSelection ? selection.windowEnd : null,
    windowMinutes: exactSelection ? baseline.windowMinutes : null,
    shortWindow: exactSelection ? baseline.shortWindow : false,
    whySentence,
    score: exactSelection
      ? selection.evidence.conditionScore
      : baseline.score,
    peakTime: exactSelection ? baseline.peakTime : null,
    tiers:
      decision.decisionBasis === 'physical_fallback' && window
        ? computeSurfCallTiers(window, forecasts, beach, { isTomorrow })
        : null,
    userTier: profileExperience,
    skillSource: profileExperience ? 'profile' as const : null,
    recommendationAvailability,
  };

  return {
    report,
    isTomorrow,
    forecastContext,
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
    forecastAt: searchParams.get('forecastAt') ?? undefined,
  });
  if ('error' in validation) {
    return validation.error;
  }

  const { beachId, forecastAt } = validation.data;
  const boardClass = normalizeBoardClass(
    searchParams.get('boardClass'),
  ) as BoardClass | null;

  // Narrow column list — only what discovery and computeSurfCall read. Skips
  // the heavy text/jsonb columns
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

  let profileExperience: SkillLevel | null = null;
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
  const requestedForecastTime = forecastAt
    ? new Date(forecastAt)
    : null;
  const scopeStart = requestedForecastTime
    ? new Date(
        requestedForecastTime.getTime() -
          FORECAST_ALIGNMENT_TOLERANCE_MINUTES * 60 * 1000,
      )
    : anchor;
  const requestedScopeEndMs = requestedForecastTime
    ? requestedForecastTime.getTime() + 24 * 60 * 60 * 1000
    : 0;
  const scopeEnd = new Date(
    Math.max(
      anchor.getTime() + 24 * 60 * 60 * 1000,
      requestedScopeEndMs,
    ),
  );
  let canonicalContext;
  try {
    canonicalContext = await resolveCanonicalSessionDecisionContext({
      userId: user.id,
      profileExperience,
      anchorTime,
      candidateBeachIds: [beachId],
      scope: {
        kind: 'plan_next_session',
        windowStart: scopeStart.toISOString(),
        windowEnd: scopeEnd.toISOString(),
        timezone: typedBeach.timezone ?? 'UTC',
      },
      discoveryOptions: {
        userLocation:
          typedBeach.lat !== null && typedBeach.lon !== null
            ? { lat: typedBeach.lat, lon: typedBeach.lon }
            : undefined,
        horizonHours: 24,
        candidatePoolLimit: 1,
        ...(forecastAt ? { forecastAt } : {}),
        includeBeachIds: [beachId],
        isPro,
        throwOnFailure: true,
      },
    });
  } catch (error) {
    return retryableDiscoveryResponse(error);
  }
  const sessionDecision = canonicalContext.decision;
  const recommendations = [
    ...canonicalContext.discovery.recommendations,
    ...(canonicalContext.discovery.includedRecommendations ?? []),
  ];
  const recommendationAvailability = resolveScopedRecommendationAvailability(
    canonicalContext.discovery,
    sessionDecision.holdEpoch,
  );
  const canonicalResult = buildCanonicalSurfCall(
    sessionDecision,
    beachId,
    recommendations,
    typedBeach,
    anchor,
    profileExperience,
    boardClass,
    recommendationAvailability,
  );
  const scopedCanonicalResult: CanonicalSurfCallResponse = forecastAt
    ? {
        ...canonicalResult,
        forecastAlignment: await readForecastAlignment(
          supabase,
          beachId,
          forecastAt,
        ),
      }
    : canonicalResult;
  const result = applyForceVerdict(
    scopedCanonicalResult,
    searchParams.get('_forceVerdict'),
    process.env.NODE_ENV !== 'production',
  ) as CanonicalSurfCallResponse;

  return createSuccessResponse(result);
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
