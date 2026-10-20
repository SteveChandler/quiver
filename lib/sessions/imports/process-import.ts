import "server-only";

import { createHash, randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { emitSessionCreatedEvent } from "@/lib/analytics/session-created";
import { WATCH_CONTRACT } from "@/lib/watch/contract";
import { readTrackFile } from "../tracks/read-track-file";
import { summarizeTrack, type TrackSummary } from "../tracks/summarize-track";
import { heartRateStats, paddleDistanceM } from "../tracks/track-stats";
import { COUNT_MIN_CONFIDENCE } from "../wave-detection/constants";
import { TrackFileError, type NormalizedTrack } from "../tracks/types";
import { detectWaves, WAVE_DETECTION_VERSION, type DetectedWave } from "../wave-detection/detect-waves";
import { buildWavesSummary, type WavesSummary } from "../waves/waves-summary";
import { findAttachTarget } from "./find-attach-target";
import { linkRecentCall } from "./link-recent-call";
import { loadImportBeach, resolveImportBeach, type ImportBeach } from "./resolve-import-beach";
import { resolveNoGpsBeach, type NoGpsBeachResolution } from "./resolve-no-gps-beach";

export type ProcessImportResult =
  | { status: "completed"; sessionId: string; attached: boolean; summary: WavesSummary }
  | { status: "needs_beach"; importId: string; candidates: ImportBeach[] }
  | { status: "duplicate"; sessionId: string | null };

export class ImportNotFoundError extends Error {
  constructor() {
    super("Import not found");
    this.name = "ImportNotFoundError";
  }
}

type TrackInsert = {
  sessionId: string;
  userId: string;
  importId: string;
  storagePath: string;
  format: NormalizedTrack["meta"]["format"];
  sha256: string;
  track: NormalizedTrack;
  summary: TrackSummary;
  userArrivalTime: string | null;
  userDurationMinutes: number | null;
  timingFromTrack: boolean;
  paddleDistanceM: number;
  hrAvg: number | null;
  hrMax: number | null;
  sourceDevice: string | null;
};

type BeachResolution =
  | { status: "resolved"; beach: ImportBeach | null }
  | { status: "needs_beach"; candidates: ImportBeach[] };

function asError(error: unknown): Error {
  if (error instanceof Error) return error;
  if (typeof error === "object" && error !== null && "message" in error) {
    return new Error(String(error.message));
  }
  return new Error("Session import failed");
}

function checkError(error: unknown): void {
  if (error) throw asError(error);
}

async function insertSessionTrack(serviceClient: SupabaseClient, row: TrackInsert): Promise<void> {
  const { track, summary } = row;
  const { error } = await serviceClient.from("session_tracks").insert({
    session_id: row.sessionId,
    user_id: row.userId,
    import_id: row.importId,
    storage_path: row.storagePath,
    format: row.format,
    sha256: row.sha256,
    recorded_by: track.meta.recordedBy,
    sport: track.meta.sport,
    sub_sport: track.meta.subSport,
    started_at: track.meta.startedAt,
    ended_at: track.meta.endedAt,
    sample_count: summary.sampleCount,
    gps_coverage: summary.gpsCoverage,
    max_gap_s: summary.maxGapS,
    speed_reliable: summary.speedReliable,
    track_geojson: summary.trackGeojson,
    speed_series: summary.speedSeries,
    water_temp_c: summary.waterTempC,
    user_arrival_time: row.userArrivalTime,
    user_duration_minutes: row.userDurationMinutes,
    timing_from_track: row.timingFromTrack,
    paddle_distance_m: row.paddleDistanceM,
    hr_avg: row.hrAvg,
    hr_max: row.hrMax,
    source_device: row.sourceDevice,
  });
  checkError(error);
}

export async function persistDetection(
  serviceClient: SupabaseClient,
  sessionId: string,
  userId: string,
  track: NormalizedTrack,
  summary: TrackSummary,
  beach: ImportBeach,
  precomputedWaves?: DetectedWave[],
): Promise<DetectedWave[]> {
  const waves = precomputedWaves ?? detectWaves(track, summary, beach);
  const { error: deleteError } = await serviceClient.from("session_waves").delete()
    .eq("session_id", sessionId).eq("detection_version", WAVE_DETECTION_VERSION);
  checkError(deleteError);
  const { error: retireError } = await serviceClient.from("session_waves").update({ is_current: false })
    .eq("session_id", sessionId).neq("detection_version", WAVE_DETECTION_VERSION);
  checkError(retireError);
  if (!waves.length) return waves;

  const { error } = await serviceClient.from("session_waves").insert(waves.map(wave => ({
    id: randomUUID(),
    session_id: sessionId,
    user_id: userId,
    detection_version: WAVE_DETECTION_VERSION,
    wave_index: wave.index,
    is_current: true,
    started_at: wave.startedAt,
    ended_at: wave.endedAt,
    duration_s: wave.durationS,
    distance_m: wave.distanceM,
    max_speed_mps: wave.maxSpeedMps,
    avg_speed_mps: wave.avgSpeedMps,
    start_lat: wave.start.lat,
    start_lon: wave.start.lon,
    end_lat: wave.end.lat,
    end_lon: wave.end.lon,
    heading_deg: wave.headingDeg,
    confidence: wave.confidence,
  })));
  checkError(error);
  return waves;
}

export async function processImport(
  deps: { userClient: SupabaseClient; serviceClient: SupabaseClient; now: Date },
  importId: string,
  userId: string,
  beachOverride?: string,
): Promise<ProcessImportResult> {
  const { userClient, serviceClient, now } = deps;
  const updateImport = async (values: Record<string, unknown>): Promise<void> => {
    const { error } = await serviceClient.from("session_imports").update(values)
      .eq("id", importId).eq("user_id", userId);
    checkError(error);
  };

  try {
    const { data: imported, error: importError } = await serviceClient.from("session_imports")
      .select("*").eq("id", importId).eq("user_id", userId).single();
    checkError(importError);
    if (!imported || imported.user_id !== userId
      || !imported.storage_path.startsWith(`${importId}/${userId}/`)) {
      throw new ImportNotFoundError();
    }

    const isWatch = imported.origin === "garmin_watch";
    let wasCompleted = imported.status === "completed";
    const duplicate = async (sessionId: string | null): Promise<ProcessImportResult> => {
      try {
        await updateImport({ status: "failed", error: "duplicate" });
      } catch (error) {
        console.warn("[session_import] failed to record duplicate:", error);
      }
      try {
        const { data: references, error: referenceError } = await serviceClient.from("session_tracks")
          .select("session_id").eq("storage_path", imported.storage_path).limit(1);
        checkError(referenceError);
        if (references?.length === 0) {
          const { error } = await serviceClient.storage.from("session-tracks").remove([imported.storage_path]);
          checkError(error);
        }
      } catch (error) {
        console.warn("[session_import] failed to clean up duplicate object:", error);
      }
      return { status: "duplicate", sessionId };
    };

    const { data: object, error: downloadError } = await serviceClient.storage
      .from("session-tracks").download(imported.storage_path);
    checkError(downloadError);
    if (!object) throw new Error("Import object not found");
    if (object.size > 10485760) throw new TrackFileError("corrupt", "Track file exceeds the 10 MiB size limit");
    const bytes = new Uint8Array(await object.arrayBuffer());
    if (bytes.byteLength > 10485760) throw new TrackFileError("corrupt", "Track file exceeds the 10 MiB size limit");
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    const track = readTrackFile(bytes, imported.original_filename ?? imported.storage_path, now);
    if ((!isWatch && track.meta.format === "quiver_watch")
      || (isWatch && track.meta.format !== "quiver_watch")) {
      throw new TrackFileError("unsupported_format", "The track format does not match the import origin");
    }
    const summary = summarizeTrack(track);
    const startMs = Date.parse(summary.inWaterStart);
    const endMs = Date.parse(summary.inWaterEnd);
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs)
      || startMs < Date.parse("2015-01-01T00:00:00Z") || startMs > now.getTime() || endMs < startMs) {
      throw new TrackFileError("bad_time", "The track has an implausible in-water time");
    }

    const spanS = (endMs - startMs) / 1000;
    if (isWatch && spanS < WATCH_CONTRACT.minInWaterSeconds) {
      throw new TrackFileError("too_short", "This track is too short to be a surf.");
    }

    const noGps = summary.centroid === null;
    const resolution: BeachResolution | NoGpsBeachResolution = beachOverride
      ? { status: "resolved" as const, beach: await loadImportBeach(userClient, beachOverride) }
      : noGps
        ? await resolveNoGpsBeach(serviceClient, userId, summary.inWaterStart, track.meta.startedAt, track.meta.endedAt)
        : await resolveImportBeach(userClient, summary.centroid!);
    if (resolution.status === "needs_beach") {
      await updateImport({ status: "needs_beach", summary: noGps
        ? { ...summary, startedAt: track.meta.startedAt, endedAt: track.meta.endedAt } : summary, error: null });
      return { status: "needs_beach", importId, candidates: resolution.candidates };
    }
    const beach = resolution.beach;
    if (!beach) throw new Error("Import beach not found");
    const beachSource = beachOverride ? "user" : noGps && "source" in resolution ? resolution.source : "gps";
    const { data: previous, error: shaError } = await serviceClient.from("session_imports")
      .select("id, status, session_id").eq("user_id", userId).eq("sha256", sha256).maybeSingle();
    checkError(shaError);
    const { data: ownLinkedSession, error: linkedError } = imported.session_id
      ? await userClient.from("sessions").select("id, source").eq("id", imported.session_id)
        .eq("user_id", userId).is("deleted_at", null).maybeSingle()
      : { data: null, error: null };
    checkError(linkedError);
    let linkedSession = ownLinkedSession;
    const { data: linkedTrack, error: linkedTrackError } = linkedSession
      ? await userClient.from("session_tracks")
        .select("session_id, import_id, user_arrival_time, user_duration_minutes, user_wave_count")
        .eq("session_id", linkedSession.id).maybeSingle()
      : { data: null, error: null };
    checkError(linkedTrackError);
    if (!linkedSession && previous && previous.id !== importId && previous.session_id) {
      const { data: previousSession, error: sessionError } = await userClient.from("sessions")
        .select("id, source").eq("id", previous.session_id).eq("user_id", userId)
        .is("deleted_at", null).maybeSingle();
      checkError(sessionError);
      if (previousSession) {
        const { data: previousTrack, error: trackError } = await userClient.from("session_tracks")
          .select("session_id, import_id, user_arrival_time, user_duration_minutes, user_wave_count")
          .eq("session_id", previousSession.id).maybeSingle();
        checkError(trackError);
        if (!previousTrack && (!noGps || previous.status !== "completed")
          && (previousSession.source === "file_import" || previousSession.source === "garmin_watch")) {
          linkedSession = previousSession;
          wasCompleted = previous.status === "completed";
          await updateImport({ session_id: previousSession.id });
        } else if (previous.status === "completed") {
          return duplicate(previousSession.id);
        }
      }
    }
    let target: Awaited<ReturnType<typeof findAttachTarget>>;
    if (linkedSession) {
      target = { sessionId: linkedSession.id, hasTrack: linkedTrack !== null,
        trackImportId: linkedTrack?.import_id ?? null, source: linkedSession.source ?? null };
    } else if (!beachOverride && noGps && resolution.status === "resolved"
      && "attachTarget" in resolution && resolution.attachTarget) {
      target = resolution.attachTarget as NonNullable<typeof target>;
    } else {
      target = await findAttachTarget(userClient, userId, beach, summary.inWaterStart);
    }
    if (target?.hasTrack && target.trackImportId !== importId) {
      if (!isWatch) return duplicate(target.sessionId);
      // SHA matches were handled above; a nearby watch surf can be a separate session.
      target = null;
    }
    if (isWatch && !linkedSession && target?.source === "garmin_watch") target = null;
    const { data: existingTrack, error: existingTrackError } = target?.hasTrack && !linkedTrack
      ? await userClient.from("session_tracks")
        .select("session_id, import_id, user_arrival_time, user_duration_minutes, user_wave_count")
        .eq("session_id", target.sessionId).maybeSingle()
      : { data: target ? linkedTrack : null, error: null };
    checkError(existingTrackError);
    const attached = existingTrack
      ? existingTrack.user_arrival_time != null || existingTrack.user_duration_minutes != null
      : target !== null && !linkedSession;

    if (previous && previous.id !== importId) {
      // The unique SHA belongs to the new attempt; retain the old import's session link.
      const { error } = await serviceClient.from("session_imports").update({ sha256: null })
        .eq("id", previous.id).eq("user_id", userId);
      checkError(error);
    }
    const { error: claimError } = await serviceClient.from("session_imports").update({ sha256 })
      .eq("id", importId).eq("user_id", userId);
    if (claimError?.code === "23505") {
      const { data: winner, error: winnerError } = await serviceClient.from("session_imports")
        .select("session_id").eq("user_id", userId).eq("sha256", sha256).maybeSingle();
      checkError(winnerError);
      if (winner?.session_id) {
        const { data: liveSession, error: sessionError } = await userClient.from("sessions")
          .select("id").eq("id", winner.session_id).eq("user_id", userId).is("deleted_at", null).maybeSingle();
        checkError(sessionError);
        if (liveSession) return duplicate(liveSession.id);
      }
      return duplicate(null);
    }
    checkError(claimError);

    const watchWaves = isWatch && !noGps ? detectWaves(track, summary, beach) : null;
    const timing = { arrival_time: summary.inWaterStart, duration_minutes: Math.round((endMs - startMs) / 60000) };
    let sessionTimingUpdate: (typeof timing & { status?: "completed" }) | null = null;
    let sessionId: string;
    let sessionBeachId: string | null = beach.id;
    let userArrivalTime: string | null = null;
    let userDurationMinutes: number | null = null;
    if (target) {
      const { data: session, error } = await userClient.from("sessions")
        .select("id, beach_id, arrival_time, duration_minutes, status").eq("id", target.sessionId)
        .eq("user_id", userId).is("deleted_at", null).single();
      checkError(error);
      if (!session) throw new Error("Attach session not found");
      sessionId = session.id;
      sessionBeachId = session.beach_id;
      if (attached) {
        userArrivalTime = existingTrack ? existingTrack.user_arrival_time : session.arrival_time;
        userDurationMinutes = existingTrack ? existingTrack.user_duration_minutes : session.duration_minutes;
        sessionTimingUpdate = { ...timing, ...(session.status === "planned" ? { status: "completed" } : {}) };
      }
    } else {
      const { data: session, error } = await userClient.from("sessions").insert({
        user_id: userId, status: "completed",
        is_public: isWatch && !noGps && spanS >= 600
          && (watchWaves?.some(wave => wave.confidence >= COUNT_MIN_CONFIDENCE) ?? false),
        source: isWatch ? "garmin_watch" : "file_import",
        ...(isWatch ? { rating: track.extras?.rating ?? null, wave_height_ft: track.extras?.waveHeightFt ?? null } : {}),
        ...timing, beach_id: beach.id, beach_name: beach.name,
      }).select("id").single();
      checkError(error);
      if (!session) throw new Error("Session insert returned no session");
      sessionId = session.id;
      await updateImport({ session_id: sessionId });
    }

    const waves = noGps ? [] : existingTrack
      ? watchWaves ?? detectWaves(track, summary, beach)
      : await persistDetection(serviceClient, sessionId, userId, track, summary, beach, watchWaves ?? undefined);
    if (!existingTrack && !noGps) {
      const persistedSummary = summarizeTrack(track, waves.map(wave => ({ start: wave.startedAt, end: wave.endedAt })));
      const rideWindows = waves.filter(wave => wave.confidence >= COUNT_MIN_CONFIDENCE)
        .map(wave => ({ start: wave.startedAt, end: wave.endedAt }));
      const hr = heartRateStats(track, summary);
      await insertSessionTrack(serviceClient, {
        sessionId, userId, importId, storagePath: imported.storage_path, format: track.meta.format,
        sha256, track, summary: persistedSummary, userArrivalTime, userDurationMinutes, timingFromTrack: true,
        paddleDistanceM: paddleDistanceM(track, summary, rideWindows), hrAvg: hr?.avg ?? null, hrMax: hr?.max ?? null,
        sourceDevice: isWatch ? track.extras?.deviceName ?? null : null,
      });
    }
    if (sessionTimingUpdate) {
      const { error } = await userClient.from("sessions").update(sessionTimingUpdate)
        .eq("id", sessionId).eq("user_id", userId).is("deleted_at", null);
      checkError(error);
    }
    if (isWatch && attached && track.extras?.rating != null) {
      const { error } = await userClient.from("sessions").update({ rating: track.extras.rating })
        .eq("id", sessionId).eq("user_id", userId).is("deleted_at", null).is("rating", null);
      checkError(error);
    }
    if (isWatch && target && track.extras?.waveHeightFt != null) {
      // A forecast-prefilled height is the forecast, not an observation, so the watch answer replaces it.
      // The source is set here because the provenance trigger relabels only when the value changes,
      // and chip midpoints often equal the prefill.
      const { error } = await userClient.from("sessions")
        .update({ wave_height_ft: track.extras.waveHeightFt, wave_height_source: "user" })
        .eq("id", sessionId).eq("user_id", userId).is("deleted_at", null)
        .or("wave_height_ft.is.null,wave_height_source.eq.forecast_prefill");
      checkError(error);
    }
    if (isWatch && sessionBeachId) {
      await linkRecentCall(serviceClient, { userId, sessionId, beachId: sessionBeachId, arrivalTime: timing.arrival_time });
    }
    if (summary.waterTempC !== null) {
      const { error } = await userClient.from("sessions").update({
        water_temp: Math.round(summary.waterTempC * 9 / 5 + 32), water_temp_source: "watch",
      }).eq("id", sessionId).eq("user_id", userId).is("water_temp", null);
      checkError(error);
    }
    const wavesSummary = buildWavesSummary(
      waves.map(wave => ({ ...wave, id: String(wave.index) })), [],
      { gpsCoverage: summary.gpsCoverage, speedReliable: summary.speedReliable, userWaveCount: existingTrack?.user_wave_count ?? null },
      WAVE_DETECTION_VERSION,
    );
    await updateImport({ status: "completed", session_id: sessionId, summary: wavesSummary, error: null });
    if (!attached && !wasCompleted) {
      await emitSessionCreatedEvent(userClient, {
        session: { id: sessionId, beach_id: beach.id }, userId,
        source: isWatch ? "garmin-watch" : "web-file-import",
        surface: isWatch ? "garmin-watch" : "web-file-import",
        metadata: {
          is_historical: !isWatch && startMs + timing.duration_minutes * 60000 < now.getTime() - 48 * 3600000,
          wave_count: wavesSummary.waveCount, gps_coverage: summary.gpsCoverage, format: track.meta.format,
          recorded_by_family: track.meta.recordedBy?.split(/\s+/)[0] ?? "unknown",
          ...(isWatch ? { beach_source: beachSource } : {}),
        },
      });
    }
    return { status: "completed", sessionId, attached, summary: wavesSummary };
  } catch (error) {
    if (error instanceof TrackFileError) {
      try {
        await updateImport({ status: "failed", error: error.code });
      } catch (failure) {
        console.warn("[session_import] failed to record import error:", failure);
      }
      try {
        const { error: eventError } = await serviceClient.from("user_events").insert({
          user_id: userId, event_type: "session_import_failed", metadata: { code: error.code },
        });
        checkError(eventError);
      } catch (failure) {
        console.warn("[session_import] failed to record failure event:", failure);
      }
      throw error;
    }
    throw asError(error);
  }
}
