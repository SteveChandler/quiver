/**
 * Candidate Pool Builder for Surf Discovery
 *
 * Builds the pool of beaches that discovery will fetch forecasts for and rank.
 *
 * Two different limits are at play and must not be conflated:
 *  - `CANDIDATE_POOL_LIMIT` — how many beaches are *considered* (fetched and
 *    scored). Widening it costs forecast work but improves the answer.
 *  - `maxResults` (orchestrator/route) — how many are *shown*. Narrowing it
 *    costs nothing and is purely a UI decision.
 *
 * Ordering: beaches come back from PostGIS in pure distance order, then get
 * re-ordered by *effective* distance — real miles minus the detour the user's
 * stored preferences have earned that spot (see `candidate-pool-fit`). Distance
 * still dominates; preference only reshuffles spots that are comparably close.
 * The user's home beach and saved spots are pinned ahead of everything else so
 * the pool cap can never evict them.
 *
 * A user with no stored preferences scores a uniform fit across the pool, which
 * is order-preserving — that case still behaves as pure proximity ordering.
 *
 * @module lib/services/discovery/candidate-pool-builder
 */

import { createSupabaseServiceRoleClient } from '@/lib/supabase/server';
import { createContextLogger } from '@/lib/logger';
import type { Beach } from '@/types/database';
import { rankBeaches } from '@/lib/recommendations/selection';
import { parseSkillLevel, type SkillLevel } from '@/lib/domains/user-preferences';
import {
  effectiveDistanceMiles,
  preferenceFit,
  type PoolPreferenceProfile,
} from './candidate-pool-fit';

const log = createContextLogger('CandidatePoolBuilder');

export const CANDIDATE_POOL_RADIUS_TIERS_MILES = [25, 60, 100] as const;
export const CANDIDATE_POOL_LIMIT = 60;
export const MIN_CANDIDATES = 8;
export const MAX_CANDIDATE_RADIUS_MILES = 100;

const MILES_TO_METERS = 1609.34;
const WATER_QUALITY_HOLD_OVERFETCH = 5;

/**
 * Options for building the candidate pool
 */
export interface CandidatePoolOptions {
  /** User's current GPS location for nearby beach discovery (required) */
  userLocation: { lat: number; lon: number };
  /** Optional hard outer radius in miles for nearby beach search (max: 100) */
  radiusMiles?: number;
}

/**
 * Result of building the candidate pool
 */
export interface CandidatePoolResult {
  /** Candidate beaches, ordered best-first for pool truncation */
  candidates: Beach[];
  /** User's experience level from their profile (parsed and validated) */
  userSkillLevel: SkillLevel | null;
}

/**
 * Row type returned by the get_nearby_beaches PostGIS RPC function
 */
interface NearbyBeachRow {
  id: string;
  is_private: boolean | null;
  distance_meters: number | null;
}

/** A beach plus the GPS distance PostGIS already computed for it. */
interface PoolCandidate {
  beach: Beach;
  distanceMiles: number;
}

/** Everything about the user that pool ordering depends on. */
interface PoolUserContext extends PoolPreferenceProfile {
  /** Home beach + saved spots. Never evicted by the pool cap. */
  pinnedBeachIds: Set<string>;
}

const NEUTRAL_USER_CONTEXT: PoolUserContext = {
  skillLevel: null,
  surfStyles: [],
  pinnedBeachIds: new Set(),
};

function getCappedOuterRadius(radiusMiles?: number): number {
  if (!Number.isFinite(radiusMiles)) {
    return MAX_CANDIDATE_RADIUS_MILES;
  }

  return Math.min(
    Math.max(radiusMiles as number, 0),
    MAX_CANDIDATE_RADIUS_MILES
  );
}

function getRadiusTiers(outerRadiusMiles: number): number[] {
  const tiers: number[] = CANDIDATE_POOL_RADIUS_TIERS_MILES.filter(
    (tier) => tier <= outerRadiusMiles
  );

  if (!tiers.includes(outerRadiusMiles)) {
    tiers.push(outerRadiusMiles);
  }

  return Array.from(new Set(tiers)).sort((a, b) => a - b);
}

/**
 * One profile read plus one favourites read, in parallel. Both are optional
 * signals, so any failure degrades to the neutral context rather than failing
 * discovery — a user with a flaky profile row still gets proximity ordering.
 */
async function fetchPoolUserContext(
  supabase: ReturnType<typeof createSupabaseServiceRoleClient>,
  userId: string
): Promise<PoolUserContext> {
  if (!userId) return NEUTRAL_USER_CONTEXT;

  const [profileResult, favoritesResult] = await Promise.all([
    supabase
      .from('profiles')
      .select('experience_level, surf_styles, home_beach_id')
      .eq('id', userId)
      .maybeSingle(),
    supabase.from('favorite_beaches').select('beach_id').eq('user_id', userId),
  ]);

  if (profileResult.error) {
    log.warn('[buildCandidatePool] Profile fetch failed:', profileResult.error);
  }
  if (favoritesResult.error) {
    log.warn('[buildCandidatePool] Favorites fetch failed:', favoritesResult.error);
  }

  const profile = profileResult.data as
    | { experience_level?: string | null; surf_styles?: string[] | null; home_beach_id?: string | null }
    | null
    | undefined;

  const pinnedBeachIds = new Set<string>();
  if (profile?.home_beach_id) pinnedBeachIds.add(profile.home_beach_id);
  for (const row of (favoritesResult.data ?? []) as Array<{ beach_id?: string | null }>) {
    if (row?.beach_id) pinnedBeachIds.add(row.beach_id);
  }

  return {
    skillLevel: parseSkillLevel(profile?.experience_level),
    surfStyles: Array.isArray(profile?.surf_styles) ? profile.surf_styles : [],
    pinnedBeachIds,
  };
}

