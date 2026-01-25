/**
 * GET /api/cron/forecast-digest-email
 *
 * Daily cron job: sends personalized forecast emails to ALL eligible users.
 * Runs daily at 14:00 UTC (6 AM Pacific).
 *
 * Two email variants:
 * - Good day (match): Full digest with conditions, window, and why-text
 * - Bad day (no match): Short "not worth it" email with look-ahead tease
 *
 * Multi-gate matching determines which variant to send:
 * 1. Skill Gate - User skill vs beach requirement
 * 2. Swell Window Gate - Swell direction alignment
 * 3. Wind Gate - Wind conditions assessment
 * 4. Magic Hour Finder - Optimal window within 48h
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
import { ForecastDigestEmail } from "@/lib/mailer/templates/ForecastDigestEmail";
import { ForecastQuickEmail } from "@/lib/mailer/templates/ForecastQuickEmail";
import {
  evaluateDigestMatch,
  type UserSurfPreferences,
  type MatchQuality,
} from "@/lib/services/forecast-digest-service";
import { getFreshForecastFromCache } from "@/lib/utils/forecast-service-utils";
import { sendPushNotification } from "@/lib/services/push-notifications";
import type { EnhancedForecastEntity } from "@/types/forecast";

export const revalidate = 0;
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ============================================================================
// Constants
// ============================================================================

const DEDUPE_WINDOW_HOURS = 20; // Not 24, prevents edge cases
const LOOKAHEAD_HOURS = 48;
const LOOKAHEAD_EXTENDED_HOURS = 168; // 7 days for "look-ahead" in bad-day emails
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
  skill_level: string | null;
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
  sentQuick: number;
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
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Fetch crowd intel from the last 24 hours
 */
