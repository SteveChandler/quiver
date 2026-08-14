/**
 * GET /api/cron/daily-call-streak-reminder
 *
 * Forecast feedback nudge for users whose home/saved-beach worth-it window
 * passed today and who have not left feedback or logged a session for it.
 * Auth: Authorization: Bearer <CRON_SECRET> or Vercel Cron header.
 */

import type { Beach } from "@/types/database";
import type { EnhancedForecastEntity } from "@/types/forecast";
import { enqueueNotification } from "@/lib/notifications/enqueue";
import { buildNotificationRelevanceMetadata } from "@/lib/notifications/relevance";
import {
  createErrorResponse,
  createSuccessResponse,
  handleApiError,
  validateCronRequest,
} from "@/lib/middleware/api-wrappers";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { withObservedCron } from "@/lib/cron/observability";
import { withCronOutcome } from "@/lib/cron/outcome";
import {
  FORECAST_WINDOW_DURATION_MINUTES,
  scoreWindowWithComposite,
} from "@/lib/services/discovery/window-selector";
import {
  getLocalDateString,
  resolveBeachTimezone,
} from "@/lib/utils/timezone-utils";
import { rankBeaches } from "@/lib/recommendations/selection";

export const revalidate = 0;
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const CONTEXT_TAG = "[forecast-feedback-nudge]";
const REMINDER_TYPE = "forecast_feedback_nudge";
const NOTIFICATION_TYPE = "forecast_feedback_nudge";
const SURFABILITY_FLOOR = 60;
const FORECAST_LOOKBACK_HOURS = 36;
const SENTRY_MONITOR = {
  slug: "forecast-feedback-nudge",
  schedule: "0 2 * * *",
  maxRuntimeMinutes: 5,
};

interface ProfileRow {
  id: string;
  home_beach_id: string | null;
  notif_reminders: boolean | null;
}

interface FavoriteBeachRow {
  user_id: string;
  beach_id: string | null;
  rank: number | null;
}

interface BeachTarget {
  userId: string;
  beachId: string;
  source: "home" | "favorite";
  rank: number;
}

interface FeedbackRow {
  user_id: string | null;
  beach_id: string;
  forecast_at: string;
  window_start: string | null;
  window_end: string | null;
}

interface SessionRow {
  user_id: string;
  beach_id: string;
  arrival_time: string;
}

interface Candidate {
  userId: string;
  beachId: string;
  beachSlug?: string;
  beachName: string;
  forecastAt: string;
  windowStart: string;
  windowEnd: string;
  score: number;
  confidenceScore: number | null;
}

interface RunSummary {
  periodKey: string;
  candidates: number;
  sent: number;
  testAllowlistActive: boolean;
  skipped: {
    remindersDisabled: number;
    alreadyLogged: number;
    noBeach: number;
    noForecast: number;
    noPassedWorthItWindow: number;
    alreadyFeedback: number;
    alreadySessionLogged: number;
    notInTestAllowlist: number;
    sendFailed: number;
    logFailed: number;
  };
  errors: number;
  durationMs: number;
}

interface DailyNudgeOutcome {
  summary: RunSummary;
  enabled?: boolean;
  [key: string]: unknown;
}

async function recordDailyNudgeOutcome(
  result: DailyNudgeOutcome,
): Promise<DailyNudgeOutcome> {
  return withCronOutcome(
    {
      job: "/api/cron/daily-call-streak-reminder",
      unit: "reminders_sent",
      expectedMin: 1,
      getProduced: (value) => value.summary.sent,
      legitimatelyZero: (value) =>
        value.enabled === false
          ? { reason: "FORECAST_FEEDBACK_NUDGE_ENABLED is not true" }
          : value.summary.candidates === 0
            ? { reason: "No users had an eligible passed forecast window for a reminder" }
            : undefined,
    },
    async () => result,
  );
}

function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function windowEndIso(forecastAt: string): string {
  return new Date(
    new Date(forecastAt).getTime() + FORECAST_WINDOW_DURATION_MINUTES * 60_000
  ).toISOString();
}

