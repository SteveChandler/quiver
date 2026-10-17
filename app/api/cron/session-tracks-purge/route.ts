import {
  createErrorResponse,
  createSuccessResponse,
  handleApiError,
  validateCronRequest,
} from "@/lib/middleware/api-wrappers";
import { withObservedCron } from "@/lib/cron/observability";
import { withCronOutcome } from "@/lib/cron/outcome";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

export const revalidate = 0;
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const ROUTE = "/api/cron/session-tracks-purge";
const BUCKET = "session-tracks";
const BATCH_SIZE = 100;
const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

type Client = ReturnType<typeof createSupabaseServiceRoleClient>;
type Track = { session_id: string; import_id: string | null; storage_path: string };
type SessionImport = { id: string; session_id: string | null; storage_path: string };
type PurgeResult = { purgedTracks: number; purgedImports: number; errors: number };

function checkedRows<T>(data: T[] | null, error: { message: string } | null, label: string): T[] {
  if (error || !data) throw new Error(`Failed to select ${label}: ${error?.message ?? "missing data"}`);
  return data;
}

async function selectTracks(client: Client, cutoff: string): Promise<Track[]> {
  const requested = await client.from("session_tracks")
    .select("session_id,import_id,storage_path")
    .not("purge_requested_at", "is", null)
    .limit(BATCH_SIZE);
  const tracks = checkedRows(requested.data, requested.error, "requested tracks") as Track[];
  if (tracks.length === BATCH_SIZE) return tracks;

  const expired = await client.from("session_tracks")
    .select("session_id,import_id,storage_path,sessions!inner(deleted_at)")
    .lt("sessions.deleted_at", cutoff)
    .limit(BATCH_SIZE - tracks.length);
  const seen = new Set(tracks.map((track) => track.session_id));
  for (const track of checkedRows(expired.data, expired.error, "expired tracks") as Track[]) {
    if (!seen.has(track.session_id)) tracks.push(track);
  }
  return tracks;
}

async function selectImports(client: Client, cutoff: string): Promise<SessionImport[]> {
  const requested = await client.from("session_imports")
    .select("id,session_id,storage_path")
    .not("purge_requested_at", "is", null)
    .limit(BATCH_SIZE);
  const imports = checkedRows(requested.data, requested.error, "requested imports") as SessionImport[];
  if (imports.length === BATCH_SIZE) return imports;

  const expired = await client.from("session_imports")
    .select("id,session_id,storage_path")
    .in("status", ["uploaded", "failed", "needs_beach"])
    .lt("created_at", cutoff)
    .limit(BATCH_SIZE - imports.length);
  const seen = new Set(imports.map((row) => row.id));
  for (const row of checkedRows(expired.data, expired.error, "expired imports") as SessionImport[]) {
    if (!seen.has(row.id)) imports.push(row);
  }
  return imports;
}

async function removeStorage(client: Client, path: string): Promise<void> {
  // Supabase Storage accepts removal of an object that is already absent.
  const { error } = await client.storage.from(BUCKET).remove([path]);
  if (error) throw error;
}

async function deleteRows(client: Client, table: "session_waves" | "session_wave_corrections" | "session_tracks", sessionId: string): Promise<void> {
  const { error } = await client.from(table).delete().eq("session_id", sessionId);
  if (error) throw error;
}

async function deleteImport(client: Client, importId: string): Promise<void> {
  const { error } = await client.from("session_imports").delete().eq("id", importId);
  if (error) throw error;
}

async function purgeTrack(client: Client, track: Track, result: PurgeResult): Promise<void> {
  try {
    let importPath: string | null = null;
    if (track.import_id) {
      const lookup = await client.from("session_imports")
        .select("id,session_id,storage_path")
        .eq("id", track.import_id)
        .limit(1);
      importPath = checkedRows(lookup.data, lookup.error, "linked import")[0]?.storage_path ?? null;
    }
    await removeStorage(client, track.storage_path);
    if (importPath && importPath !== track.storage_path) await removeStorage(client, importPath);
    await deleteRows(client, "session_waves", track.session_id);
    await deleteRows(client, "session_wave_corrections", track.session_id);
    await deleteRows(client, "session_tracks", track.session_id);
    result.purgedTracks += 1;
    if (track.import_id) {
      await deleteImport(client, track.import_id);
      result.purgedImports += 1;
    }
  } catch (error) {
    result.errors += 1;
    console.error("[session-tracks-purge] track failed:", track.session_id, error);
  }
}

async function purgeImport(
  client: Client,
  row: SessionImport,
  result: PurgeResult,
  attemptedTrackIds: Set<string>,
): Promise<void> {
  try {
    const lookup = await client.from("session_tracks")
      .select("session_id,import_id,storage_path")
      .eq("import_id", row.id)
      .limit(1);
    const linkedTrack = checkedRows(lookup.data, lookup.error, "linked track")[0];
    if (linkedTrack) {
      if (attemptedTrackIds.has(linkedTrack.session_id) || attemptedTrackIds.size >= BATCH_SIZE) return;
      attemptedTrackIds.add(linkedTrack.session_id);
      await purgeTrack(client, linkedTrack, result);
      return;
    }

    await removeStorage(client, row.storage_path);
    if (row.session_id) {
      await deleteRows(client, "session_waves", row.session_id);
      await deleteRows(client, "session_wave_corrections", row.session_id);
      await deleteRows(client, "session_tracks", row.session_id);
    }
    await deleteImport(client, row.id);
    result.purgedImports += 1;
  } catch (error) {
    result.errors += 1;
    console.error("[session-tracks-purge] import failed:", row.id, error);
  }
}

async function runPurge(client: Client, now: Date): Promise<PurgeResult> {
  const result: PurgeResult = { purgedTracks: 0, purgedImports: 0, errors: 0 };
  const cutoff = new Date(now.getTime() - RETENTION_MS).toISOString();
  const tracks = await selectTracks(client, cutoff);
  const attemptedTrackIds = new Set(tracks.map((track) => track.session_id));
  for (const track of tracks) await purgeTrack(client, track, result);

  const imports = await selectImports(client, cutoff);
  for (const row of imports) await purgeImport(client, row, result, attemptedTrackIds);
  return result;
}

async function _GET(request: Request): Promise<Response> {
  try {
    if (!validateCronRequest(request)) {
      return createErrorResponse("Unauthorized", "Invalid cron authentication", 401);
    }

    const result = await withCronOutcome(
      {
        job: ROUTE,
        unit: "session_track_rows_purged",
        expectedMin: 1,
        getProduced: (value: PurgeResult) => value.purgedTracks + value.purgedImports,
        legitimatelyZero: (value: PurgeResult) => value.errors === 0
          ? { reason: "No session tracks or imports are due for purge" }
          : undefined,
        failureReason: (value: PurgeResult) => value.errors > 0 ? `${value.errors} purge errors` : null,
      },
      () => runPurge(createSupabaseServiceRoleClient(), new Date()),
    );

    console.log("[session-tracks-purge] complete:", JSON.stringify(result));
    return createSuccessResponse({ result });
  } catch (error) {
    console.error("[session-tracks-purge] cron error:", error);
    return handleApiError(error);
  }
}

export const GET = withObservedCron(ROUTE, _GET);
