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
import { sendEmail, MAIL_FROM, MAIL_REPLY_TO, getBaseUrl } from "@/lib/mailer/client";
import { WeeklyRecapEmail } from "@/lib/mailer/templates/WeeklyRecapEmail";
import { subDays, format, startOfDay, endOfDay } from "date-fns";
import { createEmailLogger } from "@/lib/services/email-logging-service";
import { createResendRateLimiter } from "@/lib/utils/email-rate-limiter";
import { filterSuppressedRecipients } from "@/lib/email/suppression";
import { getDisplayCamThumbnailUrl } from "@/lib/media/cam-thumbnail";
import { withObservedCron } from "@/lib/cron/observability";
import { withCronOutcome } from "@/lib/cron/outcome";
import { generateEmailUnsubscribeToken } from "@/lib/alerts/email-token";

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

async function recordWeeklyRecapOutcome(
  result: { summary: RunSummary; [key: string]: unknown },
): Promise<{ summary: RunSummary; [key: string]: unknown }> {
  return withCronOutcome(
    {
      job: "/api/cron/weekly-recap-email",
      unit: "emails_sent",
      expectedMin: 1,
      getProduced: (value) => value.summary.sent,
      legitimatelyZero: (value) =>
        value.summary.activeUsers === 0
          ? { reason: "No eligible users had sessions for a weekly recap" }
          : undefined,
    },
    async () => result,
  );
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calculate session statistics for a user.
 *
 * Returns `topSpotBeachId` alongside the display fields so the caller can
 * resolve a cam thumbnail for the top spot (the email's `stats` prop only
 * carries the three display fields).
 */
function calculateStats(
  sessions: Array<{
    duration_minutes: number | null;
    beach_id: string | null;
    beach_name: string | null;
    beaches: { name: string } | { name: string }[] | null;
  }>
): {
  totalSessions: number;
  totalHours: string;
  topSpot: string;
  topSpotBeachId: string | null;
} {
  const totalSessions = sessions.length;

  // Calculate total minutes
  const totalMinutes = sessions.reduce(
    (acc, s) => acc + (s.duration_minutes || 0),
    0
  );
  const totalHours = (totalMinutes / 60).toFixed(1);

  // Find top spot (most visited beach), remembering a beach_id per spot name.
  const spotCounts: Record<string, number> = {};
  const spotBeachIds: Record<string, string> = {};
  sessions.forEach((s) => {
    // Handle beaches being either a single object or array from Supabase join
    const beach = Array.isArray(s.beaches) ? s.beaches[0] : s.beaches;
    const spotName = beach?.name || s.beach_name || "Unknown";
    spotCounts[spotName] = (spotCounts[spotName] || 0) + 1;
    if (!spotBeachIds[spotName] && s.beach_id) {
      spotBeachIds[spotName] = s.beach_id;
    }
  });

  const topSpot =
    Object.keys(spotCounts).length > 0
      ? Object.keys(spotCounts).reduce((a, b) =>
          spotCounts[a] > spotCounts[b] ? a : b
        )
      : "Unknown";

  return {
    totalSessions,
    totalHours,
    topSpot,
    topSpotBeachId: spotBeachIds[topSpot] ?? null,
  };
}

/**
 * Resolve a cam thumbnail URL for the user's top spot from beach_sources.
 * Best-effort — any failure (missing row, no cam) yields null and the email
 * simply omits the hero strip.
 */
async function resolveTopSpotImageUrl(
  supabase: Awaited<ReturnType<typeof createSupabaseServiceRoleClient>>,
  beachId: string | null
): Promise<string | null> {
  if (!beachId) return null;
  try {
    const { data, error } = await supabase
      .from("beach_sources")
      .select("camera_url, thumbnail_url")
      .eq("beach_id", beachId)
      .maybeSingle();

    if (error || !data) return null;

    return getDisplayCamThumbnailUrl({
      cameraUrl: data.camera_url,
      thumbnailUrl: data.thumbnail_url,
    });
  } catch (err) {
    console.warn(
      `${CONTEXT_TAG} top-spot image lookup failed for beach ${beachId}:`,
      err
    );
    return null;
  }
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
      return createSuccessResponse(await recordWeeklyRecapOutcome({ message: "No sessions found this week", summary }));
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
      .select("id, email, display_name, experience_level, notif_email_enabled")
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
      return createSuccessResponse(await recordWeeklyRecapOutcome({ message: "No eligible users", summary }));
    }

    summary.activeUsers = profiles.length;

    const deliverable = await filterSuppressedRecipients(
      supabase,
      profiles
        .filter((p) => p.email)
        .map((p) => ({ ...p, user_id: p.id, email: p.email as string }))
    );

    const baseUrl = getBaseUrl();

    // Initialize shared utilities
    const rateLimiter = createResendRateLimiter();
    const emailLogger = createEmailLogger(supabase, CONTEXT_TAG);

    // 5. Process each active user
    for (const profile of deliverable) {
      try {
        if (!profile.email) {
          summary.skipped.noEmail++;
          continue;
        }

        const userSessions = userSessionsMap.get(profile.id) || [];
        if (userSessions.length === 0) {
          continue;
        }

        // Calculate stats (topSpotBeachId is used only to resolve the cam
        // thumbnail; the email's `stats` prop carries the display fields).
        const { topSpotBeachId, ...stats } = calculateStats(userSessions);

        const topSpotImageUrl = await resolveTopSpotImageUrl(
          supabase,
          topSpotBeachId
        );

        const ctaUrl = `${baseUrl}/profile/analytics`;
        const settingsUrl = `${baseUrl}/settings`;
        const unsubscribeToken = generateEmailUnsubscribeToken(profile.id);
        const unsubscribeUrl =
          `${baseUrl}/api/alerts/unsubscribe-email?user_id=${profile.id}` +
          `&token=${unsubscribeToken}`;

        const emailSubject = `Your Week in the Water: ${stats.totalSessions} Session${stats.totalSessions === 1 ? "" : "s"}`;

        try {
          // Rate limit before sending
          await rateLimiter.throttle();

          const { data: sendData, error: sendError } = await sendEmail({
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
              unsubscribeUrl: settingsUrl,
              bestDays: [],
              topSpotImageUrl,
            }),
            unsubscribeUrl,
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

    return createSuccessResponse(await recordWeeklyRecapOutcome({ summary }));
  } catch (error) {
    return handleApiError(error);
  }
}

export const GET = withObservedCron("/api/cron/weekly-recap-email", _GET);