async function fetchCandidatesForRadius(args: {
  supabase: ReturnType<typeof createSupabaseServiceRoleClient>;
  userLocation: CandidatePoolOptions['userLocation'];
  radiusMiles: number;
}): Promise<PoolCandidate[] | null> {
  const max_distance_meters = Math.round(args.radiusMiles * MILES_TO_METERS);
  const limit_count = CANDIDATE_POOL_LIMIT + WATER_QUALITY_HOLD_OVERFETCH;

  const { data: nearbyRaw, error: nearbyError } = await args.supabase.rpc(
    'get_nearby_beaches',
    {
      input_lat: args.userLocation.lat,
      input_lng: args.userLocation.lon,
      max_distance_meters,
      limit_count,
    }
  );

  if (nearbyError) {
    log.warn('[buildCandidatePool] Nearby RPC failed:', nearbyError);
    return null;
  }

  const nearby = (nearbyRaw || []) as NearbyBeachRow[];
  const publicRows = nearby
    .filter((r) => !r.is_private)
    .slice(0, limit_count);
  const orderedIds = publicRows.map((r) => r.id);

  if (orderedIds.length === 0) {
    return [];
  }

  const { data: beachRows, error: beachError } = await args.supabase
    .from('beaches')
    .select('*')
    .in('id', orderedIds)
    .eq('is_private', false)
    .limit(limit_count);

  if (beachError) {
    log.warn('[buildCandidatePool] Beach fetch failed:', beachError);
    return null;
  }

  const byId = new Map<string, Beach>(
    ((beachRows ?? []) as unknown as Array<
      Beach & { recommendation_eligible?: boolean }
    >)
      .filter((beach) => beach.recommendation_eligible !== false)
      .map((beach) => [beach.id, beach])
  );

  return publicRows
    .map((row) => {
      const beach = byId.get(row.id);
      if (!beach) return null;
      return {
        beach,
        distanceMiles: (row.distance_meters ?? 0) / MILES_TO_METERS,
      };
    })
    .filter((candidate): candidate is PoolCandidate => candidate !== null);
}

/**
 * Pinned spots first (nearest first among themselves), then everything else by
 * effective distance. Sorting — rather than filtering — means the cap upstream
 * simply takes a prefix and pinned spots survive it by construction.
 */
async function orderPoolCandidates(
  candidates: PoolCandidate[],
  userContext: PoolUserContext
): Promise<Beach[]> {
  const ordered = candidates
    .map((candidate) => ({
      id: candidate.beach.id,
      beach: candidate.beach,
      isPinned: userContext.pinnedBeachIds.has(candidate.beach.id),
      distanceMiles: candidate.distanceMiles,
      rankDistanceMiles: effectiveDistanceMiles(
        candidate.distanceMiles,
        preferenceFit(candidate.beach, userContext)
      ),
    }));
  const ranked = await rankBeaches(ordered, {
    compare: (a, b) => {
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
      if (a.isPinned) return a.distanceMiles - b.distanceMiles;

      const rankDelta = a.rankDistanceMiles - b.rankDistanceMiles;
      if (rankDelta !== 0) return rankDelta;
      // Stable, deterministic fallback so equal-fit spots don't shuffle
      // between requests.
      return a.distanceMiles - b.distanceMiles;
    },
  });
  return ranked.map((entry) => entry.beach);
}

/**
 * Builds the candidate pool of beaches for surf discovery.
 *
 * @param userId - The user's ID (used to fetch experience level and preferences)
 * @param options - Configuration options for pool building
 * @returns Promise with ordered candidates and the user's skill level
 */
export async function buildCandidatePool(
  userId: string,
  options: CandidatePoolOptions
): Promise<CandidatePoolResult> {
  const supabase = createSupabaseServiceRoleClient();
  const candidates: PoolCandidate[] = [];

  const outerRadiusMiles = getCappedOuterRadius(options.radiusMiles);
  const radiusTiers = getRadiusTiers(outerRadiusMiles);

  try {
    // Kicked off without awaiting so the profile/favourites reads overlap the
    // PostGIS tier queries instead of adding a serial round trip.
    const userContextPromise = fetchPoolUserContext(supabase, userId).catch(
      (error) => {
        log.warn('[buildCandidatePool] User context lookup failed:', error);
        return NEUTRAL_USER_CONTEXT;
      }
    );

    const seen = new Set<string>();
    for (const radiusMiles of radiusTiers) {
      const tierCandidates = await fetchCandidatesForRadius({
        supabase,
        userLocation: options.userLocation,
        radiusMiles,
      });

      if (tierCandidates === null) {
        return { candidates: [], userSkillLevel: (await userContextPromise).skillLevel };
      }

      // Merge each widening tier into the pool (a wider tier is a superset in
      // radius but the RPC row-cap + private filter can make its usable set
      // smaller, so replacing would shrink the pool). Dedupe by id.
      for (const candidate of tierCandidates) {
        if (!seen.has(candidate.beach.id)) {
          seen.add(candidate.beach.id);
          candidates.push(candidate);
        }
      }
      log.info(`[buildCandidatePool] Tier ${radiusMiles}mi: ${candidates.length} candidates`);

      if (candidates.length >= MIN_CANDIDATES) {
        break;
      }
    }

    const userContext = await userContextPromise;

    if (candidates.length === 0) {
      log.info('[buildCandidatePool] No nearby beaches found within radius');
    }

    return {
      candidates: (await orderPoolCandidates(candidates, userContext)).slice(
        0,
        CANDIDATE_POOL_LIMIT,
      ),
      userSkillLevel: userContext.skillLevel,
    };
  } catch (error) {
    log.error('Error building candidate pool:', error);
    return { candidates: [], userSkillLevel: null };
  }
}
