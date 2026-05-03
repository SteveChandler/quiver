/**
 * Tests for the consolidated enhanced-forecast-sync dispatch cron route.
 * The dispatch route collapses four per-shard vercel.json entries into
 * one by resolving the shard from current UTC time.
 */

import {
  POST,
  GET,
} from "@/app/api/cron/enhanced-forecast-sync-dispatch/route";
import { resolveShardFromTime } from "@/app/api/cron/enhanced-forecast-sync/_shared";
import { NextRequest } from "next/server";
import { updateAllBeachForecasts } from "@/lib/utils/forecast-server-utils";

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

describe("resolveShardFromTime", () => {
  it("maps (even hour, :00) → shard 0", () => {
    expect(resolveShardFromTime(new Date("2026-04-20T00:00:00Z"))).toEqual({
      shard: 0,
      shardCount: 4,
    });
    expect(resolveShardFromTime(new Date("2026-04-20T04:15:00Z"))).toEqual({
      shard: 0,
      shardCount: 4,
    });
  });

  it("maps (even hour, :30) → shard 1", () => {
    expect(resolveShardFromTime(new Date("2026-04-20T00:30:00Z"))).toEqual({
      shard: 1,
      shardCount: 4,
    });
    expect(resolveShardFromTime(new Date("2026-04-20T12:45:00Z"))).toEqual({
      shard: 1,
      shardCount: 4,
    });
  });

  it("maps (odd hour, :00) → shard 2", () => {
    expect(resolveShardFromTime(new Date("2026-04-20T01:00:00Z"))).toEqual({
      shard: 2,
      shardCount: 4,
    });
    expect(resolveShardFromTime(new Date("2026-04-20T23:20:00Z"))).toEqual({
      shard: 2,
      shardCount: 4,
    });
  });

  it("maps (odd hour, :30) → shard 3", () => {
    expect(resolveShardFromTime(new Date("2026-04-20T01:30:00Z"))).toEqual({
      shard: 3,
      shardCount: 4,
    });
    expect(resolveShardFromTime(new Date("2026-04-20T23:59:00Z"))).toEqual({
      shard: 3,
      shardCount: 4,
    });
  });

  it("throws for unsupported shardCount", () => {
    expect(() =>
      resolveShardFromTime(new Date("2026-04-20T00:00:00Z"), 3),
    ).toThrow(/shardCount=4/);
  });
});

describe("Enhanced Forecast Sync Dispatch route", () => {
  const originalVercelEnv = process.env.VERCEL_ENV;
  const originalCronBudget = process.env.FORECAST_CRON_TIME_BUDGET_MS;

  const mockRequest = (
    headers: Record<string, string> = {},
    url = "http://localhost/api/cron/enhanced-forecast-sync-dispatch",
  ) => {
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
    require("@/lib/api-utils").validateCronRequest.mockReturnValue(true);
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

  it("falls back to time-based shard resolution when URL omits shard params", async () => {
    const request = mockRequest({ authorization: "Bearer valid-cron-secret" });

    const response = await GET(request);
    const data = await response.json();

    expect(data.success).toBe(true);
    // Can't assert exact shard (depends on wall clock), but shard/shardCount
    // MUST be present and numerically valid.
    expect(updateAllBeachForecasts).toHaveBeenCalledWith(
      expect.objectContaining({
        shard: expect.any(Number),
        shardCount: 4,
      }),
    );
    const callArg = (updateAllBeachForecasts as jest.Mock).mock.calls[0][0];
    expect(callArg.shard).toBeGreaterThanOrEqual(0);
    expect(callArg.shard).toBeLessThan(4);
  });

  it("still honours explicit URL shard params when provided", async () => {
    const request = mockRequest(
      { authorization: "Bearer valid-cron-secret" },
      "http://localhost/api/cron/enhanced-forecast-sync-dispatch?shard=2&shardCount=4",
    );

    await POST(request);

    expect(updateAllBeachForecasts).toHaveBeenCalledWith(
      expect.objectContaining({ shard: 2, shardCount: 4 }),
    );
  });

  it("rejects non-production environments", async () => {
    process.env.VERCEL_ENV = "preview";

    const request = mockRequest({ authorization: "Bearer valid-cron-secret" });

    const response = await POST(request);
    const data = await response.json();

    expect(data.success).toBe(false);
    expect(data.error).toBe("Forbidden");
  });

  it("rejects unauthorized cron requests", async () => {
    const { validateCronRequest } = require("@/lib/api-utils");
    validateCronRequest.mockReturnValue(false);

    const request = mockRequest({ authorization: "Bearer wrong" });

    const response = await POST(request);
    const data = await response.json();

    expect(data.success).toBe(false);
    expect(data.error).toBe("Unauthorized");
  });
});
