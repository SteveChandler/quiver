import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { generateWeekScoutForecastForDays, type CanonicalWeekScoutResponse, type WeekScoutDaysRequest } from "@/lib/services/discovery/week-scout";
import { getSpotSurfReportPublic, type SpotSurfReportResult } from "@/lib/services/spot-surf-report-service";
import { getBeachBySlugOrId } from "@/lib/utils/beach-lookup-utils";
import { buildBeachUrl } from "@/lib/utils/beach-url-utils";
import { selectPublicGeneralCall } from "@/lib/utils/public-forecast-facts";
import { getSurfCallVerdictCall } from "@/components/forecast/score-band-call";
import type { ScoreLabel } from "@/lib/utils/score-color-utils";
import { getLocalDateString, resolveBeachTimezone } from "@/lib/utils/timezone-utils";
import { notificationBeachName } from "@/lib/notifications/copy/daily-call-copy";
import { createContextLogger } from "@/lib/logger";
import { parseSessionTime, type SessionTime } from "@/lib/scoring/session-time-preference";
import { resolveFeatureAccessFromRow } from "@/lib/alerts/entitlements";
import { readEntitlementRow } from "@/lib/subscription/read-entitlement-row";

/** A window as the canonical Week Scout response carries it (held windows may have no score). */
export type ActivationWindow = CanonicalWeekScoutResponse["days"][number]["windows"][number];

const log = createContextLogger("activation-email");

/** The views that count as "looked at this beach", the same set the lifecycle activity rule reads. */
const VIEW_EVENTS = ["beach_view", "forecast_check", "home_beach_forecast_viewed", "home_hero_forecast_viewed"] as const;
const VIEW_LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000;
// Forecast rows refresh about every 2 h; 6 h allows one or two missed refreshes.
const MAX_CALL_AGE_MS = 6 * 60 * 60 * 1000;
/** Same close buffer the Daily Call uses: a window that ends within 30 min is not a window to drive to. */
const CLOSE_BUFFER_MS = 30 * 60 * 1000;
const ACTIVATION_CALL_DAYS = 3;
// Matches native's FREE_WEEK_SCOUT_DAY_LIMIT: today and tomorrow.
const FREE_WEEK_SCOUT_DAY_LIMIT = 2;
const ACTIVATION_CALL_BUDGET_MS = 8_000;

export interface ActivationBeach {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  windOffshoreDeg: number | null;
  aspectDeg: number | null;
}

export type ActivationCall =
  | { kind: "window"; beach: ActivationBeach; label: "GOOD" | "FAIR"; window: ActivationWindow; now: string }
  | { kind: "public_call"; beach: ActivationBeach; label: ScoreLabel; now: string }
  | { kind: "fallback"; beach: ActivationBeach; reason: "no_call" | "stale_call" | "read_failed"; now: string }
  /** The user has no beach at all. */
  | { kind: "no_beach"; now: string }
  /** A beach exists but could not be read, so there is no name to print: the email keeps the approved v3 copy. */
  | { kind: "beach_unreadable"; now: string };

type BeachRow = { id: string; name: string; short_name: string | null; slug: string | null; timezone: string | null; wind_offshore_deg: number | null; aspect_deg: number | null };

export interface ActivationCallDeps {
  /** Beach ids from the user's view events in the window, newest first. */
  readViewedBeachIds: (userId: string, since: Date) => Promise<string[]>;
  readBeach: (beachId: string) => Promise<BeachRow | null>;
  hasAppDevice: (userId: string) => Promise<boolean>;
  readPublicReport: (beach: ActivationBeach) => Promise<SpotSurfReportResult | null>;
  /** profiles.preferred_session_time, the same value the Week Scout route and the Daily Call pass. */
  readSessionTime: (userId: string) => Promise<SessionTime | null>;
  hasForecastFeatureAccess: (userId: string) => Promise<boolean>;
  generate: (userId: string, request: WeekScoutDaysRequest) => Promise<CanonicalWeekScoutResponse>;
}

/** Thrown only by the reads below; nothing else becomes fallback copy. */
class ActivationReadError extends Error {
  constructor(step: string, cause: unknown) {
    super(`Activation call read failed: ${step}`, { cause });
  }
}

