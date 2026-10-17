import { z } from "zod";
import { createErrorResponse, createSuccessResponse } from "@/lib/api-utils";
import { isSessionImportsUserAllowed } from "@/lib/flags/session-imports";
import { withAuth, withNoStore, withRateLimit } from "@/lib/middleware/api-wrappers";
import { COUNT_MIN_CONFIDENCE } from "@/lib/sessions/wave-detection/constants";
import { WAVE_DETECTION_VERSION } from "@/lib/sessions/wave-detection/detect-waves";
import { tideFtAtWaves } from "@/lib/sessions/waves/wave-tides";
import type { SessionWave, SessionWavesResponse } from "@/lib/sessions/waves/waves-api-types";
import { buildWavesSummary, isExcluded, type StoredWave } from "@/lib/sessions/waves/waves-summary";
import { createServiceRoleClient } from "@/lib/supabase";

export const runtime = "nodejs";

const countRequest = z.object({ userWaveCount: z.number().int().min(0).max(200).nullable() }).strict();

export const GET = withNoStore(withRateLimit(withAuth(async (_request, { user, supabase, params }) => {
  if (!z.uuid().safeParse(params.id).success) return createErrorResponse("invalid_request", undefined, 400);
  if (!isSessionImportsUserAllowed(user.id)) return createErrorResponse("not_found", undefined, 404);

  const { data: session, error: sessionError } = await supabase.from("sessions")
    .select("id, user_id, beach_id, deleted_at").eq("id", params.id).eq("user_id", user.id)
    .is("deleted_at", null).maybeSingle();
  if (sessionError) throw new Error(sessionError.message);
  if (!session || session.user_id !== user.id || session.deleted_at) return createErrorResponse("not_found", undefined, 404);

  const { data: track, error: trackError } = await supabase.from("session_tracks")
    .select("*").eq("session_id", session.id).eq("user_id", user.id).maybeSingle();
  if (trackError) throw new Error(trackError.message);
  if (!track) return createErrorResponse("not_found", undefined, 404);

  const { data: rows, error: wavesError } = await supabase.from("session_waves")
    .select("*").eq("session_id", session.id).eq("is_current", true).order("wave_index");
  if (wavesError) throw new Error(wavesError.message);
  const { data: correctionRows, error: correctionsError } = await supabase.from("session_wave_corrections")
    .select("started_at, ended_at").eq("session_id", session.id).eq("action", "exclude");
  if (correctionsError) throw new Error(correctionsError.message);

  const waves: StoredWave[] = (rows ?? []).map(row => ({
    id: row.id, index: row.wave_index, startedAt: row.started_at, endedAt: row.ended_at,
    durationS: row.duration_s, distanceM: row.distance_m, maxSpeedMps: row.max_speed_mps,
    avgSpeedMps: row.avg_speed_mps, headingDeg: row.heading_deg, confidence: row.confidence,
    start: { lat: row.start_lat, lon: row.start_lon }, end: { lat: row.end_lat, lon: row.end_lon },
  }));
  const corrections = (correctionRows ?? []).map(row => ({ startedAt: row.started_at, endedAt: row.ended_at }));
  const summary = buildWavesSummary(waves, corrections, {
    gpsCoverage: track.gps_coverage, speedReliable: track.speed_reliable, userWaveCount: track.user_wave_count,
  }, rows?.[0]?.detection_version ?? WAVE_DETECTION_VERSION);

  let tideFt = new Map<string, number | null>();
  if (session.beach_id) {
    try {
      tideFt = await tideFtAtWaves(supabase, session.beach_id, waves);
    } catch (error) {
      console.warn("[session waves] Tide lookup failed:", error);
    }
  }
  const responseWaves: SessionWave[] = waves.map(wave => ({
    ...wave,
    maxSpeedMps: track.speed_reliable ? wave.maxSpeedMps : null,
    avgSpeedMps: track.speed_reliable ? wave.avgSpeedMps : null,
    counted: wave.confidence >= COUNT_MIN_CONFIDENCE && !isExcluded(wave, corrections),
    excluded: isExcluded(wave, corrections), tideFt: tideFt.get(wave.id) ?? null,
  }));
  const data: SessionWavesResponse = {
    summary, waves: responseWaves,
    track: track.track_geojson as SessionWavesResponse["track"],
    speedSeries: track.speed_series as SessionWavesResponse["speedSeries"],
    recordedBy: track.recorded_by,
  };
  return createSuccessResponse(data);
}, { errorMessage: "Failed to load session waves" }), "authenticated-default"));

export const PATCH = withNoStore(withRateLimit(withAuth(async (request, { user, supabase, params }) => {
  if (!z.uuid().safeParse(params.id).success) return createErrorResponse("invalid_request", undefined, 400);
  if (!isSessionImportsUserAllowed(user.id)) return createErrorResponse("not_found", undefined, 404);
  const parsed = countRequest.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return createErrorResponse("invalid_request", undefined, 400);

  const { data: session, error: sessionError } = await supabase.from("sessions")
    .select("id, user_id, deleted_at").eq("id", params.id).eq("user_id", user.id)
    .is("deleted_at", null).maybeSingle();
  if (sessionError) throw new Error(sessionError.message);
  if (!session || session.user_id !== user.id || session.deleted_at) return createErrorResponse("not_found", undefined, 404);

  const { data: track, error: trackError } = await supabase.from("session_tracks")
    .select("*").eq("session_id", session.id).eq("user_id", user.id).maybeSingle();
  if (trackError) throw new Error(trackError.message);
  if (!track) return createErrorResponse("not_found", undefined, 404);

  const service = createServiceRoleClient();
  const { error: updateError } = await service.from("session_tracks")
    .update({ user_wave_count: parsed.data.userWaveCount }).eq("session_id", session.id).eq("user_id", user.id);
  if (updateError) throw new Error(updateError.message);

  const { data: rows, error: wavesError } = await supabase.from("session_waves")
    .select("*").eq("session_id", session.id).eq("is_current", true).order("wave_index");
  if (wavesError) throw new Error(wavesError.message);
  const { data: correctionRows, error: correctionsError } = await supabase.from("session_wave_corrections")
    .select("started_at, ended_at").eq("session_id", session.id).eq("action", "exclude");
  if (correctionsError) throw new Error(correctionsError.message);
  const waves: StoredWave[] = (rows ?? []).map(row => ({
    id: row.id, index: row.wave_index, startedAt: row.started_at, endedAt: row.ended_at,
    durationS: row.duration_s, distanceM: row.distance_m, maxSpeedMps: row.max_speed_mps,
    avgSpeedMps: row.avg_speed_mps, headingDeg: row.heading_deg, confidence: row.confidence,
    start: { lat: row.start_lat, lon: row.start_lon }, end: { lat: row.end_lat, lon: row.end_lon },
  }));
  const summary = buildWavesSummary(waves,
    (correctionRows ?? []).map(row => ({ startedAt: row.started_at, endedAt: row.ended_at })),
    { gpsCoverage: track.gps_coverage, speedReliable: track.speed_reliable, userWaveCount: parsed.data.userWaveCount },
    rows?.[0]?.detection_version ?? WAVE_DETECTION_VERSION,
  );
  const { error: eventError } = await service.from("user_events").insert({
    user_id: user.id, event_type: "session_wave_count_reported",
    metadata: { session_id: session.id, user_wave_count: parsed.data.userWaveCount },
  });
  if (eventError) console.warn("[session waves] Count event failed:", eventError);
  return createSuccessResponse({ summary });
}, { errorMessage: "Failed to update session wave count" }), "authenticated-default"));
