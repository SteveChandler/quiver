// TODO: needs envelope test — cover isCalibrated stamping (true/false/batch mixed)
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  withAuth,
  withRateLimit,
  createSuccessResponse,
  validateOrError,
  type AuthenticatedContext,
} from '@/lib/middleware/api-wrappers';
import { discoverSurfSpots } from '@/lib/services/surf-discovery-service';
import { CANDIDATE_POOL_LIMIT } from '@/lib/services/discovery/candidate-pool-builder';
import {
  hasExplicitMajorEventHold,
  hasNoDiscoveryCandidates,
} from '@/lib/services/discovery/discovery-availability';
import { entitlementFromRow } from '@/lib/alerts/entitlements';
import { gateSurfDiscoveryResponse } from '@/lib/services/discovery/surf-discovery-gating';
import { sanitizeSurfDiscoveryForSerializationMajorEventHold } from '@/lib/services/discovery/major-event-hold';
import { getProfileExperienceLevel } from '@/lib/profile/skill-level';
import { buildCanonicalDecisionFromSurfDiscovery } from '@/lib/recommendations/canonical-decision';
import type { SurfDiscoveryEntitlement, TimeSlot } from '@/types/personalization';

export const dynamic = 'force-dynamic';
export const maxDuration = 30; // Allow 30s for GPS discovery + batch forecast fetching

/**
 * Query Parameter Schema
 *
 * Validates discovery query parameters
 */
const QuerySchema = z.object({
  // GPS location (required for discovery)
  lat: z.coerce.number().min(-90).max(90).optional(),
  lon: z.coerce.number().min(-180).max(180).optional(),
  radius: z.coerce.number().positive().max(100).optional(), // miles
  // Window horizon
  horizonHours: z.coerce.number().int().min(1).max(72).optional(),
  // Result limits
  maxResults: z.coerce.number().int().min(1).max(10).optional(),
  // Discovery mode
  mode: z.enum(['best-window', 'now']).optional(),
  // Explicit curated beaches to score in the same batch as nearby discovery.
  includeBeachIds: z.string().optional().transform((value, ctx) => {
    if (!value) return [];
    const ids = Array.from(new Set(
      value.split(',')
        .map((id) => id.trim())
        .filter(Boolean)
    ));
    if (ids.length > 12) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'includeBeachIds may include at most 12 beach IDs',
      });
      return z.NEVER;
    }
    const uuid = z.string().uuid();
    for (const id of ids) {
      if (!uuid.safeParse(id).success) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'includeBeachIds must be a comma-separated list of UUIDs',
        });
        return z.NEVER;
      }
    }
    return ids;
  }),
});

