/**
 * Forecast Alert Service (Push)
 *
 * Evaluates cached forecasts for a user's home beach and sends a push notification
 * when conditions cross the user's thresholds.
 *
 * Design constraints:
 * - Cache-only forecast reads (via getFreshForecastFromCache)
 * - No stale pushes: if forecast cache is stale/missing, skip sending
 * - Dedupe: at most 1 alert/day per user+beach (and only when the matching window changes)
 */

import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { getFreshForecastFromCache } from "@/lib/utils/forecast-service-utils";
import { sendPushNotification } from "@/lib/services/push-notifications";
import { getLocalHour, DEFAULT_TIMEZONE } from "@/lib/utils/timezone-utils";

type AlertType = "forecast_threshold";

type LearnedPrefsRow = {
  user_id: string;
  wave_min_ft: number | null;
  wave_max_ft: number | null;
  wave_period_min_s: number | null;
  wave_period_max_s: number | null;
  max_wind_mph: number | null;
  preferred_tide_statuses: string[] | null;
  sample_size: number;
};

type EligibleProfileRow = {
  id: string;
  home_beach_id: string | null;
  notif_push_enabled: boolean;
  notif_forecast_alerts: boolean;
  is_mock: boolean;
  timezone: string | null;
};

type BeachRow = {
  id: string;
  slug: string | null;
  name: string | null;
};

type DeliveryRow = {
  user_id: string;
  beach_id: string;
  alert_type: AlertType;
  last_sent_at: string | null;
  last_matching_forecast_ts: string | null;
};

export type ForecastAlertRunSummary = {
  eligibleUsers: number;
  skipped: {
    pushDisabled: number;
    alertsDisabled: number;
    missingHomeBeach: number;
    mockUser: number;
    missingBeachSlug: number;
    staleForecast: number;
    missingForecast: number;
    noMatch: number;
    rateLimited: number;
    notCrossing: number;
    noDeviceTokens: number;
    sendFailed: number;
    quietHours: number;
  };
  sent: number;
  durationMs: number;
};

const DEFAULT_THRESHOLDS = {
  waveMinFt: 2,
  waveMaxFt: 6,
  periodMinS: 10,
  periodMaxS: 18,
  maxWindMph: 15,
  confidenceMin: 0.5,
};

const LOOKAHEAD_HOURS = 18;
const DEDUPE_WINDOW_MS = 24 * 60 * 60 * 1000;
const ALERT_TYPE: AlertType = "forecast_threshold";

// Quiet hours: suppress notifications between 10 PM and 4 AM local time
const QUIET_HOURS_START = 22; // 10 PM
const QUIET_HOURS_END = 4;    // 4 AM

/**
 * Check if a given hour falls within quiet hours (10 PM - 4 AM)
 */
function isHourInQuietHours(hour: number): boolean {
  return hour >= QUIET_HOURS_START || hour < QUIET_HOURS_END;
}

/**
 * Check if a given time falls within quiet hours (10 PM - 4 AM) in a timezone
 * Exported for testing
 */
export function isWithinQuietHours(timezone: string | null, now: Date = new Date()): boolean {
  const tz = timezone || DEFAULT_TIMEZONE;
  const localHour = getLocalHour(now, tz);
  return isHourInQuietHours(localHour);
}

/**
 * Determine if a notification should be suppressed due to quiet hours.
 *
 * Logic: Only suppress if BOTH the current time AND the forecast time are in quiet hours.
 * This allows dawn patrol alerts - e.g., at 3 AM we still notify about good 6 AM conditions
 * so users can prepare, but we don't wake users for forecasts they can't act on.
 *
 * @param timezone - User's timezone (falls back to DEFAULT_TIMEZONE if null)
 * @param forecastUtcMs - The UTC timestamp of the forecast
 * @param now - Current time (defaults to now, injectable for testing)
 * @returns true if notification should be suppressed
 *
 * Exported for testing
 */
export function shouldSuppressForQuietHours(
  timezone: string | null,
  forecastUtcMs: number,
  now: Date = new Date()
): boolean {
  const tz = timezone || DEFAULT_TIMEZONE;
  const currentHour = getLocalHour(now, tz);
  const forecastHour = getLocalHour(new Date(forecastUtcMs), tz);

  // Only suppress if BOTH current time and forecast time are in quiet hours
  return isHourInQuietHours(currentHour) && isHourInQuietHours(forecastHour);
}

/**
 * Format forecast time in user's local timezone for notification display
 * Example output: "2/4 6AM" or "2/4 2PM"
 * Exported for testing
 */
