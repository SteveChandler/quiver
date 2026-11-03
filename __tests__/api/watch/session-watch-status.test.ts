/** @jest-environment node */
jest.mock("next/server", () => require("@/__tests__/setup/mock-next-server"));
jest.mock("server-only", () => ({}));

const mockUserFrom = jest.fn();
const mockAuth = jest.fn();

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: () => ({ from: mockUserFrom, auth: { getUser: mockAuth } }),
}));
jest.mock("@/lib/middleware/api-wrappers/rate-limit-wrapper", () => ({ withRateLimit: (handler: unknown) => handler }));

import { NextRequest } from "next/server";
import { GET } from "@/app/api/v1/sessions/[id]/watch-status/route";

const userId = "987fcdeb-51a2-43c1-a123-456789abcdef";
const sessionId = "123e4567-e89b-42d3-a456-426614174000";
const importId = "123e4567-e89b-42d3-a456-426614174003";

type Row = Record<string, unknown>;
let rows: Record<string, Row[]>;
let equalities: Array<[string, string, unknown]>;
let claimsError: { code: string; message: string } | null;

function queryFor(table: string): unknown {
  const filters: Array<(row: Row) => boolean> = [];
  const query = {
    select: () => query,
    eq: (key: string, value: unknown) => {
      equalities.push([table, key, value]);
      filters.push(row => row[key] === value);
      return query;
    },
    is: (key: string, value: unknown) => { filters.push(row => (row[key] ?? null) === value); return query; },
    lte: (key: string, value: string) => { filters.push(row => String(row[key]) <= value); return query; },
    gte: (key: string, value: string) => { filters.push(row => String(row[key]) >= value); return query; },
    in: (key: string, values: unknown[]) => { filters.push(row => values.includes(row[key])); return query; },
    then: (resolve: (value: unknown) => unknown) => Promise.resolve({
      data: (rows[table] ?? []).filter(row => filters.every(filter => filter(row))), error: null,
    }).then(resolve),
    maybeSingle: async () => table === "session_watch_claims" && claimsError ? { data: null, error: claimsError }
      : { data: (rows[table] ?? []).find(row => filters.every(filter => filter(row))) ?? null, error: null },
  };
  return query;
}

function request(id = sessionId): Promise<Response> {
  return GET(new NextRequest(`http://localhost/api/v1/sessions/${id}/watch-status`), { params: Promise.resolve({ id }) });
}

beforeEach(() => {
  jest.clearAllMocks();
  equalities = [];
  claimsError = null;
  rows = { sessions: [{ id: sessionId, user_id: userId, deleted_at: null, source: "manual", status: "completed" }],
    session_watch_claims: [], session_imports: [], session_tracks: [] };
  mockAuth.mockResolvedValue({ data: { user: { id: userId } }, error: null });
  mockUserFrom.mockImplementation(queryFor);
});

it("reports no claim for a session the phone did not claim", async () => {
  const response = await request();
  expect(response.status).toBe(200);
  expect((await response.json()).data).toEqual({ claim: "none", importId: null, importStatus: null, claimedAt: null,
    watchSessionId: null, mergedFields: [], keptFields: [] });
});

it("reports a pending claim before the watch upload lands", async () => {
  rows.session_watch_claims.push({ session_id: sessionId, user_id: userId, claimed_import_id: null, claimed_at: null,
    merge_result: null, window_start: "2026-11-03T13:54:56Z", window_end: "2026-11-03T16:30:38Z" });
  expect((await (await request()).json()).data).toMatchObject({ claim: "pending", importId: null, watchSessionId: null,
    mergedFields: [] });
});

it("reports the merge: what came from the watch and what the phone kept", async () => {
  const keptFields = [{ field: "rating", phoneValue: 4, watchValue: 3 }];
  rows.session_watch_claims.push({ session_id: sessionId, user_id: userId, claimed_import_id: importId,
    claimed_at: "2026-11-03T16:01:58Z", merge_result: { mergedFields: ["arrival_time", "duration_minutes"], keptFields } });
  rows.session_imports.push({ id: importId, user_id: userId, status: "completed" });
  expect((await (await request()).json()).data).toEqual({ claim: "claimed", importId, importStatus: "completed",
    claimedAt: "2026-11-03T16:01:58Z", watchSessionId: null, mergedFields: ["arrival_time", "duration_minutes"], keptFields });
});

