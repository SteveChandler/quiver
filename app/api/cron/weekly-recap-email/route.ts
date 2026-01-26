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
 * - Vercel Cron header (`x-vercel-cron`)
 * - OR Authorization: Bearer <CRON_SECRET>
 */

import {
  createErrorResponse,
  createSuccessResponse,
  handleApiError,
  validateCronRequest,
} from "@/lib/api-utils";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { resend, MAIL_FROM, MAIL_REPLY_TO } from "@/lib/mailer/client";
import { WeeklyRecapEmail } from "@/lib/mailer/templates/WeeklyRecapEmail";
import { subDays, format, startOfDay, endOfDay } from "date-fns";

export const revalidate = 0;
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutes for processing all users

// ============================================================================
// Constants
// ============================================================================

const EMAIL_TYPE = "weekly_recap";

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

/**
 * Log email delivery to email_send_log
 */
async function logDelivery(
  userId: string,
  sessionCount: number
): Promise<void> {
  const supabase = await createSupabaseServiceRoleClient();

  const { error } = await supabase.from("email_send_log").insert({
    user_id: userId,
    email_type: EMAIL_TYPE,
    sent_at: new Date().toISOString(),
    metadata: { session_count: sessionCount },
  });

  if (error) {
    console.error(`[weekly-recap] Error logging delivery for ${userId}:`, error);
  }
}

// ============================================================================
// Main Handler
// ============================================================================

export async function GET(request: Request) {
  const startTime = Date.now();

  try {
    // 1. Validate cron auth
    if (!validateCronRequest(request)) {
      return createErrorResponse("Unauthorized", "Invalid cron authentication", 401);
    }

    console.log("📊 [weekly-recap] Starting Sunday weekly recap email run");

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
      `📅 [weekly-recap] Date range: ${format(startDate, "MMM d")} - ${format(endDate, "MMM d")}`
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
      console.log("📭 [weekly-recap] No sessions found this week");
      summary.durationMs = Date.now() - startTime;
      return createSuccessResponse({ message: "No sessions found this week", summary });
    }

    console.log(`🏄 [weekly-recap] Found ${sessions.length} sessions this week`);

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
    console.log(`👥 [weekly-recap] ${activeUserIds.length} active users this week`);

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
      console.log("📭 [weekly-recap] No eligible users found");
      summary.durationMs = Date.now() - startTime;
      return createSuccessResponse({ message: "No eligible users", summary });
    }

    summary.activeUsers = profiles.length;

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://quiver.fyi";

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

        const ctaUrl = `${baseUrl}/profile/analytics`;
        const unsubscribeUrl = `${baseUrl}/settings`;

        const emailSubject = `Your Week in the Water: ${stats.totalSessions} Session${stats.totalSessions === 1 ? "" : "s"}`;

        try {
          await resend.emails.send({
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
            }),
          });

          console.log(
            `✅ [weekly-recap] Sent to ${profile.email}: ${stats.totalSessions} sessions, ${stats.totalHours}h`
          );
          await logDelivery(profile.id, stats.totalSessions);
          summary.sent++;
        } catch (sendError) {
          console.error(`❌ [weekly-recap] Failed to send to ${profile.email}:`, sendError);
          summary.skipped.sendFailed++;
        }
      } catch (userError) {
        console.error(`❌ [weekly-recap] Error processing user ${profile.id}:`, userError);
        summary.skipped.sendFailed++;
      }
    }

    summary.durationMs = Date.now() - startTime;

    console.log(
      `🎉 [weekly-recap] Completed: ${summary.sent} emails sent, ${summary.activeUsers} active users, ${summary.durationMs}ms`
    );
    console.log(`   Skipped breakdown:`, summary.skipped);

    return createSuccessResponse({ summary });
  } catch (error) {
    return handleApiError(error);
  }
}
