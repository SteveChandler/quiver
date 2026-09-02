import "server-only";

import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import type { Beach } from "@/types/database";

const METERS_PER_MILE = 1609.344;
const MAX_RADIUS_MILES = 100;
const CANDIDATE_LIMIT = 1000;

interface NearbyCandidateRow {
  id: string;
  distance_meters: number;
  total_count: number | string;
}

interface NearbyRowsArgs {
  userId: string;
  lat: number;
  lon: number;
  maxDistanceMeters: number;
  limitCount: number;
}

export interface WeekendScoutCandidate {
  beach: Beach;
  distanceMiles: number;
}

export interface WeekendScoutCandidatePool {
  candidates: WeekendScoutCandidate[];
  wasTruncated: boolean;
}

export interface WeekendScoutCandidatePoolDependencies {
  fetchNearbyRows: (args: NearbyRowsArgs) => Promise<NearbyCandidateRow[]>;
  fetchBeaches: (ids: string[]) => Promise<Beach[]>;
}

interface BuildWeekendScoutCandidatePoolOptions {
  userLocation: { lat: number; lon: number };
  radiusMiles: number;
}

function defaultDependencies(): WeekendScoutCandidatePoolDependencies {
  const supabase = createSupabaseServiceRoleClient();

  return {
    fetchNearbyRows: async (args) => {
      const { data, error } = await (supabase as any).rpc(
        "get_weekend_scout_candidates",
        {
          input_user_id: args.userId,
          input_lat: args.lat,
          input_lon: args.lon,
          max_distance_meters: args.maxDistanceMeters,
          limit_count: args.limitCount,
        }
      );
      if (error) {
        throw new Error(`Failed to load Weekend Scout candidates: ${error.message}`);
      }
      return (data ?? []) as NearbyCandidateRow[];
    },
    fetchBeaches: async (ids) => {
      const { data, error } = await supabase
        .from("beaches")
        .select("*")
        .in("id", ids)
        .is("deleted_at", null);
      if (error) {
        throw new Error(`Failed to load Weekend Scout beaches: ${error.message}`);
      }
      return (data ?? []) as Beach[];
    },
  };
}

function validateOptions(options: BuildWeekendScoutCandidatePoolOptions): void {
  const { lat, lon } = options.userLocation;
  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lon) ||
    lat < -90 ||
    lat > 90 ||
    lon < -180 ||
    lon > 180
  ) {
    throw new Error("Invalid Weekend Scout coordinates");
  }
  if (!Number.isFinite(options.radiusMiles) || options.radiusMiles <= 0) {
    throw new Error("Invalid Weekend Scout radius");
  }
}

export async function buildWeekendScoutCandidatePool(
  userId: string,
  options: BuildWeekendScoutCandidatePoolOptions,
  dependencies?: WeekendScoutCandidatePoolDependencies
): Promise<WeekendScoutCandidatePool> {
  validateOptions(options);
  const deps = dependencies ?? defaultDependencies();
  const radiusMiles = Math.min(options.radiusMiles, MAX_RADIUS_MILES);
  const rows = await deps.fetchNearbyRows({
    userId,
    lat: options.userLocation.lat,
    lon: options.userLocation.lon,
    maxDistanceMeters: Math.round(radiusMiles * METERS_PER_MILE),
    limitCount: CANDIDATE_LIMIT,
  });

  if (rows.length === 0) {
    return { candidates: [], wasTruncated: false };
  }

  const beaches = await deps.fetchBeaches(rows.map((row) => row.id));
  const safeBeaches = beaches.filter((candidate) => {
    const recommendationEligible = (
      candidate as Beach & { recommendation_eligible?: boolean }
    ).recommendation_eligible;
    return (
      candidate.is_private !== true &&
      candidate.deleted_at == null &&
      recommendationEligible !== false
    );
  });
  const beachesById = new Map(safeBeaches.map((candidate) => [candidate.id, candidate]));
  const candidates = rows.flatMap((row): WeekendScoutCandidate[] => {
    const candidate = beachesById.get(row.id);
    if (!candidate || !Number.isFinite(row.distance_meters) || row.distance_meters < 0) {
      return [];
    }
    return [{ beach: candidate, distanceMiles: row.distance_meters / METERS_PER_MILE }];
  });
  const totalCount = rows.reduce((maximum, row) => {
    const count = Number(row.total_count);
    return Number.isFinite(count) ? Math.max(maximum, count) : maximum;
  }, rows.length);

  return {
    candidates,
    wasTruncated: totalCount > rows.length || candidates.length !== rows.length,
  };
}
