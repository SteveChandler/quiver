import { isDaylightInterval } from "@/lib/services/discovery/daylight-eligibility";
import { scoreWindowWithComposite } from "@/lib/services/discovery/window-selector/window-scorer";
import { type PersonalBoard } from "@/lib/scoring/personal-board";
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { entitlementFromRow } from "@/lib/alerts/entitlements";
import {
  normalizeBoardClass,
  type BoardClass,
} from "@/lib/domains/rideability";
import { parseSkillLevel } from "@/lib/domains/user-preferences/skill-level";
import {
  forecastToMatchSlot,
  interpretRpcResult,
  matchSlotKey,
} from "@/lib/services/discovery/similarity-layer";
import { resolveRecommendationLabel } from "@/lib/services/discovery/recommendation-label";
import {
  forecastRowIntervalEnd,
} from "@/lib/services/discovery/daylight-eligibility";
import {
  buildCanonicalSessionDecision,
  recommendationLabelForVerdict,
} from "@/lib/recommendations/canonical-decision/engine";
import { toPersonalMatchEvidence } from "@/lib/recommendations/canonical-decision/discovery-adapter";
import type { WaterQualityHoldClient } from "@/lib/recommendations/major-event-hold/water-quality";
import type { Beach } from "@/types/database";
import type { EnhancedForecastEntity } from "@/types/forecast";
import type { SimilarityRecommendation } from "@/types/personalization";
import { resolveForecastTime } from "@/lib/utils/forecast-time-resolver";
import { getTimezoneFromCoords } from "@/lib/utils/timezone-utils.server";
import type { RecommendationLabel } from "@/lib/scoring";

export interface BulkDecisionContext {
  beaches: Beach[];
  boards?: PersonalBoard[];
  skillLevel: ReturnType<typeof parseSkillLevel>;
  boardClasses: BoardClass[];
  sunTimes: Map<string, { sunrises: Date[]; sunsets: Date[] }>;
  matches: Map<string, SimilarityRecommendation>;
  rowDurationsMs: Map<string, number>;
  waterQuality: WaterQualityHoldClient;
}

// Adapt the already-loaded snapshot to the existing safety resolver. Its freshness,
// closure and county rules stay in one implementation; these queries are in memory.
function waterQualitySnapshot(
  rows: Record<string, Array<Record<string, unknown>>>,
): WaterQualityHoldClient {
  return {
    from: (table) => ({
      select: () => {
        let data = [...(rows[table] ?? [])];
        const query = {
          in: (column: string, values: readonly string[]) => {
            data = data.filter((row) => values.includes(String(row[column])));
            return query;
          },
          eq: (column: string, value: string) => {
            data = data.filter((row) => row[column] === value);
            return query;
          },
          order: (column: string, options?: { ascending?: boolean }) => {
            data.sort(
              (a, b) =>
                String(a[column]).localeCompare(String(b[column])) *
                (options?.ascending === false ? -1 : 1),
            );
            return query;
          },
          limit: (count: number) => {
            data = data.slice(0, count);
            return query;
          },
          then: <
            TResult1 = { data: unknown; error: unknown },
            TResult2 = never,
          >(
            fulfilled?:
              | ((value: {
                  data: unknown;
                  error: unknown;
                }) => TResult1 | PromiseLike<TResult1>)
              | null,
            rejected?:
              | ((reason: unknown) => TResult2 | PromiseLike<TResult2>)
              | null,
          ): PromiseLike<TResult1 | TResult2> =>
            Promise.resolve({ data, error: null }).then(fulfilled, rejected),
        };
        return query;
      },
    }),
  };
}

