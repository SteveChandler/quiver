/**
 * Unit tests for CDIP-only Enhanced Forecast Sync Cron Job API
 */

import { POST, GET } from "@/app/api/cron/enhanced-forecast-sync-cdip/route";
import { NextRequest } from "next/server";
import { updateCdipBeachForecasts } from "@/lib/utils/forecast-server-utils";
import { readFileSync } from "fs";

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
}));

jest.mock("@sentry/nextjs", () => ({
  flush: jest.fn(() => Promise.resolve(true)),
}));

jest.mock("@/lib/utils/forecast-server-utils", () => ({
  updateCdipBeachForecasts: jest.fn(),
}));

jest.mock("@/lib/cron/outcome", () => ({
  withCronOutcome: jest.fn(async (_options: unknown, handler: () => Promise<unknown>) =>
    handler()
  ),
}));

describe("CDIP Enhanced Forecast Sync Cron Job API", () => {
  const sharedSource = readFileSync(
    "app/api/cron/enhanced-forecast-sync-cdip/_shared.ts",
    "utf8"
  );
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
    require("@/lib/middleware/api-wrappers").validateCronRequest.mockReturnValue(
      true
    );
    process.env.VERCEL_ENV = "production";
    process.env.FORECAST_CRON_TIME_BUDGET_MS = "1";

    (updateCdipBeachForecasts as jest.Mock).mockResolvedValue({
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
    expect(sharedSource).toContain("withCronOutcome");
    expect(sharedSource).toContain('unit: "forecasts_written"');
  });

  it("should successfully run via POST when environment and cron auth are valid", async () => {
    const request = mockRequest({ authorization: "Bearer valid-cron-secret" });
    const response = await POST(request);
    const data = await response.json();

    expect(data.success).toBe(true);
    expect(data.data).toHaveProperty("executionId");
    expect(updateCdipBeachForecasts).toHaveBeenCalledWith(
      expect.objectContaining({ deadlineMs: expect.any(Number) })
    );
  });

  it("should also run via GET (Vercel cron default)", async () => {
    const request = mockRequest({ authorization: "Bearer valid-cron-secret" });
    const response = await GET(request);
    const data = await response.json();

    expect(data.success).toBe(true);
    expect(data.data).toHaveProperty("executionId");
  });

  it("should return forbidden outside production", async () => {
    const { completeCronCheckIn, startCronCheckIn } = require("@/lib/monitoring/sentry-cron");

    process.env.VERCEL_ENV = "preview";
    const request = mockRequest({ authorization: "Bearer valid-cron-secret" });
    const response = await POST(request);
    const data = await response.json();

    expect(data.success).toBe(false);
    expect(data.error).toBe("Forbidden");
    expect(startCronCheckIn).not.toHaveBeenCalled();
    expect(completeCronCheckIn).not.toHaveBeenCalled();
  });

  it("should handle authentication failures", async () => {
    const { completeCronCheckIn, startCronCheckIn } = require("@/lib/monitoring/sentry-cron");
    const { validateCronRequest } = require("@/lib/middleware/api-wrappers");
    validateCronRequest.mockReturnValue(false);

    const request = mockRequest({ authorization: "Bearer invalid-cron-secret" });
    const response = await POST(request);
    const data = await response.json();

    expect(data.success).toBe(false);
    expect(data.error).toBe("Unauthorized");
    expect(updateCdipBeachForecasts).not.toHaveBeenCalled();
    expect(startCronCheckIn).not.toHaveBeenCalled();
    expect(completeCronCheckIn).not.toHaveBeenCalled();
  });
});
