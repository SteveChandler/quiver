/**
 * GET /api/cron/weekly-recap-email
 *
 * Sunday cron job: sends weekly session recap to users who logged 1+ sessions.
 * Part of the "Retention Layer" - rewards users for being in the water.
 *
 * Runs Sunday at 6 PM Pacific (Monday 02:00 UTC).
 *
 * Provides:
 * - Total session count for the week
 * - Total hours surfed
 * - Top spot (most visited beach)
 *
 * Auth:
 * - Authorization: Bearer <CRON_SECRET>
 */

import {
  createErrorResponse,
  createSuccessResponse,
  handleApiError,
  validateCronRequest,
} from "@/lib/middleware/api-wrappers";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { resend, MAIL_FROM, MAIL_REPLY_TO, getBaseUrl } from "@/lib/mailer/client";
import { WeeklyRecapEmail } from "@/lib/mailer/templates/WeeklyRecapEmail";
import { subDays, format, startOfDay, endOfDay } from "date-fns";
import { createEmailLogger } from "@/lib/services/email-logging-service";
import { createResendRateLimiter } from "@/lib/utils/email-rate-limiter";
import { computeBestDaysForUser } from "@/lib/alerts/best-days";
import { withObservedCron } from "@/lib/cron/observability";

export const revalidate = 0;
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutes for processing all users

// ============================================================================
// Constants
// ============================================================================

const CONTEXT_TAG = "[weekly-recap]";
const EMAIL_TYPE = "weekly_recap" as const;

// ============================================================================
// Type Definitions
// ============================================================================

