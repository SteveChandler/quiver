/**
 * Read service for the public wave-station catalogue (buoy pages, native API).
 * Catalogue reads use the cookie-free anon client so ISR pages can call them.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { createPublicReadClient, createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { haversineDistance } from "@/lib/utils/geo-utils";
import { errorWithCode, selectAllPages } from "./paging";
import type { WaveStationObservationRow, WaveStationRow } from "./types";

/** Untyped until types/database.generated.ts is regenerated with the catalogue tables. */
type ReadClient = SupabaseClient;

const STATION_COLUMNS = [
  "id", "source", "source_station_id", "name", "slug", "country_code", "region", "lat", "lon",
  "station_type", "owner", "program", "cdip_station_id", "has_wave", "has_swell_split", "has_met",
  "license", "attribution", "active", "first_seen_at", "last_observed_at", "last_wave_observed_at",
  "spec_checked_at", "spec_last_modified", "spec_last_observed_at",
  "txt_checked_at", "txt_last_modified", "txt_last_observed_at", "created_at", "updated_at",
].join(", ");

const MAX_HISTORY_HOURS = 180 * 24;
const NEARBY_BEACH_RADIUS_M = 50_000;
const NEARBY_BEACH_LIMIT = 10;

function publicClient(client?: ReadClient): ReadClient {
  return client ?? (createPublicReadClient() as unknown as ReadClient);
}

function fail(context: string, error: { message: string; code?: string }): never {
  throw errorWithCode(`${context}: ${error.message}`, error);
}

export async function getStationBySlug(
  slug: string,
  client?: ReadClient,
): Promise<WaveStationRow | null> {
  const { data, error } = await publicClient(client)
    .from("wave_stations")
    .select(STATION_COLUMNS)
    .eq("slug", slug)
    .maybeSingle();
  if (error) fail("getStationBySlug", error);
  return (data as WaveStationRow | null) ?? null;
}

export interface ListStationsFilter {
  country?: string;
  region?: string;
  /** Default false: met-only stations have no wave data to show. */
  includeNonWave?: boolean;
  /** Default false. */
  includeInactive?: boolean;
}

export async function listStations(
  filter: ListStationsFilter = {},
  client?: ReadClient,
): Promise<WaveStationRow[]> {
  const db = publicClient(client);
  return selectAllPages<WaveStationRow>((from, to) => {
    let query = db.from("wave_stations").select(STATION_COLUMNS);
    if (filter.country) query = query.eq("country_code", filter.country.toUpperCase());
    if (filter.region) query = query.eq("region", filter.region.toUpperCase());
    if (!filter.includeNonWave) query = query.eq("has_wave", true);
    if (!filter.includeInactive) query = query.eq("active", true);
    return query.order("name").order("id").range(from, to) as unknown as PromiseLike<{
      data: WaveStationRow[] | null;
      error: { message: string } | null;
    }>;
  });
}

export interface LatestObservation {
  /** Newest row with a wave height. Buoys often report met first and waves later. */
  latestWave: WaveStationObservationRow | null;
  /** Newest row of any kind (may have wind and temperature only). */
  latestAny: WaveStationObservationRow | null;
}

