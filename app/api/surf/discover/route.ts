import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import {
  createSuccessResponse,
  createAuthError,
  handleApiError,
  validateOrError,
} from '@/lib/api-utils';
import { withRateLimit } from '@/lib/middleware/api-wrappers';
import { discoverSurfSpots } from '@/lib/services/surf-discovery-service';
import { generateETag, isETagMatch } from '@/lib/utils/cache-headers';

export const dynamic = 'force-dynamic';

/**
 * Query Parameter Schema
 *
 * Validates discovery query parameters
 */
const QuerySchema = z.object({
  // GPS location (Phase 2)
  lat: z.coerce.number().min(-90).max(90).optional(),
  lon: z.coerce.number().min(-180).max(180).optional(),
  radius: z.coerce.number().positive().max(100).optional(), // miles
  // Window horizon
  horizonHours: z.coerce.number().int().min(1).max(72).optional(),
  // Result limits
  maxResults: z.coerce.number().int().min(1).max(10).optional(),
  includeHome: z
    .string()
    .optional()
    .transform((val) => val !== 'false'),
});

/**
 * GET /api/surf/discover
 *
 * Returns ranked surf spot recommendations for authenticated user.
 * Discovers beaches from home + favorites + (GPS nearby in Phase 2),
 * scores them with detailed condition matching, and returns ranked list.
 *
 * @param request - Next.js request with optional query params
 * @returns SurfDiscoveryResponse with ranked recommendations
 *
 * Query Parameters:
 * - lat (optional, Phase 2): User's latitude for GPS discovery
 * - lon (optional, Phase 2): User's longitude for GPS discovery
 * - radius (optional, Phase 2): Search radius in miles (default: 25, max: 100)
 * - maxResults (optional): Maximum recommendations (default: 5, max: 10)
 * - includeHome (optional): Include home beach (default: true)
 *
 * Authentication: Required (user session)
 * Rate Limit: 10 requests/minute
 * Cache: Private, 5 minutes
 *
 * @example
 * GET /api/surf/discover
 * GET /api/surf/discover?maxResults=10
 * GET /api/surf/discover?lat=32.7157&lon=-117.1611&radius=25 (Phase 2)
 */
async function surfDiscoveryHandler(request: NextRequest): Promise<NextResponse> {
  try {
    // 1. Authenticate user
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return createAuthError('Authentication required');
    }

    // 2. Parse and validate query parameters
    const { searchParams } = new URL(request.url);
    const queryData = {
      lat: searchParams.get('lat') || undefined,
      lon: searchParams.get('lon') || undefined,
      radius: searchParams.get('radius') || undefined,
      horizonHours: searchParams.get('horizonHours') || undefined,
      maxResults: searchParams.get('maxResults') || undefined,
      includeHome: searchParams.get('includeHome') || undefined,
    };

    const validationResult = validateOrError(QuerySchema, queryData);
    if ('error' in validationResult) {
      return validationResult.error;
    }

    const { lat, lon, radius, horizonHours, maxResults, includeHome } =
      validationResult.data;

    // 3. Validate GPS parameters (Phase 2)
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

    // 4. Call service to get ranked recommendations
    const discovery = await discoverSurfSpots(user.id, {
      userLocation,
      radiusMiles: radius,
      horizonHours,
      maxResults,
      includeHome,
    });

    // 5. Generate ETag for conditional request support
    const responseData = { success: true, data: discovery };
    const etag = await generateETag(responseData);

    // 6. Check If-None-Match header - return 304 if data unchanged
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

    // 7. Return success response with ETag and improved caching
    const response = createSuccessResponse(discovery);

    // Private cache: 5 min max-age + 15 min stale-while-revalidate
    response.headers.set('Cache-Control', 'private, max-age=300, stale-while-revalidate=900');
    response.headers.set('ETag', `"${etag}"`);

    return response;
  } catch (error) {
    console.error('Error discovering surf spots:', error);
    return handleApiError(error, 'Error discovering surf spots');
  }
}

// Apply rate limiting (10 req/min, same as personalized forecast)
export const GET = withRateLimit(surfDiscoveryHandler, 'surf-discovery');
