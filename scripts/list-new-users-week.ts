/**
 * Lists users who signed up in the past 7 days, split into normal inboxes
 * (`sendable`) and Apple Hide-My-Email relays (`appleRelay`), which cannot be
 * emailed from a personal Gmail.
 *
 * Each user carries the activity recorded *after* their signup that the weekly
 * founder-outreach routine personalizes from: home break, most-viewed beaches,
 * the latest unresolved abandoned session log, completed session count, and
 * zero-result beach searches.
 *
 * Usage: npx tsx scripts/list-new-users-week.ts
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import path from "node:path";

config({ path: path.resolve(process.cwd(), ".env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (expected in .env.local)"
  );
}

const APPLE_RELAY_DOMAIN = "@privaterelay.appleid.com";
const TEST_EMAIL_PATTERNS = [/@example\.invalid$/i, /@quiversurf\.test$/i, /^codex-/i, /^e2e-/i];
const DAYS = 7;

/** Max beaches reported per user in `beachesViewed`. */
const MAX_BEACHES_VIEWED = 3;
/** PostgREST caps a single response at 1000 rows; page through anything larger. */
const PAGE_SIZE = 1000;
/** Keep `.in()` filter lists short enough to stay under URL length limits. */
const IN_CHUNK_SIZE = 100;

const VIEW_EVENT = "beach_view";
const ABANDON_EVENT = "session_log_abandon";
const SEARCH_EVENT = "beach_search";
const NATIVE_NO_RESULTS_EVENT = "session_spot_search_no_results";
/**
 * Personalization reads these four. The fetch below deliberately does NOT filter
 * to them: a native user can fire fifty events without touching any of these and
 * would then read as "no activity", which is false and produces the wrong email.
 * `activity` carries the whole stream so version D means the account really was
 * silent. Kept exported-shaped for the routine's own reference.
 */
const ACTIVITY_EVENT_TYPES = [
  VIEW_EVENT,
  ABANDON_EVENT,
  SEARCH_EVENT,
  NATIVE_NO_RESULTS_EVENT,
] as const;

/** Signals worth naming when deciding whether a quiet account hit a wall. */
const FRICTION_EVENT_TYPES = [
  "session_log_validation_failed",
  "auth_failed",
  "auth_modal_closed_without_action",
  "client_error",
  "empty_state_shown",
  "paywall_opened",
  "map_load_failed",
  "custom_spot_failed",
];

type BeachRef = {
  id: string;
  name: string;
};

type BeachViewed = BeachRef & {
  viewCount: number;
  lastViewedAt: string;
};

type AbandonedSession = {
  beachName: string | null;
  abandonedAt: string;
  maxStepReached: string | null;
};

type ZeroResultSearch = {
  count: number;
  lastSearchedAt: string;
};

type ActivitySummary = {
  eventCount: number;
  platform: "native" | "web" | "native + web" | "none";
  firstEventAt: string | null;
  lastEventAt: string | null;
  spanMinutes: number | null;
  topEvents: Array<{ eventType: string; count: number }>;
  frictionEvents: Array<{ eventType: string; count: number }>;
};

type NewUser = {
  email: string;
  greeting: string | null;
  displayName: string | null;
  createdAt: string;
  homeBreak: BeachRef | null;
  beachesViewed: BeachViewed[];
  latestAbandonedSession: AbandonedSession | null;
  completedSessionCount: number;
  zeroResultSearch: ZeroResultSearch | null;
  activity: ActivitySummary;
};

type ProfileRow = {
  id: string;
  email: string | null;
  display_name: string | null;
  full_name: string | null;
  created_at: string;
  home_beach_id: string | null;
};

type EventRow = {
  user_id: string | null;
  event_type: string;
  beach_id: string | null;
  metadata: unknown;
  created_at: string;
};

type SessionRow = {
  user_id: string;
  beach_id: string;
  created_at: string;
};

