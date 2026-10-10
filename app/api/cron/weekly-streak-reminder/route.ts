/**
 * GET /api/cron/weekly-streak-reminder
 *
 * Sunday reminder for users whose weekly session streak is at risk.
 * Auth: Authorization: Bearer <CRON_SECRET> or Vercel Cron header.
 */

import { fromZonedTime } from "date-fns-tz";
import { readAllPages } from "@/lib/alerts/swell-events/paging";
import { getLocalDateString, resolveBeachTimezone } from "@/lib/utils/timezone-utils";
import { chunk } from "@/lib/utils/chunk";
import { normalizeIanaTimezone } from "@/lib/utils/iana-timezone";
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
  periodKey: string;
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
    const now = new Date();
    const thisWeekStart = startOfUtcIsoWeek(now);
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

    const profiles = await readAllPages(async (offset, limit) => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, notif_reminders, timezone, home_beach:beaches!profiles_home_beach_id_fkey(timezone)")
        .order("id")
        .range(offset, offset + limit - 1);
      if (error) throw new Error(`Failed to query profiles: ${error.message}`);
      return data ?? [];
    });

    const users = [];
    for (const profile of profiles) {
      if (!profile.id) continue;
      if (profile.notif_reminders === false) {
        summary.skipped.remindersDisabled++;
        continue;
      }
      if (allowlist.size > 0 && !allowlist.has(profile.id)) {
        summary.skipped.notInTestAllowlist++;
        continue;
      }
      const timezone = resolveBeachTimezone(
        normalizeIanaTimezone(profile.timezone) ?? normalizeIanaTimezone(profile.home_beach?.timezone),
      );
      const weekStart = startOfUtcIsoWeek(keyToDate(getLocalDateString(now, timezone)));
      const localPeriodKey = isoWeekKey(weekStart);
      const startsAt = fromZonedTime(`${weekStart}T00:00:00`, timezone).toISOString();
      const endsAt = fromZonedTime(`${shiftDateKey(weekStart, 7)}T00:00:00`, timezone).toISOString();
      const utcWeekAtLocalStart = startOfUtcIsoWeek(new Date(startsAt));
      const compatibleKeys = [...new Set([localPeriodKey, periodKey, isoWeekKey(utcWeekAtLocalStart)])];
      users.push({ userId: profile.id, timezone, weekStart, periodKey: localPeriodKey, compatibleKeys, startsAt, endsAt });
    }

    if (users.length === 0) {
      summary.durationMs = Date.now() - startedAt;
      return createSuccessResponse(await recordWeeklyStreakOutcome({ candidates: 0, sent: 0, skipped: summary.skipped, summary }));
    }

    const periodKeys = [...new Set(users.flatMap((user) => user.compatibleKeys))];
    const loggedRows: Array<{ user_id: string; period_key: string; sent_at: string }> = [];
    // Keep UUID filters below URL limits as the profile population grows.
    for (const userIds of chunk(users.map((user) => user.userId), 200)) {
      loggedRows.push(...await readAllPages(async (offset, limit) => {
        const { data, error } = await supabase.from("streak_reminder_log")
          .select("user_id, period_key, sent_at")
          .eq("reminder_type", REMINDER_TYPE)
          .in("user_id", userIds)
          .in("period_key", periodKeys)
          .order("user_id")
          .order("period_key")
          .range(offset, offset + limit - 1);
        if (error) throw new Error(`Failed to query streak_reminder_log: ${error.message}`);
        return data ?? [];
      }));
    }
    const alreadyLogged = new Map(loggedRows.map((row) => [`${row.user_id}:${row.period_key}`, row.sent_at]));

    const candidates: Candidate[] = [];
    for (const user of users) {
      const legacyKeys = user.compatibleKeys.filter((key) => key !== user.periodKey);
      // A legacy label can also belong to last week's local reminder; check when it was sent.
      const loggedUnderLegacyKey = legacyKeys.some((key) => {
        const sentAt = alreadyLogged.get(`${user.userId}:${key}`);
        if (!sentAt) return false;
        const sentTime = new Date(sentAt).getTime();
        return sentTime >= new Date(user.startsAt).getTime() && sentTime < new Date(user.endsAt).getTime();
      });
      if (alreadyLogged.has(`${user.userId}:${user.periodKey}`) || loggedUnderLegacyKey) {
        summary.skipped.alreadyLogged++;
        continue;
      }
      if (legacyKeys.length > 0) {
        const legacyEvents = await readAllPages(async (offset, limit) => {
          const { data, error } = await supabase.from("notification_events")
            .select("id")
            .in("dedupe_key", legacyKeys.map((key) => `${REMINDER_TYPE}:${user.userId}:${key}`))
            .gte("created_at", user.startsAt)
            .lt("created_at", user.endsAt)
            .order("id")
            .range(offset, offset + limit - 1);
          if (error) throw new Error(`Failed to query notification_events: ${error.message}`);
          return data ?? [];
        });
        if (legacyEvents.length > 0) {
          summary.skipped.alreadyLogged++;
          continue;
        }
      }

      let streak = 0;
      let weekStart = user.weekStart;
      let loggedThisWeek = false;
      // Walk to the first gap instead of imposing a limit that could truncate a real streak.
      for (;;) {
        const start = fromZonedTime(`${weekStart}T00:00:00`, user.timezone).toISOString();
        const end = fromZonedTime(`${shiftDateKey(weekStart, 7)}T00:00:00`, user.timezone).toISOString();
        const sessions = await readAllPages(async (offset, limit) => {
          const { data, error } = await supabase.from("sessions")
            .select("id")
            .eq("user_id", user.userId)
            .is("deleted_at", null)
            .gte("arrival_time", start)
            .lt("arrival_time", end)
            .order("id")
            .range(offset, offset + limit - 1);
          if (error) throw new Error(`Failed to query sessions: ${error.message}`);
          return data ?? [];
        });
        if (weekStart === user.weekStart) {
          if (sessions.length > 0) {
            loggedThisWeek = true;
            break;
          }
        } else {
          if (sessions.length === 0) break;
          streak++;
        }
        weekStart = shiftDateKey(weekStart, -7);
      }

      if (loggedThisWeek) {
        summary.skipped.alreadyLoggedThisWeek++;
        continue;
      }
      if (streak < 1) {
        summary.skipped.streakTooShort++;
        continue;
      }
      candidates.push({ userId: user.userId, streak, periodKey: user.periodKey });
    }

    summary.candidates = candidates.length;
    if (allowlist.size > 0) {
      console.log(
        `${CONTEXT_TAG} STREAK_REMINDER_TEST_USER_IDS active; filtered ${summary.skipped.notInTestAllowlist} user(s)`
      );
    }

    for (const candidate of candidates) {
      try {
        const enqueueResult = await enqueueNotification({
          type: NOTIFICATION_TYPE,
          recipientUserId: candidate.userId,
          payload: {
            streak: candidate.streak,
            period_key: candidate.periodKey,
            ...buildNotificationRelevanceMetadata({
              category: "session_growth",
              triggerSource: "weekly_streak_reminder",
              relevanceConfidence: "medium",
              beachConfidence: "low",
            }),
          },
          dedupeKey: `${REMINDER_TYPE}:${candidate.userId}:${candidate.periodKey}`,
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

        const { error: insertError } = await supabase.from("streak_reminder_log")
          .insert({
            user_id: candidate.userId,
            reminder_type: REMINDER_TYPE,
            period_key: candidate.periodKey,
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
      candidates: candidates.length,
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
