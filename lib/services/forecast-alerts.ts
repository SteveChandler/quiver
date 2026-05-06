/**
 * Forecast Alert Service (Push)
 *
 * Evaluates cached forecasts for a user's home beach and alert-enabled favorite
 * beaches, then enqueues one daily summary push when conditions cross the
 * user's thresholds.
 *
 * Design constraints:
 * - Cache-only forecast reads (via getFreshForecastFromCache)
 * - No stale pushes: if forecast cache is stale/missing, skip sending
 * - Dedupe: at most 1 daily summary per user+local date
 */

import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { getFreshForecastFromCache } from "@/lib/utils/forecast-service-utils";
import { enqueueNotification } from "@/lib/notifications/enqueue";
import {
  getLocalDateString,
  getLocalHour,
  DEFAULT_TIMEZONE,
} from "@/lib/utils/timezone-utils";

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

export type ForecastAlertRunSummary = {
  eligibleUsers: number;
  eligibleBeachesProcessed: number;
  skipped: {
    pushDisabled: number;
    alertsDisabled: number;
    mockUser: number;
    noEligibleBeaches: number;
    missingBeachSlug: number;
    staleForecast: number;
    missingForecast: number;
    noGoodForecasts: number;
    duplicateDailySummary: number;
    noMatch: number;
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
const MAX_DAILY_SUMMARY_ENTRIES = 3;
const DAILY_FORECAST_ALERT_TYPE = "daily_forecast_summary";

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

function normalizeConfidenceScore(value: number | null): number | null {
  if (value === null) return null;
  if (value > 1) return Math.min(value / 100, 1);
  return Math.max(value, 0);
}

function forecastToUtcMs(forecast: {
  forecast_at?: string | null;
  forecast_date?: string | null;
  forecast_time?: string | null;
}): number | null {
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

type ForecastAlertForecast = {
  forecast_at?: string;
  forecast_date?: string | null;
  forecast_time?: string | null;
  wave_height?: string | null;
  wave_period?: string | null;
  wind_speed?: string | null;
  tide_status?: string | null;
  confidence_score?: number | null;
};

type MatchingForecast = {
  forecast: ForecastAlertForecast;
  forecastUtcMs: number;
  score: number;
};

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
  forecasts: ForecastAlertForecast[];
  nowMs: number;
  lookaheadHours: number;
  thresholds: ReturnType<typeof getUserThresholds>;
}) {
  return getMatchingForecasts(args)[0] ?? null;
}

function getMatchingForecasts(args: {
  forecasts: ForecastAlertForecast[];
  nowMs: number;
  lookaheadHours: number;
  thresholds: ReturnType<typeof getUserThresholds>;
}): MatchingForecast[] {
  const { forecasts, nowMs, lookaheadHours, thresholds } = args;
  const endMs = nowMs + lookaheadHours * 60 * 60 * 1000;
  const matches: MatchingForecast[] = [];

  for (const f of forecasts) {
    const tMs = forecastToUtcMs(f);
    if (!tMs) continue;
    if (tMs < nowMs || tMs > endMs) continue;

    const waveFt = parseNumber(f.wave_height);
    const periodS = parseNumber(f.wave_period);
    const windMph = parseNumber(f.wind_speed);
    const confidence = normalizeConfidenceScore(
      typeof f.confidence_score === "number" ? f.confidence_score : null
    );
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

    matches.push({
      forecast: f,
      forecastUtcMs: tMs,
      score: scoreMatchingForecast({
        waveFt,
        periodS,
        windMph,
        confidence,
        forecastUtcMs: tMs,
        nowMs,
        thresholds,
      }),
    });
  }

  return matches;
}

function findBestMatchingForecast(args: {
  forecasts: ForecastAlertForecast[];
  nowMs: number;
  lookaheadHours: number;
  thresholds: ReturnType<typeof getUserThresholds>;
}): MatchingForecast | null {
  const matches = getMatchingForecasts(args);
  if (matches.length === 0) return null;

  matches.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.forecastUtcMs - b.forecastUtcMs;
  });

  return matches[0];
}

