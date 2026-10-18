/** @jest-environment node */
jest.mock("next/server", () => require("@/__tests__/setup/mock-next-server"));
jest.mock("server-only", () => ({}));
const mockFrom = jest.fn();
const mockAuth = jest.fn();
const mockResolve = jest.fn();
jest.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: () => ({ from: mockFrom, auth: { getUser: mockAuth } }) }));
jest.mock("@/lib/supabase", () => ({ ...jest.requireActual("@/lib/supabase") }));
jest.mock("@/lib/middleware/api-wrappers/rate-limit-wrapper", () => ({ withRateLimit: (handler: unknown) => handler }));
jest.mock("@/lib/sessions/imports/resolve-import-beach", () => ({ resolveImportBeach: (...args: unknown[]) => mockResolve(...args) }));

import { NextRequest } from "next/server";
import { GET } from "@/app/api/v1/session-imports/[id]/route";

const userId = "987fcdeb-51a2-43c1-a123-456789abcdef";
const id = "123e4567-e89b-42d3-a456-426614174000";
const context = { params: Promise.resolve({ id }) };
const savedEnv = {
  imports: process.env.SESSION_IMPORTS_ENABLED, importsAllow: process.env.SESSION_IMPORTS_USER_ALLOWLIST,
  garmin: process.env.GARMIN_WATCH_ENABLED, garminAllow: process.env.GARMIN_WATCH_USER_ALLOWLIST,
};
let imported: Record<string, unknown> | null;
let upload: Record<string, unknown> | null;
const queries: Record<string, jest.Mock>[] = [];

beforeEach(() => {
  jest.clearAllMocks();
  queries.length = 0;
  process.env.SESSION_IMPORTS_ENABLED = "false";
  process.env.GARMIN_WATCH_ENABLED = "true";
  process.env.GARMIN_WATCH_USER_ALLOWLIST = userId;
  mockAuth.mockResolvedValue({ data: { user: { id: userId } }, error: null });
  imported = { id, user_id: userId, status: "needs_beach", origin: "garmin_watch",
    summary: { centroid: { lat: 34, lon: -119 }, inWaterStart: "2026-10-17T12:00:00Z" }, session_id: null };
  upload = null;
  mockResolve.mockResolvedValue({ status: "needs_beach", candidates: [{ id: "beach-1", name: "Beach", lat: 34, lon: -119 }] });
  mockFrom.mockImplementation((table: string) => {
    const q: Record<string, jest.Mock> = { select: jest.fn(), eq: jest.fn(), maybeSingle: jest.fn() };
    q.select.mockReturnValue(q);
    q.eq.mockReturnValue(q);
    q.maybeSingle.mockImplementation(async () => ({ data: table === "watch_uploads" ? upload : imported, error: null }));
    queries.push(q);
    return q;
  });
});

afterAll(() => {
  for (const [key, value] of Object.entries({
    SESSION_IMPORTS_ENABLED: savedEnv.imports, SESSION_IMPORTS_USER_ALLOWLIST: savedEnv.importsAllow,
    GARMIN_WATCH_ENABLED: savedEnv.garmin, GARMIN_WATCH_USER_ALLOWLIST: savedEnv.garminAllow,
  })) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

const request = (): NextRequest => new NextRequest(`http://localhost/api/v1/session-imports/${id}`);

it("re-resolves candidates from the stored centroid for needs_beach", async () => {
  const response = await GET(request(), context);
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ data: {
    id, status: "needs_beach", origin: "garmin_watch", startedAt: "2026-10-17T12:00:00Z",
    candidates: [{ id: "beach-1" }], sessionId: null,
  } });
  expect(mockResolve).toHaveBeenCalledWith(expect.anything(), { lat: 34, lon: -119 });
  expect(queries[0].eq).toHaveBeenCalledWith("user_id", userId);
});

it("returns no candidates for completed imports", async () => {
  imported = { ...imported, status: "completed", session_id: "session-1" };
  const response = await GET(request(), context);
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ data: { candidates: [], sessionId: "session-1" } });
  expect(mockResolve).not.toHaveBeenCalled();
});

it("uses a watch upload header when the stored summary has no start", async () => {
  imported = { ...imported, status: "processing", summary: null };
  upload = { import_id: id, header: { startedAt: "2026-10-17T11:00:00Z" } };
  const response = await GET(request(), context);
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ data: { startedAt: "2026-10-17T11:00:00Z", candidates: [] } });
  expect(mockFrom).toHaveBeenCalledWith("watch_uploads");
});

it("hides another user's import", async () => {
  imported = { ...imported, user_id: "someone-else" };
  const response = await GET(request(), context);
  expect(response.status).toBe(404);
  expect(await response.json()).toMatchObject({ success: false, error: "not_found" });
  expect(mockResolve).not.toHaveBeenCalled();
});