/** Junk-name heuristics: initials, handles, single letters, digits, emails. */
function toGreeting(displayName: string | null): string | null {
  if (!displayName) return null;
  const first = displayName.trim().split(/\s+/)[0] ?? "";
  if (first.length < 2) return null;
  if (first.includes("@")) return null;
  if (!/^[\p{L}][\p{L}'’-]+$/u.test(first)) return null;
  if (first === first.toUpperCase() && first.length <= 3) return null;

  return first.charAt(0).toUpperCase() + first.slice(1);
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

type PageResult<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>;

/** Runs a range-paged query to exhaustion so results are never silently truncated. */
async function fetchAllPages<T>(
  label: string,
  page: (from: number, to: number) => PageResult<T>
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await page(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`${label} fetch failed: ${error.message}`);
    const batch = data ?? [];
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) return rows;
  }
}

async function fetchActivityEvents(
  supabase: SupabaseClient,
  userIds: string[],
  cutoffIso: string
): Promise<EventRow[]> {
  const rows: EventRow[] = [];
  for (const ids of chunk(userIds, IN_CHUNK_SIZE)) {
    const batch = await fetchAllPages<EventRow>("user_events", (from, to) =>
      supabase
        .from("user_events")
        .select("user_id, event_type, beach_id, metadata, created_at")
        .in("user_id", ids)
        .gte("created_at", cutoffIso)
        // Excludes traffic tagged by the bot-ingest filter; NULL stays included.
        .not("bot_flagged", "is", true)
        .order("created_at")
        .range(from, to)
    );
    rows.push(...batch);
  }
  return rows;
}

async function fetchCompletedSessions(
  supabase: SupabaseClient,
  userIds: string[],
  cutoffIso: string
): Promise<SessionRow[]> {
  const rows: SessionRow[] = [];
  for (const ids of chunk(userIds, IN_CHUNK_SIZE)) {
    const batch = await fetchAllPages<SessionRow>("sessions", (from, to) =>
      supabase
        .from("sessions")
        .select("user_id, beach_id, created_at")
        .in("user_id", ids)
        .eq("status", "completed")
        .is("deleted_at", null)
        .gte("created_at", cutoffIso)
        .order("created_at")
        .range(from, to)
    );
    rows.push(...batch);
  }
  return rows;
}

async function fetchBeachNames(
  supabase: SupabaseClient,
  beachIds: string[]
): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  for (const ids of chunk(beachIds, IN_CHUNK_SIZE)) {
    const { data, error } = await supabase.from("beaches").select("id, name").in("id", ids);
    if (error) throw new Error(`beaches fetch failed: ${error.message}`);
    for (const row of data ?? []) names.set(row.id, row.name);
  }
  return names;
}

function groupBy<T>(rows: T[], key: (row: T) => string | null): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const row of rows) {
    const k = key(row);
    if (!k) continue;
    const bucket = out.get(k);
    if (bucket) bucket.push(row);
    else out.set(k, [row]);
  }
  return out;
}

function toBeachesViewed(
  events: EventRow[],
  beachNames: Map<string, string>
): BeachViewed[] {
  const byBeach = groupBy(events, (event) => event.beach_id);
  const viewed: BeachViewed[] = [];

  for (const [beachId, beachEvents] of byBeach) {
    const name = beachNames.get(beachId);
    if (!name) continue;
    const lastViewedAt = beachEvents.reduce(
      (latest, event) => (event.created_at > latest ? event.created_at : latest),
      beachEvents[0].created_at
    );
    viewed.push({ id: beachId, name, viewCount: beachEvents.length, lastViewedAt });
  }

  return viewed
    .sort((a, b) => b.viewCount - a.viewCount || b.lastViewedAt.localeCompare(a.lastViewedAt))
    .slice(0, MAX_BEACHES_VIEWED);
}

