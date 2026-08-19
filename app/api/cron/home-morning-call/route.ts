/**
 * GET /api/cron/home-morning-call
 *
 * Morning home-break surf call push. Disabled by default and allowlist-gated
 * for rollout. Auth: Authorization: Bearer <CRON_SECRET> or Vercel Cron header.
 */

import type { EnhancedForecastEntity } from "@/types/forecast";
import {
  runHomeBeachPushCron,
  type HomeBeachPushSelectArgs,
  type HomeBeachPushSelection,
} from "@/lib/cron/home-beach-push-runner";
import { withObservedCron } from "@/lib/cron/observability";
import { getLocalDateString, getLocalHour } from "@/lib/utils/timezone-utils";
import type { SurfCallVerdict } from "@/lib/utils/surf-call-logic";
import { parseSkillLevel } from "@/lib/domains/user-preferences/skill-level";
import {
  resolveNotificationMajorEventHold,
  type PositiveRecommendationPolicyContext,
} from "@/lib/recommendations/major-event-hold/adapters/notification";
import {
  resolveCanonicalSessionDecisionContext,
  type CanonicalSessionDecision,
} from "@/lib/recommendations/canonical-decision";
import { selectBeach } from "@/lib/recommendations/selection";
import type { SurfDiscoveryRecommendation } from "@/types/personalization";
import { buildHomeMorningCallPresentation } from "@/lib/notifications/home-morning-call-presentation";

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
  alert_date: string;
  verdict: SurfCallVerdict;
  beach_id: string;
  beach_name: string;
  forecast_at: string;
  title: string;
  body: string;
  session_decision: CanonicalSessionDecision;
  policy_context?: PositiveRecommendationPolicyContext;
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

function findCanonicalRecommendation(
  decision: CanonicalSessionDecision,
  recommendations: readonly SurfDiscoveryRecommendation[],
): SurfDiscoveryRecommendation | null {
  const selection = decision.selection;
  if (!selection || decision.verdict === "no") return null;
  const normalizedForecastAt = (value: unknown): string | null => {
    if (typeof value !== "string") return null;
    const parsed = new Date(value);
    return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null;
  };
  const selectedForecastAt = normalizedForecastAt(selection.forecastRef.forecastAt);
  if (!selectedForecastAt) return null;
  return recommendations.find((recommendation) => (
    recommendation.recommendationId === selection.candidateId
    && recommendation.beach.id === selection.beachId
    && recommendation.window.start.toISOString() === selection.windowStart
    && recommendation.window.end.toISOString() === selection.windowEnd
    && recommendation.forecast.id === selection.forecastRef.forecastId
    && normalizedForecastAt(recommendation.forecast.forecast_at) === selectedForecastAt
  )) ?? null;
}

