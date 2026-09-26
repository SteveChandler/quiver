import type { SupabaseClient } from "@supabase/supabase-js";

import { evaluateForecastVerdict, type ForecastVerdict } from "@/lib/alerts/canonical-forecast-verdict";
import {
  SWELL_EVENT_DETECTOR_VERSION,
  SWELL_EVENT_KEY_REUSE_DAYS,
  detectBeachSwellEvents,
  loadRecentSwellSnapshots,
  resolveEventKeys,
  toSwellEventBeach,
  type BeachSwellEvent,
  type SwellEventSnapshot,
} from "@/lib/alerts/swell-events";
import { assessRarity, type DayScore } from "@/lib/alerts/swell-rarity";
import {
  recordSwellEventForecast,
  type SwellEventForecastRecord,
} from "@/lib/alerts/swell-verification/record";
import { loadUserPool } from "@/lib/alerts/user-pool";
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
import type { OfficialSwellAdvisoryEvidence } from "@/lib/recommendations/major-swell-awareness/shadow-evaluator";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { getLocalDateString, getLocalHour, resolveBeachTimezone } from "@/lib/utils/timezone-utils";
import type { Beach, Database } from "@/types/database";
import type { EnhancedForecastEntity } from "@/types/forecast";

const SEND_HOUR = 17;
const LOOKAHEAD_DAYS = 10;
const HISTORY_DAYS = 30;
const TITLE_HISTORY_DAYS = 120;
const COOLDOWN_MS = 72 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const POSTGRES_UNIQUE_VIOLATION = "23505";
const FORECAST_PAGE_SIZE = 1000;
const PEAK_ROW_MAX_MS = 3 * 60 * 60 * 1000;
const OFFICIAL_ADVISORY_HORIZON_MS = 10 * DAY_MS;
const OFFICIAL_ADVISORY_KINDS = new Set(["high_surf", "tropical_cyclone", "high_rip_current"]);

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
  /** Detected swell event with its resolved (cross-run) key. */
  event: BeachSwellEvent;
  /** Arrival and peak local dates in the user's timezone. */
  arrivalDate: string;
  peakDate: string;
  peakScore: number;
  peakVerdict: ForecastVerdict["verdict"];
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
  recordForecast: (record: SwellEventForecastRecord) => Promise<{ inserted: boolean }>;
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
  verificationRecordFailures: number;
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

