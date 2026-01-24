/**
 * Candidate Pool Builder for Surf Discovery
 *
 * Builds the initial pool of candidate beaches for surf discovery by gathering:
 * 1. User's home beach from their profile
 * 2. User's favorite beaches
 * 3. Nearby beaches via GPS/PostGIS RPC (optional)
 *
 * This module is extracted from surf-discovery-service for better testability
 * and separation of concerns.
 *
 * @module lib/services/discovery/candidate-pool-builder
 */

import { createSupabaseServiceRoleClient } from '@/lib/supabase/server';
import { createContextLogger } from '@/lib/logger';
import { calculateDistance } from '@/lib/utils/distance-utils';
import type { Beach } from '@/types/database';

const log = createContextLogger('CandidatePoolBuilder');

/**
 * Checks if a beach is within the given radius from a user location.
 * Returns false if the beach has no coordinates.
 */
function isWithinRadius(
  beach: Beach,
  userLocation: { lat: number; lon: number },
  radiusMiles: number
): boolean {
  if (beach.lat == null || beach.lon == null) return false;
  const distance = calculateDistance(userLocation, { lat: beach.lat, lon: beach.lon }, 'miles');
  return Number.isFinite(distance) && distance <= radiusMiles;
}

/**
 * Options for building the candidate pool
 */
export interface CandidatePoolOptions {
  /** Include user's home beach in the pool (default: true) */
  includeHome?: boolean;
  /** User's current GPS location for nearby beach discovery */
  userLocation?: { lat: number; lon: number };
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
 * Phase 1: Home + favorites only
 * Phase 2: Add GPS nearby beaches within radius
 *
 * @param userId - The user's ID
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

  // Compute proximity radius once upfront (used for home/favorites filtering)
  const radiusMiles = Number.isFinite(options.radiusMiles) ? (options.radiusMiles as number) : 25;
  const cappedRadius = Math.min(Math.max(radiusMiles, 0), 100);

  try {
    if (options.includeHome !== false) {
      // Query 1: Get user profile with home beach
      const { data: profile } = await supabase
        .from('profiles')
        .select(
          `
          id,
          home_beach_id,
          preferred_wave_size,
          home_beach:beaches!profiles_home_beach_id_fkey (*)
        `
        )
        .eq('id', userId)
        .single();

      if (profile?.home_beach) {
        const homeBeach = profile.home_beach as unknown as Beach;
        if (!options.userLocation || isWithinRadius(homeBeach, options.userLocation, cappedRadius)) {
          candidates.push(homeBeach);
          log.debug(`Added home beach: ${homeBeach.name}`);
        } else {
          log.debug(`Skipped home beach (out of radius): ${homeBeach.name}`);
        }
      }

      preferredWaveSize =
        (profile as unknown as { preferred_wave_size?: string | null })
          ?.preferred_wave_size ?? null;

      // Query 2: Get favorites (excluding home to avoid duplicates)
      const { data: favorites } = await supabase
        .from('favorite_beaches')
        .select(
          `
          beach_id,
          rank,
          beach:beaches (*)
        `
        )
        .eq('user_id', userId)
        .order('rank', { ascending: true });

      if (favorites) {
        let addedCount = 0;
        for (const fav of favorites) {
          const beach = fav.beach as unknown as Beach;
          // Avoid duplicates with home beach
          if (!candidates.find((c) => c.id === beach.id)) {
            if (!options.userLocation || isWithinRadius(beach, options.userLocation, cappedRadius)) {
              candidates.push(beach);
              addedCount++;
            }
          }
        }
        log.debug(`Added ${addedCount}/${favorites.length} favorite beaches (proximity-filtered)`);
      }
    }

    // GPS Phase: Add nearby beaches via PostGIS RPC (explicit location only).
    if (options.userLocation) {
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
      } else {
        const nearby = (nearbyRaw || []) as NearbyBeachRow[];
        const existingIds = new Set(candidates.map((b) => b.id));
        const orderedIds = nearby
          .filter((r) => !r.is_private)
          .map((r) => r.id)
          .filter((id) => !existingIds.has(id));

        if (orderedIds.length > 0) {
          const { data: beachRows, error: beachError } = await supabase
            .from('beaches')
            .select('*')
            .in('id', orderedIds)
            .eq('is_private', false)
            .limit(limit_count);

          if (beachError) {
            log.warn('[buildCandidatePool] Nearby beach fetch failed:', beachError);
          } else if (beachRows && beachRows.length > 0) {
            const byId = new Map<string, Beach>(
              (beachRows as unknown as Beach[]).map((b) => [b.id, b])
            );
            const orderedBeaches = orderedIds
              .map((id) => byId.get(id))
              .filter((b): b is Beach => !!b);

            for (const beach of orderedBeaches) {
              if (!existingIds.has(beach.id)) {
                candidates.push(beach);
                existingIds.add(beach.id);
              }
            }
            log.debug(`Added ${orderedBeaches.length} nearby beaches (GPS)`);
          }
        }
      }
    }

    return { candidates, preferredWaveSize };
  } catch (error) {
    log.error('Error building candidate pool:', error);
    return { candidates: [], preferredWaveSize: null };
  }
}
