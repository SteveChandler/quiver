import { persistableSessionDecision } from "@/lib/recommendations/canonical-decision/contract";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isDailyCallEnabled, isDailyCallUserAllowed } from "@/lib/flags/daily-call";
import { loadUserPool, type PoolBeach } from "@/lib/alerts/user-pool";
import {
  refineWindow,
  type RefinedWindow,
} from "@/lib/alerts/window-refiner";
import {
  isSendHour,
  parseDailyCallTime,
} from "@/lib/alerts/send-time";
import { getDaylightWindow } from "@/lib/alerts/sunrise";
import { enqueueNotification } from "@/lib/notifications/enqueue";
import {
  selectTitle,
  type SelectTitleArgs,
  type SelectedTitle,
} from "@/lib/notifications/copy/select-title";
import type { EnqueueArgs, EnqueueResult } from "@/lib/notifications/types";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { buildCanonicalSessionDecision } from "@/lib/recommendations/canonical-decision";
import { getRecommendationLabel } from "@/lib/services/discovery/response-formatter";
import {
  scoreWindowConditionScore,
  selectBestWindows,
} from "@/lib/services/discovery/window-selector";
import { TideCache } from "@/lib/services/noaa-coops/tide-cache";
import type { COOPSForecast } from "@/lib/services/noaa-coops/types";
import { localDateTimeToUTC } from "@/lib/utils/forecast-time-resolver";
import {
  getLocalDateString,
  getLocalHour,
  resolveBeachTimezone,
} from "@/lib/utils/timezone-utils";
import type { Beach, Database } from "@/types/database";
import type { EnhancedForecastEntity } from "@/types/forecast";
import { DAILY_CALL_SCHEMA_VERSION } from "@/lib/notifications/types/daily-call";
import {
  comparisonLine,
  formatWindowLabel,
  limitSentence,
  notificationBeachName,
  swellPhrase,
  windPhrase,
} from "@/lib/notifications/copy/daily-call-copy";

const WINDOW_CLOSE_BUFFER_MS = 30 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

export interface DailyCallCandidate {
  pool: PoolBeach;
  window: RefinedWindow;
  physicalScore: number;
  personalFit: number;
  verdict: "go";
  decisionId: string;
  sessionDecision: unknown;
}

export interface DailyCallRunSummary {
  evaluated: number;
  sent: number;
  silent: number;
  skippedCounts: Record<string, number>;
  errors: number;
  durationMs: number;
}

export interface DailyCallProfile {
  id: string;
  homeBeachId: string | null;
  timezone: string | null;
  dailyCallTime: string | null;
  notifPushEnabled: boolean | null;
  notifForecastAlerts: boolean | null;
  experienceLevel: string | null;
  maxDriveMinutes: number | null;
  location: { lat: number; lon: number; timezone: string } | null;
  homeBeach: Beach | null;
}

interface CandidateBuildResult {
  candidates: DailyCallCandidate[];
  hadForecasts: boolean;
}

interface BuildCandidatesArgs {
  profile: DailyCallProfile;
  pool: PoolBeach[];
  timezone: string;
  alertDate: string;
  now: Date;
}

export interface DailyCallDeps {
  isEnabled: () => boolean;
  isUserAllowed: (userId: string) => boolean;
  loadProfiles: (supabase: SupabaseClient<Database>) => Promise<DailyCallProfile[]>;
  resolveTimezone: (profile: DailyCallProfile) => string;
  getSunrise: (profile: DailyCallProfile, now: Date) => Date | null;
  loadPool: (args: {
    supabase: SupabaseClient<Database>;
    userId: string;
    homeBeachId: string | null;
    location: { lat: number; lon: number } | null;
    maxDriveMinutes: number | null;
  }) => Promise<PoolBeach[]>;
  buildCandidates: (args: BuildCandidatesArgs) => Promise<CandidateBuildResult>;
  alreadySentToday: (userId: string, alertDate: string) => Promise<boolean>;
  loadSwellEventKey: (userId: string, alertDate: string) => Promise<string | null>;
  loadRecentTitleIds: (userId: string, since: Date) => Promise<string[]>;
  selectTitle: (args: SelectTitleArgs) => SelectedTitle;
  enqueue: (
    args: EnqueueArgs,
    supabase: SupabaseClient<Database>,
  ) => Promise<EnqueueResult>;
}

interface EvaluatedCandidate extends DailyCallCandidate {
  sourceForecast: EnhancedForecastEntity;
  timezone: string;
}

