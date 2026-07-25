/**
 * @jest-environment node
 */

jest.mock("server-only", () => ({}));
jest.mock("next/server", () => require("@/__tests__/setup/mock-next-server"));

const mockUpsert = jest.fn();
const mockServiceFrom = jest.fn(() => ({ upsert: mockUpsert }));
const mockDeleteEq = jest.fn();
const mockDelete = jest.fn(() => ({ eq: mockDeleteEq }));
const mockUserFrom = jest.fn(() => ({ delete: mockDelete }));

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: () => ({ from: mockServiceFrom }),
}));

jest.mock("@/lib/middleware/api-wrappers", () => {
  const actual = jest.requireActual("@/lib/api-utils");
  return {
    withAuth: (handler: unknown) => handler,
    createErrorResponse: actual.createErrorResponse,
    createSuccessResponse: actual.createSuccessResponse,
    createValidationError: actual.createValidationError,
  };
});

import { NextRequest } from "next/server";
import { DELETE, POST } from "@/app/api/user/location-snapshot/route";
import { expectConsoleErrors } from "@/__tests__/setup/test-utils";

const NOW = new Date("2026-07-19T20:00:00.000Z");

function postRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/user/location-snapshot", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function deleteRequest(): NextRequest {
  return new NextRequest("http://localhost:3000/api/user/location-snapshot", {
    method: "DELETE",
  });
}

function context() {
  return {
    user: { id: "user-1" },
    supabase: { from: mockUserFrom },
    params: {},
  } as never;
}

describe("/api/user/location-snapshot", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(NOW);
    mockUpsert.mockResolvedValue({ error: null });
    mockDeleteEq.mockResolvedValue({ error: null });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("derives timezone, rounds coordinates, and upserts by authenticated user", async () => {
    const response = await POST(
      postRequest({
        user_id: "attacker-user",
        lat: 21.3069,
        lon: -157.8583,
        capturedAt: "2026-07-19T19:55:00.000Z",
        source: "home",
      }),
      context()
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(body).toMatchObject({
      success: true,
      data: {
        capturedAt: "2026-07-19T19:55:00.000Z",
        timezone: "Pacific/Honolulu",
      },
    });
    expect(body.data).not.toHaveProperty("lat");
    expect(body.data).not.toHaveProperty("lon");
    expect(mockServiceFrom).toHaveBeenCalledWith("user_location_snapshots");
    expect(mockUpsert).toHaveBeenCalledWith(
      {
        user_id: "user-1",
        lat: 21.31,
        lon: -157.86,
        timezone: "Pacific/Honolulu",
        captured_at: "2026-07-19T19:55:00.000Z",
        source: "home",
        updated_at: NOW.toISOString(),
      },
      { onConflict: "user_id" }
    );
  });

  it.each([
    ["invalid latitude", { lat: 91, lon: -157.85 }],
    ["invalid longitude", { lat: 21.3, lon: -181 }],
    ["future fix", { lat: 21.3, lon: -157.85, capturedAt: "2026-07-19T20:05:01.000Z" }],
    ["stale fix", { lat: 21.3, lon: -157.85, capturedAt: "2026-07-19T19:45:00.000Z" }],
  ])("rejects %s", async (_label, overrides) => {
    const response = await POST(
      postRequest(
        Object.assign(
          {
            lat: 21.3,
            lon: -157.85,
            capturedAt: "2026-07-19T19:55:00.000Z",
            source: "explore",
          },
          overrides
        )
      ),
      context()
    );

    expect(response.status).toBe(400);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it("rejects malformed JSON", async () => {
    const request = new NextRequest("http://localhost:3000/api/user/location-snapshot", {
      method: "POST",
      body: "{bad-json",
    });

    const response = await POST(request, context());

    expect(response.status).toBe(400);
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it("returns 500 when persistence fails", async () => {
    mockUpsert.mockResolvedValueOnce({ error: { message: "database unavailable" } });

    const response = await POST(
      postRequest({
        lat: 21.3,
        lon: -157.85,
        capturedAt: "2026-07-19T19:55:00.000Z",
        source: "week_scout",
      }),
      context()
    );

    const body = await response.json();

    expect(response.status).toBe(500);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(body).not.toHaveProperty("details");
    expectConsoleErrors([/Failed to store current location/]);
  });

  it("deletes only the authenticated user's row", async () => {
    const response = await DELETE(deleteRequest(), context());

    expect(response.status).toBe(204);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(mockUserFrom).toHaveBeenCalledWith("user_location_snapshots");
    expect(mockDelete).toHaveBeenCalledTimes(1);
    expect(mockDeleteEq).toHaveBeenCalledWith("user_id", "user-1");
  });

  it("returns a private error when deletion fails", async () => {
    mockDeleteEq.mockResolvedValueOnce({ error: { message: "delete failed" } });

    const response = await DELETE(deleteRequest(), context());

    expect(response.status).toBe(500);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expectConsoleErrors([/Failed to delete current location/]);
  });
});
