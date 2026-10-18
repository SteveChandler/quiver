/** @jest-environment node */
jest.mock("next/server", () => require("@/__tests__/setup/mock-next-server"));
jest.mock("server-only", () => ({}));
const mockUserFrom = jest.fn();
const mockServiceFrom = jest.fn();
const mockAuth = jest.fn();
jest.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: () => ({ from: mockUserFrom, auth: { getUser: mockAuth } }) }));
jest.mock("@/lib/supabase", () => ({
  ...jest.requireActual("@/lib/supabase"),
  createServiceRoleClient: () => ({ from: mockServiceFrom }),
}));
jest.mock("@/lib/middleware/api-wrappers/rate-limit-wrapper", () => ({ withRateLimit: (handler: unknown) => handler }));

import { NextRequest } from "next/server";
import { GET as spots } from "@/app/api/v1/watch/spots/route";
import { GET as devices } from "@/app/api/v1/watch/devices/route";
import { DELETE as unlink } from "@/app/api/v1/watch/devices/[id]/route";

const userId = "987fcdeb-51a2-43c1-a123-456789abcdef";
const deviceId = "123e4567-e89b-42d3-a456-426614174000";
const context = { params: Promise.resolve({ id: deviceId }) };
const savedEnv = { enabled: process.env.GARMIN_WATCH_ENABLED, allow: process.env.GARMIN_WATCH_USER_ALLOWLIST };
const rows: Record<string, unknown> = {};
type Queries = Record<string, Record<string, jest.Mock>[]>;
const userQueries: Queries = {};
const serviceQueries: Queries = {};
let updatedDevice: { id: string } | null;

function query(table: string, recorder: Queries): Record<string, jest.Mock> {
  const q: Record<string, jest.Mock> = {
    select: jest.fn(), eq: jest.fn(), is: jest.fn(), in: jest.fn(), gte: jest.fn(), order: jest.fn(), limit: jest.fn(),
    maybeSingle: jest.fn(), update: jest.fn(), insert: jest.fn(), then: jest.fn(),
  };
  for (const method of ["select", "eq", "is", "in", "gte", "order", "limit"]) q[method].mockReturnValue(q);
  q.update.mockReturnValue(q);
  const result = (): { data: unknown; error: null } => ({
    data: recorder === serviceQueries && q.update.mock.calls.length ? updatedDevice : rows[table], error: null,
  });
  q.maybeSingle.mockImplementation(async () => result());
  q.then.mockImplementation((resolve: (value: unknown) => void) => Promise.resolve(resolve(result())));
  q.insert.mockResolvedValue({ error: null });
  (recorder[table] ??= []).push(q);
  return q;
}

const request = (path: string, method = "GET", token = false): NextRequest => new NextRequest(`http://localhost${path}`, {
  method, headers: token ? { Authorization: "Bearer watch-token" } : {},
});

beforeEach(() => {
  jest.clearAllMocks();
  for (const recorder of [userQueries, serviceQueries]) {
    for (const key of Object.keys(recorder)) delete recorder[key];
  }
  updatedDevice = { id: deviceId };
  process.env.GARMIN_WATCH_ENABLED = "true";
  process.env.GARMIN_WATCH_USER_ALLOWLIST = userId;
  mockAuth.mockResolvedValue({ data: { user: { id: userId } }, error: null });
  mockUserFrom.mockImplementation((table: string) => query(table, userQueries));
  mockServiceFrom.mockImplementation((table: string) => query(table, serviceQueries));
  rows.watch_devices = { id: deviceId, user_id: userId, last_seen_at: new Date().toISOString() };
  rows.profiles = { home_beach_id: "home" };
  rows.beaches = { id: "home", name: "Home", lat: 34, lon: -119 };
  rows.favorite_beaches = [
    { beach_id: "home", beaches: { id: "home", name: "Home", lat: 34, lon: -119 }, custom_spots: null },
    { beach_id: "fav", beaches: { id: "fav", name: "Favorite", lat: 35, lon: -120 }, custom_spots: null },
    { beach_id: null, beaches: null, custom_spots: { id: "custom", name: "Custom", lat: 36, lon: -121 } },
  ];
  rows.session_imports = [];
  rows.watch_uploads = [];
  rows.user_events = null;
});

