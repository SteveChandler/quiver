/** @jest-environment node */
jest.mock("next/server", () => require("@/__tests__/setup/mock-next-server"));
jest.mock("server-only", () => ({}));
const mockFrom = jest.fn();
const mockUpload = jest.fn();
const mockDownload = jest.fn();
const mockRemove = jest.fn();
const mockStorageFrom = jest.fn(() => ({ upload: mockUpload, download: mockDownload, remove: mockRemove }));
const mockService = { from: mockFrom, storage: { from: mockStorageFrom } };
const mockProcess = jest.fn();
const mockEnqueue = jest.fn();
jest.mock("@/lib/notifications/enqueue", () => ({ enqueueNotification: (...args: unknown[]) => mockEnqueue(...args) }));
jest.mock("@/lib/supabase", () => ({
  ...jest.requireActual("@/lib/supabase"),
  createServiceRoleClient: () => mockService,
}));
jest.mock("@/lib/middleware/api-wrappers/rate-limit-wrapper", () => ({ withRateLimit: (handler: unknown) => handler }));
jest.mock("@/lib/sessions/imports/process-import", () => ({ processImport: (...args: unknown[]) => mockProcess(...args) }));

import { NextRequest } from "next/server";
import { POST as chunk } from "@/app/api/v1/watch/uploads/[surfId]/chunks/[index]/route";
import { POST as complete, maxDuration } from "@/app/api/v1/watch/uploads/[surfId]/complete/route";
import { parseQuiverWatch } from "@/lib/sessions/tracks/parse-quiver-watch";
import { TrackFileError } from "@/lib/sessions/tracks/types";
import { hashSecret } from "@/lib/watch/device-token";

const userId = "987fcdeb-51a2-43c1-a123-456789abcdef";
const surfId = "123e4567-e89b-42d3-a456-426614174000";
const deviceId = "123e4567-e89b-42d3-a456-426614174001";
const header = {
  surfId, startedAt: "2026-10-18T12:00:00Z", endedAt: "2026-10-18T12:10:00Z",
  sport: "surfing", partNumber: "006-B", deviceName: "Forerunner", appVersion: "1.0", rating: 4, chunkCount: 2,
};
const payload = { t0: 1792324800, lat0: 327000000, lon0: -1172000000, rows: [[0, 0, 0, 100, 80, 180], [1, 10, 20, 200, null, null]] };
type Row = Record<string, any>;
type Operation = { table: string; kind: string; values?: Row; filters: [string, unknown][] };
let tables: Record<string, Row[]>;
let objects: Map<string, string>;
let operations: Operation[];
let loseClaim: boolean;
let dbFailure: string | null;
const savedEnv = { enabled: process.env.GARMIN_WATCH_ENABLED, allowed: process.env.GARMIN_WATCH_USER_ALLOWLIST };
const context = (index = "0", id = surfId): { params: Promise<Record<string, string>> } => ({ params: Promise.resolve({ surfId: id, index }) });
const request = (body: unknown = { chunkCount: 2 }): NextRequest => new NextRequest("http://localhost/api/v1/watch/uploads", {
  method: "POST", headers: { authorization: "Bearer watch-token", "Content-Type": "application/json" }, body: JSON.stringify(body),
});

function query(table: string): Row {
  let kind = "select";
  let values: Row | undefined;
  let ignoreDuplicates = false;
  const filters: [string, unknown][] = [];
  const execute = async (): Promise<{ data: Row[] | null; error: unknown }> => {
    operations.push({ table, kind, values, filters: [...filters] });
    if (dbFailure === `${table}:${kind}`) return { data: null, error: { message: "database failed" } };
    let rows = tables[table].filter(row => filters.every(([key, value]) => row[key] === value));
    if (kind === "insert" || kind === "upsert") {
      const existing = tables[table].find(row => row.id === values!.id);
      if (existing && ignoreDuplicates) return { data: [], error: null };
      if (existing) return { data: null, error: { code: "23505", message: "duplicate key" } };
      const row = { created_at: new Date().toISOString(), status: "uploaded", session_id: null, error: null,
        header: null, chunk_count: null, received_chunks: [], import_id: null, ...values };
      tables[table].push(row);
      rows = [row];
    }
    if (kind === "update") {
      if (loseClaim && table === "watch_uploads" && values?.import_id) {
        tables.session_imports.push({ id: "winner", user_id: userId, status: "uploaded", created_at: new Date().toISOString(), session_id: null });
        tables.watch_uploads[0].import_id = "winner";
        return { data: [], error: null };
      }
      rows.forEach(row => Object.assign(row, values));
    }
    if (kind === "delete") tables[table] = tables[table].filter(row => !rows.includes(row));
    return { data: rows.map(row => ({ ...row })), error: null };
  };
  const builder: Row = {
    select: jest.fn(() => builder),
    eq: jest.fn((key: string, value: unknown) => { filters.push([key, value]); return builder; }),
    is: jest.fn((key: string, value: unknown) => { filters.push([key, value]); return builder; }),
    insert: jest.fn((row: Row) => { kind = "insert"; values = row; return builder; }),
    upsert: jest.fn((row: Row, options?: Row) => { kind = "upsert"; values = row; ignoreDuplicates = options?.ignoreDuplicates; return builder; }),
    update: jest.fn((row: Row) => { kind = "update"; values = row; return builder; }),
    delete: jest.fn(() => { kind = "delete"; return builder; }),
    maybeSingle: jest.fn(async () => { const result = await execute(); return { ...result, data: result.data?.[0] ?? null }; }),
    single: jest.fn(async () => { const result = await execute(); return { ...result, data: result.data?.[0] ?? null }; }),
    then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => execute().then(resolve, reject),
  };
  return builder;
}

