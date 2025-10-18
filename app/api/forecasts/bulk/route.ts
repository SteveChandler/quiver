import { NextRequest } from "next/server";
import {
  createSuccessResponse,
  handleApiError,
} from "@/lib/api-utils";
import { createClient } from "@/lib/supabase/server";
import { getCurrentForecast } from "@/lib/utils/current-forecast-utils";

/**
 * GET /api/forecasts/bulk
 * Fetches current wave height forecasts for multiple beaches in a single request
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
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const beachIdsParam = searchParams.get("beachIds");

    if (!beachIdsParam) {
      return createSuccessResponse(
        { forecasts: {} },
        { status: 400 }
      );
    }

    // Parse beach IDs
    const beachIds = beachIdsParam.split(",").filter(Boolean);

    if (beachIds.length === 0) {
      return createSuccessResponse({ forecasts: {} });
    }

    // Limit to prevent abuse
    const maxBeaches = 50;
    const limitedBeachIds = beachIds.slice(0, maxBeaches);

    const supabase = await createClient();

    // Fetch all forecasts for the requested beaches in a single query
    const { data: forecasts, error } = await supabase
      .from("enhanced_forecasts")
      .select("beach_id, forecast_time, wave_height")
      .in("beach_id", limitedBeachIds)
      .order("forecast_time", { ascending: true });

    if (error) {
      console.error("Error fetching bulk forecasts:", error);
      return createSuccessResponse({ forecasts: {} });
    }

    // Group forecasts by beach_id
    const forecastsByBeach: Record<string, any[]> = {};
    (forecasts || []).forEach((forecast) => {
      const beachId = forecast.beach_id;
      if (!forecastsByBeach[beachId]) {
        forecastsByBeach[beachId] = [];
      }
      forecastsByBeach[beachId].push(forecast);
    });

    // Extract current wave height for each beach
    const waveHeightMap: Record<string, number | undefined> = {};
    
    limitedBeachIds.forEach((beachId) => {
      const beachForecasts = forecastsByBeach[beachId] || [];
      if (beachForecasts.length > 0) {
        const currentForecast = getCurrentForecast(beachForecasts);
        if (currentForecast?.wave_height !== undefined) {
          waveHeightMap[beachId] = currentForecast.wave_height;
        }
      }
    });

    return createSuccessResponse({ forecasts: waveHeightMap });
  } catch (error) {
    return handleApiError(error);
  }
}

