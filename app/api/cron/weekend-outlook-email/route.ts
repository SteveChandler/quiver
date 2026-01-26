/**
 * GET /api/cron/weekend-outlook-email
 *
 * Thursday cron job: sends weekend forecast outlook to "weekend warrior" users.
 * Only targets users with pref_time_bucket='weekends' in user_email_prefs.
 *
 * Runs Thursdays at 21:00 UTC (1 PM Pacific / 4 PM Eastern).
 *
 * Provides a 3-day preview (Friday, Saturday, Sunday) with:
 * - Condition rating (Good/Fair/Poor) based on match quality
 * - Wave height and wind summary
 * - Best window for each day
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
import { WeekendOutlookEmail } from "@/lib/mailer/templates/WeekendOutlookEmail";
import {
  evaluateDigestMatch,
  type UserSurfPreferences,
  type MatchQuality,
} from "@/lib/services/forecast-digest-service";
import { getFreshForecastFromCache } from "@/lib/utils/forecast-service-utils";
import { addDays, format, startOfDay } from "date-fns";
import type { EnhancedForecastEntity } from "@/types/forecast";

export const revalidate = 0;
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutes for processing all users

// ============================================================================
// Constants
// ============================================================================

const DEDUPE_WINDOW_HOURS = 144; // 6 days - only send once per week
const LOOKAHEAD_HOURS = 96; // 4 days of forecast data (Thu -> Sun)
const ALERT_TYPE = "weekend_outlook";

// ============================================================================
// Type Definitions
// ============================================================================

interface WeekendUser {
  id: string;
  email: string;
  display_name: string | null;
  home_beach_id: string;
  skill_level: string | null;
  beach_name: string;
  beach_slug: string;
  beach_skill_level: string | null;
  beach_swell_window_center_deg: number | null;
  beach_swell_window_halfwidth_deg: number | null;
  beach_wind_offshore_deg: number | null;
  beach_wind_offshore_tol_deg: number | null;
  beach_tide_min_ft: number | null;
  beach_tide_max_ft: number | null;
  user_surf_preferences: UserSurfPreferences | null;
}

interface DayForecast {
  dayName: string;
  date: string;
  condition: "Good" | "Fair" | "Poor";
  waveHeight: string;
  wind: string;
  bestWindow: string;
}

interface RunSummary {
  eligibleUsers: number;
  sent: number;
  durationMs: number;
  skipped: {
    noHomeBeach: number;
    noEmail: number;
    alreadySentThisWeek: number;
    staleOrMissingForecast: number;
    sendFailed: number;
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if user already received weekend outlook this week
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
    console.error(`[weekend-outlook] Error checking delivery for ${userId}:`, error);
    return false; // Fail open
  }

  return !!data;
}

/**
 * Track delivery in forecast_alert_deliveries
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
      { onConflict: "user_id,beach_id,alert_type" }
    );

  if (error) {
    console.error(`[weekend-outlook] Error tracking delivery for ${userId}:`, error);
  }
}

/**
 * Map match quality to condition label
 */
function matchQualityToCondition(quality: MatchQuality): "Good" | "Fair" | "Poor" {
  switch (quality) {
    case "perfect":
    case "excellent":
    case "good":
      return "Good";
    case "fair":
      return "Fair";
    case "no_match":
    default:
      return "Poor";
  }
}

/**
 * Get forecasts for a specific day from the forecast array
 */
function getForecastsForDay(
  forecasts: EnhancedForecastEntity[],
  targetDate: Date
): EnhancedForecastEntity[] {
  const dayStart = startOfDay(targetDate).getTime();
  const dayEnd = dayStart + 24 * 60 * 60 * 1000;

  return forecasts.filter((f) => {
    const forecastTime = new Date(f.forecast_time || f.created_at).getTime();
    return forecastTime >= dayStart && forecastTime < dayEnd;
  });
}

/**
 * Format forecast data for a single day
 */
