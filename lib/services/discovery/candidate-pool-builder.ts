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
import { parseSkillLevel, type SkillLevel } from '@/lib/domains/user-preferences';

const log = createContextLogger('CandidatePoolBuilder');

/**
 * Options for building the candidate pool
 */
export interface CandidatePoolOptions {
  /** User's current GPS location for nearby beach discovery (required) */
  userLocation: { lat: number; lon: number };
  /** Radius in miles for nearby beach search (default: 25, max: 100) */
  radiusMiles?: number;
}

/**
 * Result of building the candidate pool
 */
export interface CandidatePoolResult {
  /** Array of candidate beaches */
  candidates: Beach[];
  /** User's preferred wave size from their profile */
  preferredWaveSize: string | null;
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

/**
 * Builds the candidate pool of beaches for surf discovery.
 *
 * Uses pure GPS-based ordering - beaches are returned sorted by distance
 * from the user's current location. No special treatment for home beach
 * or favorites; they appear naturally if within the search radius.
 *
 * @param userId - The user's ID (used to fetch wave size preference)
 * @param options - Configuration options for pool building
 * @returns Promise with candidates array and preferred wave size
 */
export async function buildCandidatePool(
  userId: string,
  options: CandidatePoolOptions
): Promise<CandidatePoolResult> {
  const supabase = createSupabaseServiceRoleClient();
  const candidates: Beach[] = [];
  let preferredWaveSize: string | null = null;
  let userSkillLevel: SkillLevel | null = null;

  // Compute proximity radius
  const radiusMiles = Number.isFinite(options.radiusMiles) ? (options.radiusMiles as number) : 25;
  const cappedRadius = Math.min(Math.max(radiusMiles, 0), 100);

  try {
    // Fetch user's preferred wave size and experience level (used for scoring)
    const { data: profile } = await supabase
      .from('profiles')
      .select('preferred_wave_size, experience_level')
      .eq('id', userId)
      .single();

    const profileData = profile as unknown as {
      preferred_wave_size?: string | null;
      experience_level?: string | null;
    };
    preferredWaveSize = profileData?.preferred_wave_size ?? null;
    // Parse and validate skill level - returns null for invalid values
    userSkillLevel = parseSkillLevel(profileData?.experience_level);

    // Fetch nearby beaches via PostGIS RPC (ordered by distance)
    const max_distance_meters = Math.round(cappedRadius * 1609.34);
    const limit_count = 40;

    const { data: nearbyRaw, error: nearbyError } = await supabase.rpc(
      'get_nearby_beaches',
      {
        input_lat: options.userLocation.lat,
        input_lng: options.userLocation.lon,
        max_distance_meters,
        limit_count,
      }
    );

    if (nearbyError) {
      log.warn('[buildCandidatePool] Nearby RPC failed:', nearbyError);
      return { candidates: [], preferredWaveSize, userSkillLevel };
    }

    const nearby = (nearbyRaw || []) as NearbyBeachRow[];
    const orderedIds = nearby
      .filter((r) => !r.is_private)
      .map((r) => r.id);

    if (orderedIds.length === 0) {
      log.info('[buildCandidatePool] No nearby beaches found within radius');
      return { candidates: [], preferredWaveSize, userSkillLevel };
    }

    // Fetch full beach details
    const { data: beachRows, error: beachError } = await supabase
      .from('beaches')
      .select('*')
      .in('id', orderedIds)
      .eq('is_private', false)
      .limit(limit_count);

    if (beachError) {
      log.warn('[buildCandidatePool] Beach fetch failed:', beachError);
      return { candidates: [], preferredWaveSize, userSkillLevel };
    }

    if (beachRows && beachRows.length > 0) {
      // Maintain distance-based ordering from RPC
      const byId = new Map<string, Beach>(
        (beachRows as unknown as Beach[]).map((b) => [b.id, b])
      );
      const orderedBeaches = orderedIds
        .map((id) => byId.get(id))
        .filter((b): b is Beach => !!b);

      candidates.push(...orderedBeaches);
      log.info(`[buildCandidatePool] Found ${candidates.length} nearby beaches (GPS, sorted by distance)`);
    }

    return { candidates, preferredWaveSize, userSkillLevel };
  } catch (error) {
    log.error('Error building candidate pool:', error);
    return { candidates: [], preferredWaveSize: null, userSkillLevel: null };
  }
}
