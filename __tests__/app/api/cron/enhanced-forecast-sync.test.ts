/**
 * Unit tests for Enhanced Forecast Sync Cron Job API
 * Tests the new cron endpoint that orchestrates CDIP + NOAA data ingestion
 */

import { POST, GET } from "@/app/api/cron/enhanced-forecast-sync/route";
import { NextRequest } from "next/server";
import { updateAllBeachForecasts } from "@/lib/utils/forecast-server-utils";
import { readFileSync } from "fs";

// Mock API response utilities
jest.mock("@/lib/middleware/api-wrappers", () => ({
  createSuccessResponse: jest.fn((data, status = 200) => ({
    json: jest.fn(() =>
      Promise.resolve({
        success: true,
        data,
        timestamp: new Date().toISOString(),
      })
    ),
    status,
  })),
  createErrorResponse: jest.fn((error, details, status = 500) => ({
    json: jest.fn(() =>
      Promise.resolve({
        success: false,
        error,
        details,
        timestamp: new Date().toISOString(),
      })
    ),
    status,
  })),
  validateCronRequest: jest.fn(() => true),
}));

jest.mock("@/lib/monitoring/forecast-logger", () => ({
  forecastLogger: {
    cronStart: jest.fn(),
    cronComplete: jest.fn(),
    cronFailed: jest.fn(),
  },
}));

jest.mock("@/lib/monitoring/sentry-cron", () => ({
  startCronCheckIn: jest.fn(() => "check-in-id"),
  completeCronCheckIn: jest.fn(),
  getEnhancedShardMonitorSlug: jest.fn((shard?: number) =>
    shard === undefined
      ? "forecast-enhanced-unsharded"
      : `forecast-enhanced-shard-${shard}`
  ),
  getEnhancedShardSchedule: jest.fn(() => "0 * * * *"),
}));

jest.mock("@sentry/nextjs", () => ({
  flush: jest.fn(() => Promise.resolve(true)),
}));

jest.mock("@/lib/utils/forecast-server-utils", () => ({
  updateAllBeachForecasts: jest.fn(),
}));

describe("Enhanced Forecast Sync Cron Job API", () => {
  const sharedSource = readFileSync(
    "app/api/cron/enhanced-forecast-sync/_shared.ts",
    "utf8"
  );
  const originalVercelEnv = process.env.VERCEL_ENV;
  const originalCronBudget = process.env.FORECAST_CRON_TIME_BUDGET_MS;

  const mockRequest = (headers: Record<string, string> = {}, url = "http://localhost/api/cron/enhanced-forecast-sync") => {
    return {
      url,
      headers: {
        get: jest.fn((name: string) => headers[name] || null),
      },
      json: jest.fn(() => Promise.resolve({})),
    } as unknown as NextRequest;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    require("@/lib/middleware/api-wrappers").validateCronRequest.mockReturnValue(
      true
    );

    process.env.VERCEL_ENV = "production";
    process.env.FORECAST_CRON_TIME_BUDGET_MS = "1";

    (updateAllBeachForecasts as jest.Mock).mockResolvedValue({
      success: true,
      results: [],
      summary: { total: 2, successful: 2, failed: 0, duration: "0.01s" },
    });
  });

  afterAll(() => {
    if (originalVercelEnv === undefined) {
      delete process.env.VERCEL_ENV;
    } else {
      process.env.VERCEL_ENV = originalVercelEnv;
    }
    if (originalCronBudget === undefined) {
      delete process.env.FORECAST_CRON_TIME_BUDGET_MS;
    } else {
      process.env.FORECAST_CRON_TIME_BUDGET_MS = originalCronBudget;
    }
  });

  it("uses the API wrapper barrel for response helpers and cron request validation", () => {
    expect(sharedSource).not.toContain("@/lib/api-utils");
    expect(sharedSource).toContain("@/lib/middleware/api-wrappers");
  });

  describe("POST /api/cron/enhanced-forecast-sync", () => {
    it("should successfully run when environment and cron auth are valid", async () => {
      const request = mockRequest({
        authorization: "Bearer valid-cron-secret",
      });

      const response = await POST(request);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty("executionId");
      expect(data.data).toHaveProperty("success", true);
      expect(data.data).toHaveProperty("summary");
      expect(data.data.summary).toEqual(
        expect.objectContaining({ total: 2, successful: 2, failed: 0 })
      );

      // Deadline should be passed down so the service can self-timebox.
      expect(updateAllBeachForecasts).toHaveBeenCalledWith(
        expect.objectContaining({ deadlineMs: expect.any(Number) })
      );
    });

    it("should handle authentication failures", async () => {
      const { validateCronRequest } = require("@/lib/middleware/api-wrappers");
      const {
        startCronCheckIn,
        completeCronCheckIn,
      } = require("@/lib/monitoring/sentry-cron");
      validateCronRequest.mockReturnValue(false);

      const request = mockRequest({
        authorization: "Bearer invalid-secret",
      });

      const response = await POST(request);
      const data = await response.json();

      expect(data.success).toBe(false);
      expect(data.error).toBe("Unauthorized");
      expect(startCronCheckIn).not.toHaveBeenCalled();
      expect(completeCronCheckIn).not.toHaveBeenCalled();
    });

    it("should return forbidden outside production", async () => {
      const {
        startCronCheckIn,
        completeCronCheckIn,
      } = require("@/lib/monitoring/sentry-cron");
      process.env.VERCEL_ENV = "preview";

      const request = mockRequest({
        authorization: "Bearer valid-cron-secret",
      });

      const response = await POST(request);
      const data = await response.json();

      expect(data.success).toBe(false);
      expect(data.error).toBe("Forbidden");
      expect(startCronCheckIn).not.toHaveBeenCalled();
      expect(completeCronCheckIn).not.toHaveBeenCalled();
    });
  });

  describe("GET /api/cron/enhanced-forecast-sync", () => {
    it("should also run via GET (Vercel cron default)", async () => {
      const request = mockRequest({
        authorization: "Bearer valid-cron-secret",
      });

      const response = await GET(request);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty("executionId");
    });

    it("should pass shard parameters from query string to updateAllBeachForecasts", async () => {
      const request = mockRequest(
        { authorization: "Bearer valid-cron-secret" },
        "http://localhost/api/cron/enhanced-forecast-sync?shard=1&shardCount=4"
      );

      const response = await GET(request);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(updateAllBeachForecasts).toHaveBeenCalledWith(
        expect.objectContaining({
          deadlineMs: expect.any(Number),
          shard: 1,
          shardCount: 4,
        })
      );
    });

    it("should not pass shard params when not provided in query string", async () => {
      (updateAllBeachForecasts as jest.Mock).mockClear();
      const request = mockRequest(
        { authorization: "Bearer valid-cron-secret" },
        "http://localhost/api/cron/enhanced-forecast-sync"
      );

      await GET(request);

      expect(updateAllBeachForecasts).toHaveBeenCalledWith(
        expect.objectContaining({
          deadlineMs: expect.any(Number),
          shard: undefined,
          shardCount: undefined,
        })
      );
    });
  });
});
