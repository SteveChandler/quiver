/** @jest-environment node */
jest.mock("server-only", () => ({}));

import { createHash } from "node:crypto";
import { FitBaseType, FitEncoder } from "fit-file-parser";
import type { SupabaseClient } from "@supabase/supabase-js";
import fixture from "@/__tests__/fixtures/session-tracks/ob-2026-10-17.json";
import { processImport, persistDetection } from "@/lib/sessions/imports/process-import";
import { readTrackFile } from "@/lib/sessions/tracks/read-track-file";
import { summarizeTrack } from "@/lib/sessions/tracks/summarize-track";
import { detectWaves, WAVE_DETECTION_VERSION } from "@/lib/sessions/wave-detection/detect-waves";

const userId = "user-1";
const importId = "import-1";
const now = new Date("2026-10-20T18:00:00Z");
const beach = { id: "beach-1", name: "OB", ...fixture.beach };

function fixtureBytes(gps = true): Uint8Array {
  const encoder = new FitEncoder();
  encoder.writeMessage(18, [
    { number: 253, size: 4, baseType: FitBaseType.Uint32, value: FitEncoder.toFitTimestamp(new Date(fixture.track.meta.endedAt)) },
    { number: 5, size: 1, baseType: FitBaseType.Enum, value: 38 },
    { number: 6, size: 1, baseType: FitBaseType.Enum, value: 0 },
  ]);
  for (const sample of fixture.track.samples) {
    encoder.writeMessage(20, [
      { number: 253, size: 4, baseType: FitBaseType.Uint32, value: FitEncoder.toFitTimestamp(new Date(sample.t)) },
      ...(gps && sample.lat !== null && sample.lon !== null ? [
        { number: 0, size: 4, baseType: FitBaseType.Sint32, value: Math.round(sample.lat * 2 ** 31 / 180) },
        { number: 1, size: 4, baseType: FitBaseType.Sint32, value: Math.round(sample.lon * 2 ** 31 / 180) },
      ] : []),
      ...(sample.speedMps === null ? [] : [{ number: 6, size: 2, baseType: FitBaseType.Uint16, value: Math.round(sample.speedMps * 1000) }]),
      ...(sample.tempC === null ? [] : [{ number: 13, size: 1, baseType: FitBaseType.Sint8, value: sample.tempC }]),
    ]);
  }
  return encoder.close();
}

type Row = Record<string, any>;
type Mutation = { client: string; table: string; operation: string; payload: any };
let rows: Record<string, Row[]>;
let mutations: Mutation[];
let bytes: Uint8Array;
let nearby: Row[];
let rpcError: unknown;
let download: jest.Mock;
let queryFailure: (mutation: Mutation) => unknown;

function client(name: string): SupabaseClient {
  return {
    storage: { from: jest.fn((bucket: string) => {
      expect(bucket).toBe("session-tracks");
      return { download };
    }) },
    rpc: jest.fn(async () => ({ data: nearby, error: rpcError })),
    from: (table: string) => {
      let operation = "select";
      let payload: Row | Row[];
      const filters: ((row: Row) => boolean)[] = [];
      let single = false;
      const query: any = {
        select: () => query,
        insert: (value: Row | Row[]) => { operation = "insert"; payload = value; return query; },
        update: (value: Row) => { operation = "update"; payload = value; return query; },
        delete: () => { operation = "delete"; return query; },
        eq: (key: string, value: unknown) => { filters.push(row => row[key] === value); return query; },
        neq: (key: string, value: unknown) => { filters.push(row => row[key] !== value); return query; },
        is: (key: string, value: unknown) => { filters.push(row => (row[key] ?? null) === value); return query; },
        gte: (key: string, value: string) => { filters.push(row => row[key] >= value); return query; },
        lte: (key: string, value: string) => { filters.push(row => row[key] <= value); return query; },
        in: (key: string, values: unknown[]) => { filters.push(row => values.includes(row[key])); return query; },
        single: () => { single = true; return query; },
        maybeSingle: () => { single = true; return query; },
        then: (resolve: (value: unknown) => unknown) => {
          const failure = queryFailure({ client: name, table, operation, payload });
          if (failure) return Promise.resolve({ data: null, error: failure }).then(resolve);
          rows[table] ??= [];
          let matched = rows[table].filter(row => filters.every(filter => filter(row)));
          if (operation !== "select") mutations.push({ client: name, table, operation, payload });
          if (operation === "insert") {
            matched = (Array.isArray(payload) ? payload : [payload]).map(row => ({ id: `new-${table}`, ...row }));
            rows[table].push(...matched);
          }
          if (operation === "update") matched.forEach(row => Object.assign(row, payload));
          if (operation === "delete") rows[table] = rows[table].filter(row => !matched.includes(row));
          return Promise.resolve({ data: single ? matched[0] ?? null : matched, error: null, count: matched.length }).then(resolve);
        },
      };
      return query;
    },
  } as unknown as SupabaseClient;
}

