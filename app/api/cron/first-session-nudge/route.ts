/**
 * GET /api/cron/first-session-nudge
 *
 * First session nudge cron. Runs every 6 hours.
 *
 * Sends a "Your first forecast is waiting" email to users who:
 * 1. Signed up 18-30 hours ago (targets ~24h with ±6h window)
 * 2. Have zero logged sessions
 * 3. Haven't already received this email (dedup via email_send_log)
 * 4. Haven't received ANY email in the last 24 hours (global cooldown)
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
import { resend, MAIL_FROM, MAIL_REPLY_TO, getBaseUrl } from "@/lib/mailer/client";
import { FirstSessionNudgeEmail } from "@/lib/mailer/templates/FirstSessionNudgeEmail";
import { createEmailLogger } from "@/lib/services/email-logging-service";
import { createResendRateLimiter } from "@/lib/utils/email-rate-limiter";

export const revalidate = 0;
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ============================================================================
// Constants
// ============================================================================

const CONTEXT_TAG = "[first-session-nudge]";
const EMAIL_TYPE = "first_session_nudge" as const;
const SIGNUP_MIN_HOURS = 18;
const SIGNUP_MAX_HOURS = 30;
const GLOBAL_COOLDOWN_HOURS = 24;

// ============================================================================
// Type Definitions
// ============================================================================

interface NudgeCandidate {
  user_id: string;
  email: string;
  display_name: string | null;
}

interface RunSummary {
  candidates: number;
  sent: number;
  durationMs: number;
  skipped: {
    sendFailed: number;
    logFailed: number;
  };
}

// ============================================================================
// Main Handler
// ============================================================================

export async function GET(request: Request) {
  const startTime = Date.now();

  try {
    if (!validateCronRequest(request)) {
      return createErrorResponse("Unauthorized", "Invalid cron authentication", 401);
    }

    console.log(`${CONTEXT_TAG} Starting first-session-nudge run`);

    const supabase = createSupabaseServiceRoleClient();
    const baseUrl = getBaseUrl();

    const summary: RunSummary = {
      candidates: 0,
      sent: 0,
      durationMs: 0,
      skipped: {
        sendFailed: 0,
        logFailed: 0,
      },
    };

    // 1. Find users who signed up 18-30h ago with zero sessions
    //    and haven't received this email or any email in the cooldown window.
    const now = new Date();
    const signupAfter = new Date(
      now.getTime() - SIGNUP_MAX_HOURS * 60 * 60 * 1000
    ).toISOString();
    const signupBefore = new Date(
      now.getTime() - SIGNUP_MIN_HOURS * 60 * 60 * 1000
    ).toISOString();
    const cooldownSince = new Date(
      now.getTime() - GLOBAL_COOLDOWN_HOURS * 60 * 60 * 1000
    ).toISOString();

    // Query profiles table for users in the signup window (scalable, no pagination limit)
    const { data: windowProfiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, display_name")
      .gte("created_at", signupAfter)
      .lte("created_at", signupBefore);

    if (profilesError) {
      throw new Error(`Failed to query profiles: ${profilesError.message}`);
    }

    if (!windowProfiles || windowProfiles.length === 0) {
      summary.durationMs = Date.now() - startTime;
      console.log(`${CONTEXT_TAG} No users in signup window`);
      return createSuccessResponse({ summary });
    }

    const windowUserIds = windowProfiles.map((p) => p.id);

    // 2. Filter out users who already have sessions
    const { data: usersWithSessions, error: sessionsError } = await supabase
      .from("sessions")
      .select("user_id")
      .in("user_id", windowUserIds);

    if (sessionsError) {
      throw new Error(`Failed to check sessions: ${sessionsError.message}`);
    }

    const userIdsWithSessions = new Set(
      (usersWithSessions ?? []).map((s) => s.user_id)
    );

    // 3. Filter out users who already received this email or any recent email
    const { data: recentEmails, error: emailsError } = await supabase
      .from("email_send_log")
      .select("user_id, email_type")
      .in("user_id", windowUserIds)
      .or(`email_type.eq.${EMAIL_TYPE},sent_at.gte.${cooldownSince}`);

    if (emailsError) {
      throw new Error(`Failed to check email log: ${emailsError.message}`);
    }

    const userIdsWithNudge = new Set<string>();
    const userIdsWithRecentEmail = new Set<string>();
    for (const entry of recentEmails ?? []) {
      if (entry.email_type === EMAIL_TYPE) {
        userIdsWithNudge.add(entry.user_id);
      }
      userIdsWithRecentEmail.add(entry.user_id);
    }

    // 4. Build candidate list — get email from auth for final candidates only
    const profileMap = new Map(
      windowProfiles.map((p) => [p.id, p.display_name as string | null])
    );

    const candidateIds: string[] = [];
    for (const profile of windowProfiles) {
      if (userIdsWithSessions.has(profile.id)) continue;
      if (userIdsWithNudge.has(profile.id)) continue;
      if (userIdsWithRecentEmail.has(profile.id)) continue;
      candidateIds.push(profile.id);
    }

    // Fetch emails from auth only for final candidates (batched to avoid serial API calls)
    const BATCH_SIZE = 5;
    const candidates: NudgeCandidate[] = [];
    for (let i = 0; i < candidateIds.length; i += BATCH_SIZE) {
      const batch = candidateIds.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(
        batch.map((userId) => supabase.auth.admin.getUserById(userId))
      );
      for (let j = 0; j < results.length; j++) {
        const authUser = results[j].data;
        const userId = batch[j];
        if (authUser?.user?.email) {
          candidates.push({
            user_id: userId,
            email: authUser.user.email,
            display_name: profileMap.get(userId) ?? null,
          });
        }
      }
    }

    summary.candidates = candidates.length;
    console.log(
      `${CONTEXT_TAG} Found ${candidates.length} candidates (${windowProfiles.length} in window, ${userIdsWithSessions.size} with sessions, ${userIdsWithNudge.size} already nudged)`
    );

    if (candidates.length === 0) {
      summary.durationMs = Date.now() - startTime;
      return createSuccessResponse({ summary });
    }

    // 5. Send emails
    const rateLimiter = createResendRateLimiter();
    const emailLogger = createEmailLogger(supabase, CONTEXT_TAG);
    const today = new Date().toISOString().slice(0, 10);

    for (const candidate of candidates) {
      try {
        await rateLimiter.throttle();

        const logSessionUrl = `${baseUrl}/sessions/new?mode=log&quick=true&utm_source=quiver&utm_medium=email&utm_campaign=first_session_nudge`;
        const unsubscribeUrl = `${baseUrl}/settings`;
        const subject = "Your first forecast is waiting";

        const { data: sendData, error: sendError } = await resend.emails.send({
          from: MAIL_FROM,
          replyTo: MAIL_REPLY_TO,
          to: candidate.email,
          subject,
          react: FirstSessionNudgeEmail({
            displayName: candidate.display_name,
            logSessionUrl,
            unsubscribeUrl,
          }),
        });

        if (sendError) {
          console.error(
            `${CONTEXT_TAG} Failed to send to user ${candidate.user_id}:`,
            sendError
          );
          summary.skipped.sendFailed++;
          continue;
        }

        const logResult = await emailLogger.logDelivery({
          userId: candidate.user_id,
          emailType: EMAIL_TYPE,
          subject,
          resendMessageId: sendData?.id,
          localDate: today,
          meta: { signup_window: `${SIGNUP_MIN_HOURS}-${SIGNUP_MAX_HOURS}h` },
        });

        if (!logResult.success) {
          summary.skipped.logFailed++;
        }

        summary.sent++;
        console.log(`${CONTEXT_TAG} Sent to user ${candidate.user_id}`);
      } catch (candidateError) {
        console.error(
          `${CONTEXT_TAG} Error processing ${candidate.user_id}:`,
          candidateError
        );
        summary.skipped.sendFailed++;
      }
    }

    summary.durationMs = Date.now() - startTime;
    console.log(
      `${CONTEXT_TAG} Completed: ${summary.sent} sent, ${summary.candidates} candidates, ${summary.durationMs}ms`
    );

    return createSuccessResponse({ summary });
  } catch (error) {
    return handleApiError(error);
  }
}
