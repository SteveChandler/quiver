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
import { WATCH_CONTRACT } from "@/lib/watch/contract";

const userId = "987fcdeb-51a2-43c1-a123-456789abcdef";
const deviceId = "123e4567-e89b-42d3-a456-426614174000";
const token = "watch-secret";
const handler = jest.fn(async () => NextResponse.json({ ok: true }));
const route = withWatchAuth(handler, { errorMessage: "Watch request failed" });
const context = { params: Promise.resolve({ id: "route-id" }) };
const savedEnv = { enabled: process.env.GARMIN_WATCH_ENABLED, allowed: process.env.GARMIN_WATCH_USER_ALLOWLIST };
let row: { id: string; user_id: string; last_seen_at: string | null; app_version: string | null } | null;
let query: { select: jest.Mock; eq: jest.Mock; is: jest.Mock; maybeSingle: jest.Mock; update: jest.Mock };

function request(authorization?: string, appVersion?: string): NextRequest {
  return new NextRequest("http://localhost/api/v1/watch/surfs", {
    headers: {
      ...(authorization === undefined ? {} : { Authorization: authorization }),
      ...(appVersion === undefined ? {} : { [WATCH_CONTRACT.appVersionHeader]: appVersion }),
    },
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers().setSystemTime(new Date("2026-10-18T12:00:00.000Z"));
  process.env.GARMIN_WATCH_ENABLED = "true";
  process.env.GARMIN_WATCH_USER_ALLOWLIST = userId;
  row = { id: deviceId, user_id: userId, last_seen_at: null, app_version: null };
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

it("rejects an unknown token when the flag is unset and allowlist is empty", async () => {
  delete process.env.GARMIN_WATCH_ENABLED;
  process.env.GARMIN_WATCH_USER_ALLOWLIST = "";
  row = null;
  const response = await route(request(`Bearer ${token}`), context);
  expect(response.status).toBe(401);
  expect(await response.json()).toMatchObject({ success: false, error: "unauthorized" });
  expect(handler).not.toHaveBeenCalled();
  expect(query.update).not.toHaveBeenCalled();
});

it("rejects a revoked device before calling the handler", async () => {
  query.maybeSingle.mockImplementation(async () => ({ data: query.is.mock.calls.some(([field, value]) => field === "revoked_at" && value === null) ? null : row, error: null }));
  const response = await route(request(`Bearer ${token}`), context);
  expect(response.status).toBe(401);
  expect(query.is).toHaveBeenCalledWith("revoked_at", null);
  expect(handler).not.toHaveBeenCalled();
});

it.each(["Bearer", "bearer"])("accepts %s and passes the device, user, service client and resolved params to the handler", async scheme => {
  row!.last_seen_at = "2026-10-18T11:55:00.000Z";
  const response = await route(request(`${scheme} ${token}`), context);
  expect(response.status).toBe(200);
  expect(mockServiceFrom).toHaveBeenCalledWith("watch_devices");
  expect(handler).toHaveBeenCalledWith(expect.any(NextRequest), {
    deviceId, userId, service: mockService, params: { id: "route-id" },
  });
  expect(query.update).not.toHaveBeenCalled();
});

it.each(["flag off", "not allowlisted"])("keeps valid watch uploads retryable when %s", async state => {
  if (state === "flag off") process.env.GARMIN_WATCH_ENABLED = "false";
  else process.env.GARMIN_WATCH_USER_ALLOWLIST = "someone-else";
  const response = await route(request(`Bearer ${token}`), context);
  expect(response.status).toBe(503);
  expect(await response.json()).toMatchObject({ success: false, error: "unavailable" });
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

it("records a new app version inside the 10-minute window in one update", async () => {
  row!.last_seen_at = "2026-10-18T11:55:00.000Z";
  row!.app_version = "1.0.0";
  expect((await route(request(`Bearer ${token}`, "1.1.0+build-2"), context)).status).toBe(200);
  expect(query.select).toHaveBeenCalledWith("id, user_id, last_seen_at, app_version");
  expect(query.update).toHaveBeenCalledTimes(1);
  expect(query.update).toHaveBeenCalledWith({
    app_version: "1.1.0+build-2", last_seen_at: "2026-10-18T12:00:00.000Z",
  });
});

it("skips the update for the same app version inside the 10-minute window", async () => {
  row!.last_seen_at = "2026-10-18T11:55:00.000Z";
  row!.app_version = "1.1.0";
  expect((await route(request(`Bearer ${token}`, "1.1.0"), context)).status).toBe(200);
  expect(query.update).not.toHaveBeenCalled();
});

it.each(["", "v1_0", "1.0 beta", "x".repeat(33)])("ignores an invalid app version header: %s", async appVersion => {
  row!.last_seen_at = "2026-10-18T11:55:00.000Z";
  row!.app_version = "1.0.0";
  expect((await route(request(`Bearer ${token}`, appVersion), context)).status).toBe(200);
  expect(query.update).not.toHaveBeenCalled();
});

it("keeps the last-seen update unchanged without an app version header", async () => {
  row!.app_version = "1.0.0";
  expect((await route(request(`Bearer ${token}`), context)).status).toBe(200);
  expect(query.update).toHaveBeenCalledTimes(1);
  expect(query.update).toHaveBeenCalledWith({ last_seen_at: "2026-10-18T12:00:00.000Z" });
});

it("updates a stale device and its new app version in one write", async () => {
  row!.last_seen_at = "2026-10-18T11:49:59.000Z";
  row!.app_version = "1.0.0";
  expect((await route(request(`Bearer ${token}`, "1.1.0"), context)).status).toBe(200);
  expect(query.update).toHaveBeenCalledTimes(1);
  expect(query.update).toHaveBeenCalledWith({
    app_version: "1.1.0", last_seen_at: "2026-10-18T12:00:00.000Z",
  });
});

it.each(["returned", "rejected"])("continues after a %s last_seen_at update error and logs only its message", async failure => {
  const update = jest.fn();
  const message = "activity write failed";
  if (failure === "returned") {
    update.mockResolvedValue({ error: { message, details: `${token} ${hashSecret(token)}` } });
  } else {
    update.mockRejectedValue(new Error(message));
  }
  query.update.mockReturnValue({ eq: update });
  const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
  const errorLog = jest.spyOn(console, "error").mockImplementation(() => {});
  try {
    const response = await route(request(`Bearer ${token}`), context);
    expect(response.status).toBe(200);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(query.update).toHaveBeenCalledWith({ last_seen_at: "2026-10-18T12:00:00.000Z" });
    expect(update).toHaveBeenCalledWith("id", deviceId);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith("[watch-auth] last_seen_at update failed", message);
    expect(errorLog).not.toHaveBeenCalled();
  } finally {
    warn.mockRestore();
    errorLog.mockRestore();
  }
});

it("returns 500 with errorMessage when the device lookup fails", async () => {
  query.maybeSingle.mockResolvedValueOnce({ data: null, error: { message: "lookup failed" } });
  const errorLog = jest.spyOn(console, "error").mockImplementation(() => {});
  try {
    const response = await route(request(`Bearer ${token}`), context);
    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({ success: false, error: "Watch request failed" });
    expect(handler).not.toHaveBeenCalled();
    expect(query.update).not.toHaveBeenCalled();
  } finally {
    errorLog.mockRestore();
  }
});

it("returns 500 with errorMessage when the handler throws", async () => {
  row!.last_seen_at = "2026-10-18T11:55:00.000Z";
  handler.mockRejectedValueOnce(new Error("handler failed"));
  const errorLog = jest.spyOn(console, "error").mockImplementation(() => {});
  try {
    const response = await route(request(`Bearer ${token}`), context);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({ success: false, error: "Watch request failed" });
  } finally {
    errorLog.mockRestore();
  }
});
