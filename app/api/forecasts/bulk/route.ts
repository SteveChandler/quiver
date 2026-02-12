import { NextRequest } from "next/server";
import {
  createSuccessResponse,
  handleApiError,
} from "@/lib/api-utils";
import { createAPIServerClient } from "@/lib/supabase/api-server-client";
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

    // Use RPC to get exactly 1 row per beach (database-side aggregation).
    // This eliminates the risk of PostgREST's 1,000-row default limit silently
    // truncating results — the old .gte("forecast_date", today) query fetched
    // ~4,700 rows for 50 beaches, cutting off later-sorting UUIDs.
    const { data, error } = await supabase.rpc("get_bulk_current_forecasts", {
      p_beach_ids: limitedBeachIds,
    });

    if (error) {
      console.error("Error fetching bulk forecasts:", error);
      return handleApiError(new Error(error.message), "Failed to fetch bulk forecasts");
    }

    const waveHeightMap: Record<string, number | undefined> = {};
    (data || []).forEach((row: { beach_id: string; wave_height: string | null }) => {
      if (row.wave_height !== null) {
        waveHeightMap[row.beach_id] = row.wave_height as unknown as number;
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
