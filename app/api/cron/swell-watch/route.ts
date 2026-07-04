/**
 * GET /api/cron/swell-watch
 *
 * Forward-looking home-break incoming-swell push. Disabled by default and
 * allowlist-gated for rollout. Auth: Authorization: Bearer <CRON_SECRET>.
 */

import {
  runHomeBeachPushCron,
  type HomeBeachPushSelectArgs,
  type HomeBeachPushSelection,
} from "@/lib/cron/home-beach-push-runner";
import { withObservedCron } from "@/lib/cron/observability";
import { detectSwellWatch } from "@/lib/alerts/swell-watch-detector";

export const revalidate = 0;
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const CONTEXT_TAG = "[swell-watch]";
const NOTIFICATION_TYPE = "swell_watch";
const LOOKAHEAD_HOURS = 10 * 24;
const SENTRY_MONITOR = {
  slug: "swell-watch",
  schedule: "0 15 * * *",
  maxRuntimeMinutes: 5,
};

interface SwellWatchPayload {
  beach_id: string;
  beach_slug?: string;
  beach_name: string;
  event_start_date: string;
  peak_date: string;
  peak_height_ft: number;
  peak_period_s: number;
  forecast_at: string;
  title: string;
  body: string;
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1);
}

function weekdayName(dateKey: string, timezone: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      weekday: "long",
    }).format(new Date(`${dateKey}T12:00:00.000Z`));
  } catch {
    return dateKey;
  }
}

export function buildSwellWatchCopy(input: {
  beachName: string;
  eventStartDate: string;
  peakDate: string;
  peakHeightFt: number;
  peakPeriodS: number;
  timezone: string;
}): { title: string; body: string } {
  const startDay = weekdayName(input.eventStartDate, input.timezone);
  const peakDay = weekdayName(input.peakDate, input.timezone);
  return {
    title: `Swell incoming — ${input.beachName}`,
    body: `${startDay}: building to ${formatNumber(input.peakHeightFt)} ft @ ${formatNumber(input.peakPeriodS)}s. Peak ${peakDay}.`,
  };
}

function selectAndBuildSwellWatch({
  profile,
  beach,
  forecasts,
  timezone,
  now,
}: HomeBeachPushSelectArgs): HomeBeachPushSelection<SwellWatchPayload> {
  const event = detectSwellWatch({ forecasts, timezone, now });
  if (!event) {
    return { skipReason: "no_event" };
  }

  const copy = buildSwellWatchCopy({
    beachName: beach.name,
    eventStartDate: event.eventStartDate,
    peakDate: event.peakDate,
    peakHeightFt: event.peakHeightFt,
    peakPeriodS: event.peakPeriodS,
    timezone,
  });

  return {
    payload: {
      beach_id: beach.id,
      ...(beach.slug ? { beach_slug: beach.slug } : {}),
      beach_name: beach.name,
      event_start_date: event.eventStartDate,
      peak_date: event.peakDate,
      peak_height_ft: event.peakHeightFt,
      peak_period_s: event.peakPeriodS,
      forecast_at: event.peakForecastAt,
      title: copy.title,
      body: copy.body,
    },
    dedupeKey: `${NOTIFICATION_TYPE}:${profile.id}:${beach.id}:${event.eventStartDate}`,
  };
}

async function _GET(request: Request): Promise<Response> {
  return runHomeBeachPushCron<SwellWatchPayload>(request, {
    contextTag: CONTEXT_TAG,
    enabledEnv: "SWELL_WATCH_ENABLED",
    allowlistEnv: "SWELL_WATCH_USER_ALLOWLIST",
    type: NOTIFICATION_TYPE,
    lookaheadHours: LOOKAHEAD_HOURS,
    selectAndBuild: selectAndBuildSwellWatch,
  });
}

export const GET = withObservedCron(
  "/api/cron/swell-watch",
  _GET,
  SENTRY_MONITOR
);
