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
  rows = { sessions: [{ id: sessionId, user_id: userId, deleted_at: null }], session_watch_claims: [], session_imports: [] };
  mockAuth.mockResolvedValue({ data: { user: { id: userId } }, error: null });
  mockUserFrom.mockImplementation(queryFor);
});

it("reports no claim for a session the phone did not claim", async () => {
  const response = await request();
  expect(response.status).toBe(200);
  expect((await response.json()).data).toEqual({ claim: "none", importId: null, importStatus: null, claimedAt: null,
    mergedFields: [], keptFields: [] });
});

it("reports a pending claim before the watch upload lands", async () => {
  rows.session_watch_claims.push({ session_id: sessionId, user_id: userId, claimed_import_id: null, claimed_at: null, merge_result: null });
  expect((await (await request()).json()).data).toMatchObject({ claim: "pending", importId: null, mergedFields: [] });
});

it("reports the merge: what came from the watch and what the phone kept", async () => {
  const keptFields = [{ field: "rating", phoneValue: 4, watchValue: 3 }];
  rows.session_watch_claims.push({ session_id: sessionId, user_id: userId, claimed_import_id: importId,
    claimed_at: "2026-11-03T16:01:58Z", merge_result: { mergedFields: ["arrival_time", "duration_minutes"], keptFields } });
  rows.session_imports.push({ id: importId, user_id: userId, status: "completed" });
  expect((await (await request()).json()).data).toEqual({ claim: "claimed", importId, importStatus: "completed",
    claimedAt: "2026-11-03T16:01:58Z", mergedFields: ["arrival_time", "duration_minutes"], keptFields });
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