async function fetchCrowdIntel(
  beachId: string
): Promise<string | null> {
  const supabase = await createSupabaseServiceRoleClient();

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
 * Check if user already received digest today (within DEDUPE_WINDOW_HOURS)
 */
async function checkAlreadySent(
  userId: string,
  beachId: string
): Promise<boolean> {
  const supabase = await createSupabaseServiceRoleClient();

  const dedupeThreshold = new Date(
    Date.now() - DEDUPE_WINDOW_HOURS * 60 * 60 * 1000
  );

  const { data, error } = await supabase
    .from("forecast_alert_deliveries")
    .select("last_sent_at")
    .eq("user_id", userId)
    .eq("beach_id", beachId)
    .eq("alert_type", ALERT_TYPE)
    .gt("last_sent_at", dedupeThreshold.toISOString())
    .maybeSingle();

  if (error) {
    console.error(`[checkAlreadySent] Error checking delivery for user ${userId}:`, error);
    return false; // Fail open: allow sending on error
  }

  return !!data;
}

/**
 * Track delivery in forecast_alert_deliveries (UPSERT)
 */
async function trackDelivery(userId: string, beachId: string): Promise<void> {
  const supabase = await createSupabaseServiceRoleClient();

  const { error } = await supabase
    .from("forecast_alert_deliveries")
    .upsert(
      {
        user_id: userId,
        beach_id: beachId,
        alert_type: ALERT_TYPE,
        last_sent_at: new Date().toISOString(),
      },
      {
        onConflict: "user_id,beach_id,alert_type",
      }
    );

  if (error) {
    console.error(`[trackDelivery] Error tracking delivery for user ${userId}:`, error);
  }
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
  const tideHeight = firstForecast.tide_height
    ? `${parseFloat(firstForecast.tide_height).toFixed(1)}ft`
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
 * Scan forecast data for the next good surf window within the lookahead period (up to 7 days).
 * Returns a teaser string like "A solid swell is showing for Thursday" or null.
 * Criteria: wave_height >= 3ft AND wind_speed <= 12mph
 */
function findNextGoodWindow(forecasts: EnhancedForecastEntity[]): string | null {
  // Skip the first ~12 hours (today), look at upcoming windows
  const now = new Date();
  const twelveHoursFromNow = new Date(now.getTime() + 12 * 60 * 60 * 1000);

  for (const forecast of forecasts) {
    const forecastTime = new Date(forecast.forecast_time || forecast.created_at);
    if (forecastTime <= twelveHoursFromNow) continue;

    const waveHeight = parseFloat(String(forecast.wave_height || "0"));
    const windSpeed = parseFloat(String(forecast.wind_speed || "99"));

    if (waveHeight >= 3 && windSpeed <= 12) {
      // Found a good window - format the day
      const dayName = forecastTime.toLocaleDateString("en-US", {
        weekday: "long",
        timeZone: "America/Los_Angeles",
      });

      const isNextDay =
        forecastTime.getTime() - now.getTime() < 36 * 60 * 60 * 1000;
      const dayLabel = isNextDay ? "tomorrow" : dayName;

      const heightLabel =
        waveHeight >= 5
          ? "A solid swell"
          : waveHeight >= 4
            ? "A nice pulse"
            : "Some rideable waves";

      return `${heightLabel} is showing for ${dayLabel}. We'll let you know.`;
    }
  }

  return null;
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
  runStartedAt: Date,
  summary: DigestRunSummary,
  status: 'completed' | 'failed'
): Promise<void> {
  try {
    const supabase = await createSupabaseServiceRoleClient();

    await supabase.from("digest_run_stats").insert({
      run_started_at: runStartedAt.toISOString(),
      run_completed_at: new Date().toISOString(),
      status,
      eligible_users: summary.eligibleUsers,
      emails_sent: summary.sent,
      emails_sent_quick: summary.sentQuick,
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
 * Send a push notification for digest email and track the result in summary.
 * Handles errors gracefully, updates push metrics, and logs to push_notification_log.
 */
async function sendDigestPush(
  userId: string,
  userEmail: string,
  title: string,
  body: string,
  data: Record<string, string>,
  summary: DigestRunSummary
): Promise<void> {
  const supabase = await createSupabaseServiceRoleClient();
  let pushResult = { success: 0, failed: 0 };
  let status: 'sent' | 'failed' | 'no_token' = 'sent';
  let errorMessage: string | null = null;

  try {
    pushResult = await sendPushNotification({
      userIds: [userId],
      title,
      body,
      data,
    });

    // Determine status based on result
    if (pushResult.success > 0) {
      status = 'sent';
    } else if (pushResult.failed > 0) {
      status = 'failed';
      errorMessage = 'FCM send failed';
    } else {
      status = 'no_token';
    }
  } catch (pushError) {
    console.error(
      `❌ [forecast-digest-email] Push notification failed for ${userEmail}:`,
      pushError
    );
    pushResult = { success: 0, failed: 1 };
    status = 'failed';
    errorMessage = pushError instanceof Error ? pushError.message : 'Unknown error';
  }

  // Log to push_notification_log table
  try {
    await supabase.from('push_notification_log').insert({
      user_id: userId,
      notification_type: 'daily_digest',
      title,
      body,
      status,
      beach_id: data.beach_id || null,
      data,
      error_message: errorMessage,
    });
  } catch (logError) {
    console.error('❌ [forecast-digest-email] Failed to log push notification:', logError);
    // Don't fail the push send because logging failed
  }

  // Track push result in summary
  if (pushResult.success > 0) {
    summary.pushSent++;
  } else if (pushResult.failed > 0) {
    summary.skipped.pushFailed++;
  } else {
    summary.skipped.noPushDeviceTokens++;
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
      sentQuick: 0,
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
        skill_level,
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
          user.skill_level,
          userPrefs
        );

        // 6. DEDUPLICATION CHECK (CRITICAL)
        const alreadySent = await checkAlreadySent(user.id, user.home_beach_id);
        if (alreadySent) {
          summary.skipped.alreadySentToday++;
          continue;
        }

        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://quiver.fyi";
        const ctaUrl = `${baseUrl}/beaches/${beach.slug}`;
        const unsubscribeUrl = `${baseUrl}/settings`;
        const forecastDate = getForecastDate();

        // 7. Branch: good day (match) vs bad day (no match)
        if (matchResult.isMatch) {
          // GOOD DAY: Send full digest email
          const crowdIntel = await fetchCrowdIntel(user.home_beach_id);
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

          try {
            await resend.emails.send({
              from: MAIL_FROM,
              replyTo: MAIL_REPLY_TO,
              to: user.email,
              subject: emailSubject,
              react: ForecastDigestEmail(emailProps),
            });

            console.log(
              `✅ [forecast-digest-email] Sent digest to ${user.email} for ${beach.name} (${matchResult.matchQuality})`
            );
            await trackDelivery(user.id, user.home_beach_id);
            summary.sent++;

            // Send push notification
            const matchQualityCapitalized = capitalizeFirst(matchResult.matchQuality);
            const pushBody = matchResult.bestWindow
              ? `${matchQualityCapitalized} conditions ${matchResult.bestWindow.windowStart}-${matchResult.bestWindow.windowEnd}`
              : `${matchQualityCapitalized} conditions today`;

            await sendDigestPush(
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
          } catch (sendError) {
            console.error(
              `❌ [forecast-digest-email] Failed to send email to ${user.email}:`,
              sendError
            );
            summary.skipped.sendFailed++;
          }
        } else {
          // BAD DAY: Send short "not worth it" email with look-ahead
          const forecastData = formatForecastForEmail(forecasts);

          // Fetch extended 7-day forecast for look-ahead teaser
          const { forecasts: extendedForecasts } = await getFreshForecastFromCache(
            user.home_beach_id,
            LOOKAHEAD_EXTENDED_HOURS
          );
          const lookAheadText = findNextGoodWindow(
            extendedForecasts.length > 0 ? extendedForecasts : forecasts
          );

          const quickEmailProps = {
            displayName: user.display_name,
            beachName: beach.name,
            beachSlug: beach.slug,
            forecastDate,
            waveHeight: forecastData.waveHeight,
            windSpeed: forecastData.windSpeed,
            windDirection: forecastData.windDirection,
            lookAheadText,
            ctaUrl,
            unsubscribeUrl,
          };

          const emailSubject = `${beach.name}: Not worth it today`;

          try {
            await resend.emails.send({
              from: MAIL_FROM,
              replyTo: MAIL_REPLY_TO,
              to: user.email,
              subject: emailSubject,
              react: ForecastQuickEmail(quickEmailProps),
            });

            console.log(
              `✅ [forecast-digest-email] Sent quick digest to ${user.email} for ${beach.name} (no match)`
            );
            await trackDelivery(user.id, user.home_beach_id);
            summary.sentQuick++;

            // Send push notification
            const pushBody = lookAheadText
              ? `Not worth it today. ${lookAheadText.split(".")[0]}.`
              : `Not worth it today at ${beach.name}.`;

            await sendDigestPush(
              user.id,
              user.email,
              beach.name,
              pushBody,
              {
                type: "daily_digest",
                beach_id: user.home_beach_id,
                beach_slug: beach.slug,
                match_quality: "no_match",
                url: `/beaches/${beach.slug}`,
              },
              summary
            );
          } catch (sendError) {
            console.error(
              `❌ [forecast-digest-email] Failed to send quick email to ${user.email}:`,
              sendError
            );
            summary.skipped.sendFailed++;
          }
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
      `🎉 [forecast-digest-email] Completed: ${summary.sent} full + ${summary.sentQuick} quick emails, ${summary.pushSent} push notifications, ${summary.eligibleUsers} eligible, ${summary.durationMs}ms`
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
    await persistRunStats(runStartedAt, summary, 'completed');

    return createSuccessResponse({ summary });
  } catch (error) {
    return handleApiError(error);
  }
}
