import type { SupabaseClient } from "@supabase/supabase-js";

import { assessRarity, buildEventKey, type DayScore } from "@/lib/alerts/swell-rarity";
import { loadUserPool } from "@/lib/alerts/user-pool";
import type { SwellWatchEvent } from "@/lib/alerts/swell-watch-detector";
import { isSwellAlertEnabled, isSwellAlertUserAllowed } from "@/lib/flags/swell-alert";
import { enqueueNotification } from "@/lib/notifications/enqueue";
import { selectTitle } from "@/lib/notifications/copy/select-title";
import titlePool from "@/lib/notifications/copy/surf-titles.v1.json";
import {
  MAJOR_SWELL_NOTIFICATION_SCHEMA_VERSION,
  parseMajorSwellNotificationPayload,
  type MajorSwellNotificationPayload,
} from "@/lib/notifications/types/major-swell";
import type { EnqueueArgs, EnqueueResult } from "@/lib/notifications/types";
import {
  loadNwsSwellAdvisories,
  loadOfficialSwellAdvisories,
} from "@/lib/recommendations/major-swell-awareness/official-advisory-adapter";
import { evaluateMajorSwellAwarenessShadow } from "@/lib/recommendations/major-swell-awareness/shadow-evaluator";
import { scoreNativeForecastSlot } from "@/lib/scoring/native-condition-score";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { getLocalDateString, getLocalHour } from "@/lib/utils/timezone-utils";
import type { Beach, Database } from "@/types/database";
import type { EnhancedForecastEntity } from "@/types/forecast";

const SEND_HOUR = 17;
const LOOKAHEAD_DAYS = 10;
const HISTORY_DAYS = 30;
const TITLE_HISTORY_DAYS = 120;
const COOLDOWN_MS = 72 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const GO_SCORE = 70;
const POSTGRES_UNIQUE_VIOLATION = "23505";

type ServiceClient = SupabaseClient<Database>;

export interface SwellAlertProfile {
  id: string;
  timezone: string;
  homeBeachId: string | null;
  location: { lat: number; lon: number } | null;
  maxDriveMinutes: number | null;
  experienceLevel: string | null;
  notifPushEnabled: boolean | null;
  notifSwellAlerts: boolean | null;
}

export interface SwellAlertCandidate {
  beach: {
    id: string;
    name: string;
    shortName: string | null;
    slug: string | null;
    state: string | null;
  };
  event: SwellWatchEvent;
  peakScore: number;
  direction: string | null;
  serious: boolean;
  awarenessSignal: "forecast_trend" | "corroborated";
  officialEvidenceRefs: string[];
}

export interface SwellAlertPoolEvaluation {
  history: DayScore[];
  candidates: SwellAlertCandidate[];
}

export interface SwellAlertState {
  eventExists: boolean;
  lastAlertAt: string | null;
  recentTitleIds: string[];
  recentFilmCount: number;
}

export interface SwellAlertDeps {
  isEnabled: () => boolean;
  isUserAllowed: (userId: string) => boolean;
  loadProfiles: () => Promise<SwellAlertProfile[]>;
  evaluatePool: (
    profile: SwellAlertProfile,
    now: Date,
  ) => Promise<SwellAlertPoolEvaluation>;
  loadAlertState: (
    userId: string,
    eventKey: string,
    now: Date,
  ) => Promise<SwellAlertState>;
  insertAlert: (args: {
    userId: string;
    eventKey: string;
    peakDate: string;
    leadBeachId: string;
    payload: MajorSwellNotificationPayload;
  }) => Promise<{ id: string } | null>;
  enqueue: (args: EnqueueArgs) => Promise<EnqueueResult>;
  markAlertEnqueued: (alertId: string, eventId: string) => Promise<void>;
}

export interface SwellAlertRunSummary {
  skipped: boolean;
  reason?: string;
  evaluated: number;
  candidates: number;
  sent: number;
  duplicates: number;
  skippedCounts: Record<string, number>;
  errors: number;
  durationMs: number;
}

interface AlertRow {
  event_key: string;
  created_at: string;
  payload: unknown;
}

