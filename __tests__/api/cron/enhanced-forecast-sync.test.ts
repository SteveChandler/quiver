/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";
import { readFileSync } from "fs";
import {
  setupCronTestEnvironment,
  createMockCronRequest,
  verifyIdempotency,
  createMockForecastSyncResult,
  type CronTestEnvironment,
} from "@/__tests__/setup/cron-test-utils";

// Mock the forecast server utils module - must be hoisted before imports
jest.mock("@/lib/utils/forecast-server-utils", () => ({
  updateAllBeachForecasts: jest.fn(),
}));

// Mock the forecast logger to prevent console spam - inline mock definition for hoisting
jest.mock("@/lib/monitoring/forecast-logger", () => ({
  forecastLogger: {
    cronStart: jest.fn(),
    cronComplete: jest.fn(),
    cronFailed: jest.fn(),
  },
}));

// Import route handlers after mocks are set up
import { GET, POST, HEAD } from "@/app/api/cron/enhanced-forecast-sync/route";

// Get references to the mocked modules for assertions
import { updateAllBeachForecasts } from "@/lib/utils/forecast-server-utils";
import { forecastLogger } from "@/lib/monitoring/forecast-logger";

const mockUpdateAllBeachForecasts = updateAllBeachForecasts as jest.MockedFunction<
  typeof updateAllBeachForecasts
>;
const mockForecastLogger = forecastLogger as jest.Mocked<typeof forecastLogger>;

