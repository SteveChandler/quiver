/**
 * @jest-environment node
 *
 * Tests for the /api/cron/forecast-alerts route.
 *
 * This route owns the disabled legacy daily forecast summary producer.
 * It requires valid cron authentication (Bearer token).
 */

import { GET } from "@/app/api/cron/forecast-alerts/route";
import { readFileSync } from "fs";
import {
  setupCronTestEnvironment,
  createMockCronRequest,
  createMockAlertResult,
  verifyIdempotency,
  type CronTestEnvironment,
} from "@/__tests__/setup/cron-test-utils";

// Mock the forecast-alerts service
const mockRunForecastThresholdAlerts = jest.fn();

jest.mock("@/lib/services/forecast-alerts", () => ({
  runForecastThresholdAlerts: () => mockRunForecastThresholdAlerts(),
}));

describe("Cron: forecast-alerts", () => {
  const routeSource = readFileSync("app/api/cron/forecast-alerts/route.ts", "utf8");
  let cronEnv: CronTestEnvironment;

  beforeEach(() => {
    cronEnv = setupCronTestEnvironment();
    jest.clearAllMocks();
  });

  afterEach(() => {
    cronEnv.cleanup();
  });

  describe("Authentication", () => {
    it("uses the API wrapper barrel for response helpers and cron request validation", () => {
      expect(routeSource).not.toContain("@/lib/api-utils");
      expect(routeSource).toContain("@/lib/middleware/api-wrappers");
    });

    it("requires valid cron authentication", async () => {
      // Setup mock to return a successful result
      mockRunForecastThresholdAlerts.mockResolvedValue(createMockAlertResult());

      // Create request with valid Bearer token
      const request = createMockCronRequest("/api/cron/forecast-alerts", {
        authMethod: "bearer-token",
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty("summary");
      expect(mockRunForecastThresholdAlerts).toHaveBeenCalledTimes(1);
    });

    it("accepts Bearer token authentication", async () => {
      mockRunForecastThresholdAlerts.mockResolvedValue(createMockAlertResult());

      const request = createMockCronRequest("/api/cron/forecast-alerts", {
        authMethod: "bearer-token",
        cronSecret: cronEnv.cronSecret,
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(mockRunForecastThresholdAlerts).toHaveBeenCalledTimes(1);
    });

    it("rejects invalid credentials", async () => {
      // Create request with no authentication
      const request = createMockCronRequest("/api/cron/forecast-alerts", {
        authMethod: "none",
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.error).toContain("Unauthorized");
      expect(data.details).toBe("Invalid cron authentication");
      expect(mockRunForecastThresholdAlerts).not.toHaveBeenCalled();
    });

    it("rejects wrong Bearer token", async () => {
      const request = createMockCronRequest("/api/cron/forecast-alerts", {
        authMethod: "bearer-token",
        cronSecret: "wrong-secret-token",
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.error).toContain("Unauthorized");
      expect(mockRunForecastThresholdAlerts).not.toHaveBeenCalled();
    });
  });

  describe("Daily Summary Behavior", () => {
    it("returns legacy producer summary counts", async () => {
      const alertResult = createMockAlertResult({
        eligibleUsers: 100,
        eligibleBeachesProcessed: 150,
        sent: 50,
        durationMs: 2500,
        skipped: {
          pushDisabled: 10,
          alertsDisabled: 5,
          noEligibleBeaches: 20,
          noGoodForecasts: 15,
        },
      });

      mockRunForecastThresholdAlerts.mockResolvedValue(alertResult);

      const request = createMockCronRequest("/api/cron/forecast-alerts", {
        authMethod: "bearer-token",
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.summary).toEqual(alertResult);
      expect(data.data.summary.sent).toBe(50);
      expect(data.data.summary.eligibleUsers).toBe(100);
      expect(data.data.summary.eligibleBeachesProcessed).toBe(150);
    });

    it("returns summary with zero notifications when no eligible beaches match", async () => {
      const alertResult = createMockAlertResult({
        eligibleUsers: 50,
        sent: 0,
        durationMs: 1000,
        skipped: {
          pushDisabled: 0,
          alertsDisabled: 0,
          noEligibleBeaches: 0,
          noGoodForecasts: 50,
        },
      });

      mockRunForecastThresholdAlerts.mockResolvedValue(alertResult);

      const request = createMockCronRequest("/api/cron/forecast-alerts", {
        authMethod: "bearer-token",
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.summary.sent).toBe(0);
      expect(data.data.summary.skipped.noGoodForecasts).toBe(50);
    });
  });

  describe("Error Handling", () => {
    it("handles notification enqueue failures gracefully", async () => {
      mockRunForecastThresholdAlerts.mockRejectedValue(
        new Error("Notification enqueue service unavailable")
      );

      const request = createMockCronRequest("/api/cron/forecast-alerts", {
        authMethod: "bearer-token",
      });

      const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
      const response = await GET(request);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "API Error:",
        "Notification enqueue service unavailable"
      );
      consoleErrorSpy.mockRestore();
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toContain("Notification enqueue service unavailable");
    });

    it("handles database connection errors gracefully", async () => {
      mockRunForecastThresholdAlerts.mockRejectedValue(
        new Error("Failed to load profiles for forecast alerts")
      );

      const request = createMockCronRequest("/api/cron/forecast-alerts", {
        authMethod: "bearer-token",
      });

      const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
      const response = await GET(request);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "API Error:",
        "Failed to load profiles for forecast alerts"
      );
      consoleErrorSpy.mockRestore();
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toContain("Failed to load profiles");
    });

    it("handles unexpected errors gracefully", async () => {
      mockRunForecastThresholdAlerts.mockRejectedValue(
        new Error("Unexpected internal error")
      );

      const request = createMockCronRequest("/api/cron/forecast-alerts", {
        authMethod: "bearer-token",
      });

      const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
      const response = await GET(request);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "API Error:",
        "Unexpected internal error"
      );
      consoleErrorSpy.mockRestore();
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data).toHaveProperty("timestamp");
    });

    it("handles non-Error exceptions gracefully", async () => {
      // Some code might throw non-Error objects
      mockRunForecastThresholdAlerts.mockRejectedValue("String error message");

      const request = createMockCronRequest("/api/cron/forecast-alerts", {
        authMethod: "bearer-token",
      });

      const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
      const response = await GET(request);
      expect(consoleErrorSpy).toHaveBeenCalledWith("API Error:", "Unknown error");
      consoleErrorSpy.mockRestore();
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
    });
  });

  describe("Idempotency", () => {
    it("is idempotent (safe to retry)", async () => {
      // Create a deterministic result that should be the same across calls
      const alertResult = createMockAlertResult({
        eligibleUsers: 100,
        sent: 50,
        durationMs: 2500,
      });

      mockRunForecastThresholdAlerts.mockResolvedValue(alertResult);

      const result = await verifyIdempotency(
        GET,
        createMockCronRequest("/api/cron/forecast-alerts", {
          authMethod: "bearer-token",
        }),
        {
          // Ignore fields that are expected to vary between calls
          ignoreFields: ["timestamp", "durationMs", "duration"],
        }
      );

      expect(result.isIdempotent).toBe(true);
      expect(result.firstResponse.success).toBe(true);
      expect(result.secondResponse.success).toBe(true);

      // Service should be called twice (once per invocation)
      expect(mockRunForecastThresholdAlerts).toHaveBeenCalledTimes(2);
    });

    it("handles retry after partial success", async () => {
      // First call succeeds partially
      mockRunForecastThresholdAlerts
        .mockResolvedValueOnce(
          createMockAlertResult({
            eligibleUsers: 100,
            sent: 30,
            skipped: {
              pushDisabled: 10,
              alertsDisabled: 5,
              noEligibleBeaches: 20,
              noGoodForecasts: 15,
              sendFailed: 20, // Some sends failed
            },
          })
        )
        // Second call (retry) also succeeds
        .mockResolvedValueOnce(
          createMockAlertResult({
            eligibleUsers: 100,
            sent: 30,
            skipped: {
              pushDisabled: 10,
              alertsDisabled: 5,
              noEligibleBeaches: 20,
              noGoodForecasts: 15,
              sendFailed: 20,
            },
          })
        );

      // First request
      const request1 = createMockCronRequest("/api/cron/forecast-alerts", {
        authMethod: "bearer-token",
      });
      const response1 = await GET(request1);
      const data1 = await response1.json();

      // Retry request
      const request2 = createMockCronRequest("/api/cron/forecast-alerts", {
        authMethod: "bearer-token",
      });
      const response2 = await GET(request2);
      const data2 = await response2.json();

      // Both should succeed (HTTP 200)
      expect(response1.status).toBe(200);
      expect(response2.status).toBe(200);
      expect(data1.success).toBe(true);
      expect(data2.success).toBe(true);

      // Service should be called twice
      expect(mockRunForecastThresholdAlerts).toHaveBeenCalledTimes(2);
    });
  });

  describe("Response Format", () => {
    it("returns properly formatted success response", async () => {
      mockRunForecastThresholdAlerts.mockResolvedValue(createMockAlertResult());

      const request = createMockCronRequest("/api/cron/forecast-alerts", {
        authMethod: "bearer-token",
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty("success", true);
      expect(data).toHaveProperty("data");
      expect(data.data).toHaveProperty("summary");
      expect(data).toHaveProperty("timestamp");
      expect(typeof data.timestamp).toBe("string");

      // Verify timestamp is a valid ISO date
      expect(new Date(data.timestamp).getTime()).not.toBeNaN();
    });

    it("returns properly formatted error response", async () => {
      const request = createMockCronRequest("/api/cron/forecast-alerts", {
        authMethod: "none",
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data).toHaveProperty("success", false);
      expect(data).toHaveProperty("error");
      expect(data).toHaveProperty("timestamp");
      expect(typeof data.error).toBe("string");
    });

    it("includes detailed skip reasons in summary", async () => {
      const alertResult = createMockAlertResult({
        eligibleUsers: 100,
        sent: 25,
        skipped: {
          pushDisabled: 10,
          alertsDisabled: 15,
          noEligibleBeaches: 20,
          noGoodForecasts: 30,
          duplicateDailySummary: 5,
        },
      });

      mockRunForecastThresholdAlerts.mockResolvedValue(alertResult);

      const request = createMockCronRequest("/api/cron/forecast-alerts", {
        authMethod: "bearer-token",
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      const summary = data.data.summary;
      expect(summary.skipped).toMatchObject({
        pushDisabled: 10,
        alertsDisabled: 15,
        noEligibleBeaches: 20,
        noGoodForecasts: 30,
        duplicateDailySummary: 5,
      });
    });
  });

  describe("Edge Cases", () => {
    it("handles empty user list", async () => {
      const alertResult = createMockAlertResult({
        eligibleUsers: 0,
        sent: 0,
        durationMs: 100,
        skipped: {
          pushDisabled: 0,
          alertsDisabled: 0,
          noEligibleBeaches: 0,
          noGoodForecasts: 0,
        },
      });

      mockRunForecastThresholdAlerts.mockResolvedValue(alertResult);

      const request = createMockCronRequest("/api/cron/forecast-alerts", {
        authMethod: "bearer-token",
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.summary.eligibleUsers).toBe(0);
      expect(data.data.summary.sent).toBe(0);
    });

    it("handles large number of users", async () => {
      const alertResult = createMockAlertResult({
        eligibleUsers: 10000,
        sent: 5000,
        durationMs: 30000,
        skipped: {
          pushDisabled: 1000,
          alertsDisabled: 500,
          noEligibleBeaches: 2000,
          noGoodForecasts: 1500,
        },
      });

      mockRunForecastThresholdAlerts.mockResolvedValue(alertResult);

      const request = createMockCronRequest("/api/cron/forecast-alerts", {
        authMethod: "bearer-token",
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.summary.eligibleUsers).toBe(10000);
      expect(data.data.summary.sent).toBe(5000);
    });
  });
});
