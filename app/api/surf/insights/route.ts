import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  createSuccessResponse,
  validateOrError,
  withAuth,
  withRateLimit,
  type OptionalAuthContext,
} from '@/lib/middleware/api-wrappers';
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
 * Authentication: Optional. Anonymous callers receive a degraded/onboarding
 * response that signals the data is unavailable without their session
 * history — this avoids 401-ing native Bearer callers before we know if we
 * can compute, and lets the shared client reuse the "needs more sessions"
 * UI for the no-auth case.
 * Rate Limit: 10 requests/minute
 * Cache: Private, 5 minutes (60s for the anon degraded response)
 */
const insightsHandler = withAuth(
  async (
    request: NextRequest,
    { user }: OptionalAuthContext
  ): Promise<NextResponse> => {
    // Parse and validate query parameters
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

    // Anonymous callers can't have session history; return the onboarding-style
    // degraded response the client already knows how to render.
    if (!user) {
      const response = createSuccessResponse({
        status: 'onboarding',
        message:
          'Sign in to see personalized insights based on your sessions.',
      });
      response.headers.set('Cache-Control', 'private, max-age=60');
      return response;
    }

    // Call similarity insights service
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

    // Return success response with private caching (5 minutes)
    const response = createSuccessResponse(insights);
    response.headers.set('Cache-Control', 'private, max-age=300');
    return response;
  },
  {
    optional: true,
    errorMessage: 'Error computing personalized insights',
  }
);

// Apply rate limiting (10 req/min, same as surf discovery)
export const GET = withRateLimit(insightsHandler, 'surf-insights');
