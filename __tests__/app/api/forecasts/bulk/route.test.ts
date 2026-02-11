/**
 * @jest-environment node
 */

import { GET } from "@/app/api/forecasts/bulk/route";
import {
  createMockSupabaseClient,
  createMockRequest,
  expectSuccessResponse,
  setupApiTestEnvironment,
} from "@/test-utils/api-test-helpers";

// Type for bulk forecast response
interface BulkForecastResponse {
  forecasts: Record<string, {
    beach_id: string;
    forecast_date: string;
    forecast_time: string;
    wave_height: number;
  } | null>;
}

// Mock the Supabase server client
const mockSupabaseClient = createMockSupabaseClient();

jest.mock("@/lib/supabase/server", () => ({
  createAPIServerClient: jest.fn(() => mockSupabaseClient),
}));

// Forecast item type for test mocks
interface ForecastItem {
  beach_id: string;
  forecast_date: string;
  forecast_time: string;
  wave_height: number | undefined;
}

// Mock getCurrentForecast to test that it receives proper data
jest.mock("@/lib/utils/current-forecast-utils", () => ({
  getCurrentForecast: jest.fn((forecasts: ForecastItem[]) => {
    // Simple mock: return first forecast (tests will verify proper data structure)
    return forecasts && forecasts.length > 0 ? forecasts[0] : null;
  }),
}));

const mockGetCurrentForecast = require("@/lib/utils/current-forecast-utils").getCurrentForecast;

// Helper to set partial mock chain (test mocks don't need all interface properties)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const setPartialMockChain = (mock: any) => {
  mockSupabaseClient.from.mockReturnValue(mock as any);
};

// Shorthand to bypass MockQueryChain type checking for simple mock returns
const mockFrom = (mock: any) => mockSupabaseClient.from.mockReturnValue(mock as any);

