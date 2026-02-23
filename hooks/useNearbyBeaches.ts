"use client";

import { useCallback } from "react";
import { useDataFetcher } from "@/hooks/use-data-fetcher";
import { createClient } from "@/lib/supabase/client";

type NearbyBeachRow = {
  id: string;
  name: string;
  lat: number | null;
  lon: number | null;
  meters: number | null;
  rating?: number | null;
  review_count?: number | null;
  reviewCount?: number | null;
  image_url?: string | null;
  imageUrl?: string | null;
  map_image_url?: string | null;
  slug?: string | null;
  city?: string | null;
  state?: string | null;
};

export type NearbyBeach = {
  id: string;
  name: string;
  lat: number | null;
  lon: number | null;
  meters: number | null;
  rating: number | null;
  reviewCount: number | null;
  imageUrl: string | null;
  slug: string | null;
  city: string | null;
  state: string | null;
};

export async function fetchNearestBeaches(lat: number, lon: number, limit = 4) {
  const client = createClient();
  const { data, error } = await client.rpc("nearest_beaches", {
    user_lat: lat,
    user_lon: lon,
    limit_n: limit,
  });

  if (error) {
    console.error("nearest_beaches RPC failed", error);
    throw error;
  }

  return (data as NearbyBeachRow[] | null)?.map<NearbyBeach>((b) => ({
    id: b.id,
    name: b.name,
    lat: b.lat,
    lon: b.lon,
    meters: b.meters,
    rating: typeof b.rating === "number" ? b.rating : null,
    reviewCount:
      typeof b.reviewCount === "number"
        ? b.reviewCount
        : typeof b.review_count === "number"
        ? b.review_count
        : null,
    imageUrl:
      b.imageUrl ?? b.image_url ?? b.map_image_url ?? "/images/beach-placeholder.jpg",
    slug: b.slug ?? null,
    city: b.city ?? null,
    state: b.state ?? null,
  })) ?? [];
}

export function useNearbyBeaches(
  sourceLat?: number,
  sourceLon?: number,
  limit = 4
) {
  const enabled = Number.isFinite(sourceLat) && Number.isFinite(sourceLon);
  const roundedLat = enabled ? Math.round((sourceLat as number) * 1000) / 1000 : undefined;
  const roundedLon = enabled ? Math.round((sourceLon as number) * 1000) / 1000 : undefined;

  const fetchNearby = useCallback(async () => {
    return fetchNearestBeaches(roundedLat!, roundedLon!, limit);
  }, [roundedLat, roundedLon, limit]);

  return useDataFetcher<NearbyBeach[]>(fetchNearby, {
    skip: !enabled,
  });
}
