/**
 * GET /api/cron/swell-watch
 *
 * Forward-looking major-swell shadow evaluation. It never enqueues or sends.
 * Disabled by default and allowlist-gated. Auth: Authorization: Bearer ***
 */

import {
  runHomeBeachPushCron,
  type HomeBeachPushSelectArgs,
  type HomeBeachPushSelection,
} from "@/lib/cron/home-beach-push-runner";
import { withObservedCron } from "@/lib/cron/observability";
import { evaluateMajorSwellAwarenessShadow } from "@/lib/recommendations/major-swell-awareness/shadow-evaluator";
import {
  loadNwsSwellAdvisories,
  loadOfficialSwellAdvisories,
} from "@/lib/recommendations/major-swell-awareness/official-advisory-adapter";

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
  event_start_date: string | null;
  peak_date: string | null;
  peak_height_ft: number | null;
  peak_period_s: number | null;
  forecast_at: string | null;
  awareness_mode: "shadow";
  automation_enabled: false;
  awareness_signal:
    | "forecast_trend"
    | "official_advisory"
    | "corroborated";
  awareness_severity: "significant" | "major";
  official_evidence_refs: string[];
  would_suppress_cohorts: Array<"beginner" | "intermediate" | "unknown">;
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

async function selectAndBuildSwellWatch({
  supabase,
  profile,
  beach,
  forecasts,
  timezone,
  now,
}: HomeBeachPushSelectArgs): Promise<HomeBeachPushSelection<SwellWatchPayload>> {
  const ledgerAdvisories = supabase
    ? await loadOfficialSwellAdvisories({
        supabase,
        beachId: beach.id,
        timezone,
        now,
      })
    : [];
  let nwsAdvisories: Awaited<ReturnType<typeof loadNwsSwellAdvisories>> = [];
  try {
    nwsAdvisories = await loadNwsSwellAdvisories({
      zone: beach.nws_forecast_zone,
      beachId: beach.id,
      now,
    });
  } catch (error) {
    console.warn(`${CONTEXT_TAG} NWS advisory fetch failed for ${beach.id}:`, error);
  }
  const awareness = evaluateMajorSwellAwarenessShadow({
    beachId: beach.id,
    forecasts,
    timezone,
    now,
    officialAdvisories: [...ledgerAdvisories, ...nwsAdvisories],
  });
  const event = awareness.event;
  if (awareness.signal === "none") {
    return { skipReason: "no_event" };
  }

  const copy = event
    ? buildSwellWatchCopy({
        beachName: beach.name,
        eventStartDate: event.eventStartDate,
        peakDate: event.peakDate,
        peakHeightFt: event.peakHeightFt,
        peakPeriodS: event.peakPeriodS,
        timezone,
      })
    : {
        title: `Official surf hazard signal — ${beach.name}`,
        body: "An official coastal advisory is active in the forecast window.",
      };

  return {
    payload: {
      beach_id: beach.id,
      ...(beach.slug ? { beach_slug: beach.slug } : {}),
      beach_name: beach.name,
      event_start_date: event?.eventStartDate ?? null,
      peak_date: event?.peakDate ?? null,
      peak_height_ft: event?.peakHeightFt ?? null,
      peak_period_s: event?.peakPeriodS ?? null,
      forecast_at: event?.peakForecastAt ?? null,
      awareness_mode: "shadow",
      automation_enabled: false,
      awareness_signal: awareness.signal,
      awareness_severity: awareness.severity ?? "significant",
      official_evidence_refs: awareness.officialEvidenceRefs,
      would_suppress_cohorts: awareness.wouldSuppressCohorts,
      title: copy.title,
      body: copy.body,
    },
    dedupeKey:
      `${NOTIFICATION_TYPE}:${profile.id}:${beach.id}:`
      + `${event?.eventStartDate ?? awareness.officialEvidenceRefs.join(",")}`,
  };
}

async function _GET(request: Request): Promise<Response> {
  return runHomeBeachPushCron<SwellWatchPayload>(request, {
    contextTag: CONTEXT_TAG,
    enabledEnv: "SWELL_WATCH_ENABLED",
    allowlistEnv: "SWELL_WATCH_USER_ALLOWLIST",
    type: NOTIFICATION_TYPE,
    deliveryMode: "shadow",
    lookaheadHours: LOOKAHEAD_HOURS,
    createAdditionalSummary: () => ({
      automationEnabled: false,
      shadowEvaluations: [],
    }),
    selectAndBuild: selectAndBuildSwellWatch,
    afterShadowSelection: async ({ selection, summary }) => {
      const evaluations = Array.isArray(summary.shadowEvaluations)
        ? summary.shadowEvaluations
        : [];
      if (evaluations.length < 100) evaluations.push(selection.payload);
      summary.shadowEvaluations = evaluations;
    },
  });
}

export const GET = withObservedCron(
  "/api/cron/swell-watch",
  _GET,
  SENTRY_MONITOR
);