function addCivilDays(localDate: string, days: number): string {
  const date = new Date(`${localDate}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function weekday(dateKey: string): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    timeZone: "UTC",
  }).format(new Date(`${dateKey}T12:00:00.000Z`));
}

function peakPart(forecastAt: string, timezone: string): string {
  const hour = getLocalHour(new Date(forecastAt), timezone);
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
}

function cardinalDirection(degrees: number | null): string | null {
  if (degrees == null || !Number.isFinite(degrees)) return null;
  const labels = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return labels[Math.round(((degrees % 360) + 360) % 360 / 45) % labels.length];
}

function directionFor(row: EnhancedForecastEntity): string | null {
  return row.wave_direction
    ?? row.swell_1_direction
    ?? cardinalDirection(row.wave_direction_om ?? row.swell_direction_om ?? null);
}

function scoreForecast(
  row: EnhancedForecastEntity,
  beach: Beach,
  experienceLevel: string | null,
): number {
  return scoreNativeForecastSlot(row, experienceLevel, null, {
    windDirectionDeg: row.wind_direction_deg ?? null,
    swellDirectionDeg: row.wave_direction_om ?? row.swell_direction_om ?? null,
    offshoreDeg: beach.wind_offshore_deg,
    offshoreToleranceDeg: beach.wind_offshore_tol_deg ?? 35,
    windowCenterDeg:
      beach.swell_window_center_deg_v2 ?? beach.swell_window_center_deg,
    windowHalfwidthDeg:
      beach.swell_window_halfwidth_deg_v2 ?? beach.swell_window_halfwidth_deg,
  });
}

function buildTags(
  candidate: SwellAlertCandidate,
  rarityKind: "best-in-30" | "first-after-flat",
): string[] {
  const tags = new Set<string>([
    rarityKind === "best-in-30" ? "biggest-in-weeks" : "first-after-flat",
    [0, 6].includes(new Date(`${candidate.event.peakDate}T12:00:00.000Z`).getUTCDay())
      ? "weekend"
      : "weekday",
    candidate.serious ? "serious" : "manageable",
    "generic",
  ]);
  const normalizedDirection = candidate.direction?.toUpperCase() ?? "";
  if (candidate.event.peakPeriodS >= 16) tags.add("long-period");
  if (/\b(?:S|SE|SW|SOUTH|SOUTHEAST|SOUTHWEST)\b/.test(normalizedDirection)) {
    tags.add("south");
  }
  if (/\b(?:NW|NORTHWEST)\b/.test(normalizedDirection)) tags.add("northwest");
  if (candidate.beach.state?.toUpperCase() === "HI") tags.add("hawaii");
  return [...tags];
}

function createSummary(): SwellAlertRunSummary {
  return {
    skipped: false,
    evaluated: 0,
    candidates: 0,
    sent: 0,
    duplicates: 0,
    skippedCounts: {},
    errors: 0,
    durationMs: 0,
  };
}

function increment(summary: SwellAlertRunSummary, reason: string): void {
  summary.skippedCounts[reason] = (summary.skippedCounts[reason] ?? 0) + 1;
}

async function loadProfiles(client: ServiceClient): Promise<SwellAlertProfile[]> {
  const { data, error } = await client
    .from("profiles")
    .select(`
      id,
      timezone,
      home_beach_id,
      max_drive_minutes,
      experience_level,
      notif_push_enabled,
      notif_swell_alerts,
      user_location_snapshots(lat, lon, timezone)
    `)
    .is("deleted_at", null);
  if (error) throw new Error(`Failed to load swell alert users: ${error.message}`);

  return (data ?? []).map((value) => {
    const row = value as typeof value & {
      user_location_snapshots:
        | { lat: number; lon: number; timezone: string }
        | Array<{ lat: number; lon: number; timezone: string }>
        | null;
    };
    const joined = Array.isArray(row.user_location_snapshots)
      ? row.user_location_snapshots[0]
      : row.user_location_snapshots;
    return {
      id: row.id,
      timezone: row.timezone ?? joined?.timezone ?? "America/Los_Angeles",
      homeBeachId: row.home_beach_id,
      location: joined ? { lat: joined.lat, lon: joined.lon } : null,
      maxDriveMinutes: row.max_drive_minutes,
      experienceLevel: row.experience_level,
      notifPushEnabled: row.notif_push_enabled,
      notifSwellAlerts: row.notif_swell_alerts,
    };
  });
}

async function evaluatePool(
  client: ServiceClient,
  profile: SwellAlertProfile,
  now: Date,
): Promise<SwellAlertPoolEvaluation> {
  const pool = await loadUserPool({
    supabase: client,
    userId: profile.id,
    homeBeachId: profile.homeBeachId,
    location: profile.location,
    maxDriveMinutes: profile.maxDriveMinutes,
  });
  if (pool.length === 0) return { history: [], candidates: [] };

  const historyStart = new Date(now.getTime() - HISTORY_DAYS * DAY_MS);
  const horizon = new Date(now.getTime() + LOOKAHEAD_DAYS * DAY_MS);
  const { data, error } = await client
    .from("enhanced_forecasts")
    .select("*")
    .in("beach_id", pool.map(({ beach }) => beach.id))
    .gte("forecast_at", historyStart.toISOString())
    .lt("forecast_at", horizon.toISOString())
    .order("forecast_at", { ascending: true });
  if (error) throw new Error(`Failed to load swell alert forecasts: ${error.message}`);

  const forecasts = (data ?? []) as EnhancedForecastEntity[];
  const forecastsByBeach = new Map<string, EnhancedForecastEntity[]>();
  for (const forecast of forecasts) {
    const rows = forecastsByBeach.get(forecast.beach_id) ?? [];
    rows.push(forecast);
    forecastsByBeach.set(forecast.beach_id, rows);
  }

  const today = getLocalDateString(now, profile.timezone);
  const historyByDate = new Map<string, number>();
  for (const { beach } of pool) {
    for (const forecast of forecastsByBeach.get(beach.id) ?? []) {
      const localDate = getLocalDateString(new Date(forecast.forecast_at), profile.timezone);
      const localHour = getLocalHour(new Date(forecast.forecast_at), profile.timezone);
      if (localDate >= today || localHour < 6 || localHour >= 19) continue;
      const score = scoreForecast(forecast, beach, profile.experienceLevel);
      historyByDate.set(localDate, Math.max(historyByDate.get(localDate) ?? 0, score));
    }
  }
  const history = [...historyByDate.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([localDate, bestScore]) => ({
      localDate,
      bestScore,
      go: bestScore >= GO_SCORE,
    }));

  // The detector needs the two days before event start as its rise baseline.
  const detectorAnchor = new Date(now.getTime() - DAY_MS);
  const tomorrow = addCivilDays(today, 1);
  const candidates = await Promise.all(pool.map(async ({ beach }) => {
    const beachForecasts = forecastsByBeach.get(beach.id) ?? [];
    const ledgerAdvisories = await loadOfficialSwellAdvisories({
      supabase: client,
      beachId: beach.id,
      timezone: profile.timezone,
      now,
    });
    let nwsAdvisories: Awaited<ReturnType<typeof loadNwsSwellAdvisories>> = [];
    try {
      nwsAdvisories = await loadNwsSwellAdvisories({
        zone: beach.nws_forecast_zone,
        beachId: beach.id,
        now,
      });
    } catch (error) {
      console.warn(`[swell-alert] NWS advisory fetch failed for ${beach.id}:`, error);
    }
    const officialAdvisories = [...ledgerAdvisories, ...nwsAdvisories];
    const awareness = evaluateMajorSwellAwarenessShadow({
      beachId: beach.id,
      forecasts: beachForecasts,
      timezone: profile.timezone,
      now: detectorAnchor,
      officialAdvisories,
    });
    const event = awareness.event;
    if (!event || event.eventStartDate !== tomorrow) return null;

    const peakForecast = beachForecasts.find(
      (forecast) => forecast.forecast_at === event.peakForecastAt,
    );
    if (!peakForecast) return null;
    return {
      beach: {
        id: beach.id,
        name: beach.name,
        shortName: beach.short_name,
        slug: beach.slug,
        state: beach.state,
      },
      event,
      peakScore: scoreForecast(peakForecast, beach, profile.experienceLevel),
      direction: directionFor(peakForecast),
      serious: event.peakHeightFt >= 8 || officialAdvisories.some(
        ({ kind }) => kind === "high_surf" || kind === "tropical_cyclone",
      ),
      awarenessSignal: awareness.signal === "corroborated"
        ? "corroborated" as const
        : "forecast_trend" as const,
      officialEvidenceRefs: awareness.officialEvidenceRefs,
    };
  }));

  return {
    history,
    candidates: candidates.filter(
      (candidate): candidate is SwellAlertCandidate => candidate !== null,
    ),
  };
}

async function loadAlertState(
  client: ServiceClient,
  userId: string,
  eventKey: string,
  now: Date,
): Promise<SwellAlertState> {
  const since = new Date(now.getTime() - TITLE_HISTORY_DAYS * DAY_MS).toISOString();
  const { data, error } = await client
    .from("swell_event_alerts")
    .select("event_key, created_at, payload")
    .eq("user_id", userId)
    .gte("created_at", since)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Failed to load swell alert history: ${error.message}`);

  const rows = (data ?? []) as AlertRow[];
  const titleIds = rows.flatMap((row) => {
    if (typeof row.payload !== "object" || row.payload === null || Array.isArray(row.payload)) {
      return [];
    }
    const titleId = (row.payload as { title_id?: unknown }).title_id;
    return typeof titleId === "string" ? [titleId] : [];
  });
  const filmIds = new Set(titlePool.swell.filter(({ film }) => film).map(({ id }) => id));
  return {
    eventExists: rows.some((row) => row.event_key === eventKey),
    lastAlertAt: rows[0]?.created_at ?? null,
    recentTitleIds: titleIds,
    recentFilmCount: titleIds.slice(0, 3).filter((id) => filmIds.has(id)).length,
  };
}

