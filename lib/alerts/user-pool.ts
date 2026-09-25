import type { SupabaseClient } from "@supabase/supabase-js";
import type { Beach, Database } from "@/types/database";
import { driveRadiusMiles } from "@/lib/profile/drive-range";

export type PoolRelation = "home" | "favorite" | "custom" | "nearby";

export interface PoolBeach {
  beach: Beach;
  relation: PoolRelation;
  distanceMiles: number | null;
}

export interface LoadUserPoolArgs {
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
    ((beaches ?? []) as Beach[])
      .filter((beach) => beach.slug)
      .map((beach) => [beach.id, beach]),
  );
  const nearbyDistances = new Map(
    nearby.map((row) => [row.id, row.distance_meters / METERS_PER_MILE]),
  );

  return beachIds.flatMap((beachId) => {
    const beach = beachesById.get(beachId);
    if (!beach) return [];
    return [
      {
        beach,
        relation: relations.get(beachId)!,
        distanceMiles: nearbyDistances.get(beachId) ?? null,
      },
    ];
  });
}
