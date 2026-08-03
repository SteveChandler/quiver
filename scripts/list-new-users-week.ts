/**
 * Lists users who signed up in the past 7 days, split into normal inboxes
 * (`sendable`) and Apple Hide-My-Email relays (`appleRelay`), which cannot be
 * emailed from a personal Gmail.
 *
 * Each user carries the activity recorded *after* their signup that the weekly
 * founder-email routine uses to personalize outreach: home break, most-viewed
 * beaches, the latest genuinely-abandoned session log, completed session count,
 * and empty spot searches.
 *
 * Usage: npx tsx scripts/list-new-users-week.ts
 */
import { createClient } from "@supabase/supabase-js";
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
const MAX_BEACHES_VIEWED = 3;

const EVENT_TYPES = [
  "beach_view",
  "session_log_abandon",
  "session_spot_search_no_results",
] as const;

type BeachRef = { id: string; name: string };

type BeachViewed = BeachRef & { viewCount: number; lastViewedAt: string };

type AbandonedSession = {
  beachName: string;
  abandonedAt: string;
  maxStepReached: string | null;
};

type SearchNoResults = { count: number; lastSearchedAt: string };

type NewUser = {
  email: string;
  greeting: string | null;
  displayName: string | null;
  createdAt: string;
  homeBreak: BeachRef | null;
  beachesViewed: BeachViewed[];
  latestAbandonedSession: AbandonedSession | null;
  completedSessionCount: number;
  searchNoResults: SearchNoResults | null;
};

type ProfileRow = {
  id: string;
  email: string;
  display_name: string | null;
  full_name: string | null;
  created_at: string;
  home_beach_id: string | null;
};

type EventRow = {
  user_id: string | null;
  event_type: string;
  beach_id: string | null;
  created_at: string;
  metadata: unknown;
};