function defaultDependencies(args: {
  supabase?: ServiceClient;
  deps?: Partial<SwellAlertDeps>;
}): SwellAlertDeps {
  let client = args.supabase;
  const getClient = (): ServiceClient => {
    client ??= createSupabaseServiceRoleClient();
    return client;
  };

  return {
    isEnabled: args.deps?.isEnabled ?? isSwellAlertEnabled,
    isUserAllowed: args.deps?.isUserAllowed ?? isSwellAlertUserAllowed,
    loadProfiles: args.deps?.loadProfiles ?? (() => loadProfiles(getClient())),
    evaluatePool: args.deps?.evaluatePool
      ?? ((profile, now) => evaluatePool(getClient(), profile, now)),
    loadAlertState: args.deps?.loadAlertState
      ?? ((userId, eventKey, now) => loadAlertState(getClient(), userId, eventKey, now)),
    insertAlert: args.deps?.insertAlert ?? (async (input) => {
      const { data, error } = await getClient()
        .from("swell_event_alerts")
        .insert({
          user_id: input.userId,
          event_key: input.eventKey,
          peak_date: input.peakDate,
          lead_beach_id: input.leadBeachId,
          payload: input.payload as never,
        })
        .select("id")
        .single();
      if (error?.code === POSTGRES_UNIQUE_VIOLATION) return null;
      if (error) throw new Error(`Failed to insert swell alert: ${error.message}`);
      return data;
    }),
    enqueue: args.deps?.enqueue
      ?? ((input) => enqueueNotification(input, getClient())),
    markAlertEnqueued: args.deps?.markAlertEnqueued ?? (async (alertId, eventId) => {
      const { error } = await getClient()
        .from("swell_event_alerts")
        .update({
          sent_at: new Date().toISOString(),
          notification_event_id: eventId,
        })
        .eq("id", alertId);
      if (error) throw new Error(`Failed to mark swell alert sent: ${error.message}`);
    }),
  };
}