afterEach(() => jest.useRealTimers());

afterAll(() => {
  if (savedEnv.enabled === undefined) delete process.env.GARMIN_WATCH_ENABLED;
  else process.env.GARMIN_WATCH_ENABLED = savedEnv.enabled;
  if (savedEnv.allow === undefined) delete process.env.GARMIN_WATCH_USER_ALLOWLIST;
  else process.env.GARMIN_WATCH_USER_ALLOWLIST = savedEnv.allow;
});

it("returns home first, de-duplicates, filters invalid coordinates and caps at 20", async () => {
  rows.favorite_beaches = [
    ...(rows.favorite_beaches as unknown[]),
    { beach_id: "bad", beaches: { id: "bad", name: "Bad", lat: null, lon: -1 }, custom_spots: null },
    { beach_id: null, beaches: null, custom_spots: { id: "bad-custom", name: "Bad custom", lat: 35, lon: Infinity } },
    ...Array.from({ length: 25 }, (_, i) => ({ beach_id: `b${i}`, beaches: { id: `b${i}`, name: `Beach ${i}`, lat: 33 + i, lon: -118 }, custom_spots: null })),
  ];
  const response = await spots(request("/api/v1/watch/spots", "GET", true), context);
  expect(response.status).toBe(200);
  const body = await response.json();
  expect(body.data.spots).toHaveLength(20);
  expect(body.data.spots.slice(0, 3)).toEqual([
    { id: "home", name: "Home", lat: 34, lon: -119 },
    { id: "fav", name: "Favorite", lat: 35, lon: -120 },
    { id: "custom", name: "Custom", lat: 36, lon: -121 },
  ]);
  expect(body.data.spots.find((spot: { id: string }) => spot.id === "bad")).toBeUndefined();
  expect(body.data.spots.find((spot: { id: string }) => spot.id === "bad-custom")).toBeUndefined();
});

it("rejects a revoked watch token", async () => {
  rows.watch_devices = null;
  const response = await spots(request("/api/v1/watch/spots", "GET", true), context);
  expect(response.status).toBe(401);
  expect(mockServiceFrom).toHaveBeenCalledWith("watch_devices");
  expect(serviceQueries.watch_devices[0].is).toHaveBeenCalledWith("revoked_at", null);
});

it("lists owned active watches and recent Garmin problems without selecting token_hash", async () => {
  jest.useFakeTimers().setSystemTime(new Date("2026-10-18T12:00:00Z"));
  rows.watch_devices = [{ id: deviceId, user_id: userId, device_name: "Forerunner", device_part_number: "006-B4320-00",
    created_at: "2026-10-17T10:00:00Z", last_seen_at: null, revoked_at: null }];
  rows.session_imports = [{ id: "import-1", user_id: userId, status: "needs_beach", origin: "garmin_watch",
    error: "choose_beach", summary: { inWaterStart: "2026-10-17T12:00:00Z" } }];
  const response = await devices(request("/api/v1/watch/devices"), context);
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ data: {
    devices: [{ id: deviceId, name: "Forerunner", partNumber: "006-B4320-00", linkedAt: "2026-10-17T10:00:00Z", lastSeenAt: null }],
    problems: [{ importId: "import-1", status: "needs_beach", reason: "choose_beach", startedAt: "2026-10-17T12:00:00Z" }],
  } });
  expect(userQueries.watch_devices[0].select).toHaveBeenCalledWith(
    "id, user_id, platform, device_uid, device_part_number, device_name, app_version, created_at, last_seen_at, revoked_at",
  );
  expect(userQueries.watch_devices[0].eq).toHaveBeenCalledWith("user_id", userId);
  expect(userQueries.watch_devices[0].is).toHaveBeenCalledWith("revoked_at", null);
  expect(userQueries.session_imports[0].eq).toHaveBeenCalledWith("origin", "garmin_watch");
  expect(userQueries.session_imports[0].in).toHaveBeenCalledWith("status", ["failed", "needs_beach"]);
  expect(userQueries.session_imports[0].gte).toHaveBeenCalledWith("created_at", "2026-09-18T12:00:00.000Z");
  expect(userQueries.session_imports[0].limit).toHaveBeenCalledWith(50);
  expect(mockServiceFrom).not.toHaveBeenCalled();
});