function scoreMatchingForecast(args: {
  waveFt: number;
  periodS: number;
  windMph: number;
  confidence: number | null;
  forecastUtcMs: number;
  nowMs: number;
  thresholds: ReturnType<typeof getUserThresholds>;
}): number {
  const { waveFt, periodS, windMph, confidence, forecastUtcMs, nowMs, thresholds } = args;
  const waveCenter = (thresholds.waveMinFt + thresholds.waveMaxFt) / 2;
  const waveHalfWidth = Math.max((thresholds.waveMaxFt - thresholds.waveMinFt) / 2, 1);
  const waveFit = Math.max(0, 1 - Math.abs(waveFt - waveCenter) / waveHalfWidth);
  const periodFit = Math.min(1, periodS / Math.max(thresholds.periodMaxS, 1));
  const windFit = Math.max(0, 1 - windMph / Math.max(thresholds.maxWindMph, 1));
  const confidenceFit = confidence ?? 1;
  const hoursAhead = Math.max(0, (forecastUtcMs - nowMs) / (60 * 60 * 1000));
  const timeFit = Math.max(0, 1 - hoursAhead / LOOKAHEAD_HOURS);

  return waveFit * 35 + periodFit * 30 + windFit * 20 + confidenceFit * 10 + timeFit * 5;
}

type DailyForecastCandidate = {
  beachId: string;
  beach: BeachRow;
  forecast: ForecastAlertForecast;
  forecastUtcMs: number;
  score: number;
};

type EvaluateBeachForecastArgs = {
  beachId: string;
  beach: BeachRow | undefined;
  thresholds: ReturnType<typeof getUserThresholds>;
  forecastBucket: { forecasts: ForecastAlertForecast[]; stale: boolean; missing: boolean };
  timezone: string | null;
  nowMs: number;
  now: Date;
  summary: ForecastAlertRunSummary;
};

/**
 * Evaluate a single user+beach pair and return its best matching forecast.
 * Mutates `summary` counters for per-beach skip reasons.
 */
function evaluateBeachForecast({
  beachId,
  beach,
  thresholds,
  forecastBucket,
  timezone,
  nowMs,
  now,
  summary,
}: EvaluateBeachForecastArgs): DailyForecastCandidate | null {
  if (!beach) {
    summary.skipped.missingBeachSlug++;
    return null;
  }

  if (forecastBucket.missing) {
    summary.skipped.missingForecast++;
    return null;
  }
  if (forecastBucket.stale) {
    summary.skipped.staleForecast++;
    return null;
  }

  const match = findBestMatchingForecast({
    forecasts: forecastBucket.forecasts,
    nowMs,
    lookaheadHours: LOOKAHEAD_HOURS,
    thresholds,
  });

  if (!match) {
    summary.skipped.noMatch++;
    return null;
  }

  // Check quiet hours AFTER finding a match - only suppress if both current time
  // and forecast time are in quiet hours. This allows dawn patrol alerts.
  if (shouldSuppressForQuietHours(timezone, match.forecastUtcMs, now)) {
    console.info(
      `[ForecastAlerts] Skipping forecast candidate for beach ${beachId} - quiet hours ` +
      `(tz: ${timezone || DEFAULT_TIMEZONE}, forecast: ${new Date(match.forecastUtcMs).toISOString()})`
    );
    summary.skipped.quietHours++;
    return null;
  }

  return {
    beachId,
    beach,
    forecast: match.forecast,
    forecastUtcMs: match.forecastUtcMs,
    score: match.score,
  };
}

function formatForecastSummaryTime(forecastUtcMs: number, timezone: string | null): string {
  const tz = timezone || DEFAULT_TIMEZONE;
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hour: "numeric",
      hour12: true,
    })
      .format(new Date(forecastUtcMs))
      .replace(/\s/g, "");
  } catch {
    const d = new Date(forecastUtcMs);
    const h = d.getUTCHours();
    return `${h % 12 || 12}${h >= 12 ? "PM" : "AM"} UTC`;
  }
}

function formatDailySummaryLine(candidate: DailyForecastCandidate, timezone: string | null): string {
  const waveFt = parseNumber(candidate.forecast.wave_height);
  const periodS = parseNumber(candidate.forecast.wave_period);
  const windMph = parseNumber(candidate.forecast.wind_speed);
  const beachName = candidate.beach.name || "Your beach";
  const whenLocal = formatForecastSummaryTime(candidate.forecastUtcMs, timezone);
  const waveText = waveFt !== null ? `${Math.round(waveFt * 10) / 10}ft` : "waves";
  const periodText = periodS !== null ? ` @ ${Math.round(periodS)}s` : "";
  const windText = windMph !== null ? `, ${Math.round(windMph)}mph wind` : "";

  return `${beachName}: ${whenLocal} looks good, ${waveText}${periodText}${windText}`;
}

