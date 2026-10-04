/** @jest-environment node */
import { NextRequest } from "next/server";

import {
  fakeSwellSupabase,
  swellSnapshot,
  SWELL_EVENT_KEY,
} from "@/__tests__/helpers/swell-share-fixtures";

let mockDb: Parameters<typeof fakeSwellSupabase>[0] = {};

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: () =>
    jest.requireActual("@/__tests__/helpers/swell-share-fixtures").fakeSwellSupabase(mockDb),
}));
jest.mock("@/lib/middleware/api-wrappers", () => {
  const protectionOptions: unknown[] = [];
  return {
    protectionOptions,
    withProtection: (handler: unknown, options: unknown) => {
      protectionOptions.push(options);
      return handler;
    },
  };
});

import { GET } from "@/app/api/swell/[eventKey]/route";

function call(eventKey: string): Promise<Response> {
  return GET(
    new NextRequest(`https://www.quiversurf.app/api/swell/${encodeURIComponent(eventKey)}`),
    { params: Promise.resolve({ eventKey: encodeURIComponent(eventKey) }) },
  );
}

describe("GET /api/swell/[eventKey]", () => {
  beforeEach(() => {
    mockDb = { snapshots: [swellSnapshot()] };
    jest.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  it("is public and rate limited", () => {
    expect(jest.requireMock("@/lib/middleware/api-wrappers").protectionOptions[0]).toEqual({ rateLimit: { key: "public-default" } });
  });

  it("returns the event with a short shared cache", async () => {
    const response = await call(SWELL_EVENT_KEY);
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("public, s-maxage=300, stale-while-revalidate=600");
    const body = await response.json();
    expect(Object.keys(body).sort()).toEqual(
      ["beach", "directionLabel", "eventKey", "faceHeightFt", "history", "peakAt", "peakLocalDate", "periodS", "status"],
    );
    expect(body.eventKey).toBe(SWELL_EVENT_KEY);
    expect(body.history).toHaveLength(1);
  });

  it("resolves an uppercase uuid and answers with the stored lowercase key", async () => {
    const response = await call(SWELL_EVENT_KEY.toUpperCase());
    expect(response.status).toBe(200);
    expect((await response.json()).eventKey).toBe(SWELL_EVENT_KEY);
  });

  it("returns 404 not_found for an unknown event", async () => {
    mockDb = { snapshots: [] };
    const response = await call(SWELL_EVENT_KEY);
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "not_found" });
  });

  it("returns 400 for a malformed key without touching the database", async () => {
    mockDb = { snapshotError: "should not be read" };
    const response = await call("1 OR 1=1");
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "invalid_event_key" });
  });

  it("returns 500 rather than a 200 when the read fails", async () => {
    mockDb = { snapshotError: "boom" };
    const response = await call(SWELL_EVENT_KEY);
    expect(response.status).toBe(500);
  });
});
