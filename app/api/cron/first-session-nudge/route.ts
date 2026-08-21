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
import { sendEmail, MAIL_FROM, MAIL_REPLY_TO, getBaseUrl } from "@/lib/mailer/client";
import { FirstSessionNudgeEmail } from "@/lib/mailer/templates/FirstSessionNudgeEmail";
import { PersonalizedNudgeEmail } from "@/lib/mailer/templates/PersonalizedNudgeEmail";
import { formatActionableBestWindow } from "@/lib/email/email-formatters";
import { filterSuppressedRecipients } from "@/lib/email/suppression";
import { createEmailLogger } from "@/lib/services/email-logging-service";
import { createResendRateLimiter } from "@/lib/utils/email-rate-limiter";
import { withObservedCron } from "@/lib/cron/observability";
import { withCronOutcome } from "@/lib/cron/outcome";
import {
  buildAppEmailLink,
  buildBeachEmailLink,
  buildSessionEmailLink,
} from "@/lib/mailer/email-links";
import { buildDailyIntelMajorEventHoldCandidate } from "@/lib/recommendations/major-event-hold/adapters/legacy";
import {
  resolveNotificationMajorEventHold,
  type PositiveRecommendationPolicyContext,
} from "@/lib/recommendations/major-event-hold/adapters/notification";
import { parseMajorEventHoldCandidate } from "@/lib/recommendations/major-event-hold/evaluator";
import { generateEmailUnsubscribeToken } from "@/lib/alerts/email-token";

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
const ABSOLUTE_INSTANT_SUFFIX_PATTERN = /(?:Z|[+-]\d{2}:\d{2})$/;

// ============================================================================
// Type Definitions
// ============================================================================

interface NudgeCandidate {
  user_id: string;
  email: string;
  display_name: string | null;
  home_beach_id: string | null;
  onboarding_completed_at: string | null;
  experience_level: string | null;
}

interface BeachData {
  name: string;
  slug: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  timezone: string | null;
}

