/** @jest-environment node */
// __tests__/app/api/swell-outlook-route.test.ts
jest.mock("server-only", () => ({}));
jest.mock("next/server", () => require("@/__tests__/setup/mock-next-server"));
jest.mock("@/lib/middleware/api-wrappers", () => ({
  ...jest.requireActual("@/lib/middleware/api-wrappers"),
  withRateLimit: (handler: unknown) => handler,
}));
const mockLoad = jest.fn();
jest.mock("@/lib/services/discovery/swell-outlook-loader", () => ({
  loadSwellOutlookForUser: (...args: unknown[]) => mockLoad(...args),
}));
let mockUser: { id: string } | null = null;
jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: jest.fn(() => ({ marker: "service" })),
  createSupabaseServerClient: jest.fn(async () => ({
    auth: { getUser: jest.fn(async () => ({ data: { user: mockUser }, error: null })) },
  })),
}));
const mockBearerClient = jest.fn((_token: string) => ({
  auth: { getUser: jest.fn(async () => ({ data: { user: mockUser }, error: null })) },
}));
jest.mock("@/lib/supabase/bearer-client", () => ({
  createBearerTokenClient: (token: string) => mockBearerClient(token),
}));

import { NextRequest } from "next/server";
import { GET } from "@/app/api/swell/outlook/route";

const originalEnv = { ...process.env };
afterEach(() => { process.env = { ...originalEnv }; jest.restoreAllMocks(); });

const OUTLOOK = { generatedAt: "2026-10-04T18:00:00.000Z", runDate: "2026-10-04", horizonDays: 9, homeBeach: null, swells: [] };

function call(userId: string | null = "user-1", headers?: HeadersInit): Promise<Response> {
  mockUser = userId ? { id: userId } : null;
  return GET(new NextRequest("http://localhost/api/swell/outlook", { headers }));
}

describe("GET /api/swell/outlook", () => {
  beforeEach(() => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    jest.clearAllMocks();
    mockLoad.mockResolvedValue(OUTLOOK);
    process.env.SWELL_OUTLOOK_ENABLED = "true";
    process.env.SWELL_OUTLOOK_USER_ALLOWLIST = "user-1";
  });

  it("is a real 404 when the flag is off, without touching the loader", async () => {
    process.env.SWELL_OUTLOOK_ENABLED = "false";
    const response = await call();
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "not_found" });
    expect(mockLoad).not.toHaveBeenCalled();
  });

  it("is a 404 for a user who is not on the allowlist, and for everyone when the allowlist is empty", async () => {
    expect((await call("someone-else")).status).toBe(404);
    process.env.SWELL_OUTLOOK_USER_ALLOWLIST = "";
    expect((await call()).status).toBe(404);
    expect(mockLoad).not.toHaveBeenCalled();
  });

  it("returns the bare SwellOutlookResponse, uncached, and records the open", async () => {
    const response = await call();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(OUTLOOK);
    expect(response.headers.get("Cache-Control")).toContain("no-store");
    expect(mockLoad).toHaveBeenCalledWith(expect.objectContaining({ userId: "user-1", recordOpen: true }));
  });

  it("treats an empty list as a valid response", async () => {
    const response = await call();
    expect(response.status).toBe(200);
    expect((await response.json()).swells).toEqual([]);
  });

  it("requires authentication before loading private data", async () => {
    const response = await call(null);
    expect(response.status).toBe(401);
    expect(response.headers.get("Cache-Control")).toContain("no-store");
    expect(mockLoad).not.toHaveBeenCalled();
  });

  it("authenticates a native Bearer request and uses the service-role loader", async () => {
    const response = await call("user-1", { Authorization: "Bearer native-token" });
    expect(response.status).toBe(200);
    expect(mockBearerClient).toHaveBeenCalledWith("native-token");
    expect(mockLoad).toHaveBeenCalledWith({ client: { marker: "service" }, userId: "user-1", now: expect.any(Date), recordOpen: true });
  });

  it("returns an uncached 500 if required outlook data cannot load", async () => {
    mockLoad.mockRejectedValueOnce(new Error("private database detail"));
    const response = await call();
    expect(response.status).toBe(500);
    expect(response.headers.get("Cache-Control")).toContain("no-store");
    expect(JSON.stringify(await response.json())).not.toContain("private database detail");
  });

});
