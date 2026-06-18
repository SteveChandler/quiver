import type { NextRequest, NextResponse } from "next/server";
import {
  createSuccessResponse,
  handleApiError,
  withAuth,
  withRateLimit,
  type OptionalAuthContext,
} from "@/lib/middleware/api-wrappers";
import {
  applyV51DisplayOverrideToForecasts,
} from "@/lib/services/forecast/v5-display-gate";
import { scoreWindowWithEngine } from "@/lib/services/discovery/window-selector/window-scorer";
import type { EnhancedForecastEntity } from "@/types/forecast";
import type { Beach } from "@/types/database";
import type { Database } from "@/types/database.generated";
import type { SupabaseClient } from "@supabase/supabase-js";
import { rowToSwellPartition, type SwellPartition } from "./swell-partition";

export const dynamic = 'force-dynamic';

export type { SwellPartition };

type ConditionSummary = "GOOD" | "FAIR" | "CHECK" | "UNKNOWN";

const emptyBulkForecastResponse = {
  forecasts: {},
  waterTemps: {},
  isCalibrated: {},
  conditionScores: {},
  conditionSummaries: {},
  swellPartitions: {},
  swellPartitionTimeline: {},
};

const BULK_FORECAST_SELECT =
  "beach_id, forecast_date, forecast_time, forecast_at, wave_height, wave_period, wave_direction, wave_height_om, wave_direction_om, swell_height_om, swell_period_om, swell_direction_om, swell_1_height, swell_1_period, swell_1_direction, swell_2_height, swell_2_period, swell_2_direction, wind_wave_height, wind_wave_period, wind_wave_direction, wind_speed, wind_direction, wind_direction_deg, tide_height, tide_status, confidence_score, data_source" as const;

const BULK_BEACH_SELECT =
  "id, name, lat, lon, shoaling_factors, swell_window_min_deg, swell_window_max_deg, wind_offshore_deg, wind_offshore_tol_deg, wind_onshore_bad_kt, wind_cross_shore_ok_kt, preferred_tide_ft_min, preferred_tide_ft_max, preferred_tide_direction, tide_direction_sensitivity, skill_level, break_type" as const;

const SWELL_TIMELINE_HOUR_OFFSETS = [0, 3, 6, 9, 12] as const;

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
 *     isCalibrated: { [beachId]: boolean },
 *     conditionScores: { [beachId]: number | undefined },
 *     conditionSummaries: { [beachId]: "GOOD" | "FAIR" | "CHECK" | "UNKNOWN" }
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