function parseTestUserAllowlist(): Set<string> {
  const raw = [
    process.env.FORECAST_FEEDBACK_NUDGE_TEST_USER_IDS,
    process.env.STREAK_REMINDER_TEST_USER_IDS,
  ]
    .filter(Boolean)
    .join(",");

  return new Set(
    raw
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean)
  );
}

function isForecastFeedbackNudgeEnabled(): boolean {
  return process.env.FORECAST_FEEDBACK_NUDGE_ENABLED?.toLowerCase() === "true";
}

function targetKey(userId: string, beachId: string): string {
  return `${userId}:${beachId}`;
}

function addTarget(targets: Map<string, BeachTarget>, target: BeachTarget): void {
  const key = targetKey(target.userId, target.beachId);
  const existing = targets.get(key);
  if (!existing || target.source === "home" || target.rank < existing.rank) {
    targets.set(key, target);
  }
}

function isPassedLocalToday(
  forecastAt: string,
  timezone: string,
  now: Date
): boolean {
  const start = new Date(forecastAt);
  if (Number.isNaN(start.getTime())) return false;

  const end = new Date(
    start.getTime() + FORECAST_WINDOW_DURATION_MINUTES * 60_000
  );
  if (end > now) return false;

  return getLocalDateString(start, timezone) === getLocalDateString(now, timezone);
}

function isBetterCandidate(next: Candidate, current: Candidate | null): boolean {
  if (!current) return true;
  if (next.score !== current.score) return next.score > current.score;
  return next.forecastAt > current.forecastAt;
}

function rangesOverlap(
  aStartIso: string,
  aEndIso: string,
  bStartIso: string,
  bEndIso: string
): boolean {
  const aStart = Date.parse(aStartIso);
  const aEnd = Date.parse(aEndIso);
  const bStart = Date.parse(bStartIso);
  const bEnd = Date.parse(bEndIso);
  if ([aStart, aEnd, bStart, bEnd].some((value) => Number.isNaN(value))) {
    return false;
  }
  return aStart < bEnd && bStart < aEnd;
}

function hasFeedbackForCandidate(
  candidate: Candidate,
  feedbackRows: FeedbackRow[]
): boolean {
  return feedbackRows.some((row) => {
    if (row.user_id !== candidate.userId || row.beach_id !== candidate.beachId) {
      return false;
    }

    if (Date.parse(row.forecast_at) === Date.parse(candidate.forecastAt)) {
      return true;
    }

    if (!row.window_start || !row.window_end) return false;
    return rangesOverlap(
      row.window_start,
      row.window_end,
      candidate.windowStart,
      candidate.windowEnd
    );
  });
}

function hasSessionForCandidate(
  candidate: Candidate,
  sessionRows: SessionRow[]
): boolean {
  const start = Date.parse(candidate.windowStart);
  const end = Date.parse(candidate.windowEnd);

  return sessionRows.some((row) => {
    if (row.user_id !== candidate.userId || row.beach_id !== candidate.beachId) {
      return false;
    }

    const arrival = Date.parse(row.arrival_time);
    return !Number.isNaN(arrival) && arrival >= start && arrival <= end;
  });
}

function buildLogSessionDeeplink(candidate: Candidate): string {
  const beachRef = candidate.beachSlug ?? candidate.beachId;
  const params = new URLSearchParams({
    beach: beachRef,
    at: candidate.windowStart,
    utm_source: "push_log_nudge",
  });

  return `quiver://sessions/new?${params.toString()}`;
}

