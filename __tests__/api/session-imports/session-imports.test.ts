/** @jest-environment node */
jest.mock("next/server", () => require("@/__tests__/setup/mock-next-server"));
jest.mock("server-only", () => ({}));
const mockFrom = jest.fn();
const mockServiceFrom = jest.fn();
const mockAuth = jest.fn();
const mockProcess = jest.fn();
jest.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: () => ({ from: mockFrom, auth: { getUser: mockAuth } }) }));
jest.mock("@/lib/supabase", () => ({
  ...jest.requireActual("@/lib/supabase"),
  createServiceRoleClient: () => ({ from: mockServiceFrom }),
}));
jest.mock("@/lib/middleware/api-wrappers/rate-limit-wrapper", () => ({ withRateLimit: (handler: unknown) => handler }));
jest.mock("@/lib/sessions/imports/process-import", () => ({
  ...jest.requireActual("@/lib/sessions/imports/process-import"),
  processImport: (...args: unknown[]) => mockProcess(...args),
}));

import { NextRequest } from "next/server";
import { POST as create } from "@/app/api/v1/session-imports/route";
import { POST as processFile, maxDuration as processDuration } from "@/app/api/v1/session-imports/[id]/process/route";
import { POST as chooseBeach, maxDuration as beachDuration } from "@/app/api/v1/session-imports/[id]/beach/route";
import { TrackFileError } from "@/lib/sessions/tracks/types";

const userId = "987fcdeb-51a2-43c1-a123-456789abcdef";
const id = "123e4567-e89b-42d3-a456-426614174000";
const beachId = "123e4567-e89b-42d3-a456-426614174001";
const context = { params: Promise.resolve({ id }) };
const request = (body?: unknown): NextRequest => new NextRequest("http://localhost/api/v1/session-imports", {
  method: "POST", headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body),
});
let query: Record<string, jest.Mock>;
let insert: jest.Mock;
let imported: { id: string; user_id: string; status: string } | null;
let beach: { id: string; deleted_at: string | null } | null;
let dbError: unknown;
const savedEnv = { enabled: process.env.SESSION_IMPORTS_ENABLED, allowed: process.env.SESSION_IMPORTS_USER_ALLOWLIST };

beforeEach(() => {
  jest.clearAllMocks();
  process.env.SESSION_IMPORTS_ENABLED = "true";
  process.env.SESSION_IMPORTS_USER_ALLOWLIST = userId;
  mockAuth.mockResolvedValue({ data: { user: { id: userId } }, error: null });
  imported = { id, user_id: userId, status: "uploaded" };
  beach = { id: beachId, deleted_at: null };
  dbError = null;
  query = { select: jest.fn(), eq: jest.fn(), is: jest.fn(), maybeSingle: jest.fn(), single: jest.fn() };
  for (const key of ["select", "eq", "is"]) query[key].mockImplementation(() => query);
  mockFrom.mockImplementation((table: string) => {
    const get = async (): Promise<unknown> => ({ data: table === "beaches" ? beach : imported, error: dbError });
    query.maybeSingle.mockImplementation(get);
    query.single.mockImplementation(get);
    return query;
  });
  insert = jest.fn().mockResolvedValue({ error: null });
  mockServiceFrom.mockReturnValue({ insert });
  mockProcess.mockResolvedValue({ status: "completed", sessionId: "session-1", attached: false, summary: { waveCount: 3 } });
});

afterAll(() => {
  if (savedEnv.enabled === undefined) delete process.env.SESSION_IMPORTS_ENABLED;
  else process.env.SESSION_IMPORTS_ENABLED = savedEnv.enabled;
  if (savedEnv.allowed === undefined) delete process.env.SESSION_IMPORTS_USER_ALLOWLIST;
  else process.env.SESSION_IMPORTS_USER_ALLOWLIST = savedEnv.allowed;
});

it.each([create, processFile, chooseBeach])("hides each route when the flag is off", async handler => {
  process.env.SESSION_IMPORTS_ENABLED = "false";
  const response = await handler(request({ filename: "x.fit", beachId }), context);
  expect(response.status).toBe(404);
  expect(await response.json()).toMatchObject({ success: false, error: "not_found" });
  expect(mockFrom).not.toHaveBeenCalled();
  expect(mockServiceFrom).not.toHaveBeenCalled();
});

it("requires an authenticated user", async () => {
  mockAuth.mockResolvedValue({ data: { user: null }, error: null });
  expect((await create(request({ filename: "x.fit" }), context)).status).toBe(401);
  expect(insert).not.toHaveBeenCalled();
});

it("creates a server-generated UUID using the service client and preserves the extension of long names", async () => {
  const filename = `${"a".repeat(150)} / surf.FIT`;
  const response = await create(request({ filename }), context);
  const body = await response.json();
  expect(response.status).toBe(201);
  expect(body.success).toBe(true);
  expect(body.data.importId).toMatch(/^[0-9a-f-]{36}$/);
  const safe = body.data.uploadPath.split("/")[2];
  expect(safe.length).toBeLessThanOrEqual(100);
  expect(safe).toMatch(/^[A-Za-z0-9._-]+\.FIT$/);
  expect(body.data.uploadPath).toBe(`${body.data.importId}/${userId}/${safe}`);
  expect(mockServiceFrom).toHaveBeenCalledWith("session_imports");
  expect(insert).toHaveBeenCalledWith({ id: body.data.importId, user_id: userId, storage_path: body.data.uploadPath, original_filename: filename });
  expect(response.headers.get("Cache-Control")).toContain("no-store");
});

