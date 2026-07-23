/**
 * GET /api/cron/weekend-window
 *
 * Weekend home-break planning push. Disabled by default and allowlist-gated
 * for rollout. Auth: Authorization: Bearer <CRON_SECRET> or Vercel Cron header.
 */

import type { Beach } from "@/types/database";
import type { EnhancedForecastEntity } from "@/types/forecast";
import {
  runHomeBeachPushCron,
  type HomeBeachPushSelectArgs,
  type HomeBeachPushSelection,
} from "@/lib/cron/home-beach-push-runner";
import { withObservedCron } from "@/lib/cron/observability";
import { getLocalDateString, getLocalHour } from "@/lib/utils/timezone-utils";
import { scoreWindowWithComposite } from "@/lib/services/discovery/window-selector";
import { parseSkillLevel } from "@/lib/domains/user-preferences/skill-level";
import {
  resolveNotificationMajorEventHold,
  type PositiveRecommendationPolicyContext,
} from "@/lib/recommendations/major-event-hold/adapters/notification";
import {
  buildCanonicalSessionDecision,
  type CanonicalSessionDecision,
} from "@/lib/recommendations/canonical-decision";

export const revalidate = 0;
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const CONTEXT_TAG = "[weekend-window]";
const NOTIFICATION_TYPE = "weekend_window";
const LOOKAHEAD_HOURS = 10 * 24;
const DAYLIGHT_START_HOUR = 6;
const DAYLIGHT_END_HOUR = 19;
const SURFABILITY_FLOOR = 60;
const SENTRY_MONITOR = {
  slug: "weekend-window",
  schedule: "0 1 * * 5,6",
  maxRuntimeMinutes: 5,
};

interface WeekendWindowPayload {
  beach_id: string;
  forecast_at: string;
  window_local: string;
  title: string;
  body: string;
  policy_context: PositiveRecommendationPolicyContext;
  session_decision: CanonicalSessionDecision;
}

interface WeekendCopyInput {
  beachName: string;
  windowLocal: string;
  waveHeightFt: number | null;
  wavePeriodS: number | null;
  windDirection?: string | null;
  windSpeedMph?: number | null;
}

interface WeekendPick {
  forecast: EnhancedForecastEntity;
  score: number;
}

function localWeekday(date: Date, timezone: string): number {
  const day = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
  }).format(date);
  const weekdays: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return weekdays[day] ?? date.getUTCDay();
}

function addDaysToDateKey(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function getUpcomingWeekendKey(now: Date, timezone: string): string {
  const localDate = getLocalDateString(now, timezone);
  const weekday = localWeekday(now, timezone);
  const daysUntilSaturday = weekday === 6 ? 0 : (6 - weekday + 7) % 7;
  return addDaysToDateKey(localDate, daysUntilSaturday);
}

export function isWeekendDaylightForecast(
  forecastAt: string,
  timezone: string,
  weekendKey: string
): boolean {
  const forecastDate = new Date(forecastAt);
  const localDate = getLocalDateString(forecastDate, timezone);
  const sundayKey = addDaysToDateKey(weekendKey, 1);
  const hour = getLocalHour(forecastDate, timezone);

  return (
    (localDate === weekendKey || localDate === sundayKey) &&
    hour >= DAYLIGHT_START_HOUR &&
    hour < DAYLIGHT_END_HOUR
  );
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1);
}

function parseOptionalNumber(
  value: string | number | null | undefined
): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (!value) return null;
  const parsed = parseFloat(value.replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function fullDayName(windowLocal: string): string {
  const prefix = windowLocal.split(/\s+/)[0];
  const days: Record<string, string> = {
    Sat: "Saturday",
    Sun: "Sunday",
  };
  return days[prefix] ?? "Weekend";
}

export function buildWeekendWindowCopy(input: WeekendCopyInput): {
  title: string;
  body: string;
} {
  const wave =
    input.waveHeightFt != null && input.wavePeriodS != null
      ? `${formatNumber(input.waveHeightFt)}ft @ ${formatNumber(input.wavePeriodS)}s`
      : input.waveHeightFt != null
        ? `${formatNumber(input.waveHeightFt)}ft`
        : "Surfable window";
  const wind =
    input.windDirection && input.windSpeedMph != null
      ? ` · ${input.windDirection} wind ${formatNumber(input.windSpeedMph)}mph`
      : "";

  return {
    title: `${fullDayName(input.windowLocal)}'s looking fun at ${input.beachName}`,
    body: `${input.windowLocal}: ${wave}${wind}.`,
  };
}

function formatWindowLocal(forecastAt: string, timezone: string): string {
  try {
    const date = new Date(forecastAt);
    const day = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      weekday: "short",
    }).format(date);
    const hour = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "numeric",
      hour12: true,
    })
      .format(date)
      .toLowerCase()
      .replace(/\s+/g, "");
    return `${day} ${hour}`;
  } catch {
    return forecastAt;
  }
}

