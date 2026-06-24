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
 * - Authorization: Bearer <CRON_SECRET>
 */

import * as React from "react";
import {
  createErrorResponse,
  createSuccessResponse,
  handleApiError,
  validateCronRequest,
} from "@/lib/middleware/api-wrappers";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { resend, MAIL_FROM, MAIL_REPLY_TO, getBaseUrl } from "@/lib/mailer/client";
import { FirstSessionNudgeEmail } from "@/lib/mailer/templates/FirstSessionNudgeEmail";
import { PersonalizedNudgeEmail } from "@/lib/mailer/templates/PersonalizedNudgeEmail";
import { buildBeachUrl } from "@/lib/utils/beach-url-utils";
import { formatActionableBestWindow } from "@/lib/email/email-formatters";
import { filterSuppressedRecipients } from "@/lib/email/suppression";
import { createEmailLogger } from "@/lib/services/email-logging-service";
import { createResendRateLimiter } from "@/lib/utils/email-rate-limiter";
import { withObservedCron } from "@/lib/cron/observability";

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
  home_beach_id: string | null;
  onboarding_completed_at: string | null;
}

interface BeachData {
  name: string;
  slug: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
}

interface IntelData {
  conditions_score: number | null;
  surf_description: string | null;
  wind_description: string | null;
  best_window_start: string | null;
  best_window_end: string | null;
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
// Helper Functions
// ============================================================================

async function fetchBeachData(
  supabase: ReturnType<typeof createSupabaseServiceRoleClient>,
  beachId: string
): Promise<BeachData | null> {
  const { data, error } = await supabase
    .from("beaches")
    .select("name, slug, city, state, country")
    .eq("id", beachId)
    .single();
  if (error || !data) return null;
  return data as BeachData;
}

async function fetchIntelData(
  supabase: ReturnType<typeof createSupabaseServiceRoleClient>,
  beachId: string
): Promise<IntelData | null> {
  const now = new Date();
  const pacificNow = new Date(
    now.toLocaleString("en-US", { timeZone: "America/Los_Angeles" })
  );
  const tomorrow = new Date(pacificNow);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().slice(0, 10);
  const todayStr = pacificNow.toISOString().slice(0, 10);

  for (const dateStr of [tomorrowStr, todayStr]) {
    const { data, error } = await supabase
      .from("beach_daily_intel")
      .select("conditions_score, surf_description, wind_description, best_window_start, best_window_end")
      .eq("beach_id", beachId)
      .eq("forecast_date", dateStr)
      .order("generated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!error && data) return data as IntelData;
  }
  return null;
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
      .select("id, display_name, home_beach_id, onboarding_completed_at")
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
      windowProfiles.map((p) => [
        p.id,
        {
          display_name: p.display_name as string | null,
          home_beach_id: p.home_beach_id as string | null,
          onboarding_completed_at: p.onboarding_completed_at as string | null,
        },
      ])
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
          const profile = profileMap.get(userId);
          candidates.push({
            user_id: userId,
            email: authUser.user.email,
            display_name: profile?.display_name ?? null,
            home_beach_id: profile?.home_beach_id ?? null,
            onboarding_completed_at: profile?.onboarding_completed_at ?? null,
          });
        }
      }
    }

    const deliverable = await filterSuppressedRecipients(supabase, candidates);
    const suppressedCount = candidates.length - deliverable.length;

    summary.candidates = deliverable.length;
    console.log(
      `${CONTEXT_TAG} Found ${deliverable.length} deliverable candidates (${candidates.length} built, ${suppressedCount} suppressed, ${windowProfiles.length} in window, ${userIdsWithSessions.size} with sessions, ${userIdsWithNudge.size} already nudged)`
    );

    if (deliverable.length === 0) {
      summary.durationMs = Date.now() - startTime;
      return createSuccessResponse({ summary });
    }

    // 5. Send emails
    const rateLimiter = createResendRateLimiter();
    const emailLogger = createEmailLogger(supabase, CONTEXT_TAG);
    const today = new Date().toISOString().slice(0, 10);

    for (const candidate of deliverable) {
      try {
        await rateLimiter.throttle();

        const logSessionUrl = `${baseUrl}/sessions/new?mode=log&quick=true&utm_source=quiver&utm_medium=email&utm_campaign=first_session_nudge`;
        const unsubscribeUrl = `${baseUrl}/settings`;

        const isOnboarded =
          candidate.home_beach_id !== null &&
          candidate.onboarding_completed_at !== null;

        let subject: string;
        let emailElement: React.ReactElement;
        let emailMeta: Record<string, unknown>;

        if (isOnboarded) {
          const beachData = await fetchBeachData(supabase, candidate.home_beach_id!);
          const intelData = beachData
            ? await fetchIntelData(supabase, candidate.home_beach_id!)
            : null;

          const beachName = beachData?.name ?? "your home beach";
          const conditionsScore = intelData?.conditions_score ?? null;

          subject =
            conditionsScore !== null && conditionsScore >= 70
              ? `✨ ${beachName} — conditions are looking good`
              : `${beachName} — check tomorrow's forecast`;

          const beachPath = beachData
            ? buildBeachUrl({
                slug: beachData.slug,
                city: beachData.city,
                state: beachData.state,
                country: beachData.country,
              })
            : null;
          const ctaUrl = beachPath
            ? `${baseUrl}${beachPath}?utm_source=quiver&utm_medium=email&utm_campaign=first_session_nudge`
            : `${baseUrl}?utm_source=quiver&utm_medium=email&utm_campaign=first_session_nudge`;

          const bestWindow = formatActionableBestWindow(
            intelData?.best_window_start ?? null,
            intelData?.best_window_end ?? null
          );

          emailElement = React.createElement(PersonalizedNudgeEmail, {
            displayName: candidate.display_name,
            beachName,
            conditionsScore,
            surfDescription: intelData?.surf_description ?? null,
            windDescription: intelData?.wind_description ?? null,
            bestWindow,
            ctaUrl,
            logSessionUrl,
            unsubscribeUrl,
          });

          emailMeta = {
            template: "personalized",
            beach_name: beachName,
            conditions_score: conditionsScore,
            signup_window: `${SIGNUP_MIN_HOURS}-${SIGNUP_MAX_HOURS}h`,
          };
        } else {
          subject = "Your first forecast is waiting";

          emailElement = React.createElement(FirstSessionNudgeEmail, {
            displayName: candidate.display_name,
            logSessionUrl,
            unsubscribeUrl,
          });

          emailMeta = {
            template: "generic",
            signup_window: `${SIGNUP_MIN_HOURS}-${SIGNUP_MAX_HOURS}h`,
          };
        }

        const { data: sendData, error: sendError } = await resend.emails.send({
          from: MAIL_FROM,
          replyTo: MAIL_REPLY_TO,
          to: candidate.email,
          subject,
          react: emailElement,
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
          meta: emailMeta,
        });

        if (!logResult.success) {
          summary.skipped.logFailed++;
        }

        summary.sent++;
        const templateType = isOnboarded ? "personalized" : "generic";
        console.log(
          `${CONTEXT_TAG} Sent ${templateType} to user ${candidate.user_id}`
        );
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

export const GET = withObservedCron("/api/cron/first-session-nudge", _GET);
