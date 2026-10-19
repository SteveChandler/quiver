/** @jest-environment node */
jest.mock("next/server", () => require("@/__tests__/setup/mock-next-server"));
jest.mock("server-only", () => ({}));

const mockUserFrom = jest.fn();
const mockServiceFrom = jest.fn();
const mockAuth = jest.fn();
const mockDownload = jest.fn();
const mockTides = jest.fn();
const mockReadTrackFile = jest.fn();
const mockSummarizeTrack = jest.fn();
const mockLoadBeach = jest.fn();
const mockPersistDetection = jest.fn();

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: () => ({ from: mockUserFrom, auth: { getUser: mockAuth } }),
}));
jest.mock("@/lib/supabase", () => ({
  ...jest.requireActual("@/lib/supabase"),
  createServiceRoleClient: () => ({
    from: mockServiceFrom,
    storage: { from: () => ({ download: mockDownload }) },
  }),
}));
jest.mock("@/lib/middleware/api-wrappers/rate-limit-wrapper", () => ({ withRateLimit: (handler: unknown) => handler }));
jest.mock("@/lib/sessions/waves/wave-tides", () => ({ tideFtAtWaves: (...args: unknown[]) => mockTides(...args) }));
jest.mock("@/lib/sessions/tracks/read-track-file", () => ({ readTrackFile: (...args: unknown[]) => mockReadTrackFile(...args) }));
jest.mock("@/lib/sessions/tracks/summarize-track", () => ({ summarizeTrack: (...args: unknown[]) => mockSummarizeTrack(...args) }));
jest.mock("@/lib/sessions/imports/resolve-import-beach", () => ({ loadImportBeach: (...args: unknown[]) => mockLoadBeach(...args) }));
jest.mock("@/lib/sessions/imports/process-import", () => ({ persistDetection: (...args: unknown[]) => mockPersistDetection(...args) }));

import { NextRequest } from "next/server";
import { GET, PATCH as patchCount } from "@/app/api/v1/sessions/[id]/waves/route";
import { PATCH as patchWave } from "@/app/api/v1/sessions/[id]/waves/[waveId]/route";
import { POST as redetect } from "@/app/api/v1/sessions/[id]/redetect/route";

const userId = "987fcdeb-51a2-43c1-a123-456789abcdef";
const sessionId = "123e4567-e89b-42d3-a456-426614174000";
const waveId = "123e4567-e89b-42d3-a456-426614174001";
const beachId = "123e4567-e89b-42d3-a456-426614174002";
const context = { params: Promise.resolve({ id: sessionId, waveId }) };
const start = "2026-10-17T12:00:00Z";
const end = "2026-10-17T12:00:20Z";
const wave = {
  id: waveId, session_id: sessionId, user_id: userId, wave_index: 1, is_current: true,
  detection_version: "wd-1.0.0", started_at: start, ended_at: end, duration_s: 20,
  distance_m: 42, max_speed_mps: 5, avg_speed_mps: 3, heading_deg: 270,
  confidence: 0.9, start_lat: 34, start_lon: -119, end_lat: 34.001, end_lon: -119.001,
};
const track = {
  session_id: sessionId, user_id: userId, storage_path: "track.fit", import_id: null,
  gps_coverage: 0.8, speed_reliable: false, user_wave_count: 4,
  track_geojson: { type: "LineString", coordinates: [[-119, 34], [-119.001, 34.001]] },
  speed_series: [{ t: start, mps: 3 }], recorded_by: "Garmin",
  paddle_distance_m: 1200, hr_avg: 118, hr_max: 156, source_device: "Forerunner 965",
};

type Table = "sessions" | "session_tracks" | "session_waves" | "session_wave_corrections" | "profiles" | "session_imports" | "user_events";
const rows: Record<Table, unknown> = {
  sessions: { id: sessionId, user_id: userId, deleted_at: null, beach_id: beachId },
  session_tracks: track, session_waves: [wave],
  session_wave_corrections: [{ id: "correction", started_at: start, ended_at: end, action: "exclude" }],
  profiles: { is_admin: false }, session_imports: null, user_events: null,
};