interface IntelData {
  forecast_date: string | null;
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

async function recordFirstSessionEmailOutcome(
  result: { summary: RunSummary },
): Promise<{ summary: RunSummary }> {
  return withCronOutcome(
    {
      job: "/api/cron/first-session-nudge",
      unit: "nudges_sent",
      expectedMin: 1,
      getProduced: (value) => value.summary.sent,
      legitimatelyZero: (value) =>
        value.summary.candidates === 0
          ? { reason: "No users were eligible for the day-1 first-session email window" }
          : undefined,
    },
    async () => result,
  );
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
    .select("name, slug, city, state, country, timezone")
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
      .select("forecast_date, conditions_score, surf_description, wind_description, best_window_start, best_window_end")
      .eq("beach_id", beachId)
      .eq("forecast_date", dateStr)
      .order("generated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!error && data) return data as IntelData;
  }
  return null;
}

function buildStartedAt(
  forecastDate: string | null | undefined,
  bestWindowStart: string | null | undefined
): string | undefined {
  if (!forecastDate || !bestWindowStart) return undefined;

  const trimmedStart = bestWindowStart.trim();
  if (trimmedStart.includes("T")) {
    const parsed = new Date(trimmedStart);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
  }

  const timeMatch = trimmedStart.match(/^(\d{2}:\d{2})(?::(\d{2}))?/);
  if (!timeMatch) return undefined;

  const seconds = timeMatch[2] ?? "00";
  const parsed = new Date(`${forecastDate}T${timeMatch[1]}:${seconds}.000Z`);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

function buildPositivePolicyContext(
  beachId: string,
  timezone: string | null | undefined,
  intel: IntelData | null
): PositiveRecommendationPolicyContext | null {
  if (!intel?.best_window_start || !intel.best_window_end) return null;

  const startIsAbsolute = ABSOLUTE_INSTANT_SUFFIX_PATTERN.test(
    intel.best_window_start
  );
  const endIsAbsolute = ABSOLUTE_INSTANT_SUFFIX_PATTERN.test(
    intel.best_window_end
  );
  if (startIsAbsolute !== endIsAbsolute) return null;

  const candidate = startIsAbsolute
    ? parseMajorEventHoldCandidate({
        candidateId: "first-session-email-window",
        beachId,
        startsAt: intel.best_window_start,
        endsAt: intel.best_window_end,
      })
    : timezone && intel.forecast_date
      ? buildDailyIntelMajorEventHoldCandidate(
          {
            id: "first-session-email-window",
            beach_id: beachId,
            forecast_date: intel.forecast_date,
            best_window_start: intel.best_window_start,
            best_window_end: intel.best_window_end,
          },
          timezone
        )
      : null;
  if (!candidate) return null;

  return {
    kind: "positive_session_recommendation",
    beach_id: candidate.beachId,
    starts_at: candidate.startsAt,
    ends_at: candidate.endsAt,
  };
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
      .select("id, display_name, home_beach_id, onboarding_completed_at, experience_level")
      .gte("created_at", signupAfter)
      .lte("created_at", signupBefore);

    if (profilesError) {
      throw new Error(`Failed to query profiles: ${profilesError.message}`);
    }

    if (!windowProfiles || windowProfiles.length === 0) {
      summary.durationMs = Date.now() - startTime;
      console.log(`${CONTEXT_TAG} No users in signup window`);
      return createSuccessResponse(await recordFirstSessionEmailOutcome({ summary }));
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
          experience_level: (p.experience_level as string | null) ?? null,
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
            experience_level: profile?.experience_level ?? null,
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
      return createSuccessResponse(await recordFirstSessionEmailOutcome({ summary }));
    }

    // 5. Send emails
    const rateLimiter = createResendRateLimiter();
    const emailLogger = createEmailLogger(supabase, CONTEXT_TAG);
    const today = new Date().toISOString().slice(0, 10);

    for (const candidate of deliverable) {
      try {
        await rateLimiter.throttle();

        const messageInstanceId = crypto.randomUUID();
        const sessionLinkParams = {
          origin: baseUrl,
          emailType: EMAIL_TYPE,
          messageInstanceId,
          source: "first_session_nudge_email",
          utmCampaign: EMAIL_TYPE,
          params: {
            mode: "log",
            quick: "true",
          },
        };
        const genericLogSessionUrl = buildSessionEmailLink(sessionLinkParams);
        let logSessionUrl = genericLogSessionUrl;
        const settingsUrl = `${baseUrl}/settings`;
        const unsubscribeToken = generateEmailUnsubscribeToken(
          candidate.user_id
        );
        const unsubscribeUrl =
          `${baseUrl}/api/alerts/unsubscribe-email?user_id=${candidate.user_id}` +
          `&token=${unsubscribeToken}`;

        const isOnboarded =
          candidate.home_beach_id !== null &&
          candidate.onboarding_completed_at !== null;

        let subject: string;
        let emailElement: React.ReactElement;
        let emailMeta: Record<string, unknown>;
        let templateType: "personalized" | "generic";

        if (isOnboarded) {
          const beachData = await fetchBeachData(supabase, candidate.home_beach_id!);
          const intelData = beachData
            ? await fetchIntelData(supabase, candidate.home_beach_id!)
            : null;

          const beachName = beachData?.name ?? "your home beach";
          const conditionsScore = intelData?.conditions_score ?? null;
          const startedAt = buildStartedAt(
            intelData?.forecast_date,
            intelData?.best_window_start
          );
          logSessionUrl = buildSessionEmailLink({
            ...sessionLinkParams,
            beachId: candidate.home_beach_id!,
            startedAt,
          });

          subject =
            conditionsScore !== null && conditionsScore >= 70
              ? `${beachName} — conditions are looking good`
              : `${beachName} — check tomorrow's forecast`;

          const ctaUrl = beachData?.slug
            ? buildBeachEmailLink({
                origin: baseUrl,
                beachSlug: beachData.slug,
                emailType: EMAIL_TYPE,
                messageInstanceId,
                source: "first_session_nudge_email",
                utmCampaign: EMAIL_TYPE,
              })
            : buildAppEmailLink({
                origin: baseUrl,
                emailType: EMAIL_TYPE,
                messageInstanceId,
                source: "first_session_nudge_email",
                utmCampaign: EMAIL_TYPE,
              });

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
            unsubscribeUrl: settingsUrl,
          });

          emailMeta = {
            template: "personalized",
            beach_name: beachName,
            conditions_score: conditionsScore,
            signup_window: `${SIGNUP_MIN_HOURS}-${SIGNUP_MAX_HOURS}h`,
            message_instance_id: messageInstanceId,
          };
          templateType = "personalized";

          const policyContext = buildPositivePolicyContext(
            candidate.home_beach_id!,
            beachData?.timezone,
            intelData
          );
          let holdDecision: Awaited<
            ReturnType<typeof resolveNotificationMajorEventHold>
          > | null = null;
          try {
            holdDecision = await resolveNotificationMajorEventHold({
              eventId: `first-session-nudge-email:${candidate.user_id}:${candidate.home_beach_id}`,
              type: "log_session_nudge",
              payload: {
                cohort: "free_home_firing",
                ...(policyContext ? { policy_context: policyContext } : {}),
              },
              profileExperience: candidate.experience_level,
            });
          } catch {
            holdDecision = null;
          }

          if (holdDecision?.status !== "allowed") {
            subject = "Your first forecast is waiting";
            logSessionUrl = genericLogSessionUrl;
            emailElement = React.createElement(FirstSessionNudgeEmail, {
              displayName: candidate.display_name,
              logSessionUrl,
              unsubscribeUrl: settingsUrl,
            });
            emailMeta = {
              template: "generic",
              signup_window: `${SIGNUP_MIN_HOURS}-${SIGNUP_MAX_HOURS}h`,
              message_instance_id: messageInstanceId,
            };
            templateType = "generic";
          }
        } else {
          subject = "Your first forecast is waiting";

          emailElement = React.createElement(FirstSessionNudgeEmail, {
            displayName: candidate.display_name,
            logSessionUrl,
            unsubscribeUrl: settingsUrl,
          });

          emailMeta = {
            template: "generic",
            signup_window: `${SIGNUP_MIN_HOURS}-${SIGNUP_MAX_HOURS}h`,
            message_instance_id: messageInstanceId,
          };
          templateType = "generic";
        }

        const { data: sendData, error: sendError } = await sendEmail({
          from: MAIL_FROM,
          replyTo: MAIL_REPLY_TO,
          to: candidate.email,
          subject,
          react: emailElement,
          unsubscribeUrl,
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

    return createSuccessResponse(await recordFirstSessionEmailOutcome({ summary }));
  } catch (error) {
    return handleApiError(error);
  }
}

export const GET = withObservedCron("/api/cron/first-session-nudge", _GET);
