import "server-only";

import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { calculateDistanceInMiles } from "@/lib/utils/distance-utils";
import type { Beach } from "@/types/database";

const METERS_PER_MILE = 1609.344;
const MAX_RADIUS_MILES = 100;
const PAGE_SIZE = 500;
const BEACH_BATCH_SIZE = 100;

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
  offsetCount: number;
  limitCount: number;
  requirePagedCoverage: boolean;
}

export interface WeekendScoutCandidate {
  beach: Beach;
  distanceMiles: number;
}

export interface WeekendScoutCandidatePool {
  candidates: WeekendScoutCandidate[];
  totalCount: number;
  /** Exact in-radius rows read before beach hydration and user-scope filters. */
  enumeratedCount?: number;
  hydratedCount?: number;
  filteredOutCount?: number;
  incomplete: boolean;
  /** @deprecated Use incomplete. */
  wasTruncated: boolean;
}

export interface WeekendScoutCandidatePoolDependencies {
  fetchNearbyRows: (args: NearbyRowsArgs) => Promise<NearbyCandidateRow[]>;
  fetchBeaches: (ids: string[]) => Promise<Beach[]>;
}

interface BuildWeekendScoutCandidatePoolOptions {
  userLocation: { lat: number; lon: number };
  radiusMiles: number;
  /** The new interactive route opts in after its paging migration is deployed. */
  requirePagedCoverage?: boolean;
  filters?: readonly ('longboard' | 'beginner' | 'quiet' | 'beach' | 'reef' | 'nearby')[];
  mapBounds?: { minLat: number; maxLat: number; minLon: number; maxLon: number } | null;
  nearbyLocation?: { lat: number; lon: number } | null;
}

function hasLongboardSignal(value: unknown, depth = 0): boolean {
  if (typeof value === 'string') {
    const normalized = value.toLowerCase().replace(/[_-]+/g, ' ');
    return normalized.includes('longboard') || normalized.includes('long board') || normalized.includes('noseride') || normalized.includes('nose ride') || /\blog\b/.test(normalized);
  }
  if (depth >= 3 || value === null || typeof value !== 'object') return false;
  return Object.entries(value as Record<string, unknown>).some(([key, nested]) => (
    hasLongboardSignal(key, depth + 1) || hasLongboardSignal(nested, depth + 1)
  ));
}

function matchesScope(candidate: WeekendScoutCandidate, options: BuildWeekendScoutCandidatePoolOptions): boolean {
  const filters = options.filters ?? [];
  const beach = candidate.beach as Beach & { skill_level?: string | null; break_type?: string | null; features?: unknown; preference_model?: unknown; crowd_level?: string | null };
  const bounds = options.mapBounds;
  if (bounds && (beach.lat < bounds.minLat || beach.lat > bounds.maxLat || beach.lon < bounds.minLon || beach.lon > bounds.maxLon)) return false;
  if (filters.includes('nearby') && (!options.nearbyLocation || calculateDistanceInMiles(options.nearbyLocation, { lat: beach.lat, lon: beach.lon }) > 10)) return false;
  if (filters.includes('beginner') && beach.skill_level !== 'beginner' && beach.skill_level !== 'beginner-intermediate') return false;
  if (filters.includes('longboard') && !(
    hasLongboardSignal(beach.features)
    || hasLongboardSignal(beach.break_type)
    || hasLongboardSignal(beach.preference_model)
    || ((beach.skill_level === 'beginner' || beach.skill_level === 'beginner-intermediate') && beach.break_type !== 'reef')
  )) return false;
  const breakType = String(beach.break_type ?? '').toLowerCase().replace(/[_-]+/g, ' ');
  if (filters.includes('beach') && !breakType.includes('beach')) return false;
  if (filters.includes('reef') && !breakType.includes('reef')) return false;
  return true;
}

function crowdRank(value: string | null | undefined): number {
  const normalized = String(value ?? '').toLowerCase().replace(/[_-]+/g, ' ');
  if (normalized === 'low' || normalized === 'light') return 0;
  if (normalized === 'medium' || normalized === 'moderate') return 1;
  if (normalized === 'high' || normalized === 'heavy' || normalized === 'crowded' || normalized === 'very high') return 2;
  return 3;
}

