/**
 * GET /api/cron/weekly-streak-reminder
 *
 * Sunday reminder for users whose weekly session streak is at risk.
 * Auth: Authorization: Bearer <CRON_SECRET> or Vercel Cron header.
 */

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

export const revalidate = 0;
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const CONTEXT_TAG = "[weekly-streak-reminder]";
const REMINDER_TYPE = "weekly_streak";
const NOTIFICATION_TYPE = "weekly_streak_reminder";
const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;
const SENTRY_MONITOR = {
  slug: "weekly-streak-reminder",
  schedule: "0 17 * * 0",
  maxRuntimeMinutes: 5,
};

interface Candidate {
  userId: string;
  streak: number;
}

interface RunSummary {
  periodKey: string;
  candidates: number;
  sent: number;
  testAllowlistActive: boolean;
  skipped: {
    remindersDisabled: number;
    alreadyLogged: number;
    alreadyLoggedThisWeek: number;
    streakTooShort: number;
    notInTestAllowlist: number;
    sendFailed: number;
    logFailed: number;
  };
  errors: number;
  durationMs: number;
}

interface WeeklyStreakOutcome {
  summary: RunSummary;
  [key: string]: unknown;
}

async function recordWeeklyStreakOutcome(
  result: WeeklyStreakOutcome,
): Promise<WeeklyStreakOutcome> {
  return withCronOutcome(
    {
      job: "/api/cron/weekly-streak-reminder",
      unit: "reminders_sent",
      expectedMin: 1,
      getProduced: (value) => value.summary.sent,
      legitimatelyZero: (value) =>
        value.summary.candidates === 0
          ? { reason: "No users had an at-risk weekly streak this cycle" }
          : undefined,
    },
    async () => result,
  );
}

function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function keyToDate(key: string): Date {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function shiftDateKey(key: string, days: number): string {
  const date = keyToDate(key);
  date.setUTCDate(date.getUTCDate() + days);
  return dateKey(date);
}

function startOfUtcIsoWeek(date: Date): string {
  const utc = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );
  const isoDay = utc.getUTCDay() === 0 ? 7 : utc.getUTCDay();
  utc.setUTCDate(utc.getUTCDate() - isoDay + 1);
  return dateKey(utc);
}

function isoWeekKey(weekStartKey: string): string {
  const weekStart = keyToDate(weekStartKey);
  const thursday = new Date(weekStart);
  thursday.setUTCDate(thursday.getUTCDate() + 3);
  const isoYear = thursday.getUTCFullYear();
  const firstWeekStart = keyToDate(
    startOfUtcIsoWeek(new Date(Date.UTC(isoYear, 0, 4)))
  );
  const weekNumber =
    Math.floor((weekStart.getTime() - firstWeekStart.getTime()) / MS_PER_WEEK) + 1;
  return `${isoYear}-${String(weekNumber).padStart(2, "0")}`;
}

function consecutiveWeekStreakEnding(
  weeks: Set<string>,
  endingWeekStartKey: string
): number {
  let streak = 0;
  let cursor = endingWeekStartKey;
  while (weeks.has(cursor)) {
    streak++;
    cursor = shiftDateKey(cursor, -7);
  }
  return streak;
}

function parseTestUserAllowlist(): Set<string> {
  const raw = process.env.STREAK_REMINDER_TEST_USER_IDS ?? "";
  return new Set(
    raw
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean)
  );
}

