import { z } from "zod";
import { createErrorResponse, createSuccessResponse } from "@/lib/api-utils";
import { isAdmin, type AdminUser } from "@/lib/auth/admin";
import { withAuth, withNoStore, withRateLimit } from "@/lib/middleware/api-wrappers";
import { persistDetection } from "@/lib/sessions/imports/process-import";
import { loadImportBeach } from "@/lib/sessions/imports/resolve-import-beach";
import { readTrackFile } from "@/lib/sessions/tracks/read-track-file";
import { summarizeTrack } from "@/lib/sessions/tracks/summarize-track";
import { COUNT_MIN_CONFIDENCE } from "@/lib/sessions/wave-detection/constants";
import { WAVE_DETECTION_VERSION } from "@/lib/sessions/wave-detection/detect-waves";
import { canViewSessionWaves } from "@/lib/sessions/waves/waves-access";
import { createServiceRoleClient } from "@/lib/supabase";

export const runtime = "nodejs";

export const POST = withNoStore(withRateLimit(withAuth(async (_request, { user, supabase, params }) => {
  if (!z.uuid().safeParse(params.id).success) return createErrorResponse("invalid_request", undefined, 400);
  if (!canViewSessionWaves(user.id)) return createErrorResponse("not_found", undefined, 404);

  const { data: session, error: sessionError } = await supabase.from("sessions")
    .select("id, user_id, beach_id, deleted_at").eq("id", params.id).eq("user_id", user.id)
    .is("deleted_at", null).maybeSingle();
  if (sessionError) throw new Error(sessionError.message);
  if (!session || session.user_id !== user.id || session.deleted_at) return createErrorResponse("not_found", undefined, 404);

  if (!isAdmin(user as AdminUser)) return createErrorResponse("forbidden", undefined, 403);

  const { data: stored, error: trackError } = await supabase.from("session_tracks")
    .select("storage_path").eq("session_id", session.id).eq("user_id", user.id).maybeSingle();
  if (trackError) throw new Error(trackError.message);
  if (!stored) return createErrorResponse("not_found", undefined, 404);
  if (!session.beach_id) return createErrorResponse("not_found", undefined, 404);
  const beach = await loadImportBeach(supabase, session.beach_id);
  if (!beach) return createErrorResponse("not_found", undefined, 404);

  const service = createServiceRoleClient();
  const { data: object, error: downloadError } = await service.storage
    .from("session-tracks").download(stored.storage_path);
  if (downloadError) throw new Error(downloadError.message);
  if (!object) return createErrorResponse("not_found", undefined, 404);
  const bytes = new Uint8Array(await object.arrayBuffer());
  const track = readTrackFile(bytes, stored.storage_path, new Date());
  const summary = summarizeTrack(track);
  const waves = await persistDetection(service, session.id, user.id, track, summary, beach);
  return createSuccessResponse({
    detectionVersion: WAVE_DETECTION_VERSION,
    waveCount: waves.filter(wave => wave.confidence >= COUNT_MIN_CONFIDENCE).length,
  });
}, { errorMessage: "Failed to redetect session waves" }), "authenticated-default"));
