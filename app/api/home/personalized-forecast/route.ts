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
import { getPersonalizedHomeForecast } from "@/lib/services/personalized-home-forecast-service";

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
 * Returns personalized surf recommendation for authenticated user.
 * Builds candidate pool from user's home beach and favorites,
 * scores them with personalized preferences, and returns best opportunity.
 * 
 * @param request - Next.js request with optional query params
 * @returns PersonalizedForecastRecommendation or null
 * 
 * Query Parameters:
 * - homeBeachId (optional): UUID to override user's profile home beach
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

    const { homeBeachId } = validationResult.data;

    // 3. Call service to get personalized recommendation
    const recommendation = await getPersonalizedHomeForecast(user.id, {
      homeBeachId,
    });

    // 4. Return success response with private caching
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

