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
type SessionImport = {
  id: string;
  session_id: string | null;
  storage_path: string;
  purge_requested_at: string | null;
  sessions: { deleted_at: string | null } | null;
};
type PurgeResult = { purgedTracks: number; purgedImports: number; purgedUploads: number; purgedLinkCodes: number; errors: number; skipped?: string };

function checkedRows<T>(data: T[] | null, error: { message: string } | null, label: string): T[] {
  if (error || !data) throw new Error(`Failed to select ${label}: ${error?.message ?? "missing data"}`);
  return data;
}

async function selectTracks(client: Client, cutoff: string): Promise<Track[] | null> {
  const requested = await client.from("session_tracks")
    .select("session_id,import_id,storage_path")
    .not("purge_requested_at", "is", null)
    .order("purge_requested_at", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true, nullsFirst: false })
    .limit(BATCH_SIZE);
  if (requested.error && ["PGRST205", "42P01"].includes(requested.error.code)) return null;
  const tracks = checkedRows(requested.data, requested.error, "requested tracks") as Track[];
  if (tracks.length === BATCH_SIZE) return tracks;

  const expired = await client.from("session_tracks")
    .select("session_id,import_id,storage_path,sessions!inner(deleted_at)")
    .lt("sessions.deleted_at", cutoff)
    .order("purge_requested_at", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true, nullsFirst: false })
    .limit(BATCH_SIZE - tracks.length);
  const seen = new Set(tracks.map((track) => track.session_id));
  for (const track of checkedRows(expired.data, expired.error, "expired tracks") as Track[]) {
    if (!seen.has(track.session_id)) tracks.push(track);
  }
  return tracks;
}