interface ForecastEvaluation {
  forecast: EnhancedForecastEntity;
  score: number;
  verdict: "go" | "maybe" | "no";
  decision: ReturnType<typeof buildCanonicalSessionDecision>;
}

function skippedCounts(): Record<string, number> {
  return {
    no_go_window: 0,
    window_closing_within_30m: 0,
    already_sent_today: 0,
    disabled: 0,
    allowlist: 0,
    no_pool: 0,
    no_forecast: 0,
    not_send_hour: 0,
    enqueue_failed: 0,
  };
}

function increment(summary: DailyCallRunSummary, key: string): void {
  summary.skippedCounts[key] = (summary.skippedCounts[key] ?? 0) + 1;
}

function relationRank(candidate: DailyCallCandidate, homeBeachId: string | null): number {
  if (candidate.pool.beach.id === homeBeachId) return 3;
  if (candidate.pool.relation === "favorite" || candidate.pool.relation === "custom") {
    return 2;
  }
  return 1;
}

export function rankCandidates(
  candidates: DailyCallCandidate[],
  homeBeachId: string | null,
): DailyCallCandidate[] {
  return [...candidates].sort((left, right) =>
    right.physicalScore - left.physicalScore
    || right.personalFit - left.personalFit
    || relationRank(right, homeBeachId) - relationRank(left, homeBeachId)
    || Date.parse(left.window.start) - Date.parse(right.window.start)
    || left.pool.beach.id.localeCompare(right.pool.beach.id));
}

/**
 * Why the winner beat the surfer's home beach, from both forecasts. Home is only
 * compared when it produced its own go window; otherwise nothing is claimed.
 */
export function buildComparisonLine(
  winner: DailyCallCandidate,
  home: DailyCallCandidate | null,
): string | null {
  if (!home || winner.pool.beach.id === home.pool.beach.id) return null;
  const winnerForecast = candidateDetails(winner)?.sourceForecast;
  const homeForecast = candidateDetails(home)?.sourceForecast;
  if (!winnerForecast || !homeForecast) return null;
  return comparisonLine(
    { forecast: winnerForecast, minutes: winner.window.minutes },
    { forecast: homeForecast, minutes: home.window.minutes, name: notificationBeachName(home.pool.beach) },
  );
}