async function _GET(request: Request): Promise<Response> {
  const startedAt = Date.now();

  try {
    if (!validateCronRequest(request)) {
      return createErrorResponse("Unauthorized", "Invalid cron authentication", 401);
    }

    const supabase = createSupabaseServiceRoleClient();
    const thisWeekStart = startOfUtcIsoWeek(new Date());
    const previousWeekStart = shiftDateKey(thisWeekStart, -7);
    const periodKey = isoWeekKey(thisWeekStart);
    const allowlist = parseTestUserAllowlist();
    const summary: RunSummary = {
      periodKey,
      candidates: 0,
      sent: 0,
      testAllowlistActive: allowlist.size > 0,
      skipped: {
        remindersDisabled: 0,
        alreadyLogged: 0,
        alreadyLoggedThisWeek: 0,
        streakTooShort: 0,
        notInTestAllowlist: 0,
        sendFailed: 0,
        logFailed: 0,
      },
      errors: 0,
      durationMs: 0,
    };

    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, notif_reminders");

    if (profilesError) {
      throw new Error(`Failed to query profiles: ${profilesError.message}`);
    }

    const reminderEnabledUserIds = new Set<string>();
    for (const profile of profiles ?? []) {
      if (!profile.id) continue;
      if (profile.notif_reminders === false) {
        summary.skipped.remindersDisabled++;
        continue;
      }
      reminderEnabledUserIds.add(profile.id);
    }

    if (reminderEnabledUserIds.size === 0) {
      summary.durationMs = Date.now() - startedAt;
      return createSuccessResponse(await recordWeeklyStreakOutcome({ candidates: 0, sent: 0, skipped: summary.skipped, summary }));
    }

    const { data: loggedRows, error: logError } = await (supabase as any).from("streak_reminder_log")
      .select("user_id")
      .eq("reminder_type", REMINDER_TYPE)
      .eq("period_key", periodKey);

    if (logError) {
      throw new Error(`Failed to query streak_reminder_log: ${logError.message}`);
    }

    const alreadyLogged = new Set<string>(
      ((loggedRows ?? []) as Array<{ user_id: string }>).map((row) => row.user_id),
    );

    const { data: sessionRows, error: sessionsError } = await supabase
      .from("sessions")
      .select("user_id, arrival_time, deleted_at");

    if (sessionsError) {
      throw new Error(`Failed to query sessions: ${sessionsError.message}`);
    }

    const weeksByUser = new Map<string, Set<string>>();
    for (const row of sessionRows ?? []) {
      if (!reminderEnabledUserIds.has(row.user_id)) continue;
      if (row.deleted_at !== null) continue;
      const weekStart = startOfUtcIsoWeek(new Date(row.arrival_time));
      const weeks = weeksByUser.get(row.user_id) ?? new Set<string>();
      weeks.add(weekStart);
      weeksByUser.set(row.user_id, weeks);
    }

    const candidates: Candidate[] = [];
    for (const userId of reminderEnabledUserIds) {
      if (alreadyLogged.has(userId)) {
        summary.skipped.alreadyLogged++;
        continue;
      }

      const sessionWeeks = weeksByUser.get(userId) ?? new Set<string>();
      if (sessionWeeks.has(thisWeekStart)) {
        summary.skipped.alreadyLoggedThisWeek++;
        continue;
      }

      const streak = consecutiveWeekStreakEnding(sessionWeeks, previousWeekStart);
      if (streak < 1) {
        summary.skipped.streakTooShort++;
        continue;
      }

      candidates.push({ userId, streak });
    }

    summary.candidates = candidates.length;
    const sendCandidates =
      allowlist.size === 0
        ? candidates
        : candidates.filter((candidate) => allowlist.has(candidate.userId));
    summary.skipped.notInTestAllowlist = candidates.length - sendCandidates.length;

    if (allowlist.size > 0) {
      console.log(
        `${CONTEXT_TAG} STREAK_REMINDER_TEST_USER_IDS active; filtered ${summary.skipped.notInTestAllowlist} candidate(s)`
      );
    }

    for (const candidate of sendCandidates) {
      try {
        const enqueueResult = await enqueueNotification({
          type: NOTIFICATION_TYPE,
          recipientUserId: candidate.userId,
          payload: {
            streak: candidate.streak,
            period_key: periodKey,
            ...buildNotificationRelevanceMetadata({
              category: "session_growth",
              triggerSource: "weekly_streak_reminder",
              relevanceConfidence: "medium",
              beachConfidence: "low",
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

        const { error: insertError } = await (supabase as any).from("streak_reminder_log")
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
      } catch (candidateError) {
        console.error(`${CONTEXT_TAG} Error processing ${candidate.userId}:`, candidateError);
        summary.skipped.sendFailed++;
        summary.errors++;
      }
    }

    summary.durationMs = Date.now() - startedAt;
    return createSuccessResponse(await recordWeeklyStreakOutcome({
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
  "/api/cron/weekly-streak-reminder",
  _GET,
  SENTRY_MONITOR
);
