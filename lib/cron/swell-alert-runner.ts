import { resolveLocationAnchor, type LocationAnchor, type LocationSnapshot } from "@/lib/alerts/location-freshness";
import type { SupabaseClient } from "@supabase/supabase-js";

import { evaluateForecastVerdict, type ForecastVerdict } from "@/lib/alerts/canonical-forecast-verdict";
import {
  EXCLUDE_SYNTHETIC_ROWS_FILTER,
  SWELL_EVENT_DETECTOR_VERSION,
  SWELL_EVENT_KEY_REUSE_DAYS,
  SWELL_EVENT_THRESHOLDS,
  detectBeachSwellEvents,
  loadRecentSwellSnapshots,
  loadRecentSwellRunDates,
  resolveEventKeys,
  toSwellEventBeach,
  type BeachSwellEvent,
  type SwellEventSnapshot,
} from "@/lib/alerts/swell-events";
import { tracksSwellComponent, tracksSwellSize } from "@/lib/alerts/swell-events/detector";
import {
  detectSwellFollowupKind,
  isSwellFollowupExpired,
  isSwellFollowupWindowOpen,
  swellMoveDirection,
  type SwellCurrentForecast,
} from "@/lib/alerts/swell-followup/change-detection";
import {
  claimSwellFollowup,
  closeSwellFollowupState,
  loadActiveSwellFollowupStates,
  saveSwellFirstTold,
  type SwellFollowupState,
  type SwellToldUpdate,
} from "@/lib/alerts/swell-followup/state";
import { assessRarity, MIN_HISTORY_DAYS_FOR_WEEKS, type DayScore } from "@/lib/alerts/swell-rarity";
import {
  recordSwellEventForecast,
  type SwellEventForecastRecord,
} from "@/lib/alerts/swell-verification/record";
import { getUserEntitlement } from "@/lib/alerts/entitlements";
import { getDaylightWindow } from "@/lib/alerts/sunrise";
import { capToBestWindow, refineWindow, type RefinedWindow } from "@/lib/alerts/window-refiner";
import { groupGoForecasts, loadTideSamples } from "@/lib/cron/daily-call-runner";
import { loadUserPool } from "@/lib/alerts/user-pool";
import {
  forecastSlotCandidate,
  resolveHeldPushBeaches,
  type ResolveHeldPushBeaches,
} from "@/lib/alerts/push-beach-holds";
import { calculateDistance } from "@/lib/utils/distance-utils";
import { isDailyCallEnabled, isDailyCallUserAllowed } from "@/lib/flags/daily-call";
import { isSwellAlertEnabled, isSwellAlertUserAllowed } from "@/lib/flags/swell-alert";
import { isSwellFollowupEnabled, isSwellFollowupUserAllowed } from "@/lib/flags/swell-followup";
import { resolveEntitlement, type Tier } from "@/lib/alerts/entitlements";
import { SWELL_FOLLOWUP_THRESHOLDS } from "@/lib/alerts/swell-followup/change-detection";
import {
  decideSend,
  recordSend,
  settle,
  type SwellEngagementState,
  type SwellSendKind,
} from "@/lib/alerts/swell-outlook/engagement";
import {
  buildFirstSightingPayload,
  firstSightingFaceHeightFt,
  selectFirstSightingCandidates,
  type FirstSightingHazard,
} from "@/lib/alerts/swell-outlook/first-sighting";
import {
  EMPTY_SWELL_OUTLOOK_USER_STATE,
  advanceLists,
  type SwellOutlookStateTransition,
  loadSwellOutlookUserState,
  saveSwellOutlookUserState,
} from "@/lib/alerts/swell-outlook/state";
import { findTideAwareWindow, type TideAwareWindowResult } from "@/lib/alerts/surf-window/tide-aware-window";
import { isSwellOutlookEnabled, isSwellOutlookUserAllowed, isSwellOutlookTideWindowEnabled } from "@/lib/flags/swell-outlook";
import { loadSwellOutlookForUser } from "@/lib/services/discovery/swell-outlook-loader";
import type { OutlookSwell, StoredOutlookList } from "@/lib/services/discovery/swell-outlook-types";
import { enqueueNotification } from "@/lib/notifications/enqueue";
import { selectTitle } from "@/lib/notifications/copy/select-title";
import {
  buildSwellShareUrl,
  getSwellCardHeadline,
  pickSwellFollowupHeadline,
  renderSwellFollowupBody,
  type SwellFollowupKind,
  type SwellKind,
} from "@/lib/notifications/copy/swell-card-headline";
import titlePool from "@/lib/notifications/copy/surf-titles.v1.json";
import { formatWindowLabel, limitSentence } from "@/lib/notifications/copy/daily-call-copy";
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
import { recommendBoard } from "@/lib/scoring/personal-board";
import { fetchUserBoardContext } from "@/lib/services/discovery/surf-discovery-orchestrator";
import { TideCache } from "@/lib/services/noaa-coops/tide-cache";
import { selectBestWindows } from "@/lib/services/discovery/window-selector";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { localDateTimeToUTC } from "@/lib/utils/forecast-time-resolver";
import { getLocalDateString, getLocalHour, resolveBeachTimezone } from "@/lib/utils/timezone-utils";
import type { Beach, Database } from "@/types/database";
import type { EnhancedForecastEntity } from "@/types/forecast";

const SEND_HOUR = 17;
const LOOKAHEAD_DAYS = 10;
const HISTORY_DAYS = 30;
const TITLE_HISTORY_DAYS = 120;
const COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const POSTGRES_UNIQUE_VIOLATION = "23505";
const FORECAST_PAGE_SIZE = 1000;
const PEAK_ROW_MAX_MS = 3 * 60 * 60 * 1000;
const OFFICIAL_ADVISORY_HORIZON_MS = 10 * DAY_MS;
const OFFICIAL_ADVISORY_KINDS = new Set(["high_surf", "tropical_cyclone", "high_rip_current"]);
const SERIOUS_FACE_HEIGHT_FT = 8;
const HAZARD_LINES = {
  high_surf: "High surf advisory in effect.",
  high_rip_current: "Rip current statement in effect.",
} as const;
const MAX_FIRST_SIGHTING_RARITY_ASSESSMENTS = 3;
// Forecast rows a pinned re-evaluation loads before now; detection itself reads 48 h back.
const PINNED_LOOKBACK_MS = 3 * DAY_MS;
// A matching swell can keep its pin when its peak shifts beyond the key-reuse window.
const PINNED_MAX_PEAK_SHIFT_MS = 72 * 60 * 60 * 1000;

type ServiceClient = SupabaseClient<Database>;
type FirstSightingClaimSkipReason = "event_exists" | "first_sighting_spacing";
type SwellRarityAssessor = (swell: OutlookSwell) => boolean;

export interface SwellAlertProfile {
  id: string;
  timezone: string;
  homeBeachId: string | null;
  location: { lat: number; lon: number } | null;
  anchorSource?: LocationAnchor["source"];
  maxDriveMinutes: number | null;
  experienceLevel: string | null;
  notifPushEnabled: boolean | null;
  notifSwellAlerts: boolean | null;
  notifForecastAlerts: boolean | null;
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
  /** The user's board for the peak, when board picks are on for them. */
  boardName?: string | null;
  /** An NWS statement in effect at this beach, named in the push. */
  hazard?: "high_surf" | "high_rip_current" | null;
  /** The daily call's go window on the peak day, edges snapped to tide, wind and light. */
  window?: RefinedWindow | null;
}

