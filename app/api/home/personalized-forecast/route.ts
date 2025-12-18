import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  createSuccessResponse,
  createAuthError,
  handleApiError,
  validateOrError,
} from "@/lib/api-utils";
import { withRateLimit } from "@/lib/middleware/rate-limiter";
import { discoverSurfSpots } from "@/lib/services/surf-discovery-service";
import { adaptDiscoveryResponse } from "@/lib/adapters/discovery-to-personalized";

export const dynamic = "force-dynamic";

/**
 * Query Parameter Schema
 *
 * Validates optional homeBeachId UUID override
 */
const QuerySchema = z.object({
  homeBeachId: z.string().uuid().optional(),
});

/**
 * GET /api/home/personalized-forecast
 *
 * @deprecated This endpoint is deprecated. Use `/api/surf/discover?maxResults=1` instead.
 * This endpoint now wraps the discovery service for backward compatibility.
 *
 * Returns personalized surf recommendation for authenticated user.
 * Now powered by the surf discovery service with time-decay scoring.
 *
 * **Migration:**
 * ```ts
 * // Old (deprecated):
 * GET /api/home/personalized-forecast
 *
 * // New (recommended):
 * GET /api/surf/discover?maxResults=1
 * ```
 *
 * **Why migrate:**
 * - Discovery service uses superior time-decay scoring
 * - Consistent window selection across all recommendations
 * - Single codebase to maintain
 *
 * @param request - Next.js request with optional query params
 * @returns PersonalizedForecastRecommendation or null
 *
 * Query Parameters:
 * - homeBeachId (optional): IGNORED - discovery service always includes home beach
 *
 * Authentication: Required (user session)
 * Rate Limit: 10 requests/minute
 * Cache: Private, 5 minutes
 *
 * @example
 * GET /api/home/personalized-forecast
 * GET /api/home/personalized-forecast?homeBeachId=123e4567-e89b-12d3-a456-426614174000
 */
async function personalizedForecastHandler(
  request: NextRequest
): Promise<NextResponse> {
  try {
    // 1. Authenticate user
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return createAuthError("Authentication required");
    }

    // 2. Parse and validate query parameters
    const { searchParams } = new URL(request.url);
    const queryData = {
      homeBeachId: searchParams.get("homeBeachId") || undefined,
    };

    const validationResult = validateOrError(QuerySchema, queryData);
    if ("error" in validationResult) {
      return validationResult.error;
    }

    // Note: homeBeachId is ignored - discovery service always includes home beach
    // This is acceptable as it's the expected behavior

    // 3. Call discovery service with maxResults=1 (wrapper implementation)
    const discovery = await discoverSurfSpots(user.id, {
      maxResults: 1, // Single recommendation for backward compatibility
      includeHome: true,
      horizonHours: 24, // Home screen UX: keep recommendation within next 24 hours
    });

    // 4. Adapt discovery response to personalized format
    const recommendation = adaptDiscoveryResponse(discovery);

    // 5. Return success response with private caching
    const response = createSuccessResponse(recommendation);

    // Add private cache header (5 minutes)
    response.headers.set("Cache-Control", "private, max-age=300");

    return response;
  } catch (error) {
    console.error("Error generating personalized forecast:", error);
    return handleApiError(
      error,
      "Error generating personalized forecast recommendation"
    );
  }
}

// Apply rate limiting (10 req/min)
export const GET = withRateLimit(
  personalizedForecastHandler,
  "personalized-forecast"
);