export async function getLatestObservation(
  stationId: string,
  client?: ReadClient,
): Promise<LatestObservation> {
  const db = publicClient(client);
  const [wave, any] = await Promise.all([
    db
      .from("wave_station_observations")
      .select("*")
      .eq("station_id", stationId)
      .not("wave_height_m", "is", null)
      .order("observed_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    db
      .from("wave_station_observations")
      .select("*")
      .eq("station_id", stationId)
      .order("observed_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (wave.error) fail("getLatestObservation", wave.error);
  if (any.error) fail("getLatestObservation", any.error);
  return {
    latestWave: (wave.data as WaveStationObservationRow | null) ?? null,
    latestAny: (any.data as WaveStationObservationRow | null) ?? null,
  };
}

/** Rows from the last `hours` hours, oldest first. Hours are clamped to 1..4320 (retention). */
export async function getObservationHistory(
  stationId: string,
  hours: number,
  client?: ReadClient,
): Promise<WaveStationObservationRow[]> {
  const db = publicClient(client);
  const safeHours = Math.min(MAX_HISTORY_HOURS, Math.max(1, Number.isFinite(hours) ? hours : 1));
  const since = new Date(Date.now() - safeHours * 60 * 60 * 1000).toISOString();
  return selectAllPages<WaveStationObservationRow>((from, to) =>
    db
      .from("wave_station_observations")
      .select("*")
      .eq("station_id", stationId)
      .gte("observed_at", since)
      .order("observed_at", { ascending: true })
      .range(from, to),
  );
}

export type NearbyWaveStation = WaveStationRow & { distance_km: number };

export interface NearbyStationsOptions {
  /** Leave this station out, e.g. the station whose page lists its neighbours. */
  excludeStationId?: string;
}

/** Nearest active wave stations to a point, closest first (limit 1..50). */
export async function getNearbyStations(
  lat: number,
  lon: number,
  limit = 5,
  client?: ReadClient,
  options: NearbyStationsOptions = {},
): Promise<NearbyWaveStation[]> {
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    return [];
  }
  const { excludeStationId } = options;
  const fetchLimit = excludeStationId ? limit + 1 : limit;
  const { data, error } = await publicClient(client)
    .rpc("get_nearby_wave_stations", { p_lat: lat, p_lon: lon, p_limit: fetchLimit, p_wave_only: true })
    .select(STATION_COLUMNS);
  if (error) fail("getNearbyStations", error);
  const rows = ((data ?? []) as unknown as WaveStationRow[])
    .filter((station) => station.id !== excludeStationId)
    .map((station) => ({
      ...station,
      distance_km: haversineDistance(lat, lon, station.lat, station.lon),
    }));
  return excludeStationId ? rows.slice(0, limit) : rows;
}

/** Ids the forecast pipeline uses for the same physical buoy. */
export function forecastStationIds(
  station: Pick<WaveStationRow, "source" | "source_station_id" | "cdip_station_id">,
): string[] {
  if (station.source !== "ndbc") return [];
  const upper = station.source_station_id.toUpperCase();
  const lower = station.source_station_id.toLowerCase();
  // ndbc_direct_stations keeps the case of its own feed, so send both cases.
  const ids = new Set([upper, lower, `wmo_${lower}`]);
  if (station.cdip_station_id) ids.add(`edu_ucsd_cdip_${station.cdip_station_id.padStart(3, "0")}`);
  return [...ids];
}

export type BeachLink = "forecast_station" | "cdip_station" | "nearby";

export interface StationBeach {
  id: string;
  name: string;
  slug: string | null;
  state: string | null;
  lat: number;
  lon: number;
  distance_km: number;
  links: BeachLink[];
}

export interface StationBeaches {
  /**
   * fed_by: the forecast pipeline reads this buoy for these beaches
   * (beach_observation_stations or beaches.cdip_station).
   * nearby: no such link exists; beaches are listed by distance only.
   */
  relation: "fed_by" | "nearby";
  beaches: StationBeach[];
}

interface BeachRow {
  id: string;
  name: string;
  slug: string | null;
  state: string | null;
  lat: number;
  lon: number;
}

const BEACH_NEARBY_STATION_MAX_KM = 150;
const CDIP_FORECAST_ID = /^edu_ucsd_cdip_(\d{1,4})$/i;

function cdipVariants(raw: string): string[] {
  const n = String(Number(raw));
  return [...new Set([raw, n, n.padStart(3, "0")])];
}

export interface BeachStationMatch {
  /** forecast_station: the forecast pipeline reads this buoy for the beach. */
  relation: "forecast_station" | "nearby";
  station: WaveStationRow;
  distance_km: number;
}

export type BeachStationLookup =
  | { kind: "beach-not-found" }
  | { kind: "no-station" }
  | { kind: "found"; match: BeachStationMatch };

interface BeachPointRow {
  id: string;
  lat: number | null;
  lon: number | null;
  cdip_station: string | null;
}

/**
 * Catalogue stations for one forecast station id, kept only when
 * forecastStationIds maps them back to that id (the inverse of that function).
 */
async function catalogueStationsForForecastId(db: ReadClient, forecastId: string): Promise<WaveStationRow[]> {
  const cdip = CDIP_FORECAST_ID.exec(forecastId);
  const query = cdip
    ? db.from("wave_stations").select(STATION_COLUMNS).in("cdip_station_id", cdipVariants(cdip[1]))
    : db.from("wave_stations").select(STATION_COLUMNS).in("source_station_id", [
      ...new Set([forecastId.replace(/^wmo_/i, "").toUpperCase(), forecastId.replace(/^wmo_/i, "").toLowerCase()]),
    ]);
  const { data, error } = await query;
  if (error) fail("getStationForBeach catalogue", error);
  const rows = (data ?? []) as unknown as WaveStationRow[];
  const cdipId = cdip ? `edu_ucsd_cdip_${String(Number(cdip[1])).padStart(3, "0")}` : null;
  return rows.filter((station) => forecastStationIds(station).includes(cdipId ?? forecastId));
}

/**
 * The buoy behind one beach: the station the forecast pipeline reads
 * (beach_observation_stations, then beaches.cdip_station), else the nearest
 * active wave station within 150 km. Private and deleted beaches are not found.
 * Read-only; the forecast tables are never written.
 */
export async function getStationForBeach(
  beachId: string,
  clients: { publicRead?: ReadClient; serviceRole?: ReadClient } = {},
): Promise<BeachStationLookup> {
  const db = publicClient(clients.publicRead);
  const { data: beachData, error: beachError } = await db
    .from("beaches")
    .select("id, lat, lon, cdip_station")
    .eq("id", beachId)
    .or("is_private.is.null,is_private.eq.false")
    .is("deleted_at", null)
    .maybeSingle();
  if (beachError) fail("getStationForBeach beach", beachError);
  const beach = beachData as BeachPointRow | null;
  if (!beach) return { kind: "beach-not-found" };

  const hasPoint = Number.isFinite(beach.lat) && Number.isFinite(beach.lon);
  const distanceTo = (station: WaveStationRow): number =>
    hasPoint ? haversineDistance(beach.lat as number, beach.lon as number, station.lat, station.lon) : NaN;
  const closest = (stations: WaveStationRow[]): WaveStationRow | null =>
    [...stations].sort((a, b) => (distanceTo(a) || 0) - (distanceTo(b) || 0))[0] ?? null;

  // beach_observation_stations is service-role only; read it, never widen it.
  const serviceRole = clients.serviceRole ?? (createSupabaseServiceRoleClient() as unknown as ReadClient);
  const { data: linkData, error: linkError } = await serviceRole
    .from("beach_observation_stations")
    .select("station_id")
    .eq("beach_id", beach.id)
    .maybeSingle();
  if (linkError) fail("getStationForBeach forecast link", linkError);
  const forecastId = (linkData as { station_id: string | null } | null)?.station_id ?? null;

  const linked = forecastId ? closest(await catalogueStationsForForecastId(db, forecastId)) : null;
  const cdipStation = beach.cdip_station?.trim() ?? "";
  const cdipLinked = !linked && /^\d{1,4}$/.test(cdipStation)
    ? closest(await catalogueStationsForForecastId(db, `edu_ucsd_cdip_${cdipStation}`))
    : null;
  const forecastStation = linked ?? cdipLinked;
  if (forecastStation) {
    return {
      kind: "found",
      match: { relation: "forecast_station", station: forecastStation, distance_km: distanceTo(forecastStation) },
    };
  }

  if (!hasPoint) return { kind: "no-station" };
  const [nearest] = await getNearbyStations(beach.lat as number, beach.lon as number, 1, db);
  if (!nearest || nearest.distance_km > BEACH_NEARBY_STATION_MAX_KM) return { kind: "no-station" };
  const { distance_km, ...station } = nearest;
  return { kind: "found", match: { relation: "nearby", station, distance_km } };
}

export async function getBeachesForStation(
  stationId: string,
  clients: { publicRead?: ReadClient; serviceRole?: ReadClient } = {},
): Promise<StationBeaches> {
  const db = publicClient(clients.publicRead);
  const { data: stationData, error: stationError } = await db
    .from("wave_stations")
    .select("id, source, source_station_id, cdip_station_id, lat, lon")
    .eq("id", stationId)
    .maybeSingle();
  if (stationError) fail("getBeachesForStation", stationError);
  const station = stationData as Pick<
    WaveStationRow,
    "id" | "source" | "source_station_id" | "cdip_station_id" | "lat" | "lon"
  > | null;
  if (!station) return { relation: "nearby", beaches: [] };

  const links = new Map<string, Set<BeachLink>>();
  const addLink = (beachId: string, link: BeachLink) => {
    const set = links.get(beachId) ?? new Set<BeachLink>();
    set.add(link);
    links.set(beachId, set);
  };

  // beach_observation_stations is service-role only; read it, never widen it.
  const aliases = forecastStationIds(station);
  if (aliases.length > 0) {
    const serviceRole = clients.serviceRole
      ?? (createSupabaseServiceRoleClient() as unknown as ReadClient);
    const { data, error } = await serviceRole
      .from("beach_observation_stations")
      .select("beach_id, station_id")
      .in("station_id", aliases);
    if (error) fail("getBeachesForStation forecast links", error);
    for (const row of (data ?? []) as Array<{ beach_id: string }>) addLink(row.beach_id, "forecast_station");
  }

  if (station.cdip_station_id) {
    const n = String(Number(station.cdip_station_id));
    const variants = [...new Set([station.cdip_station_id, n, n.padStart(3, "0")])];
    const { data, error } = await db
      .from("beaches")
      .select("id")
      .in("cdip_station", variants)
      .is("deleted_at", null);
    if (error) fail("getBeachesForStation cdip links", error);
    for (const row of (data ?? []) as Array<{ id: string }>) addLink(row.id, "cdip_station");
  }

  const withDistance = (beach: BeachRow, beachLinks: BeachLink[]): StationBeach => ({
    id: beach.id,
    name: beach.name,
    slug: beach.slug ?? null,
    state: beach.state ?? null,
    lat: beach.lat,
    lon: beach.lon,
    distance_km: haversineDistance(station.lat, station.lon, beach.lat, beach.lon),
    links: beachLinks,
  });

  if (links.size > 0) {
    const { data, error } = await db
      .from("beaches")
      .select("id, name, slug, state, lat, lon")
      .in("id", [...links.keys()])
      .is("deleted_at", null);
    if (error) fail("getBeachesForStation beaches", error);
    const beaches = ((data ?? []) as BeachRow[])
      .map((beach) => withDistance(beach, [...(links.get(beach.id) ?? [])]))
      .sort((a, b) => a.distance_km - b.distance_km);
    if (beaches.length > 0) return { relation: "fed_by", beaches };
  }

  const { data, error } = await db.rpc("get_nearby_beaches", {
    input_lat: station.lat,
    input_lng: station.lon,
    max_distance_meters: NEARBY_BEACH_RADIUS_M,
    limit_count: NEARBY_BEACH_LIMIT,
  });
  if (error) fail("getBeachesForStation nearby", error);
  const beaches = ((data ?? []) as Array<BeachRow & { state?: string | null }>)
    .map((beach) => withDistance({ ...beach, state: beach.state ?? null }, ["nearby"]))
    .sort((a, b) => a.distance_km - b.distance_km);
  return { relation: "nearby", beaches };
}
