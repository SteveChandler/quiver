/**
 * GET /api/cron/daily-call-streak-reminder
 *
 * Evening reminder for users whose daily "make your call" streak is at risk.
 * Auth: Authorization: Bearer <CRON_SECRET> or Vercel Cron header.
 */

import { enqueueNotification } from "@/lib/notifications/enqueue";
import {
  createErrorResponse,
  createSuccessResponse,
  handleApiError,
  validateCronRequest,
} from "@/lib/middleware/api-wrappers";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { withObservedCron } from "@/lib/cron/observability";

export const revalidate = 0;
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const CONTEXT_TAG = "[daily-call-streak-reminder]";
const REMINDER_TYPE = "daily_call_streak";
const NOTIFICATION_TYPE = "daily_call_streak_reminder";
const SENTRY_MONITOR = {
  slug: "daily-call-streak-reminder",
  schedule: "0 2 * * *",
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
    alreadyActedToday: number;
    streakTooShort: number;
    notInTestAllowlist: number;
    sendFailed: number;
    logFailed: number;
  };
  errors: number;
  durationMs: number;
}

function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function shiftDateKey(key: string, days: number): string {
  const [year, month, day] = key.split("-").map(Number);
  return dateKey(new Date(Date.UTC(year, month - 1, day + days)));
}

function consecutiveStreakEnding(
  dates: Set<string>,
  endingDateKey: string
): number {
  let streak = 0;
  let cursor = endingDateKey;
  while (dates.has(cursor)) {
    streak++;
    cursor = shiftDateKey(cursor, -1);
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
    const today = dateKey(new Date());
    const yesterday = shiftDateKey(today, -1);
    const allowlist = parseTestUserAllowlist();
    const summary: RunSummary = {
      periodKey: today,
      candidates: 0,
      sent: 0,
      testAllowlistActive: allowlist.size > 0,
      skipped: {
        remindersDisabled: 0,
        alreadyLogged: 0,
        alreadyActedToday: 0,
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
      return createSuccessResponse({ candidates: 0, sent: 0, skipped: summary.skipped, summary });
    }

    const { data: loggedRows, error: logError } = await (supabase as any).from("streak_reminder_log")
      .select("user_id")
      .eq("reminder_type", REMINDER_TYPE)
      .eq("period_key", today);

    if (logError) {
      throw new Error(`Failed to query streak_reminder_log: ${logError.message}`);
    }

    const alreadyLogged = new Set<string>(
      ((loggedRows ?? []) as Array<{ user_id: string }>).map((row) => row.user_id),
    );

    const { data: dailyCalls, error: dailyCallsError } = await (supabase as any).from("daily_calls")
      .select("user_id, call_date")
      .lte("call_date", today);

    if (dailyCallsError) {
      throw new Error(`Failed to query daily_calls: ${dailyCallsError.message}`);
    }

    const callsByUser = new Map<string, Set<string>>();
    for (const row of (dailyCalls ?? []) as Array<{ user_id: string; call_date: string }>) {
      if (!reminderEnabledUserIds.has(row.user_id)) continue;
      const dates = callsByUser.get(row.user_id) ?? new Set<string>();
      dates.add(row.call_date);
      callsByUser.set(row.user_id, dates);
    }

    const candidates: Candidate[] = [];
    for (const userId of reminderEnabledUserIds) {
      if (alreadyLogged.has(userId)) {
        summary.skipped.alreadyLogged++;
        continue;
      }

      const callDates = callsByUser.get(userId) ?? new Set<string>();
      if (callDates.has(today)) {
        summary.skipped.alreadyActedToday++;
        continue;
      }

      const streak = consecutiveStreakEnding(callDates, yesterday);
      if (streak < 2) {
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
          payload: { streak: candidate.streak },
          dedupeKey: `${REMINDER_TYPE}:${candidate.userId}:${today}`,
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
            period_key: today,
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
    return createSuccessResponse({
      candidates: sendCandidates.length,
      sent: summary.sent,
      skipped: summary.skipped,
      summary,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export const GET = withObservedCron(
  "/api/cron/daily-call-streak-reminder",
  _GET,
  SENTRY_MONITOR
);
