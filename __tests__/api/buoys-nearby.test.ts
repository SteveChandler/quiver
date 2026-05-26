/**
 * @jest-environment node
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { NextRequest } from "next/server";

const mockRpc = jest.fn();

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: jest.fn(),
}));

jest.mock("@/lib/middleware/api-wrappers", () => {
  const actual = jest.requireActual("@/lib/middleware/api-wrappers");
  return {
    ...actual,
    withBotBlockingAndRateLimit: <T>(handler: T) => handler,
  };
});

import { GET } from "@/app/api/buoys/nearby/route";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const mockCreateSupabaseServerClient =
  createSupabaseServerClient as jest.MockedFunction<
    typeof createSupabaseServerClient
  >;
type MockSupabaseServerClient = Awaited<
  ReturnType<typeof createSupabaseServerClient>
>;

describe("GET /api/buoys/nearby", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateSupabaseServerClient.mockResolvedValue({
      rpc: mockRpc,
    } as unknown as MockSupabaseServerClient);
    mockRpc.mockResolvedValue({ data: [], error: null });
  });

  it("uses the shared API wrapper module for response helpers", () => {
    const source = readFileSync(
      join(process.cwd(), "app/api/buoys/nearby/route.ts"),
      "utf8"
    );

    expect(source).not.toMatch(/from\s+["']@\/lib\/api-utils["']/);
    expect(source).toMatch(/from\s+["']@\/lib\/middleware\/api-wrappers["']/);
  });

  it("validates required coordinates before creating a Supabase client", async () => {
    const response = await GET(
      new NextRequest("http://localhost:3000/api/buoys/nearby?lat=37.7")
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toMatchObject({
      success: false,
      error: "Latitude and longitude are required",
    });
    expect(mockCreateSupabaseServerClient).not.toHaveBeenCalled();
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("queries nearby buoys and maps RPC rows to the API response shape", async () => {
    const consoleLog = jest.spyOn(console, "log").mockImplementation(() => undefined);
    mockRpc.mockResolvedValue({
      data: [
        {
          buoy_uuid: "46237",
          buoy_name: "San Francisco Bar",
          coordinates: { coordinates: [-122.5, 37.7] },
          distance_meters: 1234,
          air_temperature: 14.2,
          water_temperature: 13.7,
          wave_period: 12,
          wave_height: 1.8,
          wind_speed: 8,
          wind_gust: 13,
          wind_direction: 280,
          tides: { next: "high" },
          updated_at: "2026-05-26T12:00:00.000Z",
        },
      ],
      error: null,
    });

    const response = await GET(
      new NextRequest(
        "http://localhost:3000/api/buoys/nearby?lat=37.7&lon=-122.5&limit=2&maxDistance=50000"
      )
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockRpc).toHaveBeenCalledWith("get_nearby_buoys", {
      target_lat: 37.7,
      target_lng: -122.5,
      max_distance_m: 50000,
      result_limit: 2,
    });
    expect(body.success).toBe(true);
    expect(body.data).toEqual([
      {
        id: "46237",
        latitude: 37.7,
        longitude: -122.5,
        name: "San Francisco Bar",
        distance_meters: 1234,
        measurements: {
          air_temperature: 14.2,
          water_temperature: 13.7,
          wave_period: 12,
          wave_height: 1.8,
          wind_speed: 8,
          wind_gust: 13,
          wind_direction: 280,
          tides: { next: "high" },
          updated_at: new Date("2026-05-26T12:00:00.000Z").getTime() / 1000,
        },
      },
    ]);

    consoleLog.mockRestore();
  });

  it("returns an empty success response when the buoy RPC errors", async () => {
    const consoleLog = jest.spyOn(console, "log").mockImplementation(() => undefined);
    const consoleError = jest
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: "rpc failed" },
    });

    const response = await GET(
      new NextRequest("http://localhost:3000/api/buoys/nearby?lat=37.7&lon=-122.5")
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      success: true,
      data: [],
    });
    expect(consoleError).toHaveBeenCalledWith("Database error:", {
      message: "rpc failed",
    });

    consoleLog.mockRestore();
    consoleError.mockRestore();
  });

  it("wraps unexpected setup errors", async () => {
    const consoleError = jest
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    mockCreateSupabaseServerClient.mockRejectedValue(new Error("setup failed"));

    const response = await GET(
      new NextRequest("http://localhost:3000/api/buoys/nearby?lat=37.7&lon=-122.5")
    );
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toMatchObject({
      success: false,
      error: "Error fetching nearby buoys",
    });
    expect(consoleError).toHaveBeenCalledWith("API error:", expect.any(Error));

    consoleError.mockRestore();
  });
});