export interface SwellAlertPoolEvaluation {
  history: DayScore[];
  candidates: SwellAlertCandidate[];
}

/** The pinned beach and, when still detected there, the pinned event. */
export interface PinnedSwellEvaluation {
  beach: SwellAlertCandidate["beach"] | null;
  /** False when no future forecast rows loaded: a data gap is never reported as a dropped swell. */
  forecastAvailable: boolean;
  event: BeachSwellEvent | null;
  previous: { event: SwellCurrentForecast | null } | null;
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
    firstSighting?: {
      now: Date;
      eventKeys: string[];
      onDenied?: (reason: FirstSightingClaimSkipReason) => void;
    };
  }) => Promise<{ id: string } | null>;
  enqueue: (args: EnqueueArgs) => Promise<EnqueueResult>;
  markAlertEnqueued: (alertId: string, eventId: string) => Promise<void>;
  recordForecast: (record: SwellEventForecastRecord) => Promise<{ inserted: boolean }>;
  resolveHeldBeaches: ResolveHeldPushBeaches;
}

export interface SwellFollowupDeps {
  isFollowupEnabled: () => boolean;
  isFollowupUserAllowed: (userId: string) => boolean;
  loadFollowupStates: () => Promise<SwellFollowupState[]>;
  evaluatePinned: (
    profile: SwellAlertProfile,
    state: SwellFollowupState,
    now: Date,
  ) => Promise<PinnedSwellEvaluation>;
  saveFirstTold: (args: {
    userId: string;
    eventKey: string;
    beachId: string;
    told: SwellToldUpdate;
  }) => Promise<void>;
  claimFollowup: (state: SwellFollowupState, told: SwellToldUpdate) => Promise<boolean>;
  closeFollowupState: (state: SwellFollowupState, status: "passed", now: Date) => Promise<void>;
}

export interface SwellOutlookDeps {
  isOutlookEnabled: () => boolean;
  isOutlookUserAllowed: (userId: string) => boolean;
  loadOutlook: (profile: SwellAlertProfile, now: Date, onList?: (list: StoredOutlookList) => void) => Promise<OutlookSwell[]>;
  loadEngagement: (userId: string) => Promise<SwellEngagementState | null>;
  saveEngagement: (userId: string, transition: SwellOutlookStateTransition) => Promise<void>;
  hasFirstSightingAlert: (userId: string, eventKeys: string[]) => Promise<boolean>;
  assessSwellRarity: (profile: SwellAlertProfile, swell: OutlookSwell, now: Date) => Promise<boolean>;
  getTier: (userId: string) => Promise<Tier>;
  loadFirstSightingWindow?: (profile: SwellAlertProfile, swell: OutlookSwell, now: Date) => Promise<TideAwareWindowResult>;
  /** Official hazard at the lead beach for the push text; null when none or the lookup fails. */
  loadFirstSightingHazard?: (beachId: string, timezone: string, now: Date) => Promise<FirstSightingHazard | null>;
  /** Km from the resolved location or home anchor, to each beach; empty when neither is known. */
  loadBeachDistancesKm?: (profile: SwellAlertProfile, beachIds: readonly string[]) => Promise<ReadonlyMap<string, number>>;
}

type RunnerDeps = SwellAlertDeps & SwellFollowupDeps & Partial<SwellOutlookDeps>;
type OutlookRunnerDeps = SwellAlertDeps & SwellFollowupDeps & SwellOutlookDeps;

interface EngagementGate {
  state: SwellEngagementState;
  dirty: boolean;
  sends: Array<{ kind: SwellSendKind; exception: boolean; at: Date }>;
  list?: StoredOutlookList;
}

interface SwellAlertRunSummary {
  skipped: boolean;
  reason?: string;
  evaluated: number;
  candidates: number;
  sent: number;
  duplicates: number;
  skippedCounts: Record<string, number>;
  errors: number;
  verificationRecordFailures: number;
  /** Enqueued pushes by kind: 'coming' is a first alert, the rest are follow-ups. */
  sentByKind: Partial<Record<SwellKind, number>>;
  followupsEvaluated: number;
  followupStateFailures: number;
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

function personalCall(beachName: string, lead: SwellAlertCandidate, timezone: string): string {
  const timing = lead.window ? windowCopy(lead.window, lead.peakDate, timezone) : null;
  const board = lead.boardName ? `, grab your ${lead.boardName}` : "";
  return timing
    ? `Your call: ${beachName} ${timing.when}${board}. ${timing.limit}`
    : `Your call: ${beachName}${board}.`;
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
  historyDays: number,
): string[] {
  const tags = new Set<string>([
    [0, 6].includes(new Date(`${candidate.peakDate}T12:00:00.000Z`).getUTCDay())
      ? "weekend"
      : "weekday",
    candidate.serious ? "serious" : "manageable",
    "generic",
  ]);
  if (rarityKind === "first-after-flat") tags.add("first-after-flat");
  // "Biggest in weeks" titles only when the history really spans weeks.
  else if (historyDays >= MIN_HISTORY_DAYS_FOR_WEEKS) tags.add("biggest-in-weeks");
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
    sentByKind: {},
    followupsEvaluated: 0,
    followupStateFailures: 0,
    durationMs: 0,
  };
}

function countSent(summary: SwellAlertRunSummary, kind: SwellKind): void {
  summary.sent += 1;
  summary.sentByKind[kind] = (summary.sentByKind[kind] ?? 0) + 1;
}

function increment(summary: SwellAlertRunSummary, reason: string): void {
  summary.skippedCounts[reason] = (summary.skippedCounts[reason] ?? 0) + 1;
}

function dailyCallOwnsToday(profile: SwellAlertProfile): boolean {
  return isDailyCallEnabled() && isDailyCallUserAllowed(profile.id)
    && profile.notifPushEnabled === true && profile.notifForecastAlerts === true;
}

