import type { SupabaseClient } from "@supabase/supabase-js";
import { haversineM } from "../tracks/track-geometry";
import { findNoGpsAttachTarget } from "./find-attach-target";
import { loadImportBeach, type ImportBeach } from "./resolve-import-beach";

type NoGpsResolution =
  | { status: "resolved"; beach: ImportBeach; source: "logged_session" | "phone_location";
      attachTarget: { sessionId: string; hasTrack: boolean; trackImportId: string | null } | null }
  | { status: "needs_beach"; candidates: ImportBeach[] };

type NearbyRow = { id: string; name: string; lat: number; lon: number };

async function phoneCandidates(
  service: SupabaseClient, userId: string, startedAt: string, endedAt: string,
): Promise<Array<{ beach: ImportBeach; distanceM: number }>> {
  const { data: snapshot, error } = await service.from("user_location_snapshots")
    .select("lat, lon, captured_at").eq("user_id", userId).maybeSingle();
  if (error) throw error;
  if (!snapshot) return [];
  const captured = Date.parse(snapshot.captured_at);
  if (!Number.isFinite(captured) || captured < Date.parse(startedAt) - 2 * 3600_000
    || captured > Date.parse(endedAt) + 3600_000) return [];

  const { data: nearby, error: nearbyError } = await service.rpc("get_nearby_beaches", {
    input_lat: snapshot.lat, input_lng: snapshot.lon, max_distance_meters: 1500, limit_count: 3,
  });
  if (nearbyError) throw nearbyError;
  const rows = (nearby ?? []) as NearbyRow[];
  if (!rows.length) return [];
  const { data: windows, error: windowsError } = await service.from("beaches")
    .select("id, swell_window_center_deg").in("id", rows.map(row => row.id));
  if (windowsError) throw windowsError;
  const centers = new Map((windows ?? []).map(row => [row.id, row.swell_window_center_deg]));
  return rows.map(row => ({
    beach: { id: row.id, name: row.name, lat: row.lat, lon: row.lon,
      swellWindowCenterDeg: centers.get(row.id) ?? null },
    distanceM: haversineM(snapshot, row),
  })).filter(candidate => candidate.distanceM <= 1500)
    .sort((a, b) => a.distanceM - b.distanceM);
}

export async function resolveNoGpsBeach(
  service: SupabaseClient, userId: string, inWaterStart: string, startedAt: string, endedAt: string,
): Promise<NoGpsResolution> {
  const target = await findNoGpsAttachTarget(service, userId, inWaterStart);
  if (target) {
    const beach = await loadImportBeach(service, target.beachId);
    if (beach) return { status: "resolved", beach, source: "logged_session", attachTarget: target };
  }

  const candidates = await phoneCandidates(service, userId, startedAt, endedAt);
  if (candidates.length === 1 || (candidates.length > 1
    && candidates[1].distanceM > 0 && candidates[0].distanceM * 2 <= candidates[1].distanceM)) {
    return { status: "resolved", beach: candidates[0].beach, source: "phone_location", attachTarget: null };
  }
  return { status: "needs_beach", candidates: candidates.map(candidate => candidate.beach) };
}

export async function rankNoGpsCandidates(
  service: SupabaseClient, userId: string, startedAt: string, endedAt: string,
  now: Date = new Date(),
): Promise<ImportBeach[]> {
  const nearby = await phoneCandidates(service, userId, startedAt, endedAt);
  const candidates = nearby.map(candidate => candidate.beach);
  const seen = new Set(candidates.map(beach => beach.id));

  const { data: sessions, error: sessionsError } = await service.from("sessions")
    .select("beach_id").eq("user_id", userId).eq("status", "completed").is("deleted_at", null)
    .gte("arrival_time", new Date(now.getTime() - 60 * 86400_000).toISOString())
    .lte("arrival_time", now.toISOString());
  if (sessionsError) throw sessionsError;
  const counts = new Map<string, number>();
  for (const session of sessions ?? []) {
    if (session.beach_id) counts.set(session.beach_id, (counts.get(session.beach_id) ?? 0) + 1);
  }
  const mostSurfed = [...counts].sort((a, b) => b[1] - a[1])[0]?.[0];

  const { data: profile, error: profileError } = await service.from("profiles")
    .select("home_beach_id").eq("id", userId).maybeSingle();
  if (profileError) throw profileError;
  for (const id of [mostSurfed, profile?.home_beach_id]) {
    if (!id || seen.has(id) || candidates.length >= 5) continue;
    seen.add(id);
    const beach = await loadImportBeach(service, id);
    if (beach) candidates.push(beach);
  }
  return candidates.slice(0, 5);
}
