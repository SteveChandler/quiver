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
import { generateWelcomeEmail } from "@/lib/email/templates/welcome-email";
import { getEmailTokenSecret } from "@/lib/utils/email-token";

export const revalidate = 0;
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

// ============================================================================
// Main Handler
// ============================================================================

export async function GET(request: Request) {
  const startTime = Date.now();

  try {
    if (!validateCronRequest(request)) {
      return createErrorResponse("Unauthorized", "Invalid cron authentication", 401);
    }

    console.log("[welcome-email] Starting welcome email cron run");

    const supabase = createSupabaseServiceRoleClient();
    const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://quiver.fyi").trim();
    const secret = getEmailTokenSecret();

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
      console.log("[welcome-email] No candidates found");
      return createSuccessResponse({ summary });
    }

    summary.candidates = candidates.length;
    console.log(`[welcome-email] Found ${candidates.length} candidates`);

    // 2. Process each candidate
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD for local_date

    for (const candidate of candidates as WelcomeCandidate[]) {
      try {
        // Generate welcome email
        const { subject, html, text } = await generateWelcomeEmail(
          { userId: candidate.user_id, userEmail: candidate.email, baseUrl },
          secret
        );

        // Send via Resend
        const { error: sendError } = await resend.emails.send({
          from: MAIL_FROM,
          replyTo: MAIL_REPLY_TO,
          to: candidate.email,
          subject,
          html,
          text,
        });

        if (sendError) {
          console.error(
            `[welcome-email] Failed to send to ${candidate.email}:`,
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
              `[welcome-email] Failed to auto-confirm ${candidate.user_id}:`,
              confirmError
            );
            summary.skipped.confirmFailed++;
            // Still count as sent since email went out
          } else {
            summary.autoConfirmed++;
          }
        }

        // Insert into email_send_log for dedup
        const { error: logError } = await supabase
          .from("email_send_log")
          .insert({
            user_id: candidate.user_id,
            email_type: "welcome",
            local_date: today,
            subject,
            meta: { case_type: candidate.case_type },
          });

        if (logError) {
          console.error(
            `[welcome-email] Failed to log send for ${candidate.user_id}:`,
            logError
          );
          summary.skipped.logFailed++;
        }

        summary.sent++;
        console.log(
          `[welcome-email] Sent to ${candidate.email} (${candidate.case_type})`
        );
      } catch (userError) {
        console.error(
          `[welcome-email] Error processing ${candidate.user_id}:`,
          userError
        );
        summary.skipped.sendFailed++;
      }
    }

    summary.durationMs = Date.now() - startTime;
    console.log(
      `[welcome-email] Completed: ${summary.sent} sent, ${summary.autoConfirmed} auto-confirmed, ${summary.durationMs}ms`
    );

    return createSuccessResponse({ summary });
  } catch (error) {
    return handleApiError(error);
  }
}