function retryableDiscoveryResponse(error: unknown): NextResponse {
  const candidateCode =
    error && typeof error === 'object' && 'code' in error
      ? error.code
      : undefined;
  const code =
    candidateCode === 'timeout' ||
    candidateCode === 'forecast_unavailable' ||
    candidateCode === 'hold_state_unavailable' ||
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

/**
 * GET /api/surf/discover
 *
 * Returns ranked surf spot recommendations based on user's GPS location.
 * Discovers nearby beaches, orders the candidate pool by distance blended with
 * the user's stored preferences, scores them with detailed condition matching,
 * and returns the top ranked list.
 *
 * @param request - Next.js request with query params
 * @returns SurfDiscoveryResponse with ranked recommendations
 *
 * Query Parameters:
 * - lat (required): User's latitude for GPS discovery
 * - lon (required): User's longitude for GPS discovery
 * - radius (optional): Search radius in miles (starts at 25, expands to 100 as needed)
 * - maxResults (optional): Maximum recommendations (default: 5, max: 10)
 * - mode (optional): Discovery mode ('best-window' default, 'now' for immediate current-condition ranking)
 * - timeSlot (optional): Time slot preference ('any', 'lunch-session', 'afternoon', 'dawn-patrol', default: 'any')
 * - includeBeachIds (optional): Comma-separated curated beach UUIDs to score alongside nearby discovery
 *
 * Authentication: Required (user session)
 * Rate Limit: 10 requests/minute
 * Cache: Private, 5 minutes
 *
 * @example
 * GET /api/surf/discover?lat=32.7157&lon=-117.1611
 * GET /api/surf/discover?lat=32.7157&lon=-117.1611&radius=50&maxResults=10
 * GET /api/surf/discover?lat=32.7157&lon=-117.1611&timeSlot=dawn-patrol
 */
async function surfDiscoveryHandler(
  request: NextRequest,
  { user, supabase }: AuthenticatedContext
): Promise<NextResponse> {
  const anchor = new Date();
  // 1. Parse and validate query parameters
  const { searchParams } = new URL(request.url);
  const queryData = {
    lat: searchParams.get('lat') || undefined,
    lon: searchParams.get('lon') || undefined,
    radius: searchParams.get('radius') || undefined,
    horizonHours: searchParams.get('horizonHours') || undefined,
    maxResults: searchParams.get('maxResults') || undefined,
    mode: searchParams.get('mode') || undefined,
    includeBeachIds: searchParams.get('includeBeachIds') || undefined,
  };

  const validationResult = validateOrError(QuerySchema, queryData);
  if ('error' in validationResult) {
    return validationResult.error;
  }

  const { lat, lon, radius, horizonHours, maxResults, mode, includeBeachIds } = validationResult.data;

  // Parse timeSlot query parameter
  const timeSlotParam = searchParams.get('timeSlot');
  const validTimeSlots: TimeSlot[] = ['any', 'lunch-session', 'afternoon', 'dawn-patrol'];
  const timeSlot: TimeSlot = validTimeSlots.includes(timeSlotParam as TimeSlot)
    ? (timeSlotParam as TimeSlot)
    : 'any';

  // 2. Validate GPS parameters (Phase 2)
  let userLocation: { lat: number; lon: number } | undefined;
  if (lat !== undefined && lon !== undefined) {
    userLocation = { lat, lon };
  } else if (lat !== undefined || lon !== undefined) {
    return NextResponse.json(
      {
        success: false,
        error: 'Both lat and lon must be provided for GPS discovery',
      },
      { status: 400 }
    );
  }

  // 3. Resolve user entitlement so the orchestrator can gate the Pro
  //    similarity layer. entitlementFromRow returns "premium" for active
  //    Pro/trial (with billing-issue grace-period carve-out) and "free"
  //    otherwise. Missing row, RLS error, or query failure all fall back
  //    to free — safer than over-granting Pro on a transient DB blip.
  const { data: entitlementRow } = await supabase
    .from('user_entitlements')
    .select('is_pro, is_trialing, billing_issue, expires_at')
    .eq('user_id', user.id)
    .maybeSingle();
  const isPro = entitlementFromRow(entitlementRow ?? null) === 'premium';
  const entitlement: SurfDiscoveryEntitlement = {
    tier: isPro ? 'premium' : 'free',
    hasPaidAccess: isPro,
    canSeeBestSpot: isPro,
  };

  // 4. Call service to get ranked recommendations
  let discovery;
  try {
    discovery = await discoverSurfSpots(user.id, {
      userLocation,
      radiusMiles: radius,
      horizonHours,
      maxResults,
      // Consider the full pool. `maxResults` alone controls how many spots the
      // user sees; shrinking the pool to match it makes the physically nearest
      // handful the entire ranking universe and hides better spots a few miles
      // out. Measured in San Diego (49 vs 7 beaches considered): ~720ms at a
      // pool of 8 vs ~1200ms at 60, well inside the 12s batch timeout — so if
      // this route ever needs bounding again, bound `maxConcurrent` or the
      // radius, not the ranking universe.
      candidatePoolLimit: CANDIDATE_POOL_LIMIT,
      discoveryMode: mode ?? 'best-window',
      timeSlot,
      isPro,
      includeBeachIds,
      throwOnFailure: true,
    });
  } catch (error) {
    return retryableDiscoveryResponse(error);
  }

  // 3a. Stamp empirical shoaling calibration status onto each recommendation's
  // forecast so the honesty-layer UI can distinguish calibrated face heights
  // from forecast-only sig-wave heights. Only the boolean is exposed; the raw
  // ~4KB shoaling_factors JSONB stays server-side. One batch query keyed on
  // the recommended beach IDs. Errors default every entry to `false` (safer
  // conservative render).
  const recsForCalibration = [
    ...discovery.recommendations,
    ...(discovery.includedRecommendations ?? []),
  ];
  if (recsForCalibration.length > 0) {
    const beachIds = Array.from(
      new Set(recsForCalibration.map((r) => r.beach.id))
    );
    const calibratedMap = new Map<string, boolean>();
    try {
      const { data: beachRows, error: beachError } = await supabase
        .from('beaches')
        .select('id, shoaling_factors')
        .in('id', beachIds);
      if (beachError) {
        console.warn(
          '[surf/discover] Failed to fetch calibration status:',
          beachError.message
        );
      } else {
        (beachRows || []).forEach((row: { id: string; shoaling_factors: unknown }) => {
          calibratedMap.set(row.id, row.shoaling_factors !== null);
        });
      }
    } catch (err) {
      console.warn('[surf/discover] Error fetching calibration status:', err);
    }
    discovery.recommendations = discovery.recommendations.map((rec) => ({
      ...rec,
      forecast: {
        ...rec.forecast,
        isCalibrated: calibratedMap.get(rec.beach.id) ?? false,
      },
    }));
    discovery.includedRecommendations = discovery.includedRecommendations?.map((rec) => ({
      ...rec,
      forecast: {
        ...rec.forecast,
        isCalibrated: calibratedMap.get(rec.beach.id) ?? false,
      },
    }));
  }

  let profileExperience = null;
  try {
    profileExperience = await getProfileExperienceLevel(supabase, user.id);
  } catch {
    profileExperience = null;
  }
  const hasIncomingMajorEventHold = hasExplicitMajorEventHold(discovery);
  const isSuccessfulNoCandidateResult =
    hasNoDiscoveryCandidates(discovery) &&
    !hasIncomingMajorEventHold;
  const sanitizedDiscovery =
    hasIncomingMajorEventHold
      ? discovery
      : isSuccessfulNoCandidateResult
      ? {
          ...discovery,
          metadata: {
            ...discovery.metadata,
            outcome: 'no_candidates' as const,
          },
          recommendationAvailability: {
            state: 'available' as const,
            holdEpoch: 'no-candidates',
          },
        }
      : await sanitizeSurfDiscoveryForSerializationMajorEventHold(
          discovery,
          profileExperience,
        );
  if (
    sanitizedDiscovery.recommendationAvailability?.state === 'none' &&
    sanitizedDiscovery.recommendationAvailability.reasonCode ===
      'hold_state_unavailable'
  ) {
    return retryableDiscoveryResponse(
      Object.assign(new Error('Recommendation hold state unavailable'), {
        code: 'hold_state_unavailable',
      }),
    );
  }
  const gatedDiscovery = gateSurfDiscoveryResponse(
    sanitizedDiscovery,
    entitlement,
  );

  const decisionTimezone =
    gatedDiscovery.recommendations[0]?.window?.timezone ?? 'UTC';
  const decisionHorizonHours = horizonHours ?? 24;
  gatedDiscovery.sessionDecision = buildCanonicalDecisionFromSurfDiscovery({
    anchorTime: anchor.toISOString(),
    scope: {
      kind: 'plan_next_session',
      windowStart: anchor.toISOString(),
      windowEnd: new Date(
        anchor.getTime() + decisionHorizonHours * 60 * 60 * 1000,
      ).toISOString(),
      timezone: decisionTimezone,
    },
    profileExperience,
    // A missing availability is an absent hold, not a hold. Discovery always
    // reports one, and a genuine major-event hold arrives as a real value.
    recommendationAvailability: gatedDiscovery.recommendationAvailability ?? {
      state: 'available',
      holdEpoch: 'no-hold',
    },
    recommendations: gatedDiscovery.recommendations,
  });

  return createSuccessResponse(gatedDiscovery);
}

// Compose: auth first (inner), then rate limit (outer)
const protectedGET = withRateLimit(
  withAuth(surfDiscoveryHandler, { errorMessage: 'Error discovering surf spots' }),
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
