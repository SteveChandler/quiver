import { applyBeachCoordinateCorrection } from "@/lib/beach-coordinate-corrections";
import { createPublicReadClient } from "@/lib/supabase/server";
import { normalizeBeachCountry } from "@/lib/utils/beach-url-utils";
import { calculateDistanceInMiles } from "@/lib/utils/distance-utils";
import { rankBeaches } from "@/lib/recommendations/selection";
import type { Beach } from "@/types/database";
import type { MapBeach } from "@/types/api/map";

export const MAX_NEARBY_RADIUS_MILES = 50;
export const MAX_NEARBY_LIMIT = 50;
const WATER_QUALITY_HOLD_OVERFETCH = 5;
const MAX_FALLBACK_CANDIDATES = 200;
const NEARBY_BEACH_CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_NEARBY_BEACH_CACHE_ENTRIES = 250;

interface NearbyBeachCacheEntry {
  expiresAt: number;
  result: Promise<NearbyBeachResult>;
}

const nearbyBeachCache = new Map<string, NearbyBeachCacheEntry>();

export interface NearbyBeachQuery {
  radiusMiles: number;
  limit: number;
}

export interface NearbyBeachResult {
  success: boolean;
  data?: MapBeach[];
  error?: string;
  fallbackUsed?: boolean;
}

function boundedNumber(
  value: number,
  fallback: number,
  min: number,
  max: number,
): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

export function normalizeNearbyBeachQuery(
  radiusMiles: number,
  limit: number,
): NearbyBeachQuery {
  return {
    radiusMiles: boundedNumber(radiusMiles, 30, 1, MAX_NEARBY_RADIUS_MILES),
    limit: Math.trunc(boundedNumber(limit, 20, 1, MAX_NEARBY_LIMIT)),
  };
}

function validCoordinates(
  beach: Beach,
): beach is Beach & { lat: number; lon: number } {
  return (
    typeof beach.lat === "number" &&
    Number.isFinite(beach.lat) &&
    typeof beach.lon === "number" &&
    Number.isFinite(beach.lon)
  );
}

async function boundedFallback(
  latitude: number,
  longitude: number,
  radiusMiles: number,
  limit: number,
): Promise<MapBeach[]> {
  const supabase = createPublicReadClient();
  const latDelta = radiusMiles / 69;
  const longitudeScale = Math.max(
    0.2,
    Math.abs(Math.cos((latitude * Math.PI) / 180)),
  );
  const lonDelta = radiusMiles / (69 * longitudeScale);
  const { data, error } = await supabase
    .from("beaches")
    .select("id, name, lat, lon, slug, city, state, country, timezone")
    .or("is_private.is.null,is_private.eq.false")
    .is("deleted_at", null)
    .gte("lat", latitude - latDelta)
    .lte("lat", latitude + latDelta)
    .gte("lon", longitude - lonDelta)
    .lte("lon", longitude + lonDelta)
    .limit(MAX_FALLBACK_CANDIDATES);

  if (error) throw error;

  const boundedBeaches = ((data ?? []) as Beach[])
    .map(applyBeachCoordinateCorrection)
    .filter(validCoordinates)
    .map((beach) => ({
      ...beach,
      distance: calculateDistanceInMiles(
        { lat: latitude, lon: longitude },
        { lat: beach.lat, lon: beach.lon },
      ),
    }))
    .filter((beach) => beach.distance <= radiusMiles)
  return rankNearbyBeachesForMap(
    boundedBeaches,
    (left, right) => left.distance - right.distance,
    limit,
  );
}

async function rankNearbyBeachesForMap<T extends Beach>(
  nearbyRows: readonly T[],
  compare: (left: T, right: T) => number,
  limit: number,
): Promise<Array<T & { waterQualityHold: boolean }>> {
  const rankedNearbyRows = await rankBeaches(nearbyRows, { compare });
  const safeBeachIds = new Set(
    rankedNearbyRows.map((beach) => beach.id.toLowerCase()),
  );

  return nearbyRows
    .map((beach) => ({
      ...beach,
      waterQualityHold: !safeBeachIds.has(beach.id.toLowerCase()),
    }))
    .sort(compare)
    .slice(0, limit);
}