function buildTags(
  candidate: SwellAlertCandidate,
  rarityKind: "best-in-30" | "first-after-flat",
): string[] {
  const tags = new Set<string>([
    rarityKind === "best-in-30" ? "biggest-in-weeks" : "first-after-flat",
    [0, 6].includes(new Date(`${candidate.peakDate}T12:00:00.000Z`).getUTCDay())
      ? "weekend"
      : "weekday",
    candidate.serious ? "serious" : "manageable",
    "generic",
  ]);
  const normalizedDirection = candidate.event.directionLabel.toUpperCase();
  if (candidate.event.periodS >= 16) tags.add("long-period");
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
    verificationRecordFailures: 0,
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

/**
 * PostgREST caps every response (Supabase default 1,000 rows), and 40 days of
 * hourly rows for a few beaches exceeds that. Page until an empty page so a cap
 * of any size can never silently drop the future rows the detector needs.
 */
async function loadForecasts(
  client: ServiceClient,
  beachIds: string[],
  start: Date,
  end: Date,
): Promise<EnhancedForecastEntity[]> {
  const rows: EnhancedForecastEntity[] = [];
  while (true) {
    const { data, error } = await client
      .from("enhanced_forecasts")
      .select("*")
      .in("beach_id", beachIds)
      .gte("forecast_at", start.toISOString())
      .lt("forecast_at", end.toISOString())
      .order("forecast_at", { ascending: true })
      .order("beach_id", { ascending: true })
      .range(rows.length, rows.length + FORECAST_PAGE_SIZE - 1);
    if (error) throw new Error(`Failed to load swell alert forecasts: ${error.message}`);
    const page = (data ?? []) as EnhancedForecastEntity[];
    if (page.length === 0) return rows;
    rows.push(...page);
  }
}

/** Earlier runs' keys, so the push names the same swell Week Scout shows. A failed read never blocks: the detector's own keys stand. */
async function loadKeySnapshots(
  client: ServiceClient,
  beachIds: string[],
  now: Date,
): Promise<SwellEventSnapshot[]> {
  try {
    return await loadRecentSwellSnapshots(client, beachIds, new Date(now.getTime() - SWELL_EVENT_KEY_REUSE_DAYS * DAY_MS));
  } catch (error) {
    console.warn("[swell-alert] Snapshot read failed; using detector keys:", error);
    return [];
  }
}

function rowNearest(rows: readonly EnhancedForecastEntity[], at: string): EnhancedForecastEntity | null {
  const target = Date.parse(at);
  let nearest: EnhancedForecastEntity | null = null;
  for (const row of rows) {
    const diff = Math.abs(Date.parse(row.forecast_at) - target);
    if (diff <= PEAK_ROW_MAX_MS && (!nearest || diff < Math.abs(Date.parse(nearest.forecast_at) - target))) {
      nearest = row;
    }
  }
  return nearest;
}

/** The evidence rules the shadow evaluator applied, kept for corroboration. */
function validOfficialEvidenceRefs(
  advisories: readonly OfficialSwellAdvisoryEvidence[],
  beachId: string,
  now: Date,
): string[] {
  const refs = advisories.filter((evidence) => {
    const startsAt = Date.parse(evidence.startsAt);
    const endsAt = Date.parse(evidence.endsAt);
    return evidence.evidenceRef.trim().length > 0
      && OFFICIAL_ADVISORY_KINDS.has(evidence.kind)
      && Number.isFinite(startsAt)
      && Number.isFinite(endsAt)
      && startsAt < endsAt
      && endsAt > now.getTime()
      && startsAt <= now.getTime() + OFFICIAL_ADVISORY_HORIZON_MS
      && evidence.beachIds.includes(beachId);
  }).map(({ evidenceRef }) => evidenceRef);
  return [...new Set(refs)].sort((left, right) => left.localeCompare(right));
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

  const forecasts = await loadForecasts(
    client,
    pool.map(({ beach }) => beach.id),
    new Date(now.getTime() - HISTORY_DAYS * DAY_MS),
    new Date(now.getTime() + LOOKAHEAD_DAYS * DAY_MS),
  );
  const forecastsByBeach = new Map<string, EnhancedForecastEntity[]>();
  for (const forecast of forecasts) {
    const rows = forecastsByBeach.get(forecast.beach_id) ?? [];
    rows.push(forecast);
    forecastsByBeach.set(forecast.beach_id, rows);
  }

  const today = getLocalDateString(now, profile.timezone);
  const verdictFor = (
    forecast: EnhancedForecastEntity,
    beach: Beach,
  ): ForecastVerdict => evaluateForecastVerdict({
    forecast,
    beach,
    experienceLevel: profile.experienceLevel,
    timezone: profile.timezone,
    now,
    candidateIdPrefix: "swell-alert",
  });
  const historyByDate = new Map<string, DayScore>();
  for (const { beach } of pool) {
    for (const forecast of forecastsByBeach.get(beach.id) ?? []) {
      const localDate = getLocalDateString(new Date(forecast.forecast_at), profile.timezone);
      const localHour = getLocalHour(new Date(forecast.forecast_at), profile.timezone);
      // Today counts: its forecast is known, and "first after flat" needs the
      // day before a peak that is tomorrow at the earliest.
      if (localDate > today || localHour < 6 || localHour >= 19) continue;
      const { score, verdict } = verdictFor(forecast, beach);
      const day = historyByDate.get(localDate);
      historyByDate.set(localDate, {
        localDate,
        bestScore: Math.max(day?.bestScore ?? 0, score),
        go: (day?.go ?? false) || verdict === "go",
      });
    }
  }
  const history = [...historyByDate.values()]
    .sort((left, right) => left.localDate.localeCompare(right.localDate));

  const tomorrow = addCivilDays(today, 1);
  const snapshots = await loadKeySnapshots(client, pool.map(({ beach }) => beach.id), now);
  const candidates = await Promise.all(pool.map(async ({ beach }) => {
    const beachForecasts = forecastsByBeach.get(beach.id) ?? [];
    const events = resolveEventKeys(
      detectBeachSwellEvents({
        beach: toSwellEventBeach(beach),
        forecasts: beachForecasts,
        now,
        timezone: resolveBeachTimezone(beach.timezone),
      }),
      snapshots.filter((snapshot) => snapshot.beachId === beach.id),
    ).flatMap((event) => {
      const arrivalDate = getLocalDateString(new Date(event.arrivalAt), profile.timezone);
      const peakDate = getLocalDateString(new Date(event.peakAt), profile.timezone);
      if (arrivalDate !== tomorrow && peakDate !== tomorrow) return [];
      const peakForecast = rowNearest(beachForecasts, event.peakAt);
      if (!peakForecast) return [];
      const peak = verdictFor(peakForecast, beach);
      return [{ event, arrivalDate, peakDate, peakScore: peak.score, peakVerdict: peak.verdict }];
    });
    const best = events.sort((left, right) => right.peakScore - left.peakScore)[0];
    if (!best) return null;

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
    const officialEvidenceRefs = validOfficialEvidenceRefs(officialAdvisories, beach.id, now);
    const candidate: SwellAlertCandidate = {
      beach: {
        id: beach.id,
        name: beach.name,
        shortName: beach.short_name,
        slug: beach.slug,
        state: beach.state,
      },
      ...best,
      serious: best.event.peakFaceHeightFt >= 8 || officialAdvisories.some(
        ({ kind }) => kind === "high_surf" || kind === "tropical_cyclone",
      ),
      awarenessSignal: officialEvidenceRefs.length > 0 ? "corroborated" : "forecast_trend",
      officialEvidenceRefs,
    };
    return candidate;
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
    recordForecast: args.deps?.recordForecast
      ?? ((record) => recordSwellEventForecast(getClient(), record)),
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

/** Verification is bookkeeping: a failed write is counted, never allowed to stop the push. */
async function recordAlertForecast(
  deps: SwellAlertDeps,
  summary: SwellAlertRunSummary,
  record: SwellEventForecastRecord,
): Promise<void> {
  try {
    await deps.recordForecast(record);
  } catch (error) {
    console.error(`[swell-alert] Failed to record verification forecast ${record.eventKey}:`, error);
    summary.verificationRecordFailures += 1;
  }
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
        .filter(({ arrivalDate, peakDate }) => arrivalDate === tomorrow || peakDate === tomorrow)
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
        peakDate: lead.peakDate,
        history: evaluation.history,
        peakScore: lead.peakScore,
        peakGo: lead.peakVerdict === "go",
      });
      if (!rarity.rare || !rarity.kind || !rarity.rarityLine) {
        increment(summary, "not_rare");
        continue;
      }

      // The detector's resolved key, so Week Scout can focus this exact swell.
      const eventKey = lead.event.eventKey;
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
      const direction = lead.event.directionLabel;
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
          size: `${formatNumber(lead.event.peakFaceHeightFt)}ft`,
          period: `${formatNumber(lead.event.periodS)}s`,
          peak_day: weekday(lead.peakDate),
          peak_part: peakPart(lead.event.peakAt, profile.timezone),
          rarity: rarity.rarityLine,
        },
      });
      const payload = parseMajorSwellNotificationPayload({
        schema_version: MAJOR_SWELL_NOTIFICATION_SCHEMA_VERSION,
        beach_id: lead.beach.id,
        ...(lead.beach.slug ? { beach_slug: lead.beach.slug } : {}),
        beach_name: lead.beach.name,
        event_start_date: lead.arrivalDate,
        peak_date: lead.peakDate,
        // Surf face height, as the push copy states it; offshore height goes to verification.
        peak_height_ft: lead.event.peakFaceHeightFt,
        peak_period_s: lead.event.periodS,
        forecast_at: lead.event.peakAt,
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
        peakDate: lead.peakDate,
        leadBeachId: lead.beach.id,
        payload,
      });
      if (!alert) {
        increment(summary, "event_exists");
        continue;
      }
      await recordAlertForecast(deps, summary, {
        eventKey,
        beachId: lead.beach.id,
        source: "alert",
        detectorVersion: SWELL_EVENT_DETECTOR_VERSION,
        issuedAt: args.now.toISOString(),
        arrivalAt: lead.event.arrivalAt,
        peakAt: lead.event.peakAt,
        fadeAt: lead.event.fadeAt,
        peakOffshoreHeightFt: lead.event.peakOffshoreHeightFt,
        peakFaceHeightFt: lead.event.peakFaceHeightFt,
        peakPeriodS: lead.event.periodS,
        directionDeg: lead.event.directionDeg,
      });

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