async function enqueueDailyForecastSummary(args: {
  supabase: ReturnType<typeof createSupabaseServiceRoleClient>;
  userId: string;
  alertDate: string;
  timezone: string | null;
  candidates: DailyForecastCandidate[];
  summary: ForecastAlertRunSummary;
}): Promise<void> {
  const { supabase, userId, alertDate, timezone, candidates, summary } = args;
  const topCandidates = [...candidates]
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.forecastUtcMs - b.forecastUtcMs;
    })
    .slice(0, MAX_DAILY_SUMMARY_ENTRIES);

  try {
    const enqueueResult = await enqueueNotification(
      {
        type: "daily_digest",
        recipientUserId: userId,
        entityType: null,
        entityId: null,
        payload: {
          alert_date: alertDate,
          title: "Quiver Daily Forecast",
          body: topCandidates.map((c) => formatDailySummaryLine(c, timezone)).join("\n"),
          match_count: topCandidates.length,
          forecast_summary: {
            top_match: topCandidates[0]?.beach.name || "Forecast summary",
            match_count: topCandidates.length,
          },
        },
        dedupeKey: `${DAILY_FORECAST_ALERT_TYPE}:${userId}:${alertDate}`,
      },
      supabase
    );

    if (enqueueResult.enqueued) {
      summary.sent++;
      console.info("sent_daily_forecast_summary", {
        user_id: userId,
        forecast_date: alertDate,
        alert_type: DAILY_FORECAST_ALERT_TYPE,
        match_count: topCandidates.length,
      });
      return;
    }

    if (enqueueResult.reason === "duplicate") {
      summary.skipped.duplicateDailySummary++;
      console.info("skipped_duplicate_daily_summary", {
        user_id: userId,
        forecast_date: alertDate,
        alert_type: DAILY_FORECAST_ALERT_TYPE,
      });
      return;
    }

    console.error(
      `[ForecastAlerts] Failed to enqueue daily forecast summary for user ${userId}:`,
      enqueueResult
    );
    summary.skipped.sendFailed++;
  } catch (err) {
    console.error(
      `[ForecastAlerts] Enqueue threw for daily forecast summary user ${userId}:`,
      err
    );
    summary.skipped.sendFailed++;
  }
}

function uniqueBeachIds(ids: Array<string | null | undefined>): string[] {
  return Array.from(new Set(ids.filter((id): id is string => Boolean(id))));
}

type FavoriteBeachRow = {
  user_id: string;
  beach_id: string;
  alerts_enabled: boolean;
};

function getEligibleBeachIdsForUser(args: {
  profile: EligibleProfileRow;
  favoritesByUser: Map<string, FavoriteBeachRow[]>;
}): string[] {
  const { profile, favoritesByUser } = args;
  return uniqueBeachIds([
    profile.home_beach_id,
    ...(favoritesByUser.get(profile.id)?.map((favorite) => favorite.beach_id) ?? []),
  ]);
}

function logNoEligibleBeaches(userId: string): void {
  console.info("skipped_no_eligible_beaches", {
    user_id: userId,
    alert_type: DAILY_FORECAST_ALERT_TYPE,
  });
}

function logNoGoodForecasts(userId: string, alertDate: string, eligibleBeachCount: number): void {
  console.info("skipped_no_good_forecasts", {
    user_id: userId,
    forecast_date: alertDate,
    alert_type: DAILY_FORECAST_ALERT_TYPE,
    eligible_beach_count: eligibleBeachCount,
  });
}