type Query = Record<string, jest.Mock>;
const queries: Record<string, Query[]> = {};
function queryFor(table: string): Query {
  const query: Query = {
    select: jest.fn(), eq: jest.fn(), is: jest.fn(), lt: jest.fn(), gt: jest.fn(), order: jest.fn(),
    maybeSingle: jest.fn(), insert: jest.fn(), update: jest.fn(), delete: jest.fn(),
    then: jest.fn(),
  };
  for (const method of ["select", "eq", "is", "lt", "gt", "order", "insert", "update", "delete"]) {
    query[method].mockReturnValue(query);
  }
  const result = (): { data: unknown; error: null } => ({ data: rows[table as Table], error: null });
  query.maybeSingle.mockImplementation(async () => result());
  query.then.mockImplementation((resolve: (value: unknown) => void) => Promise.resolve(resolve(result())));
  (queries[table] ??= []).push(query);
  return query;
}

function request(method: string, body?: unknown): NextRequest {
  return new NextRequest(`http://localhost/api/v1/sessions/${sessionId}/waves`, {
    method, headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

const savedEnv = {
  enabled: process.env.SESSION_IMPORTS_ENABLED,
  allowed: process.env.SESSION_IMPORTS_USER_ALLOWLIST,
  garminEnabled: process.env.GARMIN_WATCH_ENABLED,
  garminAllowed: process.env.GARMIN_WATCH_USER_ALLOWLIST,
};
beforeEach(() => {
  jest.clearAllMocks();
  for (const key of Object.keys(queries)) delete queries[key];
  process.env.SESSION_IMPORTS_ENABLED = "true";
  process.env.SESSION_IMPORTS_USER_ALLOWLIST = userId;
  delete process.env.GARMIN_WATCH_ENABLED;
  delete process.env.GARMIN_WATCH_USER_ALLOWLIST;
  rows.sessions = { id: sessionId, user_id: userId, deleted_at: null, beach_id: beachId };
  rows.session_tracks = { ...track };
  rows.session_waves = [wave];
  rows.session_wave_corrections = [{ id: "correction", started_at: start, ended_at: end, action: "exclude" }];
  rows.profiles = { is_admin: false };
  mockAuth.mockResolvedValue({ data: { user: { id: userId } }, error: null });
  mockUserFrom.mockImplementation(queryFor);
  mockServiceFrom.mockImplementation(queryFor);
  mockTides.mockResolvedValue(new Map([[waveId, 2.4]]));
  mockDownload.mockResolvedValue({ data: new Blob(["track"]), error: null });
  mockReadTrackFile.mockReturnValue({ meta: { format: "fit" }, samples: [] });
  mockSummarizeTrack.mockReturnValue({ gpsCoverage: 0.8 });
  mockLoadBeach.mockResolvedValue({ id: beachId });
  mockPersistDetection.mockResolvedValue([{ confidence: 0.9 }, { confidence: 0.4 }]);
});

afterAll(() => {
  if (savedEnv.enabled === undefined) delete process.env.SESSION_IMPORTS_ENABLED;
  else process.env.SESSION_IMPORTS_ENABLED = savedEnv.enabled;
  if (savedEnv.allowed === undefined) delete process.env.SESSION_IMPORTS_USER_ALLOWLIST;
  else process.env.SESSION_IMPORTS_USER_ALLOWLIST = savedEnv.allowed;
  if (savedEnv.garminEnabled === undefined) delete process.env.GARMIN_WATCH_ENABLED;
  else process.env.GARMIN_WATCH_ENABLED = savedEnv.garminEnabled;
  if (savedEnv.garminAllowed === undefined) delete process.env.GARMIN_WATCH_USER_ALLOWLIST;
  else process.env.GARMIN_WATCH_USER_ALLOWLIST = savedEnv.garminAllowed;
});

it("returns waves for an owner allowed only by the garmin watch flag", async () => {
  process.env.SESSION_IMPORTS_ENABLED = "false";
  process.env.GARMIN_WATCH_ENABLED = "true";
  process.env.GARMIN_WATCH_USER_ALLOWLIST = userId;

  const response = await GET(request("GET"), context);

  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ success: true, data: { waves: [{ id: waveId }] } });
  expect(queries.session_tracks[0].eq).toHaveBeenCalledWith("user_id", userId);
});

it("lets a garmin-only owner update the wave count and a correction", async () => {
  process.env.SESSION_IMPORTS_ENABLED = "false";
  process.env.GARMIN_WATCH_ENABLED = "true";
  process.env.GARMIN_WATCH_USER_ALLOWLIST = userId;
  rows.session_wave_corrections = [];

  const countResponse = await patchCount(request("PATCH", { userWaveCount: 2 }), context);
  const correctionResponse = await patchWave(request("PATCH", { excluded: true }), context);

  expect(countResponse.status).toBe(200);
  expect(correctionResponse.status).toBe(200);
  expect(queries.session_tracks.find(q => q.update.mock.calls.length)?.update).toHaveBeenCalledWith({ user_wave_count: 2 });
  expect(queries.session_wave_corrections.find(q => q.insert.mock.calls.length)?.insert).toHaveBeenCalledWith(
    expect.objectContaining({ session_id: sessionId, user_id: userId, action: "exclude" }),
  );
});

it("lets a garmin-only admin redetect an owned session", async () => {
  process.env.SESSION_IMPORTS_ENABLED = "false";
  process.env.GARMIN_WATCH_ENABLED = "true";
  process.env.GARMIN_WATCH_USER_ALLOWLIST = userId;
  mockAuth.mockResolvedValue({ data: { user: { id: userId, app_metadata: { is_admin: true } } }, error: null });

  const response = await redetect(request("POST"), context);

  expect(response.status).toBe(200);
  expect(mockDownload).toHaveBeenCalledWith("track.fit");
  expect(mockPersistDetection).toHaveBeenCalled();
});

it("returns the native waves contract with corrections, override count, track and unreliable speeds", async () => {
  const response = await GET(request("GET"), context);
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({
    success: true, data: {
      summary: { waveCount: 4, detectedWaveCount: 0, userWaveCount: 4, speedReliable: false, detectionVersion: "wd-1.0.0" },
      waves: [{ id: waveId, index: 1, startedAt: start, endedAt: end, durationS: 20, distanceM: 42,
        maxSpeedMps: null, avgSpeedMps: null, headingDeg: 270, confidence: 0.9, excluded: true, counted: false,
        tideFt: 2.4, start: { lat: 34, lon: -119 }, end: { lat: 34.001, lon: -119.001 } }],
      track: track.track_geojson, speedSeries: track.speed_series, recordedBy: "Garmin",
    },
  });
  expect(queries.session_waves[0].eq).toHaveBeenCalledWith("is_current", true);
  expect(queries.session_waves[0].order).toHaveBeenCalledWith("wave_index");
  expect(response.headers.get("Cache-Control")).toContain("no-store");
});

it("returns Garmin track metrics and the recorded-with label", async () => {
  rows.sessions = { ...rows.sessions as object, source: "garmin_watch" };
  rows.session_wave_corrections = [];
  rows.session_waves = [0, 480, 960].map((offset, index) => ({
    ...wave, id: `${waveId.slice(0, -1)}${index + 1}`, wave_index: index + 1,
    started_at: new Date(Date.parse(start) + offset * 1000).toISOString(),
    ended_at: new Date(Date.parse(end) + offset * 1000).toISOString(),
  }));
  const response = await GET(request("GET"), context);
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ data: { summary: {
    paddleDistanceM: 1200, heartRateAvg: 118, heartRateMax: 156,
    setIntervalMin: 8, recordedWith: "Quiver for Garmin · Forerunner 965",
  } } });
  expect(queries.sessions[0].select).toHaveBeenCalledWith(expect.stringContaining("source"));
});

