/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";

import { createFixtureSource } from "@/lib/buoy-pages/dev-fixture-source";
import type { BuoyPageSource } from "@/lib/buoy-pages/source";

jest.mock("@/lib/middleware/api-wrappers", () => {
  const actual = jest.requireActual("@/lib/middleware/api-wrappers");
  return { ...actual, withBotBlockingAndRateLimit: (handler: unknown) => handler };
});

let mockSource: BuoyPageSource;
jest.mock("@/lib/buoy-pages/source", () => {
  const actual = jest.requireActual("@/lib/buoy-pages/source");
  return { ...actual, getBuoyPageSource: jest.fn(async () => mockSource) };
});

// Import after mocks
const { GET } = require("@/app/api/beaches/[id]/buoy/route");

const BEACH_ID = "5a0e0e0e-1111-4222-8333-944444444444";

function fixtureSource(overrides: Partial<BuoyPageSource> = {}): BuoyPageSource {
  return { ...createFixtureSource({ shiftToNow: true }), ...overrides };
}

async function call(id: string): Promise<{ status: number; body: Record<string, any>; cdn: string | null }> {
  const request = new NextRequest(`http://localhost/api/beaches/${id}/buoy`);
  const response = await GET(request, { params: Promise.resolve({ id }) });
  return { status: response.status, body: await response.json(), cdn: response.headers.get("Vercel-CDN-Cache-Control") };
}

const CDN_CACHE = "max-age=300, stale-while-revalidate=600";

describe("GET /api/beaches/[id]/buoy", () => {
  beforeEach(() => {
    mockSource = fixtureSource();
    jest.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  it("returns the buoy payload in the success envelope", async () => {
    const { status, body, cdn } = await call(BEACH_ID);
    expect(status).toBe(200);
    expect(cdn).toBe(CDN_CACHE);
    expect(body.success).toBe(true);
    expect(Object.keys(body.data).sort()).toEqual([
      "distanceKm", "history", "now", "observedAt", "reading", "relation", "station", "status", "trend",
    ]);
    expect(body.data).toMatchObject({ relation: "forecast_station", status: "fresh", station: { id: "ndbc:46225" } });
    expect(typeof body.data.observedAt).toBe("string");
    expect(typeof body.data.history[0].t).toBe("string");
  });

  it("answers 400 for an id that is not a uuid", async () => {
    expect(await call("not-a-uuid")).toMatchObject({ status: 400, cdn: null });
  });

  it("answers 404 for a private, deleted or unknown beach", async () => {
    mockSource = fixtureSource({ getStationForBeach: async () => ({ kind: "beach-not-found" }) });
    const { status, body, cdn } = await call(BEACH_ID);
    expect(status).toBe(404);
    // Errors are never stored by a CDN or browser (withErrorNoStore).
    expect(cdn).toBeNull();
    expect(body).toMatchObject({ success: false, error: "Beach not found" });
  });

  it("answers 404 when no buoy is within range", async () => {
    mockSource = fixtureSource({ getStationForBeach: async () => ({ kind: "no-station" }) });
    expect(await call(BEACH_ID)).toMatchObject({ status: 404, body: { error: "No buoy near this beach" } });
  });

  it("answers 404, not 500, while the catalogue migration is not applied", async () => {
    mockSource = fixtureSource({
      getStationForBeach: async () => {
        throw Object.assign(
          new Error("getStationForBeach catalogue: Could not find the table 'public.wave_stations' in the schema cache"),
          { code: "PGRST205" },
        );
      },
    });
    expect(await call(BEACH_ID)).toMatchObject({ status: 404, cdn: null });
  });

  it("answers 500 for any other read failure", async () => {
    mockSource = fixtureSource({
      getLatestObservation: async () => {
        throw new Error("canceling statement due to statement timeout");
      },
    });
    const { status, body, cdn } = await call(BEACH_ID);
    expect(status).toBe(500);
    expect(cdn).toBeNull();
    expect(body.success).toBe(false);
  });
});
