import type { SupabaseClient } from "@supabase/supabase-js";
import { CONDITIONS_REPORT_SOURCE } from "@/lib/sessions/surf-session-filter";
import { haversineDistance } from "@/lib/utils/geo-utils";
import type { ImportBeach } from "./resolve-import-beach";

const ATTACH_WINDOW_MS = 90 * 60 * 1000;
const MAX_BEACH_DISTANCE_KM = 3;
const DEFAULT_DURATION_MS = 60 * 60 * 1000;
const NOW_DEFAULT_TOLERANCE_MS = 5 * 60 * 1000;
// Never surfs: their own rows (imports) or a report written from the beach.
export const NON_ATTACHABLE_SOURCES: ReadonlySet<string> =
  new Set(["garmin_watch", "file_import", CONDITIONS_REPORT_SOURCE]);

type TimedSession = { arrival_time: string; created_at?: string | null; duration_minutes?: number | null;
  timing_user_set?: boolean | null };
type Point = { lat: number | string | null; lon: number | string | null };

// Phones often log after the surf with arrival = save time, so an untouched arrival up to 90 min
// past the watch end still counts. The query uses the widest bound; withinWindow narrows it.
function arrivalBounds(inWaterStart: string, inWaterEnd: string): { startMs: number; endMs: number; from: string; to: string } {
  const startMs = Date.parse(inWaterStart);
  const parsedEnd = Date.parse(inWaterEnd);
  const endMs = Number.isFinite(parsedEnd) && parsedEnd >= startMs ? parsedEnd : startMs;
  return { startMs, endMs, from: new Date(startMs - ATTACH_WINDOW_MS).toISOString(),
    to: new Date(endMs + ATTACH_WINDOW_MS).toISOString() };
}

function overlapsWatch(session: TimedSession, startMs: number, endMs: number): boolean {
  const arrivalMs = Date.parse(session.arrival_time);
  const durationMs = session.duration_minutes && session.duration_minutes > 0
    ? session.duration_minutes * 60_000 : DEFAULT_DURATION_MS;
  return arrivalMs <= endMs && arrivalMs + durationMs >= startMs;
}

/**
 * The phone's untouched "now" default: arrival is the save time. timing_user_set alone can't show
 * this, because builds before it (and web Log Session) never write it, so the arrival must also sit
 * within 5 minutes of the row's created_at.
 */
function isNowDefault(session: TimedSession): boolean {
  if (session.timing_user_set === true || !session.created_at) return false;
  const gapMs = Math.abs(Date.parse(session.arrival_time) - Date.parse(session.created_at));
  return Number.isFinite(gapMs) && gapMs <= NOW_DEFAULT_TOLERANCE_MS;
}

/**
 * Any other arrival is the surf start, so it keeps ±90 min of the watch start; only a "now"
 * default may fall up to 90 min past the watch end.
 */
function withinWindow(session: TimedSession, startMs: number, endMs: number): boolean {
  const arrivalMs = Date.parse(session.arrival_time);
  const latestMs = isNowDefault(session) ? endMs : startMs;
  return arrivalMs >= startMs - ATTACH_WINDOW_MS && arrivalMs <= latestMs + ATTACH_WINDOW_MS;
}

/** Overlapping spans first, then the arrival closest to the watch start. */
function pickClosest<T extends TimedSession>(sessions: T[], startMs: number, endMs: number): T | undefined {
  return sessions
    .filter(session => withinWindow(session, startMs, endMs))
    .map(session => ({ session, overlaps: overlapsWatch(session, startMs, endMs),
      distance: Math.abs(Date.parse(session.arrival_time) - startMs) }))
    .sort((a, b) => Number(b.overlaps) - Number(a.overlaps) || a.distance - b.distance)[0]?.session;
}

function embedded(value: Point | Point[] | null | undefined): Point | null {
  return (Array.isArray(value) ? value[0] : value) ?? null;
}

function withinReach(beach: ImportBeach, point: Point | null): boolean {
  if (point?.lat == null || point?.lon == null) return false;
  const lat = Number(point.lat);
  const lon = Number(point.lon);
  return Number.isFinite(lat) && Number.isFinite(lon)
    && haversineDistance(beach.lat, beach.lon, lat, lon) <= MAX_BEACH_DISTANCE_KM;
}

export async function findNoGpsAttachTarget(
  supabase: SupabaseClient,
  userId: string,
  inWaterStart: string,
  inWaterEnd: string,
  importId: string,
): Promise<{ sessionId: string; beachId: string; hasTrack: boolean; trackImportId: string | null;
  source: string | null } | null> {
  const { startMs, endMs, from, to } = arrivalBounds(inWaterStart, inWaterEnd);
  const { data: sessions, error } = await supabase.from("sessions")
    .select("id, beach_id, arrival_time, created_at, duration_minutes, timing_user_set, source")
    .eq("user_id", userId).is("deleted_at", null)
    .gte("arrival_time", from)
    .lte("arrival_time", to);
  if (error) throw error;
  const candidates = (sessions ?? []).filter(session => session.beach_id
    && !NON_ATTACHABLE_SOURCES.has(session.source ?? ""));
  if (!candidates.length) return null;

  // A no-GPS merge writes no session_tracks row, so a session another watch import already
  // merged into is only visible through session_imports.
  const { data: merged, error: mergedError } = await supabase.from("session_imports")
    .select("session_id").eq("user_id", userId).eq("status", "completed").neq("id", importId)
    .in("session_id", candidates.map(session => session.id));
  if (mergedError) throw mergedError;
  const mergedIds = new Set((merged ?? []).map(row => row.session_id));
  const closest = pickClosest(candidates.filter(session => !mergedIds.has(session.id)), startMs, endMs);
  if (!closest) return null;

  const { data: track, error: trackError } = await supabase.from("session_tracks")
    .select("session_id, import_id").eq("session_id", closest.id).maybeSingle();
  if (trackError) throw trackError;
  return { sessionId: closest.id, beachId: closest.beach_id, hasTrack: track != null,
    trackImportId: track?.import_id ?? null, source: closest.source ?? null };
}

export async function findAttachTarget(
  supabase: SupabaseClient,
  userId: string,
  beach: ImportBeach,
  inWaterStart: string,
  inWaterEnd: string,
): Promise<{ sessionId: string; hasTrack: boolean; trackImportId: string | null; source: string | null } | null> {
  const { startMs, endMs, from, to } = arrivalBounds(inWaterStart, inWaterEnd);
  const { data: sessions, error: sessionsError } = await supabase
    .from("sessions")
    .select(
      "id, source, beach_id, custom_spot_id, arrival_time, created_at, duration_minutes, timing_user_set, deleted_at, beaches!sessions_beach_id_fkey(lat, lon), custom_spots!sessions_custom_spot_id_fkey(lat, lon)",
    )
    .eq("user_id", userId)
    .is("deleted_at", null)
    .gte("arrival_time", from)
    .lte("arrival_time", to);
  if (sessionsError) throw sessionsError;

  const closest = pickClosest((sessions ?? [])
    .filter((session) => {
      if (session.deleted_at) return false;
      // Imported sources are handled later in process-import; a report never absorbs a surf.
      if (session.source === CONDITIONS_REPORT_SOURCE) return false;
      if (session.beach_id === beach.id) return true;
      if (session.beach_id) return withinReach(beach, embedded(session.beaches));
      return session.custom_spot_id != null && withinReach(beach, embedded(session.custom_spots));
    }), startMs, endMs);
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
