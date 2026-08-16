/**
 * GET /api/cron/welcome-email
 *
 * Delayed conditional welcome email cron. Runs every 6 hours.
 *
 * Case A (unconfirmed_24h): User signed up 24+ hours ago, never confirmed email.
 *   → Send welcome email + auto-confirm their email address.
 * Case B (no_home_beach_48h): User confirmed but no home beach after 48 hours.
 *   → Send welcome email as onboarding nudge.
 *
 * Deduplicates via email_send_log (only sends once per user ever).
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
import { sendEmail, MAIL_FROM, MAIL_REPLY_TO } from "@/lib/mailer/client";
import { generateWelcomeEmail } from "@/lib/mailer/welcome-email";
import { createEmailLogger } from "@/lib/services/email-logging-service";
import { createResendRateLimiter } from "@/lib/utils/email-rate-limiter";
import { filterSuppressedRecipients } from "@/lib/email/suppression";
import { withObservedCron } from "@/lib/cron/observability";
import { withCronOutcome } from "@/lib/cron/outcome";
import { generateEmailUnsubscribeToken } from "@/lib/alerts/email-token";

export const revalidate = 0;
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ============================================================================
// Constants
// ============================================================================

const CONTEXT_TAG = "[welcome-email]";
const EMAIL_TYPE = "welcome" as const;

// ============================================================================
// Type Definitions
// ============================================================================

interface WelcomeCandidate {
  user_id: string;
  email: string;
  created_at: string;
  email_confirmed_at: string | null;
  home_beach_id: string | null;
  case_type: "unconfirmed_24h" | "no_home_beach_48h";
}

interface RunSummary {
  candidates: number;
  sent: number;
  autoConfirmed: number;
  durationMs: number;
  skipped: {
    sendFailed: number;
    confirmFailed: number;
    logFailed: number;
  };
}

async function recordWelcomeEmailOutcome(
  result: { summary: RunSummary },
): Promise<{ summary: RunSummary }> {
  return withCronOutcome(
    {
      job: "/api/cron/welcome-email",
      unit: "emails_sent",
      expectedMin: 1,
      getProduced: (value) => value.summary.sent,
      legitimatelyZero: (value) =>
        value.summary.candidates === 0
          ? { reason: "No users met the welcome-email eligibility window" }
          : undefined,
    },
    async () => result,
  );
}

// ============================================================================
// Main Handler
// ============================================================================

async function _GET(request: Request): Promise<Response> {
  const startTime = Date.now();

  try {
    if (!validateCronRequest(request)) {
      return createErrorResponse("Unauthorized", "Invalid cron authentication", 401);
    }

    console.log(`${CONTEXT_TAG} Starting welcome email cron run`);

    const supabase = await createSupabaseServiceRoleClient();
    const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://quiversurf.app").trim();

    const summary: RunSummary = {
      candidates: 0,
      sent: 0,
      autoConfirmed: 0,
      durationMs: 0,
      skipped: {
        sendFailed: 0,
        confirmFailed: 0,
        logFailed: 0,
      },
    };

    // 1. Fetch eligible candidates via RPC
    const { data: candidates, error: rpcError } = await supabase.rpc(
      "get_welcome_email_candidates"
    );

    if (rpcError) {
      throw new Error(`RPC get_welcome_email_candidates failed: ${rpcError.message}`);
    }

    if (!candidates || candidates.length === 0) {
      summary.durationMs = Date.now() - startTime;
      console.log(`${CONTEXT_TAG} No candidates found`);
      return createSuccessResponse(await recordWelcomeEmailOutcome({ summary }));
    }

    const deliverable = await filterSuppressedRecipients(
      supabase,
      candidates as WelcomeCandidate[]
    );
    summary.candidates = deliverable.length;
    console.log(
      `${CONTEXT_TAG} Found ${deliverable.length} candidates (${candidates.length} before suppression)`
    );

    // Initialize shared utilities
    const rateLimiter = createResendRateLimiter();
    const emailLogger = createEmailLogger(supabase, CONTEXT_TAG);

    // 2. Process each candidate
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD for local_date

    for (const candidate of deliverable) {
      try {
        // Rate limit before sending
        await rateLimiter.throttle();

        // Unactivated users (no home beach yet) fall through to the
        // app-first "pick your home beach" variant at /app.
        let homeBeachName: string | null = null;
        let homeBeachSlug: string | null = null;
        if (candidate.home_beach_id) {
          const { data: beach } = await supabase
            .from("beaches")
            .select("name, slug")
            .eq("id", candidate.home_beach_id)
            .maybeSingle();
          if (beach?.name && beach?.slug) {
            homeBeachName = beach.name;
            homeBeachSlug = beach.slug;
          }
        }

        // Generate welcome email
        const messageInstanceId = crypto.randomUUID();
        const { subject, react, text } = await generateWelcomeEmail({
          baseUrl,
          homeBeachName,
          homeBeachSlug,
          messageInstanceId,
        });

        const unsubscribeToken = generateEmailUnsubscribeToken(
          candidate.user_id
        );
        const unsubscribeUrl =
          `${baseUrl}/api/alerts/unsubscribe-email?user_id=${candidate.user_id}` +
          `&token=${unsubscribeToken}`;

        const { data: sendData, error: sendError } = await sendEmail({
          from: MAIL_FROM,
          replyTo: MAIL_REPLY_TO,
          to: candidate.email,
          subject,
          react,
          text,
          unsubscribeUrl,
        });

        if (sendError) {
          console.error(
            `${CONTEXT_TAG} Failed to send to ${candidate.email}:`,
            sendError
          );
          summary.skipped.sendFailed++;
          continue;
        }

        // Case A: Auto-confirm unconfirmed users
        if (candidate.case_type === "unconfirmed_24h") {
          const { error: confirmError } =
            await supabase.auth.admin.updateUserById(candidate.user_id, {
              email_confirm: true,
            });

          if (confirmError) {
            console.error(
              `${CONTEXT_TAG} Failed to auto-confirm ${candidate.user_id}:`,
              confirmError
            );
            summary.skipped.confirmFailed++;
            // Still count as sent since email went out
          } else {
            summary.autoConfirmed++;
          }
        }

        // Log delivery using shared service
        const logResult = await emailLogger.logDelivery({
          userId: candidate.user_id,
          emailType: EMAIL_TYPE,
          subject,
          resendMessageId: sendData?.id,
          localDate: today,
          meta: {
            case_type: candidate.case_type,
            message_instance_id: messageInstanceId,
          },
        });

        if (!logResult.success) {
          summary.skipped.logFailed++;
        }

        summary.sent++;
        console.log(
          `${CONTEXT_TAG} Sent to ${candidate.email} (${candidate.case_type})`
        );
      } catch (userError) {
        console.error(
          `${CONTEXT_TAG} Error processing ${candidate.user_id}:`,
          userError
        );
        summary.skipped.sendFailed++;
      }
    }

    summary.durationMs = Date.now() - startTime;
    console.log(
      `${CONTEXT_TAG} Completed: ${summary.sent} sent, ${summary.autoConfirmed} auto-confirmed, ${summary.durationMs}ms`
    );

    return createSuccessResponse(await recordWelcomeEmailOutcome({ summary }));
  } catch (error) {
    return handleApiError(error);
  }
}

export const GET = withObservedCron("/api/cron/welcome-email", _GET);