let deps: { userClient: SupabaseClient; serviceClient: SupabaseClient; now: Date };
const inserts = (table: string): Mutation[] => mutations.filter(m => m.table === table && m.operation === "insert");

beforeEach(() => {
  bytes = fixtureBytes();
  nearby = [beach];
  rpcError = null;
  mutations = [];
  queryFailure = () => null;
  rows = {
    session_imports: [{ id: importId, user_id: userId, storage_path: "import-1/user-1/watch.fit", original_filename: "watch.fit", status: "uploaded" }],
    beaches: [{ ...beach, swell_window_center_deg: beach.swellWindowCenterDeg }],
    sessions: [], session_tracks: [], session_waves: [],
  };
  download = jest.fn(async () => ({ data: { size: bytes.length, arrayBuffer: async () => bytes.slice().buffer }, error: null }));
  deps = { userClient: client("user"), serviceClient: client("service"), now };
});

it("parses OB bytes, creates a private completed session, stores waves and preserves their full detail", async () => {
  const track = readTrackFile(bytes, "watch.fit", now);
  const summary = summarizeTrack(track);
  const waves = detectWaves(track, summary, beach);
  const result = await processImport(deps, importId, userId);
  expect(result).toMatchObject({ status: "completed", attached: false, summary: { detectionVersion: WAVE_DETECTION_VERSION } });
  expect(inserts("sessions")[0]).toMatchObject({ client: "user", payload: {
    user_id: userId, is_public: false, source: "file_import", status: "completed", beach_id: beach.id, beach_name: beach.name,
    arrival_time: summary.inWaterStart, duration_minutes: Math.round((Date.parse(summary.inWaterEnd) - Date.parse(summary.inWaterStart)) / 60000),
  } });
  expect(result.status).toBe("completed");
  if (result.status !== "completed") throw new Error("Expected completed import");
  expect(result.summary.waveCount).toBeGreaterThanOrEqual(2);
  expect(result.summary.waveCount).toBeLessThanOrEqual(4);
  expect(rows.session_waves).toHaveLength(waves.length);
  expect(rows.session_waves.every(w => /^[0-9a-f-]{36}$/.test(w.id) && w.is_current && w.user_id === userId)).toBe(true);
  const persisted = summarizeTrack(track, waves.map(w => ({ start: w.startedAt, end: w.endedAt })));
  expect(inserts("session_tracks")[0]).toMatchObject({ client: "service", payload: {
    import_id: importId, recorded_by: track.meta.recordedBy, sport: track.meta.sport, sub_sport: track.meta.subSport,
    started_at: track.meta.startedAt, ended_at: track.meta.endedAt, sample_count: summary.sampleCount,
    max_gap_s: summary.maxGapS, gps_coverage: summary.gpsCoverage, speed_reliable: summary.speedReliable,
    track_geojson: persisted.trackGeojson, speed_series: persisted.speedSeries, water_temp_c: summary.waterTempC,
    sha256: createHash("sha256").update(bytes).digest("hex"), timing_from_track: true,
  } });
  expect(rows.sessions[0]).toMatchObject({ water_temp: Math.round(summary.waterTempC! * 9 / 5 + 32), water_temp_source: "watch" });
  expect(rows.session_imports[0]).toMatchObject({ status: "completed", session_id: rows.sessions[0].id, error: null });
  expect(rows.user_events).toContainEqual(expect.objectContaining({ event_type: "session_created", metadata: expect.objectContaining({
    source: "web-file-import", surface: "web-file-import", is_historical: true, format: "fit", gps_coverage: summary.gpsCoverage,
    wave_count: expect.any(Number), recorded_by_family: expect.any(String),
  }) }));
  expect(download).toHaveBeenCalledWith("import-1/user-1/watch.fit");
});

it("attaches a planned session 60 minutes away and preserves user timing and temperature", async () => {
  const summary = summarizeTrack(readTrackFile(bytes, "watch.fit", now));
  const arrival = new Date(Date.parse(summary.inWaterStart) - 3600000).toISOString();
  rows.sessions.push({ id: "existing", user_id: userId, beach_id: beach.id, arrival_time: arrival, duration_minutes: 90, status: "planned", water_temp: 65 });
  expect(await processImport(deps, importId, userId)).toMatchObject({ status: "completed", sessionId: "existing", attached: true });
  expect(inserts("sessions")).toHaveLength(0);
  expect(rows.sessions[0]).toMatchObject({ arrival_time: summary.inWaterStart, status: "completed", water_temp: 65 });
  expect(rows.session_tracks[0]).toMatchObject({ user_arrival_time: arrival, user_duration_minutes: 90 });
  expect(inserts("user_events")).toHaveLength(0);
});

