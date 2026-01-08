/**
 * Tests for API retry utilities
 * 
 * Focus on NOAA 404 handling for off-coverage locations
 */

import { describe, it, expect, jest, beforeEach, afterEach } from "@jest/globals";

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
    originalFetch = global.fetch;
    jest.useFakeTimers();
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
      
      global.fetch = jest.fn().mockResolvedValue(mockResponse);
      
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
});

