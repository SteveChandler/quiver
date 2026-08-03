"use client";

import { useCallback } from "react";
import { useDataFetcher } from "@/hooks/use-data-fetcher";
import { createClient } from "@/lib/supabase/client";
import { normalizeBeachCountry } from "@/lib/utils/beach-url-utils";

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
  country?: string | null;
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
  country: string | null;
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

  const rows = (data as NearbyBeachRow[] | null) ?? [];
  const countryById = new Map<string, string>();
  const ids = rows.map((row) => row.id).filter(Boolean);
  const rpcIncludedCountry = rows.every(
    (row) => normalizeBeachCountry(row.country) !== null,
  );

  if (ids.length > 0 && !rpcIncludedCountry) {
    if (typeof (client as { from?: unknown }).from !== "function") {
      throw new Error("Nearby beach country hydration is unavailable");
    }

    const { data: countryRows, error: countryError } = await client
      .from("beaches")
      .select("id, country")
      .in("id", ids);

    if (countryError) throw countryError;

    for (const row of countryRows || []) {
      const country = normalizeBeachCountry(row.country);
      if (country) countryById.set(row.id, country);
    }

    const missingCountryIds = ids.filter((id) => !countryById.has(id));
    if (missingCountryIds.length > 0) {
      throw new Error(
        `Nearby beach country hydration was incomplete for ${missingCountryIds.length} beach(es)`,
      );
    }
  }

  return rows.map<NearbyBeach>((b) => ({
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
    country: countryById.get(b.id) ?? normalizeBeachCountry(b.country),
  }));
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