beforeEach(() => {
  jest.clearAllMocks();
  process.env.GARMIN_WATCH_ENABLED = "true";
  process.env.GARMIN_WATCH_USER_ALLOWLIST = userId;
  tables = { watch_devices: [{ id: deviceId, user_id: userId, token_hash: hashSecret("watch-token"), device_name: null, revoked_at: null, last_seen_at: new Date().toISOString() }], watch_uploads: [], session_imports: [], sessions: [{ id: "session-1", user_id: userId, beach_name: "Scripps", custom_spot_id: null, deleted_at: null }], custom_spots: [] };
  objects = new Map(); operations = []; loseClaim = false; dbFailure = null;
  mockFrom.mockImplementation(query);
  mockUpload.mockImplementation(async (path: string, body: string | Uint8Array) => {
    objects.set(path, typeof body === "string" ? body : Buffer.from(body).toString("utf8"));
    return { data: { path }, error: null };
  });
  mockDownload.mockImplementation(async (path: string) => ({ data: objects.has(path) ? new Blob([objects.get(path)!]) : null, error: null }));
  mockRemove.mockImplementation(async (paths: string[]) => {
    paths.forEach(path => objects.delete(path));
    return { data: [], error: null };
  });
  mockProcess.mockImplementation(async (_deps: unknown, id: string) => {
    Object.assign(tables.session_imports.find(row => row.id === id)!, { status: "completed", session_id: "session-1" });
    return { status: "completed", sessionId: "session-1", attached: false, summary: { waveCount: 2 } };
  });
  mockEnqueue.mockResolvedValue({ enqueued: true, eventId: "event-1" });
});

afterAll(() => {
  if (savedEnv.enabled === undefined) delete process.env.GARMIN_WATCH_ENABLED; else process.env.GARMIN_WATCH_ENABLED = savedEnv.enabled;
  if (savedEnv.allowed === undefined) delete process.env.GARMIN_WATCH_USER_ALLOWLIST; else process.env.GARMIN_WATCH_USER_ALLOWLIST = savedEnv.allowed;
});

async function uploadAll(): Promise<void> {
  expect((await chunk(request({ ...payload, header }), context())).status).toBe(200);
  expect((await chunk(request({ ...payload, t0: payload.t0 + 300 }), context("1"))).status).toBe(200);
}

it("requires the header on chunk zero", async () => {
  expect((await chunk(request(payload), context())).status).toBe(400);
  expect(mockUpload).not.toHaveBeenCalled();
});

it.each([chunk, complete])("returns 404 for another user's surf without writes or processing", async handler => {
  tables.watch_uploads.push({ id: surfId, user_id: "other", import_id: null });
  expect((await handler(request({ ...payload, header, chunkCount: 2 }), context())).status).toBe(404);
  expect(mockUpload).not.toHaveBeenCalled(); expect(mockDownload).not.toHaveBeenCalled(); expect(mockRemove).not.toHaveBeenCalled();
  expect(mockProcess).not.toHaveBeenCalled();
  expect(tables.watch_uploads).toEqual([{ id: surfId, user_id: "other", import_id: null }]);
  expect(operations.filter(op => !["select", "upsert"].includes(op.kind))).toEqual([]);
});

it("stores octet-stream chunks and keeps repeated and out-of-order indices sorted and unique", async () => {
  await chunk(request(payload), context("1"));
  await chunk(request({ ...payload, header }), context());
  const response = await chunk(request(payload), context("1"));
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ success: true, data: { received: 1 } });
  expect(response.headers.get("Cache-Control")).toContain("no-store");
  expect(tables.watch_uploads).toHaveLength(1);
  expect(tables.watch_uploads[0]).toMatchObject({ id: surfId, user_id: userId, device_id: deviceId, header, chunk_count: 2, received_chunks: [0, 1] });
  expect(mockUpload).toHaveBeenCalledWith(`${surfId}/${userId}/chunks/1.json`, expect.anything(), { contentType: "application/octet-stream", upsert: true });
});

