/**
 * Candidate Pool Builder for Surf Discovery
 *
 * Builds the initial pool of candidate beaches for surf discovery using pure
 * GPS-based distance ordering. No special treatment for home beach or favorites -
 * they appear naturally if within the search radius.
 *
 * This ensures recommendations are always based on proximity to the user's
 * current location, making the app useful when traveling or exploring new areas.
 *
 * @module lib/services/discovery/candidate-pool-builder
 */

import { createSupabaseServiceRoleClient } from '@/lib/supabase/server';
import { createContextLogger } from '@/lib/logger';
import type { Beach } from '@/types/database';
import type { SkillLevel } from '@/lib/domains/user-preferences';
import { getProfileExperienceLevel } from '@/lib/profile/skill-level';

const log = createContextLogger('CandidatePoolBuilder');

export const CANDIDATE_POOL_RADIUS_TIERS_MILES = [25, 60, 100] as const;
export const CANDIDATE_POOL_LIMIT = 100;
export const MAX_CANDIDATE_RADIUS_MILES = 100;

const MILES_TO_METERS = 1609.34;

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
  /** Array of candidate beaches */
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

async function fetchCandidatesForRadius(args: {
  supabase: ReturnType<typeof createSupabaseServiceRoleClient>;
  userLocation: CandidatePoolOptions['userLocation'];
  radiusMiles: number;
}): Promise<Beach[] | null> {
  const max_distance_meters = Math.round(args.radiusMiles * MILES_TO_METERS);
  const limit_count = CANDIDATE_POOL_LIMIT;

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
  const orderedIds = nearby
    .filter((r) => !r.is_private)
    .map((r) => r.id)
    .slice(0, CANDIDATE_POOL_LIMIT);

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
    ((beachRows ?? []) as unknown as Beach[]).map((beach) => [beach.id, beach])
  );

  return orderedIds
    .map((id) => byId.get(id))
    .filter((beach): beach is Beach => Boolean(beach));
}

/**
 * Builds the candidate pool of beaches for surf discovery.
 *
 * Uses pure GPS-based ordering - beaches are returned sorted by distance
 * from the user's current location. No special treatment for home beach
 * or favorites; they appear naturally if within the search radius.
 *
 * @param userId - The user's ID (used to fetch experience level)
 * @param options - Configuration options for pool building
 * @returns Promise with candidates array and user skill level
 */
export async function buildCandidatePool(
  userId: string,
  options: CandidatePoolOptions
): Promise<CandidatePoolResult> {
  const supabase = createSupabaseServiceRoleClient();
  const candidates: Beach[] = [];
  let userSkillLevel: SkillLevel | null = null;

  const outerRadiusMiles = getCappedOuterRadius(options.radiusMiles);
  const radiusTiers = getRadiusTiers(outerRadiusMiles);

  try {
    userSkillLevel = await getProfileExperienceLevel(supabase, userId);

    const seen = new Set<string>();
    for (const radiusMiles of radiusTiers) {
      const tierCandidates = await fetchCandidatesForRadius({
        supabase,
        userLocation: options.userLocation,
        radiusMiles,
      });

      if (tierCandidates === null) {
        return { candidates: [], userSkillLevel };
      }

      // Merge each widening tier into the pool (a wider tier is a superset in
      // radius but the RPC row-cap + private filter can make its usable set
      // smaller, so replacing would shrink the pool). Dedupe by id.
      for (const beach of tierCandidates) {
        if (!seen.has(beach.id)) {
          seen.add(beach.id);
          candidates.push(beach);
        }
      }
      log.info(`[buildCandidatePool] Tier ${radiusMiles}mi: ${candidates.length} candidates`);
    }

    if (candidates.length === 0) {
      log.info('[buildCandidatePool] No nearby beaches found within radius');
    }

    return { candidates, userSkillLevel };
  } catch (error) {
    log.error('Error building candidate pool:', error);
    return { candidates: [], userSkillLevel: null };
  }
}