function parseDisplayWaveHeight(value: string | null): number | null {
  if (value == null) return null;
  if (value.trim().toLowerCase() === "flat") return 0;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function conditionSummaryFromScore(score: number): ConditionSummary {
  // Web map v1 derives native-aligned summaries from the current-row score.
  // Native currently maps from the final verdict in surf-spot-map-summary.ts.
  // TODO(map parity): expose verdicts here so window demotions can't diverge.
  if (score >= 70) return "GOOD";
  if (score >= 40) return "FAIR";
  return "CHECK";
}

function forecastTimeMs(
  row: Pick<EnhancedForecastEntity, "forecast_at" | "forecast_date" | "forecast_time">
): number | null {
  const direct = Date.parse(String(row.forecast_at ?? ""));
  if (Number.isFinite(direct)) return direct;

  const fallback = Date.parse(
    `${row.forecast_date ?? ""}T${row.forecast_time ?? "00:00:00"}Z`
  );
  return Number.isFinite(fallback) ? fallback : null;
}

function nearestForecastRow(
  rows: EnhancedForecastEntity[],
  targetMs: number
): EnhancedForecastEntity | null {
  let best: EnhancedForecastEntity | null = null;
  let bestDelta = Infinity;
  let bestIsFuture = false;

  for (const row of rows) {
    const rowMs = forecastTimeMs(row);
    if (rowMs == null) continue;

    const delta = Math.abs(rowMs - targetMs);
    const isFuture = rowMs >= targetMs;
    if (
      delta < bestDelta ||
      (delta === bestDelta && isFuture && !bestIsFuture)
    ) {
      best = row;
      bestDelta = delta;
      bestIsFuture = isFuture;
    }
  }

  return best;
}

function buildSwellPartitionTimeline(
  rows: EnhancedForecastEntity[],
  now: Date
): Record<string, SwellPartition[]> {
  const rowsByBeach = new Map<string, EnhancedForecastEntity[]>();

  for (const row of rows) {
    const existing = rowsByBeach.get(row.beach_id) ?? [];
    existing.push(row);
    rowsByBeach.set(row.beach_id, existing);
  }

  const timeline: Record<string, SwellPartition[]> = {};
  const nowMs = now.getTime();

  rowsByBeach.forEach((beachRows, beachId) => {
    const partitions = SWELL_TIMELINE_HOUR_OFFSETS.map((offsetHours) => {
      const targetMs = nowMs + offsetHours * 60 * 60 * 1000;
      const row = nearestForecastRow(beachRows, targetMs);
      return row ? rowToSwellPartition(row) : null;
    }).filter((partition): partition is SwellPartition => partition !== null);

    if (partitions.length > 0) {
      timeline[beachId] = partitions;
    }
  });

  return timeline;
}

async function fetchBulkCurrentForecastsWithV51Display(
  supabase: SupabaseClient<Database>,
  beachIds: string[]
): Promise<{
  data: EnhancedForecastEntity[] | null;
  timelineRows: EnhancedForecastEntity[];
  error: { message: string } | null;
}> {
  const now = new Date();
  const targetDate = now.toISOString().split("T")[0];
  const tomorrow = nextUtcDateString(now);
  const currentTime = now.toISOString().slice(11, 19);

  const { data, error } = await supabase
    .from("enhanced_forecasts")
    .select(BULK_FORECAST_SELECT)
    .in("beach_id", beachIds)
    .in("forecast_date", [targetDate, tomorrow]);

  if (error || !data) {
    return {
      data: null,
      timelineRows: [],
      error: error ? { message: error.message } : null,
    };
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
    Array.from(rankedByBeach.values())
  );

  return {
    data: displayRows,
    timelineRows: data as unknown as EnhancedForecastEntity[],
    error: null,
  };
}

async function bulkForecastHandler(
  request: NextRequest,
  context: OptionalAuthContext
): Promise<NextResponse> {
  try {
    const searchParams = request.nextUrl.searchParams;
    const beachIdsParam = searchParams.get("beachIds");

    // Return empty forecasts for missing/empty beachIds (not an error)
    if (!beachIdsParam || !beachIdsParam.trim()) {
      return createSuccessResponse(emptyBulkForecastResponse);
    }

    // Parse beach IDs and filter out empty strings
    const beachIds = beachIdsParam
      .split(",")
      .map(id => id.trim())
      .filter(Boolean);

    if (beachIds.length === 0) {
      return createSuccessResponse(emptyBulkForecastResponse);
    }

    // Limit to prevent abuse
    const maxBeaches = 50;
    const limitedBeachIds = beachIds.slice(0, maxBeaches);
    const { supabase } = context;

    const {
      data,
      timelineRows,
      error,
    } = await fetchBulkCurrentForecastsWithV51Display(supabase, limitedBeachIds);

    if (error) {
      console.error("Error fetching bulk forecasts:", error);
      return handleApiError(new Error(error.message), "Failed to fetch bulk forecasts");
    }

    const waveHeightMap: Record<string, number | undefined> = {};
    (data || []).forEach((row) => {
      const parsedWaveHeight = parseDisplayWaveHeight(row.wave_height);
      if (parsedWaveHeight != null) {
        waveHeightMap[row.beach_id] = parsedWaveHeight;
      }
    });

    const swellPartitionMap: Record<string, SwellPartition> = {};
    (data || []).forEach((row) => {
      swellPartitionMap[row.beach_id] = rowToSwellPartition(row);
    });
    const swellPartitionTimeline = buildSwellPartitionTimeline(
      timelineRows,
      new Date()
    );

    const conditionScoreMap: Record<string, number | undefined> = {};
    const conditionSummaryMap: Record<string, ConditionSummary> =
      Object.fromEntries(
        limitedBeachIds.map((beachId) => [beachId, "UNKNOWN" as ConditionSummary])
      );

    // Fetch calibration status for each beach. We expose only the boolean —
    // `shoaling_factors` is ~4KB of JSONB per beach and the client only needs
    // to know whether the displayed wave height came from the empirically
    // calibrated pipeline. Beaches missing from this query (errors, soft
    // deletes) default to `false`.
    const isCalibratedMap: Record<string, boolean> = {};
    const { data: beachRows, error: beachError } = await supabase
      .from("beaches")
      .select(BULK_BEACH_SELECT)
      .in("id", limitedBeachIds);

    if (beachError) {
      console.error("Error fetching beach calibration status:", beachError);
      // Non-fatal: leave map empty, clients default to `false`.
    } else {
      const scoringBeachRows = (beachRows || []) as unknown as Beach[];

      scoringBeachRows.forEach((row) => {
        isCalibratedMap[row.id] = row.shoaling_factors !== null;
      });

      const beachesById = new Map(scoringBeachRows.map((beach) => [
        beach.id,
        beach,
      ]));

      (data || []).forEach((forecast) => {
        const beach = beachesById.get(forecast.beach_id);
        if (!beach) return;

        try {
          const score = scoreWindowWithEngine(forecast, beach);
          if (!Number.isFinite(score)) return;

          conditionScoreMap[forecast.beach_id] = score;
          conditionSummaryMap[forecast.beach_id] =
            conditionSummaryFromScore(score);
        } catch (error) {
          console.warn("Failed to score bulk forecast condition:", {
            beachId: forecast.beach_id,
            error,
          });
        }
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
      conditionScores: conditionScoreMap,
      conditionSummaries: conditionSummaryMap,
      swellPartitions: swellPartitionMap,
      swellPartitionTimeline,
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
