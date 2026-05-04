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
import { entitlementFromRow } from '@/lib/alerts/entitlements';
import { generateETag, isETagMatch } from '@/lib/utils/cache-headers';
import type { TimeSlot } from '@/types/personalization';

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
});

/**
 * GET /api/surf/discover
 *
 * Returns ranked surf spot recommendations based on user's GPS location.
 * Discovers nearby beaches sorted by distance, scores them with detailed
 * condition matching, and returns the top ranked list.
 *
 * @param request - Next.js request with query params
 * @returns SurfDiscoveryResponse with ranked recommendations
 *
 * Query Parameters:
 * - lat (required): User's latitude for GPS discovery
 * - lon (required): User's longitude for GPS discovery
 * - radius (optional): Search radius in miles (default: 25, max: 100)
 * - maxResults (optional): Maximum recommendations (default: 5, max: 10)
 * - timeSlot (optional): Time slot preference ('any', 'lunch-session', 'afternoon', 'dawn-patrol', default: 'any')
 *
 * Authentication: Required (user session)
 * Rate Limit: 10 requests/minute
 * Cache: Private, 5 minutes
 *
 * @example
 * GET /api/surf/discover?lat=32.7157&lon=-117.1611
 * GET /api/surf/discover?lat=32.7157&lon=-117.1611&radius=50&maxResults=10
 * GET /api/surf/discover?lat=32.7157&lon=-117.1611&timeSlot=morning
 */
async function surfDiscoveryHandler(
  request: NextRequest,
  { user, supabase }: AuthenticatedContext
): Promise<NextResponse> {
  // 1. Parse and validate query parameters
  const { searchParams } = new URL(request.url);
  const queryData = {
    lat: searchParams.get('lat') || undefined,
    lon: searchParams.get('lon') || undefined,
    radius: searchParams.get('radius') || undefined,
    horizonHours: searchParams.get('horizonHours') || undefined,
    maxResults: searchParams.get('maxResults') || undefined,
  };

  const validationResult = validateOrError(QuerySchema, queryData);
  if ('error' in validationResult) {
    return validationResult.error;
  }

  const { lat, lon, radius, horizonHours, maxResults } = validationResult.data;

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

  // 4. Call service to get ranked recommendations
  const discovery = await discoverSurfSpots(user.id, {
    userLocation,
    radiusMiles: radius,
    horizonHours,
    maxResults,
    timeSlot,
    isPro,
  });

  // 3a. Stamp empirical shoaling calibration status onto each recommendation's
  // forecast so the honesty-layer UI can distinguish calibrated face heights
  // from forecast-only sig-wave heights. Only the boolean is exposed; the raw
  // ~4KB shoaling_factors JSONB stays server-side. One batch query keyed on
  // the recommended beach IDs. Errors default every entry to `false` (safer
  // conservative render).
  if (discovery.recommendations.length > 0) {
    const beachIds = Array.from(
      new Set(discovery.recommendations.map((r) => r.beach.id))
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
  }

  // 4. Generate ETag for conditional request support
  const responseData = { success: true, data: discovery };
  const etag = await generateETag(responseData);

  // 5. Check If-None-Match header - return 304 if data unchanged
  const ifNoneMatch = request.headers.get('If-None-Match');
  if (ifNoneMatch && await isETagMatch(ifNoneMatch, responseData)) {
    return new NextResponse(null, {
      status: 304,
      headers: {
        'ETag': `"${etag}"`,
        'Cache-Control': 'private, max-age=300, stale-while-revalidate=900',
      },
    });
  }

  // 6. Return success response with ETag and improved caching
  const response = createSuccessResponse(discovery);

  // Private cache: 5 min max-age + 15 min stale-while-revalidate
  response.headers.set('Cache-Control', 'private, max-age=300, stale-while-revalidate=900');
  response.headers.set('ETag', `"${etag}"`);

  return response;
}

// Compose: auth first (inner), then rate limit (outer)
export const GET = withRateLimit(
  withAuth(surfDiscoveryHandler, { errorMessage: 'Error discovering surf spots' }),
  'surf-discovery'
);
