/** @jest-environment node */
jest.mock("next/server", () => require("@/__tests__/setup/mock-next-server"));
jest.mock("server-only", () => ({}));

const mockServiceFrom = jest.fn();
const mockService = { from: mockServiceFrom };
const mockNearby = jest.fn();
const mockBulk = jest.fn();
jest.mock("@/lib/supabase", () => ({
  ...jest.requireActual("@/lib/supabase"),
  createServiceRoleClient: () => mockService,
}));
jest.mock("@/lib/middleware/api-wrappers/rate-limit-wrapper", () => ({ withRateLimit: (handler: unknown) => handler }));
jest.mock("@/lib/services/nearby-beach-service", () => ({
  getCachedNearbyBeachesFromDb: (...args: unknown[]) => mockNearby(...args),
}));
jest.mock("@/app/api/forecasts/bulk/route", () => ({
  bulkForecastHandler: (...args: unknown[]) => mockBulk(...args),
}));

import { NextRequest } from "next/server";
import { GET as beaches } from "@/app/api/v1/watch/beaches/route";

const userId = "987fcdeb-51a2-43c1-a123-456789abcdef";
const at = "2026-10-21T15:00:00.000Z";
const otherAt = "2026-10-21T16:00:00.000Z";
const savedEnv = { enabled: process.env.GARMIN_WATCH_ENABLED, allow: process.env.GARMIN_WATCH_USER_ALLOWLIST };
const rows: Record<string, unknown> = {};
const queries: Record<string, Array<Record<string, jest.Mock>>> = {};

function spot(id: string, lat: number, lon = 0): { id: string; name: string; lat: number; lon: number } {
  return { id, name: id, lat, lon };
}

function favorite(beach: ReturnType<typeof spot>): Record<string, unknown> {
  return { beach_id: beach.id, beaches: beach, custom_spot_id: null, custom_spots: null };
}

function query(table: string): Record<string, jest.Mock> {
  const q: Record<string, jest.Mock> = {
    select: jest.fn(), eq: jest.fn(), is: jest.fn(), in: jest.fn(), order: jest.fn(), update: jest.fn(), maybeSingle: jest.fn(), then: jest.fn(),
  };
  for (const method of ["select", "eq", "is", "in", "order", "update"]) q[method].mockReturnValue(q);
  q.maybeSingle.mockImplementation(async () => ({ data: rows[table], error: null }));
  q.then.mockImplementation((resolve: (value: unknown) => void) => Promise.resolve(resolve({
    data: table === "beaches" ? [rows.beaches] : rows[table], error: null,
  })));
  (queries[table] ??= []).push(q);
  return q;
}

function request(query = ""): NextRequest {
  return new NextRequest(`http://localhost/api/v1/watch/beaches${query}`, {
    headers: { Authorization: "Bearer watch-token" },
  });
}

function bulkData(ids: string[]): Record<string, unknown> {
  return {
    displayForecasts: Object.fromEntries(ids.map((id) => [id, { label: "3-4ft", forecastAt: at }])),
    conditionLabels: Object.fromEntries(ids.map((id) => [id, "FAIR"])),
    displaySwell: {}, todayHeadlines: {}, recommendationHolds: {},
  };
}

async function get(query = ""): Promise<{ response: Response; data: Record<string, unknown> }> {
  const response = await beaches(request(query));
  const body = await response.json();
  return { response, data: body.data };
}

beforeEach(() => {
  jest.clearAllMocks();
  for (const key of Object.keys(queries)) delete queries[key];
  process.env.GARMIN_WATCH_ENABLED = "true";
  process.env.GARMIN_WATCH_USER_ALLOWLIST = userId;
  mockServiceFrom.mockImplementation((table: string) => query(table));
  rows.watch_devices = { id: "device-1", user_id: userId, last_seen_at: new Date().toISOString() };
  rows.profiles = { home_beach_id: "home" };
  rows.beaches = { ...spot("home", 0), timezone: "America/Los_Angeles" };
  rows.favorite_beaches = [favorite(spot("far", 4)), favorite(spot("near", 1))];
  rows.user_location_snapshots = null;
  rows.enhanced_forecasts = [];
  mockNearby.mockResolvedValue({ success: true, data: [] });
  mockBulk.mockImplementation(async (forecastRequest: NextRequest) => {
    const ids = new URL(forecastRequest.url).searchParams.get("beachIds")?.split(",") ?? [];
    return Response.json({ success: true, data: bulkData(ids) });
  });
});

afterAll(() => {
  if (savedEnv.enabled === undefined) delete process.env.GARMIN_WATCH_ENABLED;
  else process.env.GARMIN_WATCH_ENABLED = savedEnv.enabled;
  if (savedEnv.allow === undefined) delete process.env.GARMIN_WATCH_USER_ALLOWLIST;
  else process.env.GARMIN_WATCH_USER_ALLOWLIST = savedEnv.allow;
});

