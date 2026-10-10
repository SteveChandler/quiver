import { resolveLocationAnchor, type LocationAnchor, type LocationSnapshot } from "@/lib/alerts/location-freshness";
import type { SupabaseClient } from '@supabase/supabase-js';
import { after } from 'next/server';

import {
  SWELL_OUTLOOK_PULSE_DETECTOR_VERSION,
  loadRecentSwellSnapshots,
  loadSwellForecastRows,
} from '@/lib/alerts/swell-events';
import {
  EMPTY_SWELL_OUTLOOK_USER_STATE,
  loadSwellOutlookUserState,
  previousListFor,
  recordSwellOpen,
  saveSwellOutlookLists,
  type SwellOutlookUserState,
} from '@/lib/alerts/swell-outlook/state';
import { loadUserPool } from '@/lib/alerts/user-pool';
import { normalizeBoardClass, type BoardClass } from '@/lib/domains/rideability';
import { parseSkillLevel } from '@/lib/domains/user-preferences';
import type { Database } from '@/types/database';

import type { StoredOutlookList } from './swell-outlook-types';
import { getActiveStorms, type ActiveStorm } from './nhc-storms';
import { SWELL_OUTLOOK_HORIZON_DAYS, buildSwellOutlook, resolveOutlookRunDate, type SwellOutlookResponse } from './swell-outlook';

const DAY_MS = 24 * 60 * 60 * 1000;
const SNAPSHOT_HISTORY_DAYS = 10;
const STICKY_ROWS_BACK_MS = 6 * 60 * 60 * 1000;
const STICKY_ROWS_AHEAD_MS = 10 * DAY_MS;

type Client = SupabaseClient<Database>;

export interface SwellOutlookLoaderDeps {
  loadPool: typeof loadUserPool;
  loadSnapshots: typeof loadRecentSwellSnapshots;
  loadForecasts: typeof loadSwellForecastRows;
  getStorms: () => Promise<ActiveStorm[]>;
}

const DEFAULT_DEPS: SwellOutlookLoaderDeps = {
  loadPool: loadUserPool,
  loadSnapshots: loadRecentSwellSnapshots,
  loadForecasts: loadSwellForecastRows,
  getStorms: getActiveStorms,
};

interface OutlookProfile {
  homeBeachId: string | null;
  location: { lat: number; lon: number } | null;
  anchorSource: LocationAnchor["source"];
  maxDriveMinutes: number | null;
  experienceLevel: string | null;
}

interface ReadResult<T> {
  data: T | null;
  failed: boolean;
}

