/**
 * GET /api/cron/session-prompt-email
 *
 * Session prompt cron job: sends "How was your session?" emails to users
 * whose home beach had good conditions yesterday but who didn't log a session.
 *
 * Runs daily at 18:30 UTC (10:30 AM Pacific), offset 30 min from reengagement.
 *
 * Candidate selection via RPC:
 * 1. Home beach had conditions_score >= 70 yesterday
 * 2. User didn't log a session yesterday
 * 3. User hasn't been active in the app today (no user_events)
 * 4. User hasn't received ANY email today (one email per user per day)
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
} from "@/lib/middleware/api-wrappers";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { resend, MAIL_FROM, MAIL_REPLY_TO, getBaseUrl } from "@/lib/mailer/client";
import { SessionPromptEmail } from "@/lib/mailer/templates/SessionPromptEmail";
import type { SessionPromptCandidate } from "@/lib/email/email-types";
import { createEmailLogger } from "@/lib/services/email-logging-service";
import { createResendRateLimiter } from "@/lib/utils/email-rate-limiter";
import { signEmailToken, getEmailTokenSecret } from "@/lib/utils/email-token";
import { withObservedCron } from "@/lib/cron/observability";

export const revalidate = 0;
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutes for processing all users

// ============================================================================
// Constants
// ============================================================================

const CONTEXT_TAG = "[session-prompt-email]";
const MIN_SCORE = 70; // Minimum conditions_score (0-100 scale) to trigger email
const DEDUPE_HOURS = 20; // Cooldown for claim_forecast_delivery_slot dedup
const ALERT_TYPE = "session_prompt";

// ============================================================================
// Type Definitions
// ============================================================================

interface RunSummary {
  candidates: number;
  sent: number;
  durationMs: number;
  skipped: {
    claimFailed: number;
    sendFailed: number;
  };
}

type ProcessingStatus = "success" | "claim_failed" | "send_failed";

interface ProcessingResult {
  status: ProcessingStatus;
  error?: unknown;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Atomically claim the session prompt delivery slot.
 * Uses the same RPC as other email alerts for consistency.
 */
async function claimDeliverySlot(
  supabase: SupabaseClient,
  userId: string,
  beachId: string
): Promise<boolean> {
  const { data: claimed, error } = await supabase.rpc(
    "claim_forecast_delivery_slot",
    {
      p_user_id: userId,
      p_beach_id: beachId,
      p_alert_type: ALERT_TYPE,
      p_dedupe_hours: DEDUPE_HOURS,
    }
  );

  if (error) {
    console.error(
      `${CONTEXT_TAG} Error claiming slot for user ${userId}:`,
      error
    );
    // Fail closed: don't send on error to avoid spam
    return false;
  }

  return claimed === true;
}

/**
 * Process a single session prompt candidate: claim slot, send email, log delivery.
 */