it.each(["-1", "1000", "1.5", "abc"])("rejects invalid index %s", async index => {
  expect((await chunk(request({ ...payload, header }), context(index))).status).toBe(400);
  expect(mockUpload).not.toHaveBeenCalled();
});
it.each([chunk, complete])("rejects invalid surf UUID", async handler => {
  expect((await handler(request({ ...payload, header, chunkCount: 2 }), context("0", "bad"))).status).toBe(400);
});
it.each<{ rows: unknown }>([
  [[-1, 0, 0, null, null, null]], [[0, 0.5, 0, null, null, null]], [[0, Number.MAX_SAFE_INTEGER + 1, 0, null, null, null]],
  [[0, 0, 0, 1.5, null, null]], [[0, 0, 0, null, "80", null]], [[0, 0, 0, null, null, 1.5]], [[0, 0, 0]],
  Array.from({ length: 601 }, () => [0, 0, 0, null, null, null]),
].map(rows => ({ rows })))("rejects invalid rows $#", async ({ rows }) => {
  expect((await chunk(request({ ...payload, header, rows }), context())).status).toBe(400);
  expect(mockUpload).not.toHaveBeenCalled();
});
it("accepts 300 rows and nullable fields", async () => {
  const rows = Array.from({ length: 300 }, () => [0, null, null, null, null, null]);
  expect((await chunk(request({ ...payload, header, lat0: null, lon0: null, rows }), context())).status).toBe(200);
});
it("rejects an index outside a known chunk count", async () => {
  await chunk(request({ ...payload, header }), context()); mockUpload.mockClear();
  expect((await chunk(request(payload), context("2"))).status).toBe(400);
  expect(mockUpload).not.toHaveBeenCalled();
});
it("rejects mismatched header surf IDs", async () => {
  expect((await chunk(request({ ...payload, header: { ...header, surfId: deviceId } }), context())).status).toBe(400);
});
it("reports the exact missing indices", async () => {
  await chunk(request({ ...payload, header: { ...header, chunkCount: 4 } }), context());
  await chunk(request(payload), context("2"));
  const response = await complete(request({ chunkCount: 4 }), context());
  expect(response.status).toBe(409);
  expect(await response.json()).toMatchObject({ success: false, error: "missing_chunks", details: { missing: [1, 3] } });
  expect(mockProcess).not.toHaveBeenCalled(); expect(tables.session_imports).toHaveLength(0);
});
it("reports missing chunk zero when no header has arrived", async () => {
  await chunk(request(payload), context("1"));
  const response = await complete(request(), context());
  expect(response.status).toBe(409);
  expect(await response.json()).toMatchObject({ error: "missing_chunks", details: { missing: [0] } });
});
it.each([{}, { chunkCount: 0 }, { chunkCount: 1001 }, { chunkCount: 1.5 }])("validates complete bodies %j", async body => {
  await uploadAll();
  expect((await complete(request(body), context())).status).toBe(400);
  expect(mockProcess).not.toHaveBeenCalled();
});

it("assembles ordered parser-compatible bytes, claims before processing, and returns the same answer twice", async () => {
  await uploadAll();
  mockProcess.mockImplementationOnce(async (deps: unknown, id: string) => {
    expect(tables.watch_uploads[0].import_id).toBe(id);
    Object.assign(tables.session_imports.find(row => row.id === id)!, { status: "completed", session_id: "session-1" });
    return { status: "completed", sessionId: "session-1", attached: false, summary: {} };
  });
  const first = await complete(request(), context());
  const second = await complete(request(), context());
  for (const response of [first, second]) {
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ success: true, data: { status: "completed", sessionId: "session-1" } });
    expect(response.headers.get("Cache-Control")).toContain("no-store");
  }
  expect(tables.session_imports).toHaveLength(1);
  const imported = tables.session_imports[0];
  expect(imported).toMatchObject({ user_id: userId, original_filename: `garmin-${surfId}.json`, origin: "garmin_watch", device_id: deviceId });
  expect(imported.id).toMatch(/^[0-9a-f-]{36}$/);
  expect(imported.id).not.toBe(surfId);
  expect(imported.storage_path).toBe(`${imported.id}/${userId}/samples.json`);
  expect(mockProcess).toHaveBeenCalledTimes(1);
  expect(mockProcess).toHaveBeenCalledWith({ userClient: mockService, serviceClient: mockService, now: expect.any(Date) }, imported.id, userId);
  const assembledBytes = Buffer.from(objects.get(imported.storage_path)!, "utf8");
  const assembled = JSON.parse(new TextDecoder().decode(assembledBytes));
  expect(assembled).toEqual({ quiverWatch: 1, header, chunks: [payload, { ...payload, t0: payload.t0 + 300 }] });
  expect(parseQuiverWatch(assembled).samples).toHaveLength(4);
  expect(parseQuiverWatch(assembled).samples[1]).toMatchObject({ lat: 32.700001, lon: -117.199998, speedMps: 2 });
  expect(mockUpload).toHaveBeenCalledWith(imported.storage_path, expect.anything(), { contentType: "application/octet-stream", upsert: true });
  expect(mockRemove).toHaveBeenCalledWith([`${surfId}/${userId}/chunks/0.json`, `${surfId}/${userId}/chunks/1.json`]);
  for (const op of operations.filter(op => ["update", "delete"].includes(op.kind))) expect(op.filters).toContainEqual(["user_id", userId]);
});
it.each([
  { status: "needs_beach", importId: "unused", candidates: [] },
  { status: "duplicate", sessionId: "existing" }, { status: "duplicate", sessionId: null },
])("maps process result $status", async result => {
  await uploadAll(); mockProcess.mockResolvedValueOnce(result);
  const response = await complete(request(), context());
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ data: { status: result.status, sessionId: "sessionId" in result ? result.sessionId : null } });
});
it("maps no_gps to final failed", async () => {
  await uploadAll(); mockProcess.mockRejectedValueOnce(new TrackFileError("no_gps", "No GPS"));
  const response = await complete(request(), context());
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ data: { status: "failed", sessionId: null } });
});

