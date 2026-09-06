import type { NextRequest, NextResponse } from "next/server";
import {
  createValidationError,
  createSuccessResponse,
  handleApiError,
  withAuth,
  withRateLimit,
  type OptionalAuthContext,
  withNoStore,
} from "@/lib/middleware/api-wrappers";
import {
  sanitizeBulkForecastForMajorEventHold,
  type BulkForecastCandidateBinding,
  type BulkForecastResponseLike,
  type SanitizedBulkForecastResponse,
} from "@/lib/recommendations/major-event-hold/adapters/bulk-forecast";
import { evaluateMajorEventHoldCandidates } from "@/lib/recommendations/major-event-hold/service";
import type { RecommendationAvailability } from "@/lib/recommendations/major-event-hold/types";
import { applyV51DisplayOverrideToForecasts } from "@/lib/services/forecast/v5-display-gate";
import { scoreWindowConditionScore } from "@/lib/services/discovery/window-selector/window-scorer";
import { getProfileExperienceLevel } from "@/lib/profile/skill-level";
import { parseSkillLevel } from "@/lib/domains/user-preferences/skill-level";
import { normalizeBoardClass, type BoardClass } from "@/lib/domains/rideability";
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
import { MAX_TIMELINE_FIELD_BEACHES } from "@/components/map/timeline-beach-sampler";
import {
  conditionSummaryFromScore,
  interpolateSwellPartition,
  rowToSwellPartition,
  type SwellPartition,
} from "./swell-partition";

import { resolveMajorEventHoldBoundary } from "@/lib/recommendations/major-event-hold/adapters/shared";

export const dynamic = 'force-dynamic';

const BULK_CANDIDATE_DURATION_MS = 3 * 60 * 60 * 1000;
// A forecast row may stand in for "current conditions" only within one
// 3-hourly slot of now. Beyond that we are showing a stale or next-day row
// as current, which is worse than an honest gap.
const CURRENT_CONDITIONS_TOLERANCE_MS = 3 * 60 * 60 * 1000;
const UNAVAILABLE_RECOMMENDATION: RecommendationAvailability = {
  state: "none",
  reasonCode: "hold_state_unavailable",
  holdEpoch: "hold-state-unavailable",
};

export type { SwellPartition };

export interface HourlySwellTimeline {
  timestamps: string[];
  partitionsByBeach: Record<string, Array<SwellPartition | null>>;
  hasMore: boolean;
  nextStart: string | null;
}

export type ConditionSummary =
  | "EPIC"
  | "GOOD"
  | "FAIR"
  | "RIDEABLE"
  | "MEH"
  | "UNKNOWN";

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
  "beach_id, forecast_date, forecast_time, forecast_at, wave_height, wave_period, wave_direction, wave_height_om, wave_direction_om, swell_height_om, swell_period_om, swell_direction_om, swell_1_height, swell_1_period, swell_1_direction, swell_2_height, swell_2_period, swell_2_direction, wind_wave_height, wind_wave_period, wind_wave_direction, wind_speed, wind_direction, wind_direction_deg, water_temp, tide_height, tide_status, confidence_score, data_source" as const;

const HOURLY_TIMELINE_SELECT =
  "beach_id, forecast_at, swell_height_om, swell_period_om, swell_direction_om, wave_direction_om, swell_1_height, swell_1_period, swell_1_direction, swell_2_height, swell_2_period, swell_2_direction, wind_speed, wind_direction_deg" as const;

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
const TIMELINE_ANCHOR_HOURS = 3;
const TIMELINE_ANCHOR_MS = TIMELINE_ANCHOR_HOURS * HOUR_MS;
const HOURLY_INTERPOLATION_SPAN_HOURS = 3;
const HOURLY_SAMPLE_HALO_MS = HOURLY_INTERPOLATION_SPAN_HOURS * HOUR_MS;
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
 * - timelineOnly=true: omit today-headline enrichment
 * - includeConditions=true: add safety-checked suitability scores to hourly partitions
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
 *     conditionSummaries: {
 *       [beachId]: "EPIC" | "GOOD" | "FAIR" | "RIDEABLE" | "MEH" | "UNKNOWN"
 *     }
 *   }
 * }
 */