describe("Cron: enhanced-forecast-sync", () => {
  const sharedSource = readFileSync(
    "app/api/cron/enhanced-forecast-sync/_shared.ts",
    "utf8",
  );
  let cronEnv: CronTestEnvironment;

  beforeEach(() => {
    // Set up production environment for cron tests
    cronEnv = setupCronTestEnvironment({ vercelEnv: "production" });
    jest.clearAllMocks();
  });

  afterEach(() => {
    cronEnv.cleanup();
  });

  it("asserts forecasts written as the ingestion outcome", () => {
    expect(sharedSource).toContain("withCronOutcome");
    expect(sharedSource).toContain('unit: "forecasts_written"');
  });

  describe("Authentication", () => {
    it("requires valid cron authentication", async () => {
      // Set up mock to return successful result
      mockUpdateAllBeachForecasts.mockResolvedValue(
        createMockForecastSyncResult()
      );

      // Create request with valid Bearer token
      const request = createMockCronRequest(
        "/api/cron/enhanced-forecast-sync",
        {
          method: "GET",
          authMethod: "bearer-token",
        }
      ) as unknown as NextRequest;

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(mockUpdateAllBeachForecasts).toHaveBeenCalled();
    });

    it("accepts Bearer token authentication", async () => {
      mockUpdateAllBeachForecasts.mockResolvedValue(
        createMockForecastSyncResult()
      );

      const request = createMockCronRequest(
        "/api/cron/enhanced-forecast-sync",
        {
          method: "GET",
          authMethod: "bearer-token",
          cronSecret: "test-cron-secret",
        }
      ) as unknown as NextRequest;

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it("rejects invalid credentials", async () => {
      // Create request with no authentication
      const request = createMockCronRequest(
        "/api/cron/enhanced-forecast-sync",
        {
          method: "GET",
          authMethod: "none",
        }
      ) as unknown as NextRequest;

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.error).toBe("Unauthorized");
      expect(mockUpdateAllBeachForecasts).not.toHaveBeenCalled();
      expect(mockForecastLogger.cronFailed).toHaveBeenCalled();
    });

    it("rejects requests with incorrect Bearer token", async () => {
      const request = createMockCronRequest(
        "/api/cron/enhanced-forecast-sync",
        {
          method: "GET",
          authMethod: "bearer-token",
          cronSecret: "wrong-secret",
        }
      ) as unknown as NextRequest;

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.error).toBe("Unauthorized");
    });
  });

  describe("Environment Checks", () => {
    it("rejects non-production environment", async () => {
      // Clean up production environment and set up development
      cronEnv.cleanup();
      cronEnv = setupCronTestEnvironment({ vercelEnv: "development" });

      const request = createMockCronRequest(
        "/api/cron/enhanced-forecast-sync",
        {
          method: "GET",
          authMethod: "bearer-token",
        }
      ) as unknown as NextRequest;

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.success).toBe(false);
      expect(data.error).toBe("Forbidden");
      expect(data.details).toContain("development");
      expect(mockUpdateAllBeachForecasts).not.toHaveBeenCalled();
      expect(mockForecastLogger.cronFailed).toHaveBeenCalled();
    });

    it("rejects preview environment", async () => {
      cronEnv.cleanup();
      cronEnv = setupCronTestEnvironment({ vercelEnv: "preview" });

      const request = createMockCronRequest(
        "/api/cron/enhanced-forecast-sync",
        {
          method: "GET",
          authMethod: "bearer-token",
        }
      ) as unknown as NextRequest;

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.success).toBe(false);
      expect(data.error).toBe("Forbidden");
    });
  });

  describe("Sync Operations", () => {
    it("syncs all beaches successfully", async () => {
      const syncResult = createMockForecastSyncResult({
        success: true,
        summary: {
          total: 50,
          attempted: 50,
          successful: 48,
          failed: 2,
          duration: "2.5s",
          stoppedEarly: false,
        },
      });
      mockUpdateAllBeachForecasts.mockResolvedValue(syncResult);

      const request = createMockCronRequest(
        "/api/cron/enhanced-forecast-sync",
        {
          method: "GET",
          authMethod: "bearer-token",
        }
      ) as unknown as NextRequest;

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.summary.successful).toBe(48);
      expect(data.data.summary.failed).toBe(2);
      expect(data.data.message).toContain("48/50 beaches updated");
      expect(mockForecastLogger.cronStart).toHaveBeenCalled();
      expect(mockForecastLogger.cronComplete).toHaveBeenCalled();
    });

    it("handles NOAA API timeout gracefully", async () => {
      mockUpdateAllBeachForecasts.mockRejectedValue(
        new Error("Request timed out after 30000ms")
      );

      const request = createMockCronRequest(
        "/api/cron/enhanced-forecast-sync",
        {
          method: "GET",
          authMethod: "bearer-token",
        }
      ) as unknown as NextRequest;

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBe("Enhanced forecast sync failed");
      expect(data.details.error).toContain("timed out");
      expect(mockForecastLogger.cronFailed).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ message: expect.stringContaining("timed out") }),
        expect.any(Object)
      );
    });

    it("retries failed beaches", async () => {
      // The cron job handles retry logic internally via updateAllBeachForecasts
      // This test verifies the behavior is reported correctly
      const syncResult = createMockForecastSyncResult({
        success: true,
        results: [
          { beachId: "beach-1", success: true },
          { beachId: "beach-2", success: false, error: "Timeout" },
          { beachId: "beach-2", success: true, retried: true },
        ],
        summary: {
          total: 2,
          attempted: 2,
          successful: 2,
          failed: 0,
          duration: "3.0s",
          stoppedEarly: false,
        },
      });
      mockUpdateAllBeachForecasts.mockResolvedValue(syncResult);

      const request = createMockCronRequest(
        "/api/cron/enhanced-forecast-sync",
        {
          method: "GET",
          authMethod: "bearer-token",
        }
      ) as unknown as NextRequest;

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.summary.successful).toBe(2);
    });

    it("maintains data consistency on partial failure", async () => {
      // Simulate partial failure - some beaches succeed, others fail
      const syncResult = createMockForecastSyncResult({
        success: true,
        results: [
          { beachId: "beach-1", success: true },
          { beachId: "beach-2", success: true },
          { beachId: "beach-3", success: false, error: "API Error" },
          { beachId: "beach-4", success: true },
          { beachId: "beach-5", success: false, error: "Timeout" },
        ],
        summary: {
          total: 5,
          attempted: 5,
          successful: 3,
          failed: 2,
          duration: "4.5s",
          stoppedEarly: false,
        },
      });
      mockUpdateAllBeachForecasts.mockResolvedValue(syncResult);

      const request = createMockCronRequest(
        "/api/cron/enhanced-forecast-sync",
        {
          method: "GET",
          authMethod: "bearer-token",
        }
      ) as unknown as NextRequest;

      const response = await GET(request);
      const data = await response.json();

      // Even with partial failures, response should be successful (the cron ran)
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.summary.successful).toBe(3);
      expect(data.data.summary.failed).toBe(2);
      // Verify the completion log was called with correct metrics
      expect(mockForecastLogger.cronComplete).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          successful: 3,
          failed: 2,
        })
      );
    });
  });

  describe("Idempotency", () => {
    it("is idempotent (safe to retry)", async () => {
      // Each call should produce consistent results (same beaches get the same treatment)
      mockUpdateAllBeachForecasts.mockResolvedValue(
        createMockForecastSyncResult({
          success: true,
          summary: {
            total: 10,
            attempted: 10,
            successful: 10,
            failed: 0,
            duration: "1.0s",
            stoppedEarly: false,
          },
        })
      );

      const request = createMockCronRequest(
        "/api/cron/enhanced-forecast-sync",
        {
          method: "GET",
          authMethod: "bearer-token",
        }
      );

      // Create handler wrapper that accepts base Request
      const handler = async (req: Request) => {
        return GET(req as unknown as NextRequest);
      };

      const result = await verifyIdempotency(handler, request, {
        ignoreFields: [
          "timestamp",
          "executionId",
          "durationMs",
          "duration",
          "data.executionId",
        ],
      });

      expect(result.isIdempotent).toBe(true);
      expect(mockUpdateAllBeachForecasts).toHaveBeenCalledTimes(2);
    });
  });

  describe("HTTP Methods", () => {
    it("supports GET method (Vercel cron entrypoint)", async () => {
      mockUpdateAllBeachForecasts.mockResolvedValue(
        createMockForecastSyncResult()
      );

      const request = createMockCronRequest(
        "/api/cron/enhanced-forecast-sync",
        {
          method: "GET",
          authMethod: "bearer-token",
        }
      ) as unknown as NextRequest;

      const response = await GET(request);
      expect(response.status).toBe(200);
    });

    it("supports POST method (manual trigger)", async () => {
      mockUpdateAllBeachForecasts.mockResolvedValue(
        createMockForecastSyncResult()
      );

      const request = createMockCronRequest(
        "/api/cron/enhanced-forecast-sync",
        {
          method: "POST",
          authMethod: "bearer-token",
        }
      ) as unknown as NextRequest;

      const response = await POST(request);
      expect(response.status).toBe(200);
    });

    it("supports HEAD method (health check)", async () => {
      const request = createMockCronRequest(
        "/api/cron/enhanced-forecast-sync",
        {
          method: "HEAD",
          authMethod: "bearer-token",
        }
      ) as unknown as NextRequest;

      const response = await HEAD(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.status).toBe("healthy");
    });

    it("HEAD method rejects non-production environment", async () => {
      cronEnv.cleanup();
      cronEnv = setupCronTestEnvironment({ vercelEnv: "development" });

      const request = createMockCronRequest(
        "/api/cron/enhanced-forecast-sync",
        {
          method: "HEAD",
          authMethod: "bearer-token",
        }
      ) as unknown as NextRequest;

      const response = await HEAD(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.success).toBe(false);
    });

    it("HEAD method requires authentication", async () => {
      const request = createMockCronRequest(
        "/api/cron/enhanced-forecast-sync",
        {
          method: "HEAD",
          authMethod: "none",
        }
      ) as unknown as NextRequest;

      const response = await HEAD(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
    });
  });

  describe("Error Handling", () => {
    it("handles unexpected errors gracefully", async () => {
      mockUpdateAllBeachForecasts.mockRejectedValue(
        new Error("Unexpected database error")
      );

      const request = createMockCronRequest(
        "/api/cron/enhanced-forecast-sync",
        {
          method: "GET",
          authMethod: "bearer-token",
        }
      ) as unknown as NextRequest;

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBe("Enhanced forecast sync failed");
      expect(data.details).toHaveProperty("executionId");
      expect(data.details).toHaveProperty("duration");
    });

    it("handles non-Error exceptions", async () => {
      mockUpdateAllBeachForecasts.mockRejectedValue("String error thrown");

      const request = createMockCronRequest(
        "/api/cron/enhanced-forecast-sync",
        {
          method: "GET",
          authMethod: "bearer-token",
        }
      ) as unknown as NextRequest;

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.details.error).toBe("String error thrown");
    });

    it("logs errors with proper context", async () => {
      const testError = new Error("Test error for logging");
      mockUpdateAllBeachForecasts.mockRejectedValue(testError);

      const request = createMockCronRequest(
        "/api/cron/enhanced-forecast-sync",
        {
          method: "GET",
          authMethod: "bearer-token",
        }
      ) as unknown as NextRequest;

      await GET(request);

      expect(mockForecastLogger.cronFailed).toHaveBeenCalledWith(
        expect.any(String),
        testError,
        expect.objectContaining({ duration: expect.any(Number) })
      );
    });
  });

  describe("Logging and Monitoring", () => {
    it("logs cron job start with execution ID", async () => {
      mockUpdateAllBeachForecasts.mockResolvedValue(
        createMockForecastSyncResult()
      );

      const request = createMockCronRequest(
        "/api/cron/enhanced-forecast-sync",
        {
          method: "GET",
          authMethod: "bearer-token",
        }
      ) as unknown as NextRequest;

      await GET(request);

      expect(mockForecastLogger.cronStart).toHaveBeenCalledWith(
        expect.any(String), // execution ID (UUID)
        expect.objectContaining({
          environment: "production",
        })
      );
    });

    it("logs cron job completion with metrics", async () => {
      mockUpdateAllBeachForecasts.mockResolvedValue(
        createMockForecastSyncResult({
          summary: {
            total: 25,
            attempted: 25,
            successful: 24,
            failed: 1,
            duration: "5.0s",
            stoppedEarly: false,
          },
        })
      );

      const request = createMockCronRequest(
        "/api/cron/enhanced-forecast-sync",
        {
          method: "GET",
          authMethod: "bearer-token",
        }
      ) as unknown as NextRequest;

      await GET(request);

      expect(mockForecastLogger.cronComplete).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          successful: 24,
          failed: 1,
          successRate: expect.any(String),
        })
      );
    });

    it("includes execution ID in response", async () => {
      mockUpdateAllBeachForecasts.mockResolvedValue(
        createMockForecastSyncResult()
      );

      const request = createMockCronRequest(
        "/api/cron/enhanced-forecast-sync",
        {
          method: "GET",
          authMethod: "bearer-token",
        }
      ) as unknown as NextRequest;

      const response = await GET(request);
      const data = await response.json();

      expect(typeof data.data.executionId).toBe("string");
      // UUID format validation
      expect(data.data.executionId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      );
    });
  });

  describe("Sharding Support", () => {
    it("passes shard parameters to updateAllBeachForecasts", async () => {
      mockUpdateAllBeachForecasts.mockResolvedValue(
        createMockForecastSyncResult()
      );

      const request = createMockCronRequest(
        "/api/cron/enhanced-forecast-sync",
        {
          method: "GET",
          authMethod: "bearer-token",
          searchParams: {
            shard: "0",
            shardCount: "3",
          },
        }
      ) as unknown as NextRequest;

      await GET(request);

      expect(mockUpdateAllBeachForecasts).toHaveBeenCalledWith(
        expect.objectContaining({
          shard: 0,
          shardCount: 3,
        })
      );
    });

    it("logs shard information when sharding is enabled", async () => {
      mockUpdateAllBeachForecasts.mockResolvedValue(
        createMockForecastSyncResult()
      );

      const request = createMockCronRequest(
        "/api/cron/enhanced-forecast-sync",
        {
          method: "GET",
          authMethod: "bearer-token",
          searchParams: {
            shard: "1",
            shardCount: "4",
          },
        }
      ) as unknown as NextRequest;

      await GET(request);

      expect(mockForecastLogger.cronStart).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          shard: 1,
          shardCount: 4,
        })
      );
    });
  });
});
