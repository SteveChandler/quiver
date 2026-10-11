import type { SupabaseClient } from "@supabase/supabase-js";
import type { Beach, Database } from "@/types/database";
import { driveRadiusMiles } from "@/lib/profile/drive-range";
import { calculateDistanceInMiles } from "@/lib/utils/distance-utils";

export type PoolRelation = "home" | "favorite" | "custom" | "nearby";

export interface PoolBeach {
  beach: Beach;
  relation: PoolRelation;
  distanceMiles: number | null;
}

interface LoadUserPoolArgs {
  supabase: SupabaseClient<Database>;
  userId: string;
  homeBeachId: string | null;
  location: { lat: number; lon: number } | null;
  maxDriveMinutes: number | null;
}

interface FavoriteRow {
  beach_id: string | null;
  custom_spot_id: string | null;
}

interface NearbyRow {
  id: string;
  distance_meters: number;
}

interface CustomSpotRow {
  id: string;
  nearest_beach_id: string | null;
}

const METERS_PER_MILE = 1609.344;

/**
 * How many nearby beaches a ranking scores, nearest first; home, saved and
 * custom spots in range are always kept on top. Measured 2026-10-11 against
 * production data (Week Scout, LA, 100-mile range): 30 beaches 1.07 s, 50
 * 1.44 s, 60 1.77 s, 99 2.49 s. The Daily Call uses the same cap so it and
 * Home choose from the same beaches.
 */
export const NEARBY_POOL_CAP = 50;

export interface CappedPool {
  pool: PoolBeach[];
  /** Nearby beaches in range left out past the cap. */
  cappedCount: number;
  /** Distance to the farthest nearby beach kept; null when nothing was capped. */
  farthestNearbyMiles: number | null;
}