export async function fetchBulkDecisionContext(
  userId: string | null,
  beachIds: string[],
  forecasts: EnhancedForecastEntity[],
  start: Date,
  end: Date,
): Promise<BulkDecisionContext> {
  const slots = [
    ...new Map(
      forecasts.map((forecast) => [
        `${forecast.beach_id}:${forecast.forecast_at}`,
        { beach_id: forecast.beach_id, ...forecastToMatchSlot(forecast) },
      ]),
    ).values(),
  ];
  const { data, error } = await (
    createSupabaseServiceRoleClient() as SupabaseClient
  ).rpc("get_bulk_forecast_decision_context", {
    p_user_id: userId,
    p_beach_ids: beachIds,
    p_slots: slots,
    p_start: new Date(start.getTime() - 86_400_000).toISOString().slice(0, 10),
    p_end: new Date(end.getTime() + 86_400_000).toISOString().slice(0, 10),
  });
  if (error || !data)
    throw new Error(
      `Failed to load bulk decision context: ${error?.message ?? "missing context"}`,
    );
  const sunTimes: BulkDecisionContext["sunTimes"] = new Map();
  for (const row of data.sun_times as Array<{
    beach_id: string;
    sunrise_utc: string | null;
    sunset_utc: string | null;
  }>) {
    const times = sunTimes.get(row.beach_id) ?? { sunrises: [], sunsets: [] };
    if (row.sunrise_utc) times.sunrises.push(new Date(row.sunrise_utc));
    if (row.sunset_utc) times.sunsets.push(new Date(row.sunset_utc));
    sunTimes.set(row.beach_id, times);
  }
  const premium =
    entitlementFromRow(data.personalization?.entitlement) === "premium";
  const matches: BulkDecisionContext["matches"] = new Map();
  for (const match of data.personalization?.matches ?? []) {
    const interpreted = premium ? interpretRpcResult(match.result) : null;
    matches.set(matchSlotKey(match.beach_id, match.forecast_at), interpreted);
  }
  const forecastsByBeach = new Map<string, EnhancedForecastEntity[]>();
  const beachById = new Map<string, Beach>(
    (data.beaches as Beach[]).map((beach): [string, Beach] => [beach.id, beach]),
  );
  for (const forecast of forecasts) {
    const beachRows = forecastsByBeach.get(forecast.beach_id) ?? [];
    beachRows.push(forecast);
    forecastsByBeach.set(forecast.beach_id, beachRows);
  }
  const rowDurationsMs: BulkDecisionContext["rowDurationsMs"] = new Map();
  for (const beachRows of forecastsByBeach.values()) {
    const sortedRows = beachRows
      .map((forecast) => {
        const beach = beachById.get(forecast.beach_id);
        const timezone = beach?.timezone || getTimezoneFromCoords(beach?.lat || 0, beach?.lon || 0);
        return { forecast, start: resolveForecastTime(forecast, timezone) };
      })
      .filter(({ start }) => Number.isFinite(start.getTime()))
      .sort((a, b) => a.start.getTime() - b.start.getTime());
    for (let index = 0; index < sortedRows.length; index++) {
      const current = sortedRows[index];
      const next = sortedRows[index + 1];
      const end = forecastRowIntervalEnd(current.start, next?.start);
      rowDurationsMs.set(
        `${current.forecast.beach_id}:${current.forecast.forecast_at}`,
        end.getTime() - current.start.getTime(),
      );
    }
  }
  return {
    beaches: data.beaches,
    boards: Array.isArray(data.personalization?.boards) ? data.personalization.boards : [],
    skillLevel: parseSkillLevel(data.profile?.experience_level),
    boardClasses: [
      ...new Set(
        (data.boards as Array<{ board_type: string }>)
          .map((board) => normalizeBoardClass(board.board_type))
          .filter((board): board is BoardClass => board !== null),
      ),
    ],
    sunTimes,
    matches,
    rowDurationsMs,
    waterQuality: waterQualitySnapshot(data.water_quality),
  };
}

export function bulkSessionDecision(
  context: BulkDecisionContext,
  beach: Beach,
  forecast: EnhancedForecastEntity,
  score: number,
  at: Date,
  options: { daylightOnly?: boolean } = {},
): ReturnType<typeof buildCanonicalSessionDecision> {
  const timezone = beach.timezone || getTimezoneFromCoords(beach.lat || 0, beach.lon || 0);
  const rowDuration = context.rowDurationsMs.get(
    `${beach.id}:${forecast.forecast_at}`,
  ) ?? 60 * 60_000;
  const end = new Date(at.getTime() + rowDuration).toISOString();
  // Future timeline hours are "when to go", so they need usable light; the
  // current hour (NOW) is never gated by the clock.
  const outsideLight = options.daylightOnly === true
    && !isDaylightInterval(at, new Date(end), timezone, context.sunTimes.get(beach.id));
  const decision = buildCanonicalSessionDecision({
    anchorTime: at.toISOString(),
    scope: {
      kind: "plan_next_session",
      windowStart: at.toISOString(),
      windowEnd: end,
      timezone,
    },
    profileExperience: context.skillLevel,
    recommendationAvailability: { state: "available", holdEpoch: "bulk" },
    candidates: outsideLight ? [] : [
          {
            candidateId: `bulk:${beach.id}:${at.toISOString()}`,
            beachId: beach.id,
            beachName: beach.name,
            beachSkillLevel: beach.skill_level,
            windowStart: at.toISOString(),
            windowEnd: end,
            timezone,
            forecastId: forecast.id || `${beach.id}:${forecast.forecast_at}`,
            forecastAt: forecast.forecast_at,
            waveHeight: forecast.wave_height,
            utilityScore: score,
            effects: [...(scoreWindowWithComposite(forecast, beach).effects ?? [])],
            recommendationLabel: resolveRecommendationLabel({
              beach,
              forecast,
              score,
            }).label,
            personalMatch: toPersonalMatchEvidence({
              similarity:
                context.matches.get(matchSlotKey(beach.id, forecast.forecast_at)) ?? null,
            }),
          },
        ],
  });
  return decision;
}

export function bulkRecommendationLabel(
  ...args: Parameters<typeof bulkSessionDecision>
): RecommendationLabel {
  return recommendationLabelForVerdict(bulkSessionDecision(...args).verdict);
}