async function selectImports(client: Client, cutoff: string): Promise<SessionImport[]> {
  const requested = await client.from("session_imports")
    .select("id,session_id,storage_path,purge_requested_at,sessions(deleted_at)")
    .not("purge_requested_at", "is", null)
    .order("purge_requested_at", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true, nullsFirst: false })
    .limit(BATCH_SIZE);
  const imports = checkedRows(requested.data, requested.error, "requested imports") as SessionImport[];
  if (imports.length === BATCH_SIZE) return imports;

  const expired = await client.from("session_imports")
    .select("id,session_id,storage_path,purge_requested_at,sessions(deleted_at)")
    .in("status", ["uploaded", "failed", "needs_beach"])
    .lt("created_at", cutoff)
    .order("purge_requested_at", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true, nullsFirst: false })
    .limit(BATCH_SIZE - imports.length);
  const seen = new Set(imports.map((row) => row.id));
  for (const row of checkedRows(expired.data, expired.error, "expired imports") as SessionImport[]) {
    if (!seen.has(row.id)) {
      imports.push(row);
      seen.add(row.id);
    }
  }

  if (imports.length === BATCH_SIZE) return imports;
  // A failed final import delete can outlive its track row; the deleted session keeps it retryable.
  const orphaned = await client.from("session_imports")
    .select("id,session_id,storage_path,purge_requested_at,sessions!inner(deleted_at)")
    .lt("sessions.deleted_at", cutoff)
    .order("purge_requested_at", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true, nullsFirst: false })
    .limit(BATCH_SIZE - imports.length);
  for (const row of checkedRows(orphaned.data, orphaned.error, "imports of deleted sessions") as SessionImport[]) {
    if (!seen.has(row.id)) {
      imports.push(row);
      seen.add(row.id);
    }
  }
  if (imports.length === BATCH_SIZE) return imports;
  const detached = await client.from("session_imports")
    .select("id,session_id,storage_path,purge_requested_at,sessions(deleted_at)")
    .eq("status", "completed")
    .is("session_id", null)
    .order("purge_requested_at", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true, nullsFirst: false })
    .limit(BATCH_SIZE - imports.length);
  for (const row of checkedRows(detached.data, detached.error, "imports of hard-deleted sessions") as SessionImport[]) {
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

async function purgeTrack(client: Client, track: Track, result: PurgeResult): Promise<boolean> {
  try {
    let linkedImport: Pick<SessionImport, "id" | "session_id" | "storage_path"> | undefined;
    let sharedImportPath: string | undefined;
    if (track.import_id) {
      const lookup = await client.from("session_imports")
        .select("id,session_id,storage_path")
        .eq("id", track.import_id)
        .limit(1);
      const row = checkedRows(lookup.data, lookup.error, "linked import")[0];
      if (row && (row.session_id === null || row.session_id === track.session_id)) linkedImport = row;
      else sharedImportPath = row?.storage_path;
    }
    // A reimport can transfer the same object to another session that still needs it.
    if (track.storage_path !== sharedImportPath) await removeStorage(client, track.storage_path);
    if (linkedImport && linkedImport.storage_path !== track.storage_path) await removeStorage(client, linkedImport.storage_path);
    await deleteRows(client, "session_waves", track.session_id);
    await deleteRows(client, "session_wave_corrections", track.session_id);
    await deleteRows(client, "session_tracks", track.session_id);
    result.purgedTracks += 1;
    if (linkedImport) {
      await deleteImport(client, linkedImport.id);
      result.purgedImports += 1;
    }
    return true;
  } catch (error) {
    result.errors += 1;
    console.error("[session-tracks-purge] track failed:", track.session_id, error);
    return false;
  }
}

async function purgeImport(
  client: Client,
  row: SessionImport,
  result: PurgeResult,
  attemptedTrackIds: Set<string>,
  cutoff: string,
): Promise<void> {
  try {
    let linkedTrack: Track | undefined;
    if (row.session_id) {
      const lookup = await client.from("session_tracks")
        .select("session_id,import_id,storage_path")
        .eq("session_id", row.session_id)
        .limit(1);
      linkedTrack = checkedRows(lookup.data, lookup.error, "linked track")[0];
    }
    const deletedAt = row.sessions?.deleted_at;
    const trackIsDue = row.purge_requested_at !== null
      || (deletedAt != null && Date.parse(deletedAt) < Date.parse(cutoff));
    if (linkedTrack && trackIsDue) {
      if (attemptedTrackIds.has(linkedTrack.session_id) || attemptedTrackIds.size >= BATCH_SIZE) return;
      attemptedTrackIds.add(linkedTrack.session_id);
      const importIsLinked = linkedTrack.import_id === row.id;
      if (!importIsLinked && row.storage_path !== linkedTrack.storage_path) await removeStorage(client, row.storage_path);
      const purged = await purgeTrack(client, linkedTrack, result);
      if (!purged || importIsLinked) return;
      await deleteImport(client, row.id);
      result.purgedImports += 1;
      return;
    }

    // Track insertion can finish before the import's session_id is written.
    const importReferences = await client.from("session_tracks")
      .select("session_id")
      .eq("import_id", row.id)
      .limit(1);
    if (checkedRows(importReferences.data, importReferences.error, "import track references").length > 0) return;

    const pathReferences = await client.from("session_tracks")
      .select("session_id")
      .eq("storage_path", row.storage_path)
      .limit(1);
    if (checkedRows(pathReferences.data, pathReferences.error, "storage track references").length === 0) {
      await removeStorage(client, row.storage_path);
    }
    await deleteImport(client, row.id);
    result.purgedImports += 1;
  } catch (error) {
    result.errors += 1;
    console.error("[session-tracks-purge] import failed:", row.id, error);
  }
}

async function purgeWatchUploads(client: Client, now: Date, result: PurgeResult): Promise<void> {
  const requested = await client.from("watch_uploads").select("id,user_id")
    .not("purge_requested_at", "is", null)
    .order("purge_requested_at", { ascending: true, nullsFirst: false }).order("created_at", { ascending: true, nullsFirst: false }).limit(BATCH_SIZE);
  if (requested.error && ["PGRST205", "42P01"].includes(requested.error.code)) {
    result.skipped = "watch tables not present";
    return;
  }
  const uploads = checkedRows(requested.data, requested.error, "requested watch uploads");
  if (uploads.length < BATCH_SIZE) {
    // Completed uploads retain only staging chunks; samples belong to session_imports.
    const expired = await client.from("watch_uploads").select("id,user_id")
      .is("purge_requested_at", null)
      .lt("created_at", new Date(now.getTime() - 7 * 86400000).toISOString())
      .order("purge_requested_at", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true, nullsFirst: false }).limit(BATCH_SIZE - uploads.length);
    uploads.push(...checkedRows(expired.data, expired.error, "expired watch uploads"));
  }
  const bucket = client.storage.from(BUCKET);
  for (const upload of uploads) {
    try {
      const prefix = `${upload.id}/${upload.user_id}/chunks`;
      while (true) {
        // Removing a page shifts the remaining objects back to offset zero.
        const listed = await bucket.list(prefix, { limit: BATCH_SIZE, offset: 0, sortBy: { column: "name", order: "asc" } });
        const objects = checkedRows(listed.data, listed.error, "watch chunks");
        if (objects.length === 0) break;
        const { error } = await bucket.remove(objects.map(object => `${prefix}/${object.name}`));
        if (error) throw error;
        if (objects.length < BATCH_SIZE) break;
      }
      const { error } = await client.from("watch_uploads").delete().eq("id", upload.id).eq("user_id", upload.user_id);
      if (error) throw error;
      result.purgedUploads += 1;
    } catch (error) {
      result.errors += 1;
      console.error("[session-tracks-purge] watch upload failed:", upload.id, error);
    }
  }

  const confirmed = await client.from("watch_link_codes").delete()
    .lt("confirmed_at", new Date(now.getTime() - RETENTION_MS).toISOString()).select("id");
  result.purgedLinkCodes += checkedRows(confirmed.data, confirmed.error, "confirmed watch link codes").length;
  const expired = await client.from("watch_link_codes").delete().is("confirmed_at", null)
    .lt("expires_at", new Date(now.getTime() - 86400000).toISOString()).select("id");
  result.purgedLinkCodes += checkedRows(expired.data, expired.error, "expired watch link codes").length;
}

async function runPurge(client: Client, now: Date): Promise<PurgeResult> {
  const result: PurgeResult = { purgedTracks: 0, purgedImports: 0, purgedUploads: 0, purgedLinkCodes: 0, errors: 0 };
  const cutoff = new Date(now.getTime() - RETENTION_MS).toISOString();
  const tracks = await selectTracks(client, cutoff);
  if (tracks === null) return { ...result, skipped: "session waves tables not present" };
  const attemptedTrackIds = new Set(tracks.map((track) => track.session_id));
  for (const track of tracks) await purgeTrack(client, track, result);

  const imports = await selectImports(client, cutoff);
  for (const row of imports) await purgeImport(client, row, result, attemptedTrackIds, cutoff);
  await purgeWatchUploads(client, now, result);
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
        getProduced: (value: PurgeResult) => value.purgedTracks + value.purgedImports + value.purgedUploads + value.purgedLinkCodes,
        legitimatelyZero: (value: PurgeResult) => value.errors === 0
          ? { reason: value.skipped ?? "No session tracks or imports are due for purge" }
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