export function capNearbyPool(pool: PoolBeach[], cap: number = NEARBY_POOL_CAP): CappedPool {
  const nearby = pool
    .filter(({ relation }) => relation === "nearby")
    .sort((left, right) => (left.distanceMiles ?? 0) - (right.distanceMiles ?? 0));
  if (nearby.length <= cap) return { pool, cappedCount: 0, farthestNearbyMiles: null };
  const kept = new Set(nearby.slice(0, cap));
  return {
    pool: pool.filter((entry) => entry.relation !== "nearby" || kept.has(entry)),
    cappedCount: nearby.length - cap,
    farthestNearbyMiles: nearby[cap - 1]?.distanceMiles ?? null,
  };
}
const FORECAST_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export async function loadUserPool({
  supabase,
  userId,
  homeBeachId,
  location,
  maxDriveMinutes,
}: LoadUserPoolArgs): Promise<PoolBeach[]> {
  const radiusMiles = driveRadiusMiles(maxDriveMinutes);
  const favoritesRequest = supabase
    .from("favorite_beaches")
    .select("beach_id, custom_spot_id")
    .eq("user_id", userId)
    .order("rank", { ascending: true, nullsFirst: false });
  const nearbyRequest =
    location && radiusMiles > 0
      ? supabase.rpc("get_weekend_scout_candidates", {
          input_user_id: userId,
          input_lat: location.lat,
          input_lon: location.lon,
          max_distance_meters: Math.round(radiusMiles * METERS_PER_MILE),
        })
      : Promise.resolve({ data: [] as NearbyRow[], error: null });
  const [favoritesResult, nearbyResult] = await Promise.all([
    favoritesRequest,
    nearbyRequest,
  ]);

  if (favoritesResult.error) {
    throw new Error(
      `Failed to load favorite beaches: ${favoritesResult.error.message}`,
    );
  }
  if (nearbyResult.error) {
    throw new Error(
      `Failed to load nearby beaches: ${nearbyResult.error.message}`,
    );
  }

  const favorites = (favoritesResult.data ?? []) as FavoriteRow[];
  const nearby = (nearbyResult.data ?? []) as NearbyRow[];
  const customSpotIds = favorites
    .map((favorite) => favorite.custom_spot_id)
    .filter((id): id is string => id !== null);
  const customBeachIds: string[] = [];

  if (customSpotIds.length > 0) {
    const { data: customSpots, error: customSpotsError } = await supabase
      .from("custom_spots")
      .select("id, nearest_beach_id")
      .in("id", customSpotIds)
      .eq("user_id", userId)
      .is("deleted_at", null);
    if (customSpotsError) {
      throw new Error(
        `Failed to load custom spots: ${customSpotsError.message}`,
      );
    }

    const anchorIds = [
      ...new Set(
        ((customSpots ?? []) as CustomSpotRow[])
          .map((spot) => spot.nearest_beach_id)
          .filter((id): id is string => id !== null),
      ),
    ];
    if (anchorIds.length > 0) {
      const { data: forecasts, error: forecastsError } = await supabase
        .from("enhanced_forecasts")
        .select("beach_id")
        .in("beach_id", anchorIds)
        .gte(
          "updated_at",
          new Date(Date.now() - FORECAST_MAX_AGE_MS).toISOString(),
        );
      if (forecastsError) {
        throw new Error(
          `Failed to load custom spot forecasts: ${forecastsError.message}`,
        );
      }
      customBeachIds.push(
        ...new Set((forecasts ?? []).map((forecast) => forecast.beach_id)),
      );
    }
  }

  const relations = new Map<string, PoolRelation>();
  if (homeBeachId) relations.set(homeBeachId, "home");
  for (const favorite of favorites) {
    if (favorite.beach_id && !relations.has(favorite.beach_id)) {
      relations.set(favorite.beach_id, "favorite");
    }
  }
  for (const beachId of customBeachIds) {
    if (!relations.has(beachId)) relations.set(beachId, "custom");
  }
  for (const row of nearby) {
    if (row.id && !relations.has(row.id)) relations.set(row.id, "nearby");
  }

  const beachIds = [...relations.keys()];
  if (beachIds.length === 0) return [];

  const { data: beaches, error: beachesError } = await supabase
    .from("beaches")
    .select("*")
    .in("id", beachIds);
  if (beachesError) {
    throw new Error(
      `Failed to hydrate user pool beaches: ${beachesError.message}`,
    );
  }

  const beachesById = new Map(
    ((beaches ?? []) as Beach[]).map((beach) => [beach.id, beach]),
  );
  const closestNearby = nearby
    .filter((row) => beachesById.has(row.id))
    .sort((left, right) => left.distance_meters - right.distance_meters)[0];
  const anchorCountry = closestNearby
    ? beachesById.get(closestNearby.id)?.country
    : homeBeachId ? beachesById.get(homeBeachId)?.country : undefined;

  if (anchorCountry) {
    for (const [beachId, relation] of relations) {
      if (relation === "nearby" && beachesById.get(beachId)?.country !== anchorCountry) {
        relations.delete(beachId);
      }
    }
  }
  const nearbyDistances = new Map(
    nearby.map((row) => [row.id, row.distance_meters / METERS_PER_MILE]),
  );

  return [...relations.keys()].flatMap((beachId) => {
    const beach = beachesById.get(beachId);
    if (!beach?.slug) return [];
    const distanceMiles = nearbyDistances.get(beachId) ?? distanceFromAnchor(location, beach);
    // Saved and home spots are candidates only when the surfer could drive to
    // them from where they are; with no anchor there is nothing to measure.
    if (distanceMiles !== null && distanceMiles > radiusMiles) return [];
    return [
      {
        beach,
        relation: relations.get(beachId)!,
        distanceMiles,
      },
    ];
  });
}

function distanceFromAnchor(
  location: { lat: number; lon: number } | null,
  beach: Beach,
): number | null {
  if (!location || !Number.isFinite(beach.lat) || !Number.isFinite(beach.lon)) return null;
  const miles = calculateDistanceInMiles(location, { lat: beach.lat, lon: beach.lon });
  return Number.isFinite(miles) ? miles : null;
}