it("returns duplicate for an attach target that already has a track", async () => {
  rows.sessions.push({ id: "existing", user_id: userId, beach_id: beach.id, arrival_time: summarizeTrack(readTrackFile(bytes, "watch.fit", now)).inWaterStart });
  rows.session_tracks.push({ session_id: "existing" });
  expect(await processImport(deps, importId, userId)).toEqual({ status: "duplicate", sessionId: "existing" });
  expect(inserts("sessions")).toHaveLength(0);
});

it("recognizes the same sha even when its live session is outside the attach window", async () => {
  rows.session_imports.push({ id: "old", user_id: userId, sha256: createHash("sha256").update(bytes).digest("hex"), status: "completed", session_id: "old-session" });
  rows.sessions.push({ id: "old-session", user_id: userId, arrival_time: "2020-01-01T00:00:00Z", deleted_at: null });
  expect(await processImport(deps, importId, userId)).toEqual({ status: "duplicate", sessionId: "old-session" });
  expect(inserts("sessions")).toHaveLength(0);
});

it.each(["deleted", "missing", "uploaded", "failed", "needs_beach"])("reclaims sha from %s imports without repointing the old import", async (state) => {
  const sha = createHash("sha256").update(bytes).digest("hex");
  const old = { id: "old", user_id: userId, sha256: sha, status: ["deleted", "missing"].includes(state) ? "completed" : state, session_id: "old-session" };
  rows.session_imports.push(old);
  if (state === "deleted") rows.sessions.push({ id: "old-session", user_id: userId, deleted_at: "2026-10-18T00:00:00Z" });
  expect(await processImport(deps, importId, userId)).toMatchObject({ status: "completed", attached: false });
  expect(old).toMatchObject({ sha256: null, session_id: "old-session" });
  expect(rows.session_imports[0]).toMatchObject({ sha256: sha, session_id: "new-sessions" });
});

it("fails no-GPS FIT files before inserting a session, track, or wave", async () => {
  bytes = fixtureBytes(false);
  await expect(processImport(deps, importId, userId)).rejects.toMatchObject({ code: "no_gps" });
  expect(rows.session_imports[0]).toMatchObject({ status: "failed", error: "no_gps" });
  expect(inserts("sessions")).toHaveLength(0);
  expect(inserts("session_tracks")).toHaveLength(0);
  expect(inserts("session_waves")).toHaveLength(0);
  expect(rows.user_events).toContainEqual(expect.objectContaining({ user_id: userId, event_type: "session_import_failed", metadata: { code: "no_gps" } }));
});

it("rejects objects above 10485760 bytes before reading their contents", async () => {
  const arrayBuffer = jest.fn();
  download.mockResolvedValue({ data: { size: 10485761, arrayBuffer }, error: null });
  await expect(processImport(deps, importId, userId)).rejects.toMatchObject({ code: "corrupt" });
  expect(arrayBuffer).not.toHaveBeenCalled();
  expect(inserts("sessions")).toHaveLength(0);
});

it("stores a summary and requests a beach when the RPC has no nearby beaches", async () => {
  nearby = [];
  expect(await processImport(deps, importId, userId)).toEqual({ status: "needs_beach", importId, candidates: [] });
  expect(rows.session_imports[0]).toMatchObject({ status: "needs_beach", summary: expect.objectContaining({ gpsCoverage: expect.any(Number) }) });
  expect(inserts("sessions")).toHaveLength(0);
  expect(inserts("session_tracks")).toHaveLength(0);
});

it("uses the explicit beach to finish a needs_beach import", async () => {
  nearby = [];
  rows.session_imports[0].status = "needs_beach";
  expect(await processImport(deps, importId, userId, beach.id)).toMatchObject({ status: "completed" });
  expect(rows.sessions[0].beach_id).toBe(beach.id);
});

it("turns raw Postgrest errors into Error rejections", async () => {
  rpcError = { message: "RPC unavailable", code: "XX000" };
  await expect(processImport(deps, importId, userId)).rejects.toThrow("RPC unavailable");
  expect(inserts("sessions")).toHaveLength(0);
});