type SessionRow = {
  user_id: string;
  beach_id: string;
  status: string | null;
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

function readMetadata(metadata: unknown): Record<string, unknown> {
  return metadata && typeof metadata === "object" ? (metadata as Record<string, unknown>) : {};
}

/** The abandon event carries beach_id in metadata as well as the column. */
function eventBeachId(row: EventRow): string | null {
  if (row.beach_id) return row.beach_id;
  const fromMetadata = readMetadata(row.metadata).beach_id;
  return typeof fromMetadata === "string" ? fromMetadata : null;
}

function maxStepReached(row: EventRow): string | null {
  const step = readMetadata(row.metadata).max_step_reached;
  return typeof step === "string" ? step : null;
}

function topBeachesViewed(rows: EventRow[], beachNames: Map<string, string>): BeachViewed[] {
  const byBeach = new Map<string, { viewCount: number; lastViewedAt: string }>();

  for (const row of rows) {
    const beachId = eventBeachId(row);
    if (!beachId || !beachNames.has(beachId)) continue;

    const existing = byBeach.get(beachId);
    if (!existing) {
      byBeach.set(beachId, { viewCount: 1, lastViewedAt: row.created_at });
      continue;
    }
    existing.viewCount += 1;
    if (row.created_at > existing.lastViewedAt) existing.lastViewedAt = row.created_at;
  }

  return [...byBeach.entries()]
    .map(([id, stats]) => ({ id, name: beachNames.get(id)!, ...stats }))
    .sort((a, b) => b.viewCount - a.viewCount || b.lastViewedAt.localeCompare(a.lastViewedAt))
    .slice(0, MAX_BEACHES_VIEWED);
}

/**
 * Latest abandonment that was NOT followed by a completed session at the same
 * beach — abandoning and then finishing the log later is not a problem worth
 * emailing about.
 */
function latestUnresolvedAbandon(
  rows: EventRow[],
  completed: SessionRow[],
  beachNames: Map<string, string>
): AbandonedSession | null {
  const sorted = [...rows].sort((a, b) => b.created_at.localeCompare(a.created_at));

  for (const row of sorted) {
    const beachId = eventBeachId(row);
    const name = beachId ? beachNames.get(beachId) : undefined;
    if (!beachId || !name) continue;

    const resolved = completed.some(
      (session) => session.beach_id === beachId && session.created_at >= row.created_at
    );
    if (resolved) continue;

    return {
      beachName: name,
      abandonedAt: row.created_at,
      maxStepReached: maxStepReached(row),
    };
  }

  return null;
}

async function main(): Promise<void> {
  const supabase = createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const cutoff = new Date(Date.now() - DAYS * 24 * 60 * 60 * 1000);

  const { data: profileData, error: profileError } = await supabase
    .from("profiles")
    .select("id, email, display_name, full_name, created_at, home_beach_id")
    .eq("is_mock", false)
    .gte("created_at", cutoff.toISOString())
    .order("created_at");
  if (profileError) throw new Error(`profiles fetch failed: ${profileError.message}`);

  const profiles = ((profileData ?? []) as ProfileRow[])
    .filter((row) => Boolean(row.email))
    .filter((row) => !TEST_EMAIL_PATTERNS.some((pattern) => pattern.test(row.email)));

  const userIds = profiles.map((row) => row.id);

  if (userIds.length === 0) {
    console.log(
      JSON.stringify({ since: cutoff.toISOString(), total: 0, sendable: [], appleRelay: [] }, null, 2)
    );
    return;
  }

  // Activity is only ever read from each user's own signup onward, so the
  // earliest signup in the batch is a safe floor for both fetches.
  const activityFloor = profiles[0].created_at;

  const [eventsResult, sessionsResult] = await Promise.all([
    supabase
      .from("user_events")
      .select("user_id, event_type, beach_id, created_at, metadata")
      .in("user_id", userIds)
      .in("event_type", EVENT_TYPES as unknown as string[])
      .not("bot_flagged", "is", true)
      .gte("created_at", activityFloor)
      .order("created_at")
      .limit(5000),
    supabase
      .from("sessions")
      .select("user_id, beach_id, status, created_at")
      .in("user_id", userIds)
      .eq("status", "completed")
      .is("deleted_at", null)
      .gte("created_at", activityFloor)
      .limit(5000),
  ]);

  if (eventsResult.error) throw new Error(`user_events fetch failed: ${eventsResult.error.message}`);
  if (sessionsResult.error) throw new Error(`sessions fetch failed: ${sessionsResult.error.message}`);

  const events = (eventsResult.data ?? []) as EventRow[];
  const sessions = (sessionsResult.data ?? []) as SessionRow[];

  const beachIds = new Set<string>();
  for (const row of profiles) if (row.home_beach_id) beachIds.add(row.home_beach_id);
  for (const row of events) {
    const beachId = eventBeachId(row);
    if (beachId) beachIds.add(beachId);
  }

  const beachNames = new Map<string, string>();
  if (beachIds.size > 0) {
    const { data: beachData, error: beachError } = await supabase
      .from("beaches")
      .select("id, name")
      .in("id", [...beachIds]);
    if (beachError) throw new Error(`beaches fetch failed: ${beachError.message}`);
    for (const beach of beachData ?? []) {
      if (beach.name) beachNames.set(beach.id, beach.name);
    }
  }

  const all: NewUser[] = profiles.map((profile) => {
    const displayName = profile.display_name ?? profile.full_name ?? null;

    // Only activity recorded after this user signed up.
    const mine = events.filter(
      (row) => row.user_id === profile.id && row.created_at >= profile.created_at
    );
    const myCompleted = sessions.filter(
      (row) => row.user_id === profile.id && row.created_at >= profile.created_at
    );
    const searches = mine.filter((row) => row.event_type === "session_spot_search_no_results");

    const homeBeachName = profile.home_beach_id ? beachNames.get(profile.home_beach_id) : undefined;

    return {
      email: profile.email,
      greeting: toGreeting(displayName),
      displayName,
      createdAt: profile.created_at,
      homeBreak:
        profile.home_beach_id && homeBeachName
          ? { id: profile.home_beach_id, name: homeBeachName }
          : null,
      beachesViewed: topBeachesViewed(
        mine.filter((row) => row.event_type === "beach_view"),
        beachNames
      ),
      latestAbandonedSession: latestUnresolvedAbandon(
        mine.filter((row) => row.event_type === "session_log_abandon"),
        myCompleted,
        beachNames
      ),
      completedSessionCount: myCompleted.length,
      searchNoResults:
        searches.length > 0
          ? {
              count: searches.length,
              lastSearchedAt: searches[searches.length - 1].created_at,
            }
          : null,
    };
  });

  const isRelay = (u: NewUser) => u.email.toLowerCase().endsWith(APPLE_RELAY_DOMAIN);

  console.log(
    JSON.stringify(
      {
        since: cutoff.toISOString(),
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