it("uses the upload header start when an import has no summary", async () => {
  rows.watch_devices = [];
  rows.session_imports = [{ id: "import-2", user_id: userId, status: "failed", origin: "garmin_watch", error: "corrupt", summary: null }];
  rows.watch_uploads = [{ import_id: "import-2", header: { startedAt: "2026-10-17T13:00:00Z" } }];
  const response = await devices(request("/api/v1/watch/devices"), context);
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ data: { problems: [{ importId: "import-2", startedAt: "2026-10-17T13:00:00Z" }] } });
  expect(userQueries.watch_uploads[0].eq).toHaveBeenCalledWith("user_id", userId);
  expect(userQueries.watch_uploads[0].in).toHaveBeenCalledWith("import_id", ["import-2"]);
});

it("returns 404 for another user's watch", async () => {
  rows.watch_devices = { id: deviceId, user_id: "someone-else", revoked_at: null };
  const response = await unlink(request(`/api/v1/watch/devices/${deviceId}`, "DELETE"), context);
  expect(response.status).toBe(404);
  expect(mockServiceFrom).not.toHaveBeenCalled();
});

it("unlinks an owned watch with the service client and clears its token", async () => {
  const response = await unlink(request(`/api/v1/watch/devices/${deviceId}`, "DELETE"), context);
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ data: { unlinked: true } });
  expect(serviceQueries.watch_devices[0].update).toHaveBeenCalledWith({ revoked_at: expect.any(String), token_hash: null });
  expect(serviceQueries.watch_devices[0].eq).toHaveBeenCalledWith("user_id", userId);
  expect(serviceQueries.watch_devices[0].is).toHaveBeenCalledWith("revoked_at", null);
  expect(serviceQueries.user_events[0].insert).toHaveBeenCalledWith(expect.objectContaining({
    user_id: userId, event_type: "garmin_watch_unlinked",
  }));
  for (const q of Object.values(userQueries).flat()) {
    expect(q.update).not.toHaveBeenCalled();
    expect(q.insert).not.toHaveBeenCalled();
  }
});

it("returns success without another event for an already-revoked owned watch", async () => {
  rows.watch_devices = { id: deviceId, user_id: userId, revoked_at: "2026-10-17T12:00:00Z" };
  const response = await unlink(request(`/api/v1/watch/devices/${deviceId}`, "DELETE"), context);
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ data: { unlinked: true } });
  expect(mockServiceFrom).not.toHaveBeenCalled();
});

it("does not emit a second unlink event when another request already revoked the device", async () => {
  updatedDevice = null;
  const response = await unlink(request(`/api/v1/watch/devices/${deviceId}`, "DELETE"), context);
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ data: { unlinked: true } });
  expect(serviceQueries.watch_devices[0].select).toHaveBeenCalledWith("id");
  expect(mockServiceFrom).not.toHaveBeenCalledWith("user_events");
});

it.each([devices, unlink])("returns 404 when the watch flag is off", async handler => {
  process.env.GARMIN_WATCH_ENABLED = "false";
  const response = await handler(request("/api/v1/watch/devices", "DELETE"), context);
  expect(response.status).toBe(404);
  expect(await response.json()).toMatchObject({ success: false, error: "not_found" });
  expect(mockUserFrom).not.toHaveBeenCalled();
  expect(mockServiceFrom).not.toHaveBeenCalled();
});

it("returns 404 for a non-UUID device id", async () => {
  const response = await unlink(request("/api/v1/watch/devices/bad", "DELETE"), { params: Promise.resolve({ id: "bad" }) });
  expect(response.status).toBe(404);
  expect(await response.json()).toMatchObject({ success: false, error: "not_found" });
  expect(mockUserFrom).not.toHaveBeenCalled();
  expect(mockServiceFrom).not.toHaveBeenCalled();
});