function defaultDeps(): ActivationCallDeps {
  return {
    readViewedBeachIds: async (userId, since) => {
      const { data, error } = await createSupabaseServiceRoleClient().from("user_events").select("beach_id")
        .eq("user_id", userId).in("event_type", [...VIEW_EVENTS]).not("beach_id", "is", null).not("bot_flagged", "is", true)
        .gte("created_at", since.toISOString()).order("created_at", { ascending: false }).limit(500);
      if (error) throw new Error(error.message);
      return (data ?? []).flatMap((row: { beach_id: string | null }) => row.beach_id ? [row.beach_id] : []);
    },
    readBeach: async (beachId) => {
      const { data, error } = await createSupabaseServiceRoleClient().from("beaches")
        .select("id,name,short_name,slug,timezone,wind_offshore_deg,aspect_deg").eq("id", beachId).eq("is_private", false).maybeSingle();
      if (error) throw new Error(error.message);
      return (data as BeachRow | null) ?? null;
    },
    hasAppDevice: async (userId) => {
      const { data, error } = await createSupabaseServiceRoleClient().from("user_devices")
        .select("user_id").eq("user_id", userId).limit(1);
      if (error) throw new Error(error.message);
      return Boolean(data?.length);
    },
    readPublicReport: async (beach) => {
      // The web handoff resolves by slug, which can be shared by multiple beaches.
      const linkedBeach = await getBeachBySlugOrId(beach.slug);
      if (linkedBeach?.id !== beach.id) return null;
      // The legacy spot page has no public call to match.
      if (buildBeachUrl(linkedBeach).startsWith("/beach/")) return null;
      return getSpotSurfReportPublic(linkedBeach);
    },
    readSessionTime: async (userId) => {
      const { data, error } = await createSupabaseServiceRoleClient().from("profiles")
        .select("preferred_session_time").eq("id", userId).maybeSingle();
      if (error) throw new Error(error.message);
      return parseSessionTime((data as { preferred_session_time?: unknown } | null)?.preferred_session_time);
    },
    hasForecastFeatureAccess: async (userId): Promise<boolean> => {
      const entitlement = await readEntitlementRow(createSupabaseServiceRoleClient(), userId);
      if (entitlement.status === "unknown") return false;
      const { hasFeatureAccess } = await resolveFeatureAccessFromRow(userId, entitlement.row);
      return hasFeatureAccess;
    },
    generate: (userId, request) => generateWeekScoutForecastForDays(userId, request),
  };
}

/** Most views wins; a tie goes to the beach viewed most recently (ids arrive newest first). */
export function mostViewedBeachId(idsNewestFirst: readonly string[]): string | null {
  const counts = new Map<string, number>();
  for (const id of idsNewestFirst) counts.set(id, (counts.get(id) ?? 0) + 1);
  let best: string | null = null;
  for (const [id, count] of counts) if (best === null || count > (counts.get(best) ?? 0)) best = id;
  return best;
}

async function read<T>(step: string, load: () => Promise<T>): Promise<T> {
  try {
    return await load();
  } catch (error) {
    throw new ActivationReadError(step, error);
  }
}

function withBudget<T>(load: Promise<T>, budgetMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new ActivationReadError("budget", new Error(`over ${budgetMs} ms`))), budgetMs);
    timer.unref?.();
  });
  return Promise.race([load, timeout]).finally(() => clearTimeout(timer));
}

function toBeach(row: BeachRow): ActivationBeach | null {
  if (!row.slug) return null;
  return {
    id: row.id, name: notificationBeachName(row), slug: row.slug, timezone: resolveBeachTimezone(row.timezone),
    windOffshoreDeg: row.wind_offshore_deg ?? null, aspectDeg: row.aspect_deg ?? null,
  };
}

function callLabel(window: ActivationWindow): "GOOD" | "FAIR" | null {
  // EPIC prints as GOOD while EPIC_LABEL_ENABLED is off.
  if (window.personalLabel === "EPIC" || window.personalLabel === "GOOD") return "GOOD";
  return window.personalLabel === "FAIR" ? "FAIR" : null;
}

/**
 * The week's session pick from the same canonical decision the app shows, for
 * one beach over the requested days. Null when the app would not pick a window.
 */
function pickActivationWindow(response: CanonicalWeekScoutResponse, now: Date): { window: ActivationWindow; label: "GOOD" | "FAIR" } | null {
  const decision = response.sessionDecision;
  const selectedId = decision.verdict === "no" ? null : decision.selection?.candidateId ?? null;
  if (!selectedId) return null;
  const window = response.days.flatMap(day => day.windows).find(candidate => candidate.id === selectedId);
  if (!window) return null;
  const label = callLabel(window);
  if (!label) return null;
  if (Date.parse(window.displayWindowEnd) - now.getTime() < CLOSE_BUFFER_MS) return null;
  const height = Number.parseFloat(String(window.forecast.waveHeight ?? ""));
  if (!Number.isFinite(height) || height <= 0) return null;
  return { window, label };
}

