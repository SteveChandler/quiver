/**
 * Unit tests for Enhanced Forecast Sync Cron Job API
 * Tests the new cron endpoint that orchestrates CDIP + NOAA data ingestion
 */

import { POST, GET } from "@/app/api/cron/enhanced-forecast-sync/route";
import { NextRequest } from "next/server";
import { updateAllBeachForecasts } from "@/lib/utils/forecast-server-utils";

// Mock API response utilities
jest.mock("@/lib/api-utils", () => ({
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

jest.mock("@/lib/utils/forecast-server-utils", () => ({
  updateAllBeachForecasts: jest.fn(),
}));

describe("Enhanced Forecast Sync Cron Job API", () => {
  const originalVercelEnv = process.env.VERCEL_ENV;
  const originalCronBudget = process.env.FORECAST_CRON_TIME_BUDGET_MS;

  const mockRequest = (headers: Record<string, string> = {}) => {
    return {
      headers: {
        get: jest.fn((name: string) => headers[name] || null),
      },
      json: jest.fn(() => Promise.resolve({})),
    } as unknown as NextRequest;
  };

  beforeEach(() => {
    jest.clearAllMocks();

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
      const { validateCronRequest } = require("@/lib/api-utils");
      validateCronRequest.mockReturnValueOnce(false);

      const request = mockRequest({
        authorization: "Bearer invalid-secret",
      });

      const response = await POST(request);
      const data = await response.json();

      expect(data.success).toBe(false);
      expect(data.error).toBe("Unauthorized");
    });

    it("should return forbidden outside production", async () => {
      process.env.VERCEL_ENV = "preview";

      const request = mockRequest({
        authorization: "Bearer valid-cron-secret",
      });

      const response = await POST(request);
      const data = await response.json();

      expect(data.success).toBe(false);
      expect(data.error).toBe("Forbidden");
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
  });
});