it("puts saved beaches nearest first with a position, then nearby beaches without duplicates", async () => {
  mockNearby.mockResolvedValue({ success: true, data: [
    { ...spot("near", 1), timezone: "UTC" },
    { ...spot("local", 0.2), timezone: "UTC" },
    { ...spot("outer", 2), timezone: "UTC" },
  ] });
  const { response, data } = await get("?lat=0&lon=0");
  expect(response.status).toBe(200);
  expect((data.beaches as Array<{ name: string; saved: boolean }>).map(({ name, saved }) => [name, saved]))
    .toEqual([["home", true], ["near", true], ["far", true], ["local", false], ["outer", false]]);
  expect(mockNearby).toHaveBeenCalledWith(0, 0, 50, 20);
  expect(mockBulk).toHaveBeenCalledTimes(1);
  expect(new URL(mockBulk.mock.calls[0][0].url).searchParams.get("beachIds"))
    .toBe("home,near,far,local,outer");
  expect(mockBulk.mock.calls[0][1]).toMatchObject({ user: { id: userId }, supabase: mockService });
  expect(response.headers.get("Cache-Control")).toContain("no-store");
});

it("keeps home and favorite order without a position and uses saved beaches only", async () => {
  const { data } = await get();
  expect((data.beaches as Array<{ name: string }>).map((beach) => beach.name)).toEqual(["home", "far", "near"]);
  expect(mockNearby).not.toHaveBeenCalled();
  expect(queries.user_location_snapshots[0].eq).toHaveBeenCalledWith("user_id", userId);
});

it("caps saved beaches at five and the combined list at twelve", async () => {
  rows.favorite_beaches = Array.from({ length: 9 }, (_, index) => favorite(spot(`saved-${index}`, index + 1)));
  mockNearby.mockResolvedValue({ success: true, data: [
    { ...spot("saved-8", 9), timezone: "UTC" },
    ...Array.from({ length: 19 }, (_, index) => ({
      ...spot(`nearby-${index}`, index / 10), timezone: "UTC",
    })),
  ] });
  const { data } = await get("?lat=0&lon=0");
  const result = data.beaches as Array<{ saved: boolean; name: string }>;
  expect(result).toHaveLength(12);
  expect(result.filter((beach) => beach.saved)).toHaveLength(5);
  // A saved beach past the five pinned ones is still a nearby beach.
  expect(result.slice(5).map((beach) => beach.name)).toEqual(["saved-8", ...Array.from({ length: 6 }, (_, index) => `nearby-${index}`)]);
});

it("maps EPIC to GOOD and rejects unknown and held labels", async () => {
  mockBulk.mockResolvedValue(Response.json({ success: true, data: {
    displayForecasts: {
      home: { label: "3-4ft", forecastAt: at },
      far: { label: "2ft", forecastAt: at },
      near: { label: "1ft", forecastAt: at },
    },
    conditionLabels: { home: "EPIC", far: "EXCELLENT", near: "GOOD" },
    recommendationHolds: { near: "water_quality_hold" },
  } }));
  const { data } = await get();
  expect(data.beaches).toEqual([
    expect.objectContaining({ name: "home", label: "GOOD", height: "3-4ft" }),
    expect.objectContaining({ name: "far", label: null, height: "2ft" }),
    expect.objectContaining({ name: "near", label: null, height: "1ft" }),
  ]);
});

it("keeps a beach skipped by bulk with null forecast fields", async () => {
  mockBulk.mockResolvedValue(Response.json({ success: true, data: bulkData(["home"]) }));
  const { data } = await get();
  expect((data.beaches as Array<Record<string, unknown>>)[1]).toMatchObject({
    name: "far", label: null, height: null, swell: null, wind: null, tide: null, best: null,
    tideFt: null, tideDir: null, windMph: null, windDeg: null,
  });
});

it("returns null numbers when the display forecast has no matching row", async () => {
  const { data } = await get();
  expect((data.beaches as Array<Record<string, unknown>>)[0]).toMatchObject({
    name: "home", wind: null, tide: null,
    tideFt: null, tideDir: null, windMph: null, windDeg: null,
  });
});

it("does not label a nearby beach on a water quality hold", async () => {
  mockNearby.mockResolvedValue({ success: true, data: [
    { ...spot("held", 0.5), timezone: "UTC", waterQualityHold: "held" },
  ] });
  const { data } = await get("?lat=0&lon=0");
  expect((data.beaches as Array<Record<string, unknown>>).find((beach) => beach.name === "held"))
    .toMatchObject({ label: null, height: "3-4ft" });
});