it("enqueues a ready push once for a fresh completed import, including an attached session", async () => {
  await uploadAll();
  mockProcess.mockImplementationOnce(async (_deps: unknown, id: string) => {
    Object.assign(tables.session_imports.find(row => row.id === id)!, { status: "completed", session_id: "session-1" });
    return { status: "completed", sessionId: "session-1", attached: true, summary: { waveCount: 2 } };
  });
  const first = await complete(request(), context());
  expect(first.status).toBe(200);
  const importId = tables.session_imports[0].id;
  expect(mockEnqueue).toHaveBeenCalledTimes(1);
  expect(mockEnqueue).toHaveBeenCalledWith({
    type: "watch_session_ready", recipientUserId: userId,
    payload: { session_id: "session-1", beach_name: "Scripps", wave_count: 2 },
    dedupeKey: `watch_session:${importId}:completed`,
  }, mockService);
  const replay = await complete(request(), context());
  expect(replay.status).toBe(200);
  expect(await replay.json()).toMatchObject({ data: { status: "completed", sessionId: "session-1" } });
  expect(mockProcess).toHaveBeenCalledTimes(1);
  expect(mockEnqueue).toHaveBeenCalledTimes(1);
});

it("uses a custom spot name when the session has no beach name", async () => {
  await uploadAll();
  Object.assign(tables.sessions[0], { beach_name: null, custom_spot_id: "spot-1" });
  tables.custom_spots.push({ id: "spot-1", user_id: userId, name: "My Secret Spot" });
  mockProcess.mockResolvedValueOnce({ status: "completed", sessionId: "session-1", attached: false, summary: { waveCount: 1 } });
  expect((await complete(request(), context())).status).toBe(200);
  expect(mockEnqueue.mock.calls[0][0].payload).toEqual({ session_id: "session-1", beach_name: "My Secret Spot", wave_count: 1 });
});

it("skips a ready push when no beach or custom spot name resolves", async () => {
  await uploadAll();
  Object.assign(tables.sessions[0], { beach_name: null, custom_spot_id: null });
  mockProcess.mockResolvedValueOnce({ status: "completed", sessionId: "session-1", attached: false, summary: { waveCount: 0 } });
  const warning = jest.spyOn(console, "warn").mockImplementation(() => {});
  try {
    expect((await complete(request(), context())).status).toBe(200);
    expect(mockEnqueue).not.toHaveBeenCalled();
    expect(warning).toHaveBeenCalled();
  } finally { warning.mockRestore(); }
});

it("enqueues needs-beach with the surf timezone and import id", async () => {
  await uploadAll();
  mockProcess.mockImplementationOnce(async (_deps: unknown, id: string) => {
    Object.assign(tables.session_imports.find(row => row.id === id)!, {
      status: "needs_beach", summary: { centroid: { lat: 32.7, lon: -117.2 } },
    });
    return { status: "needs_beach", importId: id, candidates: [] };
  });
  expect((await complete(request(), context())).status).toBe(200);
  const importId = tables.session_imports[0].id;
  expect(mockEnqueue).toHaveBeenCalledWith({
    type: "watch_session_needs_beach", recipientUserId: userId,
    payload: { import_id: importId, started_at: header.startedAt, timezone: "America/Los_Angeles" },
    dedupeKey: `watch_session:${importId}:needs_beach`,
  }, mockService);
  await complete(request(), context());
  expect(mockEnqueue).toHaveBeenCalledTimes(1);
});

it("falls back to UTC when the surf timezone cannot be resolved", async () => {
  await uploadAll();
  mockProcess.mockImplementationOnce(async (_deps: unknown, id: string) => {
    Object.assign(tables.session_imports.find(row => row.id === id)!, { status: "needs_beach", summary: null });
    return { status: "needs_beach", importId: id, candidates: [] };
  });
  expect((await complete(request(), context())).status).toBe(200);
  expect(mockEnqueue.mock.calls[0][0].payload).toEqual({
    import_id: tables.session_imports[0].id, started_at: header.startedAt, timezone: "UTC",
  });
});

it("does not enqueue duplicate or failed process results", async () => {
  await uploadAll();
  mockProcess.mockResolvedValueOnce({ status: "duplicate", sessionId: "existing" });
  expect((await complete(request(), context())).status).toBe(200);
  expect(mockEnqueue).not.toHaveBeenCalled();
  jest.clearAllMocks();
  tables.watch_uploads = [];
  await uploadAll();
  mockProcess.mockRejectedValueOnce(new TrackFileError("no_gps", "No GPS"));
  expect((await complete(request(), context())).status).toBe(200);
  expect(mockEnqueue).not.toHaveBeenCalled();
});

