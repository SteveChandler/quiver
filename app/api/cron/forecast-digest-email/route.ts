/**
 * GET /api/cron/forecast-digest-email
 *
 * Mon/Thu cron job: sends personalized forecast emails to eligible users
 * ONLY when conditions match their preferences.
 *
 * Runs Mon & Thu at 14:00 UTC (6 AM Pacific).
 *
 * Multi-gate matching determines eligibility:
 * 1. Skill Gate - User skill vs beach requirement
 * 2. Swell Window Gate - Swell direction alignment
 * 3. Wind Gate - Wind conditions assessment
 * 4. Magic Hour Finder - Optimal window within 48h
 *
 * Users with no match are skipped (no "bad day" emails).
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
import { createResendRateLimiter } from "@/lib/utils/email-rate-limiter";
import { createEmailLogger } from "@/lib/services/email-logging-service";
import { ForecastDigestEmail } from "@/lib/mailer/templates/ForecastDigestEmail";
import {
  evaluateDigestMatch,
  type UserSurfPreferences,
  type MatchQuality,
} from "@/lib/services/forecast-digest-service";
import { getFreshForecastFromCache } from "@/lib/utils/forecast-service-utils";
import { enqueueNotification } from "@/lib/notifications/enqueue";
import type { EnhancedForecastEntity } from "@/types/forecast";

export const revalidate = 0;
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ============================================================================
// Constants
// ============================================================================

const DEDUPE_WINDOW_HOURS = 72; // 3 days to match Mon/Thu schedule
const LOOKAHEAD_HOURS = 48;
const ALERT_TYPE = "daily_digest_email";

// Push notification failure thresholds for alerting
// Alert on high push failure rates to detect infrastructure issues early
const PUSH_FAILURE_RATE_THRESHOLD = 0.5; // 50% - alert if half or more pushes fail
const PUSH_FAILURE_MIN_USERS = 10; // Minimum users to evaluate failure rate (avoid false alarms on low volumes)

// Match quality to emoji mapping
const MATCH_EMOJI: Record<MatchQuality, string> = {
  perfect: "🔥",
  excellent: "✨",
  good: "👍",
  fair: "🌊",
  no_match: "",
};

// ============================================================================
// Type Definitions
// ============================================================================

interface EligibleUser {
  id: string;
  email: string;
  display_name: string | null;
  home_beach_id: string;
  experience_level: string | null;
  wave_min_ft: number | null;
  wave_max_ft: number | null;
  max_wind_mph: number | null;
  preferred_tide_statuses: string[] | null;
  beach_name: string;
  beach_slug: string;
  beach_skill_level: string | null;
  beach_swell_window_center_deg: number | null;
  beach_swell_window_halfwidth_deg: number | null;
  beach_wind_offshore_deg: number | null;
  beach_wind_offshore_tol_deg: number | null;
  beach_tide_min_ft: number | null;
  beach_tide_max_ft: number | null;
}

interface DigestRunSummary {
  eligibleUsers: number;
  sent: number;
  pushSent: number;
  durationMs: number;
  skipped: {
    emailDisabled: number;
    alertsDisabled: number;
    missingHomeBeach: number;
    missingEmail: number;
    mockUser: number;
    alreadySentToday: number;
    sendFailed: number;
    staleOrMissingForecast: number;
    pushFailed: number;
    noPushDeviceTokens: number;
    noMatch: number;
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Fetch crowd intel from the last 24 hours
 */
async function fetchCrowdIntel(
  supabase: SupabaseClient,
  beachId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from("intel_posts")
    .select("description")
    .eq("beach_id", beachId)
    .eq("tag", "crowd")
    .eq("is_active", true)
    .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data.description;
}

/**
 * Atomically claim a delivery slot using RPC function with row-level locking.
 * This prevents race conditions where concurrent cron instances could both pass
 * a check and send duplicate emails.
 *
 * Returns true if the slot was claimed (proceed with sending), false if already sent.
 */
async function claimDeliverySlot(
  supabase: SupabaseClient,
  userId: string,
  beachId: string
): Promise<boolean> {
  const { data: claimed, error } = await supabase.rpc(
    'claim_forecast_delivery_slot',
    {
      p_user_id: userId,
      p_beach_id: beachId,
      p_alert_type: ALERT_TYPE,
      p_dedupe_hours: DEDUPE_WINDOW_HOURS
    }
  );

  if (error) {
    console.error(`[claimDeliverySlot] Error claiming slot for user ${userId}:`, error);
    // Fail open: allow sending on error (matches previous behavior)
    return true;
  }

  return claimed === true;
}

/**
 * Format forecast data for email template
 */