export async function getNearbyBeachesFromDb(
  latitude: number,
  longitude: number,
  radiusMiles = 30,
  limit = 20,
): Promise<NearbyBeachResult> {
  const normalized = normalizeNearbyBeachQuery(radiusMiles, limit);
  const supabase = createPublicReadClient();

  try {
    const { data, error } = await supabase.rpc("get_nearby_beaches", {
      input_lat: latitude,
      input_lng: longitude,
      max_distance_meters: Math.round(normalized.radiusMiles * 1609.34),
      limit_count: Math.min(
        MAX_NEARBY_LIMIT + WATER_QUALITY_HOLD_OVERFETCH,
        Math.max(
          normalized.limit + WATER_QUALITY_HOLD_OVERFETCH,
          normalized.limit * 2,
        ),
      ),
    });

    if (error) {
      console.warn(
        "Spatial function failed, using bounded nearby fallback:",
        error,
      );
      return {
        success: true,
        data: await boundedFallback(
          latitude,
          longitude,
          normalized.radiusMiles,
          normalized.limit,
        ),
        fallbackUsed: true,
      };
    }

    const rpcRows = ((data ?? []) as unknown as Beach[])
      .map(applyBeachCoordinateCorrection)
      .filter(validCoordinates);
    const rpcRowIds = rpcRows
      .map((beach) => beach.id)
      .filter((id): id is string => Boolean(id));
    const visibleIds = new Set<string>();
    const countryById = new Map<string, string>();

    if (rpcRowIds.length > 0) {
      const { data: visibleRows, error: visibilityError } = await supabase
        .from("beaches")
        .select("id, country")
        .or("is_private.is.null,is_private.eq.false")
        .is("deleted_at", null)
        .in("id", rpcRowIds);

      if (visibilityError) throw visibilityError;
      for (const row of visibleRows ?? []) {
        visibleIds.add(row.id);
        const country = normalizeBeachCountry(row.country);
        if (country) countryById.set(row.id, country);
      }
    }

    const nearbyRows = rpcRows.filter(
      (beach) => beach.is_private !== true && visibleIds.has(beach.id),
    );
    const missingCountryIds = nearbyRows
      .filter((beach) => normalizeBeachCountry(beach.country) === null)
      .map((beach) => beach.id);

    if (missingCountryIds.length > 0) {
      const unresolvedCountryIds = missingCountryIds.filter(
        (id) => !countryById.has(id),
      );
      if (unresolvedCountryIds.length > 0) {
        throw new Error(
          `Nearby beach country hydration was incomplete for ${unresolvedCountryIds.length} beach(es)`,
        );
      }
    }

    const visibleNearbyRows = await rankNearbyBeachesForMap(
      nearbyRows,
      (left, right) => {
        if (left.lat === null || left.lon === null) return 1;
        if (right.lat === null || right.lon === null) return -1;
        return calculateDistanceInMiles(
          { lat: latitude, lon: longitude },
          { lat: left.lat, lon: left.lon },
        ) - calculateDistanceInMiles(
          { lat: latitude, lon: longitude },
          { lat: right.lat, lon: right.lon },
        );
      },
      normalized.limit,
    );

    return {
      success: true,
      data: visibleNearbyRows.map((beach) => ({
        ...beach,
        country:
          normalizeBeachCountry(beach.country) ??
          countryById.get(beach.id) ??
          null,
      })),
      fallbackUsed: false,
    };
  } catch (error) {
    console.error("Error getting nearby beaches:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function getCachedNearbyBeachesFromDb(
  latitude: number,
  longitude: number,
  radiusMiles = 30,
  limit = 20,
): Promise<NearbyBeachResult> {
  const normalized = normalizeNearbyBeachQuery(radiusMiles, limit);
  const cacheKey = [
    latitude.toFixed(3),
    longitude.toFixed(3),
    normalized.radiusMiles,
    normalized.limit,
  ].join(":");
  const now = Date.now();
  const cached = nearbyBeachCache.get(cacheKey);
  if (cached && cached.expiresAt > now) return cached.result;
  if (cached) nearbyBeachCache.delete(cacheKey);

  const result = getNearbyBeachesFromDb(
    latitude,
    longitude,
    normalized.radiusMiles,
    normalized.limit,
  );
  nearbyBeachCache.set(cacheKey, {
    expiresAt: now + NEARBY_BEACH_CACHE_TTL_MS,
    result,
  });

  if (nearbyBeachCache.size > MAX_NEARBY_BEACH_CACHE_ENTRIES) {
    const oldestKey = nearbyBeachCache.keys().next().value as string | undefined;
    if (oldestKey) nearbyBeachCache.delete(oldestKey);
  }

  const resolved = await result;
  if (!resolved.success) nearbyBeachCache.delete(cacheKey);
  return resolved;
}