it("keeps the complete response when enqueue throws", async () => {
  await uploadAll();
  mockProcess.mockResolvedValueOnce({ status: "completed", sessionId: "session-1", attached: false, summary: { waveCount: 1 } });
  mockEnqueue.mockRejectedValueOnce(new Error("queue down"));
  const warning = jest.spyOn(console, "warn").mockImplementation(() => {});
  try {
    const response = await complete(request(), context());
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ data: { status: "completed", sessionId: "session-1" } });
    expect(warning).toHaveBeenCalled();
  } finally { warning.mockRestore(); }
});
it.each([
  ["completed", null, "session-1", "completed"], ["needs_beach", null, null, "needs_beach"],
  ["failed", "duplicate", "existing", "duplicate"], ["failed", "corrupt", "ignored", "failed"],
])("maps persisted %s/%s", async (status, error, sessionId, expected) => {
  tables.watch_uploads.push({ id: surfId, user_id: userId, import_id: "import" });
  tables.session_imports.push({ id: "import", user_id: userId, status, error, session_id: sessionId });
  const response = await complete(request(), context());
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ data: { status: expected, sessionId: expected === "completed" || expected === "duplicate" ? sessionId : null } });
  expect(mockProcess).not.toHaveBeenCalled(); expect(mockUpload).not.toHaveBeenCalled();
});
it.each([30, 91])("handles an uploaded import aged %i seconds", async age => {
  tables.watch_uploads.push({ id: surfId, user_id: userId, import_id: "import", chunk_count: 2, received_chunks: [0, 1] });
  tables.session_imports.push({ id: "import", user_id: userId, status: "uploaded", created_at: new Date(Date.now() - age * 1000).toISOString() });
  const response = await complete(request(), context());
  expect(response.status).toBe(age < 90 ? 202 : 200);
  expect(await response.json()).toMatchObject({ data: age < 90 ? { status: "processing", sessionId: null } : { status: "completed", sessionId: "session-1" } });
  expect(mockProcess).toHaveBeenCalledTimes(age < 90 ? 0 : 1);
  const expectedCall = [expect.anything(), "import", userId];
  expect(mockProcess.mock.calls).toEqual(age < 90 ? [] : [expectedCall]);
  expect(tables.session_imports).toHaveLength(1);
});
it("deletes only its unclaimed import after losing the claim and returns the winner's status", async () => {
  await uploadAll(); loseClaim = true;
  const response = await complete(request(), context());
  expect(response.status).toBe(202);
  expect(await response.json()).toMatchObject({ data: { status: "processing", sessionId: null } });
  expect(tables.session_imports.map(row => row.id)).toEqual(["winner"]);
  const inserted = operations.find(op => op.table === "session_imports" && op.kind === "insert")!.values!;
  expect(inserted.storage_path).toBe(`${inserted.id}/${userId}/samples.json`);
  expect(mockRemove).toHaveBeenCalledWith([inserted.storage_path]);
  expect(objects.has(inserted.storage_path)).toBe(false);
  expect(objects.has(`${surfId}/${userId}/chunks/0.json`)).toBe(true);
  expect(objects.has(`${surfId}/${userId}/chunks/1.json`)).toBe(true);
  expect(mockProcess).not.toHaveBeenCalled();
  expect(operations.find(op => op.table === "watch_uploads" && op.values?.import_id)?.filters).toEqual(expect.arrayContaining([["id", surfId], ["user_id", userId], ["import_id", null]]));
  expect(operations.find(op => op.table === "session_imports" && op.kind === "delete")?.filters).toEqual(expect.arrayContaining([["user_id", userId]]));
});
it.each([chunk, complete])("rejects a revoked device via real watch auth", async handler => {
  tables.watch_devices[0].revoked_at = new Date().toISOString();
  expect((await handler(request({ ...payload, header }), context())).status).toBe(401);
  expect(mockUpload).not.toHaveBeenCalled(); expect(mockProcess).not.toHaveBeenCalled();
});
it("does not mark a chunk received if storage fails", async () => {
  const errorLog = jest.spyOn(console, "error").mockImplementation(() => {});
  mockUpload.mockResolvedValueOnce({ error: { message: "storage failed" } });
  try {
    expect((await chunk(request({ ...payload, header }), context())).status).toBe(500);
    expect(tables.watch_uploads[0].received_chunks).toEqual([]);
  } finally { errorLog.mockRestore(); }
});
it("does not process if the import insert fails", async () => {
  await uploadAll(); dbFailure = "session_imports:insert";
  const errorLog = jest.spyOn(console, "error").mockImplementation(() => {});
  try {
    expect((await complete(request(), context())).status).toBe(500);
    expect(mockProcess).not.toHaveBeenCalled(); expect(tables.watch_uploads[0].import_id).toBeNull();
  } finally { errorLog.mockRestore(); }
});
it("treats chunk cleanup as best effort", async () => {
  await uploadAll(); mockRemove.mockResolvedValueOnce({ error: { message: "cleanup failed" } });
  const warning = jest.spyOn(console, "warn").mockImplementation(() => {});
  try { expect((await complete(request(), context())).status).toBe(200); } finally { warning.mockRestore(); }
});
it("allows 60 seconds for complete", () => { expect(maxDuration).toBe(60); });

