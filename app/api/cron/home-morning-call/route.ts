/**
 * GET /api/cron/home-morning-call
 *
 * Morning home-break surf call push. Disabled by default and allowlist-gated
 * for rollout. Auth: Authorization: Bearer <CRON_SECRET>.
 */

import type { EnhancedForecastEntity } from "@/types/forecast";
import {
  runHomeBeachPushCron,
  type HomeBeachPushSelectArgs,
  type HomeBeachPushSelection,
} from "@/lib/cron/home-beach-push-runner";
import { withObservedCron } from "@/lib/cron/observability";
import { getLocalDateString, getLocalHour } from "@/lib/utils/timezone-utils";
import { resolveTodayHeadline } from "@/lib/services/forecast/today-headline";
import {
  computeSurfCall,
  type SurfCallVerdict,
} from "@/lib/utils/surf-call-logic";

export const revalidate = 0;
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const CONTEXT_TAG = "[home-morning-call]";
const NOTIFICATION_TYPE = "home_morning_call";
const MORNING_START_HOUR = 5;
const MORNING_END_HOUR = 12;
const LOOKAHEAD_HOURS = 30;
const SENTRY_MONITOR = {
  slug: "home-morning-call",
  schedule: "0 13 * * *",
  maxRuntimeMinutes: 5,
};

interface HomeMorningCallPayload {
  verdict: SurfCallVerdict;
  beach_id: string;
  beach_name: string;
  forecast_at: string;
  title: string;
  body: string;
}

interface MorningCopyInput {
  verdict: SurfCallVerdict;
  beachName: string;
  waveHeight: string | null;
  wavePeriod: string | null;
  windDescription: string | null;
  whySentence: string | null;
}

function sentence(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

function conditionLine(
  waveHeight: string | null,
  wavePeriod: string | null
): string | null {
  if (!waveHeight) return null;
  if (!wavePeriod) return waveHeight;
  return `${waveHeight} @ ${wavePeriod}`;
}

export function buildMorningCallCopy(input: MorningCopyInput): {
  title: string;
  body: string;
} {
  const condition = sentence(conditionLine(input.waveHeight, input.wavePeriod));
  const why = sentence(input.whySentence ?? input.windDescription);

  if (input.verdict === "YES") {
    return {
      title: `${input.beachName}: It's firing`,
      body:
        [condition, why].filter(Boolean).join(" ") ||
        "Conditions look worth it today.",
    };
  }

  if (input.verdict === "MAYBE") {
    return {
      title: `${input.beachName}: Worth a look`,
      body:
        [condition, why].filter(Boolean).join(" ") ||
        "There may be a window today.",
    };
  }

  return {
    title: `${input.beachName}: Rest up today`,
    body: `${why ?? "Flat or blown out today."} Check the week before you drive.`,
  };
}

function normalizePeriod(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return /\bs\b/i.test(trimmed) ? trimmed : `${trimmed}s`;
}

function filterMorningForecasts(
  forecasts: EnhancedForecastEntity[],
  timezone: string,
  now: Date
): EnhancedForecastEntity[] {
  const today = getLocalDateString(now, timezone);
  return forecasts.filter((forecast) => {
    if (!forecast.forecast_at) return false;
    const forecastDate = new Date(forecast.forecast_at);
    const hour = getLocalHour(forecastDate, timezone);
    return (
      getLocalDateString(forecastDate, timezone) === today &&
      hour >= MORNING_START_HOUR &&
      hour < MORNING_END_HOUR
    );
  });
}

function selectAndBuildMorningCall({
  profile,
  beach,
  forecasts,
  timezone,
  now,
}: HomeBeachPushSelectArgs): HomeBeachPushSelection<HomeMorningCallPayload> {
  const morningForecasts = filterMorningForecasts(forecasts, timezone, now);
  if (morningForecasts.length === 0) {
    return { skipReason: "noForecast" };
  }

  const headline = resolveTodayHeadline({
    forecasts: morningForecasts,
    beach,
    userPrefs: null,
    horizonHours: 12,
    now,
  });
  const window = headline?.window ?? null;
  const call = computeSurfCall(window, morningForecasts, beach, {
    isTomorrow: false,
  });
  const sourceForecast =
    morningForecasts.find(
      (forecast) => forecast.forecast_at === call.bestWindowStart
    ) ??
    morningForecasts.find(
      (forecast) => forecast.forecast_at === headline?.display.forecastAt
    ) ??
    morningForecasts[0];
  const copy = buildMorningCallCopy({
    verdict: call.verdict,
    beachName: beach.name,
    waveHeight: call.waveHeight ?? sourceForecast.wave_height ?? null,
    wavePeriod: normalizePeriod(sourceForecast.wave_period),
    windDescription: call.windDescription,
    whySentence: call.whySentence,
  });
  const localDate = getLocalDateString(now, timezone);
  const forecastAt =
    call.bestWindowStart ??
    headline?.display.forecastAt ??
    sourceForecast.forecast_at;

  return {
    payload: {
      verdict: call.verdict,
      beach_id: beach.id,
      beach_name: beach.name,
      forecast_at: forecastAt,
      title: copy.title,
      body: copy.body,
    },
    dedupeKey: `${NOTIFICATION_TYPE}:${profile.id}:${localDate}`,
  };
}

async function _GET(request: Request): Promise<Response> {
  return runHomeBeachPushCron<HomeMorningCallPayload>(request, {
    contextTag: CONTEXT_TAG,
    enabledEnv: "HOME_MORNING_CALL_ENABLED",
    allowlistEnv: "HOME_MORNING_CALL_TEST_USER_IDS",
    type: NOTIFICATION_TYPE,
    lookaheadHours: LOOKAHEAD_HOURS,
    selectAndBuild: selectAndBuildMorningCall,
  });
}

export const GET = withObservedCron(
  "/api/cron/home-morning-call",
  _GET,
  SENTRY_MONITOR
);
