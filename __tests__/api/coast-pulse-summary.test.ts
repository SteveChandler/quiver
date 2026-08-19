/**
 * @jest-environment node
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { NextRequest } from "next/server";

const mockCreateSupabaseServerClient = jest.fn();
const mockFetchLatestNDBCObservation = jest.fn();
const mockGetNearestNDBCStation = jest.fn();
const mockFetchCOOPSData = jest.fn();
const mockGetStationForLocation = jest.fn();
const mockFetchBuoyData = jest.fn();
const mockRankBeaches = jest.fn(async (beaches: Array<{ id: string }>) => beaches);

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: (...args: unknown[]) =>
    mockCreateSupabaseServerClient(...args),
}));

jest.mock("@/lib/services/ndbc-service", () => ({
  getNearestNDBCStation: (...args: unknown[]) => mockGetNearestNDBCStation(...args),
  fetchLatestNDBCObservation: (...args: unknown[]) =>
    mockFetchLatestNDBCObservation(...args),
}));

jest.mock("@/lib/services/cdip", () => ({
  CDIPService: jest.fn().mockImplementation(() => ({
    fetchBuoyData: (...args: unknown[]) => mockFetchBuoyData(...args),
  })),
}));

jest.mock("@/lib/constants/cdip-stations", () => ({
  CDIP_STATIONS: {},
}));

jest.mock("@/lib/services/noaa-coops", () => ({
  NOAACOOPSService: jest.fn().mockImplementation(() => ({
    getStationForLocation: (...args: unknown[]) => mockGetStationForLocation(...args),
    fetchCOOPSData: (...args: unknown[]) => mockFetchCOOPSData(...args),
  })),
}));

jest.mock("@/lib/middleware/api-wrappers", () => {
  const actual = jest.requireActual("@/lib/middleware/api-wrappers");
  return {
    ...actual,
    withRateLimit: (handler: any) => handler,
  };
});

jest.mock("@/lib/recommendations/selection", () => ({
  rankBeaches: (beaches: Array<{ id: string }>) => mockRankBeaches(beaches),
}));

import { GET } from "@/app/api/coast-pulse/summary/route";

describe("GET /api/coast-pulse/summary", () => {
  beforeEach(() => {
    mockCreateSupabaseServerClient.mockReset();
    mockFetchLatestNDBCObservation.mockReset();
    mockGetNearestNDBCStation.mockReset();
    mockFetchCOOPSData.mockReset();
    mockGetStationForLocation.mockReset();
    mockFetchBuoyData.mockReset();
    mockGetNearestNDBCStation.mockResolvedValue(null);
    mockGetStationForLocation.mockReturnValue("9410230");
    mockFetchCOOPSData.mockResolvedValue({ tides: [] });
  });

  it("uses the shared API wrapper module for response helpers", () => {
    const source = readFileSync(
      join(process.cwd(), "app/api/coast-pulse/summary/route.ts"),
      "utf8"
    );

    expect(source).not.toMatch(/from\s+["']@\/lib\/api-utils["']/);
    expect(source).toMatch(/from\s+["']@\/lib\/middleware\/api-wrappers["']/);
  });

  it("returns validation error when coordinates are missing", async () => {
    const response = await GET(
      new NextRequest("http://localhost:3000/api/coast-pulse/summary")
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error).toBe("Invalid or missing lat/lon parameters");
    expect(mockCreateSupabaseServerClient).not.toHaveBeenCalled();
  });

  it("returns a wrapped 500 when setup fails after valid coordinates", async () => {
    const consoleError = jest
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    mockCreateSupabaseServerClient.mockRejectedValue(new Error("setup failed"));

    const response = await GET(
      new NextRequest(
        "http://localhost:3000/api/coast-pulse/summary?lat=32.7&lon=-117.2"
      )
    );
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.success).toBe(false);
    expect(body.error).toBe("setup failed");
    expect(consoleError).toHaveBeenCalledWith(
      "Coast pulse summary error:",
      expect.any(Error)
    );

    consoleError.mockRestore();
  });

  it("selects only forecast fields used by summary formatting", async () => {
    const forecastSelect = jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
        gte: jest.fn().mockReturnValue({
          order: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              maybeSingle: jest.fn().mockResolvedValue({
                data: {
                  wave_height: "3 ft",
                  wave_period: "12s",
                  wave_direction: "SW",
                  swell_1_direction: null,
                  wind_speed: "4 mph",
                  wind_direction: "E",
                  tide_status: "rising",
                  updated_at: "2026-01-01T00:00:00Z",
                },
                error: null,
              }),
            }),
          }),
        }),
      }),
    });
    const beachesSelect = jest.fn().mockReturnValue({
      not: jest.fn().mockReturnValue({
        not: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue({
            data: [
              {
                id: "beach-1",
                name: "Test Beach",
                lat: 32.7,
                lon: -117.2,
                wind_offshore_deg: 90,
              },
            ],
            error: null,
          }),
        }),
      }),
    });

    mockCreateSupabaseServerClient.mockResolvedValue({
      from: jest.fn((table: string) => {
        if (table === "beaches") return { select: beachesSelect };
        if (table === "enhanced_forecasts") return { select: forecastSelect };
        throw new Error(`Unexpected table ${table}`);
      }),
    });

    const response = await GET(
      new NextRequest(
        "http://localhost:3000/api/coast-pulse/summary?lat=32.7&lon=-117.2"
      )
    );

    expect(response.status).toBe(200);
    expect(mockRankBeaches).toHaveBeenCalled();
    expect(forecastSelect).toHaveBeenCalledWith(
      "wave_height, wave_period, wave_direction, swell_1_direction, wind_speed, wind_direction, tide_status, updated_at"
    );
  });
});