async function _GET(request: Request): Promise<Response> {
  const startedAt = Date.now();

  try {
    if (!validateCronRequest(request)) {
      return createErrorResponse("Unauthorized", "Invalid cron authentication", 401);
    }

    const now = new Date();
    const periodKey = dateKey(now);
    const allowlist = parseTestUserAllowlist();
    const summary: RunSummary = {
      periodKey,
      candidates: 0,
      sent: 0,
      testAllowlistActive: allowlist.size > 0,
      skipped: {
        remindersDisabled: 0,
        alreadyLogged: 0,
        noBeach: 0,
        noForecast: 0,
        noPassedWorthItWindow: 0,
        alreadyFeedback: 0,
        alreadySessionLogged: 0,
        notInTestAllowlist: 0,
        sendFailed: 0,
        logFailed: 0,
      },
      errors: 0,
      durationMs: 0,
    };

    if (!isForecastFeedbackNudgeEnabled()) {
      summary.durationMs = Date.now() - startedAt;
      return createSuccessResponse(await recordDailyNudgeOutcome({
        enabled: false,
        candidates: 0,
        sent: 0,
        skipped: summary.skipped,
        summary,
      }));
    }

    const supabase = createSupabaseServiceRoleClient();
    const forecastLookupStart = new Date(
      now.getTime() - FORECAST_LOOKBACK_HOURS * 60 * 60 * 1000
    ).toISOString();

    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, home_beach_id, notif_reminders");

    if (profilesError) {
      throw new Error(`Failed to query profiles: ${profilesError.message}`);
    }

    const reminderEnabledUserIds = new Set<string>();
    const profileRows = (profiles ?? []) as ProfileRow[];
    for (const profile of profileRows) {
      if (!profile.id) continue;
      if (profile.notif_reminders === false) {
        summary.skipped.remindersDisabled++;
        continue;
      }
      reminderEnabledUserIds.add(profile.id);
    }

    if (reminderEnabledUserIds.size === 0) {
      summary.durationMs = Date.now() - startedAt;
      return createSuccessResponse(await recordDailyNudgeOutcome({ candidates: 0, sent: 0, skipped: summary.skipped, summary }));
    }

    const { data: loggedRows, error: logError } = await (supabase as any)
      .from("streak_reminder_log")
      .select("user_id")
      .eq("reminder_type", REMINDER_TYPE)
      .eq("period_key", periodKey);

    if (logError) {
      throw new Error(`Failed to query streak_reminder_log: ${logError.message}`);
    }

    const alreadyLogged = new Set<string>(
      ((loggedRows ?? []) as Array<{ user_id: string }>).map((row) => row.user_id)
    );

    const activeUserIds = Array.from(reminderEnabledUserIds).filter((userId) => {
      if (!alreadyLogged.has(userId)) return true;
      summary.skipped.alreadyLogged++;
      return false;
    });

    if (activeUserIds.length === 0) {
      summary.durationMs = Date.now() - startedAt;
      return createSuccessResponse(await recordDailyNudgeOutcome({ candidates: 0, sent: 0, skipped: summary.skipped, summary }));
    }

    const { data: favorites, error: favoritesError } = await supabase
      .from("favorite_beaches")
      .select("user_id, beach_id, rank")
      .in("user_id", activeUserIds);

    if (favoritesError) {
      throw new Error(`Failed to query favorite_beaches: ${favoritesError.message}`);
    }

    const targets = new Map<string, BeachTarget>();
    for (const profile of profileRows) {
      if (!activeUserIds.includes(profile.id) || !profile.home_beach_id) continue;
      addTarget(targets, {
        userId: profile.id,
        beachId: profile.home_beach_id,
        source: "home",
        rank: 0,
      });
    }

    for (const favorite of (favorites ?? []) as FavoriteBeachRow[]) {
      if (!favorite.beach_id) continue;
      addTarget(targets, {
        userId: favorite.user_id,
        beachId: favorite.beach_id,
        source: "favorite",
        rank: favorite.rank ?? 999,
      });
    }

    if (targets.size === 0) {
      summary.durationMs = Date.now() - startedAt;
      return createSuccessResponse(await recordDailyNudgeOutcome({ candidates: 0, sent: 0, skipped: summary.skipped, summary }));
    }

    const beachIds = Array.from(
      new Set(Array.from(targets.values()).map((target) => target.beachId))
    );
    const { data: beaches, error: beachesError } = await supabase
      .from("beaches")
      .select("*")
      .in("id", beachIds)
      .is("deleted_at", null);

    if (beachesError) {
      throw new Error(`Failed to query beaches: ${beachesError.message}`);
    }

    const beachesById = new Map<string, Beach>();
    for (const beach of (beaches ?? []) as Beach[]) {
      beachesById.set(beach.id, beach);
    }

    const { data: forecasts, error: forecastsError } = await supabase
      .from("enhanced_forecasts")
      .select("*")
      .in("beach_id", beachIds)
      .gte("forecast_at", forecastLookupStart)
      .lt("forecast_at", now.toISOString())
      .order("forecast_at", { ascending: true });

    if (forecastsError) {
      throw new Error(`Failed to query enhanced_forecasts: ${forecastsError.message}`);
    }

    const forecastsByBeachId = new Map<string, EnhancedForecastEntity[]>();
    for (const forecast of (forecasts ?? []) as EnhancedForecastEntity[]) {
      const rows = forecastsByBeachId.get(forecast.beach_id) ?? [];
      rows.push(forecast);
      forecastsByBeachId.set(forecast.beach_id, rows);
    }

    const rawCandidates: Candidate[] = [];
    for (const target of targets.values()) {
      const beach = beachesById.get(target.beachId);
      if (!beach) {
        summary.skipped.noBeach++;
        continue;
      }

      const beachForecasts = forecastsByBeachId.get(target.beachId) ?? [];
      if (beachForecasts.length === 0) {
        summary.skipped.noForecast++;
        continue;
      }

      const timezone = resolveBeachTimezone(beach.timezone);
      let best: Candidate | null = null;
      for (const forecast of beachForecasts) {
        if (!isPassedLocalToday(forecast.forecast_at, timezone, now)) continue;

        let score: number;
        try {
          score = scoreWindowWithComposite(forecast, beach).total;
        } catch (scoreError) {
          console.warn(
            `${CONTEXT_TAG} scoreWindowWithComposite failed beach=${beach.id} forecast_at=${forecast.forecast_at}:`,
            scoreError
          );
          continue;
        }

        if (score < SURFABILITY_FLOOR) continue;

        const candidate: Candidate = {
          userId: target.userId,
          beachId: beach.id,
          beachSlug: beach.slug ?? undefined,
          beachName: beach.name,
          forecastAt: forecast.forecast_at,
          windowStart: forecast.forecast_at,
          windowEnd: windowEndIso(forecast.forecast_at),
          score,
          confidenceScore:
            typeof forecast.confidence_score === "number"
              ? forecast.confidence_score
              : null,
        };

        if (isBetterCandidate(candidate, best)) {
          best = candidate;
        }
      }

      if (!best) {
        summary.skipped.noPassedWorthItWindow++;
        continue;
      }

      rawCandidates.push(best);
    }

    if (rawCandidates.length === 0) {
      summary.durationMs = Date.now() - startedAt;
      return createSuccessResponse(await recordDailyNudgeOutcome({ candidates: 0, sent: 0, skipped: summary.skipped, summary }));
    }

    const candidateUserIds = Array.from(
      new Set(rawCandidates.map((candidate) => candidate.userId))
    );
    const candidateBeachIds = Array.from(
      new Set(rawCandidates.map((candidate) => candidate.beachId))
    );
    const { data: feedbackRows, error: feedbackError } = await supabase
      .from("forecast_feedback_contexts")
      .select("user_id, beach_id, forecast_at, window_start, window_end")
      .in("user_id", candidateUserIds)
      .in("beach_id", candidateBeachIds)
      .gte("forecast_at", forecastLookupStart)
      .lt("forecast_at", now.toISOString());

    if (feedbackError) {
      throw new Error(
        `Failed to query forecast_feedback_contexts: ${feedbackError.message}`
      );
    }

    const { data: sessionRows, error: sessionsError } = await supabase
      .from("sessions")
      .select("user_id, beach_id, arrival_time")
      .in("user_id", candidateUserIds)
      .in("beach_id", candidateBeachIds)
      .gte("arrival_time", forecastLookupStart)
      .lt("arrival_time", now.toISOString())
      .is("deleted_at", null);

    if (sessionsError) {
      throw new Error(`Failed to query sessions: ${sessionsError.message}`);
    }

    const safeRawCandidates = await rankBeaches(
      rawCandidates.map((candidate, index) => ({
        id: candidate.beachId,
        candidate,
        index,
      })),
      {
        compare: (left, right) => {
          if (left.candidate.userId !== right.candidate.userId) {
            return left.index - right.index;
          }
          return isBetterCandidate(left.candidate, right.candidate) ? -1 : 1;
        },
      },
    );

    const candidatesByUser = new Map<string, Candidate>();
    for (const { candidate } of safeRawCandidates) {
      if (
        hasFeedbackForCandidate(
          candidate,
          (feedbackRows ?? []) as FeedbackRow[]
        )
      ) {
        summary.skipped.alreadyFeedback++;
        continue;
      }

      if (
        hasSessionForCandidate(candidate, (sessionRows ?? []) as SessionRow[])
      ) {
        summary.skipped.alreadySessionLogged++;
        continue;
      }

      const current = candidatesByUser.get(candidate.userId) ?? null;
      if (isBetterCandidate(candidate, current)) {
        candidatesByUser.set(candidate.userId, candidate);
      }
    }

    const candidates = Array.from(candidatesByUser.values());
    summary.candidates = candidates.length;
    const sendCandidates =
      allowlist.size === 0
        ? candidates
        : candidates.filter((candidate) => allowlist.has(candidate.userId));
    summary.skipped.notInTestAllowlist = candidates.length - sendCandidates.length;

    if (allowlist.size > 0) {
      console.log(
        `${CONTEXT_TAG} FORECAST_FEEDBACK_NUDGE_TEST_USER_IDS active; filtered ${summary.skipped.notInTestAllowlist} candidate(s)`
      );
    }

    for (const candidate of sendCandidates) {
      try {
        const enqueueResult = await enqueueNotification({
          type: NOTIFICATION_TYPE,
          recipientUserId: candidate.userId,
          entityType: "beach",
          entityId: candidate.beachId,
          payload: {
            beach_id: candidate.beachId,
            ...(candidate.beachSlug ? { beach_slug: candidate.beachSlug } : {}),
            beach_name: candidate.beachName,
            forecast_at: candidate.forecastAt,
            deeplink: buildLogSessionDeeplink(candidate),
            ...buildNotificationRelevanceMetadata({
              category: "session_growth",
              triggerSource: "forecast_feedback_nudge",
              relevanceConfidence: "low",
              beachConfidence: "low",
              beachConfidenceScore: candidate.confidenceScore,
              relevanceScore: candidate.score,
            }),
          },
          dedupeKey: `${REMINDER_TYPE}:${candidate.userId}:${periodKey}`,
        });

        if (!enqueueResult.enqueued && enqueueResult.reason !== "duplicate") {
          console.error(
            `${CONTEXT_TAG} Enqueue failed for ${candidate.userId}:`,
            enqueueResult
          );
          summary.skipped.sendFailed++;
          summary.errors++;
          continue;
        }

        const { error: insertError } = await (supabase as any)
          .from("streak_reminder_log")
          .insert({
            user_id: candidate.userId,
            reminder_type: REMINDER_TYPE,
            period_key: periodKey,
          });

        if (insertError) {
          console.error(
            `${CONTEXT_TAG} log insert failed for ${candidate.userId}:`,
            insertError
          );
          summary.skipped.logFailed++;
        }

        summary.sent++;
        console.log(
          `${CONTEXT_TAG} Enqueued feedback nudge for ${candidate.userId} at ${candidate.beachName}`
        );
      } catch (candidateError) {
        console.error(`${CONTEXT_TAG} Error processing ${candidate.userId}:`, candidateError);
        summary.skipped.sendFailed++;
        summary.errors++;
      }
    }

    summary.durationMs = Date.now() - startedAt;
    return createSuccessResponse(await recordDailyNudgeOutcome({
      candidates: sendCandidates.length,
      sent: summary.sent,
      skipped: summary.skipped,
      summary,
    }));
  } catch (error) {
    return handleApiError(error);
  }
}

export const GET = withObservedCron(
  "/api/cron/daily-call-streak-reminder",
  _GET,
  SENTRY_MONITOR
);
