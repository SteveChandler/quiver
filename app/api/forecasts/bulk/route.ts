import { NextRequest } from "next/server";
import {
  createSuccessResponse,
  handleApiError,
} from "@/lib/api-utils";
import { createAPIServerClient } from "@/lib/supabase/server";
import { getCurrentForecast } from "@/lib/utils/current-forecast-utils";
import { withRateLimit } from "@/lib/middleware/api-wrappers";

export const dynamic = 'force-dynamic';

/**
 * GET /api/forecasts/bulk
 * Fetches current wave height forecasts for multiple beaches in a single request
 *
 * Security:
 * - Rate limited to prevent abuse of bulk data fetching
 * - Limited to 50 beaches per request
 *
 * Query params:
 * - beachIds: comma-separated list of beach IDs (required)
 *
 * Returns:
 * {
 *   success: true,
 *   data: {
 *     forecasts: {
 *       [beachId]: number | undefined
 *     }
 *   }
 * }
 */
async function bulkForecastHandler(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const beachIdsParam = searchParams.get("beachIds");

    // Return empty forecasts for missing/empty beachIds (not an error)
    if (!beachIdsParam || !beachIdsParam.trim()) {
      return createSuccessResponse({ forecasts: {} });
    }

    // Parse beach IDs and filter out empty strings
    const beachIds = beachIdsParam
      .split(",")
      .map(id => id.trim())
      .filter(Boolean);

    if (beachIds.length === 0) {
      return createSuccessResponse({ forecasts: {} });
    }

    // Limit to prevent abuse
    const maxBeaches = 50;
    const limitedBeachIds = beachIds.slice(0, maxBeaches);

    const supabase = await createAPIServerClient();

    // Get today and tomorrow for SQL filtering
    const now = new Date();
    const today = now.toISOString().split("T")[0];
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];

    // Fetch only today + tomorrow forecasts to stay under Supabase's 1,000-row default limit.
    // getCurrentForecast() only needs today (next slot at/after now) or tomorrow (fallback).
    // Previously .gte("forecast_date", today) fetched 12 days out (~4,700 rows for 50 beaches),
    // causing silent truncation — beaches with later-sorting UUIDs got no forecast data.
    const { data: forecasts, error } = await supabase
      .from("enhanced_forecasts")
      .select("beach_id, forecast_date, forecast_time, wave_height")
      .in("beach_id", limitedBeachIds)
      .in("forecast_date", [today, tomorrow])
      .order("beach_id", { ascending: true })
      .order("forecast_date", { ascending: true })
      .order("forecast_time", { ascending: true });

    if (error) {
      console.error("Error fetching bulk forecasts:", error);
      return handleApiError(new Error(error.message), "Failed to fetch bulk forecasts");
    }

    // Group forecasts by beach_id and apply forward-looking time selection
    const waveHeightMap: Record<string, number | undefined> = {};
    
    limitedBeachIds.forEach((beachId) => {
      // Filter forecasts for this beach
      const beachForecasts = (forecasts || []).filter(f => f.beach_id === beachId);
      
      if (beachForecasts.length > 0) {
        // Find first forecast at or after current time today, or earliest tomorrow
        const currentForecast = getCurrentForecast(beachForecasts);
        if (currentForecast?.wave_height !== undefined) {
          waveHeightMap[beachId] = currentForecast.wave_height;
        }
      }
    });

    return createSuccessResponse({ forecasts: waveHeightMap });
  } catch (error) {
    console.error("Unexpected error in bulk forecast API:", error);
    return handleApiError(error instanceof Error ? error : new Error(String(error)), "Unexpected error fetching forecasts");
  }
}

// Apply rate limiting to prevent abuse of bulk operations
export const GET = withRateLimit(bulkForecastHandler, "forecast-bulk");
