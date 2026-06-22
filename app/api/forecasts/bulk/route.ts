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
import { scoreWindowConditionScore } from "@/lib/services/discovery/window-selector/window-scorer";
import { getProfileExperienceLevel } from "@/lib/profile/skill-level";
import {
  resolveSelectedHourDisplay,
  resolveTodayHeadline,
  type ForecastDisplay,
} from "@/lib/services/forecast/today-headline";
import { extractForecastDate } from "@/lib/utils/forecast-at-adapter";
import { getBatchSunTimes } from "@/lib/services/discovery";
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
  displayForecasts: {},
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
  "id, name, slug, lat, lon, city, state, country, region, timezone, break_type, skill_level, cdip_station, cdip_eligible, wind_offshore_deg, wind_offshore_tol_deg, wind_cross_shore_ok_kt, wind_onshore_bad_kt, swell_window_center_deg, swell_window_halfwidth_deg, swell_access_factors, wind_exposure_factors, preferred_tide_direction, preferred_tide_ft_min, preferred_tide_ft_max, tide_direction_sensitivity, preference_model, features, hazards, average_rating, review_count, shoaling_factors" as const;

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
 *     displayForecasts: {
 *       [beachId]: { label, minFt, maxFt, forecastAt, context } | undefined
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
function conditionSummaryFromScore(score: number): ConditionSummary {
  // Web map v1 derives native-aligned summaries from the current-row score.
  // Native currently maps from the final verdict in surf-spot-map-summary.ts.
  // TODO(map parity): expose verdicts here so window demotions can't diverge.
  if (score >= 70) return "GOOD";
  if (score >= 40) return "FAIR";
  return "CHECK";
}

function parseLegacyWaveHeight(value: string | number | null | undefined): number | null {
  if (value == null) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (value.trim().toLowerCase() === "flat") return 0;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function resolveForecastFetchWindow(forecastAt: string | null): {
  start: Date;
  end: Date;
  selectedAt: Date | null;
} {
  const selectedMs = forecastAt ? Date.parse(forecastAt) : NaN;
  if (Number.isFinite(selectedMs)) {
    const selectedAt = new Date(selectedMs);
    return {
      selectedAt,
      start: new Date(selectedMs - 2 * 60 * 1000),
      end: new Date(selectedMs + 2 * 60 * 1000),
    };
  }

  const now = new Date();
  return {
    selectedAt: null,
    start: new Date(now.getTime() - 18 * 60 * 60 * 1000),
    end: new Date(now.getTime() + 42 * 60 * 60 * 1000),
  };
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

async function fetchBulkForecastRowsWithV51Display(
  supabase: SupabaseClient<Database>,
  beachIds: string[],
  start: Date,
  end: Date
): Promise<{
  data: EnhancedForecastEntity[] | null;
  timelineRows: EnhancedForecastEntity[];
  error: { message: string } | null;
}> {
  const { data, error } = await supabase
    .from("enhanced_forecasts")
    .select(BULK_FORECAST_SELECT)
    .in("beach_id", beachIds)
    .gte("forecast_at", start.toISOString())
    .lt("forecast_at", end.toISOString())
    .order("forecast_at", { ascending: true });

  if (error || !data) {
    return {
      data: null,
      timelineRows: [],
      error: error ? { message: error.message } : null,
    };
  }

  const displayRows = await applyV51DisplayOverrideToForecasts(
    data as unknown as EnhancedForecastEntity[]
  );

  return {
    data: displayRows,
    timelineRows: data as unknown as EnhancedForecastEntity[],
    error: null,
  };
}

function groupForecastsByBeach(
  rows: EnhancedForecastEntity[] | null | undefined
): Map<string, EnhancedForecastEntity[]> {
  const grouped = new Map<string, EnhancedForecastEntity[]>();
  for (const row of rows ?? []) {
    const existing = grouped.get(row.beach_id) ?? [];
    existing.push(row);
    grouped.set(row.beach_id, existing);
  }
  return grouped;
}

function closestForecastRow(
  rows: EnhancedForecastEntity[],
  selectedAt: Date
): EnhancedForecastEntity | null {
  let best: { row: EnhancedForecastEntity; delta: number } | null = null;
  const targetMs = selectedAt.getTime();

  for (const row of rows) {
    const rowMs = Date.parse(row.forecast_at);
    if (!Number.isFinite(rowMs)) continue;
    const delta = Math.abs(rowMs - targetMs);
    if (!best || delta < best.delta) {
      best = { row, delta };
    }
  }

  return best?.row ?? null;
}

function beachTodayDate(beach: Beach, now: Date): string {
  return now.toLocaleDateString("en-CA", {
    timeZone: beach.timezone || "America/Los_Angeles",
  });
}

async function bulkForecastHandler(
  request: NextRequest,
  context: OptionalAuthContext
): Promise<NextResponse> {
  try {
    const searchParams = request.nextUrl.searchParams;
    const beachIdsParam = searchParams.get("beachIds");
    const forecastAtParam = searchParams.get("forecastAt");

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
    const { supabase, user } = context;

    const userSkillLevel = await getProfileExperienceLevel(supabase, user?.id);
    const fetchWindow = resolveForecastFetchWindow(forecastAtParam);

    const {
      data,
      timelineRows,
      error,
    } = await fetchBulkForecastRowsWithV51Display(
      supabase,
      limitedBeachIds,
      fetchWindow.start,
      fetchWindow.end
    );

    if (error) {
      console.error("Error fetching bulk forecasts:", error);
      return handleApiError(new Error(error.message), "Failed to fetch bulk forecasts");
    }

    const forecastsByBeach = groupForecastsByBeach(data);
    const waveHeightMap: Record<string, number | undefined> = {};
    const displayForecastMap: Record<string, ForecastDisplay | undefined> = {};
    const timelineByBeach = groupForecastsByBeach(timelineRows);
    const swellPartitionMap: Record<string, SwellPartition> = {};
    const nowMs = Date.now();
    for (const [beachId, rows] of timelineByBeach) {
      const row = fetchWindow.selectedAt
        ? closestForecastRow(rows, fetchWindow.selectedAt)
        : nearestForecastRow(rows, nowMs);
      if (row) {
        swellPartitionMap[beachId] = rowToSwellPartition(row);
      }
    }
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
      // Non-fatal: keep the legacy numeric fallback so map colors still render;
      // canonical labels require beach metadata and are omitted on this path.
      for (const [beachId, rows] of forecastsByBeach) {
        const row =
          fetchWindow.selectedAt === null
            ? rows[0]
            : closestForecastRow(rows, fetchWindow.selectedAt);
        const parsed = parseLegacyWaveHeight(row?.wave_height);
        if (parsed != null) {
          waveHeightMap[beachId] = parsed;
        }
      }
    } else {
      const scoringBeachRows = (beachRows || []) as unknown as Beach[];

      scoringBeachRows.forEach((row) => {
        isCalibratedMap[row.id] = row.shoaling_factors !== null;
      });

      const todayDates = Array.from(
        new Set(
          scoringBeachRows.map((beach) => beachTodayDate(beach, new Date()))
        )
      );
      const sunTimesCache =
        fetchWindow.selectedAt === null
          ? await getBatchSunTimes(limitedBeachIds, todayDates)
          : undefined;

      for (const beach of scoringBeachRows) {
        const beachForecasts = forecastsByBeach.get(beach.id) ?? [];
        const forecastForScore =
          fetchWindow.selectedAt === null
            ? null
            : closestForecastRow(beachForecasts, fetchWindow.selectedAt);

        let display: ForecastDisplay | null = null;
        let scoreForecast: EnhancedForecastEntity | null = forecastForScore;

        if (fetchWindow.selectedAt) {
          display = resolveSelectedHourDisplay(forecastForScore);
        } else {
          const localToday = beachTodayDate(beach, new Date());
          const todayForecasts = beachForecasts.filter(
            (forecast) =>
              extractForecastDate(
                forecast.forecast_at,
                beach.timezone || "America/Los_Angeles"
              ) === localToday
          );
          const headline = resolveTodayHeadline({
            forecasts: todayForecasts,
            beach,
            userPrefs: null,
            horizonHours: 24,
            sunTimesCache,
            userSkillLevel,
          });
          display = headline?.display ?? null;
          scoreForecast = headline?.window.sourceForecast ?? null;
        }

        if (display) {
          displayForecastMap[beach.id] = display;
          waveHeightMap[beach.id] =
            parseLegacyWaveHeight(scoreForecast?.wave_height) ?? display.minFt;
        }

        const forecast = scoreForecast;
        if (!forecast) continue;

        try {
          const score = scoreWindowConditionScore(forecast, beach, userSkillLevel);
          if (!Number.isFinite(score)) continue;

          conditionScoreMap[beach.id] = score;
          conditionSummaryMap[beach.id] =
            conditionSummaryFromScore(score);
        } catch (error) {
          console.warn("Failed to score bulk forecast condition:", {
            beachId: beach.id,
            error,
          });
        }
      }
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
      displayForecasts: displayForecastMap,
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
