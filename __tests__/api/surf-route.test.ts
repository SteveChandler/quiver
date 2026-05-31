/**
 * @jest-environment node
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { NextRequest } from "next/server";

jest.mock("@/app/api/surf/utils", () => ({
  getSurfForecast: jest.fn(),
}));

import { GET } from "@/app/api/surf/route";
import { getSurfForecast } from "@/app/api/surf/utils";

const mockGetSurfForecast = getSurfForecast as jest.MockedFunction<
  typeof getSurfForecast
>;
type SurfForecastResponse = Awaited<ReturnType<typeof getSurfForecast>>;

function mockForecastResponse(
  overrides: Partial<SurfForecastResponse> = {}
): SurfForecastResponse {
  return {
    beach: "Ocean Beach",
    coords: { lat: 32.75, lon: -117.25 },
    forecast: {
      wave_height: "3 ft",
      water_temp: "62 F",
      wind_speed: "8 mph",
      forecast_date: "2026-05-26",
      forecast_time: "06:00",
    },
    ...overrides,
  };
}

describe("GET /api/surf", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetSurfForecast.mockResolvedValue(mockForecastResponse());
  });

  it("uses the shared API wrapper module for response helpers", () => {
    const source = readFileSync(
      join(process.cwd(), "app/api/surf/route.ts"),
      "utf8"
    );

    expect(source).not.toMatch(/from\s+["']@\/lib\/api-utils["']/);
    expect(source).toMatch(/from\s+["']@\/lib\/middleware\/api-wrappers["']/);
  });

  it("validates that a beach or coordinates are present", async () => {
    const consoleLog = jest.spyOn(console, "log").mockImplementation(() => undefined);

    const response = await GET(new NextRequest("http://localhost:3000/api/surf"));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toMatchObject({
      success: false,
      error:
        "Either beach name or coordinates required (lat/lon preferred; lat/lng accepted)",
    });
    expect(mockGetSurfForecast).not.toHaveBeenCalled();

    consoleLog.mockRestore();
  });

  it("passes normalized coordinates to getSurfForecast", async () => {
    const consoleLog = jest.spyOn(console, "log").mockImplementation(() => undefined);

    const response = await GET(
      new NextRequest("http://localhost:3000/api/surf?lat=32.75&lng=-117.25")
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockGetSurfForecast).toHaveBeenCalledWith({
      coords: { lat: 32.75, lon: -117.25 },
    });
    expect(body.success).toBe(true);
    expect(body.data).toEqual(mockForecastResponse());

    consoleLog.mockRestore();
  });

  it("passes beach names through to getSurfForecast", async () => {
    const consoleLog = jest.spyOn(console, "log").mockImplementation(() => undefined);

    const response = await GET(
      new NextRequest("http://localhost:3000/api/surf?beach=Ocean%20Beach")
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockGetSurfForecast).toHaveBeenCalledWith({ beach: "Ocean Beach" });
    expect(body.success).toBe(true);

    consoleLog.mockRestore();
  });

  it("normalizes a forecast array to the first forecast object", async () => {
    const consoleLog = jest.spyOn(console, "log").mockImplementation(() => undefined);
    mockGetSurfForecast.mockResolvedValue(
      mockForecastResponse({
        forecast: [
          {
            wave_height: "4 ft",
            water_temp: "61 F",
            wind_speed: "10 mph",
            forecast_date: "2026-05-26",
            forecast_time: "07:00",
          },
        ],
      } as unknown as Partial<SurfForecastResponse>)
    );

    const response = await GET(
      new NextRequest("http://localhost:3000/api/surf?beach=Ocean%20Beach")
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.forecast).toEqual({
      wave_height: "4 ft",
      water_temp: "61 F",
      wind_speed: "10 mph",
      forecast_date: "2026-05-26",
      forecast_time: "07:00",
    });

    consoleLog.mockRestore();
  });

  it("wraps empty forecast arrays as no-data errors", async () => {
    const consoleLog = jest.spyOn(console, "log").mockImplementation(() => undefined);
    const consoleError = jest
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    mockGetSurfForecast.mockResolvedValue(
      mockForecastResponse({
        forecast: [],
      } as unknown as Partial<SurfForecastResponse>)
    );

    const response = await GET(
      new NextRequest("http://localhost:3000/api/surf?beach=Ocean%20Beach")
    );
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toMatchObject({
      success: false,
      error: "No forecast data available",
    });

    consoleLog.mockRestore();
    consoleError.mockRestore();
  });

  it("wraps getSurfForecast failures", async () => {
    const consoleLog = jest.spyOn(console, "log").mockImplementation(() => undefined);
    const consoleError = jest
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    mockGetSurfForecast.mockRejectedValue(new Error("forecast failed"));

    const response = await GET(
      new NextRequest("http://localhost:3000/api/surf?beach=Ocean%20Beach")
    );
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toMatchObject({
      success: false,
      error: "Failed to fetch surf forecast",
    });
    expect(consoleError).toHaveBeenCalledWith(
      "Surf forecast error:",
      expect.any(Error)
    );

    consoleLog.mockRestore();
    consoleError.mockRestore();
  });
});