it("bounds the watch's name and forecast strings", async () => {
  rows.beaches = { ...spot("A".repeat(50), 0), id: "home", timezone: "UTC" };
  mockBulk.mockResolvedValue(Response.json({ success: true, data: {
    displayForecasts: { home: { label: "1".repeat(30), forecastAt: at } },
    conditionLabels: { home: "FAIR" },
  } }));
  const { data } = await get();
  const first = (data.beaches as Array<{ name: string; height: string }>)[0];
  expect(first.name).toHaveLength(40);
  expect(first.height).toHaveLength(20);
});

it("reads wind and tide only from the display forecast timestamp", async () => {
  rows.enhanced_forecasts = [
    { beach_id: "home", forecast_at: otherAt, wind_speed: "99 mph", wind_direction_deg: 180, tide_height: "8.9 ft", tide_status: "falling" },
    // PostgREST's own timestamp format for the same instant as the display row.
    { beach_id: "home", forecast_at: "2026-10-21 15:00:00+00", wind_speed: "8.6 mph", wind_direction_deg: "47", tide_height: "2.14 ft", tide_status: "Rising" },
  ];
  mockBulk.mockResolvedValue(Response.json({ success: true, data: {
    displayForecasts: { home: { label: "3-4ft", forecastAt: at } },
    conditionLabels: { home: "FAIR" },
    displaySwell: { home: { heightFt: 4, periodSeconds: 13, directionDeg: 247.5 } },
    todayHeadlines: { home: { displayWindowStart: "2026-10-21T14:00:00Z", displayWindowEnd: "2026-10-21T16:00:00Z" } },
  } }));
  const { data } = await get();
  expect((data.beaches as Array<Record<string, unknown>>)[0]).toMatchObject({
    swell: "4ft 13s WSW", wind: "9mph NE", tide: "2.1ft rising", best: "7-9AM",
    tideFt: 2.1, tideDir: "rising", windMph: 9, windDeg: 47,
  });
  expect(queries.enhanced_forecasts[0].in).toHaveBeenCalledWith("forecast_at", [at]);
});

it("normalizes a 360-degree wind direction to zero", async () => {
  rows.enhanced_forecasts = [
    { beach_id: "home", forecast_at: at, wind_speed: "5 mph", wind_direction_deg: 360, tide_height: "3.2 ft", tide_status: "Falling" },
  ];
  const { data } = await get();
  expect((data.beaches as Array<Record<string, unknown>>)[0]).toMatchObject({
    tideFt: 3.2, tideDir: "falling", windMph: 5, windDeg: 0,
  });
});

it("keeps non-zero minutes in the beach's local best window", async () => {
  mockBulk.mockResolvedValue(Response.json({ success: true, data: {
    displayForecasts: { home: { label: "3-4ft", forecastAt: at } },
    todayHeadlines: { home: {
      displayWindowStart: "2026-10-21T13:30:00Z",
      displayWindowEnd: "2026-10-21T15:00:00Z",
    } },
  } }));
  const { data } = await get();
  expect((data.beaches as Array<Record<string, unknown>>)[0].best).toBe("6:30-8AM");
});

it("uses the location snapshot when coordinates are absent", async () => {
  rows.user_location_snapshots = { lat: 1.25, lon: -120.5, captured_at: new Date(Date.now() - 30 * 60 * 1000).toISOString() };
  await get();
  expect(mockNearby).toHaveBeenCalledWith(1.25, -120.5, 50, 20);
});

it("ignores a phone location older than two hours", async () => {
  rows.user_location_snapshots = { lat: 1.25, lon: -120.5, captured_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString() };
  const { data } = await get();
  expect(mockNearby).not.toHaveBeenCalled();
  expect((data.beaches as Array<{ saved: boolean }>).every((beach) => beach.saved)).toBe(true);
});

it("returns an empty successful list without calling bulk", async () => {
  rows.profiles = { home_beach_id: null };
  rows.favorite_beaches = [];
  const { response, data } = await get();
  expect(response.status).toBe(200);
  expect(data.beaches).toEqual([]);
  expect(data.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  expect(mockBulk).not.toHaveBeenCalled();
});

it("returns 503 with Retry-After when bulk fails", async () => {
  mockBulk.mockResolvedValue(Response.json({ success: false, error: "timeout" }, { status: 500 }));
  const { response } = await get();
  expect(response.status).toBe(503);
  expect(response.headers.get("Retry-After")).toMatch(/^\d+$/);
});

it("returns 503 with Retry-After when bulk throws", async () => {
  mockBulk.mockRejectedValue(new Error("deadline"));
  const { response } = await get();
  expect(response.status).toBe(503);
  expect(response.headers.get("Retry-After")).toMatch(/^\d+$/);
});

it("rejects a latitude without longitude", async () => {
  const { response } = await get("?lat=34");
  expect(response.status).toBe(400);
  expect(mockBulk).not.toHaveBeenCalled();
  expect(mockNearby).not.toHaveBeenCalled();
});
