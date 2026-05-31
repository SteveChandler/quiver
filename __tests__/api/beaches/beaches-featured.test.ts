/**
 * @jest-environment node
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { NextRequest } from "next/server";

const mockGetFeaturedBeaches = jest.fn();
const mockSortLandingFeaturedBeaches = jest.fn((beaches: unknown) => beaches);
const mockGetBatchFreshForecastsFromCache = jest.fn();

jest.mock("@/lib/data/server/featured-beaches", () => ({
  getFeaturedBeaches: (...args: unknown[]) => mockGetFeaturedBeaches(...args),
  sortLandingFeaturedBeaches: (...args: unknown[]) =>
    mockSortLandingFeaturedBeaches(args[0]),
}));

jest.mock("@/lib/utils/forecast-service-utils", () => ({
  getBatchFreshForecastsFromCache: (...args: unknown[]) =>
    mockGetBatchFreshForecastsFromCache(...args),
}));

jest.mock("@/lib/utils/regional-forecast-utils", () => ({
  calculateDayScore: jest.fn(() => 0),
}));

jest.mock("@/lib/middleware/api-wrappers", () => {
  const actual = jest.requireActual("@/lib/middleware/api-wrappers");
  return {
    ...actual,
    withRateLimit: (handler: any) => handler,
  };
});

import { GET, POST } from "@/app/api/beaches/featured/route";

describe("GET /api/beaches/featured", () => {
  const beach = {
    id: "beach-1",
    name: "Swamis",
    slug: "swamis",
    city: "Encinitas",
    state: "CA",
    photo_url: "https://example.com/swamis.jpg",
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetFeaturedBeaches.mockResolvedValue({
      beaches: [beach],
      isNearby: false,
    });
    mockGetBatchFreshForecastsFromCache.mockResolvedValue(new Map());
  });

  it("uses the shared API wrapper module for response helpers", () => {
    const source = readFileSync(
      join(process.cwd(), "app/api/beaches/featured/route.ts"),
      "utf8"
    );

    expect(source).not.toMatch(/from\s+["']@\/lib\/api-utils["']/);
    expect(source).toMatch(/from\s+["']@\/lib\/middleware\/api-wrappers["']/);
  });

  it("returns cached featured beaches when coordinates are absent", async () => {
    const response = await GET(
      new NextRequest("http://localhost:3000/api/beaches/featured")
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toContain("max-age");
    expect(mockGetFeaturedBeaches).toHaveBeenCalledWith(undefined);
    expect(mockGetBatchFreshForecastsFromCache).toHaveBeenCalledWith(
      ["beach-1"],
      24
    );
    expect(body.data).toEqual({
      beaches: [beach],
      isNearby: false,
    });
  });

  it("passes valid coordinates through without using the cached response helper", async () => {
    mockGetFeaturedBeaches.mockResolvedValue({
      beaches: [beach],
      isNearby: true,
    });

    const response = await GET(
      new NextRequest(
        "http://localhost:3000/api/beaches/featured?lat=32.7&lon=-117.2"
      )
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockGetFeaturedBeaches).toHaveBeenCalledWith({
      coordinates: { lat: 32.7, lon: -117.2 },
    });
    expect(body.data.isNearby).toBe(true);
  });

  it("returns method-not-allowed for POST", async () => {
    const response = await POST();
    const body = await response.json();

    expect(response.status).toBe(405);
    expect(response.headers.get("Allow")).toBe("GET");
    expect(body.success).toBe(false);
  });
});
