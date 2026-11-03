import type { SupabaseClient } from "@supabase/supabase-js";

export type ClaimTarget = {
  sessionId: string;
  beachId: string | null;
  hasTrack: boolean;
  trackImportId: string | null;
  source: string | null;
};

export type KeptField = { field: string; phoneValue: unknown; watchValue: unknown };
export type MergeResult = { mergedFields: string[]; keptFields: KeptField[] };

type ClaimRow = {
  session_id: string;
  device_id: string | null;
  window_start: string;
  window_end: string;
  created_at: string | null;
};

// Imports can run before the claims migration reaches an environment; no table means no claims.
const MISSING_TABLE_CODES = new Set(["42P01", "PGRST205"]);

function isMissingTable(error: { code?: string } | null): boolean {
  return error?.code !== undefined && MISSING_TABLE_CODES.has(error.code);
}

function overlapMs(claim: ClaimRow, startMs: number, endMs: number): number {
  return Math.min(Date.parse(claim.window_end), endMs) - Math.max(Date.parse(claim.window_start), startMs);
}

function deviceRank(claim: ClaimRow, deviceId: string | null): number {
  if (deviceId && claim.device_id === deviceId) return 0;
  return claim.device_id === null ? 1 : 2;
}

export async function findClaimTarget(
  deps: { userClient: SupabaseClient; serviceClient: SupabaseClient },
  claim: { userId: string; importId: string; deviceId: string | null; inWaterStart: string; inWaterEnd: string },
): Promise<ClaimTarget | null> {
  const { userClient, serviceClient } = deps;
  const startMs = Date.parse(claim.inWaterStart);
  const endMs = Date.parse(claim.inWaterEnd);
  const { data, error } = await serviceClient.from("session_watch_claims")
    .select("session_id, device_id, window_start, window_end, created_at")
    .eq("user_id", claim.userId)
    .lte("window_start", claim.inWaterEnd)
    .gte("window_end", claim.inWaterStart)
    .or(`claimed_import_id.is.null,claimed_import_id.eq.${claim.importId}`);
  if (isMissingTable(error)) return null;
  if (error) throw error;

  const candidates = ((data ?? []) as ClaimRow[]).sort((a, b) =>
    deviceRank(a, claim.deviceId) - deviceRank(b, claim.deviceId)
    || overlapMs(b, startMs, endMs) - overlapMs(a, startMs, endMs)
    || Date.parse(b.created_at ?? "") - Date.parse(a.created_at ?? ""));
  for (const candidate of candidates) {
    const { data: session, error: sessionError } = await userClient.from("sessions")
      .select("id, beach_id, source").eq("id", candidate.session_id).eq("user_id", claim.userId)
      .is("deleted_at", null).maybeSingle();
    if (sessionError) throw sessionError;
    if (!session || session.source === "garmin_watch" || session.source === "file_import") continue;
    const { data: track, error: trackError } = await userClient.from("session_tracks")
      .select("session_id, import_id").eq("session_id", session.id).maybeSingle();
    if (trackError) throw trackError;
    if (track && track.import_id !== claim.importId) continue;
    return { sessionId: session.id, beachId: session.beach_id ?? null, hasTrack: track != null,
      trackImportId: track?.import_id ?? null, source: session.source ?? null };
  }
  return null;
}

/** Marks the session's claim as taken by this import. True when this import holds it. */
export async function reserveClaim(
  serviceClient: SupabaseClient, userId: string, sessionId: string, importId: string, now: Date,
): Promise<boolean> {
  const { data, error } = await serviceClient.from("session_watch_claims")
    .update({ claimed_import_id: importId, claimed_at: now.toISOString() })
    .eq("session_id", sessionId).eq("user_id", userId).is("claimed_import_id", null)
    .select("session_id");
  if (isMissingTable(error)) return false;
  if (error) throw error;
  if (data?.length) return true;
  const { data: held, error: heldError } = await serviceClient.from("session_watch_claims")
    .select("session_id").eq("session_id", sessionId).eq("user_id", userId)
    .eq("claimed_import_id", importId).maybeSingle();
  if (heldError) throw heldError;
  return held != null;
}

/** Records what the merge took from the watch. A retry keeps the first run's record. */
export async function recordMergeResult(
  serviceClient: SupabaseClient, userId: string, sessionId: string, importId: string, result: MergeResult,
): Promise<void> {
  const { error } = await serviceClient.from("session_watch_claims").update({ merge_result: result })
    .eq("session_id", sessionId).eq("user_id", userId).eq("claimed_import_id", importId)
    .is("merge_result", null);
  if (isMissingTable(error)) return;
  if (error) throw error;
}