function formatForecastForEmail(forecasts: EnhancedForecastEntity[]) {
  // Get first forecast with data
  const firstForecast = forecasts.find(
    (f) =>
      f.wave_height !== null &&
      f.wave_period !== null &&
      f.wind_speed !== null &&
      f.wind_direction_deg !== null
  );

  if (!firstForecast) {
    return {
      waveHeight: "N/A",
      wavePeriod: "N/A",
      windSpeed: "N/A",
      windDirection: "N/A",
      tideStatus: "N/A",
    };
  }

  const waveHeight = firstForecast.wave_height || "N/A";
  const wavePeriod = firstForecast.wave_period ? `${firstForecast.wave_period}s` : "N/A";
  const windSpeed = firstForecast.wind_speed
    ? `${Math.round(parseFloat(firstForecast.wind_speed))}mph`
    : "N/A";

  // Format wind direction
  const windDeg = firstForecast.wind_direction_deg ?? 0;
  const windCardinal = degreesToCardinal(windDeg);
  const windDirection = `${windCardinal}`;

  // Format tide status
  const parsedTide = parseFloat(firstForecast.tide_height || "");
  const tideHeight = Number.isFinite(parsedTide)
    ? `${parsedTide.toFixed(1)}ft`
    : "N/A";
  const tideStatus = firstForecast.tide_status
    ? `${tideHeight}, ${firstForecast.tide_status}`
    : tideHeight;

  return {
    waveHeight,
    wavePeriod,
    windSpeed,
    windDirection,
    tideStatus,
  };
}

/**
 * Convert degrees to cardinal direction
 */
function degreesToCardinal(degrees: number): string {
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  const index = Math.round(degrees / 45) % 8;
  return dirs[index];
}

/**
 * Format time for email display
 */
function formatTimeForEmail(date: Date): string {
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Los_Angeles",
  });
}

/**
 * Get forecast date for email header
 */
function getForecastDate(): string {
  const today = new Date();
  return today.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "America/Los_Angeles",
  });
}

/**
 * Capitalize the first letter of a string
 */
function capitalizeFirst(str: string): string {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Persist digest run statistics to the database
 */
async function persistRunStats(
  supabase: SupabaseClient,
  runStartedAt: Date,
  summary: DigestRunSummary,
  status: 'completed' | 'failed'
): Promise<void> {
  try {
    await supabase.from("digest_run_stats").insert({
      run_started_at: runStartedAt.toISOString(),
      run_completed_at: new Date().toISOString(),
      status,
      eligible_users: summary.eligibleUsers,
      emails_sent: summary.sent,
      emails_sent_quick: 0, // Deprecated: bad day emails removed
      push_sent: summary.pushSent,
      push_failed: summary.skipped.pushFailed,
      push_no_tokens: summary.skipped.noPushDeviceTokens,
      skipped: summary.skipped,
      duration_ms: summary.durationMs,
    });
  } catch (error) {
    console.error("❌ [forecast-digest-email] Failed to persist run stats:", error);
    // Don't throw - stats persistence failure shouldn't fail the cron
  }
}

/**
 * Phase 3e: enqueue a daily_digest notification event. The
 * notifications-deliver worker handles devices, FCM, retries, prefs, and
 * the per-channel notification_delivery_attempts log. The legacy
 * push_notification_log writes are dropped as part of this migration.
 */
async function sendDigestPush(
  _supabase: SupabaseClient,
  userId: string,
  userEmail: string,
  title: string,
  body: string,
  data: Record<string, string>,
  summary: DigestRunSummary
): Promise<void> {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const enqueueResult = await enqueueNotification({
      type: "daily_digest",
      recipientUserId: userId,
      entityType: data.beach_id ? "beach" : null,
      entityId: data.beach_id || null,
      payload: {
        alert_date: today,
        title,
        body,
      },
      dedupeKey: `daily_digest:${userId}:${today}`,
    });

    if (enqueueResult.enqueued) {
      summary.pushSent++;
    } else if (enqueueResult.reason === "duplicate") {
      // Same-day re-run — already enqueued.
      summary.skipped.pushFailed++;
    } else {
      console.error(
        `❌ [forecast-digest-email] Enqueue failed for ${userEmail}:`,
        enqueueResult
      );
      summary.skipped.pushFailed++;
    }
  } catch (err) {
    console.error(
      `❌ [forecast-digest-email] Enqueue threw for ${userEmail}:`,
      err
    );
    summary.skipped.pushFailed++;
  }
}

// ============================================================================
// Main Handler
// ============================================================================

