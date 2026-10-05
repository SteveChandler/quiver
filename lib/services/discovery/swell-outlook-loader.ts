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
  maxDriveMinutes: number | null;
  experienceLevel: string | null;
}

async function loadOutlookProfile(client: Client, userId: string): Promise<OutlookProfile | null> {
  const { data, error } = await client
    .from('profiles')
    .select('home_beach_id, max_drive_minutes, experience_level, user_location_snapshots(lat, lon)')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw new Error(`Failed to load swell outlook profile: ${error.message}`);
  if (!data) return null;
  const row = data as unknown as {
    home_beach_id: string | null;
    max_drive_minutes: number | null;
    experience_level: string | null;
    user_location_snapshots: { lat: number; lon: number } | Array<{ lat: number; lon: number }> | null;
  };
  const joined = Array.isArray(row.user_location_snapshots) ? row.user_location_snapshots[0] : row.user_location_snapshots;
  return {
    homeBeachId: row.home_beach_id,
    location: joined ? { lat: joined.lat, lon: joined.lon } : null,
    maxDriveMinutes: row.max_drive_minutes,
    experienceLevel: row.experience_level,
  };
}

/** A board type that does not normalise is dropped: guessing a class would move the fit band. */
async function loadBoardClasses(client: Client, userId: string): Promise<BoardClass[]> {
  const { data, error } = await client.from('boards').select('board_type').eq('user_id', userId);
  if (error || !Array.isArray(data)) return [];
  const classes = data
    .map((row) => normalizeBoardClass(row.board_type))
    .filter((boardClass): boardClass is BoardClass => boardClass !== null);
  return [...new Set(classes)];
}

async function safeState(client: Client, userId: string): Promise<SwellOutlookUserState | null> {
  try {
    return await loadSwellOutlookUserState(client, userId);
  } catch (error) {
    console.warn('[swell-outlook] state read failed; sticky tracking skipped', error instanceof Error ? error.message : String(error));
    return null;
  }
}

function emptyResponse(now: Date): SwellOutlookResponse {
  return { generatedAt: now.toISOString(), runDate: now.toISOString().slice(0, 10), horizonDays: SWELL_OUTLOOK_HORIZON_DAYS, homeBeach: null, swells: [] };
}

export async function loadSwellOutlookForUser(args: {
  client: Client;
  userId: string;
  now: Date;
  recordOpen: boolean;
  deps?: Partial<SwellOutlookLoaderDeps>;
}): Promise<SwellOutlookResponse> {
  const { client, userId, now } = args;
  const deps = { ...DEFAULT_DEPS, ...args.deps };

  const profile = await loadOutlookProfile(client, userId);
  if (!profile) return emptyResponse(now);

  // A background sender must skip users whose engagement state is unavailable.
  const state = args.recordOpen
    ? await safeState(client, userId)
    : await loadSwellOutlookUserState(client, userId);
  const pool = await deps.loadPool({
    supabase: client,
    userId,
    homeBeachId: profile.homeBeachId,
    location: profile.location,
    maxDriveMinutes: profile.maxDriveMinutes,
  });
  if (pool.length === 0 && !state) return emptyResponse(now);

  const poolIds = pool.map(({ beach }) => beach.id);
  const since = new Date(now.getTime() - SNAPSHOT_HISTORY_DAYS * DAY_MS);
  const [pulseSnapshots, notableSnapshots, boardClasses, storms] = await Promise.all([
    poolIds.length > 0 ? deps.loadSnapshots(client, poolIds, since, SWELL_OUTLOOK_PULSE_DETECTOR_VERSION) : [],
    poolIds.length > 0 ? deps.loadSnapshots(client, poolIds, since) : [],
    loadBoardClasses(client, userId),
    deps.getStorms().catch((): ActiveStorm[] => []),
  ]);

  const runDate = resolveOutlookRunDate(pulseSnapshots, now);
  const base = state ?? EMPTY_SWELL_OUTLOOK_USER_STATE;
  const previous = previousListFor(base, runDate);
  const stickyIds = [...new Set((previous?.swells ?? []).map(({ beach }) => beach.id))].filter((id) => poolIds.includes(id));
  const forecastsByBeach = stickyIds.length > 0
    ? await deps.loadForecasts(client, stickyIds, new Date(now.getTime() - STICKY_ROWS_BACK_MS), new Date(now.getTime() + STICKY_ROWS_AHEAD_MS))
    : new Map();

  const { response, list } = buildSwellOutlook({
    pool,
    homeBeachId: profile.homeBeachId,
    pulseSnapshots,
    notableSnapshots,
    forecastsByBeach,
    previous,
    skillLevel: parseSkillLevel(profile.experienceLevel),
    boardClasses,
    storms,
    now,
  });

  async function persist(): Promise<void> {
    try {
      await saveSwellOutlookLists(client, userId, list);
    } catch (error) {
      console.warn('[swell-outlook] state write failed', error instanceof Error ? error.message : String(error));
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