/**
 * The most recent abandoned log the user never came back and finished.
 *
 * Two payload shapes exist in `user_events` and only one is nameable. The web
 * form (components/session-forms/SessionScrollForm.tsx) sends `beach_id` plus
 * `max_step_reached`. Native sends neither — it reports `has_beach` and
 * `touched_fields`, so the spot cannot be resolved and `beachName` comes back
 * null. As of 2026-08-10 that is 104 of 105 rows all-time, so a null beachName
 * is the normal case, not an edge case. `touched_fields` is deliberately NOT
 * mapped onto `maxStepReached`: they are different concepts and inventing a
 * mapping would put a fabricated step in front of a user.
 */
function toLatestAbandonedSession(
  events: EventRow[],
  completedSessions: SessionRow[],
  beachNames: Map<string, string>
): AbandonedSession | null {
  const completedAtBeach = groupBy(completedSessions, (session) => session.beach_id);

  const candidates = events
    .map((event) => {
      const metadata = asRecord(event.metadata);
      const metadataBeachId = metadata.beach_id;
      const beachId =
        event.beach_id ?? (typeof metadataBeachId === "string" ? metadataBeachId : null);
      const maxStep = metadata.max_step_reached;
      return {
        beachId,
        abandonedAt: event.created_at,
        maxStepReached: typeof maxStep === "string" ? maxStep : null,
      };
    })
    .sort((a, b) => b.abandonedAt.localeCompare(a.abandonedAt));

  for (const candidate of candidates) {
    // "Not followed by a completed session for the same beach." When the beach
    // is unknown we cannot check per-beach, so fall back to the stricter test —
    // any later completed session disqualifies it — rather than risk telling
    // someone they bailed on a log they actually finished.
    const laterSessions = candidate.beachId
      ? (completedAtBeach.get(candidate.beachId) ?? [])
      : completedSessions;
    if (laterSessions.some((session) => session.created_at > candidate.abandonedAt)) continue;

    return {
      beachName: candidate.beachId ? (beachNames.get(candidate.beachId) ?? null) : null,
      abandonedAt: candidate.abandonedAt,
      maxStepReached: candidate.maxStepReached,
    };
  }

  return null;
}

/**
 * Searches that returned nothing. The query text is deliberately never stored
 * (see BeachSearchMetadata), so only counts and timing are available.
 */
function toZeroResultSearch(events: EventRow[]): ZeroResultSearch | null {
  const empty = events.filter((event) => {
    if (event.event_type === NATIVE_NO_RESULTS_EVENT) return true;
    if (event.event_type !== SEARCH_EVENT) return false;
    return asRecord(event.metadata).zero_results === true;
  });
  if (empty.length === 0) return null;

  const lastSearchedAt = empty.reduce(
    (latest, event) => (event.created_at > latest ? event.created_at : latest),
    empty[0].created_at
  );
  return { count: empty.length, lastSearchedAt };
}

/**
 * Native builds stamp `app_build` / Expo launch keys into metadata; web does not.
 * `user_events` has no platform column, so this is a heuristic, not a fact.
 */
function toActivitySummary(events: EventRow[]): ActivitySummary {
  if (events.length === 0) {
    return {
      eventCount: 0,
      platform: "none",
      firstEventAt: null,
      lastEventAt: null,
      spanMinutes: null,
      topEvents: [],
      frictionEvents: [],
    };
  }

  let native = 0;
  let web = 0;
  const perType = new Map<string, number>();
  for (const event of events) {
    const metadata = asRecord(event.metadata);
    if ("app_build" in metadata || "expo_is_emergency_launch" in metadata) native += 1;
    else web += 1;
    perType.set(event.event_type, (perType.get(event.event_type) ?? 0) + 1);
  }

  const sorted = [...events].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const firstEventAt = sorted[0].created_at;
  const lastEventAt = sorted[sorted.length - 1].created_at;

  const rank = (entries: Iterable<[string, number]>) =>
    [...entries]
      .sort((a, b) => b[1] - a[1])
      .map(([eventType, count]) => ({ eventType, count }));

  return {
    eventCount: events.length,
    platform: native > 0 && web > 0 ? "native + web" : native > 0 ? "native" : "web",
    firstEventAt,
    lastEventAt,
    spanMinutes: Math.round((Date.parse(lastEventAt) - Date.parse(firstEventAt)) / 60000),
    topEvents: rank(perType).slice(0, 5),
    frictionEvents: rank(
      [...perType].filter(([eventType]) => FRICTION_EVENT_TYPES.includes(eventType))
    ),
  };
}

