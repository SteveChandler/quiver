import { randomUUID } from "node:crypto";
import { z } from "zod";
import { createErrorResponse, createSuccessResponse } from "@/lib/api-utils";
import { isSessionImportsUserAllowed } from "@/lib/flags/session-imports";
import { withAuth, withNoStore, withRateLimit } from "@/lib/middleware/api-wrappers";
import { WAVE_DETECTION_VERSION } from "@/lib/sessions/wave-detection/detect-waves";
import { buildWavesSummary, type Correction, type StoredWave } from "@/lib/sessions/waves/waves-summary";
import { createServiceRoleClient } from "@/lib/supabase";

export const runtime = "nodejs";

const correctionRequest = z.object({ excluded: z.boolean() }).strict();

export const PATCH = withNoStore(withRateLimit(withAuth(async (request, { user, supabase, params }) => {
  if (!z.uuid().safeParse(params.id).success || !z.uuid().safeParse(params.waveId).success) {
    return createErrorResponse("invalid_request", undefined, 400);
  }
  if (!isSessionImportsUserAllowed(user.id)) return createErrorResponse("not_found", undefined, 404);
  const parsed = correctionRequest.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return createErrorResponse("invalid_request", undefined, 400);

  const { data: session, error: sessionError } = await supabase.from("sessions")
    .select("id, user_id, deleted_at").eq("id", params.id).eq("user_id", user.id)
    .is("deleted_at", null).maybeSingle();
  if (sessionError) throw new Error(sessionError.message);
  if (!session || session.user_id !== user.id || session.deleted_at) return createErrorResponse("not_found", undefined, 404);

  const { data: track, error: trackError } = await supabase.from("session_tracks")
    .select("gps_coverage, speed_reliable, user_wave_count").eq("session_id", session.id)
    .eq("user_id", user.id).maybeSingle();
  if (trackError) throw new Error(trackError.message);
  if (!track) return createErrorResponse("not_found", undefined, 404);

  const { data: rows, error: wavesError } = await supabase.from("session_waves")
    .select("*").eq("session_id", session.id).eq("is_current", true).order("wave_index");
  if (wavesError) throw new Error(wavesError.message);
  const target = rows?.find(row => row.id === params.waveId);
  if (!target) return createErrorResponse("not_found", undefined, 404);

  const { data: correctionRows, error: correctionsError } = await supabase.from("session_wave_corrections")
    .select("started_at, ended_at").eq("session_id", session.id).eq("action", "exclude");
  if (correctionsError) throw new Error(correctionsError.message);

  const waveSpan: Correction = { startedAt: target.started_at, endedAt: target.ended_at };
  let corrections: Correction[] = (correctionRows ?? []).map(row => ({ startedAt: row.started_at, endedAt: row.ended_at }));
  if (parsed.data.excluded) {
    const { error } = await supabase.from("session_wave_corrections").insert({
      id: randomUUID(), session_id: session.id, user_id: user.id, action: "exclude",
      started_at: target.started_at, ended_at: target.ended_at,
    });
    if (error) throw new Error(error.message);
    corrections = [...corrections, waveSpan];
    const { error: eventError } = await createServiceRoleClient().from("user_events").insert({
      user_id: user.id, event_type: "session_wave_excluded",
      metadata: { session_id: session.id, wave_id: target.id },
    });
    if (eventError) console.warn("[session waves] Exclusion event failed:", eventError);
  } else {
    const { error } = await supabase.from("session_wave_corrections").delete()
      .eq("session_id", session.id).eq("user_id", user.id)
      .lt("started_at", target.ended_at).gt("ended_at", target.started_at);
    if (error) throw new Error(error.message);
    const targetStart = Date.parse(target.started_at);
    const targetEnd = Date.parse(target.ended_at);
    corrections = corrections.filter(correction =>
      Date.parse(correction.startedAt) >= targetEnd || Date.parse(correction.endedAt) <= targetStart);
  }

  const waves: StoredWave[] = (rows ?? []).map(row => ({
    id: row.id, index: row.wave_index, startedAt: row.started_at, endedAt: row.ended_at,
    durationS: row.duration_s, distanceM: row.distance_m, maxSpeedMps: row.max_speed_mps,
    avgSpeedMps: row.avg_speed_mps, headingDeg: row.heading_deg, confidence: row.confidence,
    start: { lat: row.start_lat, lon: row.start_lon }, end: { lat: row.end_lat, lon: row.end_lon },
  }));
  const summary = buildWavesSummary(waves, corrections, {
    gpsCoverage: track.gps_coverage, speedReliable: track.speed_reliable, userWaveCount: track.user_wave_count,
  }, rows?.[0]?.detection_version ?? WAVE_DETECTION_VERSION);
  return createSuccessResponse({ summary });
}, { errorMessage: "Failed to update session wave" }), "authenticated-default"));