async function processCandidate(
  candidate: SessionPromptCandidate,
  supabase: SupabaseClient,
  baseUrl: string,
  rateLimiter: ReturnType<typeof createResendRateLimiter>,
  emailLogger: ReturnType<typeof createEmailLogger>
): Promise<ProcessingResult> {
  // 1. Atomically claim the delivery slot
  const claimed = await claimDeliverySlot(
    supabase,
    candidate.user_id,
    candidate.home_beach_id
  );

  if (!claimed) {
    return { status: "claim_failed" };
  }

  // 2. Prepare email content
  const unsubscribeUrl = `${baseUrl}/settings`;
  const emailSubject = `How was your session at ${candidate.beach_name}?`;

  // Generate a signed token for the one-tap email actions
  const tokenSecret = getEmailTokenSecret();
  const token = await signEmailToken(
    { user_id: candidate.user_id, purpose: "log_session" },
    tokenSecret
  );

  // Yesterday's date in YYYY-MM-DD format (UTC) for the session log
  const yesterday = new Date();
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const sessionDate = yesterday.toISOString().slice(0, 10);

  const confirmUrl =
    `${baseUrl}/session/confirm?token=${encodeURIComponent(token)}` +
    `&beach_id=${encodeURIComponent(candidate.home_beach_id)}` +
    `&date=${encodeURIComponent(sessionDate)}`;

  const skipUrl =
    `${baseUrl}/session/skip?token=${encodeURIComponent(token)}` +
    `&beach_id=${encodeURIComponent(candidate.home_beach_id)}`;

  // 3. Rate limit and send email
  await rateLimiter.throttle();

  const { data: sendData, error: sendError } = await resend.emails.send({
    from: MAIL_FROM,
    replyTo: MAIL_REPLY_TO,
    to: candidate.email,
    subject: emailSubject,
    react: SessionPromptEmail({
      displayName: candidate.display_name,
      beachName: candidate.beach_name,
      conditionsScore: candidate.conditions_score,
      surfDescription: candidate.surf_description,
      confirmUrl,
      skipUrl,
      unsubscribeUrl,
    }),
  });

  if (sendError) {
    console.error(
      `${CONTEXT_TAG} Failed to send to user ${candidate.user_id}:`,
      sendError
    );
    return { status: "send_failed", error: sendError };
  }

  // 4. Log to email_send_log for tracking
  await emailLogger.logDelivery({
    userId: candidate.user_id,
    emailType: "session_prompt",
    subject: emailSubject,
    bestScore: candidate.conditions_score,
    bestBeachId: candidate.home_beach_id,
    resendMessageId: sendData?.id,
    meta: {
      beach_name: candidate.beach_name,
      beach_slug: candidate.beach_slug,
    },
  });

  console.log(
    `${CONTEXT_TAG} Sent to user ${candidate.user_id} for ${candidate.beach_name} (score: ${candidate.conditions_score})`
  );

  return { status: "success" };
}

// ============================================================================
// Main Handler
// ============================================================================

async function _GET(request: Request): Promise<Response> {
  const startTime = Date.now();

  try {
    // 1. Validate cron auth
    if (!validateCronRequest(request)) {
      return createErrorResponse(
        "Unauthorized",
        "Invalid cron authentication",
        401
      );
    }

    console.log(`${CONTEXT_TAG} Starting session prompt email run`);

    const supabase = await createSupabaseServiceRoleClient();

    // Initialize summary
    const summary: RunSummary = {
      candidates: 0,
      sent: 0,
      durationMs: 0,
      skipped: {
        claimFailed: 0,
        sendFailed: 0,
      },
    };

    // 2. Get session prompt candidates via RPC
    const { data: candidates, error: candidatesError } = await supabase.rpc(
      "get_session_prompt_candidates",
      {
        p_min_score: MIN_SCORE,
      }
    );

    if (candidatesError) {
      throw new Error(
        `Failed to fetch session prompt candidates: ${candidatesError.message}`
      );
    }

    console.log(`${CONTEXT_TAG} Found ${candidates?.length ?? 0} candidates`);

    if (!candidates || candidates.length === 0) {
      summary.durationMs = Date.now() - startTime;
      return createSuccessResponse({ summary });
    }

    summary.candidates = candidates.length;
    const baseUrl = getBaseUrl();

    // Initialize shared utilities
    const rateLimiter = createResendRateLimiter();
    const emailLogger = createEmailLogger(supabase, CONTEXT_TAG);

    // 3. Process each candidate
    for (const candidate of candidates as SessionPromptCandidate[]) {
      try {
        const result = await processCandidate(
          candidate,
          supabase,
          baseUrl,
          rateLimiter,
          emailLogger
        );

        switch (result.status) {
          case "success":
            summary.sent++;
            break;
          case "claim_failed":
            summary.skipped.claimFailed++;
            break;
          case "send_failed":
            summary.skipped.sendFailed++;
            break;
        }
      } catch (candidateError) {
        console.error(
          `${CONTEXT_TAG} Error processing candidate ${candidate.user_id}:`,
          candidateError
        );
        summary.skipped.sendFailed++;
      }
    }

    summary.durationMs = Date.now() - startTime;

    console.log(
      `${CONTEXT_TAG} Completed: ${summary.sent} emails sent, ${summary.candidates} candidates, ${summary.durationMs}ms`
    );
    console.log(`   Skipped breakdown:`, summary.skipped);

    return createSuccessResponse({ summary });
  } catch (error) {
    return handleApiError(error);
  }
}

export const GET = withObservedCron("/api/cron/session-prompt-email", _GET);