it.each(["", "a".repeat(201), 42])("rejects invalid filenames %s", async filename => {
  expect((await create(request({ filename }), context)).status).toBe(400);
  expect(insert).not.toHaveBeenCalled();
});

it.each([processFile, chooseBeach])("hides imports owned by another user", async handler => {
  imported!.user_id = "other";
  const response = await handler(request({ beachId }), context);
  expect(response.status).toBe(404);
  expect(await response.json()).toMatchObject({ error: "not_found" });
  expect(mockProcess).not.toHaveBeenCalled();
});

it("maps completed and needs_beach responses to the agreed envelope", async () => {
  let response = await processFile(request(), context);
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ success: true, data: { status: "completed", sessionId: "session-1", attached: false, summary: { waveCount: 3 } } });
  mockProcess.mockResolvedValue({ status: "needs_beach", importId: id, candidates: [] });
  response = await processFile(request(), context);
  expect(response.status).toBe(202);
  expect(await response.json()).toMatchObject({ success: true, data: { status: "needs_beach", importId: id, candidates: [] } });
});

it.each([processFile, chooseBeach])("maps duplicate to a real 409 with sessionId in details", async handler => {
  imported!.status = "needs_beach";
  mockProcess.mockResolvedValue({ status: "duplicate", sessionId: "existing" });
  const response = await handler(request({ beachId }), context);
  expect(response.status).toBe(409);
  expect(await response.json()).toMatchObject({ success: false, error: "duplicate", details: { sessionId: "existing" } });
});

it.each(["no_gps", "corrupt", "bad_time", "unsupported_format"] as const)("maps %s to 422", async code => {
  mockProcess.mockRejectedValue(new TrackFileError(code, code));
  const response = await processFile(request(), context);
  expect(response.status).toBe(422);
  expect(await response.json()).toMatchObject({ success: false, error: code });
});

it("rejects beach confirmation unless the import needs a beach", async () => {
  const response = await chooseBeach(request({ beachId }), context);
  expect(response.status).toBe(409);
  expect(await response.json()).toMatchObject({ error: "not_needs_beach" });
  expect(mockProcess).not.toHaveBeenCalled();
});

it.each([null, { id: beachId, deleted_at: "2026-10-17" }])("rejects missing or deleted beaches", async value => {
  imported!.status = "needs_beach";
  beach = value;
  expect((await chooseBeach(request({ beachId }), context)).status).toBe(400);
  expect(mockProcess).not.toHaveBeenCalled();
});

it("validates the beach UUID", async () => {
  imported!.status = "needs_beach";
  expect((await chooseBeach(request({ beachId: "bad" }), context)).status).toBe(400);
  expect(mockProcess).not.toHaveBeenCalled();
});

it("passes a live beach override and returns the completed contract", async () => {
  imported!.status = "needs_beach";
  const response = await chooseBeach(request({ beachId }), context);
  expect(response.status).toBe(200);
  expect(mockProcess).toHaveBeenCalledWith(expect.objectContaining({ now: expect.any(Date) }), id, userId, beachId);
});

it("maps a raw Postgrest failure to a real 500", async () => {
  const errorLog = jest.spyOn(console, "error").mockImplementation(() => {});
  mockProcess.mockRejectedValue({ code: "XX000", message: "RPC failed" });
  try {
    const response = await processFile(request(), context);
    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({ success: false });
  } finally {
    errorLog.mockRestore();
  }
});


it("allows 60 seconds for both processing routes", () => {
  expect(processDuration).toBe(60);
  expect(beachDuration).toBe(60);
});

it.each([processFile, chooseBeach])("returns not_found for a mismatched import storage path", async handler => {
  imported!.status = "needs_beach";
  // Use the real pipeline's rejection so the route proves the domain-error mapping.
  const { processImport: actualProcess } = jest.requireActual("@/lib/sessions/imports/process-import");
  const importedRow = { ...imported, storage_path: `${id}/someone-else/watch.fit` };
  const download = jest.fn();
  const lookup: any = { select: () => lookup, eq: () => lookup, single: async () => ({ data: importedRow, error: null }) };
  mockProcess.mockImplementation(() => actualProcess({ userClient: {}, serviceClient: {
    from: () => lookup, storage: { from: () => ({ download }) },
  }, now: new Date() }, id, userId));
  const response = await handler(request({ beachId }), context);
  expect(response.status).toBe(404);
  expect(await response.json()).toMatchObject({ success: false, error: "not_found" });
  expect(download).not.toHaveBeenCalled();
});

it.each([processFile, chooseBeach])("maps a concurrent duplicate with no session to 409 and explicit null details", async handler => {
  imported!.status = "needs_beach";
  mockProcess.mockResolvedValue({ status: "duplicate", sessionId: null });
  const response = await handler(request({ beachId }), context);
  expect(response.status).toBe(409);
  expect(await response.json()).toMatchObject({ success: false, error: "duplicate", details: { sessionId: null } });
});