it.each(["count", "exclude", "restore"])("preserves Garmin summary fields after a %s PATCH", async action => {
  rows.sessions = { ...rows.sessions as object, source: "garmin_watch" };
  rows.session_wave_corrections = action === "restore" ? [{ started_at: start, ended_at: end }] : [];
  rows.session_waves = [0, 20, 600, 620, 1200, 1220, 1800, 1820].map((offset, index) => ({
    ...wave, id: `${waveId.slice(0, -1)}${index + 1}`, wave_index: index + 1,
    started_at: new Date(Date.parse(start) + offset * 1000).toISOString(),
    ended_at: new Date(Date.parse(end) + offset * 1000).toISOString(),
  }));
  const response = action === "count"
    ? await patchCount(request("PATCH", { userWaveCount: 3 }), context)
    : await patchWave(request("PATCH", { excluded: action === "exclude" }), context);
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ data: { summary: {
    paddleDistanceM: 1200, heartRateAvg: 118, heartRateMax: 156,
    setIntervalMin: 10, recordedWith: "Quiver for Garmin · Forerunner 965",
  } } });
  expect(queries.sessions[0].select).toHaveBeenCalledWith(expect.stringContaining("source"));
  expect(queries.session_tracks[0].select).toHaveBeenCalledWith(expect.stringContaining("source_device"));
});