describe("/api/forecasts/bulk", () => {
  let cleanup: () => void;

  beforeEach(() => {
    const testEnv = setupApiTestEnvironment();
    cleanup = testEnv.cleanup;
    jest.clearAllMocks();
  });

  afterEach(() => {
    cleanup?.();
  });

  describe("GET", () => {
    it("should return empty forecasts when beachIds parameter is missing", async () => {
      const request = createMockRequest("GET", "http://localhost:3000/api/forecasts/bulk");
      const response = await GET(request);

      const data = await expectSuccessResponse<BulkForecastResponse>(response, 200);
      expect(data.data).toEqual({ forecasts: {} });
      expect(mockSupabaseClient.from).not.toHaveBeenCalled();
    });

    it("should return empty forecasts when beachIds parameter is empty string", async () => {
      const request = createMockRequest("GET", "http://localhost:3000/api/forecasts/bulk?beachIds=");
      const response = await GET(request);

      const data = await expectSuccessResponse<BulkForecastResponse>(response, 200);
      expect(data.data).toEqual({ forecasts: {} });
      expect(mockSupabaseClient.from).not.toHaveBeenCalled();
    });

    it("should return empty forecasts when beachIds contains only whitespace", async () => {
      const request = createMockRequest("GET", "http://localhost:3000/api/forecasts/bulk?beachIds=   ");
      const response = await GET(request);

      const data = await expectSuccessResponse<BulkForecastResponse>(response, 200);
      expect(data.data).toEqual({ forecasts: {} });
      expect(mockSupabaseClient.from).not.toHaveBeenCalled();
    });

    it("should fetch forecasts for single beach with correct SQL filtering", async () => {
      const mockForecasts = [
        {
          beach_id: "beach-1",
          forecast_date: "2025-10-20",
          forecast_time: "08:00:00",
          wave_height: 1.2,
        },
        {
          beach_id: "beach-1",
          forecast_date: "2025-10-20",
          forecast_time: "14:00:00",
          wave_height: 2.5,
        },
      ];

      mockGetCurrentForecast.mockImplementation((forecasts: ForecastItem[]) => forecasts[0]);

      // Mock the full Supabase query chain with proper chaining for order()
      const mockOrderChain = {
        order: jest.fn(function(this: any) {
          return this; // Return self for chaining
        }),
      };
      // After 3 order() calls, resolve to data
      mockOrderChain.order
        .mockReturnValueOnce(mockOrderChain) // First order() returns chain
        .mockReturnValueOnce(mockOrderChain) // Second order() returns chain
        .mockResolvedValueOnce({ data: mockForecasts, error: null }); // Third order() resolves

      const mockGte = jest.fn(() => mockOrderChain);
      const mockIn = jest.fn(() => ({
        gte: mockGte,
      }));
      const mockSelect = jest.fn(() => ({
        in: mockIn,
      }));
      setPartialMockChain({ select: mockSelect });

      const request = createMockRequest("GET", "http://localhost:3000/api/forecasts/bulk?beachIds=beach-1");
      const response = await GET(request);

      const data = await expectSuccessResponse<BulkForecastResponse>(response, 200);

      // Verify SQL query structure
      expect(mockSupabaseClient.from).toHaveBeenCalledWith("enhanced_forecasts");
      expect(mockSelect).toHaveBeenCalledWith("beach_id, forecast_date, forecast_time, wave_height");
      expect(mockIn).toHaveBeenCalledWith("beach_id", ["beach-1"]);
      expect(mockGte).toHaveBeenCalledWith("forecast_date", expect.any(String)); // Today's date
      
      // Verify ordering (should be called 3 times for beach_id, forecast_date, forecast_time)
      expect(mockOrderChain.order).toHaveBeenCalledTimes(3);
      expect(mockOrderChain.order).toHaveBeenNthCalledWith(1, "beach_id", { ascending: true });
      expect(mockOrderChain.order).toHaveBeenNthCalledWith(2, "forecast_date", { ascending: true });
      expect(mockOrderChain.order).toHaveBeenNthCalledWith(3, "forecast_time", { ascending: true });

      // Verify getCurrentForecast was called with proper data structure
      expect(mockGetCurrentForecast).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            beach_id: "beach-1",
            forecast_date: expect.any(String),
            forecast_time: expect.any(String),
            wave_height: expect.any(Number),
          }),
        ])
      );

      // Verify response includes wave height
      expect(data.data.forecasts).toHaveProperty("beach-1");
      expect(data.data.forecasts["beach-1"]).toBe(1.2);
    });

    it("should fetch forecasts for multiple beaches", async () => {
      const mockForecasts = [
        {
          beach_id: "beach-1",
          forecast_date: "2025-10-20",
          forecast_time: "14:00:00",
          wave_height: 2.5,
        },
        {
          beach_id: "beach-2",
          forecast_date: "2025-10-20",
          forecast_time: "14:00:00",
          wave_height: 3.2,
        },
        {
          beach_id: "beach-3",
          forecast_date: "2025-10-20",
          forecast_time: "14:00:00",
          wave_height: 1.8,
        },
      ];

      // Mock getCurrentForecast to return the first forecast for each beach
      mockGetCurrentForecast.mockImplementation((forecasts: ForecastItem[]) => forecasts[0]);

      // Mock the full chain with proper order chaining
      const mockOrderChain = {
        order: jest.fn(function(this: any) {
          return this;
        }),
      };
      mockOrderChain.order
        .mockReturnValueOnce(mockOrderChain)
        .mockReturnValueOnce(mockOrderChain)
        .mockResolvedValueOnce({ data: mockForecasts, error: null });

      mockFrom({
        select: jest.fn(() => ({
          in: jest.fn(() => ({
            gte: jest.fn(() => mockOrderChain),
          })),
        })),
      });

      const request = createMockRequest("GET", "http://localhost:3000/api/forecasts/bulk?beachIds=beach-1,beach-2,beach-3");
      const response = await GET(request);

      const data = await expectSuccessResponse<BulkForecastResponse>(response, 200);

      // Verify all three beaches have forecasts
      expect(data.data.forecasts).toHaveProperty("beach-1");
      expect(data.data.forecasts).toHaveProperty("beach-2");
      expect(data.data.forecasts).toHaveProperty("beach-3");
      
      expect(data.data.forecasts["beach-1"]).toBe(2.5);
      expect(data.data.forecasts["beach-2"]).toBe(3.2);
      expect(data.data.forecasts["beach-3"]).toBe(1.8);
    });

    it("should respect 50 beach limit", async () => {
      // Create 60 beach IDs
      const beachIds = Array.from({ length: 60 }, (_, i) => `beach-${i}`);
      
      const mockIn = jest.fn(() => ({
        gte: jest.fn(() => ({
          order: jest.fn(() => Promise.resolve({
            data: [],
            error: null,
          })),
        })),
      }));

      mockFrom({
        select: jest.fn(() => ({
          in: mockIn,
        })),
      });

      const request = createMockRequest("GET", `http://localhost:3000/api/forecasts/bulk?beachIds=${beachIds.join(",")}`);
      await GET(request);

      // Verify only first 50 beach IDs were queried
      expect(mockIn).toHaveBeenCalledWith("beach_id", beachIds.slice(0, 50));
    });

    it("should handle whitespace in beach IDs", async () => {
      const mockForecasts = [
        {
          beach_id: "beach-1",
          forecast_date: "2025-10-20",
          forecast_time: "14:00:00",
          wave_height: 2.5,
        },
      ];

      mockGetCurrentForecast.mockImplementation((forecasts: ForecastItem[]) => forecasts[0]);

      const mockIn = jest.fn(() => ({
        gte: jest.fn(() => ({
          order: jest.fn(() => Promise.resolve({
            data: mockForecasts,
            error: null,
          })),
        })),
      }));

      mockFrom({
        select: jest.fn(() => ({
          in: mockIn,
        })),
      });

      const request = createMockRequest("GET", "http://localhost:3000/api/forecasts/bulk?beachIds= beach-1 , beach-2 , ");
      await GET(request);

      // Verify beach IDs were trimmed and empty strings filtered out
      expect(mockIn).toHaveBeenCalledWith("beach_id", ["beach-1", "beach-2"]);
    });

    it("should return 500 error when database errors occur", async () => {
      // Mock database error with proper 3-order chain
      const mockOrderChain: any = {
        order: jest.fn(function(this: any) { return this; }),
      };
      mockOrderChain.order
        .mockReturnValueOnce(mockOrderChain)
        .mockReturnValueOnce(mockOrderChain)
        .mockResolvedValueOnce({
          data: null,
          error: { message: "Database connection failed" },
        });

      mockFrom({
        select: jest.fn(() => ({
          in: jest.fn(() => ({
            gte: jest.fn(() => mockOrderChain),
          })),
        })),
      });

      const request = createMockRequest("GET", "http://localhost:3000/api/forecasts/bulk?beachIds=beach-1");
      const response = await GET(request);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain("Failed to fetch bulk forecasts");
    });

    it("should return empty forecasts when no forecasts exist for beach", async () => {
      // Mock empty result with proper 3-order chain
      const mockOrderChain: any = {
        order: jest.fn(function(this: any) { return this; }),
      };
      mockOrderChain.order
        .mockReturnValueOnce(mockOrderChain)
        .mockReturnValueOnce(mockOrderChain)
        .mockResolvedValueOnce({ data: [], error: null });

      mockFrom({
        select: jest.fn(() => ({
          in: jest.fn(() => ({
            gte: jest.fn(() => mockOrderChain),
          })),
        })),
      });

      const request = createMockRequest("GET", "http://localhost:3000/api/forecasts/bulk?beachIds=beach-1,beach-2");
      const response = await GET(request);

      const data = await expectSuccessResponse<BulkForecastResponse>(response, 200);
      expect(data.data).toEqual({ forecasts: {} });
    });

    it("should handle null data from database", async () => {
      // Mock null data with proper 3-order chain
      const mockOrderChain: any = {
        order: jest.fn(function(this: any) { return this; }),
      };
      mockOrderChain.order
        .mockReturnValueOnce(mockOrderChain)
        .mockReturnValueOnce(mockOrderChain)
        .mockResolvedValueOnce({ data: null, error: null });

      mockFrom({
        select: jest.fn(() => ({
          in: jest.fn(() => ({
            gte: jest.fn(() => mockOrderChain),
          })),
        })),
      });

      const request = createMockRequest("GET", "http://localhost:3000/api/forecasts/bulk?beachIds=beach-1");
      const response = await GET(request);

      const data = await expectSuccessResponse<BulkForecastResponse>(response, 200);
      expect(data.data).toEqual({ forecasts: {} });
    });

    it("should verify getCurrentForecast receives data with forecast_date and forecast_time", async () => {
      const mockForecasts = [
        {
          beach_id: "beach-1",
          forecast_date: "2025-10-20",
          forecast_time: "00:00:00",
          wave_height: 0.5,
        },
        {
          beach_id: "beach-1",
          forecast_date: "2025-10-20",
          forecast_time: "14:00:00",
          wave_height: 2.5,
        },
      ];

      mockGetCurrentForecast.mockImplementation((forecasts: ForecastItem[]) => {
        // Verify each forecast has the required fields
        forecasts.forEach((f: ForecastItem) => {
          expect(f).toHaveProperty("forecast_date");
          expect(f).toHaveProperty("forecast_time");
          expect(f).toHaveProperty("wave_height");
        });
        return forecasts[1]; // Return the 14:00 forecast (not midnight)
      });

      const mockOrderChain = {
        order: jest.fn(function(this: any) {
          return this;
        }),
      };
      mockOrderChain.order
        .mockReturnValueOnce(mockOrderChain)
        .mockReturnValueOnce(mockOrderChain)
        .mockResolvedValueOnce({ data: mockForecasts, error: null });

      mockFrom({
        select: jest.fn(() => ({
          in: jest.fn(() => ({
            gte: jest.fn(() => mockOrderChain),
          })),
        })),
      });

      const request = createMockRequest("GET", "http://localhost:3000/api/forecasts/bulk?beachIds=beach-1");
      const response = await GET(request);

      const data = await expectSuccessResponse<BulkForecastResponse>(response, 200);
      
      // Verify the afternoon forecast was selected (2.5ft), not midnight (0.5ft)
      expect(data.data.forecasts["beach-1"]).toBe(2.5);
      expect(mockGetCurrentForecast).toHaveBeenCalled();
    });

    it("should handle beaches with no matching forecasts in the result set", async () => {
      const mockForecasts = [
        {
          beach_id: "beach-1",
          forecast_date: "2025-10-20",
          forecast_time: "14:00:00",
          wave_height: 2.5,
        },
        // beach-2 has no forecasts
      ];

      mockGetCurrentForecast.mockImplementation((forecasts: ForecastItem[]) => forecasts[0]);

      const mockOrderChain = {
        order: jest.fn(function(this: any) {
          return this;
        }),
      };
      mockOrderChain.order
        .mockReturnValueOnce(mockOrderChain)
        .mockReturnValueOnce(mockOrderChain)
        .mockResolvedValueOnce({ data: mockForecasts, error: null });

      mockFrom({
        select: jest.fn(() => ({
          in: jest.fn(() => ({
            gte: jest.fn(() => mockOrderChain),
          })),
        })),
      });

      const request = createMockRequest("GET", "http://localhost:3000/api/forecasts/bulk?beachIds=beach-1,beach-2");
      const response = await GET(request);

      const data = await expectSuccessResponse<BulkForecastResponse>(response, 200);
      
      // beach-1 should have forecast, beach-2 should not be in the response
      expect(data.data.forecasts).toHaveProperty("beach-1");
      expect(data.data.forecasts).not.toHaveProperty("beach-2");
    });

    it("should handle getCurrentForecast returning null", async () => {
      const mockForecasts = [
        {
          beach_id: "beach-1",
          forecast_date: "2025-10-20",
          forecast_time: "14:00:00",
          wave_height: 2.5,
        },
      ];

      // Mock getCurrentForecast to return null
      mockGetCurrentForecast.mockReturnValue(null);

      const mockOrderChain: any = {
        order: jest.fn(function(this: any) { return this; }),
      };
      mockOrderChain.order
        .mockReturnValueOnce(mockOrderChain)
        .mockReturnValueOnce(mockOrderChain)
        .mockResolvedValueOnce({ data: mockForecasts, error: null });

      mockFrom({
        select: jest.fn(() => ({
          in: jest.fn(() => ({
            gte: jest.fn(() => mockOrderChain),
          })),
        })),
      });

      const request = createMockRequest("GET", "http://localhost:3000/api/forecasts/bulk?beachIds=beach-1");
      const response = await GET(request);

      const data = await expectSuccessResponse<BulkForecastResponse>(response, 200);

      // Should not include beach-1 in forecasts when getCurrentForecast returns null
      expect(data.data.forecasts).toEqual({});
    });

    it("should handle getCurrentForecast returning forecast with undefined wave_height", async () => {
      const mockForecasts = [
        {
          beach_id: "beach-1",
          forecast_date: "2025-10-20",
          forecast_time: "14:00:00",
          wave_height: undefined,
        },
      ];

      mockGetCurrentForecast.mockImplementation((forecasts: ForecastItem[]) => forecasts[0]);

      const mockOrderChain: any = {
        order: jest.fn(function(this: any) { return this; }),
      };
      mockOrderChain.order
        .mockReturnValueOnce(mockOrderChain)
        .mockReturnValueOnce(mockOrderChain)
        .mockResolvedValueOnce({ data: mockForecasts, error: null });

      mockFrom({
        select: jest.fn(() => ({
          in: jest.fn(() => ({
            gte: jest.fn(() => mockOrderChain),
          })),
        })),
      });

      const request = createMockRequest("GET", "http://localhost:3000/api/forecasts/bulk?beachIds=beach-1");
      const response = await GET(request);

      const data = await expectSuccessResponse<BulkForecastResponse>(response, 200);

      // Should not include beach when wave_height is undefined
      expect(data.data.forecasts).toEqual({});
    });
  });

  describe("Performance", () => {
    it("should apply SQL date filtering to reduce data transfer", async () => {
      const mockGte = jest.fn(() => ({
        order: jest.fn(() => Promise.resolve({
          data: [],
          error: null,
        })),
      }));

      mockFrom({
        select: jest.fn(() => ({
          in: jest.fn(() => ({
            gte: mockGte,
          })),
        })),
      });

      const request = createMockRequest("GET", "http://localhost:3000/api/forecasts/bulk?beachIds=beach-1");
      await GET(request);

      // Verify SQL filtering is applied
      expect(mockGte).toHaveBeenCalledWith("forecast_date", expect.any(String));
      
      // Verify the date is today (YYYY-MM-DD format)
      const calledDate = (mockGte.mock.calls as any[])[0][1];
      expect(calledDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });
});

