import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

import { createPublicReadClient } from "@/lib/supabase/server";
import { calculateDistance } from "@/lib/utils/distance-utils";
import { buildBeachUrl } from "@/lib/utils/beach-url-utils";

import type { TideStationRegionCount, TideStationRow, TideStationSummary } from "./types";

const SUMMARY_COLUMNS =
  "id, source, name, slug, country_code, country_slug, region, region_slug, lat, lon, station_kind";
const PAGE_SIZE = 1000;

/** PostgREST/Postgres codes for "this relation does not exist" (migration not applied yet). */
const MISSING_RELATION_CODES = new Set(["PGRST205", "42P01"]);

export class TideStationsUnavailableError extends Error {}

interface PostgrestLikeError {
  code?: string;
  message?: string;
}

// tide_stations is not in types/database.generated.ts until the migration is applied.
function db(): SupabaseClient {
  return createPublicReadClient() as unknown as SupabaseClient;
}

/**
 * A missing table means the registry is not live: callers render a 404.
 * Any other error is a real failure and must not be cached as "not found".
 */
function handleError(error: PostgrestLikeError | null): void {
  if (!error) return;
  if (error.code && MISSING_RELATION_CODES.has(error.code)) {
    throw new TideStationsUnavailableError(error.message ?? "tide_stations unavailable");
  }
  throw new Error(error.message || "tide_stations query failed");
}

/** Null when the station does not exist or the registry is not live. */
export const getTideStationBySlug = cache(async (slug: string): Promise<TideStationRow | null> => {
  try {
    const { data, error } = await db()
      .from("tide_stations")
      .select("*")
      .eq("slug", slug)
      .eq("active", true)
      .maybeSingle();
    handleError(error);
    return (data as TideStationRow | null) ?? null;
  } catch (error) {
    if (error instanceof TideStationsUnavailableError) return null;
    throw error;
  }
});

/** Name and slug of another station (a subordinate station's reference), or null. */
export async function getTideStationLink(id: string): Promise<{ name: string; slug: string } | null> {
  const { data, error } = await db()
    .from("tide_stations")
    .select("name, slug")
    .eq("id", id)
    .eq("active", true)
    .maybeSingle();
  if (error) {
    console.warn("Tide station link query failed", { id, message: error.message });
    return null;
  }
  return (data as { name: string; slug: string } | null) ?? null;
}

function boundingBox(lat: number, lon: number, km: number) {
  const latDelta = km / 111;
  const lonDelta = km / (111 * Math.max(0.1, Math.cos((lat * Math.PI) / 180)));
  return {
    minLat: lat - latDelta,
    maxLat: lat + latDelta,
    minLon: Math.max(-180, lon - lonDelta),
    maxLon: Math.min(180, lon + lonDelta),
  };
}

interface NearbyTideStation extends TideStationSummary {
  distanceKm: number;
}

export async function getNearbyTideStations(
  station: Pick<TideStationRow, "id" | "lat" | "lon">,
  limit = 6,
  radiusKm = 150
): Promise<NearbyTideStation[]> {
  const box = boundingBox(station.lat, station.lon, radiusKm);
  const { data, error } = await db()
    .from("tide_stations")
    .select(SUMMARY_COLUMNS)
    .eq("active", true)
    .neq("id", station.id)
    .gte("lat", box.minLat)
    .lte("lat", box.maxLat)
    .gte("lon", box.minLon)
    .lte("lon", box.maxLon)
    .limit(200);
  if (error) {
    console.warn("Nearby tide stations query failed", { message: error.message });
    return [];
  }
  return ((data ?? []) as TideStationSummary[])
    .map((row) => ({ ...row, distanceKm: calculateDistance(station, row, "km") }))
    .filter((row) => row.distanceKm <= radiusKm)
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, limit);
}

interface NearbyBeachLink {
  id: string;
  name: string;
  href: string;
  distanceKm: number;
}

interface BeachLinkRow {
  id: string;
  name: string;
  slug: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  lat: number | null;
  lon: number | null;
}

/** Public Quiver beaches near a station, linked to their forecast pages. */
export async function getNearbyBeachLinks(lat: number, lon: number, limit = 6, radiusKm = 50): Promise<NearbyBeachLink[]> {
  const box = boundingBox(lat, lon, radiusKm);
  const { data, error } = await db()
    .from("beaches")
    .select("id, name, slug, city, state, country, lat, lon")
    // Same public-beach filter as beach-query-service: NULL is_private is public.
    .or("is_private.is.null,is_private.eq.false")
    .is("deleted_at", null)
    .not("slug", "is", null)
    .gte("lat", box.minLat)
    .lte("lat", box.maxLat)
    .gte("lon", box.minLon)
    .lte("lon", box.maxLon)
    .limit(200);
  if (error) {
    console.warn("Nearby beaches query failed", { message: error.message });
    return [];
  }
  return ((data ?? []) as BeachLinkRow[])
    .filter((row): row is BeachLinkRow & { lat: number; lon: number } => row.lat != null && row.lon != null)
    .map((row) => ({
      id: row.id,
      name: row.name,
      href: buildBeachUrl(row),
      distanceKm: calculateDistance({ lat, lon }, { lat: row.lat, lon: row.lon }, "km"),
    }))
    .filter((row) => row.distanceKm <= radiusKm && !row.href.startsWith("/beach/unknown"))
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, limit);
}

/** Station counts per country and US region. Throws TideStationsUnavailableError before the migration. */
export const getTideStationRegionCounts = cache(async (): Promise<TideStationRegionCount[]> => {
  const { data, error } = await db()
    .from("tide_station_region_counts")
    .select("country_code, country_slug, region, region_slug, station_count");
  handleError(error);
  return ((data ?? []) as TideStationRegionCount[]).map((row) => ({
    ...row,
    station_count: Number(row.station_count),
  }));
});

async function listAllSummaries(
  filter: { countrySlug?: string; regionSlug?: string }
): Promise<TideStationSummary[]> {
  const rows: TideStationSummary[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    let query = db()
      .from("tide_stations")
      .select(SUMMARY_COLUMNS)
      .eq("active", true)
      .order("name", { ascending: true })
      .order("id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (filter.countrySlug) query = query.eq("country_slug", filter.countrySlug);
    if (filter.regionSlug) query = query.eq("region_slug", filter.regionSlug);
    const { data, error } = await query;
    handleError(error);
    const page = (data ?? []) as TideStationSummary[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
  }
}

export function listTideStationsInPlace(countrySlug: string, regionSlug?: string): Promise<TideStationSummary[]> {
  return listAllSummaries({ countrySlug, regionSlug });
}

/** Every active station slug, for the sitemap. Empty before the migration. */
export async function listTideStationSlugsForSitemap(): Promise<string[]> {
  const slugs: string[] = [];
  try {
    for (let from = 0; ; from += PAGE_SIZE) {
      const { data, error } = await db()
        .from("tide_stations")
        .select("slug")
        .eq("active", true)
        .order("slug", { ascending: true })
        .range(from, from + PAGE_SIZE - 1);
      handleError(error);
      const page = (data ?? []) as Array<{ slug: string }>;
      slugs.push(...page.map((row) => row.slug));
      if (page.length < PAGE_SIZE) return slugs;
    }
  } catch (error) {
    if (error instanceof TideStationsUnavailableError) return [];
    throw error;
  }
}
