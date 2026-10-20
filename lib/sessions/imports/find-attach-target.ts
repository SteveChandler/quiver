import type { SupabaseClient } from "@supabase/supabase-js";
import { haversineDistance } from "@/lib/utils/geo-utils";
import type { ImportBeach } from "./resolve-import-beach";

const ATTACH_WINDOW_MS = 90 * 60 * 1000;
const MAX_BEACH_DISTANCE_KM = 3;

export async function findNoGpsAttachTarget(
  supabase: SupabaseClient,
  userId: string,
  inWaterStart: string,
): Promise<{ sessionId: string; beachId: string; hasTrack: boolean; trackImportId: string | null;
  source: string | null } | null> {
  const startMs = Date.parse(inWaterStart);
  const { data: sessions, error } = await supabase.from("sessions")
    .select("id, beach_id, arrival_time, source")
    .eq("user_id", userId).is("deleted_at", null)
    .gte("arrival_time", new Date(startMs - ATTACH_WINDOW_MS).toISOString())
    .lte("arrival_time", new Date(startMs + ATTACH_WINDOW_MS).toISOString());
  if (error) throw error;
  const closest = (sessions ?? []).filter(session => session.beach_id
    && session.source !== "garmin_watch" && session.source !== "file_import")
    .sort((a, b) => Math.abs(Date.parse(a.arrival_time) - startMs)
      - Math.abs(Date.parse(b.arrival_time) - startMs))[0];
  if (!closest) return null;

  const { data: track, error: trackError } = await supabase.from("session_tracks")
    .select("session_id, import_id").eq("session_id", closest.id).maybeSingle();
  if (trackError) throw trackError;
  return { sessionId: closest.id, beachId: closest.beach_id,
    hasTrack: track != null, trackImportId: track?.import_id ?? null, source: closest.source ?? null };
}

export async function findAttachTarget(
  supabase: SupabaseClient,
  userId: string,
  beach: ImportBeach,
  inWaterStart: string
): Promise<{ sessionId: string; hasTrack: boolean; trackImportId: string | null; source: string | null } | null> {
  const startMs = Date.parse(inWaterStart);
  const { data: sessions, error: sessionsError } = await supabase
    .from("sessions")
    .select("id, source, beach_id, arrival_time, deleted_at, beaches!sessions_beach_id_fkey(lat, lon)")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .gte("arrival_time", new Date(startMs - ATTACH_WINDOW_MS).toISOString())
    .lte("arrival_time", new Date(startMs + ATTACH_WINDOW_MS).toISOString());
  if (sessionsError) throw sessionsError;

  const closest = (sessions ?? [])
    .filter((session) => {
      if (session.deleted_at) return false;
      if (session.beach_id === beach.id) return true;
      const location = Array.isArray(session.beaches) ? session.beaches[0] : session.beaches;
      return location?.lat != null && location?.lon != null &&
        haversineDistance(beach.lat, beach.lon, location.lat, location.lon) <= MAX_BEACH_DISTANCE_KM;
    })
    .sort((a, b) =>
      Math.abs(Date.parse(a.arrival_time) - startMs) - Math.abs(Date.parse(b.arrival_time) - startMs)
    )[0];
  if (!closest) return null;

  const { data: track, error: trackError } = await supabase
    .from("session_tracks")
    .select("session_id, import_id")
    .eq("session_id", closest.id)
    .maybeSingle();
  if (trackError) throw trackError;

  return { sessionId: closest.id, hasTrack: track != null, trackImportId: track?.import_id ?? null,
    source: closest.source ?? null };
}