async function main(): Promise<void> {
  const supabase = createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const cutoff = new Date(Date.now() - DAYS * 24 * 60 * 60 * 1000);
  const cutoffIso = cutoff.toISOString();

  const profileRows = await fetchAllPages<ProfileRow>("profiles", (from, to) =>
    supabase
      .from("profiles")
      .select("id, email, display_name, full_name, created_at, home_beach_id")
      .eq("is_mock", false)
      .gte("created_at", cutoffIso)
      .order("created_at")
      .range(from, to)
  );

  const profiles: ProfileRow[] = profileRows
    .filter((row): row is ProfileRow & { email: string } => Boolean(row.email))
    .filter((row) => !TEST_EMAIL_PATTERNS.some((pattern) => pattern.test(row.email!)));

  const userIds = profiles.map((row) => row.id);
  const [events, completedSessions] = userIds.length
    ? await Promise.all([
        fetchActivityEvents(supabase, userIds, cutoffIso),
        fetchCompletedSessions(supabase, userIds, cutoffIso),
      ])
    : [[] as EventRow[], [] as SessionRow[]];

  const eventsByUser = groupBy(events, (event) => event.user_id);
  const sessionsByUser = groupBy(completedSessions, (session) => session.user_id);

  const beachIds = new Set<string>();
  for (const row of profiles) if (row.home_beach_id) beachIds.add(row.home_beach_id);
  for (const event of events) {
    if (event.beach_id) beachIds.add(event.beach_id);
    const metadataBeachId = asRecord(event.metadata).beach_id;
    if (typeof metadataBeachId === "string") beachIds.add(metadataBeachId);
  }
  const beachNames = await fetchBeachNames(supabase, [...beachIds]);

  const all: NewUser[] = profiles.map((row) => {
    const displayName = row.display_name ?? row.full_name ?? null;

    // Activity is only meaningful from the moment the account existed.
    const userEvents = (eventsByUser.get(row.id) ?? []).filter(
      (event) => event.created_at >= row.created_at
    );
    const userSessions = (sessionsByUser.get(row.id) ?? []).filter(
      (session) => session.created_at >= row.created_at
    );

    const homeBeachName = row.home_beach_id ? beachNames.get(row.home_beach_id) : undefined;

    return {
      email: row.email!,
      greeting: toGreeting(displayName),
      displayName,
      createdAt: row.created_at,
      homeBreak:
        row.home_beach_id && homeBeachName
          ? { id: row.home_beach_id, name: homeBeachName }
          : null,
      beachesViewed: toBeachesViewed(
        userEvents.filter((event) => event.event_type === VIEW_EVENT),
        beachNames
      ),
      latestAbandonedSession: toLatestAbandonedSession(
        userEvents.filter((event) => event.event_type === ABANDON_EVENT),
        userSessions,
        beachNames
      ),
      completedSessionCount: userSessions.length,
      zeroResultSearch: toZeroResultSearch(userEvents),
      activity: toActivitySummary(userEvents),
    };
  });

  const isRelay = (u: NewUser) => u.email.toLowerCase().endsWith(APPLE_RELAY_DOMAIN);

  console.log(
    JSON.stringify(
      {
        since: cutoffIso,
        total: all.length,
        sendable: all.filter((u) => !isRelay(u)),
        appleRelay: all.filter(isRelay),
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
