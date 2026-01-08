/**
 * GET /api/cron/forecast-digest-email
 *
 * Daily cron job: evaluates forecast digest matches and sends personalized email alerts.
 * Runs daily at 14:00 UTC (6 AM Pacific).
 *
 * Multi-gate matching logic:
 * 1. Skill Gate (STRICT) - User skill must meet beach requirement
 * 2. Swell Window Gate - Swell direction must be in optimal window
 * 3. Wind Gate (WARNING) - Assessed but doesn't block
 * 4. Magic Hour Finder - Finds optimal window within 48h
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
import {
  evaluateDigestMatch,
  type UserSurfPreferences,
  type MatchQuality,
} from "@/lib/services/forecast-digest-service";
import { getFreshForecastFromCache } from "@/lib/utils/forecast-service-utils";
import type { EnhancedForecastEntity } from "@/types/forecast";

export const revalidate = 0;
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ============================================================================
// Constants
// ============================================================================

const DEDUPE_WINDOW_HOURS = 20; // Not 24, prevents edge cases
const LOOKAHEAD_HOURS = 48;
const ALERT_TYPE = "daily_digest_email";

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
  durationMs: number;
  skipped: {
    emailDisabled: number;
    alertsDisabled: number;
    missingHomeBeach: number;
    missingEmail: number;
    mockUser: number;
    noMatch: number;
    alreadySentToday: number;
    sendFailed: number;
    staleOrMissingForecast: number;
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

// ============================================================================
// Main Handler
// ============================================================================

export async function GET(request: Request) {
  const startTime = Date.now();

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
      durationMs: 0,
      skipped: {
        emailDisabled: 0,
        alertsDisabled: 0,
        missingHomeBeach: 0,
        missingEmail: 0,
        mockUser: 0,
        noMatch: 0,
        alreadySentToday: 0,
        sendFailed: 0,
        staleOrMissingForecast: 0,
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

        // ⚠️ CRITICAL: If isMatch is false, skip user SILENTLY
        if (!matchResult.isMatch) {
          summary.skipped.noMatch++;
          continue;
        }

        // 6. DEDUPLICATION CHECK (CRITICAL)
        const alreadySent = await checkAlreadySent(user.id, user.home_beach_id);
        if (alreadySent) {
          summary.skipped.alreadySentToday++;
          continue;
        }

        // 7. Query crowd intel from last 24 hours
        const crowdIntel = await fetchCrowdIntel(user.home_beach_id);
        const crowdWarning = crowdIntel || matchResult.crowdWarning;

        // 8. Format forecast data for email
        const forecastData = formatForecastForEmail(forecasts);

        // Build email props
        const matchQualityEmoji = MATCH_EMOJI[matchResult.matchQuality];
        const emailProps = {
          displayName: user.display_name,
          beachName: beach.name,
          beachSlug: beach.slug,
          forecastDate: getForecastDate(),
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
                // windowStart and windowEnd are already formatted strings (e.g., "8:30 AM")
                startTime: matchResult.bestWindow.windowStart,
                endTime: matchResult.bestWindow.windowEnd,
              }
            : null,
          ctaUrl: `${process.env.NEXT_PUBLIC_APP_URL || "https://quiver.fyi"}/beaches/${beach.slug}`,
          unsubscribeUrl: `${process.env.NEXT_PUBLIC_APP_URL || "https://quiver.fyi"}/settings`,
        };

        const emailSubject = `${matchQualityEmoji} ${beach.name}: ${matchResult.matchQuality.charAt(0).toUpperCase() + matchResult.matchQuality.slice(1)} Conditions Today`;

        // 9. Send email via Resend
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

          // 10. Track delivery
          await trackDelivery(user.id, user.home_beach_id);

          summary.sent++;
        } catch (sendError) {
          console.error(
            `❌ [forecast-digest-email] Failed to send email to ${user.email}:`,
            sendError
          );
          summary.skipped.sendFailed++;
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
      `🎉 [forecast-digest-email] Completed: ${summary.sent} sent, ${summary.eligibleUsers} eligible, ${summary.durationMs}ms`
    );
    console.log(`   Skipped breakdown:`, summary.skipped);

    return createSuccessResponse({ summary });
  } catch (error) {
    return handleApiError(error);
  }
}