async function loadOutlookProfile(client: Client, userId: string, now: Date): Promise<ReadResult<OutlookProfile>> {
  try {
    const { data, error } = await client
      .from('profiles')
      .select('home_beach_id, max_drive_minutes, experience_level, user_location_snapshots(lat, lon, captured_at), home_beach:beaches!profiles_home_beach_id_fkey(lat, lon)')
      .eq('id', userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return { data: null, failed: false };
    const row = data as unknown as {
      home_beach_id: string | null;
      max_drive_minutes: number | null;
      experience_level: string | null;
      user_location_snapshots: LocationSnapshot | LocationSnapshot[] | null;
      home_beach: { lat: number | null; lon: number | null } | null;
    };
    const joined = Array.isArray(row.user_location_snapshots) ? row.user_location_snapshots[0] : row.user_location_snapshots;
    const { anchor, source } = resolveLocationAnchor(joined, now, row.home_beach);
    return {
      data: {
        homeBeachId: row.home_beach_id,
        location: anchor,
        anchorSource: source,
        maxDriveMinutes: row.max_drive_minutes,
        experienceLevel: row.experience_level,
      },
      failed: false,
    };
  } catch (error) {
    console.warn('[swell-outlook] profile read failed; fit unknown', error instanceof Error ? error.message : String(error));
    return { data: { homeBeachId: null, location: null, anchorSource: "none", maxDriveMinutes: null, experienceLevel: null }, failed: true };
  }
}

/** A board type that does not normalise is dropped: guessing a class would move the fit band. */
async function loadBoardClasses(client: Client, userId: string): Promise<BoardClass[] | null> {
  try {
    const { data, error } = await client.from('boards').select('board_type').eq('user_id', userId);
    if (error) throw new Error(error.message);
    if (!Array.isArray(data)) throw new Error('Board data unavailable');
    const classes = data
      .map((row) => normalizeBoardClass(row.board_type))
      .filter((boardClass): boardClass is BoardClass => boardClass !== null);
    return [...new Set(classes)];
  } catch (error) {
    console.warn('[swell-outlook] board read failed; fit unknown', error instanceof Error ? error.message : String(error));
    return null;
  }
}

async function safeState(client: Client, userId: string): Promise<ReadResult<SwellOutlookUserState>> {
  try {
    return { data: await loadSwellOutlookUserState(client, userId), failed: false };
  } catch (error) {
    console.warn('[swell-outlook] state read failed; sticky tracking skipped', error instanceof Error ? error.message : String(error));
    return { data: null, failed: true };
  }
}

function emptyResponse(now: Date, anchorSource: LocationAnchor["source"] = "none"): SwellOutlookResponse {
  return { anchorSource, generatedAt: now.toISOString(), runDate: now.toISOString().slice(0, 10), horizonDays: SWELL_OUTLOOK_HORIZON_DAYS, homeBeach: null, swells: [] };
}

export async function loadSwellOutlookForUser(args: {
  client: Client;
  userId: string;
  now: Date;
  recordOpen: boolean;
  onList?: (list: StoredOutlookList) => void;
  deps?: Partial<SwellOutlookLoaderDeps>;
}): Promise<SwellOutlookResponse> {
  const { client, userId, now } = args;
  const deps = { ...DEFAULT_DEPS, ...args.deps };

  const profileRead = await loadOutlookProfile(client, userId, now);
  const profile = profileRead.data;
  if (!profile) return emptyResponse(now);

  // A background sender must skip users whose engagement state is unavailable.
  const stateRead = args.recordOpen
    ? await safeState(client, userId)
    : { data: await loadSwellOutlookUserState(client, userId), failed: false };
  const state = stateRead.data;
  const pool = await deps.loadPool({
    supabase: client,
    userId,
    homeBeachId: profile.homeBeachId,
    location: profile.location,
    maxDriveMinutes: profile.maxDriveMinutes,
  });
  if (pool.length === 0 && !state && !profileRead.failed && !stateRead.failed) return emptyResponse(now, profile.anchorSource);

  const poolIds = pool.map(({ beach }) => beach.id);
  const since = new Date(now.getTime() - SNAPSHOT_HISTORY_DAYS * DAY_MS);
  const [pulseSnapshots, notableSnapshots, boardClasses, storms] = await Promise.all([
    poolIds.length > 0 ? deps.loadSnapshots(client, poolIds, since, SWELL_OUTLOOK_PULSE_DETECTOR_VERSION) : [],
    poolIds.length > 0 ? deps.loadSnapshots(client, poolIds, since) : [],
    loadBoardClasses(client, userId),
    deps.getStorms().catch((): ActiveStorm[] => []),
  ]);
  const degraded = profileRead.failed || stateRead.failed || boardClasses === null;

  const runDate = resolveOutlookRunDate(pulseSnapshots, now);
  const base = state ?? EMPTY_SWELL_OUTLOOK_USER_STATE;
  const previous = previousListFor(base, runDate);
  const stickyIds = [...new Set((previous?.swells ?? []).map(({ beach }) => beach.id))].filter((id) => poolIds.includes(id));
  const forecastsByBeach = stickyIds.length > 0
    ? await deps.loadForecasts(client, stickyIds, new Date(now.getTime() - STICKY_ROWS_BACK_MS), new Date(now.getTime() + STICKY_ROWS_AHEAD_MS))
    : new Map();

  const skillLevel = boardClasses === null ? null : parseSkillLevel(profile.experienceLevel);
  const { response, list } = buildSwellOutlook({
    pool,
    homeBeachId: profile.homeBeachId,
    pulseSnapshots,
    notableSnapshots,
    forecastsByBeach,
    previous,
    skillLevel,
    boardClasses: boardClasses ?? [],
    storms,
    now,
  });

  response.anchorSource = profile.anchorSource;

  if (skillLevel === null) {
    // Carried entries may retain fit from an earlier successful preference read.
    for (const swell of response.swells) swell.fit = { status: 'unknown', boards: [] };
  }

  async function persist(): Promise<void> {
    // Partial reads must not replace good sticky state used by later requests or senders.
    if (!degraded) {
      try {
        // Cron combines this list and its send transitions into one state write.
        if (args.onList) args.onList(list);
        else await saveSwellOutlookLists(client, userId, list);
      } catch (error) {
        console.warn('[swell-outlook] state write failed', error instanceof Error ? error.message : String(error));
      }
    }
    if (!args.recordOpen) return;
    try {
      await recordSwellOpen(client, userId, now);
    } catch (error) {
      console.warn('[swell-outlook] open write failed', error instanceof Error ? error.message : String(error));
    }
  }

  if (args.recordOpen) {
    // Request lifetime tracking keeps bookkeeping alive without delaying the response.
    try {
      after(persist);
    } catch (error) {
      console.warn('[swell-outlook] bookkeeping scheduling failed', error instanceof Error ? error.message : String(error));
    }
  } else {
    await persist();
  }
  return response;
}