export async function runForecastThresholdAlerts(): Promise<ForecastAlertRunSummary> {
  const start = Date.now();
  const supabase = createSupabaseServiceRoleClient();

  const summary: ForecastAlertRunSummary = {
    eligibleUsers: 0,
    eligibleBeachesProcessed: 0,
    sent: 0,
    durationMs: 0,
    skipped: {
      pushDisabled: 0,
      alertsDisabled: 0,
      mockUser: 0,
      noEligibleBeaches: 0,
      missingBeachSlug: 0,
      staleForecast: 0,
      missingForecast: 0,
      noGoodForecasts: 0,
      duplicateDailySummary: 0,
      noMatch: 0,
      sendFailed: 0,
      quietHours: 0,
    },
  };

  // 1) Load profiles once. This keeps skip accounting explicit and lets
  // favorite-only users participate in the daily summary.
  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, home_beach_id, notif_push_enabled, notif_forecast_alerts, is_mock, timezone");

  if (profilesError) {
    throw new Error(profilesError.message || "Failed to load profiles for forecast alerts");
  }

  const profileRows: EligibleProfileRow[] = (profiles || []) as any[];
  const eligibleProfiles: EligibleProfileRow[] = [];
  for (const p of profileRows) {
    if (p.is_mock) {
      summary.skipped.mockUser++;
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
    eligibleProfiles.push(p);
  }

  summary.eligibleUsers = eligibleProfiles.length;

  if (eligibleProfiles.length === 0) {
    summary.durationMs = Date.now() - start;
    return summary;
  }

  // 2) Query alert-enabled favorites. The code still checks `alerts_enabled`
  // locally because unit-test Supabase fakes don't implement query filtering.
  const allUserIds = eligibleProfiles.map((profile) => profile.id);
  const { data: favRows, error: favError } = await supabase
    .from("favorite_beaches")
    .select("user_id, beach_id, alerts_enabled")
    .eq("alerts_enabled", true);

  if (favError) {
    throw new Error(favError.message || "Failed to load favorite beaches for forecast alerts");
  }

  const eligibleUserIds = new Set(eligibleProfiles.map((profile) => profile.id));
  const favoritesByUser = new Map<string, FavoriteBeachRow[]>();
  for (const favorite of (favRows || []) as FavoriteBeachRow[]) {
    if (!favorite.alerts_enabled) continue;
    if (!eligibleUserIds.has(favorite.user_id)) continue;
    const existing = favoritesByUser.get(favorite.user_id) ?? [];
    existing.push(favorite);
    favoritesByUser.set(favorite.user_id, existing);
  }

  const allBeachIds = uniqueBeachIds(
    eligibleProfiles.flatMap((profile) => getEligibleBeachIdsForUser({ profile, favoritesByUser }))
  );

  // 3) Fetch beach names for summary copy.
  const beachById = new Map<string, BeachRow>();
  if (allBeachIds.length > 0) {
    const { data: beaches, error: beachesError } = await supabase
      .from("beaches")
      .select("id, slug, name")
      .in("id", allBeachIds);
    if (beachesError) {
      throw new Error(beachesError.message || "Failed to load beaches for forecast alerts");
    }
    (beaches || []).forEach((b: any) => beachById.set(b.id, b));
  }

  // 4) Fetch learned preferences (batch over all users)
  const prefsByUser = new Map<string, LearnedPrefsRow>();
  if (allUserIds.length > 0) {
    for (const batch of chunkArray(allUserIds, 250)) {
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
  }

  // 5) Fetch forecasts per beach (cache-only) — covers both home and fav beaches.
  const forecastsByBeach = new Map<
    string,
    { forecasts: ForecastAlertForecast[]; stale: boolean; missing: boolean }
  >();

  if (allBeachIds.length > 0) {
    // Limit parallelism to avoid hammering the DB
    const beachBatches = chunkArray(allBeachIds, 10);
    for (const batch of beachBatches) {
      const results = await Promise.allSettled(
        batch.map(async (beachId) => {
          const res = await getFreshForecastFromCache(beachId, LOOKAHEAD_HOURS);
          forecastsByBeach.set(beachId, {
            forecasts: res.forecasts as ForecastAlertForecast[],
            stale: res.metadata.stale,
            missing: res.metadata.missing,
          });
        })
      );
      // Surface unexpected errors but continue processing remaining beaches/users.
      results.forEach((r, idx) => {
        if (r.status === "rejected") {
          const beachId = batch[idx];
          forecastsByBeach.set(beachId, { forecasts: [], stale: false, missing: true });
        }
      });
    }
  }

  const nowMs = Date.now();
  const now = new Date(nowMs);

  // 6) Evaluate each eligible user's home + alert-enabled favorite beaches,
  // then enqueue one daily summary at most.
  for (const profile of eligibleProfiles) {
    const alertDate = getLocalDateString(now, profile.timezone);
    const beachIds = getEligibleBeachIdsForUser({ profile, favoritesByUser });

    if (beachIds.length === 0) {
      summary.skipped.noEligibleBeaches++;
      logNoEligibleBeaches(profile.id);
      continue;
    }

    summary.eligibleBeachesProcessed += beachIds.length;

    const candidates: DailyForecastCandidate[] = [];
    const thresholds = getUserThresholds(prefsByUser.get(profile.id) || null);
    for (const beachId of beachIds) {
      const candidate = evaluateBeachForecast({
        beachId,
        beach: beachById.get(beachId),
        thresholds,
        forecastBucket: forecastsByBeach.get(beachId) || {
          forecasts: [],
          stale: false,
          missing: true,
        },
        timezone: profile.timezone,
        nowMs,
        now,
        summary,
      });
      if (candidate) candidates.push(candidate);
    }

    if (candidates.length === 0) {
      summary.skipped.noGoodForecasts++;
      logNoGoodForecasts(profile.id, alertDate, beachIds.length);
      continue;
    }

    await enqueueDailyForecastSummary({
      supabase,
      userId: profile.id,
      alertDate,
      timezone: profile.timezone,
      candidates,
      summary,
    });
  }

  summary.durationMs = Date.now() - start;
  return summary;
}