it("returns processing to a retry while the first completion is still running", async () => {
  await uploadAll();
  let started!: () => void;
  let release!: () => void;
  const processingStarted = new Promise<void>(resolve => { started = resolve; });
  const finishProcessing = new Promise<void>(resolve => { release = resolve; });
  mockProcess.mockImplementationOnce(async (_deps: unknown, id: string) => {
    started();
    await finishProcessing;
    Object.assign(tables.session_imports.find(row => row.id === id)!, { status: "completed", session_id: "session-1" });
    return { status: "completed", sessionId: "session-1", attached: false, summary: { waveCount: 2 } };
  });
  const first = complete(request(), context());
  await processingStarted;
  try {
    const retry = await complete(request(), context());
    expect(retry.status).toBe(202);
    expect(await retry.json()).toMatchObject({ data: { status: "processing", sessionId: null } });
    expect(mockProcess).toHaveBeenCalledTimes(1);
    expect(tables.session_imports).toHaveLength(1);
  } finally { release(); }
  expect((await first).status).toBe(200);
});
it("rejects a complete count inconsistent with the stored header", async () => {
  await uploadAll();
  expect((await complete(request({ chunkCount: 1 }), context())).status).toBe(400);
  expect(mockProcess).not.toHaveBeenCalled();
});
it("returns 404 for an unknown surf on complete", async () => {
  expect((await complete(request(), context())).status).toBe(404);
  expect(mockUpload).not.toHaveBeenCalled(); expect(mockProcess).not.toHaveBeenCalled();
});
it("does not overwrite completed chunks on watch retries", async () => {
  await uploadAll(); await complete(request(), context()); mockUpload.mockClear();
  expect((await chunk(request(payload), context("1"))).status).toBe(200);
  expect(mockUpload).not.toHaveBeenCalled();
});
it("rejects an import belonging to another user even if the upload references it", async () => {
  tables.watch_uploads.push({ id: surfId, user_id: userId, import_id: "foreign" });
  tables.session_imports.push({ id: "foreign", user_id: "other", status: "completed", session_id: "other-session" });
  expect((await complete(request(), context())).status).toBe(404);
  expect(mockProcess).not.toHaveBeenCalled();
});
it("preserves chunks and returns a real failure on unexpected processing errors", async () => {
  await uploadAll(); mockProcess.mockRejectedValueOnce(new Error("temporary outage"));
  const errorLog = jest.spyOn(console, "error").mockImplementation(() => {});
  try {
    expect((await complete(request(), context())).status).toBe(500);
    expect(mockRemove).not.toHaveBeenCalled();
  } finally { errorLog.mockRestore(); }
});

it("scopes upload reads by the authenticated owner", async () => {
  await uploadAll();
  await complete(request(), context());
  const reads = operations.filter(op => op.table === "watch_uploads" && op.kind === "select");
  expect(reads.length).toBeGreaterThan(0);
  for (const read of reads) expect(read.filters).toContainEqual(["user_id", userId]);
});
it("does not insert or claim an import if the assembled upload fails", async () => {
  await uploadAll();
  mockUpload.mockResolvedValueOnce({ data: null, error: { message: "samples upload failed" } });
  const errorLog = jest.spyOn(console, "error").mockImplementation(() => {});
  try {
    expect((await complete(request(), context())).status).toBe(500);
    expect(tables.session_imports).toHaveLength(0);
    expect(tables.watch_uploads[0].import_id).toBeNull();
    expect(mockProcess).not.toHaveBeenCalled();
  } finally { errorLog.mockRestore(); }
});
it("cleans up the assembled object when the import insert fails", async () => {
  await uploadAll(); dbFailure = "session_imports:insert";
  const errorLog = jest.spyOn(console, "error").mockImplementation(() => {});
  try {
    expect((await complete(request(), context())).status).toBe(500);
    const samplesPath = mockUpload.mock.calls[2][0];
    expect(mockRemove).toHaveBeenCalledWith([samplesPath]);
    expect(objects.has(samplesPath)).toBe(false);
    expect(objects.has(`${surfId}/${userId}/chunks/0.json`)).toBe(true);
  } finally { errorLog.mockRestore(); }
});

it("restarts a split surf from chunk zero and assembles four replacement chunks", async () => {
  const originalHeader = { ...header, chunkCount: 3 };
  const originals = Array.from({ length: 3 }, (_, index) => ({ ...payload, t0: payload.t0 + index * 10 }));
  const originalSamples = parseQuiverWatch({ quiverWatch: 1, header: originalHeader, chunks: originals }).samples;
  for (let index = 0; index < 3; index++) {
    const body = { ...originals[index], ...(index === 0 ? { header: originalHeader } : {}) };
    expect((await chunk(request(body), context(String(index)))).status).toBe(200);
  }
  const replacementHeader = { ...header, chunkCount: 4 };
  const replacements = [
    originals[0],
    { ...originals[1], rows: [payload.rows[0]] },
    { ...originals[1], t0: originals[1].t0 + 1, lat0: payload.lat0 + 10, lon0: payload.lon0 + 20, rows: [[0, 0, 0, 200, null, null]] },
    originals[2],
  ];
  const createsBeforeRestart = operations.filter(op => op.table === "watch_uploads" && op.kind === "upsert").length;
  expect((await chunk(request({ ...replacements[0], header: replacementHeader }), context())).status).toBe(200);
  expect(tables.watch_uploads).toHaveLength(1);
  expect(tables.watch_uploads[0]).toMatchObject({ header: replacementHeader, chunk_count: 4, received_chunks: [0, 1, 2] });
  expect(operations.filter(op => op.table === "watch_uploads" && op.kind === "upsert")).toHaveLength(createsBeforeRestart);
  expect(operations.filter(op => op.table === "watch_uploads" && op.kind === "update").at(-1)?.values)
    .toMatchObject({ header: replacementHeader, chunk_count: 4, received_chunks: [0, 1, 2] });
  for (let index = 1; index < 4; index++) {
    expect((await chunk(request(replacements[index]), context(String(index)))).status).toBe(200);
  }
  const response = await complete(request({ chunkCount: 4 }), context());
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ data: { status: "completed", sessionId: "session-1" } });
  const assembled = JSON.parse(objects.get(tables.session_imports[0].storage_path)!);
  expect(assembled).toEqual({ quiverWatch: 1, header: replacementHeader, chunks: replacements });
  const parsed = parseQuiverWatch(assembled);
  expect(parsed.samples).toHaveLength(6);
  expect(parsed.samples).toEqual(originalSamples);
});

