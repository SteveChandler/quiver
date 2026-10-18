/** @jest-environment node */
jest.mock("next/server", () => require("@/__tests__/setup/mock-next-server"));
jest.mock("server-only", () => ({}));

const mockServiceFrom = jest.fn();
const mockService = { from: mockServiceFrom };
jest.mock("@/lib/supabase", () => ({
  ...jest.requireActual("@/lib/supabase"),
  createServiceRoleClient: () => mockService,
}));
jest.mock("@/lib/middleware/api-wrappers/rate-limit-wrapper", () => ({ withRateLimit: (handler: unknown) => handler }));

import { NextRequest, NextResponse } from "next/server";
import { withWatchAuth } from "@/lib/watch/with-watch-auth";
import { hashSecret } from "@/lib/watch/device-token";

const userId = "987fcdeb-51a2-43c1-a123-456789abcdef";
const deviceId = "123e4567-e89b-42d3-a456-426614174000";
const token = "watch-secret";
const handler = jest.fn(async () => NextResponse.json({ ok: true }));
const route = withWatchAuth(handler, { errorMessage: "Watch request failed" });
const context = { params: Promise.resolve({ id: "route-id" }) };
const savedEnv = { enabled: process.env.GARMIN_WATCH_ENABLED, allowed: process.env.GARMIN_WATCH_USER_ALLOWLIST };
let row: { id: string; user_id: string; last_seen_at: string | null } | null;
let query: { select: jest.Mock; eq: jest.Mock; is: jest.Mock; maybeSingle: jest.Mock; update: jest.Mock };

function request(authorization?: string): NextRequest {
  return new NextRequest("http://localhost/api/v1/watch/surfs", {
    headers: authorization === undefined ? {} : { Authorization: authorization },
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers().setSystemTime(new Date("2026-10-18T12:00:00.000Z"));
  process.env.GARMIN_WATCH_ENABLED = "true";
  process.env.GARMIN_WATCH_USER_ALLOWLIST = userId;
  row = { id: deviceId, user_id: userId, last_seen_at: null };
  query = {
    select: jest.fn(), eq: jest.fn(), is: jest.fn(), maybeSingle: jest.fn(), update: jest.fn(),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.is.mockReturnValue(query);
  query.update.mockReturnValue(query);
  query.maybeSingle.mockImplementation(async () => ({ data: row, error: null }));
  mockServiceFrom.mockReturnValue(query);
});

afterEach(() => jest.useRealTimers());
afterAll(() => {
  if (savedEnv.enabled === undefined) delete process.env.GARMIN_WATCH_ENABLED;
  else process.env.GARMIN_WATCH_ENABLED = savedEnv.enabled;
  if (savedEnv.allowed === undefined) delete process.env.GARMIN_WATCH_USER_ALLOWLIST;
  else process.env.GARMIN_WATCH_USER_ALLOWLIST = savedEnv.allowed;
});

it.each([undefined, "Basic token", "Bearer", "Bearer   ", "Bearer token extra"])("rejects a missing or malformed Authorization header: %s", async authorization => {
  const response = await route(request(authorization), context);
  expect(response.status).toBe(401);
  expect(await response.json()).toMatchObject({ success: false, error: "unauthorized" });
  expect(mockServiceFrom).not.toHaveBeenCalled();
  expect(handler).not.toHaveBeenCalled();
});

it("rejects an unknown token", async () => {
  row = null;
  const response = await route(request(`Bearer ${token}`), context);
  expect(response.status).toBe(401);
  expect(query.eq).toHaveBeenCalledWith("token_hash", hashSecret(token));
  expect(handler).not.toHaveBeenCalled();
});

it("rejects a revoked device before calling the handler", async () => {
  query.maybeSingle.mockImplementation(async () => ({ data: query.is.mock.calls.some(([field, value]) => field === "revoked_at" && value === null) ? null : row, error: null }));
  const response = await route(request(`Bearer ${token}`), context);
  expect(response.status).toBe(401);
  expect(query.is).toHaveBeenCalledWith("revoked_at", null);
  expect(handler).not.toHaveBeenCalled();
});

it("passes an active device, user, service client and resolved params to the handler", async () => {
  row!.last_seen_at = "2026-10-18T11:55:00.000Z";
  const response = await route(request(`Bearer ${token}`), context);
  expect(response.status).toBe(200);
  expect(handler).toHaveBeenCalledWith(expect.any(NextRequest), {
    deviceId, userId, service: mockService, params: { id: "route-id" },
  });
  expect(query.update).not.toHaveBeenCalled();
});

it("hides devices whose user is not allowlisted", async () => {
  process.env.GARMIN_WATCH_USER_ALLOWLIST = "someone-else";
  const response = await route(request(`Bearer ${token}`), context);
  expect(response.status).toBe(404);
  expect(await response.json()).toMatchObject({ success: false, error: "not_found" });
  expect(handler).not.toHaveBeenCalled();
  expect(query.update).not.toHaveBeenCalled();
});

it.each([null, "2026-10-18T11:49:59.000Z"])("updates stale last_seen_at: %s", async lastSeenAt => {
  row!.last_seen_at = lastSeenAt;
  const response = await route(request(`Bearer ${token}`), context);
  expect(response.status).toBe(200);
  expect(query.update).toHaveBeenCalledWith({ last_seen_at: "2026-10-18T12:00:00.000Z" });
  expect(query.eq).toHaveBeenCalledWith("id", deviceId);
});

it.each(["2026-10-18T11:50:00.000Z", "2026-10-18T11:59:00.000Z"])("skips fresh last_seen_at: %s", async lastSeenAt => {
  row!.last_seen_at = lastSeenAt;
  expect((await route(request(`Bearer ${token}`), context)).status).toBe(200);
  expect(query.update).not.toHaveBeenCalled();
});