export function formatForecastTimeLocal(forecastUtcMs: number, timezone: string | null): string {
  const tz = timezone || DEFAULT_TIMEZONE;
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      hour12: true,
    }).formatToParts(new Date(forecastUtcMs));

    const month = parts.find(p => p.type === "month")?.value ?? "";
    const day = parts.find(p => p.type === "day")?.value ?? "";
    const hour = parts.find(p => p.type === "hour")?.value ?? "";
    const dayPeriod = parts.find(p => p.type === "dayPeriod")?.value ?? "";

    return `${month}/${day} ${hour}${dayPeriod}`;
  } catch {
    // Fallback to UTC if timezone invalid
    const d = new Date(forecastUtcMs);
    const h = d.getUTCHours();
    return `${d.getUTCMonth() + 1}/${d.getUTCDate()} ${h % 12 || 12}${h >= 12 ? "PM" : "AM"} UTC`;
  }
}

function chunkArray<T>(items: T[], chunkSize: number): T[][] {
  if (chunkSize <= 0) return [items];
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    out.push(items.slice(i, i + chunkSize));
  }
  return out;
}

function parseNumber(value: unknown): number | null {
  if (typeof value === "number" && isFinite(value)) return value;
  if (typeof value === "string") {
    const n = parseFloat(value);
    return isFinite(n) ? n : null;
  }
  return null;
}

function forecastToUtcMs(forecast: { forecast_at?: string; forecast_date?: string; forecast_time?: string }): number | null {
  // Prefer forecast_at (already UTC timestamptz)
  if (forecast.forecast_at) {
    const ts = new Date(forecast.forecast_at).getTime();
    return Number.isFinite(ts) ? ts : null;
  }
  // Fallback to legacy forecast_date + forecast_time (assume UTC with Z suffix)
  if (!forecast.forecast_date || !forecast.forecast_time) return null;
  const ts = new Date(`${forecast.forecast_date}T${forecast.forecast_time}Z`).getTime();
  return Number.isFinite(ts) ? ts : null;
}

function getUserThresholds(prefs: LearnedPrefsRow | null) {
  if (!prefs || typeof prefs.sample_size !== "number" || prefs.sample_size < 5) {
    return {
      source: "default" as const,
      ...DEFAULT_THRESHOLDS,
      preferredTideStatuses: null as string[] | null,
    };
  }

  return {
    source: "learned" as const,
    waveMinFt: prefs.wave_min_ft ?? DEFAULT_THRESHOLDS.waveMinFt,
    waveMaxFt: prefs.wave_max_ft ?? DEFAULT_THRESHOLDS.waveMaxFt,
    periodMinS: prefs.wave_period_min_s ?? DEFAULT_THRESHOLDS.periodMinS,
    periodMaxS: prefs.wave_period_max_s ?? DEFAULT_THRESHOLDS.periodMaxS,
    maxWindMph: prefs.max_wind_mph ?? DEFAULT_THRESHOLDS.maxWindMph,
    confidenceMin: DEFAULT_THRESHOLDS.confidenceMin,
    preferredTideStatuses: prefs.preferred_tide_statuses?.length
      ? prefs.preferred_tide_statuses.map((s) => String(s).toLowerCase())
      : null,
  };
}

export function findFirstMatchingForecast(args: {
  forecasts: Array<{
    forecast_at?: string;
    forecast_date: string;
    forecast_time: string;
    wave_height?: string | null;
    wave_period?: string | null;
    wind_speed?: string | null;
    tide_status?: string | null;
    confidence_score?: number | null;
  }>;
  nowMs: number;
  lookaheadHours: number;
  thresholds: ReturnType<typeof getUserThresholds>;
}) {
  const { forecasts, nowMs, lookaheadHours, thresholds } = args;
  const endMs = nowMs + lookaheadHours * 60 * 60 * 1000;

  for (const f of forecasts) {
    const tMs = forecastToUtcMs(f);
    if (!tMs) continue;
    if (tMs < nowMs || tMs > endMs) continue;

    const waveFt = parseNumber(f.wave_height);
    const periodS = parseNumber(f.wave_period);
    const windMph = parseNumber(f.wind_speed);
    const confidence = typeof f.confidence_score === "number" ? f.confidence_score : null;
    const tideStatus = (f.tide_status || "").toLowerCase();

    if (waveFt === null || periodS === null || windMph === null) continue;
    if (confidence !== null && confidence < thresholds.confidenceMin) continue;

    if (waveFt < thresholds.waveMinFt || waveFt > thresholds.waveMaxFt) continue;
    if (periodS < thresholds.periodMinS || periodS > thresholds.periodMaxS) continue;
    if (windMph > thresholds.maxWindMph) continue;

    if (thresholds.preferredTideStatuses && thresholds.preferredTideStatuses.length > 0) {
      if (!tideStatus) continue;
      if (!thresholds.preferredTideStatuses.includes(tideStatus)) continue;
    }

    return { forecast: f, forecastUtcMs: tMs };
  }

  return null;
}