it("replaces only this detection version and retires other versions without touching other sessions", async () => {
  rows.session_waves = [
    { id: "same", session_id: "s1", detection_version: WAVE_DETECTION_VERSION, is_current: true },
    { id: "old", session_id: "s1", detection_version: "wd-old", is_current: true },
    { id: "other", session_id: "s2", detection_version: WAVE_DETECTION_VERSION, is_current: true },
  ];
  const track = readTrackFile(bytes, "watch.fit", now);
  const detected = await persistDetection(deps.serviceClient, "s1", userId, track, summarizeTrack(track), beach);
  expect(detected.length).toBeGreaterThan(0);
  expect(rows.session_waves.find(w => w.id === "same")).toBeUndefined();
  expect(rows.session_waves.find(w => w.id === "old")?.is_current).toBe(false);
  expect(rows.session_waves.find(w => w.id === "other")?.is_current).toBe(true);
  expect(rows.session_waves.filter(w => w.session_id === "s1" && w.is_current)).toHaveLength(detected.length);
  expect(inserts("session_tracks")).toHaveLength(0);
});

it("returns duplicate when the same file is uploaded and processed twice", async () => {
  const first = await processImport(deps, importId, userId);
  if (first.status !== "completed") throw new Error("Expected the first import to complete");
  rows.session_imports.push({ id: "second", user_id: userId, storage_path: "second/user-1/watch.fit", original_filename: "watch.fit", status: "uploaded" });
  expect(await processImport(deps, "second", userId)).toEqual({ status: "duplicate", sessionId: first.sessionId });
  expect(inserts("sessions")).toHaveLength(1);
  expect(inserts("session_tracks")).toHaveLength(1);
});

it("resumes its own live session without a track even after its timing was edited", async () => {
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  Object.assign(rows.session_imports[0], { status: "completed", sha256, session_id: "edited-session" });
  rows.sessions.push({ id: "edited-session", user_id: userId, arrival_time: "2020-01-01T00:00:00Z", deleted_at: null });
  expect(await processImport(deps, importId, userId)).toMatchObject({ status: "completed", sessionId: "edited-session", attached: false });
  expect(inserts("sessions")).toHaveLength(0);
});


it.each(["other/user-1/watch.fit", "import-1/other/watch.fit", "import-1/user-1-other/watch.fit"])("rejects storage outside this import and owner: %s", async storagePath => {
  rows.session_imports[0].storage_path = storagePath;
  await expect(processImport(deps, importId, userId)).rejects.toThrow("Import not found");
  expect(download).not.toHaveBeenCalled();
  expect(mutations).toHaveLength(0);
});

it.each(["session_waves", "session_tracks"])("resumes its new session after %s insertion fails", async table => {
  let failed = false;
  queryFailure = mutation => {
    if (!failed && mutation.table === table && mutation.operation === "insert") {
      failed = true;
      return { message: "temporary persistence failure" };
    }
    return null;
  };
  await expect(processImport(deps, importId, userId)).rejects.toThrow("temporary persistence failure");
  expect(rows.session_imports[0]).toMatchObject({ session_id: "new-sessions", status: "uploaded" });
  expect(inserts("user_events")).toHaveLength(0);
  expect(await processImport(deps, importId, userId)).toMatchObject({ status: "completed", attached: false, sessionId: "new-sessions" });
  expect(inserts("sessions")).toHaveLength(1);
  expect(rows.session_tracks).toHaveLength(1);
  expect(rows.session_tracks[0]).toMatchObject({ user_arrival_time: null, user_duration_minutes: null });
  expect(rows.session_imports[0].status).toBe("completed");
  expect(rows.user_events.filter(row => row.event_type === "session_created")).toHaveLength(1);
});

it.each(["water_temp", "completed"])("finishes an existing own track after the %s update fails", async point => {
  let failed = false;
  queryFailure = mutation => {
    const matches = point === "water_temp"
      ? mutation.table === "sessions" && mutation.payload?.water_temp !== undefined
      : mutation.table === "session_imports" && mutation.payload?.status === "completed";
    if (!failed && mutation.operation === "update" && matches) {
      failed = true;
      return { message: "temporary finalization failure" };
    }
    return null;
  };
  await expect(processImport(deps, importId, userId)).rejects.toThrow("temporary finalization failure");
  expect(rows.session_tracks).toHaveLength(1);
  expect(rows.session_imports[0]).toMatchObject({ session_id: "new-sessions", status: "uploaded" });
  const waveIds = rows.session_waves.map(row => row.id);
  expect(await processImport(deps, importId, userId)).toMatchObject({ status: "completed", attached: false, sessionId: "new-sessions" });
  expect(inserts("sessions")).toHaveLength(1);
  expect(inserts("session_tracks")).toHaveLength(1);
  expect(rows.session_waves.map(row => row.id)).toEqual(waveIds);
  expect(rows.session_tracks[0]).toMatchObject({ user_arrival_time: null, user_duration_minutes: null });
  expect(rows.sessions[0]).toMatchObject({ water_temp: expect.any(Number), water_temp_source: "watch" });
  expect(rows.user_events.filter(row => row.event_type === "session_created")).toHaveLength(1);
  expect(await processImport(deps, importId, userId)).toMatchObject({ status: "completed", attached: false });
  expect(rows.user_events.filter(row => row.event_type === "session_created")).toHaveLength(1);
});