it("reports a claimed import that is still processing with no merge yet", async () => {
  rows.session_watch_claims.push({ session_id: sessionId, user_id: userId, claimed_import_id: importId,
    claimed_at: "2026-11-03T16:01:58Z", merge_result: null });
  rows.session_imports.push({ id: importId, user_id: userId, status: "uploaded" });
  expect((await (await request()).json()).data).toMatchObject({ claim: "claimed", importStatus: "uploaded",
    mergedFields: [], keptFields: [] });
});

it("returns 404 for another user's or a deleted session and scopes every read to the caller", async () => {
  rows.sessions = [{ id: sessionId, user_id: "someone-else", deleted_at: null }];
  expect((await request()).status).toBe(404);
  rows.sessions = [{ id: sessionId, user_id: userId, deleted_at: "2026-11-03T17:00:00Z" }];
  expect((await request()).status).toBe(404);
  expect(equalities.filter(([, key]) => key === "user_id").every(([, , value]) => value === userId)).toBe(true);
});

it("rejects a non-uuid id with 400 and an anonymous caller with 401", async () => {
  expect((await request("not-a-uuid")).status).toBe(400);
  mockAuth.mockResolvedValue({ data: { user: null }, error: null });
  expect((await request()).status).toBe(401);
});

it.each(["42P01", "PGRST205"])("reports no claim before the claims table exists (%s)", async code => {
  claimsError = { code, message: "missing" };
  const response = await request();
  expect(response.status).toBe(200);
  expect((await response.json()).data).toMatchObject({ claim: "none" });
});

it("returns 500 for any other claims read failure", async () => {
  claimsError = { code: "57014", message: "statement timeout" };
  expect((await request()).status).toBe(500);
});

describe("a claim the watch import never honoured", () => {
  const watchSessionId = "123e4567-e89b-42d3-a456-426614174009";
  const watchImportId = "123e4567-e89b-42d3-a456-426614174010";

  function pendingClaim(): void {
    rows.session_watch_claims.push({ session_id: sessionId, user_id: userId, claimed_import_id: null, claimed_at: null,
      merge_result: null, window_start: "2026-11-03T13:54:56Z", window_end: "2026-11-03T16:30:38Z" });
  }

  function watchSession(extra: Row = {}, track: Row = {}): void {
    rows.sessions.push({ id: watchSessionId, user_id: userId, deleted_at: null, source: "garmin_watch",
      status: "completed", ...extra });
    rows.session_tracks.push({ session_id: watchSessionId, user_id: userId, import_id: watchImportId,
      started_at: "2026-11-03T14:29:30Z", ended_at: "2026-11-03T15:59:24Z", ...track });
    rows.session_imports.push({ id: watchImportId, user_id: userId, status: "completed" });
  }

  it("reports superseded with the watch session when a completed watch session's track overlaps the claim", async () => {
    pendingClaim();
    watchSession();
    expect((await (await request()).json()).data).toEqual({ claim: "superseded", importId: watchImportId,
      importStatus: "completed", claimedAt: null, watchSessionId, mergedFields: [], keptFields: [] });
  });

  it("prefers the watch session whose track overlaps the claim most", async () => {
    pendingClaim();
    watchSession({}, { started_at: "2026-11-03T16:20:00Z", ended_at: "2026-11-03T17:30:00Z" });
    const bigger = "123e4567-e89b-42d3-a456-426614174011";
    rows.sessions.push({ id: bigger, user_id: userId, deleted_at: null, source: "garmin_watch", status: "completed" });
    rows.session_tracks.push({ session_id: bigger, user_id: userId, import_id: "bigger-import",
      started_at: "2026-11-03T14:30:00Z", ended_at: "2026-11-03T15:59:00Z" });
    expect((await (await request()).json()).data).toMatchObject({ claim: "superseded", watchSessionId: bigger });
  });

  it.each([
    ["a deleted watch session", { deleted_at: "2026-11-03T17:00:00Z" }, {}],
    ["a phone session", { source: "manual" }, {}],
    ["a planned watch session", { status: "planned" }, {}],
    ["another user's watch session", { user_id: "someone-else" }, { user_id: "someone-else" }],
    ["a track outside the window", {}, { started_at: "2026-11-03T17:00:00Z", ended_at: "2026-11-03T18:00:00Z" }],
  ])("stays pending beside %s", async (_label, session, track) => {
    pendingClaim();
    watchSession(session, track);
    expect((await (await request()).json()).data).toMatchObject({ claim: "pending", watchSessionId: null });
  });
});