function formatDayForecast(
  forecasts: EnhancedForecastEntity[],
  targetDate: Date,
  beachMetadata: any,
  userSkillLevel: string | null,
  userPrefs: UserSurfPreferences | null
): DayForecast {
  const dayForecasts = getForecastsForDay(forecasts, targetDate);

  // Default values if no forecasts for this day
  if (dayForecasts.length === 0) {
    return {
      dayName: format(targetDate, "EEEE"),
      date: format(targetDate, "MMM d"),
      condition: "Poor",
      waveHeight: "N/A",
      wind: "N/A",
      bestWindow: "No data",
    };
  }

  // Evaluate match quality for this day
  const matchResult = evaluateDigestMatch(
    dayForecasts,
    beachMetadata,
    userSkillLevel,
    userPrefs
  );

  // Get representative forecast (midday or first available)
  const middayForecast = dayForecasts.find((f) => {
    const hour = new Date(f.forecast_time || f.created_at).getHours();
    return hour >= 6 && hour <= 12;
  }) || dayForecasts[0];

  // Format wave height
  const waveHeights = dayForecasts
    .map((f) => parseFloat(String(f.wave_height || "0")))
    .filter((h) => h > 0);
  const minWave = Math.min(...waveHeights);
  const maxWave = Math.max(...waveHeights);
  const waveHeight = waveHeights.length > 0
    ? minWave === maxWave
      ? `${minWave.toFixed(0)}ft`
      : `${minWave.toFixed(0)}-${maxWave.toFixed(0)}ft`
    : "Flat";

  // Format wind
  const windSpeed = middayForecast.wind_speed
    ? `${Math.round(parseFloat(middayForecast.wind_speed))}mph`
    : "N/A";
  const windDir = middayForecast.wind_direction_deg
    ? degreesToCardinal(middayForecast.wind_direction_deg)
    : "";
  const wind = `${windSpeed} ${windDir}`.trim();

  // Format best window
  const bestWindow = matchResult.bestWindow
    ? `${matchResult.bestWindow.windowStart}-${matchResult.bestWindow.windowEnd}`
    : matchResult.isMatch
      ? "All day"
      : "Skip it";

  return {
    dayName: format(targetDate, "EEEE"),
    date: format(targetDate, "MMM d"),
    condition: matchQualityToCondition(matchResult.matchQuality),
    waveHeight,
    wind,
    bestWindow,
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

    console.log("🏄 [weekend-outlook] Starting Thursday weekend outlook email run");

    const supabase = await createSupabaseServiceRoleClient();

    // Initialize summary
    const summary: RunSummary = {
      eligibleUsers: 0,
      sent: 0,
      durationMs: 0,
      skipped: {
        noHomeBeach: 0,
        noEmail: 0,
        alreadySentThisWeek: 0,
        staleOrMissingForecast: 0,
        sendFailed: 0,
      },
    };

    // 2. Query weekend warrior users (pref_time_bucket = 'weekends')
    const { data: users, error: usersError } = await supabase
      .from("profiles")
      .select(
        `
        id,
        email,
        display_name,
        home_beach_id,
        skill_level,
        notif_email_enabled,
        notif_forecast_alerts,
        is_mock,
        user_surf_preferences (
          wave_min_ft,
          wave_max_ft,
          max_wind_mph,
          preferred_tide_statuses
        ),
        user_email_prefs!inner (
          pref_time_bucket,
          email_frequency
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
      .eq("user_email_prefs.pref_time_bucket", "weekends")
      .neq("user_email_prefs.email_frequency", "off")
      .not("home_beach_id", "is", null)
      .not("email", "is", null);

    if (usersError) {
      throw new Error(`Failed to fetch weekend users: ${usersError.message}`);
    }

    console.log(`📧 [weekend-outlook] Found ${users?.length ?? 0} weekend warrior users`);

    if (!users || users.length === 0) {
      summary.durationMs = Date.now() - startTime;
      return createSuccessResponse({ summary });
    }

    summary.eligibleUsers = users.length;

    // Calculate weekend dates (Friday, Saturday, Sunday)
    const today = new Date();
    const friday = addDays(today, (5 - today.getDay() + 7) % 7 || 7); // Next Friday
    const saturday = addDays(friday, 1);
    const sunday = addDays(friday, 2);

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://quiver.fyi";

    // 3. Process each user
    for (const user of users) {
      try {
        if (!user.email) {
          summary.skipped.noEmail++;
          continue;
        }

        if (!user.home_beach_id || !user.beaches) {
          summary.skipped.noHomeBeach++;
          continue;
        }

        const beach = Array.isArray(user.beaches) ? user.beaches[0] : user.beaches;
        if (!beach) {
          summary.skipped.noHomeBeach++;
          continue;
        }

        // Check deduplication
        const alreadySent = await checkAlreadySent(user.id, user.home_beach_id);
        if (alreadySent) {
          summary.skipped.alreadySentThisWeek++;
          continue;
        }

        // Fetch forecast data
        const { forecasts, metadata } = await getFreshForecastFromCache(
          user.home_beach_id,
          LOOKAHEAD_HOURS
        );

        if (metadata.stale || metadata.missing || forecasts.length === 0) {
          console.warn(
            `⚠️ [weekend-outlook] Stale/missing forecast for ${user.id}, beach ${beach.name}`
          );
          summary.skipped.staleOrMissingForecast++;
          continue;
        }

        // Prepare beach metadata for evaluation
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

        const userPrefs: UserSurfPreferences | null = user.user_surf_preferences
          ? Array.isArray(user.user_surf_preferences)
            ? user.user_surf_preferences[0]
            : user.user_surf_preferences
          : null;

        // Generate 3-day forecast
        const fridayForecast = formatDayForecast(
          forecasts,
          friday,
          beachMetadata,
          user.skill_level,
          userPrefs
        );
        const saturdayForecast = formatDayForecast(
          forecasts,
          saturday,
          beachMetadata,
          user.skill_level,
          userPrefs
        );
        const sundayForecast = formatDayForecast(
          forecasts,
          sunday,
          beachMetadata,
          user.skill_level,
          userPrefs
        );

        const ctaUrl = `${baseUrl}/beaches/${beach.slug}`;
        const unsubscribeUrl = `${baseUrl}/settings`;

        // Determine best day for subject line
        const conditions = [fridayForecast, saturdayForecast, sundayForecast];
        const bestDay = conditions.find((c) => c.condition === "Good")
          || conditions.find((c) => c.condition === "Fair")
          || fridayForecast;

        const subjectEmoji = bestDay.condition === "Good" ? "🌊" : bestDay.condition === "Fair" ? "🏄" : "📅";
        const emailSubject = `${subjectEmoji} Weekend Outlook: ${beach.name}`;

        try {
          await resend.emails.send({
            from: MAIL_FROM,
            replyTo: MAIL_REPLY_TO,
            to: user.email,
            subject: emailSubject,
            react: WeekendOutlookEmail({
              userName: user.display_name,
              spotName: beach.name,
              forecasts: [fridayForecast, saturdayForecast, sundayForecast],
              ctaUrl,
              unsubscribeUrl,
            }),
          });

          console.log(`✅ [weekend-outlook] Sent to ${user.email} for ${beach.name}`);
          await trackDelivery(user.id, user.home_beach_id);
          summary.sent++;
        } catch (sendError) {
          console.error(`❌ [weekend-outlook] Failed to send to ${user.email}:`, sendError);
          summary.skipped.sendFailed++;
        }
      } catch (userError) {
        console.error(`❌ [weekend-outlook] Error processing user ${user.id}:`, userError);
        summary.skipped.sendFailed++;
      }
    }

    summary.durationMs = Date.now() - startTime;

    console.log(
      `🎉 [weekend-outlook] Completed: ${summary.sent} emails sent, ${summary.eligibleUsers} eligible, ${summary.durationMs}ms`
    );
    console.log(`   Skipped breakdown:`, summary.skipped);

    return createSuccessResponse({ summary });
  } catch (error) {
    return handleApiError(error);
  }
}