function numberValue(value: unknown): number {
  const parsed = Number.parseFloat(String(value ?? ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function windowLabel(candidate: DailyCallCandidate, timezone: string): string {
  const startDriver = candidate.window.drivers.find((driver) => driver.edge === "start");
  const endDriver = candidate.window.drivers.find((driver) => driver.edge === "end");
  return formatWindowLabel(candidate.window.start, candidate.window.end, timezone, {
    approximateStart: startDriver?.approximate ?? false,
    approximateEnd: endDriver?.approximate ?? false,
  });
}

function candidateDetails(candidate: DailyCallCandidate): EvaluatedCandidate | null {
  const value = candidate as Partial<EvaluatedCandidate>;
  return value.sourceForecast && value.timezone ? value as EvaluatedCandidate : null;
}

function titleTags(
  candidate: DailyCallCandidate,
  homeBeachId: string | null,
  timezone: string,
  now: Date,
  swellEventKey: string | null,
): string[] {
  const tags = new Set<string>(["generic"]);
  const endDriver = candidate.window.drivers.find((driver) => driver.edge === "end");
  if (endDriver?.kind === "tide") tags.add("tide-driven");
  if (endDriver?.kind === "wind") tags.add("wind-driven");
  const startHour = getLocalHour(new Date(candidate.window.start), timezone);
  if (startHour < 7) tags.add("early");
  if (startHour >= 12) tags.add("afternoon");
  // Without a home beach there is no "home" to be at or away from.
  if (homeBeachId) tags.add(candidate.pool.beach.id === homeBeachId ? "home-beach" : "not-home");
  if (Date.parse(candidate.window.start) <= now.getTime()) tags.add("live");
  if (swellEventKey) tags.add("swell-day");
  return [...tags];
}

function titleVars(
  candidate: DailyCallCandidate,
  profile: DailyCallProfile,
  timezone: string,
  comparison: string | null,
): Record<string, string> {
  const forecast = candidateDetails(candidate)?.sourceForecast ?? {};
  const beach = notificationBeachName(candidate.pool.beach);
  return {
    beach,
    home_beach: profile.homeBeach ? notificationBeachName(profile.homeBeach) : beach,
    window: formatWindowLabel(candidate.window.start, candidate.window.end, timezone),
    lead: comparison ? `${comparison}: ` : "",
    swell: swellPhrase(forecast),
    wind: windPhrase(forecast),
    limit: limitSentence(candidate.window.drivers, candidate.window.end, timezone),
  };
}

/** The same sentence the title pool renders, for a call that fell back to no template. */
function fallbackReason(vars: Record<string, string>): string {
  return `${vars.lead}${vars.swell} with ${vars.wind}. ${vars.limit}`;
}

function buildPayload(args: {
  candidate: DailyCallCandidate;
  profile: DailyCallProfile;
  timezone: string;
  alertDate: string;
  title: SelectedTitle;
  vars: Record<string, string>;
  comparison: string | null;
  swellEventKey: string | null;
}): Record<string, unknown> {
  const details = candidateDetails(args.candidate);
  const forecast = details?.sourceForecast;
  return {
    schema_version: DAILY_CALL_SCHEMA_VERSION,
    beach_id: args.candidate.pool.beach.id,
    beach_slug: args.candidate.pool.beach.slug,
    beach_name: args.candidate.pool.beach.short_name ?? args.candidate.pool.beach.name,
    alert_date: args.alertDate,
    window_start: args.candidate.window.start,
    window_end: args.candidate.window.end,
    window_local: windowLabel(args.candidate, args.timezone),
    drivers: args.candidate.window.drivers,
    wave_height_ft: numberValue(forecast?.wave_height),
    wave_period_s: numberValue(forecast?.wave_period),
    swell_dir: forecast?.wave_direction ?? forecast?.swell_1_direction ?? "unknown",
    wind_label: forecast?.wind_direction
      ? `${numberValue(forecast.wind_speed)}mph ${forecast.wind_direction}`
      : `${numberValue(forecast?.wind_speed)}mph`,
    tide_label: forecast?.tide_status ?? "Unknown tide",
    reason: args.title.body || fallbackReason(args.vars),
    title: args.title.title,
    title_id: args.title.id,
    comparison: args.comparison,
    swell_event_key: args.swellEventKey,
    decision_id: args.candidate.decisionId,
    session_decision: persistableSessionDecision(args.candidate.sessionDecision),
  };
}

function groupGoForecasts(evaluations: ForecastEvaluation[]): ForecastEvaluation[][] {
  const groups: ForecastEvaluation[][] = [];
  for (const evaluation of evaluations) {
    if (evaluation.verdict !== "go") continue;
    const current = groups.at(-1);
    const previous = current?.at(-1);
    if (
      current
      &&
      previous
      && Date.parse(evaluation.forecast.forecast_at) - Date.parse(previous.forecast.forecast_at) <= HOUR_MS
    ) {
      current.push(evaluation);
    } else {
      groups.push([evaluation]);
    }
  }
  return groups;
}

function evaluateForecast(
  profile: DailyCallProfile,
  pool: PoolBeach,
  forecast: EnhancedForecastEntity,
  timezone: string,
  now: Date,
): ForecastEvaluation {
  const score = scoreWindowConditionScore(
    forecast,
    pool.beach,
    profile.experienceLevel,
  );
  const start = new Date(forecast.forecast_at);
  const end = new Date(start.getTime() + HOUR_MS);
  const decision = buildCanonicalSessionDecision({
    anchorTime: now.toISOString(),
    scope: {
      kind: "plan_next_session",
      windowStart: start.toISOString(),
      windowEnd: end.toISOString(),
      timezone,
    },
    profileExperience: profile.experienceLevel,
    recommendationAvailability: {
      state: "available",
      holdEpoch: "daily-call",
      resolutionAsOf: now.toISOString(),
    },
    candidates: [{
      candidateId: `daily-call:${pool.beach.id}:${forecast.forecast_at}`,
      beachId: pool.beach.id,
      beachName: pool.beach.name,
      beachSkillLevel: pool.beach.skill_level,
      windowStart: start.toISOString(),
      windowEnd: end.toISOString(),
      timezone,
      forecastId: forecast.id,
      forecastAt: forecast.forecast_at,
      waveHeight: forecast.wave_height,
      utilityScore: score,
      recommendationLabel: getRecommendationLabel(score),
    }],
  });
  return { forecast, score, verdict: decision.verdict, decision };
}

function cachedTideSamples(
  cache: TideCache,
  beachId: string,
): Array<{ at: string; heightFt: number }> | null {
  const cached = cache.get(beachId);
  if (!cached) return null;
  return cached.tides.map((tide) => ({
    at: new Date(tide.time * 1000).toISOString(),
    heightFt: tide.height,
  }));
}

async function loadTideSamples(
  supabase: SupabaseClient<Database>,
  cache: TideCache,
  beachId: string,
  start: string,
  end: string,
): Promise<Array<{ at: string; heightFt: number }> | null> {
  const cached = cachedTideSamples(cache, beachId);
  if (cached) return cached;
  const { data, error } = await supabase
    .from("tide_forecasts")
    .select("ts, tide_ft, tide_height_m")
    .eq("beach_id", beachId)
    .gte("ts", start)
    .lt("ts", end)
    .order("ts", { ascending: true });
  if (error) throw new Error(`Failed to load tide forecasts for ${beachId}: ${error.message}`);
  const samples = (data ?? []).flatMap((row) => {
    const heightFt = row.tide_ft ?? (row.tide_height_m == null ? null : row.tide_height_m * 3.28084);
    return heightFt == null ? [] : [{ at: row.ts, heightFt }];
  });
  if (samples.length === 0) return null;
  const value: COOPSForecast = {
    station_id: `cached_${beachId}`,
    station_name: "Cached Tide Data",
    water_level: null,
    tides: samples.map((sample) => ({
      time: Date.parse(sample.at) / 1000,
      height: sample.heightFt,
      name: "Tide sample",
      type: "high",
    })),
  };
  cache.set(beachId, value);
  return samples;
}

async function buildCandidates(
  supabase: SupabaseClient<Database>,
  tideCache: TideCache,
  args: BuildCandidatesArgs,
): Promise<CandidateBuildResult> {
  const beachIds = args.pool.map((value) => value.beach.id);
  const start = localDateTimeToUTC(args.alertDate, "05:00:00", args.timezone).toISOString();
  const end = localDateTimeToUTC(args.alertDate, "20:00:00", args.timezone).toISOString();
  const { data, error } = await supabase
    .from("enhanced_forecasts")
    .select("*")
    .in("beach_id", beachIds)
    .gte("forecast_at", start)
    .lt("forecast_at", end)
    .order("forecast_at", { ascending: true });
  if (error) throw new Error(`Failed to load daily-call forecasts: ${error.message}`);
  const forecasts = (data ?? []) as EnhancedForecastEntity[];
  const candidates: EvaluatedCandidate[] = [];

  for (const pool of args.pool) {
    const beachForecasts = forecasts.filter((row) => row.beach_id === pool.beach.id);
    if (beachForecasts.length === 0) continue;
    const evaluations = beachForecasts.map((forecast) =>
      evaluateForecast(args.profile, pool, forecast, args.timezone, args.now));
    const verdictById = new Map(evaluations.map((value) => [value.forecast.id, value.verdict]));
    const tideSamples = await loadTideSamples(
      supabase,
      tideCache,
      pool.beach.id,
      start,
      end,
    );

    for (const group of groupGoForecasts(evaluations)) {
      const first = group[0];
      const last = group[group.length - 1];
      const coarse = {
        start: new Date(first.forecast.forecast_at).toISOString(),
        end: new Date(Date.parse(last.forecast.forecast_at) + HOUR_MS).toISOString(),
      };
      const daylight = getDaylightWindow(pool.beach.lat, pool.beach.lon, new Date(coarse.start));
      const refined = refineWindow({
        coarse,
        forecasts: beachForecasts,
        beach: pool.beach,
        tideSamples,
        daylight: {
          sunrise: daylight.sunrise.toISOString(),
          sunset: daylight.sunset.toISOString(),
        },
        verdictAt: (forecast) => verdictById.get(forecast.id) ?? "no",
      });
      if (!refined) continue;
      const selected = selectBestWindows({
        forecasts: group.map((value) => value.forecast),
        beach: pool.beach,
        userPrefs: null,
        now: args.now,
        maxWindows: 1,
        userSkillLevel: args.profile.experienceLevel,
      })[0];
      const best = [...group].sort((left, right) => right.score - left.score)[0];
      const sourceForecast = selected?.sourceForecast ?? best.forecast;
      candidates.push({
        pool,
        window: refined,
        physicalScore: selected?.score ?? best.score,
        personalFit: 0,
        verdict: "go",
        decisionId: best.decision.decisionId,
        sessionDecision: best.decision,
        sourceForecast,
        timezone: args.timezone,
      });
    }
  }

  return { candidates, hadForecasts: forecasts.length > 0 };
}

async function loadProfiles(
  supabase: SupabaseClient<Database>,
): Promise<DailyCallProfile[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, home_beach_id, timezone, daily_call_time, notif_push_enabled, notif_forecast_alerts, experience_level, max_drive_minutes")
    .is("deleted_at", null);
  if (error) throw new Error(`Failed to load daily-call profiles: ${error.message}`);
  const rows = data ?? [];
  const userIds = rows.map((row) => row.id);
  const homeBeachIds = rows.flatMap((row) => row.home_beach_id ? [row.home_beach_id] : []);
  const [locationsResult, beachesResult] = await Promise.all([
    userIds.length === 0
      ? Promise.resolve({ data: [], error: null })
      : supabase
          .from("user_location_snapshots")
          .select("user_id, lat, lon, timezone")
          .in("user_id", userIds),
    homeBeachIds.length === 0
      ? Promise.resolve({ data: [], error: null })
      : supabase.from("beaches").select("*").in("id", homeBeachIds),
  ]);
  if (locationsResult.error) {
    throw new Error(`Failed to load daily-call locations: ${locationsResult.error.message}`);
  }
  if (beachesResult.error) {
    throw new Error(`Failed to load daily-call home beaches: ${beachesResult.error.message}`);
  }
  const locations = new Map((locationsResult.data ?? []).map((row) => [row.user_id, row]));
  const beaches = new Map(((beachesResult.data ?? []) as Beach[]).map((beach) => [beach.id, beach]));
  return rows.map((row) => ({
    id: row.id,
    homeBeachId: row.home_beach_id,
    timezone: row.timezone,
    dailyCallTime: row.daily_call_time,
    notifPushEnabled: row.notif_push_enabled,
    notifForecastAlerts: row.notif_forecast_alerts,
    experienceLevel: row.experience_level,
    maxDriveMinutes: row.max_drive_minutes,
    location: locations.get(row.id) ?? null,
    homeBeach: row.home_beach_id ? beaches.get(row.home_beach_id) ?? null : null,
  }));
}

function defaultDeps(
  supabase: SupabaseClient<Database>,
): DailyCallDeps {
  const tideCache = new TideCache();
  return {
    isEnabled: isDailyCallEnabled,
    isUserAllowed: isDailyCallUserAllowed,
    loadProfiles,
    resolveTimezone: (profile) => resolveBeachTimezone(
      profile.timezone ?? profile.homeBeach?.timezone ?? profile.location?.timezone,
    ),
    getSunrise: (profile, now) => {
      const lat = profile.homeBeach?.lat ?? profile.location?.lat;
      const lon = profile.homeBeach?.lon ?? profile.location?.lon;
      return lat == null || lon == null ? null : getDaylightWindow(lat, lon, now).sunrise;
    },
    loadPool: loadUserPool,
    buildCandidates: (args) => buildCandidates(supabase, tideCache, args),
    alreadySentToday: async (userId, alertDate) => {
      const { data, error } = await supabase
        .from("notification_events")
        .select("id")
        .eq("recipient_user_id", userId)
        .eq("type", "daily_call")
        .eq("dedupe_key", `daily_call:${userId}:${alertDate}`)
        .limit(1)
        .maybeSingle();
      if (error) throw new Error(`Failed to check daily-call dedupe: ${error.message}`);
      return data !== null;
    },
    loadSwellEventKey: async (userId, alertDate) => {
      const { data, error } = await supabase
        .from("swell_event_alerts")
        .select("event_key")
        .eq("user_id", userId)
        .eq("peak_date", alertDate)
        .limit(1)
        .maybeSingle();
      if (error) throw new Error(`Failed to load daily-call swell event: ${error.message}`);
      return data?.event_key ?? null;
    },
    loadRecentTitleIds: async (userId, since) => {
      const { data, error } = await supabase
        .from("notification_events")
        .select("payload")
        .eq("recipient_user_id", userId)
        .eq("type", "daily_call")
        .gte("created_at", since.toISOString());
      if (error) throw new Error(`Failed to load daily-call title history: ${error.message}`);
      return (data ?? []).flatMap(({ payload }) => {
        if (!payload || Array.isArray(payload) || typeof payload !== "object") return [];
        const titleId = (payload as Record<string, unknown>).title_id;
        return typeof titleId === "string" ? [titleId] : [];
      });
    },
    selectTitle,
    enqueue: enqueueNotification,
  };
}

export async function runDailyCallCron(args: {
  now: Date;
  supabase?: SupabaseClient<Database>;
  deps?: Partial<DailyCallDeps>;
}): Promise<DailyCallRunSummary> {
  const startedAt = Date.now();
  const supabase = args.supabase ?? createSupabaseServiceRoleClient();
  const deps = { ...defaultDeps(supabase), ...args.deps };
  const summary: DailyCallRunSummary = {
    evaluated: 0,
    sent: 0,
    silent: 0,
    skippedCounts: skippedCounts(),
    errors: 0,
    durationMs: 0,
  };

  if (!deps.isEnabled()) {
    increment(summary, "disabled");
    summary.durationMs = Date.now() - startedAt;
    return summary;
  }

  const profiles = await deps.loadProfiles(supabase);
  for (const profile of profiles) {
    summary.evaluated += 1;
    if (profile.notifPushEnabled !== true || profile.notifForecastAlerts !== true) {
      increment(summary, "disabled");
      continue;
    }
    if (!deps.isUserAllowed(profile.id)) {
      increment(summary, "allowlist");
      continue;
    }

    try {
      const timezone = deps.resolveTimezone(profile);
      if (!isSendHour({
        now: args.now,
        pref: parseDailyCallTime(profile.dailyCallTime),
        timezone,
        sunrise: deps.getSunrise(profile, args.now),
      })) {
        increment(summary, "not_send_hour");
        continue;
      }
      const alertDate = getLocalDateString(args.now, timezone);
      if (await deps.alreadySentToday(profile.id, alertDate)) {
        increment(summary, "already_sent_today");
        continue;
      }
      const pool = await deps.loadPool({
        supabase,
        userId: profile.id,
        homeBeachId: profile.homeBeachId,
        location: profile.location
          ? { lat: profile.location.lat, lon: profile.location.lon }
          : null,
        maxDriveMinutes: profile.maxDriveMinutes,
      });
      if (pool.length === 0) {
        increment(summary, "no_pool");
        summary.silent += 1;
        continue;
      }
      const built = await deps.buildCandidates({
        profile,
        pool,
        timezone,
        alertDate,
        now: args.now,
      });
      if (!built.hadForecasts) {
        increment(summary, "no_forecast");
        summary.silent += 1;
        continue;
      }
      const ranked = rankCandidates(built.candidates, profile.homeBeachId);
      const eligible = ranked.filter((candidate) => {
        const closing = Date.parse(candidate.window.end) - args.now.getTime() < WINDOW_CLOSE_BUFFER_MS;
        if (closing) increment(summary, "window_closing_within_30m");
        return !closing;
      });
      const winner = eligible[0];
      if (!winner) {
        increment(summary, "no_go_window");
        summary.silent += 1;
        continue;
      }
      const home = built.candidates.find((candidate) =>
        candidate.pool.beach.id === profile.homeBeachId) ?? null;
      const swellEventKey = await deps.loadSwellEventKey(profile.id, alertDate);
      const recentTitleIds = await deps.loadRecentTitleIds(
        profile.id,
        new Date(args.now.getTime() - 30 * 24 * HOUR_MS),
      );
      const comparison = buildComparisonLine(winner, home);
      const vars = titleVars(winner, profile, timezone, comparison);
      const title = deps.selectTitle({
        pool: "daily",
        tags: titleTags(winner, profile.homeBeachId, timezone, args.now, swellEventKey),
        userId: profile.id,
        eventKey: alertDate,
        recentTitleIds,
        recentFilmCount: 0,
        vars,
      });
      const enqueueResult = await deps.enqueue({
        type: "daily_call",
        recipientUserId: profile.id,
        dedupeKey: `daily_call:${profile.id}:${alertDate}`,
        payload: buildPayload({
          candidate: winner,
          profile,
          timezone,
          alertDate,
          title,
          vars,
          comparison,
          swellEventKey,
        }),
      }, supabase);
      if (enqueueResult.enqueued) {
        summary.sent += 1;
      } else if (enqueueResult.reason === "duplicate") {
        increment(summary, "already_sent_today");
      } else {
        increment(summary, "enqueue_failed");
        summary.errors += 1;
      }
    } catch (error) {
      console.error(`[daily-call] Error processing ${profile.id}:`, error);
      summary.errors += 1;
    }
  }

  summary.durationMs = Date.now() - startedAt;
  return summary;
}
