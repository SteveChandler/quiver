/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";
import { GET } from "@/app/api/geo/region/route";
import { FORECAST_REGIONS } from "@/lib/data/forecast-regions";

jest.mock("@/lib/middleware/api-wrappers", () => {
  const actual = jest.requireActual("@/lib/middleware/api-wrappers");
  return {
    ...actual,
    withRateLimit: jest.fn((handler) => handler),
  };
});

function request(headers: Record<string, string> = {}): NextRequest {
  return new NextRequest("https://www.quiversurf.app/api/geo/region", {
    headers,
  });
}

function ipHeaders(lat: string, lon: string): Record<string, string> {
  return {
    "x-vercel-ip-latitude": lat,
    "x-vercel-ip-longitude": lon,
  };
}

describe("GET /api/geo/region", () => {
  it("returns the San Diego region for an IP point in San Diego", async () => {
    const response = await GET(request(ipHeaders("32.75", "-117.25")));
    const sanDiego = FORECAST_REGIONS["san-diego"];

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      region: {
        slug: "san-diego",
        name: sanDiego.name,
        centerLat: sanDiego.centerLat,
        centerLon: sanDiego.centerLon,
      },
    });
  });

  it("returns the closest region, not the default, for another covered metro", async () => {
    const response = await GET(request(ipHeaders("34.05", "-118.24")));

    await expect(response.json()).resolves.toMatchObject({
      region: { slug: "los-angeles" },
    });
  });

  it.each([
    ["Denver", "39.74", "-104.99"],
    ["Tokyo", "35.68", "139.69"],
    ["Las Vegas", "36.17", "-115.14"],
  ])("returns null for %s, more than 200 miles from every region", async (_city, lat, lon) => {
    const response = await GET(request(ipHeaders(lat, lon)));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ region: null });
  });

  it("returns null, not a default region, when the geo headers are missing", async () => {
    const response = await GET(request());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ region: null });
  });

  it("returns null when only one coordinate is present", async () => {
    const response = await GET(
      request({ "x-vercel-ip-latitude": "32.75" }),
    );

    await expect(response.json()).resolves.toEqual({ region: null });
  });

  it.each([
    ["non-numeric", "abc", "def"],
    ["NaN", "NaN", "NaN"],
    ["out of range", "999", "-999"],
    ["empty", "", ""],
  ])("returns null for %s coordinates", async (_label, lat, lon) => {
    const response = await GET(request(ipHeaders(lat, lon)));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ region: null });
  });

  it("sets a private no-store Cache-Control header on every answer", async () => {
    const withRegion = await GET(request(ipHeaders("32.75", "-117.25")));
    const withoutRegion = await GET(request());

    expect(withRegion.headers.get("Cache-Control")).toMatch(
      /^private, no-store/,
    );
    expect(withoutRegion.headers.get("Cache-Control")).toMatch(
      /^private, no-store/,
    );
  });
});