export async function runForecastThresholdAlerts(): Promise<ForecastAlertRunSummary> {
  const start = Date.now();
  const supabase = createSupabaseServiceRoleClient();

  const summary: ForecastAlertRunSummary = {
    eligibleUsers: 0,
    sent: 0,
    durationMs: 0,
    skipped: {
      pushDisabled: 0,
      alertsDisabled: 0,
      missingHomeBeach: 0,
      mockUser: 0,
      missingBeachSlug: 0,
      staleForecast: 0,
      missingForecast: 0,
      noMatch: 0,
      rateLimited: 0,
      notCrossing: 0,
      noDeviceTokens: 0,
      sendFailed: 0,
      quietHours: 0,
    },
  };

  // 1) Load eligible users (home beach + push enabled + alerts enabled)
  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, home_beach_id, notif_push_enabled, notif_forecast_alerts, is_mock, timezone")
    .not("home_beach_id", "is", null);

  if (profilesError) {
    throw new Error(profilesError.message || "Failed to load profiles for forecast alerts");
  }

  const eligible: EligibleProfileRow[] = (profiles || []) as any[];

  // Apply per-profile eligibility gating with explicit skip accounting
  const filtered: EligibleProfileRow[] = [];
  for (const p of eligible) {
    if (p.is_mock) {
      summary.skipped.mockUser++;
      continue;
    }
    if (!p.home_beach_id) {
      summary.skipped.missingHomeBeach++;
      continue;
    }
    if (p.notif_push_enabled === false) {
      summary.skipped.pushDisabled++;
      continue;
    }
    if (p.notif_forecast_alerts === false) {
      summary.skipped.alertsDisabled++;
      continue;
    }
    filtered.push(p);
  }

  summary.eligibleUsers = filtered.length;
  if (filtered.length === 0) {
    summary.durationMs = Date.now() - start;
    return summary;
  }

  const userIds = filtered.map((p) => p.id);
  const beachIds = Array.from(new Set(filtered.map((p) => p.home_beach_id!).filter(Boolean)));

  // 2) Fetch beach slug/name for deep-link payload
  const { data: beaches, error: beachesError } = await supabase
    .from("beaches")
    .select("id, slug, name")
    .in("id", beachIds);
  if (beachesError) {
    throw new Error(beachesError.message || "Failed to load beaches for forecast alerts");
  }
  const beachById = new Map<string, BeachRow>();
  (beaches || []).forEach((b: any) => beachById.set(b.id, b));

  // 3) Fetch learned preferences (batch)
  const prefsByUser = new Map<string, LearnedPrefsRow>();
  for (const batch of chunkArray(userIds, 250)) {
    const { data: prefs, error: prefsError } = await supabase
      .from("user_surf_preferences")
      .select(
        "user_id, wave_min_ft, wave_max_ft, wave_period_min_s, wave_period_max_s, max_wind_mph, preferred_tide_statuses, sample_size"
      )
      .in("user_id", batch);
    if (prefsError) {
      throw new Error(prefsError.message || "Failed to load learned preferences");
    }
    (prefs || []).forEach((r: any) => prefsByUser.set(r.user_id, r));
  }

  // 4) Fetch prior delivery state (batch)
  const deliveryByKey = new Map<string, DeliveryRow>();
  for (const batch of chunkArray(userIds, 250)) {
    const { data: rows, error: delError } = await supabase
      .from("forecast_alert_deliveries")
      .select("user_id, beach_id, alert_type, last_sent_at, last_matching_forecast_ts")
      .eq("alert_type", ALERT_TYPE)
      .in("user_id", batch);
    if (delError) {
      throw new Error(delError.message || "Failed to load forecast alert deliveries");
    }
    (rows || []).forEach((r: any) => {
      deliveryByKey.set(`${r.user_id}|${r.beach_id}|${r.alert_type}`, r);
    });
  }

  // 5) Fetch forecasts per beach (cache-only), but do not send if stale/missing.
  const forecastsByBeach = new Map<
    string,
    { forecasts: any[]; stale: boolean; missing: boolean }
  >();

  // Limit parallelism to avoid hammering the DB
  const beachBatches = chunkArray(beachIds, 10);
  for (const batch of beachBatches) {
    const results = await Promise.allSettled(
      batch.map(async (beachId) => {
        const res = await getFreshForecastFromCache(beachId, LOOKAHEAD_HOURS);
        forecastsByBeach.set(beachId, {
          forecasts: res.forecasts as any[],
          stale: res.metadata.stale,
          missing: res.metadata.missing,
        });
      })
    );
    // Surface unexpected errors but continue processing remaining beaches/users.
    results.forEach((r, idx) => {
      if (r.status === "rejected") {
        // Treat as missing for this beach
        const beachId = batch[idx];
        forecastsByBeach.set(beachId, { forecasts: [], stale: false, missing: true });
      }
    });
  }

  // 6) Evaluate and send per user
  const nowMs = Date.now();
  const now = new Date(nowMs);
  for (const p of filtered) {
    const beachId = p.home_beach_id!;
    const beach = beachById.get(beachId);
    if (!beach?.slug) {
      summary.skipped.missingBeachSlug++;
      continue;
    }

    const forecastBucket = forecastsByBeach.get(beachId) || {
      forecasts: [],
      stale: false,
      missing: true,
    };

    if (forecastBucket.missing) {
      summary.skipped.missingForecast++;
      continue;
    }
    if (forecastBucket.stale) {
      summary.skipped.staleForecast++;
      continue;
    }

    const thresholds = getUserThresholds(prefsByUser.get(p.id) || null);
    const match = findFirstMatchingForecast({
      forecasts: forecastBucket.forecasts,
      nowMs,
      lookaheadHours: LOOKAHEAD_HOURS,
      thresholds,
    });

    if (!match) {
      summary.skipped.noMatch++;
      continue;
    }

    // Check quiet hours AFTER finding a match - only suppress if both current time
    // and forecast time are in quiet hours. This allows dawn patrol alerts.
    if (shouldSuppressForQuietHours(p.timezone, match.forecastUtcMs, now)) {
      console.info(
        `[ForecastAlerts] Skipping notification for user ${p.id} - quiet hours ` +
        `(tz: ${p.timezone || DEFAULT_TIMEZONE}, forecast: ${new Date(match.forecastUtcMs).toISOString()})`
      );
      summary.skipped.quietHours++;
      continue;
    }

    const matchIso = new Date(match.forecastUtcMs).toISOString();
    const deliveryKey = `${p.id}|${beachId}|${ALERT_TYPE}`;
    const prior = deliveryByKey.get(deliveryKey);

    if (prior?.last_sent_at) {
      const lastSentMs = new Date(prior.last_sent_at).getTime();
      if (Number.isFinite(lastSentMs) && nowMs - lastSentMs < DEDUPE_WINDOW_MS) {
        summary.skipped.rateLimited++;
        continue;
      }
    }

    if (prior?.last_matching_forecast_ts && prior.last_matching_forecast_ts === matchIso) {
      summary.skipped.notCrossing++;
      continue;
    }

    // Build notification content
    const waveFt = parseNumber(match.forecast.wave_height);
    const periodS = parseNumber(match.forecast.wave_period);
    const windMph = parseNumber(match.forecast.wind_speed);

    const title = "Quiver Forecast Alert";
    // Format time in user's local timezone
    const whenLocal = formatForecastTimeLocal(match.forecastUtcMs, p.timezone);
    const body = `${beach.name || "Your home beach"} looks good ${whenLocal}: ${
      waveFt !== null ? `${Math.round(waveFt * 10) / 10}ft` : "waves"
    } @ ${periodS !== null ? `${Math.round(periodS)}s` : "—"} • ${
      windMph !== null ? `${Math.round(windMph)}mph wind` : "—"
    }`;

    try {
      const pushResult = await sendPushNotification({
        userIds: [p.id],
        title,
        body,
        data: {
          type: "forecast_alert",
          beach_id: beachId,
          beach_slug: beach.slug,
          forecast_ts: matchIso,
          url: `/beach/${beach.slug}`,
        },
      });

      if (pushResult.errors?.length) {
        summary.skipped.sendFailed++;
        continue;
      }

      if (pushResult.success === 0 && pushResult.failed === 0) {
        // Most commonly: no registered device tokens for the user.
        summary.skipped.noDeviceTokens++;
        continue;
      }

      if (pushResult.failed > 0) {
        summary.skipped.sendFailed++;
        continue;
      }

      summary.sent++;

      const { error: upsertError } = await supabase
        .from("forecast_alert_deliveries")
        .upsert(
          {
            user_id: p.id,
            beach_id: beachId,
            alert_type: ALERT_TYPE,
            last_sent_at: new Date().toISOString(),
            last_matching_forecast_ts: matchIso,
          },
          { onConflict: "user_id,beach_id,alert_type" }
        );

      if (upsertError) {
        // Non-fatal: don't fail the run if state write fails
         
        console.warn("Forecast alert delivery upsert failed", upsertError);
      } else {
        deliveryByKey.set(deliveryKey, {
          user_id: p.id,
          beach_id: beachId,
          alert_type: ALERT_TYPE,
          last_sent_at: new Date().toISOString(),
          last_matching_forecast_ts: matchIso,
        });
      }
    } catch (err) {
      summary.skipped.sendFailed++;
    }
  }

  summary.durationMs = Date.now() - start;
  return summary;
}


