/** @jest-environment node */
jest.mock("next/server", () => require("@/__tests__/setup/mock-next-server"));
jest.mock("server-only", () => ({}));
const mockServiceFrom = jest.fn();
const mockService = { from: mockServiceFrom };
const mockComputeSurfCall = jest.fn();
jest.mock("@/lib/supabase", () => ({
  ...jest.requireActual("@/lib/supabase"),
  createServiceRoleClient: () => mockService,
}));
jest.mock("@/lib/middleware/api-wrappers/rate-limit-wrapper", () => ({ withRateLimit: (handler: unknown) => handler }));
jest.mock("@/lib/services/surf-call/canonical-surf-call", () => ({
  computeCanonicalSurfCall: (...args: unknown[]) => mockComputeSurfCall(...args),
}));

import { NextRequest } from "next/server";
import { GET as glance } from "@/app/api/v1/watch/glance/route";

const userId = "987fcdeb-51a2-43c1-a123-456789abcdef";
const savedEnv = { enabled: process.env.GARMIN_WATCH_ENABLED, allow: process.env.GARMIN_WATCH_USER_ALLOWLIST };
const rows: Record<string, unknown> = {};

function query(table: string): Record<string, jest.Mock> {
  const q: Record<string, jest.Mock> = {
    select: jest.fn(), eq: jest.fn(), is: jest.fn(), order: jest.fn(), update: jest.fn(), maybeSingle: jest.fn(), then: jest.fn(),
  };
  for (const method of ["select", "eq", "is", "order", "update"]) q[method].mockReturnValue(q);
  q.maybeSingle.mockImplementation(async () => ({ data: rows[table], error: null }));
  q.then.mockImplementation((resolve: (value: unknown) => void) => Promise.resolve(resolve({ data: rows[table], error: null })));
  return q;
}

const request = (query = ""): NextRequest => new NextRequest(`http://localhost/api/v1/watch/glance${query}`, {
  headers: { Authorization: "Bearer watch-token" },
});

function surfCall(overrides: Record<string, unknown> = {}): { status: "ok"; result: Record<string, unknown> } {
  return {
    status: "ok",
    result: {
      report: { verdict: "YES", waveHeight: "3-4ft", updatedAt: "2026-10-19T19:00:00.000Z" },
      conditionLabel: "GOOD",
      isTomorrow: false,
      ...overrides,
    },
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  process.env.GARMIN_WATCH_ENABLED = "true";
  process.env.GARMIN_WATCH_USER_ALLOWLIST = userId;
  mockServiceFrom.mockImplementation((table: string) => query(table));
  rows.watch_devices = { id: "device-1", user_id: userId, last_seen_at: new Date().toISOString() };
  rows.profiles = { home_beach_id: "home" };
  rows.beaches = { id: "home", name: "Ocean Beach", lat: 37.76, lon: -122.51 };
  rows.favorite_beaches = [
    { beach_id: "home", beaches: { id: "home", name: "Ocean Beach", lat: 37.76, lon: -122.51 }, custom_spots: null },
    { beach_id: null, beaches: null, custom_spots: { id: "custom", name: "Secret", lat: 34.01, lon: -118.5 } },
    { beach_id: "malibu", beaches: { id: "malibu", name: "Malibu", lat: 34.03, lon: -118.68 }, custom_spots: null },
  ];
  mockComputeSurfCall.mockResolvedValue(surfCall());
});

afterAll(() => {
  if (savedEnv.enabled === undefined) delete process.env.GARMIN_WATCH_ENABLED;
  else process.env.GARMIN_WATCH_ENABLED = savedEnv.enabled;
  if (savedEnv.allow === undefined) delete process.env.GARMIN_WATCH_USER_ALLOWLIST;
  else process.env.GARMIN_WATCH_USER_ALLOWLIST = savedEnv.allow;
});

it("returns the home beach's surf call for this user when the watch sends no position", async () => {
  const response = await glance(request());
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ data: { glance: {
    beachId: "home", name: "Ocean Beach", height: "3-4ft", label: "GOOD", tomorrow: false, updatedAt: "2026-10-19T19:00:00.000Z",
  } } });
  expect(mockComputeSurfCall).toHaveBeenCalledWith({ supabase: mockService, userId, beachId: "home", boardClass: null });
  expect(response.headers.get("Cache-Control")).toContain("no-store");
});

it("picks the nearest saved beach and never a custom spot", async () => {
  const response = await glance(request("?lat=34.01&lon=-118.5"));
  expect(response.status).toBe(200);
  expect((await response.json()).data.glance).toMatchObject({ beachId: "malibu", name: "Malibu" });
  expect(mockComputeSurfCall).toHaveBeenCalledWith(expect.objectContaining({ beachId: "malibu" }));
});

it("passes through tomorrow's call and a missing label", async () => {
  mockComputeSurfCall.mockResolvedValue(surfCall({ conditionLabel: undefined, isTomorrow: true }));
  const body = await (await glance(request())).json();
  expect(body.data.glance).toMatchObject({ label: null, tomorrow: true });
});

it("returns a null glance when the user has no saved beach", async () => {
  rows.profiles = { home_beach_id: null };
  rows.favorite_beaches = [{ beach_id: null, beaches: null, custom_spots: { id: "custom", name: "Secret", lat: 34, lon: -118 } }];
  const response = await glance(request());
  expect(response.status).toBe(200);
  expect((await response.json()).data).toEqual({ glance: null });
  expect(mockComputeSurfCall).not.toHaveBeenCalled();
});

it("returns 503 with Retry-After when the surf call is unavailable", async () => {
  mockComputeSurfCall.mockResolvedValue({ status: "unavailable", error: new Error("timeout") });
  const response = await glance(request());
  expect(response.status).toBe(503);
  expect(response.headers.get("Retry-After")).toMatch(/^\d+$/);
});

it.each(["?lat=34", "?lat=91&lon=0", "?lat=abc&lon=1", "?lat=&lon=-118"])("rejects bad coordinates %s", async query => {
  const response = await glance(request(query));
  expect(response.status).toBe(400);
  expect(mockComputeSurfCall).not.toHaveBeenCalled();
});

it("rejects a revoked watch token", async () => {
  rows.watch_devices = null;
  const response = await glance(request());
  expect(response.status).toBe(401);
  expect(mockComputeSurfCall).not.toHaveBeenCalled();
});