export { conditionSummaryFromScore } from "./swell-partition";

function buildBulkCandidateBindings(
  response: BulkForecastResponseLike,
  selectedForecastAtByBeach: ReadonlyMap<string, string>
): BulkForecastCandidateBinding[] {
  const positiveBeachIds = new Set<string>();
  for (const [beachId, score] of Object.entries(response.conditionScores)) {
    if (typeof score === "number" && Number.isFinite(score)) {
      positiveBeachIds.add(beachId);
    }
  }
  for (const [beachId, summary] of Object.entries(response.conditionSummaries)) {
    if (summary !== undefined && summary !== "UNKNOWN") {
      positiveBeachIds.add(beachId);
    }
  }

  const bindings: BulkForecastCandidateBinding[] = [];
  for (const beachId of positiveBeachIds) {
    const startsAt = selectedForecastAtByBeach.get(beachId);
    const startsAtMs = startsAt ? Date.parse(startsAt) : NaN;
    if (!startsAt || !Number.isFinite(startsAtMs)) continue;
    const candidate = {
      candidateId: `bulk-forecast:${beachId}:${startsAt}`,
      beachId,
      startsAt,
      endsAt: new Date(startsAtMs + BULK_CANDIDATE_DURATION_MS).toISOString(),
    };
    bindings.push({ beachId, candidate });
  }
  return bindings;
}

