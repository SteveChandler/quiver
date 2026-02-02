/**
 * GET /api/cron/reengagement-email
 *
 * Re-engagement cron job: sends "conditions are good" emails to inactive users
 * whose home beach has excellent conditions today.
 *
 * Runs Mon/Wed/Fri at 18:00 UTC (10 AM Pacific).
 *
 * Candidate selection via RPC:
 * 1. User hasn't had a session in 7+ days (inactive)
 * 2. Home beach has conditions_score >= 70 today
 * 3. User hasn't received a re-engagement email in 72 hours
 * 4. User hasn't received ANY email in 48 hours (global rate limit)
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
import { ReengagementEmail } from "@/lib/mailer/templates/ReengagementEmail";
import {
  formatDatabaseTime,
  getConditionLabelText,
} from "@/lib/email/email-formatters";
import type { IntelPost, ReengagementCandidate } from "@/lib/email/email-types";

export const revalidate = 0;
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutes for processing all users

// ============================================================================
// Constants
// ============================================================================

const INACTIVE_DAYS = 7; // User hasn't surfed in 7 days
const MIN_SCORE = 7; // Minimum conditions_score (0-10 scale) to trigger email
const DEDUPE_HOURS = 72; // 3 days between re-engagement emails
const GLOBAL_COOLDOWN_HOURS = 48; // 2 days between any emails
const ALERT_TYPE = "reengagement";
const MAX_INTEL_POSTS = 2; // Number of recent intel posts to include

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

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Atomically claim the re-engagement delivery slot.
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
      `[reengagement-email] Error claiming slot for user ${userId}:`,
      error
    );
    // Fail closed for re-engagement: don't send on error to avoid spam
    return false;
  }

  return claimed === true;
}

/**
 * Fetch recent intel posts for the beach to include as social proof.
 */
async function fetchRecentIntel(
  supabase: SupabaseClient,
  beachId: string,
  limit: number = MAX_INTEL_POSTS
): Promise<IntelPost[]> {
  const { data, error } = await supabase
    .from("intel_posts")
    .select("id, tag, description")
    .eq("beach_id", beachId)
    .eq("is_active", true)
    .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !data) {
    return [];
  }

  return data.map((post) => ({
    id: post.id,
    tag: post.tag || "conditions",
    description: post.description || "",
  }));
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

    console.log(
      "[reengagement-email] Starting re-engagement email run"
    );

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

    // 2. Get re-engagement candidates via RPC
    const { data: candidates, error: candidatesError } = await supabase.rpc(
      "get_reengagement_email_candidates",
      {
        p_inactive_days: INACTIVE_DAYS,
        p_min_score: MIN_SCORE,
        p_dedupe_hours: DEDUPE_HOURS,
        p_global_cooldown_hours: GLOBAL_COOLDOWN_HOURS,
      }
    );

    if (candidatesError) {
      throw new Error(
        `Failed to fetch re-engagement candidates: ${candidatesError.message}`
      );
    }

    console.log(
      `[reengagement-email] Found ${candidates?.length ?? 0} candidates`
    );

    if (!candidates || candidates.length === 0) {
      summary.durationMs = Date.now() - startTime;
      return createSuccessResponse({ summary });
    }

    summary.candidates = candidates.length;
    const baseUrl = getBaseUrl();

    // 3. Process each candidate
    for (const candidate of candidates as ReengagementCandidate[]) {
      try {
        // Atomically claim the delivery slot
        const claimed = await claimDeliverySlot(
          supabase,
          candidate.user_id,
          candidate.home_beach_id
        );

        if (!claimed) {
          summary.skipped.claimFailed++;
          continue;
        }

        // Fetch recent intel for social proof
        const recentIntel = await fetchRecentIntel(
          supabase,
          candidate.home_beach_id
        );

        // Format best window
        const bestWindow =
          candidate.best_window_start && candidate.best_window_end
            ? {
                start: formatDatabaseTime(candidate.best_window_start) || "",
                end: formatDatabaseTime(candidate.best_window_end) || "",
              }
            : null;

        const ctaUrl = `${baseUrl}/beaches/${candidate.beach_slug}`;
        const unsubscribeUrl = `${baseUrl}/settings`;
        const conditionLabel = getConditionLabelText(candidate.conditions_score);
        const emailSubject = `${conditionLabel} conditions at ${candidate.beach_name} today!`;

        try {
          // Respect Resend rate limit (2 req/s)
          if (summary.sent > 0) {
            await new Promise((resolve) => setTimeout(resolve, 600));
          }

          await resend.emails.send({
            from: MAIL_FROM,
            replyTo: MAIL_REPLY_TO,
            to: candidate.email,
            subject: emailSubject,
            react: ReengagementEmail({
              displayName: candidate.display_name,
              beachName: candidate.beach_name,
              beachSlug: candidate.beach_slug,
              conditionsScore: candidate.conditions_score,
              surfDescription: candidate.surf_description,
              windDescription: candidate.wind_description,
              bestWindow,
              recentIntel,
              ctaUrl,
              unsubscribeUrl,
              baseUrl,
            }),
          });

          console.log(
            `[reengagement-email] Sent to ${candidate.email} for ${candidate.beach_name} (score: ${candidate.conditions_score})`
          );
          summary.sent++;
        } catch (sendError) {
          console.error(
            `[reengagement-email] Failed to send to ${candidate.email}:`,
            sendError
          );
          summary.skipped.sendFailed++;
        }
      } catch (candidateError) {
        console.error(
          `[reengagement-email] Error processing candidate ${candidate.user_id}:`,
          candidateError
        );
        summary.skipped.sendFailed++;
      }
    }

    summary.durationMs = Date.now() - startTime;

    console.log(
      `[reengagement-email] Completed: ${summary.sent} emails sent, ${summary.candidates} candidates, ${summary.durationMs}ms`
    );
    console.log(`   Skipped breakdown:`, summary.skipped);

    return createSuccessResponse({ summary });
  } catch (error) {
    return handleApiError(error);
  }
}