export async function runSwellAlertCron(args: {
  now: Date;
  supabase?: ServiceClient;
  deps?: Partial<SwellAlertDeps>;
}): Promise<SwellAlertRunSummary> {
  const startedAt = Date.now();
  const deps = defaultDependencies(args);
  const summary = createSummary();
  if (!deps.isEnabled()) {
    summary.skipped = true;
    summary.reason = "disabled";
    summary.durationMs = Date.now() - startedAt;
    return summary;
  }

  const profiles = await deps.loadProfiles();
  for (const profile of profiles) {
    summary.evaluated += 1;
    if (profile.notifPushEnabled === false || profile.notifSwellAlerts === false) {
      increment(summary, "disabled_preferences");
      continue;
    }
    if (!deps.isUserAllowed(profile.id)) {
      increment(summary, "not_allowed");
      continue;
    }
    if (getLocalHour(args.now, profile.timezone) !== SEND_HOUR) {
      increment(summary, "not_send_hour");
      continue;
    }

    try {
      const evaluation = await deps.evaluatePool(profile, args.now);
      const tomorrow = addCivilDays(getLocalDateString(args.now, profile.timezone), 1);
      const candidates = evaluation.candidates
        .filter(({ event }) => event.eventStartDate === tomorrow)
        .sort((left, right) =>
          right.peakScore - left.peakScore
          || left.beach.id.localeCompare(right.beach.id));
      summary.candidates += candidates.length;
      const lead = candidates[0];
      if (!lead) {
        increment(summary, "no_event_tomorrow");
        continue;
      }

      const rarity = assessRarity({
        peakDate: lead.event.peakDate,
        history: evaluation.history,
        peakScore: lead.peakScore,
        peakGo: lead.peakScore >= GO_SCORE,
      });
      if (!rarity.rare || !rarity.kind || !rarity.rarityLine) {
        increment(summary, "not_rare");
        continue;
      }

      const eventKey = buildEventKey({
        peakDate: lead.event.peakDate,
        leadBeachId: lead.beach.id,
      });
      const state = await deps.loadAlertState(profile.id, eventKey, args.now);
      if (state.eventExists) {
        increment(summary, "event_exists");
        continue;
      }
      const lastAlertAt = Date.parse(state.lastAlertAt ?? "");
      if (Number.isFinite(lastAlertAt) && args.now.getTime() - lastAlertAt < COOLDOWN_MS) {
        increment(summary, "cooldown_72h");
        continue;
      }

      const rankedBeaches = candidates.slice(0, 3).map((candidate, index) => ({
        beach_id: candidate.beach.id,
        beach_name: candidate.beach.shortName ?? candidate.beach.name,
        rank: index + 1,
      }));
      const beachNames = rankedBeaches.map(({ beach_name }) => beach_name);
      const direction = lead.direction ?? "Unknown direction";
      const selected = selectTitle({
        pool: "swell",
        tags: buildTags(lead, rarity.kind),
        userId: profile.id,
        eventKey,
        recentTitleIds: state.recentTitleIds,
        recentFilmCount: state.recentFilmCount,
        vars: {
          beach1: beachNames[0],
          beach2: beachNames[1] ?? beachNames[0],
          beach3: beachNames[2] ?? beachNames[1] ?? beachNames[0],
          dir: direction,
          size: `${formatNumber(lead.event.peakHeightFt)}ft`,
          period: `${formatNumber(lead.event.peakPeriodS)}s`,
          peak_day: weekday(lead.event.peakDate),
          peak_part: peakPart(lead.event.peakForecastAt, profile.timezone),
          rarity: rarity.rarityLine,
        },
      });
      const payload = parseMajorSwellNotificationPayload({
        schema_version: MAJOR_SWELL_NOTIFICATION_SCHEMA_VERSION,
        beach_id: lead.beach.id,
        ...(lead.beach.slug ? { beach_slug: lead.beach.slug } : {}),
        beach_name: lead.beach.name,
        event_start_date: lead.event.eventStartDate,
        peak_date: lead.event.peakDate,
        peak_height_ft: lead.event.peakHeightFt,
        peak_period_s: lead.event.peakPeriodS,
        forecast_at: lead.event.peakForecastAt,
        awareness_mode: "shadow",
        automation_enabled: false,
        awareness_signal: lead.awarenessSignal,
        awareness_severity: lead.serious ? "major" : "significant",
        official_evidence_refs: lead.officialEvidenceRefs,
        would_suppress_cohorts: ["beginner", "intermediate", "unknown"],
        enforcement: null,
        title: selected.title,
        body: selected.body,
        beaches: rankedBeaches,
        rarity: rarity.rarityLine,
        event_key: eventKey,
        title_id: selected.id,
      });
      const alert = await deps.insertAlert({
        userId: profile.id,
        eventKey,
        peakDate: lead.event.peakDate,
        leadBeachId: lead.beach.id,
        payload,
      });
      if (!alert) {
        increment(summary, "event_exists");
        continue;
      }

      const enqueued = await deps.enqueue({
        type: "swell_watch",
        recipientUserId: profile.id,
        dedupeKey: `swell_watch:${profile.id}:${eventKey}`,
        payload,
      });
      if (!enqueued.enqueued) {
        if (enqueued.reason === "duplicate") {
          summary.duplicates += 1;
        } else {
          increment(summary, "enqueue_failed");
          summary.errors += 1;
        }
        continue;
      }

      await deps.markAlertEnqueued(alert.id, enqueued.eventId);
      summary.sent += 1;
    } catch (error) {
      console.error(`[swell-alert] Error processing ${profile.id}:`, error);
      summary.errors += 1;
    }
  }

  summary.durationMs = Date.now() - startedAt;
  return summary;
}
