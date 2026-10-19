/** @jest-environment node */
jest.mock("server-only", () => ({}));
jest.mock("@/lib/sessions/wave-detection/detect-waves", () => {
  const actual = jest.requireActual("@/lib/sessions/wave-detection/detect-waves");
  return { ...actual, detectWaves: jest.fn(actual.detectWaves) };
});

import { createHash } from "node:crypto";
import { FitBaseType, FitEncoder } from "fit-file-parser";
import type { SupabaseClient } from "@supabase/supabase-js";
import watchFixture from "@/__tests__/fixtures/session-tracks/watch-ob-2026-10-17.json";
import { encodeWatchTrack } from "@/test-utils/session-tracks/watch-encode";
import type { NormalizedTrack } from "@/lib/sessions/tracks/types";
import fixture from "@/__tests__/fixtures/session-tracks/ob-2026-10-17.json";
import { processImport, persistDetection } from "@/lib/sessions/imports/process-import";
import { readTrackFile } from "@/lib/sessions/tracks/read-track-file";
import { haversineM } from "@/lib/sessions/tracks/track-geometry";
import { summarizeTrack } from "@/lib/sessions/tracks/summarize-track";
import { detectWaves, WAVE_DETECTION_VERSION } from "@/lib/sessions/wave-detection/detect-waves";

const userId = "user-1";
const importId = "import-1";
const now = new Date("2026-10-20T18:00:00Z");
const beach = { id: "beach-1", name: "OB", ...fixture.beach };

function fixtureBytes(gps = true, withHr = false): Uint8Array {
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
      ...(withHr && sample.hr !== null ? [{ number: 3, size: 1, baseType: FitBaseType.Uint8, value: sample.hr }] : []),
      ...(sample.tempC === null ? [] : [{ number: 13, size: 1, baseType: FitBaseType.Sint8, value: sample.tempC }]),
    ]);
  }
  return encoder.close();
}

type Row = Record<string, any>;
type Mutation = { client: string; table: string; operation: string; payload: any };
let rows: Record<string, Row[]>;
let mutations: Mutation[];
let sessionInsertCount: number;
let bytes: Uint8Array;
let nearby: Row[];
let rpcError: unknown;
let download: jest.Mock;
let remove: jest.Mock;
let selections: Array<{ table: string; columns: string | undefined }>;
let accesses: Array<{ table: string; operation: string; equalities: [string, unknown][]; owners: unknown[] }>;
let queryFailure: (mutation: Mutation) => unknown;

