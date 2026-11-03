import { z } from "zod";
import { createErrorResponse, createSuccessResponse } from "@/lib/api-utils";
import { withAuth, withNoStore, withRateLimit } from "@/lib/middleware/api-wrappers";
import { isMissingTable, type MergeResult } from "@/lib/sessions/imports/watch-claims";
import type { SupabaseClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

export type WatchStatusResponse = {
  // superseded: the watch import finished as its own garmin_watch session before (or without) the claim.
  claim: "pending" | "claimed" | "superseded" | "none";
  importId: string | null;
  importStatus: string | null;
  claimedAt: string | null;
  watchSessionId: string | null;
  mergedFields: string[];
  keptFields: MergeResult["keptFields"];
};

const mergeResultSchema = z.object({
  mergedFields: z.array(z.string()),
  keptFields: z.array(z.object({ field: z.string(), phoneValue: z.unknown(), watchValue: z.unknown() })),
});

type WatchTrack = { session_id: string; import_id: string | null; started_at: string; ended_at: string };

/** The completed watch session whose track overlaps the claim window most, if the import already ran. */
async function findSupersedingWatchSession(
  supabase: SupabaseClient, userId: string, sessionId: string, windowStart: string, windowEnd: string,
): Promise<WatchTrack | null> {
  const { data: tracks, error } = await supabase.from("session_tracks")
    .select("session_id, import_id, started_at, ended_at").eq("user_id", userId)
    .lte("started_at", windowEnd).gte("ended_at", windowStart);
  if (error) throw new Error(error.message);
  const candidates = ((tracks ?? []) as WatchTrack[]).filter(track => track.session_id !== sessionId);
  if (!candidates.length) return null;
  const { data: sessions, error: sessionsError } = await supabase.from("sessions").select("id")
    .in("id", candidates.map(track => track.session_id)).eq("user_id", userId)
    .eq("source", "garmin_watch").eq("status", "completed").is("deleted_at", null);
  if (sessionsError) throw new Error(sessionsError.message);
  const watchIds = new Set((sessions ?? []).map(session => session.id));
  const overlap = (track: WatchTrack): number => Math.min(Date.parse(track.ended_at), Date.parse(windowEnd))
    - Math.max(Date.parse(track.started_at), Date.parse(windowStart));
  return candidates.filter(track => watchIds.has(track.session_id))
    .sort((a, b) => overlap(b) - overlap(a))[0] ?? null;
}

// The phone polls this after saving a session that claimed a watch recording. Reads run as the
// user, so RLS on sessions, session_watch_claims and session_imports scopes every row.
export const GET = withNoStore(withRateLimit(withAuth(async (_request, { user, supabase, params }) => {
  if (!z.uuid().safeParse(params.id).success) return createErrorResponse("invalid_request", undefined, 400);

  const { data: session, error: sessionError } = await supabase.from("sessions")
    .select("id").eq("id", params.id).eq("user_id", user.id).is("deleted_at", null).maybeSingle();
  if (sessionError) throw new Error(sessionError.message);
  if (!session) return createErrorResponse("not_found", undefined, 404);

  const { data: claim, error: claimError } = await supabase.from("session_watch_claims")
    .select("claimed_import_id, claimed_at, merge_result, window_start, window_end").eq("session_id", session.id)
    .eq("user_id", user.id).maybeSingle();
  const none: WatchStatusResponse = { claim: "none", importId: null, importStatus: null, claimedAt: null,
    watchSessionId: null, mergedFields: [], keptFields: [] };
  // Before the claims migration reaches an environment there are no claims, not an error.
  if (isMissingTable(claimError)) return createSuccessResponse(none);
  if (claimError) throw new Error(claimError.message);
  if (!claim) return createSuccessResponse(none);

  const importStatus = async (importId: string): Promise<string | null> => {
    const { data: imported, error: importError } = await supabase.from("session_imports")
      .select("status").eq("id", importId).eq("user_id", user.id).maybeSingle();
    if (importError) throw new Error(importError.message);
    return imported?.status ?? null;
  };
  if (!claim.claimed_import_id) {
    const watch = await findSupersedingWatchSession(supabase, user.id, session.id, claim.window_start, claim.window_end);
    if (!watch) return createSuccessResponse({ ...none, claim: "pending" });
    return createSuccessResponse({ ...none, claim: "superseded", watchSessionId: watch.session_id,
      importId: watch.import_id, importStatus: watch.import_id ? await importStatus(watch.import_id) : null,
    } satisfies WatchStatusResponse);
  }

  const merge = mergeResultSchema.safeParse(claim.merge_result);
  return createSuccessResponse({
    claim: "claimed", importId: claim.claimed_import_id, importStatus: await importStatus(claim.claimed_import_id),
    claimedAt: claim.claimed_at, watchSessionId: null, mergedFields: merge.success ? merge.data.mergedFields : [],
    keptFields: merge.success ? merge.data.keptFields : [],
  } satisfies WatchStatusResponse);
}, { errorMessage: "Failed to load watch status" }), "authenticated-default"));