async function readNamedBeach(ids: readonly (string | null)[], deps: ActivationCallDeps): Promise<ActivationBeach | null> {
  for (const id of ids) {
    if (!id) continue;
    const row = await read("beach", () => deps.readBeach(id));
    const beach = row ? toBeach(row) : null;
    if (beach) return beach;
  }
  return null;
}

/**
 * Loads the forecast-first content for the activation email. A failed or slow
 * read gives the fallback copy, never a blank number; any other error is a bug
 * and propagates.
 */
export async function loadActivationCall(args: {
  userId: string; homeBeachId: string | null; now?: Date; deps?: ActivationCallDeps; budgetMs?: number;
}): Promise<ActivationCall> {
  const now = args.now ?? new Date();
  const deps = args.deps ?? defaultDeps();
  const budgetMs = args.budgetMs ?? ACTIVATION_CALL_BUDGET_MS;
  const nowIso = now.toISOString();
  let viewedId: string | null = null;
  let viewsFailed = false;
  try {
    viewedId = mostViewedBeachId(await withBudget(read("viewed beaches", () => deps.readViewedBeachIds(args.userId, new Date(now.getTime() - VIEW_LOOKBACK_MS))), budgetMs));
  } catch (error) {
    if (!(error instanceof ActivationReadError)) throw error;
    log.warn("Activation email view read failed; using the home beach", { error: error.message });
    viewsFailed = true;
  }
  let beach: ActivationBeach | null;
  try {
    beach = await withBudget(readNamedBeach([viewedId, args.homeBeachId], deps), budgetMs);
  } catch (error) {
    if (!(error instanceof ActivationReadError)) throw error;
    // The user may have a beach; without its name the email keeps the approved v3 copy.
    log.warn("Activation email beach read failed; using the v3 copy", { error: error.message });
    return { kind: "beach_unreadable", now: nowIso };
  }
  if (!beach) return { kind: "no_beach", now: nowIso };
  if (viewsFailed) return { kind: "fallback", beach, reason: "read_failed", now: nowIso };

  let response: CanonicalWeekScoutResponse;
  try {
    const hasAppDevice = await withBudget(read("device lookup", () => deps.hasAppDevice(args.userId)), budgetMs);
    if (!hasAppDevice) {
      const result = await withBudget(read("public forecast", () => deps.readPublicReport(beach)), budgetMs);
      const report = result?.report ?? null;
      const generalCall = selectPublicGeneralCall(report);
      if (!generalCall) return { kind: "fallback", beach, reason: "no_call", now: nowIso };
      const { label } = getSurfCallVerdictCall(generalCall.verdict, generalCall.score, result?.isTomorrow ? "upcoming" : "now", {
        beachId: beach.id,
        instantIso: result?.forecastContext?.displayWindowStart ?? report?.bestWindowStart ?? result?.forecastContext?.selectedRowTime,
      });
      return { kind: "public_call", beach, label, now: nowIso };
    }
    const [sessionTime, hasFeatureAccess] = await withBudget(Promise.all([
      read("session time", () => deps.readSessionTime(args.userId)),
      read("forecast access", () => deps.hasForecastFeatureAccess(args.userId)),
    ]), budgetMs);
    response = await withBudget(read("forecast", () => deps.generate(args.userId, {
      candidateBeachIds: [beach.id], localTimezone: beach.timezone,
      startLocalDate: getLocalDateString(now, beach.timezone),
      dayCount: hasFeatureAccess ? ACTIVATION_CALL_DAYS : FREE_WEEK_SCOUT_DAY_LIMIT,
      ...(sessionTime ? { sessionTime } : {}),
    })), budgetMs);
  } catch (error) {
    if (!(error instanceof ActivationReadError)) throw error;
    log.warn("Activation email forecast read failed; using fallback copy", { error: error.message });
    return { kind: "fallback", beach, reason: "read_failed", now: nowIso };
  }
  const pick = pickActivationWindow(response, now);
  if (!pick) return { kind: "fallback", beach, reason: "no_call", now: nowIso };
  if (now.getTime() - Date.parse(pick.window.forecast.freshnessAt) > MAX_CALL_AGE_MS || !Number.isFinite(Date.parse(pick.window.forecast.freshnessAt))) {
    return { kind: "fallback", beach, reason: "stale_call", now: nowIso };
  }
  return { kind: "window", beach, label: pick.label, window: pick.window, now: nowIso };
}