it.each(["other owner", "soft deleted"])("returns 404 for %s", async reason => {
  rows.sessions = { ...rows.sessions as object, ...(reason === "other owner" ? { user_id: "other" } : { deleted_at: start }) };
  const response = await GET(request("GET"), context);
  expect(response.status).toBe(404);
  expect(await response.json()).toMatchObject({ success: false, error: "not_found" });
  expect(mockServiceFrom).not.toHaveBeenCalled();
});

it("hides waves when the feature flag is off or the session has no track", async () => {
  process.env.SESSION_IMPORTS_ENABLED = "false";
  const hidden = await GET(request("GET"), context);
  expect(hidden.status).toBe(404);
  expect(await hidden.json()).toMatchObject({ success: false, error: "not_found" });
  expect(mockUserFrom).not.toHaveBeenCalled();

  process.env.SESSION_IMPORTS_ENABLED = "true";
  rows.session_tracks = null;
  const missingTrack = await GET(request("GET"), context);
  expect(missingTrack.status).toBe(404);
  expect(await missingTrack.json()).toMatchObject({ success: false, error: "not_found" });
  expect(mockTides).not.toHaveBeenCalled();
});

it("keeps the GET available when tide data fails", async () => {
  const warning = jest.spyOn(console, "warn").mockImplementation(() => {});
  mockTides.mockRejectedValue(new Error("NOAA unavailable"));
  try {
    const response = await GET(request("GET"), context);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ data: { waves: [{ tideFt: null }] } });
    expect(warning).toHaveBeenCalledWith("[session waves] Tide lookup failed:", expect.any(Error));
  } finally {
    warning.mockRestore();
  }
});

it.each([
  ["GET", GET], ["count PATCH", patchCount], ["wave PATCH", patchWave], ["redetect POST", redetect],
])("rejects malformed IDs for %s", async (_name, handler) => {
  const response = await handler(request("GET"), { params: Promise.resolve({ id: "bad", waveId: "bad" }) });
  expect(response.status).toBe(400);
  expect(await response.json()).toMatchObject({ success: false, error: "invalid_request" });
  expect(mockUserFrom).not.toHaveBeenCalled();
});

it("rejects an invalid user wave count without writing", async () => {
  const response = await patchCount(request("PATCH", { userWaveCount: 201 }), context);
  expect(response.status).toBe(400);
  expect(await response.json()).toMatchObject({ success: false, error: "invalid_request" });
  expect(mockServiceFrom).not.toHaveBeenCalled();
});

it("forbids redetection when only the editable profile and user metadata claim admin", async () => {
  rows.profiles = { is_admin: true };
  mockAuth.mockResolvedValue({
    data: { user: { id: userId, app_metadata: {}, user_metadata: { is_admin: true, role: "admin" } } },
    error: null,
  });
  const response = await redetect(request("POST"), context);
  expect(response.status).toBe(403);
  expect(await response.json()).toMatchObject({ success: false, error: "forbidden" });
  expect(mockDownload).not.toHaveBeenCalled();
  expect(mockPersistDetection).not.toHaveBeenCalled();
});