export async function selectAndBuildMorningCall({
  profile,
  beach,
  forecasts,
  timezone,
  now,
}: HomeBeachPushSelectArgs): Promise<HomeBeachPushSelection<HomeMorningCallPayload>> {
  const morningForecasts = filterMorningForecasts(forecasts, timezone, now);
  if (morningForecasts.length === 0) {
    return { skipReason: "noForecast" };
  }
  const profileExperience = parseSkillLevel(
    (profile as HomeBeachPushSelectArgs["profile"] & {
      experience_level?: string | null;
    }).experience_level
  );
  const anchorTime = now.toISOString();
  const { decision, discovery } =
    await resolveCanonicalSessionDecisionContext({
      userId: profile.id,
      profileExperience,
      anchorTime,
      scope: {
        kind: "plan_next_session",
        windowStart: anchorTime,
        windowEnd: new Date(
          now.getTime() + 24 * 60 * 60 * 1000,
        ).toISOString(),
        timezone,
      },
      discoveryOptions: {
        userLocation:
          typeof beach.lat === "number"
          && typeof beach.lon === "number"
          && Number.isFinite(beach.lat)
          && Number.isFinite(beach.lon)
            ? { lat: beach.lat, lon: beach.lon }
            : undefined,
        horizonHours: 24,
        timeSlot: "dawn-patrol",
        discoveryMode: "best-window",
        includeBeachIds: [beach.id],
        isPro: false,
      },
    });
  const recommendation = findCanonicalRecommendation(
    decision,
    [
      ...discovery.recommendations,
      ...(discovery.includedRecommendations ?? []),
    ],
  );
  if (decision.verdict !== "no" && !recommendation) {
    return { skipReason: "canonicalDecision" };
  }
  const sourceForecast = recommendation?.forecast ?? morningForecasts[0];
  const selectedBeachCandidate = recommendation?.beach ?? beach;
  const selectedBeach = await selectBeach(selectedBeachCandidate, { asOf: now });
  if (!selectedBeach) {
    return { skipReason: "selection" };
  }
  const verdict: SurfCallVerdict = decision.verdict === "go"
    ? "YES"
    : decision.verdict === "maybe"
      ? "MAYBE"
      : "NO";
  const copy = buildHomeMorningCallPresentation(
    decision,
    selectedBeach.name,
    recommendation?.forecast ?? sourceForecast,
  );
  const localDate = getLocalDateString(now, timezone);
  const forecastAt = decision.selection?.forecastRef.forecastAt
    ?? sourceForecast.forecast_at;

  const payload: HomeMorningCallPayload = {
    alert_date: localDate,
    verdict,
    beach_id: selectedBeach.id,
    beach_name: selectedBeach.name,
    forecast_at: forecastAt,
    title: copy.title,
    body: copy.body,
    session_decision: decision,
  };
  const selection = {
    payload,
    dedupeKey: `${NOTIFICATION_TYPE}:${profile.id}:${localDate}`,
  };

  if (verdict === "NO") return selection;

  const bestStartsAt = decision.selection?.windowStart;
  const bestEndsAt = decision.selection?.windowEnd;
  const bestStartsAtMs = bestStartsAt ? Date.parse(bestStartsAt) : Number.NaN;
  const bestEndsAtMs = bestEndsAt ? Date.parse(bestEndsAt) : Number.NaN;
  if (
    !bestStartsAt ||
    !bestEndsAt ||
    !Number.isFinite(bestStartsAtMs) ||
    !Number.isFinite(bestEndsAtMs) ||
    bestEndsAtMs <= bestStartsAtMs
  ) {
    return { skipReason: "majorEventHold" };
  }
  payload.policy_context = {
    kind: "positive_session_recommendation",
    beach_id: selectedBeach.id,
    starts_at: bestStartsAt,
    ends_at: bestEndsAt,
  };
  const holdResolution = await resolveNotificationMajorEventHold({
    eventId: `home-morning-call:${profile.id}:${localDate}`,
    type: NOTIFICATION_TYPE,
    payload,
    profileExperience,
  });
  if (holdResolution.status === "suppressed") {
    return { skipReason: "majorEventHold" };
  }

  return selection;
}

async function _GET(request: Request): Promise<Response> {
  return runHomeBeachPushCron<HomeMorningCallPayload>(request, {
    contextTag: CONTEXT_TAG,
    enabledEnv: "HOME_MORNING_CALL_ENABLED",
    allowlistEnv: "HOME_MORNING_CALL_TEST_USER_IDS",
    type: NOTIFICATION_TYPE,
    lookaheadHours: LOOKAHEAD_HOURS,
    profileSelectExtraFields: ["experience_level"],
    selectAndBuild: selectAndBuildMorningCall,
    outcome: {
      job: "/api/cron/home-morning-call",
      unit: "calls_sent",
      expectedMin: 1,
      getProduced: (value) => value.sent,
      legitimatelyZero: (value) =>
        value.skipped || value.candidates === 0
          ? { reason: value.skipped ? "HOME_MORNING_CALL_ENABLED is not true" : "No home-beach users had an eligible morning call" }
          : undefined,
    },
  });
}

export const GET = withObservedCron(
  "/api/cron/home-morning-call",
  _GET,
  SENTRY_MONITOR
);