interface RunSummary {
  activeUsers: number;
  sent: number;
  durationMs: number;
  skipped: {
    noEmail: number;
    sendFailed: number;
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calculate session statistics for a user
 */
function calculateStats(
  sessions: Array<{
    duration_minutes: number | null;
    beach_name: string | null;
    beaches: { name: string } | { name: string }[] | null;
  }>
): {
  totalSessions: number;
  totalHours: string;
  topSpot: string;
} {
  const totalSessions = sessions.length;

  // Calculate total minutes
  const totalMinutes = sessions.reduce(
    (acc, s) => acc + (s.duration_minutes || 0),
    0
  );
  const totalHours = (totalMinutes / 60).toFixed(1);

  // Find top spot (most visited beach)
  const spotCounts: Record<string, number> = {};
  sessions.forEach((s) => {
    // Handle beaches being either a single object or array from Supabase join
    const beach = Array.isArray(s.beaches) ? s.beaches[0] : s.beaches;
    const spotName = beach?.name || s.beach_name || "Unknown";
    spotCounts[spotName] = (spotCounts[spotName] || 0) + 1;
  });

  const topSpot =
    Object.keys(spotCounts).length > 0
      ? Object.keys(spotCounts).reduce((a, b) =>
          spotCounts[a] > spotCounts[b] ? a : b
        )
      : "Unknown";

  return { totalSessions, totalHours, topSpot };
}

// ============================================================================
// Main Handler
// ============================================================================

async function _GET(request: Request): Promise<Response> {
  const startTime = Date.now();

  try {
    // 1. Validate cron auth
    if (!validateCronRequest(request)) {
      return createErrorResponse("Unauthorized", "Invalid cron authentication", 401);
    }

    console.log(`${CONTEXT_TAG} Starting Sunday weekly recap email run`);

    const supabase = await createSupabaseServiceRoleClient();

    // Initialize summary
    const summary: RunSummary = {
      activeUsers: 0,
      sent: 0,
      durationMs: 0,
      skipped: {
        noEmail: 0,
        sendFailed: 0,
      },
    };

    // Calculate date range (past 7 days)
    const endDate = new Date();
    const startDate = subDays(endDate, 7);

    console.log(
      `${CONTEXT_TAG} Date range: ${format(startDate, "MMM d")} - ${format(endDate, "MMM d")}`
    );

    // 2. Fetch all sessions from the past 7 days with user and beach info
    const { data: sessions, error: sessionsError } = await supabase
      .from("sessions")
      .select(
        `
        id,
        user_id,
        duration_minutes,
        beach_id,
        beach_name,
        beaches (
          name
        )
      `
      )
      .gte("arrival_time", startOfDay(startDate).toISOString())
      .lte("arrival_time", endOfDay(endDate).toISOString());

    if (sessionsError) {
      throw new Error(`Failed to fetch sessions: ${sessionsError.message}`);
    }

    if (!sessions || sessions.length === 0) {
      console.log(`${CONTEXT_TAG} No sessions found this week`);
      summary.durationMs = Date.now() - startTime;
      return createSuccessResponse({ message: "No sessions found this week", summary });
    }

    console.log(`${CONTEXT_TAG} Found ${sessions.length} sessions this week`);

    // 3. Group sessions by user
    const userSessionsMap: Map<string, typeof sessions> = new Map();
    sessions.forEach((session) => {
      const userId = session.user_id;
      if (!userSessionsMap.has(userId)) {
        userSessionsMap.set(userId, []);
      }
      userSessionsMap.get(userId)!.push(session);
    });

    const activeUserIds = Array.from(userSessionsMap.keys());
    console.log(`${CONTEXT_TAG} ${activeUserIds.length} active users this week`);

    // 4. Fetch user profiles for active users
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, email, display_name, notif_email_enabled")
      .in("id", activeUserIds)
      .eq("notif_email_enabled", true)
      .eq("is_mock", false)
      .not("email", "is", null);

    if (profilesError) {
      throw new Error(`Failed to fetch profiles: ${profilesError.message}`);
    }

    if (!profiles || profiles.length === 0) {
      console.log(`${CONTEXT_TAG} No eligible users found`);
      summary.durationMs = Date.now() - startTime;
      return createSuccessResponse({ message: "No eligible users", summary });
    }

    summary.activeUsers = profiles.length;

    const baseUrl = getBaseUrl();

    // Initialize shared utilities
    const rateLimiter = createResendRateLimiter();
    const emailLogger = createEmailLogger(supabase, CONTEXT_TAG);

    // 5. Process each active user
    for (const profile of profiles) {
      try {
        if (!profile.email) {
          summary.skipped.noEmail++;
          continue;
        }

        const userSessions = userSessionsMap.get(profile.id) || [];
        if (userSessions.length === 0) {
          continue;
        }

        // Calculate stats
        const stats = calculateStats(userSessions);

        // Phase 2: compute top similarity-match slots for the next 7 days
        // across the user's subscribed beaches. Errors here must not abort
        // the digest — on failure we simply omit the section.
        let bestDays: Awaited<ReturnType<typeof computeBestDaysForUser>> = [];
        try {
          bestDays = await computeBestDaysForUser(supabase, profile.id);
        } catch (bestDaysErr) {
          console.warn(
            `${CONTEXT_TAG} best-days query failed for user ${profile.id}:`,
            bestDaysErr,
          );
        }

        const ctaUrl = `${baseUrl}/profile/analytics`;
        const unsubscribeUrl = `${baseUrl}/settings`;

        const emailSubject = `Your Week in the Water: ${stats.totalSessions} Session${stats.totalSessions === 1 ? "" : "s"}`;

        try {
          // Rate limit before sending
          await rateLimiter.throttle();

          const { data: sendData, error: sendError } = await resend.emails.send({
            from: MAIL_FROM,
            replyTo: MAIL_REPLY_TO,
            to: profile.email,
            subject: emailSubject,
            react: WeeklyRecapEmail({
              userName: profile.display_name,
              startDate: format(startDate, "MMM d"),
              endDate: format(endDate, "MMM d"),
              stats,
              ctaUrl,
              unsubscribeUrl,
              bestDays,
            }),
          });

          if (sendError) {
            throw sendError;
          }

          console.log(
            `${CONTEXT_TAG} Sent to ${profile.email}: ${stats.totalSessions} sessions, ${stats.totalHours}h`
          );

          // Log delivery using shared service
          await emailLogger.logDelivery({
            userId: profile.id,
            emailType: EMAIL_TYPE,
            subject: emailSubject,
            resendMessageId: sendData?.id,
            meta: { session_count: stats.totalSessions },
          });

          summary.sent++;
        } catch (sendError) {
          console.error(`${CONTEXT_TAG} Failed to send to ${profile.email}:`, sendError);
          summary.skipped.sendFailed++;
        }
      } catch (userError) {
        console.error(`${CONTEXT_TAG} Error processing user ${profile.id}:`, userError);
        summary.skipped.sendFailed++;
      }
    }

    summary.durationMs = Date.now() - startTime;

    console.log(
      `${CONTEXT_TAG} Completed: ${summary.sent} emails sent, ${summary.activeUsers} active users, ${summary.durationMs}ms`
    );
    console.log(`   Skipped breakdown:`, summary.skipped);

    return createSuccessResponse({ summary });
  } catch (error) {
    return handleApiError(error);
  }
}

export const GET = withObservedCron("/api/cron/weekly-recap-email", _GET);