it("updates the user count, emits an event and returns the new summary", async () => {
  const response = await patchCount(request("PATCH", { userWaveCount: 0 }), context);
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ success: true, data: { summary: { waveCount: 0, userWaveCount: 0 } } });
  expect(queries.session_tracks.find(q => q.update.mock.calls.length)?.update).toHaveBeenCalledWith({ user_wave_count: 0 });
  expect(queries.user_events[0].insert).toHaveBeenCalledWith(expect.objectContaining({
    user_id: userId, event_type: "session_wave_count_reported",
    metadata: { session_id: sessionId, user_wave_count: 0 },
  }));
});

it("clears the user count override with null", async () => {
  const response = await patchCount(request("PATCH", { userWaveCount: null }), context);
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ success: true, data: { summary: { waveCount: 0, userWaveCount: null } } });
  expect(queries.session_tracks.find(q => q.update.mock.calls.length)?.update).toHaveBeenCalledWith({ user_wave_count: null });
});

it("inserts an exclusion correction with a UUID and emits an event", async () => {
  rows.session_wave_corrections = [];
  const response = await patchWave(request("PATCH", { excluded: true }), context);
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ success: true, data: { summary: { detectedWaveCount: 0 } } });
  expect(queries.session_wave_corrections.find(q => q.insert.mock.calls.length)?.insert).toHaveBeenCalledWith(expect.objectContaining({
    id: expect.stringMatching(/^[0-9a-f-]{36}$/), session_id: sessionId, user_id: userId,
    action: "exclude", started_at: start, ended_at: end,
  }));
  expect(queries.user_events[0].insert).toHaveBeenCalledWith(expect.objectContaining({ event_type: "session_wave_excluded" }));
});

it.each([
  ["fully", end],
  ["half", "2026-10-17T12:00:10Z"],
])("skips duplicate corrections and events for a wave already %s excluded", async (_coverage, correctionEnd) => {
  rows.session_wave_corrections = [{ started_at: start, ended_at: correctionEnd, action: "exclude" }];
  const response = await patchWave(request("PATCH", { excluded: true }), context);
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ success: true, data: { summary: { detectedWaveCount: 0 } } });
  for (const query of queries.session_wave_corrections) {
    expect(query.insert).not.toHaveBeenCalled();
    expect(query.delete).not.toHaveBeenCalled();
  }
  expect(mockServiceFrom).not.toHaveBeenCalledWith("user_events");
});

it("deletes overlapping corrections when restoring a wave", async () => {
  const response = await patchWave(request("PATCH", { excluded: false }), context);
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ success: true, data: { summary: { detectedWaveCount: 1 } } });
  expect(queries.session_wave_corrections.find(q => q.delete.mock.calls.length)?.lt).toHaveBeenCalledWith("started_at", end);
  expect(queries.session_wave_corrections.find(q => q.delete.mock.calls.length)?.gt).toHaveBeenCalledWith("ended_at", start);
  expect(mockServiceFrom).not.toHaveBeenCalledWith("user_events");
});

it("redetects from the stored file for an admin and returns the counted waves", async () => {
  mockAuth.mockResolvedValue({ data: { user: { id: userId, app_metadata: { is_admin: true } } }, error: null });
  const response = await redetect(request("POST"), context);
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ success: true, data: { detectionVersion: "wd-1.0.0", waveCount: 1 } });
  expect(mockDownload).toHaveBeenCalledWith("track.fit");
  expect(mockReadTrackFile).toHaveBeenCalledWith(expect.any(Uint8Array), "track.fit", expect.any(Date));
  expect(mockLoadBeach).toHaveBeenCalledWith(expect.anything(), beachId);
  expect(mockPersistDetection).toHaveBeenCalledWith(expect.anything(), sessionId, userId, expect.anything(), expect.anything(), { id: beachId });
});

it.each([[0.49, false], [0.5, true], [0.9, true]])("marks confidence %s counted=%s", async (confidence, counted) => {
  rows.session_waves = [{ ...wave, confidence }];
  rows.session_wave_corrections = [];
  const response = await GET(request("GET"), context);
  expect(response.status).toBe(200);
  expect((await response.json()).data).toMatchObject({
    waves: [{ confidence, counted, excluded: false }],
    summary: { detectedWaveCount: counted ? 1 : 0 },
  });
});