async function loadProfiles(client: ServiceClient, now: Date): Promise<SwellAlertProfile[]> {
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
      notif_forecast_alerts,
      user_location_snapshots(lat, lon, timezone, captured_at),
      home_beach:beaches!profiles_home_beach_id_fkey(lat, lon, timezone)
    `)
    .is("deleted_at", null);
  if (error) throw new Error(`Failed to load swell alert users: ${error.message}`);

  return (data ?? []).map((value) => {
    const row = value as typeof value & {
      user_location_snapshots:
        | (LocationSnapshot & { timezone: string })
        | Array<LocationSnapshot & { timezone: string }>
        | null;
      home_beach: { lat: number | null; lon: number | null; timezone: string | null } | null;
    };
    const joined = Array.isArray(row.user_location_snapshots)
      ? row.user_location_snapshots[0]
      : row.user_location_snapshots;
    const { anchor, source } = resolveLocationAnchor(joined, now, row.home_beach);
    return {
      id: row.id,
      timezone: row.timezone ?? (source === "location" ? joined?.timezone : row.home_beach?.timezone) ?? "America/Los_Angeles",
      homeBeachId: row.home_beach_id,
      location: anchor,
      anchorSource: source,
      maxDriveMinutes: row.max_drive_minutes,
      experienceLevel: row.experience_level,
      notifPushEnabled: row.notif_push_enabled,
      notifSwellAlerts: row.notif_swell_alerts,
      notifForecastAlerts: row.notif_forecast_alerts,
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
      .or(EXCLUDE_SYNTHETIC_ROWS_FILTER)
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
): Promise<SwellEventSnapshot[] | null> {
  try {
    return await loadRecentSwellSnapshots(client, beachIds, new Date(now.getTime() - SWELL_EVENT_KEY_REUSE_DAYS * DAY_MS));
  } catch (error) {
    console.warn("[swell-alert] Snapshot read failed; using detector keys:", error);
    return null;
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
async function loadBeachDistancesKm(
  client: SupabaseClient,
  profile: SwellAlertProfile,
  beachIds: readonly string[],
): Promise<ReadonlyMap<string, number>> {
  const { data: beaches, error } = await client.from("beaches").select("id, lat, lon").in("id", [...beachIds]);
  if (error) throw new Error(`Failed to load beach coordinates: ${error.message}`);
  const coords = new Map((beaches ?? []).flatMap((beach: { id: string; lat: number | null; lon: number | null }) => (
    beach.lat === null || beach.lon === null ? [] : [[beach.id, { lat: beach.lat, lon: beach.lon }] as const]
  )));
  const origin = profile.location;
  if (!origin) return new Map();
  return new Map(beachIds.flatMap((id) => {
    const beach = coords.get(id);
    return beach ? [[id, calculateDistance(origin, beach, "km")] as const] : [];
  }));
}

async function loadFirstSightingHazard(
  client: SupabaseClient,
  beachId: string,
  timezone: string,
  now: Date,
): Promise<FirstSightingHazard | null> {
  const { data: beach, error } = await client
    .from("beaches")
    .select("nws_forecast_zone")
    .eq("id", beachId)
    .maybeSingle();
  if (error) throw new Error(`Failed to load beach zone: ${error.message}`);
  const [ledger, nws] = await Promise.all([
    loadOfficialSwellAdvisories({ supabase: client, beachId, timezone, now }),
    loadNwsSwellAdvisories({ zone: (beach as { nws_forecast_zone?: string | null } | null)?.nws_forecast_zone, beachId, now }),
  ]);
  const advisories = [...ledger, ...nws];
  const inEffect = (kind: FirstSightingHazard): boolean => validOfficialEvidenceRefs(
    advisories.filter((advisory) => advisory.kind === kind), beachId, now,
  ).length > 0;
  if (inEffect("tropical_cyclone")) return "tropical_cyclone";
  if (inEffect("high_surf")) return "high_surf";
  if (inEffect("high_rip_current")) return "high_rip_current";
  return null;
}

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

function makeVerdictFor(
  profile: SwellAlertProfile,
  now: Date,
): (forecast: EnhancedForecastEntity, beach: Beach) => ForecastVerdict {
  return (forecast, beach) => evaluateForecastVerdict({
    forecast,
    beach,
    experienceLevel: profile.experienceLevel,
    timezone: profile.timezone,
    now,
    candidateIdPrefix: "swell-alert",
  });
}

function buildScoreHistory(args: {
  pool: ReadonlyArray<{ beach: Beach }>;
  forecastsByBeach: ReadonlyMap<string, readonly EnhancedForecastEntity[]>;
  verdictFor: (forecast: EnhancedForecastEntity, beach: Beach) => ForecastVerdict;
  timezone: string;
  today: string;
}): DayScore[] {
  const historyByDate = new Map<string, DayScore>();
  for (const { beach } of args.pool) {
    for (const forecast of args.forecastsByBeach.get(beach.id) ?? []) {
      const localDate = getLocalDateString(new Date(forecast.forecast_at), args.timezone);
      const localHour = getLocalHour(new Date(forecast.forecast_at), args.timezone);
      // Today counts: its forecast is known, and "first after flat" needs the
      // day before a peak that is tomorrow at the earliest.
      if (localDate > args.today || localHour < 6 || localHour >= 19) continue;
      const { score, verdict } = args.verdictFor(forecast, beach);
      const day = historyByDate.get(localDate);
      historyByDate.set(localDate, {
        localDate,
        bestScore: Math.max(day?.bestScore ?? 0, score),
        go: (day?.go ?? false) || verdict === "go",
      });
    }
  }
  return [...historyByDate.values()].sort((left, right) => left.localDate.localeCompare(right.localDate));
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

  // The board is optional copy; a failed read sends the alert without one.
  const boardsForPicks = await getUserEntitlement(profile.id, client)
    .then((tier) => fetchUserBoardContext(client, profile.id, tier === "premium"))
    .then((context) => context.boardsForPicks, (error: unknown) => {
      console.warn(`[swell-alert] Board read failed for ${profile.id}:`, error);
      return [];
    });
  const tideCache = new TideCache();
  const forecasts = await loadForecasts(
    client,
    pool.map(({ beach }) => beach.id),
    new Date(now.getTime() - HISTORY_DAYS * DAY_MS),
    new Date(now.getTime() + LOOKAHEAD_DAYS * DAY_MS),
  );
  const forecastsByBeach = Map.groupBy(forecasts, (forecast) => forecast.beach_id);

  const today = getLocalDateString(now, profile.timezone);
  const verdictFor = makeVerdictFor(profile, now);
  const history = buildScoreHistory({ pool, forecastsByBeach, verdictFor, timezone: profile.timezone, today });

  const tomorrow = addCivilDays(today, 1);
  const snapshots = await loadKeySnapshots(client, pool.map(({ beach }) => beach.id), now) ?? [];
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
      return [{ event, arrivalDate, peakDate, peakScore: peak.score, peakVerdict: peak.verdict, peakForecast }];
    });
    const sorted = events.sort((left, right) => right.peakScore - left.peakScore)[0];
    if (!sorted) return null;
    const { peakForecast, ...best } = sorted;
    const window = await peakDayWindow({
      client, tideCache, beach, peakForecast,
      forecasts: beachForecasts,
      peakDate: best.peakDate,
      timezone: profile.timezone,
      now,
      experienceLevel: profile.experienceLevel,
      verdictFor,
    }).catch((error: unknown) => {
      // No window means the push says "Wed morning"; never drop the alert for it.
      console.warn(`[swell-alert] Window refine failed for ${beach.id}:`, error);
      return null;
    });

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
    const inEffect = (kind: string): boolean => validOfficialEvidenceRefs(
      officialAdvisories.filter((advisory) => advisory.kind === kind), beach.id, now,
    ).length > 0;
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
      boardName: recommendBoard(boardsForPicks, peakForecast, beach, profile.experienceLevel)?.name ?? null,
      hazard: inEffect("high_surf") ? "high_surf" : inEffect("high_rip_current") ? "high_rip_current" : null,
      window,
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

/** The go window on the peak day, refined like the daily call's: the run holding the peak row, else the strongest run. */
async function peakDayWindow(args: {
  client: ServiceClient;
  tideCache: TideCache;
  beach: Beach;
  forecasts: EnhancedForecastEntity[];
  peakForecast: EnhancedForecastEntity;
  peakDate: string;
  timezone: string;
  now: Date;
  experienceLevel: string | null;
  verdictFor: (forecast: EnhancedForecastEntity, beach: Beach) => ForecastVerdict;
}): Promise<RefinedWindow | null> {
  // The daily call's day: 05:00–20:00 local, so daylight resolves to this date.
  const dayStart = localDateTimeToUTC(args.peakDate, "05:00:00", args.timezone).toISOString();
  const dayEnd = localDateTimeToUTC(args.peakDate, "20:00:00", args.timezone).toISOString();
  const dayRows = args.forecasts.filter((row) => {
    const at = new Date(row.forecast_at).toISOString();
    return at >= dayStart && at < dayEnd;
  });
  const verdicts = dayRows.map((row) => args.verdictFor(row, args.beach));
  const groups = groupGoForecasts(verdicts);
  const strongest = (group: ForecastVerdict[]): number => Math.max(...group.map(({ score }) => score));
  const group = groups.find((run) => run.some(({ forecast }) => forecast.id === args.peakForecast.id))
    ?? [...groups].sort((left, right) => strongest(right) - strongest(left))[0];
  if (!group) return null;

  const coarse = {
    start: new Date(group[0].forecast.forecast_at).toISOString(),
    end: new Date(Date.parse(group[group.length - 1].forecast.forecast_at) + HOUR_MS).toISOString(),
  };
  const daylight = getDaylightWindow(args.beach.lat, args.beach.lon, new Date(coarse.start));
  const tideSamples = await loadTideSamples(
    args.client,
    args.tideCache,
    args.beach.id,
    dayStart,
    dayEnd,
  );
  const verdictById = new Map(verdicts.map(({ forecast, verdict }) => [forecast.id, verdict]));
  const refined = refineWindow({
    coarse,
    forecasts: dayRows,
    beach: args.beach,
    tideSamples,
    daylight: { sunrise: daylight.sunrise.toISOString(), sunset: daylight.sunset.toISOString() },
    verdictAt: (forecast) => verdictById.get(forecast.id) ?? "no",
  });
  if (!refined) return null;
  const best = selectBestWindows({
    forecasts: group.map(({ forecast }) => forecast),
    beach: args.beach,
    userPrefs: null,
    now: args.now,
    maxWindows: 1,
    userSkillLevel: args.experienceLevel,
  })[0];
  return capToBestWindow(refined, best);
}

/** "Wednesday 8–11 AM" and "Best before the wind picks up around 12 PM.", in the daily call's words. */
function windowCopy(window: RefinedWindow, peakDate: string, timezone: string): { when: string; limit: string } {
  const edge = (side: "start" | "end"): boolean =>
    window.drivers.find((driver) => driver.edge === side)?.approximate ?? false;
  return {
    when: `${weekday(peakDate)} ${formatWindowLabel(window.start, window.end, timezone, {
      approximateStart: edge("start"),
      approximateEnd: edge("end"),
    })}`,
    limit: limitSentence(window.drivers, window.end, timezone),
  };
}

/**
 * Re-evaluates one pinned (event, beach) for a follow-up. Never re-runs the
 * lead-beach pick: the user is told about the beach the first alert named.
 */
async function evaluatePinned(
  client: ServiceClient,
  state: SwellFollowupState,
  now: Date,
  runDates: readonly string[],
): Promise<PinnedSwellEvaluation> {
  const { data: beach, error } = await client
    .from("beaches")
    .select("*")
    .eq("id", state.beachId)
    .maybeSingle();
  if (error) throw new Error(`Failed to load pinned swell beach: ${error.message}`);
  if (!beach) return { beach: null, forecastAvailable: false, event: null, previous: null };

  const forecasts = await loadForecasts(
    client,
    [beach.id],
    new Date(now.getTime() - PINNED_LOOKBACK_MS),
    new Date(now.getTime() + LOOKAHEAD_DAYS * DAY_MS),
  );
  const keySnapshots = await loadKeySnapshots(client, [beach.id], now);
  const snapshots = keySnapshots ?? [];
  const events = resolveEventKeys(
    detectBeachSwellEvents({
      beach: toSwellEventBeach(beach),
      forecasts,
      now,
      timezone: resolveBeachTimezone(beach.timezone),
    }),
    snapshots,
  );
  const toldPeakAt = Date.parse(state.lastPeakAt);
  const told = { directionDeg: state.lastDirectionDeg, periodS: state.lastPeriodS };
  const pinnedRunDates = new Set(snapshots
    .filter((snapshot) => snapshot.eventKey === state.eventKey)
    .map(({ runDate }) => runDate));
  const coexistingKeys = new Set(snapshots
    .filter((snapshot) => pinnedRunDates.has(snapshot.runDate))
    .map(({ eventKey }) => eventKey));
  // Prefer the exact key; component and size fallback excludes keys emitted alongside it in a detector run.
  function matchPinned<T extends Pick<BeachSwellEvent, "eventKey" | "peakAt" | "directionDeg" | "periodS" | "peakFaceHeightFt">>(
    candidates: T[],
  ): T | null {
    return candidates.find(({ eventKey }) => eventKey === state.eventKey)
      ?? candidates
      .filter((candidate) => tracksSwellComponent(told, candidate)
        && !coexistingKeys.has(candidate.eventKey)
        && tracksSwellSize({ peakFaceHeightFt: state.lastFaceHeightFt }, candidate)
        && Math.abs(Date.parse(candidate.peakAt) - toldPeakAt) <= PINNED_MAX_PEAK_SHIFT_MS)
      .sort((left, right) =>
        Math.abs(Date.parse(left.peakAt) - toldPeakAt) - Math.abs(Date.parse(right.peakAt) - toldPeakAt))[0]
      ?? null;
  }
  const event = matchPinned(events);
  // A run_date can contain mixed timestamps after a partial rerun; the clock date never advances this evidence.
  const previousRunDate = keySnapshots === null ? undefined : runDates[1];
  const previousEvent = previousRunDate === undefined ? null
    : matchPinned(snapshots.filter(({ runDate }) => runDate === previousRunDate));

  return {
    beach: {
      id: beach.id,
      name: beach.name,
      shortName: beach.short_name,
      slug: beach.slug,
      state: beach.state,
    },
    forecastAvailable: forecasts.some((row) => Date.parse(row.forecast_at) > now.getTime()),
    event,
    previous: previousRunDate === undefined ? null : {
      event: previousEvent ? {
        peakAt: previousEvent.peakAt, faceHeightFt: previousEvent.peakFaceHeightFt, exposure: previousEvent.exposure,
      } : null,
    },
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

async function loadSwellRarityAssessor(
  client: ServiceClient,
  profile: SwellAlertProfile,
  now: Date,
): Promise<SwellRarityAssessor> {
  const pool = await loadUserPool({
    supabase: client,
    userId: profile.id,
    homeBeachId: profile.homeBeachId,
    location: profile.location,
    maxDriveMinutes: profile.maxDriveMinutes,
  });
  if (pool.length === 0) return () => false;
  const forecasts = await loadForecasts(
    client,
    pool.map((entry) => entry.beach.id),
    new Date(now.getTime() - HISTORY_DAYS * DAY_MS),
    new Date(now.getTime() + LOOKAHEAD_DAYS * DAY_MS),
  );
  const forecastsByBeach = Map.groupBy(forecasts, (forecast) => forecast.beach_id);
  const beaches = new Map(pool.map(({ beach }) => [beach.id, beach]));
  const verdictFor = makeVerdictFor(profile, now);
  const history = buildScoreHistory({
    pool,
    forecastsByBeach,
    verdictFor,
    timezone: profile.timezone,
    today: getLocalDateString(now, profile.timezone),
  });
  return (swell: OutlookSwell): boolean => {
    const beach = beaches.get(swell.beach.id);
    if (!beach) return false;
    const peakForecast = rowNearest(forecastsByBeach.get(beach.id) ?? [], swell.peakAt);
    if (!peakForecast) return false;
    const peak = verdictFor(peakForecast, beach);
    return assessRarity({
      peakDate: getLocalDateString(new Date(swell.peakAt), profile.timezone),
      history,
      peakScore: peak.score,
      peakGo: peak.verdict === "go",
    }).rare;
  };
}

async function getOutlookTier(client: ServiceClient, userId: string): Promise<Tier> {
  const { data, error } = await client
    .from("user_entitlements")
    .select("is_pro, is_trialing, billing_issue, expires_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(`Failed to load outlook entitlement: ${error.message}`);
  return resolveEntitlement(userId, data);
}

function defaultDependencies(args: {
  now: Date;
  supabase?: ServiceClient;
  deps?: Partial<RunnerDeps>;
}): RunnerDeps {
  let client = args.supabase;
  const firstSightingTideCache = new TideCache();
  const rarityByUser = new Map<string, Promise<SwellRarityAssessor>>();
  let swellRunDates: Promise<string[]> | undefined;
  const getClient = (): ServiceClient => {
    client ??= createSupabaseServiceRoleClient();
    return client;
  };

  return {
    isEnabled: args.deps?.isEnabled ?? isSwellAlertEnabled,
    isUserAllowed: args.deps?.isUserAllowed ?? isSwellAlertUserAllowed,
    loadProfiles: args.deps?.loadProfiles ?? (() => loadProfiles(getClient(), args.now)),
    evaluatePool: args.deps?.evaluatePool
      ?? ((profile, now) => evaluatePool(getClient(), profile, now)),
    loadAlertState: args.deps?.loadAlertState
      ?? ((userId, eventKey, now) => loadAlertState(getClient(), userId, eventKey, now)),
    insertAlert: args.deps?.insertAlert ?? (async (input) => {
      if (input.firstSighting) {
        // Serialize claims across different swells too, before the non-transactional enqueue.
        const { data, error } = await (getClient() as unknown as SupabaseClient)
          .rpc("claim_swell_outlook_first_sighting", {
            p_user_id: input.userId,
            p_event_key: input.eventKey,
            p_event_keys: input.firstSighting.eventKeys,
            p_peak_date: input.peakDate,
            p_beach_id: input.leadBeachId,
            p_payload: input.payload,
            p_now: input.firstSighting.now.toISOString(),
          });
        if (error) throw new Error(`Failed to claim first sighting: ${error.message}`);
        const result = data as { id?: unknown; reason?: unknown } | null;
        if (typeof result?.id === "string") return { id: result.id };
        if (result?.id === null && (result.reason === "event_exists" || result.reason === "first_sighting_spacing")) {
          input.firstSighting.onDenied?.(result.reason);
          return null;
        }
        throw new Error("Invalid first-sighting claim result");
      }
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
    resolveHeldBeaches: args.deps?.resolveHeldBeaches ?? resolveHeldPushBeaches,
    isFollowupEnabled: args.deps?.isFollowupEnabled ?? isSwellFollowupEnabled,
    isFollowupUserAllowed: args.deps?.isFollowupUserAllowed ?? isSwellFollowupUserAllowed,
    loadFollowupStates: args.deps?.loadFollowupStates
      ?? (() => loadActiveSwellFollowupStates(getClient())),
    evaluatePinned: args.deps?.evaluatePinned
      ?? (async (_profile, state, now) => {
        swellRunDates ??= loadRecentSwellRunDates(getClient(), new Date(now.getTime() - SWELL_EVENT_KEY_REUSE_DAYS * DAY_MS))
          .catch((error: unknown) => {
            console.warn("[swell-alert] Detector run date read failed; changes unconfirmed:", error);
            return [];
          });
        return evaluatePinned(getClient(), state, now, await swellRunDates);
      }),
    saveFirstTold: args.deps?.saveFirstTold
      ?? ((input) => saveSwellFirstTold(getClient(), input)),
    claimFollowup: args.deps?.claimFollowup
      ?? ((state, told) => claimSwellFollowup(getClient(), state, told)),
    closeFollowupState: args.deps?.closeFollowupState
      ?? ((state, status, now) => closeSwellFollowupState(getClient(), state, status, now)),
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
    isOutlookEnabled: args.deps?.isOutlookEnabled ?? isSwellOutlookEnabled,
    isOutlookUserAllowed: args.deps?.isOutlookUserAllowed ?? isSwellOutlookUserAllowed,
    loadOutlook: args.deps?.loadOutlook ?? (async (profile, now, onList) => (
      await loadSwellOutlookForUser({ client: getClient(), userId: profile.id, now, recordOpen: false, onList })
    ).swells),
    loadEngagement: args.deps?.loadEngagement ?? ((userId) => loadSwellOutlookUserState(getClient(), userId)),
    saveEngagement: args.deps?.saveEngagement ?? ((userId, transition) =>
      saveSwellOutlookUserState(getClient(), userId, transition)),
    hasFirstSightingAlert: args.deps?.hasFirstSightingAlert ?? (async (userId, eventKeys) => {
      const { data, error } = await getClient()
        .from("swell_event_alerts")
        .select("id")
        .eq("user_id", userId)
        .in("event_key", eventKeys)
        .limit(1);
      if (error) throw new Error(`Failed to check first-sighting alerts: ${error.message}`);
      return (data ?? []).length > 0;
    }),
    assessSwellRarity: args.deps?.assessSwellRarity
      ?? (async (profile, swell, now) => {
        let assessor = rarityByUser.get(profile.id);
        if (!assessor) {
          assessor = loadSwellRarityAssessor(getClient(), profile, now);
          rarityByUser.set(profile.id, assessor);
        }
        return (await assessor)(swell);
      }),
    getTier: args.deps?.getTier
      ?? ((userId) => getOutlookTier(getClient(), userId)),
    loadFirstSightingWindow: args.deps?.loadFirstSightingWindow
      ?? ((profile, swell, now) => loadFirstSightingWindow(getClient(), firstSightingTideCache, profile, swell, now)),
    loadFirstSightingHazard: args.deps?.loadFirstSightingHazard
      ?? ((beachId, timezone, now) => loadFirstSightingHazard(getClient(), beachId, timezone, now)),
    loadBeachDistancesKm: args.deps?.loadBeachDistancesKm
      ?? ((profile, beachIds) => loadBeachDistancesKm(getClient(), profile, beachIds)),
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

const FOLLOWUP_STATUS_AFTER: Record<SwellFollowupKind, SwellToldUpdate["status"]> = {
  bigger: "active",
  smaller: "active",
  moved: "active",
  dropped: "dropped",
  arrived: "arrived",
};

/**
 * Follow-ups for the swells this user was already alerted to. Skips the first
 * alert's gates on purpose (event_exists, the 72 h cooldown, tomorrow-only,
 * the 17:00 send hour): those would block every update about a known swell.
 */
async function sendFollowups(
  deps: RunnerDeps,
  summary: SwellAlertRunSummary,
  profile: SwellAlertProfile,
  states: readonly SwellFollowupState[],
  now: Date,
  gate?: EngagementGate,
): Promise<void> {
  for (const state of states) {
    summary.followupsEvaluated += 1;
    try {
      const told = {
        peakAt: state.lastPeakAt,
        faceHeightFt: state.lastFaceHeightFt,
        toldKinds: state.toldKinds,
        lastFollowupAt: state.lastFollowupAt,
        status: state.status,
      };
      if (isSwellFollowupExpired(told, now)) {
        await deps.closeFollowupState(state, "passed", now);
        increment(summary, "followup_expired");
        continue;
      }
      if (!isSwellFollowupWindowOpen(told, now, profile.timezone)) {
        increment(summary, "followup_window_closed");
        continue;
      }

      const pinned = await deps.evaluatePinned(profile, state, now);
      if (!pinned.beach || !pinned.forecastAvailable) {
        increment(summary, "followup_no_forecast");
        continue;
      }
      const event = pinned.event;
      const kind = detectSwellFollowupKind({
        told,
        previous: pinned.previous,
        current: event
          ? { peakAt: event.peakAt, faceHeightFt: event.peakFaceHeightFt, exposure: event.exposure }
          : null,
        now,
        timezone: profile.timezone,
      });
      if (!kind) {
        increment(summary, "followup_no_change");
        continue;
      }

      const today = getLocalDateString(now, profile.timezone);
      if (dailyCallOwnsToday(profile) && (kind === "arrived"
        || getLocalDateString(new Date(state.lastPeakAt), profile.timezone) === today
        || (event && getLocalDateString(new Date(event.peakAt), profile.timezone) === today))) {
        increment(summary, "skipped_daily_call_owns_today");
        continue;
      }

      // A dropped swell has no current numbers, so the push restates what was last told.
      const shown = kind !== "dropped" && event
        ? {
            arrivalAt: event.arrivalAt,
            peakAt: event.peakAt,
            faceHeightFt: event.peakFaceHeightFt,
            periodS: event.periodS,
            directionDeg: event.directionDeg,
          }
        : {
            arrivalAt: state.lastArrivalAt,
            peakAt: state.lastPeakAt,
            faceHeightFt: state.lastFaceHeightFt,
            periodS: state.lastPeriodS,
            directionDeg: state.lastDirectionDeg,
          };
      const held = await deps.resolveHeldBeaches({
        candidates: [forecastSlotCandidate("followup", pinned.beach.id, shown.peakAt)],
        profileExperience: profile.experienceLevel,
        asOf: now,
      });
      const heldReason = held.get("followup");
      if (heldReason) {
        increment(summary, `held_${heldReason}`);
        continue;
      }

      const serious = state.serious || shown.faceHeightFt >= SERIOUS_FACE_HEIGHT_FT;
      const peakDate = getLocalDateString(new Date(shown.peakAt), profile.timezone);
      const previousPeakDate = getLocalDateString(new Date(state.lastPeakAt), profile.timezone);
      const beachName = pinned.beach.shortName ?? pinned.beach.name;
      const peakDayLabel = weekday(peakDate);
      const picked = pickSwellFollowupHeadline({
        kind,
        eventKey: state.eventKey,
        beachName,
        peakDayLabel,
        serious,
        ...(kind === "moved" ? { moveDirection: swellMoveDirection(state.lastPeakAt, shown.peakAt) } : {}),
      });
      // The card renders its headline from the same function and title id as this push.
      const headline = getSwellCardHeadline({
        titleId: picked.titleId,
        kind,
        eventKey: state.eventKey,
        beachName,
        peakDayLabel,
        serious,
      });
      const body = renderSwellFollowupBody({
        kind,
        titleId: headline.titleId,
        vars: {
          beach: beachName,
          size: `${formatNumber(shown.faceHeightFt)}ft`,
          period: `${formatNumber(shown.periodS)}s`,
          day: peakDayLabel,
          part: peakPart(shown.peakAt, profile.timezone),
          prev_size: `${formatNumber(state.lastFaceHeightFt)}ft`,
          prev_day: weekday(previousPeakDate),
        },
      });
      if (!body) {
        increment(summary, "followup_no_copy");
        continue;
      }

      const payload = parseMajorSwellNotificationPayload({
        schema_version: MAJOR_SWELL_NOTIFICATION_SCHEMA_VERSION,
        beach_id: pinned.beach.id,
        ...(pinned.beach.slug ? { beach_slug: pinned.beach.slug } : {}),
        beach_name: pinned.beach.name,
        event_start_date: getLocalDateString(new Date(shown.arrivalAt), profile.timezone),
        peak_date: peakDate,
        peak_height_ft: shown.faceHeightFt,
        peak_period_s: shown.periodS,
        forecast_at: shown.peakAt,
        awareness_mode: "shadow",
        automation_enabled: false,
        awareness_signal: "forecast_trend",
        awareness_severity: serious ? "major" : "significant",
        official_evidence_refs: [],
        would_suppress_cohorts: ["beginner", "intermediate", "unknown"],
        enforcement: null,
        title: headline.headline,
        body,
        beaches: [{ beach_id: pinned.beach.id, beach_name: beachName, rank: 1 }],
        event_key: state.eventKey,
        title_id: headline.titleId,
        kind,
        share_url: buildSwellShareUrl(state.eventKey, kind, headline.titleId),
        previous_peak_height_ft: state.lastFaceHeightFt,
        previous_peak_date: previousPeakDate,
      });

      if (gate) {
        const decision = decideSend(gate.state, now, "followup", false);
        if (!decision.ok) {
          increment(summary, decision.reason);
          continue;
        }
      }

      const claimed = await deps.claimFollowup(state, {
        ...shown,
        serious,
        kind,
        toldAt: now.toISOString(),
        status: FOLLOWUP_STATUS_AFTER[kind],
      });
      if (!claimed) {
        increment(summary, "followup_claim_lost");
        continue;
      }

      const enqueued = await deps.enqueue({
        type: "swell_watch",
        recipientUserId: profile.id,
        dedupeKey: `swell_watch:${profile.id}:${state.eventKey}:${kind}`,
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
      countSent(summary, kind);
      if (gate) recordOutlookSend(gate, now, "followup", false);
    } catch (error) {
      console.error(`[swell-alert] Error on follow-up ${state.eventKey} for ${profile.id}:`, error);
      summary.errors += 1;
    }
  }
}

function laterInstant(left: string | null, right: string | null): string | null {
  if (left === null) return right;
  if (right === null) return left;
  return Date.parse(left) > Date.parse(right) ? left : right;
}

function recordOutlookSend(gate: EngagementGate, now: Date, kind: SwellSendKind, exception: boolean): void {
  gate.state = recordSend(gate.state, now, kind, exception);
  gate.sends.push({ kind, exception, at: now });
  gate.dirty = true;
}

function isOutlookRecipient(deps: RunnerDeps, userId: string): deps is OutlookRunnerDeps {
  return deps.isOutlookEnabled?.() === true
    && deps.isOutlookUserAllowed?.(userId) === true
    && Boolean(deps.loadOutlook && deps.loadEngagement && deps.saveEngagement
      && deps.hasFirstSightingAlert && deps.assessSwellRarity && deps.getTier);
}

async function loadFirstSightingWindow(
  client: ServiceClient,
  tideCache: TideCache,
  profile: SwellAlertProfile,
  swell: OutlookSwell,
  now: Date,
): Promise<TideAwareWindowResult> {
  const { data: beach, error } = await client.from("beaches").select("*").eq("id", swell.beach.id).maybeSingle();
  if (error) throw new Error(`Failed to load surf-window beach: ${error.message}`);
  if (!beach) throw new Error(`Surf-window beach ${swell.beach.id} unavailable`);
  const timezone = resolveBeachTimezone(beach.timezone);
  const arrivalAt = swell.arrivalAt ?? swell.peakAt;
  const startDate = getLocalDateString(new Date(arrivalAt), timezone);
  const endDate = addCivilDays(startDate, 3);
  const start = localDateTimeToUTC(startDate, "02:00:00", timezone);
  const end = localDateTimeToUTC(endDate, "23:00:00", timezone);
  const [forecasts, tideSamples] = await Promise.all([
    loadForecasts(client, [beach.id], start, end),
    loadTideSamples(client, tideCache, beach.id, start.toISOString(), end.toISOString()),
  ]);
  const verdictFor = makeVerdictFor({ ...profile, timezone }, now);
  return findTideAwareWindow({ beach, forecasts, tideSamples, arrivalAt, peakAt: swell.peakAt,
    fadeAt: swell.fadeAt ?? null, timezone, now, skillLevel: profile.experienceLevel,
    verdictFor: (row) => verdictFor(row, beach) });
}

async function sendFirstSighting(
  deps: OutlookRunnerDeps,
  summary: SwellAlertRunSummary,
  profile: SwellAlertProfile,
  now: Date,
  followupEnabled: boolean,
  gate: EngagementGate,
  tier: Tier,
): Promise<void> {
  const hour = getLocalHour(now, profile.timezone);
  if (hour < SWELL_FOLLOWUP_THRESHOLDS.earliestLocalHour || hour > SWELL_FOLLOWUP_THRESHOLDS.latestLocalHour) {
    increment(summary, "first_sighting_window_closed");
    return;
  }
  const swells = await deps.loadOutlook(profile, now, (list) => { gate.list = list; gate.dirty = true; });
  const beachIds = [...new Set(swells.map((swell) => swell.beach.id))];
  const distanceKmByBeach = beachIds.length === 0 || !deps.loadBeachDistancesKm
    ? new Map<string, number>()
    : await deps.loadBeachDistancesKm(profile, beachIds).catch((error: unknown) => {
      // Distance only breaks a size tie; never drop the push for it.
      console.warn(`[swell-alert] Beach distance lookup failed for ${profile.id}:`, error);
      return new Map<string, number>();
    });
  const candidates = selectFirstSightingCandidates({
    swells,
    homeBeachId: profile.homeBeachId,
    tier,
    distanceKmByBeach,
  });

  let rarityAssessments = 0;
  let rejectedForRarity = false;
  for (const swell of candidates) {
    if (dailyCallOwnsToday(profile)
      && getLocalDateString(new Date(swell.peakAt), profile.timezone) === getLocalDateString(now, profile.timezone)) {
      increment(summary, "skipped_daily_call_owns_today");
      continue;
    }
    if (await deps.hasFirstSightingAlert(profile.id, [swell.id, swell.eventKey])) continue;

    let decision = decideSend(gate.state, now, "first_sighting", false);
    if (!decision.ok && decision.exceptionEligible) {
      decision = decideSend(gate.state, now, "first_sighting", true);
      if (!decision.ok) {
        increment(summary, decision.reason);
        return;
      }
      if (rarityAssessments >= MAX_FIRST_SIGHTING_RARITY_ASSESSMENTS) {
        increment(summary, "skipped_unengaged");
        return;
      }
      rarityAssessments += 1;
      if (!await deps.assessSwellRarity(profile, swell, now)) {
        rejectedForRarity = true;
        continue;
      }
    }
    if (!decision.ok) {
      increment(summary, decision.reason);
      return;
    }

    const windowPromise = Promise.resolve().then(() =>
      isSwellOutlookTideWindowEnabled() ? deps.loadFirstSightingWindow?.(profile, swell, now) : undefined,
    ).catch((error: unknown) => {
      console.warn(`[swell-alert] First-sighting window computation failed for ${swell.beach.id}:`, error);
      return undefined;
    });
    const hazardPromise = Promise.resolve().then(() =>
      deps.loadFirstSightingHazard?.(swell.beach.id, profile.timezone, now) ?? null,
    ).catch((error: unknown) => {
      console.warn(`[swell-alert] First-sighting hazard lookup failed for ${swell.beach.id}:`, error);
      return null;
    });
    const [surfWindow, hazard] = await Promise.all([windowPromise, hazardPromise]);

    // Checked against the window the push will name, before the claim, so a
    // swell whose beach clears later can still be told.
    const recommended = surfWindow?.state === "recommended" ? surfWindow.window : null;
    const held = await deps.resolveHeldBeaches({
      candidates: [
        recommended
          ? { candidateId: "lead", beachId: swell.beach.id, startsAt: recommended.start, endsAt: recommended.end }
          : forecastSlotCandidate("lead", swell.beach.id, swell.peakAt),
        ...(swell.options ?? []).map((option, index) =>
          forecastSlotCandidate(`option:${index}`, option.beachId, swell.peakAt)),
      ],
      profileExperience: profile.experienceLevel,
      asOf: now,
    });
    const leadHold = held.get("lead");
    if (leadHold) {
      increment(summary, `held_${leadHold}`);
      continue;
    }
    const options = swell.options?.filter((_, index) => {
      const optionHold = held.get(`option:${index}`);
      if (optionHold) increment(summary, `held_${optionHold}`);
      return !optionHold;
    });
    const told: OutlookSwell = { ...swell, ...(options ? { options } : {}) };
    const payload = { ...buildFirstSightingPayload({ swell: told, timezone: profile.timezone, hazard, surfWindow }),
      anchor_source: profile.anchorSource };
    let claimDenied: FirstSightingClaimSkipReason = "event_exists";
    const alert = await deps.insertAlert({
      userId: profile.id,
      eventKey: swell.id,
      peakDate: getLocalDateString(new Date(swell.peakAt), profile.timezone),
      leadBeachId: swell.beach.id,
      payload,
      firstSighting: {
        now,
        eventKeys: [swell.id, swell.eventKey],
        onDenied: (reason) => { claimDenied = reason; },
      },
    });
    if (!alert) {
      increment(summary, claimDenied);
      return;
    }
    const enqueued = await deps.enqueue({
      type: "swell_watch",
      recipientUserId: profile.id,
      dedupeKey: `swell_watch:${profile.id}:${swell.id}`,
      payload,
    });
    if (!enqueued.enqueued) {
      if (enqueued.reason === "duplicate") {
        summary.duplicates += 1;
      } else {
        increment(summary, "enqueue_failed");
        summary.errors += 1;
      }
      return;
    }
    countSent(summary, "coming");
    recordOutlookSend(gate, now, "first_sighting", decision.exception);
    try {
      await deps.markAlertEnqueued(alert.id, enqueued.eventId);
    } catch (error) {
      console.error(`[swell-alert] Failed to mark first sighting for ${profile.id}:`, error);
      summary.errors += 1;
    }

    // Only a swell the notable detector also sees can be followed: a pulse it never
    // detects would be reported as "dropped" by the follow-up evaluation.
    if (followupEnabled && swell.notable && swell.periodS !== null) {
      try {
        await deps.saveFirstTold({
          userId: profile.id,
          eventKey: swell.eventKey,
          beachId: swell.beach.id,
          told: {
            arrivalAt: swell.arrivalAt ?? swell.peakAt,
            peakAt: swell.peakAt,
            faceHeightFt: firstSightingFaceHeightFt(swell),
            periodS: swell.periodS,
            directionDeg: swell.directionDeg,
            serious: payload.awareness_severity === "major",
            kind: "coming",
            toldAt: now.toISOString(),
            status: "active",
          },
        });
      } catch (error) {
        console.error(`[swell-alert] Failed to pin ${swell.eventKey} for follow-ups:`, error);
        summary.followupStateFailures += 1;
      }
    }
    if (followupEnabled && !swell.notable) increment(summary, "first_sighting_unpinned");
    return;
  }
  increment(summary, rejectedForRarity ? "skipped_unengaged" : "first_sighting_none");
}

async function runOutlookUser(
  deps: OutlookRunnerDeps,
  summary: SwellAlertRunSummary,
  profile: SwellAlertProfile,
  pinnedStates: readonly SwellFollowupState[],
  now: Date,
  followupEnabled: boolean,
): Promise<void> {
  let gate: EngagementGate | undefined;
  try {
    const loaded = await deps.loadEngagement(profile.id);
    const state = loaded ?? EMPTY_SWELL_OUTLOOK_USER_STATE;
    const settled = settle(state, now);
    gate = { state: settled, dirty: settled !== state, sends: [] };
    const tier = await deps.getTier(profile.id);
    const eligiblePins = tier === "free"
      ? pinnedStates.filter((pin) => profile.homeBeachId !== null && pin.beachId === profile.homeBeachId)
      : pinnedStates;
    if (followupEnabled && eligiblePins.length > 0 && deps.isFollowupUserAllowed(profile.id)) {
      await sendFollowups(deps, summary, profile, eligiblePins, now, gate);
    }
    await sendFirstSighting(deps, summary, profile, now, followupEnabled, gate, tier);
  } catch (error) {
    console.error(`[swell-alert] Error processing outlook user ${profile.id}:`, error);
    summary.errors += 1;
  } finally {
    if (gate?.dirty) {
      const { sends, list } = gate;
      await deps.saveEngagement(profile.id, (fresh) => {
        let next = settle(fresh, now);
        for (const send of sends) {
          const recorded = recordSend(next, send.at, send.kind, send.exception);
          // An open after this send already answered it; a delayed save must not revive its counter.
          const answered = next.lastAnsweredAt !== null && Date.parse(next.lastAnsweredAt) >= send.at.getTime();
          next = {
            ...recorded,
            ...(answered ? { consecutiveUnanswered: next.consecutiveUnanswered, pausedSince: next.pausedSince } : {}),
            lastSentAt: laterInstant(next.lastSentAt, recorded.lastSentAt),
            lastFirstSightingAt: laterInstant(next.lastFirstSightingAt, recorded.lastFirstSightingAt),
            lastExceptionAt: laterInstant(next.lastExceptionAt, recorded.lastExceptionAt),
          };
        }
        return list ? advanceLists(next, list) : next;
      }).catch((error: unknown) => {
        console.error(`[swell-alert] Failed to save engagement for ${profile.id}:`, error);
        summary.errors += 1;
      });
    }
  }
}

export async function runSwellAlertCron(args: {
  now: Date;
  supabase?: ServiceClient;
  deps?: Partial<RunnerDeps>;
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

  const followupEnabled = deps.isFollowupEnabled();
  const followupStates = new Map<string, SwellFollowupState[]>();
  if (followupEnabled) {
    try {
      for (const state of await deps.loadFollowupStates()) {
        followupStates.set(state.userId, [...(followupStates.get(state.userId) ?? []), state]);
      }
    } catch (error) {
      // First alerts must still go out when the follow-up table is unreadable.
      console.error("[swell-alert] Failed to load follow-up state:", error);
      summary.followupStateFailures += 1;
    }
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
    if (isOutlookRecipient(deps, profile.id)) {
      await runOutlookUser(deps, summary, profile, followupStates.get(profile.id) ?? [], args.now, followupEnabled);
      continue;
    }
    const pinnedStates = followupStates.get(profile.id);
    if (pinnedStates && deps.isFollowupUserAllowed(profile.id)) {
      await sendFollowups(deps, summary, profile, pinnedStates, args.now);
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
      const held = await deps.resolveHeldBeaches({
        candidates: candidates.map((candidate, index) =>
          forecastSlotCandidate(`swell:${index}`, candidate.beach.id, candidate.event.peakAt)),
        profileExperience: profile.experienceLevel,
        asOf: args.now,
      });
      const clearCandidates = candidates.filter((_, index) => {
        const reason = held.get(`swell:${index}`);
        if (reason) increment(summary, `held_${reason}`);
        return !reason;
      });
      const lead = clearCandidates[0];
      if (!lead) {
        increment(summary, "no_event_tomorrow");
        continue;
      }
      if (dailyCallOwnsToday(profile)
        && getLocalDateString(new Date(lead.event.peakAt), profile.timezone) === getLocalDateString(args.now, profile.timezone)) {
        increment(summary, "skipped_daily_call_owns_today");
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
        increment(summary, "cooldown_7d");
        continue;
      }

      const rankedBeaches = clearCandidates.slice(0, 3).map((candidate, index) => ({
        beach_id: candidate.beach.id,
        beach_name: candidate.beach.shortName ?? candidate.beach.name,
        rank: index + 1,
      }));
      const beachNames = rankedBeaches.map(({ beach_name }) => beach_name);
      const direction = lead.event.directionLabel;
      const selected = selectTitle({
        pool: "swell",
        tags: buildTags(lead, rarity.kind, rarity.historyDays),
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
          call: personalCall(beachNames[0], lead, profile.timezone),
        },
      });
      const body = lead.hazard ? `${selected.body} ${HAZARD_LINES[lead.hazard]}` : selected.body;
      // selectTitle still picks (tags, rotation, length); the push shows that
      // id as the card function renders it, so push and card stay one text.
      const headline = getSwellCardHeadline({
        titleId: selected.id,
        kind: "coming",
        eventKey,
        beachName: beachNames[0],
        peakDayLabel: weekday(lead.peakDate),
        serious: lead.serious,
      });
      const title = headline.titleId === selected.id ? headline.headline : selected.title;
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
        title,
        body,
        beaches: rankedBeaches,
        rarity: rarity.rarityLine,
        event_key: eventKey,
        title_id: selected.id,
        ...(followupEnabled
          ? { kind: "coming", share_url: buildSwellShareUrl(eventKey, "coming", selected.id) }
          : {}),
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
      countSent(summary, "coming");
      if (followupEnabled) {
        try {
          await deps.saveFirstTold({
            userId: profile.id,
            eventKey,
            beachId: lead.beach.id,
            told: {
              arrivalAt: lead.event.arrivalAt,
              peakAt: lead.event.peakAt,
              faceHeightFt: lead.event.peakFaceHeightFt,
              periodS: lead.event.periodS,
              directionDeg: lead.event.directionDeg,
              serious: lead.serious,
              kind: "coming",
              toldAt: args.now.toISOString(),
              status: "active",
            },
          });
        } catch (error) {
          // The push is already out; a missing pin only means no follow-ups for this swell.
          console.error(`[swell-alert] Failed to pin ${eventKey} for follow-ups:`, error);
          summary.followupStateFailures += 1;
        }
      }
    } catch (error) {
      console.error(`[swell-alert] Error processing ${profile.id}:`, error);
      summary.errors += 1;
    }
  }

  summary.durationMs = Date.now() - startedAt;
  return summary;
}
