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
import { computeSimilarityInsights } from '@/lib/services/similarity-insights-service';

export const dynamic = 'force-dynamic';

/**
 * Query Parameter Schema
 *
 * Validates insights query parameters
 */
const QuerySchema = z.object({
  // Required parameters
  beachId: z.string().uuid('Beach ID must be a valid UUID'),
  beachName: z.string().min(1, 'Beach name is required'),
  waveHeight: z.coerce.number().min(0).max(50, 'Wave height must be between 0-50 ft'),
  wavePeriod: z.coerce.number().min(0).max(30, 'Wave period must be between 0-30 seconds'),
  windSpeed: z.coerce.number().min(0).max(100, 'Wind speed must be between 0-100 mph'),
  // Optional parameters
  windDirection: z.coerce.number().min(0).max(360).optional(),
  tideHeight: z.coerce.number().min(-5).max(15).optional(),
  tideStatus: z
    .string()
    .optional()
    .transform((val) => (val ? val.trim() : undefined)),
  windowStart: z
    .string()
    .optional()
    .refine(
      (val) => !val || !isNaN(Date.parse(val)),
      'Window start must be a valid ISO timestamp'
    ),
});

/**
 * GET /api/surf/insights
 *
 * Returns personalized insights for a forecast by comparing conditions to
 * user's historical high-rated sessions. Powered by bucket-based similarity
 * scoring algorithm.
 *
 * @param request - Next.js request with query params
 * @returns PersonalizedInsights with match quality and recommendations
 *
 * Query Parameters (Required):
 * - beachId: Beach UUID
 * - beachName: Beach name
 * - waveHeight: Wave height in feet
 * - wavePeriod: Wave period in seconds
 * - windSpeed: Wind speed in mph
 *
 * Query Parameters (Optional):
 * - windDirection: Wind direction in degrees (0-360)
 * - tideHeight: Tide height in feet
 * - tideStatus: Tide status (e.g., "Rising", "High Slack")
 * - windowStart: ISO timestamp for forecast window
 *
 * Authentication: Required (user session)
 * Rate Limit: 10 requests/minute
 * Cache: Private, 5 minutes
 *
 * Response States:
 * - ready: Insights computed successfully
 * - onboarding: <3 rated sessions, user needs to log more sessions
 * - degraded: No sessions with forecast snapshots, data unavailable
 *
 * @example
 * GET /api/surf/insights?beachId=123&beachName=Ocean%20Beach&waveHeight=4.5&wavePeriod=12&windSpeed=8
 * GET /api/surf/insights?beachId=123&beachName=Ocean%20Beach&waveHeight=4.5&wavePeriod=12&windSpeed=8&windDirection=270&tideHeight=4.2
 */
async function insightsHandler(request: NextRequest): Promise<NextResponse> {
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
      beachId: searchParams.get('beachId') || undefined,
      beachName: searchParams.get('beachName') || undefined,
      waveHeight: searchParams.get('waveHeight') || undefined,
      wavePeriod: searchParams.get('wavePeriod') || undefined,
      windSpeed: searchParams.get('windSpeed') || undefined,
      windDirection: searchParams.get('windDirection') || undefined,
      tideHeight: searchParams.get('tideHeight') || undefined,
      tideStatus: searchParams.get('tideStatus') || undefined,
      windowStart: searchParams.get('windowStart') || undefined,
    };

    const validationResult = validateOrError(QuerySchema, queryData);
    if ('error' in validationResult) {
      return validationResult.error;
    }

    const {
      beachId,
      beachName,
      waveHeight,
      wavePeriod,
      windSpeed,
      windDirection,
      tideHeight,
      tideStatus,
      windowStart,
    } = validationResult.data;

    // Request received - process insights
    // Note: Using console.warn for production logging (console.log blocked by ESLint)

    // 3. Call similarity insights service
    const insights = await computeSimilarityInsights(user.id, {
      beachId,
      beachName,
      waveHeight,
      wavePeriod,
      windSpeed,
      windDirection,
      tideHeight,
      tideStatus,
      windowStart,
    });

    // Insights computed successfully - return to client

    // 4. Return success response with private caching
    const response = createSuccessResponse(insights);

    // Add private cache header (5 minutes)
    // Private cache ensures insights are user-specific and not shared
    response.headers.set('Cache-Control', 'private, max-age=300');

    return response;
  } catch (error) {
    console.error('❌ [InsightsAPI] Error computing insights:', error);
    return handleApiError(error, 'Error computing personalized insights');
  }
}

// Apply rate limiting (10 req/min, same as surf discovery)
export const GET = withRateLimit(insightsHandler, 'surf-insights');
