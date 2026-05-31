/**
 * @jest-environment node
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { NextRequest } from "next/server";

const mockCheckForecastHealth = jest.fn();

jest.mock("@/lib/monitoring/forecast-health-check", () => ({
  checkForecastHealth: (...args: unknown[]) => mockCheckForecastHealth(...args),
}));

import { GET, POST } from "@/app/api/health/route";

describe("GET /api/health", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("uses the shared API wrapper module for response helpers", () => {
    const source = readFileSync(
      join(process.cwd(), "app/api/health/route.ts"),
      "utf8"
    );

    expect(source).not.toMatch(/from\s+["']@\/lib\/api-utils["']/);
    expect(source).toMatch(/from\s+["']@\/lib\/middleware\/api-wrappers["']/);
  });

  it("returns the shallow health response without running deep checks", async () => {
    const response = await GET(
      new NextRequest("http://localhost:3000/api/health")
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      success: true,
      data: {
        status: "healthy",
        service: "quiver-surf-app",
      },
    });
    expect(mockCheckForecastHealth).not.toHaveBeenCalled();
  });

  it("maps deep forecast health metrics into the response", async () => {
    mockCheckForecastHealth.mockResolvedValue({
      healthStatus: "healthy",
      enhancedAvailable: true,
      coveragePercentage: 80,
      beachesWithForecasts: 10,
      beachesWithStaleData: 2,
      averageForecastAge: 1.24,
      sources: { noaa: true },
      issues: [],
    });

    const response = await GET(
      new NextRequest("http://localhost:3000/api/health?deep=true")
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockCheckForecastHealth).toHaveBeenCalledTimes(1);
    expect(body.data).toMatchObject({
      status: "healthy",
      checks: {
        database: true,
        enhancedForecasts: {
          coverage: 80,
          freshCount: 8,
          staleCount: 2,
          averageAgeHours: 1.2,
        },
        sources: { noaa: true },
      },
      issues: [],
    });
  });

  it("returns method-not-allowed for POST", async () => {
    const response = await POST();
    const body = await response.json();

    expect(response.status).toBe(405);
    expect(response.headers.get("Allow")).toBe("GET");
    expect(body.success).toBe(false);
    expect(body.error).toBe("Method Not Allowed");
  });
});
