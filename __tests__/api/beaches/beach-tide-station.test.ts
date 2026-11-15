/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";

import { buildCityTideView, type CityTideView } from "@/lib/tides/city-tide-view";
import type { TideMetaData } from "@/lib/seo/tide-meta-data";
import { SUB_PAGE_DATA_UNKNOWN } from "@/lib/seo/sub-page-data-availability";

jest.mock("@/lib/middleware/api-wrappers", () => {
  const actual = jest.requireActual("@/lib/middleware/api-wrappers");
  return { ...actual, withBotBlockingAndRateLimit: (handler: unknown) => handler };
});

const mockGetTideMetaData = jest.fn<Promise<TideMetaData>, [string]>();
jest.mock("@/lib/seo/tide-meta-data", () => ({
  ...jest.requireActual("@/lib/seo/tide-meta-data"),
  getTideMetaData: (beachId: string) => mockGetTideMetaData(beachId),
}));

const mockLoadStationTideView = jest.fn<Promise<CityTideView | null>, [string, number]>();
jest.mock("@/lib/tides/city-tide-view", () => ({
  ...jest.requireActual("@/lib/tides/city-tide-view"),
  loadStationTideView: (id: string, at: number) => mockLoadStationTideView(id, at),
}));

// Import after mocks
const { GET } = require("@/app/api/beaches/[id]/tide-station/route");

const BEACH_ID = "66ef3c08-a8a2-4cf1-9361-273489bac45b";

const ROWS: TideMetaData = {
  source: "noaa",
  stationId: "TWC0427",
  nextHighTime: null,
  nextLowTime: null,
  nextHighHeight: null,
  nextLowHeight: null,
  nextHighAt: null,
  nextLowAt: null,
};

// TWC0427 on Nov 14 2026, NOAA table + the 1.5 ft California adjustment, in metres.
const VIEW = buildCityTideView({
  timeZone: "America/Los_Angeles",
  renderedAtMs: Date.parse("2026-11-15T03:00:00Z"),
  station: { name: "Los Patos (highway bridge)", slug: "los-patos-highway-bridge-ca-twc0427", sourceStationId: "TWC0427" },
  hourly: [],
  extremes: [
    { ts: "2026-11-15T04:24:00Z", type: "low", heightM: 0.565 },
    { ts: "2026-11-14T19:49:00Z", type: "high", heightM: 1.722 },
    { ts: "2026-11-15T20:42:00Z", type: "high", heightM: 1.62 },
  ],
});

async function call(id: string): Promise<{ status: number; body: Record<string, any>; cdn: string | null }> {
  const request = new NextRequest(`http://localhost/api/beaches/${id}/tide-station`);
  const response = await GET(request, { params: Promise.resolve({ id }) });
  return { status: response.status, body: await response.json(), cdn: response.headers.get("Vercel-CDN-Cache-Control") };
}

describe("GET /api/beaches/[id]/tide-station", () => {
  beforeEach(() => {
    mockGetTideMetaData.mockReset().mockResolvedValue(ROWS);
    mockLoadStationTideView.mockReset().mockResolvedValue(VIEW);
    jest.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  it("sends the station's highs and lows in time order, in unrounded feet", async () => {
    const { status, body, cdn } = await call(BEACH_ID);
    expect(status).toBe(200);
    expect(cdn).toBe("max-age=1800, stale-while-revalidate=3600");
    expect(mockLoadStationTideView).toHaveBeenCalledWith("TWC0427", expect.any(Number));
    expect(body.data.timeZone).toBe("America/Los_Angeles");
    expect(body.data.station).toEqual({ name: "Los Patos (highway bridge)", slug: "los-patos-highway-bridge-ca-twc0427", sourceStationId: "TWC0427" });
    expect(body.data.extremes.map((e: { at: string; type: string }) => [e.at, e.type])).toEqual([
      ["2026-11-14T19:49:00Z", "high"],
      ["2026-11-15T04:24:00Z", "low"],
      ["2026-11-15T20:42:00Z", "high"],
    ]);
    // 0.565 m = 1.8537 ft: unrounded, so the app's toFixed(1) prints 1.9 like the station page.
    expect(body.data.extremes[1].heightFt).toBeCloseTo(1.8537, 3);
  });

  it("sends a curve that passes through each high and low", async () => {
    const { body } = await call(BEACH_ID);
    const curve: Array<{ at: string; heightFt: number }> = body.data.curve;
    expect(curve.length).toBeGreaterThan(2);
    const low = curve.find((p) => p.at === "2026-11-15T04:24:00.000Z");
    expect(low?.heightFt).toBeCloseTo(1.8537, 3);
    expect(curve.every((p, i) => i === 0 || Date.parse(p.at) > Date.parse(curve[i - 1].at))).toBe(true);
  });

  it("answers null, briefly cached, when the tide rows name no station", async () => {
    mockGetTideMetaData.mockResolvedValue({ ...ROWS, stationId: null, source: "fes2022" });
    const { status, body, cdn } = await call(BEACH_ID);
    expect(status).toBe(200);
    expect(body.data).toBeNull();
    expect(cdn).toBe("max-age=60");
    expect(mockLoadStationTideView).not.toHaveBeenCalled();
  });

  it("answers null when NOAA has no table for the station", async () => {
    mockLoadStationTideView.mockResolvedValue(null);
    const { status, body, cdn } = await call(BEACH_ID);
    expect(status).toBe(200);
    expect(body.data).toBeNull();
    expect(cdn).toBe("max-age=60");
  });

  it("answers 503, not a cached null, when the stored-row read failed", async () => {
    mockGetTideMetaData.mockResolvedValue({ ...ROWS, stationId: null, availability: SUB_PAGE_DATA_UNKNOWN });
    const { status, cdn } = await call(BEACH_ID);
    expect(status).toBe(503);
    expect(cdn).toBeNull();
  });

  it("answers 500, never a null answer, for an unexpected error", async () => {
    mockGetTideMetaData.mockRejectedValue(new TypeError("boom"));
    const { status, body, cdn } = await call(BEACH_ID);
    expect(status).toBe(500);
    expect(body.success).toBe(false);
    expect(cdn).toBeNull();
  });

  it("answers 400 for an id that is not a uuid", async () => {
    expect(await call("not-a-uuid")).toMatchObject({ status: 400, cdn: null });
    expect(mockGetTideMetaData).not.toHaveBeenCalled();
  });
});
