import type { NextRequest, NextResponse } from "next/server";
import {
  createValidationError,
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

export interface HourlySwellTimeline {
  timestamps: string[];
  partitionsByBeach: Record<string, Array<SwellPartition | null>>;
  hasMore: boolean;
  nextStart: string | null;
}

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
const HOURLY_SWELL_TIMELINE_HOUR_OFFSETS = Array.from(
  { length: 43 },
  (_, hourOffset) => hourOffset,
);
const DEFAULT_TIMELINE_HOURS = 48;
const MAX_TIMELINE_HOURS = 14 * 24;
const HOUR_MS = 60 * 60 * 1000;
const ISO_TIMESTAMP_WITH_TIMEZONE =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?(Z|[+-]\d{2}:\d{2})$/;

interface HourlyTimelineWindow {
  start: Date;
  end: Date;
}

type HourlyTimelineWindowParseResult =
  | { window: HourlyTimelineWindow; error: null }
  | { window: null; error: string };

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

function parseIsoTimestampWithTimezone(value: string): number | null {
  const match = ISO_TIMESTAMP_WITH_TIMEZONE.exec(value);
  if (!match) return null;

  const [, yearText, monthText, dayText, hourText, minuteText, secondText, fraction, zone] =
    match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  const millisecond = Number((fraction ?? "").padEnd(3, "0").slice(0, 3));
  const localDate = new Date(0);
  localDate.setUTCFullYear(year, month - 1, day);
  localDate.setUTCHours(hour, minute, second, millisecond);

  if (
    localDate.getUTCFullYear() !== year ||
    localDate.getUTCMonth() !== month - 1 ||
    localDate.getUTCDate() !== day ||
    localDate.getUTCHours() !== hour ||
    localDate.getUTCMinutes() !== minute ||
    localDate.getUTCSeconds() !== second
  ) {
    return null;
  }

  if (zone !== "Z") {
    const offsetHours = Number(zone.slice(1, 3));
    const offsetMinutes = Number(zone.slice(4, 6));
    if (offsetHours > 14 || offsetMinutes > 59 || (offsetHours === 14 && offsetMinutes > 0)) {
      return null;
    }
  }

  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseHourlyTimelineWindow(
  searchParams: URLSearchParams,
  now: Date,
): HourlyTimelineWindowParseResult {
  const timelineHours = searchParams.get("timelineHours");
  if (timelineHours !== null && !/^\d+$/.test(timelineHours)) {
    return { window: null, error: "timelineHours must be a whole integer" };
  }
  const hours = timelineHours === null
    ? DEFAULT_TIMELINE_HOURS
    : Math.min(MAX_TIMELINE_HOURS, Math.max(1, Number(timelineHours)));

  const timelineStart = searchParams.get("timelineStart");
  const explicitStartMs = timelineStart === null
    ? null
    : parseIsoTimestampWithTimezone(timelineStart);
  if (timelineStart !== null && explicitStartMs === null) {
    return {
      window: null,
      error: "timelineStart must be an ISO-8601 timestamp with timezone",
    };
  }

  const startMs = explicitStartMs ?? Math.floor(now.getTime() / HOUR_MS) * HOUR_MS;
  if (startMs % HOUR_MS !== 0) {
    return { window: null, error: "timelineStart must be aligned to an hour" };
  }
  const start = new Date(startMs);
  const end = new Date(startMs + hours * HOUR_MS);
  return { window: { start, end }, error: null };
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
  now: Date,
  hourOffsets: readonly number[] = SWELL_TIMELINE_HOUR_OFFSETS,
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
    const partitions = hourOffsets.map((offsetHours) => {
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

function forecastAtMs(row: Pick<EnhancedForecastEntity, "forecast_at">): number | null {
  const value = Date.parse(String(row.forecast_at ?? ""));
  return Number.isFinite(value) ? value : null;
}

function buildHourlySwellTimeline(
  rows: EnhancedForecastEntity[],
  beachIds: string[],
  window: HourlyTimelineWindow,
  nextStart: string | null,
): HourlySwellTimeline {
  const requestedBeachIds = new Set(beachIds);
  const rowsByHour = new Map<number, Map<string, EnhancedForecastEntity>>();

  for (const row of rows) {
    if (!requestedBeachIds.has(row.beach_id)) continue;

    const rowMs = forecastAtMs(row);
    if (rowMs == null) continue;

    if (rowMs < window.start.getTime() || rowMs >= window.end.getTime()) continue;
    if (rowMs % HOUR_MS !== 0) continue;

    const hourMs = rowMs;
    const rowsByBeach = rowsByHour.get(hourMs) ?? new Map<string, EnhancedForecastEntity>();
    if (!rowsByBeach.has(row.beach_id)) {
      rowsByBeach.set(row.beach_id, row);
    }
    rowsByHour.set(hourMs, rowsByBeach);
  }

  const hourKeys = Array.from(rowsByHour.keys()).sort((left, right) => left - right);
  const timestamps = hourKeys.map((hourMs) => new Date(hourMs).toISOString());
  const partitionsByBeach = Object.fromEntries(
    beachIds.map((beachId) => [
      beachId,
      hourKeys.map((hourMs) => {
        const row = rowsByHour.get(hourMs)?.get(beachId);
        return row ? rowToSwellPartition(row) : null;
      }),
    ]),
  ) as Record<string, Array<SwellPartition | null>>;

  return {
    timestamps,
    partitionsByBeach,
    hasMore: nextStart !== null,
    nextStart,
  };
}

async function fetchHourlySwellTimelineRows(
  supabase: SupabaseClient<Database>,
  beachIds: string[],
  start: Date,
  end: Date,
): Promise<{
  data: EnhancedForecastEntity[] | null;
  error: { message: string } | null;
}> {
  const { data, error } = await supabase
    .from("enhanced_forecasts")
    .select(BULK_FORECAST_SELECT)
    .in("beach_id", beachIds)
    .gte("forecast_at", start.toISOString())
    .lt("forecast_at", end.toISOString())
    .order("forecast_at", { ascending: true });

  return {
    data: data as unknown as EnhancedForecastEntity[] | null,
    error: error ? { message: error.message } : null,
  };
}

async function fetchNextHourlySwellTimelineStart(
  supabase: SupabaseClient<Database>,
  beachIds: string[],
  end: Date,
): Promise<{
  nextStart: string | null;
  error: { message: string } | null;
}> {
  const { data, error } = await supabase
    .from("enhanced_forecasts")
    .select("forecast_at")
    .in("beach_id", beachIds)
    .gte("forecast_at", end.toISOString())
    .order("forecast_at", { ascending: true })
    .limit(1);

  if (error) return { nextStart: null, error: { message: error.message } };

  const nextEpoch = Date.parse(String(data?.[0]?.forecast_at ?? ""));
  if (!Number.isFinite(nextEpoch) || nextEpoch % HOUR_MS !== 0) {
    return { nextStart: null, error: null };
  }

  return { nextStart: new Date(nextEpoch).toISOString(), error: null };
}

async function fetchHourlySwellTimeline(
  supabase: SupabaseClient<Database>,
  beachIds: string[],
  window: HourlyTimelineWindow,
): Promise<{
  timeline: HourlySwellTimeline | null;
  error: { message: string } | null;
}> {
  const { data: rows, error: rowsError } = await fetchHourlySwellTimelineRows(
    supabase,
    beachIds,
    window.start,
    window.end,
  );
  if (rowsError || !rows) {
    return {
      timeline: null,
      error: rowsError ?? { message: "No hourly timeline rows returned" },
    };
  }

  const { nextStart, error: nextStartError } =
    await fetchNextHourlySwellTimelineStart(supabase, beachIds, window.end);
  if (nextStartError) return { timeline: null, error: nextStartError };

  return {
    timeline: buildHourlySwellTimeline(rows, beachIds, window, nextStart),
    error: null,
  };
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
    const isHourlyTimeline = searchParams.get("timeline") === "hourly";
    const isHourlyTimelineExtension =
      isHourlyTimeline && searchParams.has("timelineStart");
    const hourlyTimelineParseResult = isHourlyTimeline
      ? parseHourlyTimelineWindow(searchParams, new Date())
      : null;
    if (hourlyTimelineParseResult?.error) {
      return createValidationError(hourlyTimelineParseResult.error);
    }
    const hourlyTimelineWindow = hourlyTimelineParseResult?.window ?? null;

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

    if (isHourlyTimelineExtension && hourlyTimelineWindow) {
      const { timeline, error } = await fetchHourlySwellTimeline(
        supabase,
        limitedBeachIds,
        hourlyTimelineWindow,
      );
      if (error || !timeline) {
        console.error("Error fetching hourly swell timeline:", error);
        return handleApiError(
          new Error(error?.message ?? "No hourly timeline returned"),
          "Failed to fetch hourly swell timeline",
        );
      }

      return createSuccessResponse({ hourlySwellTimeline: timeline });
    }

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

    let hourlySwellTimeline: HourlySwellTimeline | undefined;
    if (hourlyTimelineWindow) {
      const { timeline, error: hourlyTimelineError } =
        await fetchHourlySwellTimeline(supabase, limitedBeachIds, hourlyTimelineWindow);

      if (hourlyTimelineError || !timeline) {
        console.error("Error fetching hourly swell timeline:", hourlyTimelineError);
        return handleApiError(
          new Error(hourlyTimelineError?.message ?? "No hourly timeline returned"),
          "Failed to fetch hourly swell timeline",
        );
      }

      hourlySwellTimeline = timeline;
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
      new Date(),
      isHourlyTimeline
        ? HOURLY_SWELL_TIMELINE_HOUR_OFFSETS
        : SWELL_TIMELINE_HOUR_OFFSETS,
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
      ...(hourlySwellTimeline ? { hourlySwellTimeline } : {}),
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