export async function GET(request: Request) {
  const runStartedAt = new Date();
  const startTime = runStartedAt.getTime();

  try {
    // 1. Validate cron auth
    if (!validateCronRequest(request)) {
      return createErrorResponse("Unauthorized", "Invalid cron authentication", 401);
    }

    console.log("🔔 [forecast-digest-email] Starting daily digest email run");

    const supabase = await createSupabaseServiceRoleClient();

    // Initialize summary tracking
    const summary: DigestRunSummary = {
      eligibleUsers: 0,
      sent: 0,
      pushSent: 0,
      durationMs: 0,
      skipped: {
        emailDisabled: 0,
        alertsDisabled: 0,
        missingHomeBeach: 0,
        missingEmail: 0,
        mockUser: 0,
        alreadySentToday: 0,
        sendFailed: 0,
        staleOrMissingForecast: 0,
        pushFailed: 0,
        noPushDeviceTokens: 0,
        noMatch: 0,
      },
    };

    // 2. Query eligible users with JOIN
    const { data: users, error: usersError } = await supabase
      .from("profiles")
      .select(
        `
        id,
        email,
        display_name,
        home_beach_id,
        experience_level,
        is_mock,
        notif_email_enabled,
        notif_forecast_alerts,
        user_surf_preferences (
          wave_min_ft,
          wave_max_ft,
          max_wind_mph,
          preferred_tide_statuses
        ),
        beaches!profiles_home_beach_id_fkey (
          id,
          name,
          slug,
          skill_level,
          swell_window_center_deg,
          swell_window_halfwidth_deg,
          wind_offshore_deg,
          wind_offshore_tol_deg,
          tide_min_ft,
          tide_max_ft
        )
      `
      )
      .eq("notif_email_enabled", true)
      .eq("notif_forecast_alerts", true)
      .eq("is_mock", false)
      .not("home_beach_id", "is", null)
      .not("email", "is", null);

    if (usersError) {
      throw new Error(`Failed to fetch eligible users: ${usersError.message}`);
    }

    console.log(`📧 [forecast-digest-email] Found ${users?.length ?? 0} eligible users`);

    if (!users || users.length === 0) {
      summary.durationMs = Date.now() - startTime;
      return createSuccessResponse({ summary });
    }

    summary.eligibleUsers = users.length;

    // Initialize rate limiter for Resend API
    const rateLimiter = createResendRateLimiter();
    const emailLogger = createEmailLogger(supabase, "[forecast-digest-email]");

    // 3. Process each user
    for (const user of users) {
      try {
        // Skip if missing email (should not happen due to query filter)
        if (!user.email) {
          summary.skipped.missingEmail++;
          continue;
        }

        // Skip if missing home beach (should not happen due to query filter)
        if (!user.home_beach_id || !user.beaches) {
          summary.skipped.missingHomeBeach++;
          continue;
        }

        const beach = Array.isArray(user.beaches) ? user.beaches[0] : user.beaches;
        if (!beach) {
          summary.skipped.missingHomeBeach++;
          continue;
        }

        // 4. Fetch today's forecast for their home beach
        const { forecasts, metadata } = await getFreshForecastFromCache(
          user.home_beach_id,
          LOOKAHEAD_HOURS
        );

        if (metadata.stale || metadata.missing || forecasts.length === 0) {
          console.warn(
            `⚠️ [forecast-digest-email] Stale/missing forecast for user ${user.id}, beach ${beach.name}: ${metadata.reason}`
          );
          summary.skipped.staleOrMissingForecast++;
          continue;
        }

        // 5. Evaluate match using multi-gate logic
        const userPrefs: UserSurfPreferences | null = user.user_surf_preferences
          ? Array.isArray(user.user_surf_preferences)
            ? user.user_surf_preferences[0]
            : user.user_surf_preferences
          : null;

        const beachMetadata = {
          id: beach.id,
          name: beach.name,
          slug: beach.slug,
          skill_level: beach.skill_level,
          swell_window_center_deg: beach.swell_window_center_deg,
          swell_window_halfwidth_deg: beach.swell_window_halfwidth_deg,
          wind_offshore_deg: beach.wind_offshore_deg,
          wind_offshore_tol_deg: beach.wind_offshore_tol_deg,
          preferred_tide_ft_min: beach.tide_min_ft,
          preferred_tide_ft_max: beach.tide_max_ft,
        };

        const matchResult = evaluateDigestMatch(
          forecasts,
          beachMetadata,
          user.experience_level,
          userPrefs
        );

        // 6. ATOMIC DEDUPLICATION (CRITICAL)
        // Use RPC with row-level locking to prevent race conditions.
        // This atomically checks AND claims the slot in one operation.
        const claimed = await claimDeliverySlot(supabase, user.id, user.home_beach_id);
        if (!claimed) {
          summary.skipped.alreadySentToday++;
          continue;
        }

        const baseUrl = getBaseUrl();
        const ctaUrl = `${baseUrl}/beaches/${beach.slug}`;
        const unsubscribeUrl = `${baseUrl}/settings`;
        const forecastDate = getForecastDate();

        // 7. Branch: good day (match) vs bad day (no match)
        if (matchResult.isMatch) {
          // GOOD DAY: Send full digest email
          const crowdIntel = await fetchCrowdIntel(supabase, user.home_beach_id);
          const crowdWarning = crowdIntel || matchResult.crowdWarning;
          const forecastData = formatForecastForEmail(forecasts);

          const matchQualityEmoji = MATCH_EMOJI[matchResult.matchQuality];
          const emailProps = {
            displayName: user.display_name,
            beachName: beach.name,
            beachSlug: beach.slug,
            forecastDate,
            matchQuality: matchResult.matchQuality as "perfect" | "excellent" | "good" | "fair",
            waveHeight: forecastData.waveHeight,
            wavePeriod: forecastData.wavePeriod,
            windSpeed: forecastData.windSpeed,
            windDirection: forecastData.windDirection,
            tideStatus: forecastData.tideStatus,
            whyText: matchResult.whyText,
            crowdWarning,
            bestWindow: matchResult.bestWindow
              ? {
                  startTime: matchResult.bestWindow.windowStart,
                  endTime: matchResult.bestWindow.windowEnd,
                }
              : null,
            ctaUrl,
            unsubscribeUrl,
          };

          const emailSubject = `${matchQualityEmoji} ${beach.name}: ${capitalizeFirst(matchResult.matchQuality)} Conditions Today`;

          // Rate limit before sending
          await rateLimiter.throttle();

          const { data: sendData, error: sendError } = await resend.emails.send({
            from: MAIL_FROM,
            replyTo: MAIL_REPLY_TO,
            to: user.email,
            subject: emailSubject,
            react: ForecastDigestEmail(emailProps),
          });

          if (sendError) {
            console.error(
              `❌ [forecast-digest-email] Failed to send email to ${user.email}:`,
              sendError
            );
            summary.skipped.sendFailed++;
            continue;
          }

          console.log(
            `✅ [forecast-digest-email] Sent digest to ${user.email} for ${beach.name} (${matchResult.matchQuality})`
          );
          // Note: Delivery slot already tracked atomically by claimDeliverySlot()
          summary.sent++;

          // Log to email_send_log for tracking (includes Resend message ID)
          await emailLogger.logDelivery({
            userId: user.id,
            emailType: "forecast_digest",
            subject: emailSubject,
            resendMessageId: sendData?.id,
            bestBeachId: user.home_beach_id,
            meta: {
              beach_name: beach.name,
              match_quality: matchResult.matchQuality,
            },
          });

          // Send push notification
          const matchQualityCapitalized = capitalizeFirst(matchResult.matchQuality);
          const pushBody = matchResult.bestWindow
            ? `${matchQualityCapitalized} conditions ${matchResult.bestWindow.windowStart}-${matchResult.bestWindow.windowEnd}`
            : `${matchQualityCapitalized} conditions today`;

          await sendDigestPush(
            supabase,
            user.id,
            user.email,
            `${matchQualityEmoji} ${beach.name}`,
            pushBody,
            {
              type: "daily_digest",
              beach_id: user.home_beach_id,
              beach_slug: beach.slug,
              match_quality: matchResult.matchQuality,
              url: `/beaches/${beach.slug}`,
            },
            summary
          );
        } else {
          // NO MATCH: Skip entirely - no more "bad day" emails
          console.log(
            `⏭️ [forecast-digest-email] Skipping ${user.email} for ${beach.name} - no match`
          );
          summary.skipped.noMatch++;
          continue;
        }
      } catch (userError) {
        console.error(
          `❌ [forecast-digest-email] Error processing user ${user.id}:`,
          userError
        );
        summary.skipped.sendFailed++;
      }
    }

    summary.durationMs = Date.now() - startTime;

    console.log(
      `🎉 [forecast-digest-email] Completed: ${summary.sent} emails sent, ${summary.skipped.noMatch} skipped (no match), ${summary.pushSent} push notifications, ${summary.eligibleUsers} eligible, ${summary.durationMs}ms`
    );
    console.log(`   Skipped breakdown:`, summary.skipped);

    // Alert on high push failure rate
    const totalPushAttempts = summary.pushSent + summary.skipped.pushFailed;
    if (totalPushAttempts > 0) {
      const pushFailureRate = summary.skipped.pushFailed / totalPushAttempts;
      if (pushFailureRate > PUSH_FAILURE_RATE_THRESHOLD && summary.eligibleUsers > PUSH_FAILURE_MIN_USERS) {
        console.error(
          `🚨 [forecast-digest-email] HIGH PUSH FAILURE RATE: ${(pushFailureRate * 100).toFixed(1)}% (${summary.skipped.pushFailed}/${totalPushAttempts})`
        );
      }
    }

    // Persist run stats to database
    await persistRunStats(supabase, runStartedAt, summary, 'completed');

    return createSuccessResponse({ summary });
  } catch (error) {
    return handleApiError(error);
  }
}
