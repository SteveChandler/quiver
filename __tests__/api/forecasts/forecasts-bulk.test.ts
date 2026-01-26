/**
 * @jest-environment node
 */

import {
  createMockSupabaseClient,
  createMockRequest,
  expectSuccessResponse,
  setupApiTestEnvironment,
} from "@/test-utils/api-test-helpers";

// Mock the Supabase server client
const mockSupabaseClient = createMockSupabaseClient();

jest.mock("@/lib/middleware/api-wrappers", () => ({
  withRateLimit: (handler: any) => handler,
}));

jest.mock("@/lib/supabase/server", () => ({
  createAPIServerClient: jest.fn(() => mockSupabaseClient),
}));

// Mock getCurrentForecast utility
const mockGetCurrentForecast = jest.fn();
jest.mock("@/lib/utils/current-forecast-utils", () => ({
  getCurrentForecast: (...args: any[]) => mockGetCurrentForecast(...args),
}));

// Import after mocks
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { GET } = require("@/app/api/forecasts/bulk/route");

describe("GET /api/forecasts/bulk", () => {
  let cleanup: () => void;

  beforeEach(() => {
    const testEnv = setupApiTestEnvironment();
    cleanup = testEnv.cleanup;
    jest.clearAllMocks();

    // Reset mock to return fresh chain objects for each call
    // The chain needs to be awaitable (return a promise when awaited)
    (mockSupabaseClient.from as jest.Mock).mockImplementation(() => {
      const chain: any = {
        select: jest.fn().mockReturnThis(),
        insert: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        delete: jest.fn().mockReturnThis(),
        upsert: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        neq: jest.fn().mockReturnThis(),
        gt: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lt: jest.fn().mockReturnThis(),
        lte: jest.fn().mockReturnThis(),
        like: jest.fn().mockReturnThis(),
        ilike: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        is: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        single: jest.fn(() => Promise.resolve({ data: null, error: null })),
        maybeSingle: jest.fn(() => Promise.resolve({ data: null, error: null })),
        range: jest.fn().mockReturnThis(),
        textSearch: jest.fn().mockReturnThis(),
        data: null,
        error: null,
      };

      // Make the chain thenable (awaitable)
      chain.then = (resolve: any) => {
        return Promise.resolve(resolve({ data: null, error: null }));
      };

      return chain;
    });
  });

  afterEach(() => {
    cleanup?.();
  });

  describe("Success Cases", () => {
    it("fetches forecasts for multiple beaches", async () => {
      const beach1Id = "beach-1";
      const beach2Id = "beach-2";
      const beach3Id = "beach-3";

      const mockForecasts = [
        {
          beach_id: beach1Id,
          forecast_date: "2024-01-15",
          forecast_time: "12:00",
          wave_height: 4.5,
        },
        {
          beach_id: beach2Id,
          forecast_date: "2024-01-15",
          forecast_time: "12:00",
          wave_height: 3.2,
        },
        {
          beach_id: beach3Id,
          forecast_date: "2024-01-15",
          forecast_time: "12:00",
          wave_height: 5.8,
        },
      ];

      // Mock the database query - need to return an awaitable chain
      const chain: any = {
        select: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
      };
      chain.then = (resolve: any) => Promise.resolve(resolve({ data: mockForecasts, error: null }));
      (mockSupabaseClient.from as jest.Mock).mockReturnValue(chain);

      // Mock getCurrentForecast to return the forecast
      mockGetCurrentForecast.mockImplementation((forecasts: any[]) => {
        return forecasts[0];
      });

      const request = createMockRequest("GET", "http://localhost:3000/api/forecasts/bulk", {
        searchParams: {
          beachIds: `${beach1Id},${beach2Id},${beach3Id}`,
        },
      });

      const response = await GET(request);
      const result = await expectSuccessResponse(response, 200);

      expect(result.data).toHaveProperty("forecasts");
      expect(result.data.forecasts).toHaveProperty(beach1Id, 4.5);
      expect(result.data.forecasts).toHaveProperty(beach2Id, 3.2);
      expect(result.data.forecasts).toHaveProperty(beach3Id, 5.8);
    });

    it("returns empty forecasts for missing beachIds parameter", async () => {
      const request = createMockRequest("GET", "http://localhost:3000/api/forecasts/bulk");

      const response = await GET(request);
      const result = await expectSuccessResponse(response, 200);

      expect(result.data).toHaveProperty("forecasts");
      expect(result.data.forecasts).toEqual({});
    });

    it("returns empty forecasts for empty beachIds parameter", async () => {
      const request = createMockRequest("GET", "http://localhost:3000/api/forecasts/bulk", {
        searchParams: {
          beachIds: "",
        },
      });

      const response = await GET(request);
      const result = await expectSuccessResponse(response, 200);

      expect(result.data).toHaveProperty("forecasts");
      expect(result.data.forecasts).toEqual({});
    });

    it("returns empty forecasts for whitespace-only beachIds", async () => {
      const request = createMockRequest("GET", "http://localhost:3000/api/forecasts/bulk", {
        searchParams: {
          beachIds: "   ,  ,   ",
        },
      });

      const response = await GET(request);
      const result = await expectSuccessResponse(response, 200);

      expect(result.data).toHaveProperty("forecasts");
      expect(result.data.forecasts).toEqual({});
    });

    it("handles beaches with no forecast data", async () => {
      const beach1Id = "beach-with-forecast";
      const beach2Id = "beach-without-forecast";

      const mockForecasts = [
        {
          beach_id: beach1Id,
          forecast_date: "2024-01-15",
          forecast_time: "12:00",
          wave_height: 4.5,
        },
      ];

      const chain: any = {
        select: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
      };
      chain.then = (resolve: any) => Promise.resolve(resolve({ data: mockForecasts, error: null }));
      (mockSupabaseClient.from as jest.Mock).mockReturnValue(chain);

      mockGetCurrentForecast.mockImplementation((forecasts: any[]) => {
        return forecasts.length > 0 ? forecasts[0] : null;
      });

      const request = createMockRequest("GET", "http://localhost:3000/api/forecasts/bulk", {
        searchParams: {
          beachIds: `${beach1Id},${beach2Id}`,
        },
      });

      const response = await GET(request);
      const result = await expectSuccessResponse(response, 200);

      expect(result.data.forecasts).toHaveProperty(beach1Id, 4.5);
      expect(result.data.forecasts).not.toHaveProperty(beach2Id);
    });

    it("limits to 50 beaches maximum", async () => {
      // Create 60 beach IDs
      const beachIds = Array.from({ length: 60 }, (_, i) => `beach-${i + 1}`);
      const mockForecasts = beachIds.slice(0, 50).map((id, i) => ({
        beach_id: id,
        forecast_date: "2024-01-15",
        forecast_time: "12:00",
        wave_height: `${i + 1}.0`,
      }));

      let queriedBeachIds: string[] = [];

      (mockSupabaseClient.from as jest.Mock).mockImplementation(() => {
        const chain = {
          select: jest.fn().mockReturnThis(),
          in: jest.fn((column: string, ids: string[]) => {
            queriedBeachIds = ids;
            return chain;
          }),
          gte: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
        };
        (chain.order as jest.Mock).mockResolvedValue({
          data: mockForecasts,
          error: null,
        });
        return chain;
      });

      mockGetCurrentForecast.mockImplementation((forecasts: any[]) => {
        return forecasts[0];
      });

      const request = createMockRequest("GET", "http://localhost:3000/api/forecasts/bulk", {
        searchParams: {
          beachIds: beachIds.join(","),
        },
      });

      await GET(request);

      // Verify only 50 beaches were queried
      expect(queriedBeachIds.length).toBe(50);
    });
  });

  describe("Partial Failures", () => {
    it("handles partial failures gracefully", async () => {
      const beach1Id = "beach-1";
      const beach2Id = "beach-2";
      const beach3Id = "beach-3";

      const mockForecasts = [
        {
          beach_id: beach1Id,
          forecast_date: "2024-01-15",
          forecast_time: "12:00",
          wave_height: 4.5,
        },
        {
          beach_id: beach3Id,
          forecast_date: "2024-01-15",
          forecast_time: "12:00",
          wave_height: 5.8,
        },
      ];

      const chain: any = {
        select: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
      };
      chain.then = (resolve: any) => Promise.resolve(resolve({ data: mockForecasts, error: null }));
      (mockSupabaseClient.from as jest.Mock).mockReturnValue(chain);

      mockGetCurrentForecast.mockImplementation((forecasts: any[]) => {
        return forecasts[0];
      });

      const request = createMockRequest("GET", "http://localhost:3000/api/forecasts/bulk", {
        searchParams: {
          beachIds: `${beach1Id},${beach2Id},${beach3Id}`,
        },
      });

      const response = await GET(request);
      const result = await expectSuccessResponse(response, 200);

      // Should return forecasts for beaches that succeeded
      expect(result.data.forecasts).toHaveProperty(beach1Id);
      expect(result.data.forecasts).toHaveProperty(beach3Id);
      // Beach 2 should be missing (partial failure)
      expect(result.data.forecasts).not.toHaveProperty(beach2Id);
    });

    it("returns empty forecasts on database error", async () => {
      const beachIds = "beach-1,beach-2";

      const chain: any = {
        select: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
      };
      chain.then = (resolve: any) => Promise.resolve(resolve({
        data: null,
        error: { message: "Database connection failed", code: "CONNECTION_ERROR" },
      }));
      (mockSupabaseClient.from as jest.Mock).mockReturnValue(chain);

      const request = createMockRequest("GET", "http://localhost:3000/api/forecasts/bulk", {
        searchParams: { beachIds },
      });

      const response = await GET(request);
      const result = await expectSuccessResponse(response, 200);

      // Should return empty forecasts instead of throwing
      expect(result.data.forecasts).toEqual({});
    });

    it("returns empty forecasts on unexpected error", async () => {
      const beachIds = "beach-1,beach-2";

      (mockSupabaseClient.from as jest.Mock).mockImplementation(() => {
        throw new Error("Unexpected error");
      });

      const request = createMockRequest("GET", "http://localhost:3000/api/forecasts/bulk", {
        searchParams: { beachIds },
      });

      const response = await GET(request);
      const result = await expectSuccessResponse(response, 200);

      // Should return empty forecasts instead of throwing
      expect(result.data.forecasts).toEqual({});
    });

    it("handles forecasts with undefined wave_height", async () => {
      const beach1Id = "beach-1";

      const mockForecasts = [
        {
          beach_id: beach1Id,
          forecast_date: "2024-01-15",
          forecast_time: "12:00",
          wave_height: undefined,
        },
      ];

      (mockSupabaseClient.from as jest.Mock).mockImplementation(() => {
        const chain = {
          select: jest.fn().mockReturnThis(),
          in: jest.fn().mockReturnThis(),
          gte: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
        };
        (chain.order as jest.Mock).mockResolvedValue({
          data: mockForecasts,
          error: null,
        });
        return chain;
      });

      mockGetCurrentForecast.mockImplementation((forecasts: any[]) => {
        return forecasts[0];
      });

      const request = createMockRequest("GET", "http://localhost:3000/api/forecasts/bulk", {
        searchParams: {
          beachIds: beach1Id,
        },
      });

      const response = await GET(request);
      const result = await expectSuccessResponse(response, 200);

      // Beach should not have a forecast entry if wave_height is undefined
      expect(result.data.forecasts).not.toHaveProperty(beach1Id);
    });
  });

  describe("Data Filtering", () => {
    it("only fetches today or future forecasts", async () => {
      const beachId = "beach-1";
      let gteValue: string | undefined;

      const chain: any = {
        select: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        gte: jest.fn((column: string, value: string) => {
          gteValue = value;
          return chain;
        }),
        order: jest.fn().mockReturnThis(),
      };
      chain.then = (resolve: any) => Promise.resolve(resolve({ data: [], error: null }));
      (mockSupabaseClient.from as jest.Mock).mockReturnValue(chain);

      const request = createMockRequest("GET", "http://localhost:3000/api/forecasts/bulk", {
        searchParams: { beachIds: beachId },
      });

      await GET(request);

      // Should filter by today's date
      expect(gteValue).toBeDefined();
      expect(gteValue).toMatch(/^\d{4}-\d{2}-\d{2}$/); // YYYY-MM-DD format
    });

    it("returns forecasts ordered by beach_id, date, and time", async () => {
      const beachIds = "beach-1,beach-2";
      let orderCalls: Array<{ column: string; ascending: boolean }> = [];

      const chain: any = {
        select: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        order: jest.fn((column: string, options: any) => {
          orderCalls.push({ column, ascending: options.ascending });
          return chain;
        }),
      };
      chain.then = (resolve: any) => Promise.resolve(resolve({ data: [], error: null }));
      (mockSupabaseClient.from as jest.Mock).mockReturnValue(chain);

      const request = createMockRequest("GET", "http://localhost:3000/api/forecasts/bulk", {
        searchParams: { beachIds },
      });

      await GET(request);

      // Should order by beach_id, forecast_date, forecast_time
      expect(orderCalls).toHaveLength(3);
      expect(orderCalls[0]).toEqual({ column: "beach_id", ascending: true });
      expect(orderCalls[1]).toEqual({ column: "forecast_date", ascending: true });
      expect(orderCalls[2]).toEqual({ column: "forecast_time", ascending: true });
    });
  });

  describe("Input Parsing", () => {
    it("trims whitespace from beach IDs", async () => {
      const beach1Id = "beach-1";
      const beach2Id = "beach-2";
      let queriedIds: string[] = [];

      const chain: any = {
        select: jest.fn().mockReturnThis(),
        in: jest.fn((column: string, ids: string[]) => {
          queriedIds = ids;
          return chain;
        }),
        gte: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
      };
      chain.then = (resolve: any) => Promise.resolve(resolve({ data: [], error: null }));
      (mockSupabaseClient.from as jest.Mock).mockReturnValue(chain);

      const request = createMockRequest("GET", "http://localhost:3000/api/forecasts/bulk", {
        searchParams: {
          beachIds: `  ${beach1Id}  ,  ${beach2Id}  `,
        },
      });

      await GET(request);

      // IDs should be trimmed
      expect(queriedIds).toEqual([beach1Id, beach2Id]);
    });

    it("filters out empty strings from beach IDs", async () => {
      const beach1Id = "beach-1";
      let queriedIds: string[] = [];

      const chain: any = {
        select: jest.fn().mockReturnThis(),
        in: jest.fn((column: string, ids: string[]) => {
          queriedIds = ids;
          return chain;
        }),
        gte: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
      };
      chain.then = (resolve: any) => Promise.resolve(resolve({ data: [], error: null }));
      (mockSupabaseClient.from as jest.Mock).mockReturnValue(chain);

      const request = createMockRequest("GET", "http://localhost:3000/api/forecasts/bulk", {
        searchParams: {
          beachIds: `${beach1Id},,,`,
        },
      });

      await GET(request);

      // Empty strings should be filtered out
      expect(queriedIds).toEqual([beach1Id]);
    });
  });

  describe("getCurrentForecast Integration", () => {
    it("uses getCurrentForecast to select appropriate forecast", async () => {
      const beachId = "beach-1";
      const mockForecasts = [
        {
          beach_id: beachId,
          forecast_date: "2024-01-15",
          forecast_time: "09:00",
          wave_height: 3.0,
        },
        {
          beach_id: beachId,
          forecast_date: "2024-01-15",
          forecast_time: "12:00",
          wave_height: 4.5,
        },
        {
          beach_id: beachId,
          forecast_date: "2024-01-15",
          forecast_time: "15:00",
          wave_height: 5.0,
        },
      ];

      const chain: any = {
        select: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
      };
      chain.then = (resolve: any) => Promise.resolve(resolve({ data: mockForecasts, error: null }));
      (mockSupabaseClient.from as jest.Mock).mockReturnValue(chain);

      // Mock getCurrentForecast to return the 12:00 forecast
      mockGetCurrentForecast.mockReturnValue(mockForecasts[1]);

      const request = createMockRequest("GET", "http://localhost:3000/api/forecasts/bulk", {
        searchParams: { beachIds: beachId },
      });

      const response = await GET(request);
      const result = await expectSuccessResponse(response, 200);

      // Should use the forecast selected by getCurrentForecast
      expect(mockGetCurrentForecast).toHaveBeenCalled();
      expect(result.data.forecasts[beachId]).toBe(4.5);
    });
  });
});