function defaultDependencies(): WeekendScoutCandidatePoolDependencies {
  const supabase = createSupabaseServiceRoleClient();

  return {
    fetchNearbyRows: async (args) => {
      const rpcName = args.requirePagedCoverage
        ? "get_weekend_scout_candidates_page"
        : "get_weekend_scout_candidates";
      const rpcArgs = args.requirePagedCoverage
        ? {
            input_user_id: args.userId,
            input_lat: args.lat,
            input_lon: args.lon,
            max_distance_meters: args.maxDistanceMeters,
            offset_count: args.offsetCount,
            limit_count: args.limitCount,
          }
        : {
            input_user_id: args.userId,
            input_lat: args.lat,
            input_lon: args.lon,
            max_distance_meters: args.maxDistanceMeters,
            limit_count: args.limitCount,
          };
      const { data, error } = await (supabase as any).rpc(rpcName, rpcArgs);
      if (error) {
        throw new Error(`Failed to load Weekend Scout candidates: ${error.message}`);
      }
      return (data ?? []) as NearbyCandidateRow[];
    },
    fetchBeaches: async (ids) => {
      const rows: Beach[] = [];
      for (let offset = 0; offset < ids.length; offset += BEACH_BATCH_SIZE) {
        const batch = ids.slice(offset, offset + BEACH_BATCH_SIZE);
      const { data, error } = await supabase
        .from("beaches")
        .select("*")
          .in("id", batch)
        .is("deleted_at", null);
      if (error) {
        throw new Error(`Failed to load Weekend Scout beaches: ${error.message}`);
      }
        rows.push(...(data ?? []) as Beach[]);
      }
      return rows;
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
  const requirePagedCoverage = options.requirePagedCoverage === true;
  const rows: NearbyCandidateRow[] = [];
  let totalCount: number | null = null;
  let incomplete = false;
  for (let offset = 0; ; offset += PAGE_SIZE) {
    let page: NearbyCandidateRow[];
    try {
      page = await deps.fetchNearbyRows({
        userId,
        lat: options.userLocation.lat,
        lon: options.userLocation.lon,
        // The database radius is only a prefilter. Ceil keeps the inclusive
        // mile boundary eligible; the exact check below rejects overshoot.
        maxDistanceMeters: Math.ceil(radiusMiles * METERS_PER_MILE),
        offsetCount: offset,
        limitCount: requirePagedCoverage ? PAGE_SIZE : 1000,
        requirePagedCoverage,
      });
    } catch (error) {
      if (rows.length === 0) throw error;
      incomplete = true;
      break;
    }
    if (page.length === 0) {
      const uniqueCount = new Set(rows.map((row) => row.id)).size;
      // The first page has no row from which the RPC can expose total_count;
      // an empty initial result is the valid zero-candidate case. A later
      // empty page is only complete once the previously reported inventory is
      // fully accounted for.
      incomplete ||= rows.length > 0 && (totalCount === null || uniqueCount < totalCount);
      break;
    }
    const pageTotalCount = page[0]?.total_count;
    const parsedTotalCount = Number(pageTotalCount);
    if (!Number.isSafeInteger(parsedTotalCount) || parsedTotalCount < 0) {
      incomplete = true;
      break;
    }
    if (page.some((row) => (
      !row.id
      || !Number.isFinite(row.distance_meters)
      || row.distance_meters < 0
      || Number(row.total_count) !== parsedTotalCount
    ))) {
      incomplete = true;
      break;
    }
    if (totalCount !== null && totalCount !== parsedTotalCount) {
      incomplete = true;
      break;
    }
    totalCount = parsedTotalCount;
    const uniqueBeforePage = new Set(rows.map((row) => row.id)).size;
    rows.push(...page);
    const uniqueCount = new Set(rows.map((row) => row.id)).size;
    if (page.length < PAGE_SIZE) {
      incomplete ||= uniqueCount !== totalCount;
      break;
    }
    if (uniqueCount > totalCount || (page.length === PAGE_SIZE && uniqueCount === uniqueBeforePage)) {
      incomplete = true;
      break;
    }
    if (uniqueCount === totalCount) break;
    if (!requirePagedCoverage) {
      incomplete = true;
      break;
    }
  }

  if (rows.length === 0) {
    return { candidates: [], totalCount: totalCount ?? 0, enumeratedCount: 0, hydratedCount: 0, filteredOutCount: 0, incomplete, wasTruncated: incomplete };
  }

  const uniqueRows = Array.from(new Map(rows.map((row) => [row.id, row])).values());
  const exactRows = uniqueRows.filter((row) => (
    Number.isFinite(row.distance_meters)
    && row.distance_meters >= 0
    && row.distance_meters / METERS_PER_MILE <= radiusMiles
  ));
  let beaches: Beach[];
  try {
    beaches = await deps.fetchBeaches(exactRows.map((row) => row.id));
  } catch (error) {
    if (uniqueRows.length === 0) throw error;
    incomplete = true;
    beaches = [];
  }
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
  const hydratedCandidates = exactRows.flatMap((row): WeekendScoutCandidate[] => {
    const candidate = beachesById.get(row.id);
    if (!candidate || !Number.isFinite(row.distance_meters) || row.distance_meters < 0) {
      return [];
    }
    return [{ beach: candidate, distanceMiles: row.distance_meters / METERS_PER_MILE }];
  });
  const candidates = hydratedCandidates.filter((candidate) => matchesScope(candidate, options));
  if ((options.filters ?? []).includes('quiet')) {
    candidates.sort((left, right) => (
      crowdRank((left.beach as Beach & { crowd_level?: string | null }).crowd_level)
      - crowdRank((right.beach as Beach & { crowd_level?: string | null }).crowd_level)
      || left.distanceMiles - right.distanceMiles
      || left.beach.id.localeCompare(right.beach.id)
    ));
  }
  incomplete ||= hydratedCandidates.length !== exactRows.length;

  return {
    candidates,
    totalCount: totalCount ?? 0,
    enumeratedCount: exactRows.length,
    hydratedCount: hydratedCandidates.length,
    filteredOutCount: hydratedCandidates.length - candidates.length,
    incomplete,
    wasTruncated: incomplete,
  };
}