it.each([301, 600])("rejects %i-row chunks before storing them", async count => {
  const rows = Array.from({ length: count }, () => [0, 0, 0, null, null, null]);
  const response = await chunk(request({ ...payload, header, rows }), context());
  expect(response.status).toBe(400);
  expect(mockUpload).not.toHaveBeenCalled();
  expect(tables.watch_uploads).toHaveLength(0);
});

it.each<{ label: string; change: Record<string, unknown> }>([
  { label: "nonzero first dt", change: { rows: [[1, 0, 0, 100, 80, 180]] } },
  { label: "latitude-only origin", change: { lon0: null } },
  { label: "longitude-only origin", change: { lat0: null } },
  { label: "unpaired fix deltas", change: { rows: [[0, null, 0, 100, 80, 180]] } },
  { label: "negative speed", change: { rows: [[0, 0, 0, -1, 80, 180]] } },
  { label: "negative heart rate", change: { rows: [[0, 0, 0, 100, -1, 180]] } },
  { label: "heart rate above 255", change: { rows: [[0, 0, 0, 100, 256, 180]] } },
])("rejects parser-incompatible $label at ingest", async ({ change }) => {
  expect((await chunk(request({ ...payload, header, ...change }), context())).status).toBe(400);
  expect(mockUpload).not.toHaveBeenCalled();
  expect(tables.watch_uploads).toHaveLength(0);
});
it.each([0, 255])("accepts heart rate boundary %i", async hr => {
  const rows = [[0, 0, 0, 0, hr, 180]];
  expect((await chunk(request({ ...payload, header, rows }), context())).status).toBe(200);
});

it.each(["Forerunner 165", null, "", "  "])("stores the linked friendly device name when available: %j", async deviceName => {
  tables.watch_devices[0].device_name = deviceName;
  const expectedName = deviceName?.trim() ? deviceName : header.deviceName;
  await uploadAll();
  expect(tables.watch_uploads[0].header.deviceName).toBe(expectedName);
  const storedChunk = JSON.parse(objects.get(`${surfId}/${userId}/chunks/0.json`)!);
  expect(storedChunk.header.deviceName).toBe(expectedName);
  expect((await complete(request(), context())).status).toBe(200);
  const assembled = JSON.parse(objects.get(tables.session_imports[0].storage_path)!);
  expect(parseQuiverWatch(assembled).meta.recordedBy).toBe(`Quiver for Garmin · ${expectedName}`);
});

it.each([false, true])("requests a missing stored chunk for re-upload (storage 404: %s)", async storageError => {
  await uploadAll();
  objects.delete(`${surfId}/${userId}/chunks/1.json`);
  const downloadObject = mockDownload.getMockImplementation()!;
  mockDownload.mockImplementation(async (path: string) => {
    if (!objects.has(path) && storageError) return { data: null, error: { message: "Object not found", statusCode: "404" } };
    return downloadObject(path);
  });
  const errorLog = jest.spyOn(console, "error").mockImplementation(() => {});
  try {
    const response = await complete(request(), context());
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ error: "missing_chunks", details: { missing: [1] } });
    expect(tables.watch_uploads[0].received_chunks).toEqual([0]);
    expect(tables.session_imports).toHaveLength(0);
    expect(mockProcess).not.toHaveBeenCalled();
    expect((await chunk(request({ ...payload, t0: payload.t0 + 300 }), context("1"))).status).toBe(200);
    expect((await complete(request(), context())).status).toBe(200);
  } finally { errorLog.mockRestore(); }
});
it("preserves the received indices on a transient storage download error", async () => {
  await uploadAll();
  mockDownload.mockResolvedValueOnce({ data: null, error: { message: "Storage temporarily unavailable", statusCode: "503" } });
  const errorLog = jest.spyOn(console, "error").mockImplementation(() => {});
  try {
    expect((await complete(request(), context())).status).toBe(500);
    expect(tables.watch_uploads[0].received_chunks).toEqual([0, 1]);
    expect(mockProcess).not.toHaveBeenCalled();
  } finally { errorLog.mockRestore(); }
});

