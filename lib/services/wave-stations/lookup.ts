/**
 * Additional catalogue reads for the public buoy pages: legacy-id resolution
 * and a batched "newest wave reading" for hub lists. Read-only, anon client.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { createPublicReadClient } from "@/lib/supabase/server";
import { selectAllPages } from "./paging";
import type { WaveStationObservationRow, WaveStationRow } from "./types";

type ReadClient = SupabaseClient;

function publicClient(client?: ReadClient): ReadClient {
  return client ?? (createPublicReadClient() as unknown as ReadClient);
}

const ALTERNATE_ID = /^[a-z0-9]{1,12}$/i;
const IN_CHUNK = 100;

export interface StationIdMatch {
  id: string;
  slug: string;
}

/**
 * Stations whose source id ("46225", "LJPC1", either case) or CDIP id ("100",
 * "0100") equals `alternateId`. Callers redirect only on exactly one match.
 */
export async function findStationsByAlternateId(
  alternateId: string,
  client?: ReadClient,
): Promise<StationIdMatch[]> {
  if (!ALTERNATE_ID.test(alternateId)) return [];
  const db = publicClient(client);
  const sourceIds = [...new Set([alternateId, alternateId.toUpperCase(), alternateId.toLowerCase()])];
  const queries = [
    db.from("wave_stations").select("id, slug").in("source_station_id", sourceIds),
  ];
  if (/^\d{1,4}$/.test(alternateId)) {
    const n = String(Number(alternateId));
    const cdipIds = [...new Set([alternateId, n, n.padStart(3, "0")])];
    queries.push(db.from("wave_stations").select("id, slug").in("cdip_station_id", cdipIds));
  }
  const results = await Promise.all(queries);
  const matches = new Map<string, StationIdMatch>();
  for (const { data, error } of results) {
    if (error) throw new Error(`findStationsByAlternateId: ${error.message}`);
    for (const row of (data ?? []) as StationIdMatch[]) matches.set(row.id, row);
  }
  return [...matches.values()];
}

/**
 * The row at each station's `last_wave_observed_at`, keyed by station id. One
 * query per 100 stations: rows are filtered by station and by the set of those
 * timestamps, then matched exactly in memory.
 */
export async function getLatestWaveObservations(
  stations: Array<Pick<WaveStationRow, "id" | "last_wave_observed_at">>,
  client?: ReadClient,
): Promise<Map<string, WaveStationObservationRow>> {
  const db = publicClient(client);
  const wanted = new Map<string, number>();
  for (const station of stations) {
    const at = station.last_wave_observed_at ? Date.parse(station.last_wave_observed_at) : NaN;
    if (Number.isFinite(at)) wanted.set(station.id, at);
  }
  const ids = [...wanted.keys()];
  const latest = new Map<string, WaveStationObservationRow>();
  for (let start = 0; start < ids.length; start += IN_CHUNK) {
    const chunk = ids.slice(start, start + IN_CHUNK);
    const times = [...new Set(chunk.map((id) => new Date(wanted.get(id) as number).toISOString()))];
    const rows = await selectAllPages<WaveStationObservationRow>((from, to) =>
      db
        .from("wave_station_observations")
        .select("*")
        .in("station_id", chunk)
        .in("observed_at", times)
        .order("station_id")
        .order("observed_at")
        .range(from, to),
    );
    for (const row of rows) {
      if (Date.parse(row.observed_at) === wanted.get(row.station_id)) latest.set(row.station_id, row);
    }
  }
  return latest;
}