it("finishes a track attached to a pre-existing session without emitting session_created", async () => {
  const arrival = summarizeTrack(readTrackFile(bytes, "watch.fit", now)).inWaterStart;
  rows.sessions.push({ id: "attached", user_id: userId, beach_id: beach.id, arrival_time: arrival, duration_minutes: 90, status: "completed" });
  let failed = false;
  queryFailure = mutation => {
    if (!failed && mutation.table === "session_imports" && mutation.payload?.status === "completed") {
      failed = true;
      return { message: "completion failed" };
    }
    return null;
  };
  await expect(processImport(deps, importId, userId)).rejects.toThrow("completion failed");
  expect(await processImport(deps, importId, userId)).toMatchObject({ status: "completed", sessionId: "attached", attached: true });
  expect(rows.session_tracks[0]).toMatchObject({ user_arrival_time: arrival, user_duration_minutes: 90 });
  expect(inserts("session_tracks")).toHaveLength(1);
  expect(inserts("sessions")).toHaveLength(0);
  expect(inserts("user_events")).toHaveLength(0);
});

it.each(["returned", "thrown"])("preserves the no_gps TrackFileError when failure bookkeeping errors are %s", async mode => {
  bytes = fixtureBytes(false);
  const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
  const attempted: string[] = [];
  queryFailure = mutation => {
    if ((mutation.table === "session_imports" && mutation.payload?.status === "failed") || mutation.table === "user_events") {
      attempted.push(mutation.table);
      if (mode === "thrown") throw new Error("bookkeeping failed");
      return { message: "bookkeeping failed" };
    }
    return null;
  };
  try {
    await expect(processImport(deps, importId, userId)).rejects.toMatchObject({ name: "TrackFileError", code: "no_gps" });
    expect(attempted).toEqual(["session_imports", "user_events"]);
    expect(warn).toHaveBeenCalledTimes(2);
    expect(inserts("sessions")).toHaveLength(0);
  } finally {
    warn.mockRestore();
  }
});

it("resolves a concurrent SHA unique violation to the winning live session", async () => {
  let collided = false;
  queryFailure = mutation => {
    if (!collided && mutation.table === "session_imports" && mutation.payload?.sha256) {
      collided = true;
      rows.session_imports.push({ id: "winner", user_id: userId, sha256: mutation.payload.sha256, status: "uploaded", session_id: "winning-session" });
      rows.sessions.push({ id: "winning-session", user_id: userId, deleted_at: null });
      return { code: "23505", message: "duplicate key value violates unique constraint" };
    }
    return null;
  };
  expect(await processImport(deps, importId, userId)).toEqual({ status: "duplicate", sessionId: "winning-session" });
  expect(inserts("sessions")).toHaveLength(0);
  expect(inserts("session_tracks")).toHaveLength(0);
});

it.each(["unlinked", "missing", "deleted"])("returns a null-session duplicate immediately when the SHA winner is %s", async state => {
  let collided = false;
  let winnerReads = 0;
  queryFailure = mutation => {
    if (collided && mutation.table === "session_imports" && mutation.operation === "select") winnerReads += 1;
    if (!collided && mutation.table === "session_imports" && mutation.payload?.sha256) {
      collided = true;
      rows.session_imports.push({
        id: "winner", user_id: userId, sha256: mutation.payload.sha256, status: "uploaded",
        session_id: state === "unlinked" ? null : "winning-session",
      });
      if (state === "deleted") rows.sessions.push({ id: "winning-session", user_id: userId, deleted_at: "2026-10-20T17:00:00Z" });
      return { code: "23505", message: "duplicate key value violates unique constraint" };
    }
    return null;
  };
  expect(await processImport(deps, importId, userId)).toEqual({ status: "duplicate", sessionId: null });
  expect(winnerReads).toBe(1);
  expect(inserts("sessions")).toHaveLength(0);
  expect(inserts("session_tracks")).toHaveLength(0);
  expect(inserts("session_waves")).toHaveLength(0);
});