function pickBestWeekendWindow(
  forecasts: EnhancedForecastEntity[],
  beach: Beach,
  timezone: string,
  weekendKey: string
): WeekendPick | null {
  let best: WeekendPick | null = null;

  for (const forecast of forecasts) {
    if (!isWeekendDaylightForecast(forecast.forecast_at, timezone, weekendKey)) {
      continue;
    }

    const score = scoreWindowWithComposite(forecast, beach).total;
    if (score < SURFABILITY_FLOOR) {
      continue;
    }

    if (
      !best ||
      score > best.score ||
      (score === best.score &&
        forecast.forecast_at < best.forecast.forecast_at)
    ) {
      best = { forecast, score };
    }
  }

  return best;
}

export async function selectAndBuildWeekendWindow({
  profile,
  beach,
  forecasts,
  timezone,
  now,
}: HomeBeachPushSelectArgs): Promise<HomeBeachPushSelection<WeekendWindowPayload>> {
  const weekendKey = getUpcomingWeekendKey(now, timezone);
  const pick = pickBestWeekendWindow(forecasts, beach, timezone, weekendKey);
  if (!pick) {
    return { skipReason: "noSurfableWindow" };
  }

  const forecast = pick.forecast;
  const startsAtMs = Date.parse(forecast.forecast_at);
  if (!Number.isFinite(startsAtMs)) {
    return { skipReason: "majorEventHold" };
  }
  const endsAt = new Date(startsAtMs + 60 * 60 * 1000).toISOString();
  const windowLocal = formatWindowLocal(forecast.forecast_at, timezone);
  const copy = buildWeekendWindowCopy({
    beachName: beach.name,
    windowLocal,
    waveHeightFt: parseOptionalNumber(forecast.wave_height),
    wavePeriodS: parseOptionalNumber(forecast.wave_period),
    windDirection: forecast.wind_direction,
    windSpeedMph: parseOptionalNumber(forecast.wind_speed),
  });

  const payload: WeekendWindowPayload = {
    beach_id: beach.id,
    forecast_at: forecast.forecast_at,
    window_local: windowLocal,
    title: copy.title,
    body: copy.body,
    policy_context: {
      kind: "positive_session_recommendation",
      beach_id: beach.id,
      starts_at: forecast.forecast_at,
      ends_at: endsAt,
    },
    session_decision: buildCanonicalSessionDecision({
      anchorTime: now.toISOString(),
      scope: {
        kind: "plan_next_session",
        windowStart: now.toISOString(),
        windowEnd: endsAt,
        timezone,
      },
      profileExperience: (profile as HomeBeachPushSelectArgs["profile"] & {
        experience_level?: string | null;
      }).experience_level,
      recommendationAvailability: {
        state: "available",
        holdEpoch: `notification:weekend-window:${weekendKey}`,
        resolutionAsOf: now.toISOString(),
      },
      candidates: [
        {
          candidateId: `weekend-window:${beach.id}:${forecast.forecast_at}`,
          beachId: beach.id,
          beachName: beach.name,
          beachSkillLevel: beach.skill_level,
          windowStart: forecast.forecast_at,
          windowEnd: endsAt,
          timezone,
          forecastId:
            typeof forecast.id === "string" && forecast.id.length > 0
              ? forecast.id
              : `forecast:${beach.id}:${forecast.forecast_at}`,
          forecastAt: forecast.forecast_at,
          waveHeight:
            parseOptionalNumber(forecast.wave_height) == null
              ? null
              : `${parseOptionalNumber(forecast.wave_height)} ft`,
          utilityScore: pick.score,
        },
      ],
    }),
  };
  const profileExperience = parseSkillLevel(
    (profile as HomeBeachPushSelectArgs["profile"] & {
      experience_level?: string | null;
    }).experience_level
  );
  const holdResolution = await resolveNotificationMajorEventHold({
    eventId: `weekend-window:${profile.id}:${weekendKey}`,
    type: NOTIFICATION_TYPE,
    payload,
    profileExperience,
  });
  if (
    holdResolution.status !== "allowed" ||
    payload.session_decision.verdict === "no" ||
    payload.session_decision.selection?.beachId !== beach.id ||
    payload.session_decision.selection.windowStart !== forecast.forecast_at ||
    payload.session_decision.selection.windowEnd !== endsAt
  ) {
    return { skipReason: "majorEventHold" };
  }

  return {
    payload,
    dedupeKey: `${NOTIFICATION_TYPE}:${profile.id}:${weekendKey}`,
  };
}

async function _GET(request: Request): Promise<Response> {
  return runHomeBeachPushCron<WeekendWindowPayload>(request, {
    contextTag: CONTEXT_TAG,
    enabledEnv: "WEEKEND_WINDOW_ENABLED",
    allowlistEnv: "WEEKEND_WINDOW_TEST_USER_IDS",
    type: NOTIFICATION_TYPE,
    lookaheadHours: LOOKAHEAD_HOURS,
    profileSelectExtraFields: ["experience_level"],
    selectAndBuild: selectAndBuildWeekendWindow,
  });
}

export const GET = withObservedCron(
  "/api/cron/weekend-window",
  _GET,
  SENTRY_MONITOR
);
