/**
 * Tests for API retry utilities
 * 
 * Focus on NOAA 404 handling for off-coverage locations
 */

import { describe, it, expect, jest, beforeEach, afterEach } from "@jest/globals";
import { expectConsoleWarnings } from "@/__tests__/setup/test-utils";

// Mock the ApiError import
jest.mock("@/lib/errors/forecast-errors", () => ({
  ApiError: class MockApiError extends Error {
    context: { apiUrl: string; statusCode: number };
    
    constructor(apiUrl: string, statusCode: number, responseText: string) {
      super(`HTTP ${statusCode}: ${responseText}`);
      this.name = "ApiError";
      this.context = { apiUrl, statusCode };
    }
  },
}));

describe("api-retry", () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    jest.resetModules();
    originalFetch = global.fetch;
    jest.useRealTimers();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  describe("fetchNOAAData", () => {
    it("throws ApiError for NOAA 404 responses (enables isNoaaInvalidPointError)", async () => {
      // Mock fetch to return 404
      const mockResponse = {
        ok: false,
        status: 404,
        statusText: "Not Found",
        clone: () => ({
          text: () => Promise.resolve('{"type": "https://api.weather.gov/problems/InvalidPoint"}'),
        }),
      } as unknown as Response;

      (global.fetch as any) = jest.fn(() => Promise.resolve(mockResponse));
      
      // Need to import after mocking
      const { apiClient } = await import("@/lib/utils/api-retry");
      
      await expect(
        apiClient.fetchNOAAData("https://api.weather.gov/points/32.22,-116.93")
      ).rejects.toMatchObject({
        name: "ApiError",
        context: {
          apiUrl: "https://api.weather.gov/points/32.22,-116.93",
          statusCode: 404,
        },
      });
    });
  });

  describe("CDIP circuit breaker behavior", () => {
    function response(status: number): Response {
      return {
        ok: status >= 200 && status < 300,
        status,
        statusText: status === 200 ? "OK" : `HTTP ${status}`,
      } as Response;
    }

    it.each([400, 404])("does not open the breaker for deterministic CDIP %s responses", async (status) => {
      const errorLog = jest.spyOn(console, "error").mockImplementation(() => undefined);
      const { RetryableAPIClient } = await import("@/lib/utils/api-retry");
      const client = new RetryableAPIClient();
      global.fetch = jest.fn(() => Promise.resolve(response(status)));

      for (let i = 0; i < 5; i += 1) {
        await expect(
          client.fetchCDIPData("https://cdip.test/wave_agg.json", {}, {
            circuitBreakerKey: "CDIP:045",
            maxRetries: 0,
          })
        ).rejects.toMatchObject({ status });
      }

      expect(global.fetch).toHaveBeenCalledTimes(5);
      expect(client.getServiceStatus()["CDIP:045"]).toMatchObject({
        state: "CLOSED",
        failureCount: 0,
      });
      expect(errorLog).not.toHaveBeenCalled();
      errorLog.mockRestore();
      const warnings = (globalThis as { __quiverConsoleWarns?: string[] })
        .__quiverConsoleWarns;
      expect(warnings).toHaveLength(5);
      expectConsoleWarnings([
        new RegExp(
          "^\\[CDIP\\] Station data unavailable \\(" + status + "\\):",
        ),
      ]);
    });

    it.each([429, 500])("opens the station breaker for transient CDIP %s responses", async (status) => {
      const { CircuitBreakerOpenError, RetryableAPIClient } = await import("@/lib/utils/api-retry");
      const client = new RetryableAPIClient();
      global.fetch = jest.fn(() => Promise.resolve(response(status)));

      const fetchStation = () =>
        client.fetchCDIPData("https://cdip.test/wave_agg.json", {}, {
          circuitBreakerKey: "CDIP:045",
          maxRetries: 0,
        });

      await expect(fetchStation()).rejects.toMatchObject({ status });
      await expect(fetchStation()).rejects.toMatchObject({ status });
      await expect(fetchStation()).rejects.toMatchObject({ status });
      await expect(fetchStation()).rejects.toBeInstanceOf(CircuitBreakerOpenError);
      await expect(fetchStation()).rejects.toMatchObject({
        circuitBreakerKey: "CDIP:045",
      });

      expect(global.fetch).toHaveBeenCalledTimes(3);
      expect(client.getServiceStatus()["CDIP:045"]).toMatchObject({
        state: "OPEN",
        failureCount: 3,
      });
    });

    it("opens the station breaker for CDIP abort/timeout failures", async () => {
      const { CircuitBreakerOpenError, RetryableAPIClient } = await import("@/lib/utils/api-retry");
      const client = new RetryableAPIClient();
      const timeoutError = Object.assign(new Error("request timeout"), {
        name: "AbortError",
      });
      global.fetch = jest.fn(() => Promise.reject(timeoutError));

      const fetchStation = () =>
        client.fetchCDIPData("https://cdip.test/wave_agg.json", {}, {
          circuitBreakerKey: "CDIP:045",
          maxRetries: 0,
        });

      await expect(fetchStation()).rejects.toMatchObject({ name: "AbortError" });
      await expect(fetchStation()).rejects.toMatchObject({ name: "AbortError" });
      await expect(fetchStation()).rejects.toMatchObject({ name: "AbortError" });
      await expect(fetchStation()).rejects.toBeInstanceOf(CircuitBreakerOpenError);

      expect(global.fetch).toHaveBeenCalledTimes(3);
    });

    it("does not let one open CDIP station breaker block another station", async () => {
      const { CircuitBreakerOpenError, RetryableAPIClient } = await import("@/lib/utils/api-retry");
      const client = new RetryableAPIClient();
      global.fetch = jest.fn(() => Promise.resolve(response(500)));

      const fetchBlockedStation = () =>
        client.fetchCDIPData("https://cdip.test/station-045.json", {}, {
          circuitBreakerKey: "CDIP:045",
          maxRetries: 0,
        });

      await expect(fetchBlockedStation()).rejects.toMatchObject({ status: 500 });
      await expect(fetchBlockedStation()).rejects.toMatchObject({ status: 500 });
      await expect(fetchBlockedStation()).rejects.toMatchObject({ status: 500 });
      await expect(fetchBlockedStation()).rejects.toBeInstanceOf(CircuitBreakerOpenError);

      (global.fetch as jest.Mock).mockImplementationOnce(() =>
        Promise.resolve(response(200))
      );

      await expect(
        client.fetchCDIPData("https://cdip.test/station-067.json", {}, {
          circuitBreakerKey: "CDIP:067",
          maxRetries: 0,
        })
      ).resolves.toMatchObject({ ok: true, status: 200 });

      expect(client.getServiceStatus()["CDIP:045"]).toMatchObject({ state: "OPEN" });
      expect(client.getServiceStatus()["CDIP:067"]).toMatchObject({ state: "CLOSED" });
    });
  });
});