async function sanitizeBulkResponse<TResponse extends BulkForecastResponseLike>(
  response: TResponse,
  selectedForecastAtByBeach: ReadonlyMap<string, string>,
  profileExperience: unknown
): Promise<SanitizedBulkForecastResponse<TResponse>> {
  const bindings = buildBulkCandidateBindings(response, selectedForecastAtByBeach);
  const candidates = bindings.map(({ candidate }) => candidate);
  const decisions = await evaluateMajorEventHoldCandidates({
    candidates,
    profileExperience,
  });
  return sanitizeBulkForecastForMajorEventHold(
    response,
    bindings,
    candidates,
    decisions
  );
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

function parseTimelineBeachIds(
  searchParams: URLSearchParams,
  requestedBeachIds: readonly string[],
): { beachIds: string[]; error: string | null } {
  const requestedBeachIdSet = new Set(requestedBeachIds);
  const timelineBeachIdsParam = searchParams.get("timelineBeachIds");
  if (
    timelineBeachIdsParam === null
    && requestedBeachIds.length > MAX_TIMELINE_FIELD_BEACHES
  ) {
    return {
      beachIds: [],
      error: `timelineBeachIds is required when beachIds includes more than ${MAX_TIMELINE_FIELD_BEACHES} beaches`,
    };
  }
  const timelineBeachIds = timelineBeachIdsParam === null
    ? [...requestedBeachIds]
    : Array.from(new Set(
        timelineBeachIdsParam
          .split(",")
          .map((beachId) => beachId.trim())
          .filter(Boolean),
      ));

  if (timelineBeachIds.length === 0) {
    return { beachIds: [], error: "timelineBeachIds must include at least one beach" };
  }
  if (timelineBeachIds.length > MAX_TIMELINE_FIELD_BEACHES) {
    return {
      beachIds: [],
      error: `timelineBeachIds supports at most ${MAX_TIMELINE_FIELD_BEACHES} beaches`,
    };
  }
  if (timelineBeachIds.some((beachId) => !requestedBeachIdSet.has(beachId))) {
    return {
      beachIds: [],
      error: "timelineBeachIds must be a subset of beachIds",
    };
  }

  return { beachIds: timelineBeachIds, error: null };
}

function timelineAnchorTimestamps(start: Date, end: Date): string[] {
  const firstAnchorMs = Math.floor(start.getTime() / TIMELINE_ANCHOR_MS)
    * TIMELINE_ANCHOR_MS;
  const finalAnchorMs = Math.ceil(end.getTime() / TIMELINE_ANCHOR_MS)
    * TIMELINE_ANCHOR_MS;
  const timestamps: string[] = [];

  for (
    let anchorMs = firstAnchorMs;
    anchorMs <= finalAnchorMs;
    anchorMs += TIMELINE_ANCHOR_MS
  ) {
    timestamps.push(new Date(anchorMs).toISOString());
  }

  return timestamps;
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

function partitionForTimelineHour(
  rowsByHour: ReadonlyMap<number, EnhancedForecastEntity>,
  hourMs: number,
  scores?: ReadonlyMap<EnhancedForecastEntity, number | null>,
): SwellPartition | null {
  const partition = (row: EnhancedForecastEntity): SwellPartition => ({
    ...rowToSwellPartition(row),
    ...(scores ? { conditionScore: scores.get(row) ?? null } : {}),
  });
  const exact = rowsByHour.get(hourMs);
  if (exact) return partition(exact);

  let previous: EnhancedForecastEntity | null = null;
  let next: EnhancedForecastEntity | null = null;
  for (
    let deltaHours = 1;
    deltaHours <= HOURLY_INTERPOLATION_SPAN_HOURS;
    deltaHours += 1
  ) {
    previous ??= rowsByHour.get(hourMs - deltaHours * HOUR_MS) ?? null;
    next ??= rowsByHour.get(hourMs + deltaHours * HOUR_MS) ?? null;
  }
  if (!previous || !next) return null;

  const previousMs = forecastAtMs(previous);
  const nextMs = forecastAtMs(next);
  if (
    previousMs == null
    || nextMs == null
    || nextMs <= previousMs
    || nextMs - previousMs > HOURLY_SAMPLE_HALO_MS
  ) {
    return null;
  }

  return interpolateSwellPartition(
    partition(previous),
    partition(next),
    (hourMs - previousMs) / (nextMs - previousMs),
  );
}

function buildHourlySwellTimeline(
  rows: EnhancedForecastEntity[],
  beachIds: string[],
  window: HourlyTimelineWindow,
  nextStart: string | null,
  scores?: ReadonlyMap<EnhancedForecastEntity, number | null>,
): HourlySwellTimeline {
  const requestedBeachIds = new Set(beachIds);
  const rowsByBeach = new Map<string, Map<number, EnhancedForecastEntity>>();

  for (const row of rows) {
    if (!requestedBeachIds.has(row.beach_id)) continue;

    const rowMs = forecastAtMs(row);
    if (rowMs == null) continue;

    if (
      rowMs < window.start.getTime() - HOURLY_SAMPLE_HALO_MS
      || rowMs >= window.end.getTime() + HOURLY_SAMPLE_HALO_MS
    ) {
      continue;
    }
    if (rowMs % HOUR_MS !== 0) continue;

    const beachRows = rowsByBeach.get(row.beach_id)
      ?? new Map<number, EnhancedForecastEntity>();
    if (!beachRows.has(rowMs)) beachRows.set(rowMs, row);
    rowsByBeach.set(row.beach_id, beachRows);
  }

  const hourKeys: number[] = [];
  for (
    let hourMs = window.start.getTime();
    hourMs < window.end.getTime();
    hourMs += HOUR_MS
  ) {
    hourKeys.push(hourMs);
  }

  const timestamps = hourKeys.map((hourMs) => new Date(hourMs).toISOString());
  const partitionsByBeach = Object.fromEntries(
    beachIds.map((beachId) => [
      beachId,
      hourKeys.map((hourMs) => {
        const beachRows = rowsByBeach.get(beachId);
        return beachRows ? partitionForTimelineHour(beachRows, hourMs, scores) : null;
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

export async function fetchHourlySwellTimelineRows(
  supabase: SupabaseClient<Database>,
  beachIds: string[],
  start: Date,
  end: Date,
  includeConditions = false,
): Promise<{
  data: EnhancedForecastEntity[] | null;
  error: { message: string } | null;
}> {
  const anchorTimestamps = timelineAnchorTimestamps(start, end);
  const chunks: string[][] = [];
  const chunkSize = Math.min(10, Math.max(1, Math.floor(999 / Math.max(1, anchorTimestamps.length))));
  for (let index = 0; index < beachIds.length; index += chunkSize) {
    chunks.push(beachIds.slice(index, index + chunkSize));
  }
  const chunkResults = await Promise.all(
    chunks.map((chunk) =>
      supabase
        .from("enhanced_forecasts")
        .select((includeConditions ? BULK_FORECAST_SELECT : HOURLY_TIMELINE_SELECT) as string)
        .in("beach_id", chunk)
        .in("forecast_at", anchorTimestamps)
        .gte("forecast_at", new Date(start.getTime() - HOURLY_SAMPLE_HALO_MS).toISOString())
        .lt("forecast_at", new Date(end.getTime() + HOURLY_SAMPLE_HALO_MS).toISOString())
        .order("forecast_at", { ascending: true })
        .order("beach_id", { ascending: true }),
    ),
  );
  const rows: unknown[] = [];
  for (const result of chunkResults) {
    if (result.error) return { data: null, error: { message: result.error.message } };
    if (result.data?.length === 1000) {
      console.warn(
        "⚠️ [fetchHourlySwellTimelineRows] Chunk returned exactly 1000 rows — possible PostgREST truncation",
      );
    }
    rows.push(...(result.data ?? []));
  }

  return {
    data: rows as EnhancedForecastEntity[],
    error: null,
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
  const eligibleFutureAnchors = timelineAnchorTimestamps(
    end,
    new Date(end.getTime() + MAX_TIMELINE_HOURS * HOUR_MS),
  ).filter((timestamp) => Date.parse(timestamp) >= end.getTime());
  const { data, error } = await supabase
    .from("enhanced_forecasts")
    .select("forecast_at")
    .in("beach_id", beachIds)
    .in("forecast_at", eligibleFutureAnchors)
    .gte("forecast_at", end.toISOString())
    .order("forecast_at", { ascending: true })
    .limit(1);

  if (error) return { nextStart: null, error: { message: error.message } };

  const nextEpoch = Date.parse(String(data?.[0]?.forecast_at ?? ""));
  if (!Number.isFinite(nextEpoch) || nextEpoch % HOUR_MS !== 0) {
    return { nextStart: null, error: null };
  }

  return { nextStart: end.toISOString(), error: null };
}

async function fetchHourlySwellTimeline(
  supabase: SupabaseClient<Database>,
  beachIds: string[],
  window: HourlyTimelineWindow,
  scoring?: { skillLevel: string | null; boardClasses: BoardClass[] },
): Promise<{
  timeline: HourlySwellTimeline | null;
  error: { message: string } | null;
}> {
  const rowsPromise = fetchHourlySwellTimelineRows(
    supabase,
    beachIds,
    window.start,
    window.end,
    Boolean(scoring),
  );
  const nextStartPromise = fetchNextHourlySwellTimelineStart(
    supabase,
    beachIds,
    window.end,
  );
  const [rowsResult, nextStartResult] = await Promise.all([
    rowsPromise,
    nextStartPromise,
  ]);
  const { data: rows, error: rowsError } = rowsResult;
  if (rowsError || !rows) {
    return {
      timeline: null,
      error: rowsError ?? { message: "No hourly timeline rows returned" },
    };
  }

  const { nextStart, error: nextStartError } = nextStartResult;
  if (nextStartError) return { timeline: null, error: nextStartError };

  let scores: Map<EnhancedForecastEntity, number | null> | undefined;
  if (scoring) {
    const result = await supabase.from("beaches").select(BULK_BEACH_SELECT).in("id", beachIds);
    if (result.error) return { timeline: null, error: { message: result.error.message } };
    const beaches = new Map((result.data as unknown as Beach[]).map((beach) => [beach.id, beach]));
    scores = new Map();
    const displayRows = await applyV51DisplayOverrideToForecasts(rows);
    const displayByTime = new Map(displayRows.map((row) => [`${row.beach_id}:${row.forecast_at}`, row]));
    for (const row of rows) {
      const displayRow = displayByTime.get(`${row.beach_id}:${row.forecast_at}`) ?? row;
      const beach = beaches.get(row.beach_id);
      const score = beach && displayRow.wave_height != null
        ? scoreWindowConditionScore(displayRow, beach, scoring.skillLevel, null, scoring.boardClasses)
        : null;
      scores.set(row, score != null && Number.isFinite(score) ? score : null);
    }
  }
  const timeline = buildHourlySwellTimeline(rows, beachIds, window, nextStart, scores);
  if (scoring) {
    const candidates = Object.entries(timeline.partitionsByBeach).flatMap(([beachId, partitions]) =>
      partitions.flatMap((partition, index) => partition?.conditionScore == null ? [] : [{
        candidateId: `hourly-map:${beachId}:${timeline.timestamps[index]}`,
        beachId,
        startsAt: timeline.timestamps[index],
        endsAt: new Date(Date.parse(timeline.timestamps[index]) + HOUR_MS).toISOString(),
      }]),
    );
    const decisions = await evaluateMajorEventHoldCandidates({ candidates, profileExperience: scoring.skillLevel });
    const boundary = resolveMajorEventHoldBoundary(candidates, candidates, decisions);
    const unavailable = boundary.recommendationAvailability.reasonCode === "hold_state_unavailable";
    for (const [beachId, partitions] of Object.entries(timeline.partitionsByBeach)) {
      partitions.forEach((partition, index) => {
        if (partition && (unavailable || boundary.blockedCandidateIds.has(`hourly-map:${beachId}:${timeline.timestamps[index]}`))) {
          partition.conditionScore = null;
        }
      });
    }
  }
  return { timeline, error: null };
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

export async function bulkForecastHandler(
  request: NextRequest,
  context: OptionalAuthContext
): Promise<NextResponse> {
  try {
    const searchParams = request.nextUrl.searchParams;
    const beachIdsParam = searchParams.get("beachIds");
    const forecastAtParam = searchParams.get("forecastAt");
    const isHourlyTimeline = searchParams.get("timeline") === "hourly";
    const timelineOnlyParam = searchParams.get("timelineOnly");
    if (
      timelineOnlyParam !== null
      && timelineOnlyParam !== "true"
      && timelineOnlyParam !== "false"
    ) {
      return createValidationError("timelineOnly must be true or false");
    }
    const isHourlyTimelineOnly =
      isHourlyTimeline && timelineOnlyParam === "true";
    if (timelineOnlyParam === "true" && !isHourlyTimeline) {
      return createValidationError("timelineOnly requires timeline=hourly");
    }
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
      return createSuccessResponse(
        await sanitizeBulkResponse(emptyBulkForecastResponse, new Map(), null)
      );
    }

    // Parse beach IDs and filter out empty strings
    const beachIds = beachIdsParam
      .split(",")
      .map(id => id.trim())
      .filter(Boolean);

    if (beachIds.length === 0) {
      return createSuccessResponse(
        await sanitizeBulkResponse(emptyBulkForecastResponse, new Map(), null)
      );
    }

    // Limit to prevent abuse
    const maxBeaches = 50;
    const limitedBeachIds = beachIds.slice(0, maxBeaches);
    const timelineBeachIdResult = isHourlyTimeline
      ? parseTimelineBeachIds(searchParams, limitedBeachIds)
      : null;
    if (timelineBeachIdResult?.error) {
      return createValidationError(timelineBeachIdResult.error);
    }
    const timelineBeachIds = timelineBeachIdResult?.beachIds ?? [];
    const { supabase, user } = context;
    const includeConditions = searchParams.get("includeConditions") === "true";
    const timelineResponseOnly = (isHourlyTimelineExtension && timelineOnlyParam !== "false") || isHourlyTimelineOnly;
    const loadScoring = includeConditions || !timelineResponseOnly;
    const [profileSkillLevel, boardClasses] = await Promise.all([
      loadScoring ? getProfileExperienceLevel(supabase, user?.id) : Promise.resolve(null),
      user?.id && loadScoring
        ? supabase
            .from("boards")
            .select("board_type")
            .eq("user_id", user.id)
            .then(({ data }) => Array.from(new Set(
              (data ?? [])
                .map((row) => normalizeBoardClass(row.board_type))
                .filter((boardClass): boardClass is BoardClass => boardClass !== null)
            )))
        : Promise.resolve<BoardClass[]>([]),
    ]);
    // Authenticated profiles win; the validated hint covers native WebViews without cookies.
    const userSkillLevel = profileSkillLevel ?? parseSkillLevel(
      searchParams.get("skillLevel"),
    );
    const scoring = includeConditions ? { skillLevel: userSkillLevel ?? null, boardClasses } : undefined;


    if (timelineResponseOnly && hourlyTimelineWindow) {
      const { timeline, error } = await fetchHourlySwellTimeline(
        supabase,
        timelineBeachIds,
        hourlyTimelineWindow,
        scoring,
      );
      if (error || !timeline) {
        console.error("Error fetching hourly swell timeline:", error);
        return handleApiError(
          new Error(error?.message ?? "No hourly timeline returned"),
          "Failed to fetch hourly swell timeline",
        );
      }

      if (isHourlyTimelineOnly) {
        return createSuccessResponse({
          ...emptyBulkForecastResponse,
          hourlySwellTimeline: timeline,
          recommendationAvailability: UNAVAILABLE_RECOMMENDATION,
        });
      }

      return createSuccessResponse({
        hourlySwellTimeline: timeline,
        recommendationAvailability: UNAVAILABLE_RECOMMENDATION,
      });
    }

    const fetchWindow = resolveForecastFetchWindow(forecastAtParam);
    const forecastPromise = fetchBulkForecastRowsWithV51Display(
      supabase,
      limitedBeachIds,
      fetchWindow.start,
      fetchWindow.end
    );
    const hourlyTimelinePromise = hourlyTimelineWindow
      ? fetchHourlySwellTimeline(supabase, timelineBeachIds, hourlyTimelineWindow, scoring)
      : Promise.resolve(null);
    const beachPromise = supabase
      .from("beaches")
      .select(BULK_BEACH_SELECT)
      .in("id", limitedBeachIds);
    const beachEnrichmentPromise = Promise.resolve(beachPromise).then(
      async (beachResult) => {
        if (beachResult.error || fetchWindow.selectedAt !== null) {
          return { beachResult, sunTimesCache: undefined };
        }
        const scoringBeachRows = (beachResult.data || []) as unknown as Beach[];
        const todayDates = Array.from(
          new Set(
            scoringBeachRows.map((beach) => beachTodayDate(beach, new Date()))
          )
        );
        const sunTimesCache = await getBatchSunTimes(limitedBeachIds, todayDates);
        return { beachResult, sunTimesCache };
      },
    );

    const hourlyTimelineSettledPromise = hourlyTimelinePromise.then(
      (value) => ({ status: "fulfilled" as const, value }),
      (reason: unknown) => ({ status: "rejected" as const, reason }),
    );
    const beachEnrichmentSettledPromise = beachEnrichmentPromise.then(
      (value) => ({ status: "fulfilled" as const, value }),
      (reason: unknown) => ({ status: "rejected" as const, reason }),
    );
    const forecastResult = await forecastPromise;
    if (forecastResult.error) {
      const { error } = forecastResult;
      console.error("Error fetching bulk forecasts:", error);
      return handleApiError(new Error(error.message), "Failed to fetch bulk forecasts");
    }
    const [hourlyTimelineSettled, beachEnrichmentSettled] = await Promise.all([
      hourlyTimelineSettledPromise,
      beachEnrichmentSettledPromise,
    ]);
    if (hourlyTimelineSettled.status === "rejected") {
      throw hourlyTimelineSettled.reason;
    }
    if (beachEnrichmentSettled.status === "rejected") {
      throw beachEnrichmentSettled.reason;
    }

    const hourlyTimelineResult = hourlyTimelineSettled.value;
    const { beachResult, sunTimesCache } = beachEnrichmentSettled.value;
    const { data, timelineRows } = forecastResult;

    let hourlySwellTimeline: HourlySwellTimeline | undefined;
    if (hourlyTimelineResult) {
      const { timeline, error: hourlyTimelineError } = hourlyTimelineResult;
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
    const selectedScoreForecastAtByBeach = new Map<string, string>();
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
    const { data: beachRows, error: beachError } = beachResult;

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
          if (!display) {
            // After the last daylight window of the local day there is no
            // "today's best window" — but current conditions still exist, and
            // every map marker and spot sheet reads these two maps. Withhold the
            // recommendation, not the measurement: fall back to the row nearest
            // now, the same row the swell-partition path already resolves.
            const currentRow = nearestForecastRow(beachForecasts, nowMs);
            const currentRowMs = currentRow ? forecastTimeMs(currentRow) : null;
            if (
              currentRow &&
              currentRowMs != null &&
              Math.abs(currentRowMs - nowMs) <= CURRENT_CONDITIONS_TOLERANCE_MS
            ) {
              display = resolveSelectedHourDisplay(currentRow);
              scoreForecast = currentRow;
            }
          }
        }

        if (display) {
          displayForecastMap[beach.id] = display;
          waveHeightMap[beach.id] =
            parseLegacyWaveHeight(scoreForecast?.wave_height) ?? display.minFt;
        }

        const forecast = scoreForecast;
        if (!forecast) continue;

        try {
          const score = scoreWindowConditionScore(
            forecast,
            beach,
            userSkillLevel,
            null,
            boardClasses,
          );
          if (!Number.isFinite(score)) continue;

          conditionScoreMap[beach.id] = score;
          conditionSummaryMap[beach.id] =
            conditionSummaryFromScore(score);
          selectedScoreForecastAtByBeach.set(beach.id, forecast.forecast_at);
        } catch (error) {
          console.warn("Failed to score bulk forecast condition:", {
            beachId: beach.id,
            error,
          });
        }
      }
    }

    const waterTempMap: Record<string, string | undefined> = {};
    for (const [beachId, rows] of timelineByBeach) {
      const currentTempRow = rows.find((row) => (
        Date.parse(row.forecast_at) >= nowMs && row.water_temp != null
      ));
      if (currentTempRow?.water_temp != null) {
        waterTempMap[beachId] = currentTempRow.water_temp;
      }
    }

    const response = {
      forecasts: waveHeightMap,
      displayForecasts: displayForecastMap,
      waterTemps: waterTempMap,
      isCalibrated: isCalibratedMap,
      conditionScores: conditionScoreMap,
      conditionSummaries: conditionSummaryMap,
      swellPartitions: swellPartitionMap,
      swellPartitionTimeline,
      ...(hourlySwellTimeline ? { hourlySwellTimeline } : {}),
    };
    return createSuccessResponse(
      await sanitizeBulkResponse(
        response,
        selectedScoreForecastAtByBeach,
        userSkillLevel
      )
    );
  } catch (error) {
    console.error("Unexpected error in bulk forecast API:", error);
    return handleApiError(error instanceof Error ? error : new Error(String(error)), "Unexpected error fetching forecasts");
  }
}

// Apply rate limiting to prevent abuse of bulk operations
export const GET = withNoStore(
  withRateLimit(
    withAuth(bulkForecastHandler, {
      optional: true,
      errorMessage: "Unexpected error fetching forecasts",
    }),
    "forecast-bulk"
  )
);