it("maps a TrackFileError from a stale rerun to final failed", async () => {
  tables.watch_uploads.push({ id: surfId, user_id: userId, import_id: "import", received_chunks: [0, 1] });
  tables.session_imports.push({ id: "import", user_id: userId, status: "uploaded", created_at: new Date(Date.now() - 91_000).toISOString() });
  mockProcess.mockRejectedValueOnce(new TrackFileError("no_gps", "No GPS"));
  const response = await complete(request(), context());
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ data: { status: "failed", sessionId: null } });
  expect(mockProcess).toHaveBeenCalledWith(expect.anything(), "import", userId);
  expect(tables.session_imports).toHaveLength(1);
});
it("keeps a stale import retryable after an unexpected rerun failure", async () => {
  const imported = { id: "import", user_id: userId, status: "uploaded", created_at: new Date(Date.now() - 91_000).toISOString() };
  tables.watch_uploads.push({ id: surfId, user_id: userId, import_id: imported.id, received_chunks: [0, 1] });
  tables.session_imports.push(imported);
  const beforeFailure = { ...imported };
  mockProcess.mockRejectedValueOnce(new Error("Temporary processing failure"));
  const errorLog = jest.spyOn(console, "error").mockImplementation(() => {});
  try {
    expect((await complete(request(), context())).status).toBe(500);
    expect(tables.session_imports[0]).toEqual(beforeFailure);
    expect(tables.watch_uploads[0].import_id).toBe("import");
    expect(mockRemove).not.toHaveBeenCalled();
    expect((await complete(request(), context())).status).toBe(200);
    expect(mockProcess).toHaveBeenCalledTimes(2);
    expect(mockProcess.mock.calls.map(call => call.slice(1))).toEqual([["import", userId], ["import", userId]]);
    expect(tables.session_imports).toHaveLength(1);
  } finally { errorLog.mockRestore(); }
});


it.each<{ label: string; change: Record<string, unknown> }>([
  { label: "nonzero first-fix delta", change: { rows: [[0, 1, 0, 100, 80, 180]] } },
  { label: "fix without an origin", change: { lat0: null, lon0: null } },
  { label: "origin without any fix", change: { rows: [[0, null, null, 100, 80, 180]] } },
  { label: "latitude accumulating past 90 degrees", change: { lat0: 90e7, rows: [[0, 0, 0, null, null, null], [1, 1, 0, null, null, null]] } },
  { label: "latitude accumulating past -90 degrees", change: { lat0: -90e7, rows: [[0, 0, 0, null, null, null], [1, -1, 0, null, null, null]] } },
  { label: "longitude accumulating past 180 degrees", change: { lon0: 180e7, rows: [[0, 0, 0, null, null, null], [1, 0, 1, null, null, null]] } },
  { label: "longitude accumulating past -180 degrees", change: { lon0: -180e7, rows: [[0, 0, 0, null, null, null], [1, 0, -1, null, null, null]] } },
  { label: "time accumulating past the Date limit", change: { t0: 8_640_000_000_000 } },
])("rejects $label through the real parser before storage", async ({ change }) => {
  const response = await chunk(request({ ...payload, header, ...change }), context());
  expect(response.status).toBe(400);
  expect(await response.json()).toMatchObject({ success: false, error: "invalid_chunk" });
  expect(mockUpload).not.toHaveBeenCalled();
  expect(tables.watch_uploads).toHaveLength(0);
});

it.each([false, true])("validates nonzero chunks with a stub or stored header (stored: %s)", async stored => {
  if (stored) await chunk(request({ ...payload, header }), context());
  mockUpload.mockClear();
  const response = await chunk(request({ ...payload, rows: [[0, 1, 0, 100, 80, 180]] }), context("1"));
  expect(response.status).toBe(400);
  expect(await response.json()).toMatchObject({ error: "invalid_chunk" });
  expect(mockUpload).not.toHaveBeenCalled();
});

it.each(["incoming", "stored", "stub"])("accepts a valid no-fix chunk using the %s header", async source => {
  if (source === "stored") await chunk(request({ ...payload, header }), context());
  const index = source === "incoming" ? "0" : "1";
  const noFix = { t0: payload.t0, lat0: null, lon0: null, rows: [[0, null, null, 0, null, 180], [1, null, null, 0, null, 180]] };
  const response = await chunk(request({ ...noFix, ...(source === "incoming" ? { header } : {}) }), context(index));
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ data: { received: Number(index) } });
  expect(JSON.parse(objects.get(`${surfId}/${userId}/chunks/${index}.json`)!)).toMatchObject(noFix);
});

it("enqueues exactly one ready push when a stale uploaded import finishes and is replayed", async () => {
  tables.watch_uploads.push({ id: surfId, user_id: userId, import_id: "stale-import", received_chunks: [0, 1], header });
  tables.session_imports.push({ id: "stale-import", user_id: userId, status: "uploaded", created_at: new Date(Date.now() - 91_000).toISOString() });
  const first = await complete(request(), context());
  const replay = await complete(request(), context());
  for (const response of [first, replay]) {
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ data: { status: "completed", sessionId: "session-1" } });
  }
  expect(mockProcess).toHaveBeenCalledTimes(1);
  expect(mockProcess).toHaveBeenCalledWith(expect.anything(), "stale-import", userId);
  expect(mockEnqueue).toHaveBeenCalledTimes(1);
  expect(mockEnqueue).toHaveBeenCalledWith({
    type: "watch_session_ready", recipientUserId: userId,
    payload: { session_id: "session-1", beach_name: "Scripps", wave_count: 2 },
    dedupeKey: "watch_session:stale-import:completed",
  }, mockService);
});
