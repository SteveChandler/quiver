/**
 * GET /api/cron/conditions-alert-email
 *
 * Conditions alert cron job: sends daily alerts when a user's home beach
 * has excellent conditions (score >= 7/10).
 *
 * Runs daily at 14:30 UTC (6:30 AM Pacific), 30 min after daily-intel generation.
 *
 * Candidate selection via RPC:
 * 1. User's home beach has conditions_score >= 7 today
 * 2. User hasn't been active in the app today (no user_events)
 * 3. User hasn't received ANY email today (one email per user per day)
 * 4. User has forecast alerts enabled
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
import type { SupabaseClient } from "@supabase/supabase-js";
import { resend, MAIL_FROM, MAIL_REPLY_TO, getBaseUrl } from "@/lib/mailer/client";
import { ConditionsAlertEmail } from "@/lib/mailer/templates/ConditionsAlertEmail";
import {
  formatDatabaseTime,
  getConditionLabel,
} from "@/lib/email/email-formatters";
import type { ConditionsAlertCandidate } from "@/lib/email/email-types";
import { createEmailLogger } from "@/lib/services/email-logging-service";
import { createResendRateLimiter } from "@/lib/utils/email-rate-limiter";
import { buildBeachUrl } from "@/lib/utils/beach-url-utils";

export const revalidate = 0;
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutes for processing all users

// ============================================================================
// Constants
// ============================================================================

const CONTEXT_TAG = "[conditions-alert-email]";
const MIN_SCORE = 7; // Minimum conditions_score (0-10 scale) to trigger email
const DEDUPE_HOURS = 20; // Cooldown for claim_forecast_delivery_slot dedup
const ALERT_TYPE = "conditions_alert";

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
 * Atomically claim the conditions alert delivery slot.
 * Uses the same RPC as forecast-digest-email for consistency.
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
    // Fail closed for conditions alert: don't send on error to avoid spam
    return false;
  }

  return claimed === true;
}

/**
 * Process a single conditions alert candidate: claim slot, send email, log delivery.
 */
async function processCandidate(
  candidate: ConditionsAlertCandidate,
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

  // 2. Format best window
  const bestWindow =
    candidate.best_window_start && candidate.best_window_end
      ? {
          start: formatDatabaseTime(candidate.best_window_start) || "",
          end: formatDatabaseTime(candidate.best_window_end) || "",
        }
      : null;

  // 3. Prepare email content
  const ctaUrl = `${baseUrl}${buildBeachUrl({ slug: candidate.beach_slug, city: candidate.beach_city, state: candidate.beach_state })}`;
  const logSessionUrl = `${baseUrl}/sessions/new?mode=log&beach=${candidate.home_beach_id}`;
  const unsubscribeUrl = `${baseUrl}/settings`;
  const { emoji } = getConditionLabel(candidate.conditions_score);
  const emailSubject = `${emoji} ${candidate.beach_name}: ${candidate.conditions_score}/10 today`;

  // 4. Rate limit and send email
  await rateLimiter.throttle();

  const { error: sendError } = await resend.emails.send({
    from: MAIL_FROM,
    replyTo: MAIL_REPLY_TO,
    to: candidate.email,
    subject: emailSubject,
    react: ConditionsAlertEmail({
      displayName: candidate.display_name,
      beachName: candidate.beach_name,
      conditionsScore: candidate.conditions_score,
      surfDescription: candidate.surf_description,
      windDescription: candidate.wind_description,
      bestWindow,
      ctaUrl,
      logSessionUrl,
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

  // 5. Log to email_send_log for tracking
  await emailLogger.logDelivery({
    userId: candidate.user_id,
    emailType: "conditions_alert",
    subject: emailSubject,
    bestScore: candidate.conditions_score,
    bestBeachId: candidate.home_beach_id,
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

export async function GET(request: Request) {
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

    console.log(`${CONTEXT_TAG} Starting conditions alert email run`);

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

    // 2. Get conditions alert candidates via RPC
    const { data: candidates, error: candidatesError } = await supabase.rpc(
      "get_conditions_alert_candidates",
      {
        p_min_score: MIN_SCORE,
      }
    );

    if (candidatesError) {
      throw new Error(
        `Failed to fetch conditions alert candidates: ${candidatesError.message}`
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
    for (const candidate of candidates as ConditionsAlertCandidate[]) {
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
