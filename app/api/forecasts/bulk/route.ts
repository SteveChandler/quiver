import { NextRequest } from "next/server";
import {
  createSuccessResponse,
  handleApiError,
} from "@/lib/api-utils";
import {
  withAuth,
  withRateLimit,
} from "@/lib/middleware/api-wrappers";
import type { OptionalAuthContext } from "@/lib/middleware/api-wrappers/types";
import {
  applyV51DisplayOverrideToForecasts,
  isV51DisplayAllowlistedUser,
} from "@/lib/services/forecast/v5-display-gate";
import type { EnhancedForecastEntity } from "@/types/forecast";
import type { Database } from "@/types/database.generated";
import type { SupabaseClient } from "@supabase/supabase-js";

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
 *     },
 *     waterTemps: {
 *       [beachId]: string | undefined
 *     },
 *     isCalibrated: {
 *       [beachId]: boolean
 *     }
 *   }
 * }
 */
function nextUtcDateString(date: Date): string {
  return new Date(date.getTime() + 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];
}

function currentForecastRank(
  row: Pick<EnhancedForecastEntity, "forecast_date" | "forecast_time">,
  targetDate: string,
  currentTime: string
): [number, number] {
  if (row.forecast_date === targetDate && row.forecast_time >= currentTime) {
    return [1, secondsFromTime(row.forecast_time)];
  }

  if (row.forecast_date === nextUtcDateString(new Date(`${targetDate}T00:00:00Z`))) {
    return [2, secondsFromTime(row.forecast_time)];
  }

  return [3, -secondsFromTime(row.forecast_time)];
}

function secondsFromTime(time: string): number {
  const [hours = "0", minutes = "0", seconds = "0"] = time.split(":");
  return Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds);
}

async function fetchBulkCurrentForecastsWithV51Display(
  supabase: SupabaseClient<Database>,
  beachIds: string[]
): Promise<{ data: Array<{ beach_id: string; wave_height: string | null }> | null; error: { message: string } | null }> {
  const now = new Date();
  const targetDate = now.toISOString().split("T")[0];
  const tomorrow = nextUtcDateString(now);
  const currentTime = now.toISOString().slice(11, 19);

  const { data, error } = await supabase
    .from("enhanced_forecasts")
    .select(
      "beach_id, forecast_date, forecast_time, forecast_at, wave_height, wave_height_om, wave_direction_om, swell_direction_om, swell_1_direction"
    )
    .in("beach_id", beachIds)
    .in("forecast_date", [targetDate, tomorrow]);

  if (error || !data) {
    return { data: null, error: error ? { message: error.message } : null };
  }

  const rankedByBeach = new Map<string, EnhancedForecastEntity>();
  for (const row of data as unknown as EnhancedForecastEntity[]) {
    const current = rankedByBeach.get(row.beach_id);
    if (!current) {
      rankedByBeach.set(row.beach_id, row);
      continue;
    }

    const nextRank = currentForecastRank(row, targetDate, currentTime);
    const currentRank = currentForecastRank(current, targetDate, currentTime);
    if (
      nextRank[0] < currentRank[0] ||
      (nextRank[0] === currentRank[0] && nextRank[1] < currentRank[1])
    ) {
      rankedByBeach.set(row.beach_id, row);
    }
  }

  const displayRows = await applyV51DisplayOverrideToForecasts(
    Array.from(rankedByBeach.values()),
    { enabled: true }
  );

  return {
    data: displayRows.map((row) => ({
      beach_id: row.beach_id,
      wave_height: row.wave_height,
    })),
    error: null,
  };
}

async function bulkForecastHandler(
  request: NextRequest,
  context: OptionalAuthContext
) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const beachIdsParam = searchParams.get("beachIds");

    // Return empty forecasts for missing/empty beachIds (not an error)
    if (!beachIdsParam || !beachIdsParam.trim()) {
      return createSuccessResponse({ forecasts: {}, waterTemps: {}, isCalibrated: {} });
    }

    // Parse beach IDs and filter out empty strings
    const beachIds = beachIdsParam
      .split(",")
      .map(id => id.trim())
      .filter(Boolean);

    if (beachIds.length === 0) {
      return createSuccessResponse({ forecasts: {}, waterTemps: {}, isCalibrated: {} });
    }

    // Limit to prevent abuse
    const maxBeaches = 50;
    const limitedBeachIds = beachIds.slice(0, maxBeaches);
    const { supabase } = context;

    const useV51Display = isV51DisplayAllowlistedUser(context?.user ?? null);
    const { data, error } = useV51Display
      ? await fetchBulkCurrentForecastsWithV51Display(supabase, limitedBeachIds)
      : await supabase.rpc("get_bulk_current_forecasts", {
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

    // Fetch calibration status for each beach. We expose only the boolean —
    // `shoaling_factors` is ~4KB of JSONB per beach and the client only needs
    // to know whether the displayed wave height came from the empirically
    // calibrated pipeline. Beaches missing from this query (errors, soft
    // deletes) default to `false`.
    const isCalibratedMap: Record<string, boolean> = {};
    const { data: beachRows, error: beachError } = await supabase
      .from("beaches")
      .select("id, shoaling_factors")
      .in("id", limitedBeachIds);

    if (beachError) {
      console.error("Error fetching beach calibration status:", beachError);
      // Non-fatal: leave map empty, clients default to `false`.
    } else {
      (beachRows || []).forEach((row: { id: string; shoaling_factors: unknown }) => {
        isCalibratedMap[row.id] = row.shoaling_factors !== null;
      });
    }

    // Fetch water temps from the same forecast rows
    // Use a direct query since the RPC doesn't return water_temp
    const waterTempMap: Record<string, string | undefined> = {};
    if (limitedBeachIds.length > 0) {
      const now = new Date().toISOString();
      const { data: tempData } = await supabase
        .from("enhanced_forecasts")
        .select("beach_id, water_temp")
        .in("beach_id", limitedBeachIds)
        .gte("forecast_at", now)
        .not("water_temp", "is", null)
        .order("forecast_at", { ascending: true });

      // Keep only the first (most current) water_temp per beach
      (tempData || []).forEach((row: { beach_id: string; water_temp: string | null }) => {
        if (row.water_temp !== null && !waterTempMap[row.beach_id]) {
          waterTempMap[row.beach_id] = row.water_temp;
        }
      });
    }

    return createSuccessResponse({
      forecasts: waveHeightMap,
      waterTemps: waterTempMap,
      isCalibrated: isCalibratedMap,
    });
  } catch (error) {
    console.error("Unexpected error in bulk forecast API:", error);
    return handleApiError(error instanceof Error ? error : new Error(String(error)), "Unexpected error fetching forecasts");
  }
}

// Apply rate limiting to prevent abuse of bulk operations
export const GET = withRateLimit(
  withAuth(bulkForecastHandler, {
    optional: true,
    errorMessage: "Unexpected error fetching forecasts",
  }),
  "forecast-bulk"
);