function client(name: string): SupabaseClient {
  return {
    storage: { from: jest.fn((bucket: string) => {
      expect(bucket).toBe("session-tracks");
      return { download, remove };
    }) },
    rpc: jest.fn(async () => ({ data: nearby, error: rpcError })),
    from: (table: string) => {
      let operation = "select";
      let payload: Row | Row[];
      const filters: ((row: Row) => boolean)[] = [];
      const equalities: [string, unknown][] = [];
      let single = false;
      const query: any = {
        select: (columns?: string) => { selections.push({ table, columns }); return query; },
        limit: () => query,
        order: () => query,
        insert: (value: Row | Row[]) => { operation = "insert"; payload = value; return query; },
        update: (value: Row) => { operation = "update"; payload = value; return query; },
        delete: () => { operation = "delete"; return query; },
        eq: (key: string, value: unknown) => { equalities.push([key, value]); filters.push(row => row[key] === value); return query; },
        neq: (key: string, value: unknown) => { filters.push(row => row[key] !== value); return query; },
        is: (key: string, value: unknown) => { filters.push(row => (row[key] ?? null) === value); return query; },
        gte: (key: string, value: string) => { filters.push(row => row[key] >= value); return query; },
        lte: (key: string, value: string) => { filters.push(row => row[key] <= value); return query; },
        in: (key: string, values: unknown[]) => { filters.push(row => values.includes(row[key])); return query; },
        or: (expression: string) => {
          const clauses = expression.split(",").map(clause => {
            const [key, operator, value] = clause.split(".");
            if (operator === "is" && value === "null") return (row: Row) => (row[key] ?? null) === null;
            if (operator === "eq") return (row: Row) => row[key] === value;
            throw new Error(`Unsupported or clause: ${clause}`);
          });
          filters.push(row => clauses.some(clause => clause(row)));
          return query;
        },
        single: () => { single = true; return query; },
        maybeSingle: () => { single = true; return query; },
        then: (resolve: (value: unknown) => unknown) => {
          const failure = queryFailure({ client: name, table, operation, payload });
          if (failure) return Promise.resolve({ data: null, error: failure }).then(resolve);
          rows[table] ??= [];
          let matched = rows[table].filter(row => filters.every(filter => filter(row)));
          accesses.push({ table, operation, equalities: [...equalities], owners: operation === "insert" ? [] : matched.map(row => row.user_id) });
          if (operation !== "select") mutations.push({ client: name, table, operation, payload });
          if (operation === "insert") {
            matched = (Array.isArray(payload) ? payload : [payload]).map(row => ({ id: table === "sessions" && sessionInsertCount++ > 0 ? `new-sessions-${sessionInsertCount}` : `new-${table}`, ...row }));
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
  sessionInsertCount = 0;
  selections = [];
  accesses = [];
  remove = jest.fn(async () => ({ data: [], error: null }));
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


it.each(["session_waves", "session_tracks", "session_timing", "completed"])("preserves the original attach timing across a %s failure and retry", async (point) => {
  const summary = summarizeTrack(readTrackFile(bytes, "watch.fit", now));
  const arrival = new Date(Date.parse(summary.inWaterStart) - 3600000).toISOString();
  rows.sessions.push({ id: "attached", user_id: userId, beach_id: beach.id, arrival_time: arrival, duration_minutes: 90, status: "planned" });
  let failed = false;
  queryFailure = mutation => {
    const matches = point === "session_timing"
      ? mutation.table === "sessions" && mutation.operation === "update" && mutation.payload?.arrival_time !== undefined
      : point === "completed"
        ? mutation.table === "session_imports" && mutation.payload?.status === "completed"
        : mutation.table === point && mutation.operation === "insert";
    if (!failed && matches) { failed = true; return { message: "retry attach" }; }
    return null;
  };
  await expect(processImport(deps, importId, userId)).rejects.toThrow("retry attach");
  if (point === "session_timing") {
    expect(rows.session_tracks).toHaveLength(1);
    expect(rows.sessions[0]).toMatchObject({ arrival_time: arrival, duration_minutes: 90, status: "planned" });
  }
  expect(await processImport(deps, importId, userId)).toMatchObject({ status: "completed", attached: true, sessionId: "attached" });
  expect(rows.session_tracks).toHaveLength(1);
  expect(rows.session_tracks[0]).toMatchObject({ import_id: importId, user_arrival_time: arrival, user_duration_minutes: 90 });
  expect(rows.sessions[0]).toMatchObject({ arrival_time: summary.inWaterStart, status: "completed" });
  expect(inserts("user_events")).toHaveLength(0);
  const insertIndex = mutations.findIndex(mutation => mutation.table === "session_tracks" && mutation.operation === "insert");
  const timingIndex = mutations.findIndex(mutation => mutation.table === "sessions" && mutation.payload?.arrival_time !== undefined);
  expect(insertIndex).toBeLessThan(timingIndex);
});

it.each(["session_waves", "session_tracks"])("adopts the prior file-import orphan on a fresh web retry after %s failure", async (point) => {
  let failed = false;
  queryFailure = mutation => {
    if (!failed && mutation.table === point && mutation.operation === "insert") {
      failed = true;
      return { message: "web attempt failed" };
    }
    return null;
  };
  await expect(processImport(deps, importId, userId)).rejects.toThrow("web attempt failed");
  const orphanId = rows.session_imports[0].session_id;
  rows.session_imports.push({ id: "retry", user_id: userId, storage_path: "retry/user-1/watch.fit", original_filename: "watch.fit", status: "uploaded" });
  expect(await processImport(deps, "retry", userId)).toMatchObject({ status: "completed", sessionId: orphanId, attached: false });
  expect(rows.session_imports[0]).toMatchObject({ sha256: null, session_id: orphanId });
  expect(rows.session_imports[1]).toMatchObject({ sha256: createHash("sha256").update(bytes).digest("hex"), session_id: orphanId });
  expect(inserts("sessions")).toHaveLength(1);
  expect(rows.session_tracks).toHaveLength(1);
  expect(rows.session_tracks[0]).toMatchObject({ import_id: "retry", user_arrival_time: null, user_duration_minutes: null });
  expect(rows.user_events.filter(row => row.event_type === "session_created")).toHaveLength(1);
  expect(await processImport(deps, "retry", userId)).toMatchObject({ status: "completed", attached: false });
  expect(rows.user_events.filter(row => row.event_type === "session_created")).toHaveLength(1);
});

it.each(["attach target", "completed SHA", "SHA collision"])("marks the duplicate failed and removes its unreferenced object: %s", async (path) => {
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  if (path === "attach target") {
    rows.sessions.push({ id: "winner", user_id: userId, beach_id: beach.id, arrival_time: summarizeTrack(readTrackFile(bytes, "watch.fit", now)).inWaterStart });
    rows.session_tracks.push({ session_id: "winner", import_id: "winning-import", storage_path: "winner/user-1/watch.fit" });
  } else if (path === "completed SHA") {
    rows.sessions.push({ id: "winner", user_id: userId, arrival_time: "2020-01-01T00:00:00Z" });
    rows.session_imports.push({ id: "winning-import", user_id: userId, sha256, status: "completed", session_id: "winner" });
  } else {
    let collided = false;
    queryFailure = mutation => {
      if (!collided && mutation.table === "session_imports" && mutation.payload?.sha256) {
        collided = true;
        rows.session_imports.push({ id: "winning-import", user_id: userId, sha256, status: "uploaded", session_id: null });
        return { code: "23505", message: "sha claimed" };
      }
      return null;
    };
  }
  expect(await processImport(deps, importId, userId)).toEqual({ status: "duplicate", sessionId: path === "SHA collision" ? null : "winner" });
  expect(rows.session_imports[0]).toMatchObject({ status: "failed", error: "duplicate" });
  expect(remove).toHaveBeenCalledWith(["import-1/user-1/watch.fit"]);
  expect(inserts("sessions")).toHaveLength(0);
});

it("keeps a duplicate object referenced by a track", async () => {
  rows.sessions.push({ id: "winner", user_id: userId, beach_id: beach.id, arrival_time: summarizeTrack(readTrackFile(bytes, "watch.fit", now)).inWaterStart });
  rows.session_tracks.push({ session_id: "winner", import_id: "winning-import", storage_path: "import-1/user-1/watch.fit" });
  expect(await processImport(deps, importId, userId)).toEqual({ status: "duplicate", sessionId: "winner" });
  expect(rows.session_imports[0]).toMatchObject({ status: "failed", error: "duplicate" });
  expect(remove).not.toHaveBeenCalled();
});

it.each(["returned", "thrown", "reference lookup"])("preserves the duplicate result on cleanup failure: %s", async (point) => {
  rows.sessions.push({ id: "winner", user_id: userId, beach_id: beach.id, arrival_time: summarizeTrack(readTrackFile(bytes, "watch.fit", now)).inWaterStart });
  rows.session_tracks.push({ session_id: "winner", import_id: "winning-import" });
  if (point === "returned") remove.mockResolvedValue({ data: null, error: { message: "storage down" } });
  else if (point === "thrown") remove.mockRejectedValue(new Error("storage down"));
  else queryFailure = mutation => mutation.client === "service" && mutation.table === "session_tracks" ? { message: "reference lookup failed" } : null;
  const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
  try {
    expect(await processImport(deps, importId, userId)).toEqual({ status: "duplicate", sessionId: "winner" });
    expect(rows.session_imports[0]).toMatchObject({ status: "failed", error: "duplicate" });
    expect(warn).toHaveBeenCalledWith(expect.any(String), expect.anything());
    if (point === "reference lookup") expect(remove).not.toHaveBeenCalled();
  } finally { warn.mockRestore(); }
});

it("loads only the track fields needed to resume an import", async () => {
  await processImport(deps, importId, userId);
  selections = [];
  await processImport(deps, importId, userId);
  expect(selections.filter(query => query.table === "session_tracks").map(query => query.columns)).toEqual([
    "session_id, import_id, user_arrival_time, user_duration_minutes, user_wave_count",
  ]);
});


function useWatch(track?: NormalizedTrack, rating: number | null = 3, waveHeightFt?: number | null): NormalizedTrack {
  const file = track ? encodeWatchTrack(track) : structuredClone(watchFixture);
  file.header.rating = rating;
  if (waveHeightFt !== undefined) Object.assign(file.header, { waveHeightFt });
  bytes = new TextEncoder().encode(JSON.stringify(file));
  Object.assign(rows.session_imports[0], { origin: "garmin_watch", original_filename: "watch.json" });
  return readTrackFile(bytes, "watch.json", now);
}

it("stores the watch observation on a new session", async () => {
  useWatch(undefined, 3, 3.5);
  expect(await processImport(deps, importId, userId)).toMatchObject({ status: "completed" });
  expect(rows.sessions[0].wave_height_ft).toBe(3.5);
});

it("links a recent exposed call for a new watch session", async () => {
  const track = useWatch(undefined, 3, 3.5);
  const arrivalTime = summarizeTrack(track).inWaterStart;
  rows.user_events = [{ user_id: userId, beach_id: beach.id, event_type: "board_pick_exposed",
    created_at: new Date(Date.parse(arrivalTime) - 3600000).toISOString(),
    metadata: { is_personal: true, call_id: "call-1", forecast_at: arrivalTime } }];
  expect(await processImport(deps, importId, userId)).toMatchObject({ status: "completed" });
  expect(rows.sessions[0].call_id).toBe("call-1");
});

it("links a recent exposed call when a watch surf attaches", async () => {
  const track = useWatch();
  const arrivalTime = summarizeTrack(track).inWaterStart;
  rows.sessions.push({ id: "attached", user_id: userId, beach_id: beach.id,
    arrival_time: arrivalTime, duration_minutes: 90, status: "completed", call_id: null });
  rows.user_events = [{ user_id: userId, beach_id: beach.id, event_type: "board_pick_exposed",
    created_at: new Date(Date.parse(arrivalTime) - 3600000).toISOString(),
    metadata: { is_personal: true, call_id: "call-2", selected_forecast_at: arrivalTime } }];
  expect(await processImport(deps, importId, userId)).toMatchObject({ status: "completed", attached: true });
  expect(rows.sessions[0].call_id).toBe("call-2");
});

it.each([false, true])("uses the existing session's beach for a watch call link (resuming: %s)", async resuming => {
  const track = useWatch();
  const arrivalTime = summarizeTrack(track).inWaterStart;
  const sessionBeachId = "session-beach";
  rows.sessions.push({ id: "attached", user_id: userId, beach_id: sessionBeachId,
    beaches: { lat: beach.lat, lon: beach.lon },
    arrival_time: arrivalTime, duration_minutes: 90, status: "completed", call_id: null });
  rows.beaches.push({ ...rows.beaches[0], id: sessionBeachId });
  if (resuming) rows.session_imports[0].session_id = "attached";
  rows.user_events = [beach.id, sessionBeachId].map(beachId => ({
    user_id: userId, beach_id: beachId, event_type: "board_pick_exposed",
    created_at: new Date(Date.parse(arrivalTime) - 3600000).toISOString(),
    metadata: { is_personal: true, call_id: `call-${beachId}`, forecast_at: arrivalTime },
  }));
  expect(await processImport(deps, importId, userId)).toMatchObject({ status: "completed", sessionId: "attached" });
  expect(rows.sessions[0].call_id).toBe(`call-${sessionBeachId}`);
  expect(selections).toContainEqual({ table: "sessions", columns: "id, beach_id, arrival_time, duration_minutes, status" });
});

it("skips the wave-height write and call link for a file import", async () => {
  const track = readTrackFile(bytes, "watch.fit", now);
  const arrivalTime = summarizeTrack(track).inWaterStart;
  rows.sessions.push({ id: "attached", user_id: userId, beach_id: beach.id,
    arrival_time: arrivalTime, duration_minutes: 90, status: "completed", wave_height_ft: null, call_id: null });
  rows.user_events = [{ user_id: userId, beach_id: beach.id, event_type: "board_pick_exposed",
    created_at: new Date(Date.parse(arrivalTime) - 3600000).toISOString(),
    metadata: { is_personal: true, call_id: "file-call", forecast_at: arrivalTime } }];
  expect(await processImport(deps, importId, userId)).toMatchObject({ status: "completed", attached: true });
  expect(rows.sessions[0]).toMatchObject({ wave_height_ft: null, call_id: null });
  expect(mutations.filter(mutation => mutation.table === "sessions" && mutation.payload.wave_height_ft !== undefined)).toHaveLength(0);
  expect(accesses.filter(access => access.table === "user_events" && access.operation === "select")).toHaveLength(0);
});

it("completes a watch import when recent-call lookup fails", async () => {
  useWatch();
  queryFailure = mutation => mutation.table === "user_events" && mutation.operation === "select"
    ? { message: "lookup failed" } : null;
  const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
  try {
    expect(await processImport(deps, importId, userId)).toMatchObject({ status: "completed" });
    expect(rows.session_imports[0].status).toBe("completed");
    expect(warn).toHaveBeenCalledWith("[session_import] failed to link recent call:", expect.anything());
  } finally { warn.mockRestore(); }
});

it.each([
  { existing: null, source: null, expected: { wave_height_ft: 3.5, wave_height_source: "user" } },
  { existing: 4, source: "forecast_prefill", expected: { wave_height_ft: 3.5, wave_height_source: "user" } },
  // A chip midpoint equal to the prefill still becomes the surfer's own height.
  { existing: 3.5, source: "forecast_prefill", expected: { wave_height_ft: 3.5, wave_height_source: "user" } },
  { existing: 7, source: "user", expected: { wave_height_ft: 7, wave_height_source: "user" } },
  { existing: 7, source: null, expected: { wave_height_ft: 7, wave_height_source: null } },
])("writes the attached wave height only over an empty or forecast-prefilled one ($existing, $source)", async ({ existing, source, expected }) => {
  const track = useWatch(undefined, 3, 3.5);
  rows.sessions.push({ id: "attached", user_id: userId, beach_id: beach.id,
    arrival_time: summarizeTrack(track).inWaterStart, duration_minutes: 90,
    status: "completed", wave_height_ft: existing, wave_height_source: source });
  expect(await processImport(deps, importId, userId)).toMatchObject({ status: "completed", attached: true });
  expect(rows.sessions[0]).toMatchObject(expected);
  const sizeUpdates = mutations.filter(mutation => mutation.table === "sessions" && mutation.operation === "update"
    && mutation.payload.wave_height_ft !== undefined);
  expect(sizeUpdates).toHaveLength(1);
  expect(sizeUpdates[0].payload).toEqual({ wave_height_ft: 3.5, wave_height_source: "user" });
});

it("leaves wave_height_source unset on a new watch session", async () => {
  useWatch(undefined, 3, 3.5);
  expect(await processImport(deps, importId, userId)).toMatchObject({ status: "completed", attached: false });
  expect(inserts("sessions")[0].payload).not.toHaveProperty("wave_height_source");
});

function watchSlice(seconds: number): NormalizedTrack {
  const track = readTrackFile(new TextEncoder().encode(JSON.stringify(watchFixture)), "watch.json", now);
  const start = Date.parse("2026-10-17T16:20:00Z");
  const samples = track.samples.filter(sample => Date.parse(sample.t) >= start && Date.parse(sample.t) <= start + seconds * 1000);
  return { ...track, samples, meta: { ...track.meta, startedAt: samples[0].t, endedAt: samples.at(-1)!.t } };
}

it("creates a public Garmin watch session with rating, stats, device and watch analytics", async () => {
  const track = useWatch();
  deps.userClient = deps.serviceClient;
  const summary = summarizeTrack(track);
  const hr = track.samples.filter(sample => sample.t >= summary.inWaterStart && sample.t <= summary.inWaterEnd && sample.hr !== null).map(sample => sample.hr!);
  expect(await processImport(deps, importId, userId)).toMatchObject({ status: "completed", attached: false });
  expect(rows.sessions[0]).toMatchObject({ source: "garmin_watch", is_public: true, rating: 3, status: "completed" });
  expect(rows.session_tracks[0]).toMatchObject({
    format: "quiver_watch", source_device: "Forerunner 165",
    hr_avg: Math.round(hr.reduce((sum, value) => sum + value, 0) / hr.length), hr_max: Math.max(...hr),
  });
  expect(rows.session_tracks[0].paddle_distance_m).toBeGreaterThan(0);
  expect(rows.user_events).toContainEqual(expect.objectContaining({ event_type: "session_created", metadata: expect.objectContaining({ source: "garmin-watch", surface: "garmin-watch" }) }));
  const sessionIndex = mutations.findIndex(mutation => mutation.table === "sessions" && mutation.operation === "insert");
  const waveIndex = mutations.findIndex(mutation => mutation.table === "session_waves" && mutation.operation === "insert");
  expect(sessionIndex).toBeLessThan(waveIndex);
});

it("keeps a seven-minute fixture slice with no counted waves private", async () => {
  const track = useWatch(watchSlice(420));
  const summary = summarizeTrack(track);
  const spanS = (Date.parse(summary.inWaterEnd) - Date.parse(summary.inWaterStart)) / 1000;
  expect(spanS).toBeGreaterThanOrEqual(300);
  expect(spanS).toBeLessThan(600);
  expect(await processImport(deps, importId, userId)).toMatchObject({ status: "completed", summary: { waveCount: 0 } });
  expect(rows.sessions[0]).toMatchObject({ source: "garmin_watch", is_public: false });
});

it("fails a four-minute Garmin slice as too_short before persisting a session", async () => {
  useWatch(watchSlice(240));
  await expect(processImport(deps, importId, userId)).rejects.toMatchObject({ code: "too_short" });
  expect(rows.session_imports[0]).toMatchObject({ status: "failed", error: "too_short" });
  expect(inserts("sessions")).toHaveLength(0);
  expect(inserts("session_tracks")).toHaveLength(0);
  expect(inserts("session_waves")).toHaveLength(0);
  expect(rows.user_events).toContainEqual(expect.objectContaining({ event_type: "session_import_failed", metadata: { code: "too_short" } }));
});

it("preserves file-import behavior for a four-minute GPX track", async () => {
  const track = watchSlice(240);
  const points = track.samples.filter(sample => sample.lat !== null && sample.lon !== null)
    .map(sample => `<trkpt lat="${sample.lat}" lon="${sample.lon}"><time>${sample.t}</time></trkpt>`).join("");
  bytes = new TextEncoder().encode(`<gpx><trk><trkseg>${points}</trkseg></trk></gpx>`);
  rows.session_imports[0].origin = "file";
  rows.session_imports[0].original_filename = "short.gpx";
  expect(await processImport(deps, importId, userId)).toMatchObject({ status: "completed" });
  expect(rows.session_imports[0]).toMatchObject({ status: "completed", error: null });
  expect(inserts("sessions")).toHaveLength(1);
  expect(inserts("sessions")[0]).toMatchObject({ payload: { source: "file_import" } });
  expect(inserts("session_tracks")).toHaveLength(1);
});

it.each([null, 5])("fills only a null attachment rating and preserves source and visibility (rating %s)", async rating => {
  const track = useWatch();
  rows.sessions.push({ id: "attached", user_id: userId, beach_id: beach.id, arrival_time: summarizeTrack(track).inWaterStart, duration_minutes: 90, status: "planned", rating, source: "manual", is_public: false });
  expect(await processImport(deps, importId, userId)).toMatchObject({ status: "completed", attached: true });
  expect(rows.sessions[0]).toMatchObject({ rating: rating ?? 3, source: "manual", is_public: false, status: "completed" });
  expect(inserts("sessions")).toHaveLength(0);
  expect(inserts("user_events")).toHaveLength(0);
});

it("rejects a watch-format track uploaded through a file import before creating a session", async () => {
  useWatch();
  rows.session_imports[0].origin = "file";
  rows.session_imports[0].original_filename = "spoofed.fit";
  await expect(processImport(deps, importId, userId)).rejects.toMatchObject({ code: "unsupported_format" });
  expect(rows.session_imports[0]).toMatchObject({ status: "failed", error: "unsupported_format" });
  expect(inserts("sessions")).toHaveLength(0);
  expect(inserts("session_tracks")).toHaveLength(0);
  expect(inserts("session_waves")).toHaveLength(0);
});

it("stores null HR and source device for a file import without HR", async () => {
  rows.session_imports[0].origin = "file";
  await processImport(deps, importId, userId);
  expect(rows.session_tracks[0]).toMatchObject({ hr_avg: null, hr_max: null, source_device: null });
  expect(rows.session_tracks[0].paddle_distance_m).toBeGreaterThan(0);
});


function boundaryTrack(seconds: number, direction: number = 1): NormalizedTrack {
  const start = Date.parse("2026-10-17T16:20:00Z");
  const samples = Array.from({ length: seconds + 1 }, (_, index) => ({
    t: new Date(start + index * 1000).toISOString(), lat: beach.lat,
    lon: beach.lon + direction * Math.max(0, Math.min(10, index - 20)) * 0.00001,
    speedMps: index >= 20 && index <= 30 ? 4 : 0, hr: null, tempC: null, cadence: null,
  }));
  return { meta: { format: "quiver_watch", sport: "surfing", subSport: null, recordedBy: null, startedAt: samples[0].t, endedAt: samples.at(-1)!.t }, samples };
}

it.each([300, 599, 600])("accepts a %s s in-water span and publishes only at 600 s with a counted wave", async seconds => {
  const track = useWatch(boundaryTrack(seconds), null);
  const summary = summarizeTrack(track);
  expect((Date.parse(summary.inWaterEnd) - Date.parse(summary.inWaterStart)) / 1000).toBe(seconds);
  expect(await processImport(deps, importId, userId)).toMatchObject({ status: "completed", summary: { waveCount: 1 } });
  expect(rows.sessions[0]).toMatchObject({ is_public: seconds >= 600, rating: null });
});

it("does not publish or exclude paddling for low-confidence waves even in a ten-minute surf", async () => {
  const track = useWatch(boundaryTrack(600, -1));
  expect(await processImport(deps, importId, userId)).toMatchObject({ status: "completed", summary: { waveCount: 0 } });
  expect(rows.session_waves.length).toBeGreaterThan(0);
  expect(rows.sessions[0]).toMatchObject({ is_public: false });
  const allDistance = track.samples.slice(1).reduce((sum, sample, index) => sum + haversineM(
    { lat: track.samples[index].lat!, lon: track.samples[index].lon! }, { lat: sample.lat!, lon: sample.lon! },
  ), 0);
  expect(rows.session_tracks[0].paddle_distance_m).toBeCloseTo(allDistance, 5);
});

it("stores HR from FIT file imports", async () => {
  bytes = fixtureBytes(true, true);
  rows.session_imports[0].origin = "file";
  await processImport(deps, importId, userId);
  expect(rows.session_tracks[0]).toMatchObject({ hr_avg: expect.any(Number), hr_max: expect.any(Number), source_device: null });
  expect(rows.session_tracks[0].hr_avg).toBeGreaterThan(0);
  expect(rows.session_tracks[0].hr_max).toBeGreaterThanOrEqual(rows.session_tracks[0].hr_avg);
});

it("preserves a rating written concurrently while attaching a watch import", async () => {
  const track = useWatch();
  rows.sessions.push({ id: "attached", user_id: userId, beach_id: beach.id, arrival_time: summarizeTrack(track).inWaterStart, duration_minutes: 90, status: "completed", rating: null });
  let attemptedRating = false;
  queryFailure = mutation => {
    if (mutation.table === "sessions" && mutation.operation === "update" && mutation.payload?.rating !== undefined) {
      attemptedRating = true;
      rows.sessions[0].rating = 5;
    }
    return null;
  };
  await processImport(deps, importId, userId);
  expect(attemptedRating).toBe(true);
  expect(rows.sessions[0].rating).toBe(5);
});


it("rejects a FIT track uploaded through a watch import before creating a session", async () => {
  rows.session_imports[0].origin = "garmin_watch";
  rows.session_imports[0].original_filename = "watch.json";
  await expect(processImport(deps, importId, userId)).rejects.toMatchObject({ code: "unsupported_format" });
  expect(rows.session_imports[0]).toMatchObject({ status: "failed", error: "unsupported_format" });
  expect(inserts("sessions")).toHaveLength(0);
  expect(inserts("session_tracks")).toHaveLength(0);
  expect(inserts("session_waves")).toHaveLength(0);
});

it("keeps both sessions and tracks for different watch surfs at the same beach 60 minutes apart", async () => {
  const firstTrack = useWatch(boundaryTrack(600));
  const first = await processImport(deps, importId, userId);
  expect(first).toMatchObject({ status: "completed", attached: false });
  if (first.status !== "completed") throw new Error("Expected the first watch surf to complete");
  const later = (value: string): string => new Date(Date.parse(value) + 60 * 60 * 1000).toISOString();
  useWatch({
    ...firstTrack,
    meta: { ...firstTrack.meta, startedAt: later(firstTrack.meta.startedAt), endedAt: later(firstTrack.meta.endedAt) },
    samples: firstTrack.samples.map(sample => ({ ...sample, t: later(sample.t) })),
  });
  rows.session_imports.push({ id: "split", user_id: userId, origin: "garmin_watch", storage_path: "split/user-1/watch.json", original_filename: "watch.json", status: "uploaded" });
  const second = await processImport(deps, "split", userId);
  expect(second).toMatchObject({ status: "completed", attached: false });
  if (second.status !== "completed") throw new Error("Expected the second watch surf to complete");
  expect(second.sessionId).not.toBe(first.sessionId);
  expect(rows.sessions).toHaveLength(2);
  expect(rows.session_tracks).toHaveLength(2);
  expect(rows.session_tracks).toEqual(expect.arrayContaining([
    expect.objectContaining({ session_id: first.sessionId, import_id: importId, storage_path: "import-1/user-1/watch.fit" }),
    expect.objectContaining({ session_id: second.sessionId, import_id: "split", storage_path: "split/user-1/watch.json" }),
  ]));
  expect(rows.session_imports.map(row => row.status)).toEqual(["completed", "completed"]);
  expect(rows.user_events.filter(row => row.event_type === "session_created")).toHaveLength(2);
  expect(remove).not.toHaveBeenCalled();
});

it("still rejects identical watch bytes as a SHA duplicate", async () => {
  useWatch(boundaryTrack(600));
  const first = await processImport(deps, importId, userId);
  if (first.status !== "completed") throw new Error("Expected the first watch surf to complete");
  rows.session_imports.push({ id: "duplicate", user_id: userId, origin: "garmin_watch", storage_path: "duplicate/user-1/watch.json", original_filename: "watch.json", status: "uploaded" });
  expect(await processImport(deps, "duplicate", userId)).toEqual({ status: "duplicate", sessionId: first.sessionId });
  expect(rows.sessions).toHaveLength(1);
  expect(rows.session_tracks).toHaveLength(1);
  expect(remove).toHaveBeenCalledWith(["duplicate/user-1/watch.json"]);
});

it.each(["session_waves", "session_tracks"])("adopts a watch orphan on a fresh retry after %s failure", async table => {
  useWatch(boundaryTrack(600));
  let failed = false;
  queryFailure = mutation => {
    if (!failed && mutation.table === table && mutation.operation === "insert") {
      failed = true;
      return { message: "watch persistence failed" };
    }
    return null;
  };
  await expect(processImport(deps, importId, userId)).rejects.toThrow("watch persistence failed");
  const orphanId = rows.session_imports[0].session_id;
  rows.sessions[0].arrival_time = "2020-01-01T00:00:00Z";
  rows.session_imports.push({ id: "retry", user_id: userId, origin: "garmin_watch", storage_path: "retry/user-1/watch.json", original_filename: "watch.json", status: "uploaded" });
  expect(await processImport(deps, "retry", userId)).toMatchObject({ status: "completed", sessionId: orphanId, attached: false });
  expect(rows.sessions).toHaveLength(1);
  expect(rows.session_tracks).toHaveLength(1);
  expect(rows.session_tracks[0]).toMatchObject({ session_id: orphanId, import_id: "retry", user_arrival_time: null, user_duration_minutes: null });
  expect(rows.session_imports[0]).toMatchObject({ sha256: null, session_id: orphanId });
  expect(rows.user_events.filter(row => row.event_type === "session_created")).toHaveLength(1);
  expect(await processImport(deps, "retry", userId)).toMatchObject({ status: "completed", sessionId: orphanId, attached: false });
  expect(rows.user_events.filter(row => row.event_type === "session_created")).toHaveLength(1);
});

it.each([false, true])("persists a supplied wave list without recomputing it (empty: %s)", async empty => {
  const track = readTrackFile(bytes, "watch.fit", now);
  const summary = summarizeTrack(track);
  const precomputed = empty ? [] : detectWaves(track, summary, beach).slice(0, 1);
  const callsBefore = jest.mocked(detectWaves).mock.calls.length;
  expect(await persistDetection(deps.serviceClient, "s1", userId, track, summary, beach, precomputed)).toBe(precomputed);
  expect(jest.mocked(detectWaves).mock.calls).toHaveLength(callsBefore);
  expect(rows.session_waves).toHaveLength(precomputed.length);
  expect(rows.session_waves.map(wave => wave.started_at)).toEqual(precomputed.map(wave => wave.startedAt));
});

it("uses one detection for watch visibility, persistence and the returned wave count", async () => {
  useWatch(boundaryTrack(600));
  const callsBefore = jest.mocked(detectWaves).mock.calls.length;
  const result = await processImport(deps, importId, userId);
  expect(jest.mocked(detectWaves).mock.calls).toHaveLength(callsBefore + 1);
  expect(result).toMatchObject({ status: "completed", summary: { waveCount: 1 } });
  expect(rows.sessions[0].is_public).toBe(true);
  expect(rows.session_waves).toHaveLength(1);
});


it("isolates a watch import from another user's matching SHA, attach candidate, track and waves with one service client", async () => {
  const track = useWatch();
  deps.userClient = deps.serviceClient;
  const otherUserId = "user-2";
  const otherSessionId = "user-2-session";
  const otherImportId = "user-2-import";
  rows.sessions.push({
    id: otherSessionId, user_id: otherUserId, beach_id: beach.id,
    arrival_time: summarizeTrack(track).inWaterStart, duration_minutes: 90,
    source: "garmin_watch", status: "completed", rating: 5, water_temp: 65,
  });
  rows.session_imports.push({
    id: otherImportId, user_id: otherUserId, origin: "garmin_watch", status: "completed",
    session_id: otherSessionId, sha256: createHash("sha256").update(bytes).digest("hex"),
    storage_path: `${otherImportId}/${otherUserId}/watch.json`, original_filename: "watch.json",
  });
  rows.session_tracks.push({ id: "user-2-track", user_id: otherUserId, session_id: otherSessionId, import_id: otherImportId });
  rows.session_waves.push(
    { id: "user-2-wave-current", user_id: otherUserId, session_id: otherSessionId, detection_version: WAVE_DETECTION_VERSION, is_current: true },
    { id: "user-2-wave-old", user_id: otherUserId, session_id: otherSessionId, detection_version: "previous-version", is_current: true },
  );
  const ownedTables = ["sessions", "session_imports", "session_tracks", "session_waves"];
  const otherRowsBefore = ownedTables.map(table => structuredClone(rows[table].filter(row => row.user_id === otherUserId)));

  expect(deps.userClient).toBe(deps.serviceClient);
  const result = await processImport(deps, importId, userId);
  expect(result).toMatchObject({ status: "completed", attached: false, sessionId: "new-sessions" });
  expect(inserts("sessions")).toHaveLength(1);
  expect(inserts("sessions")[0]).toMatchObject({ client: "service", payload: { user_id: userId, source: "garmin_watch" } });
  expect(rows.session_imports[0]).toMatchObject({ status: "completed", session_id: "new-sessions" });
  expect(rows.session_tracks.filter(row => row.user_id === userId)).toEqual([
    expect.objectContaining({ session_id: "new-sessions", import_id: importId }),
  ]);
  expect(rows.session_waves.filter(row => row.user_id === userId).length).toBeGreaterThan(0);
  expect(ownedTables.map(table => rows[table].filter(row => row.user_id === otherUserId))).toEqual(otherRowsBefore);
  const privateAccesses = accesses.filter(access => ownedTables.includes(access.table));
  expect(privateAccesses.length).toBeGreaterThan(0);
  for (const access of privateAccesses) {
    expect(access.owners).not.toContain(otherUserId);
    expect(access.equalities.map(([, value]) => value)).not.toEqual(expect.arrayContaining([otherSessionId]));
    expect(access.equalities.map(([, value]) => value)).not.toEqual(expect.arrayContaining([otherImportId]));
    expect(access.equalities).not.toContainEqual(["user_id", otherUserId]);
  }
  for (const mutation of mutations.filter(value => ownedTables.includes(value.table) && value.operation === "insert")) {
    const inserted = Array.isArray(mutation.payload) ? mutation.payload : [mutation.payload];
    expect(inserted.every(row => row.user_id === userId && row.session_id !== otherSessionId && row.import_id !== otherImportId)).toBe(true);
  }
});
