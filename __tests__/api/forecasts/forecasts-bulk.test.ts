/**
 * @jest-environment node
 */

import {
  createMockSupabaseClient,
  createMockRequest,
  expectSuccessResponse,
  setupApiTestEnvironment,
} from "@/test-utils/api-test-helpers";

/** Type for the forecasts bulk API response */
interface ForecastsBulkResponse {
  forecasts: Record<string, number>;
}

// Mock the Supabase server client
const mockSupabaseClient = createMockSupabaseClient();

jest.mock("@/lib/middleware/api-wrappers", () => ({
  withRateLimit: (handler: any) => handler,
  withAuth: (handler: any) => (request: any, context: any) =>
    handler(request, {
      params: context?.params ?? {},
      user: null,
      supabase: mockSupabaseClient,
    }),
  createSuccessResponse: jest.fn((data: any) => {
    return new Response(JSON.stringify({ success: true, data }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }),
  handleApiError: jest.fn((error: any, message: string) => {
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }),
}));

jest.mock("@/lib/supabase/api-server-client", () => ({
  createAPIServerClient: jest.fn(() => mockSupabaseClient),
}));

// Import after mocks
 
const { GET } = require("@/app/api/forecasts/bulk/route");

describe("GET /api/forecasts/bulk", () => {
  let cleanup: () => void;

  beforeEach(() => {
    const testEnv = setupApiTestEnvironment();
    cleanup = testEnv.cleanup;
    jest.clearAllMocks();

    // Mock rpc function (route now uses RPC instead of direct queries)
    (mockSupabaseClient.rpc as jest.Mock) = jest.fn().mockResolvedValue({
      data: [],
      error: null,
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

      const mockRpcData = [
        { beach_id: beach1Id, wave_height: 4.5 },
        { beach_id: beach2Id, wave_height: 3.2 },
        { beach_id: beach3Id, wave_height: 5.8 },
      ];

      (mockSupabaseClient.rpc as jest.Mock).mockResolvedValue({
        data: mockRpcData,
        error: null,
      });

      const request = createMockRequest("GET", "http://localhost:3000/api/forecasts/bulk", {
        searchParams: {
          beachIds: `${beach1Id},${beach2Id},${beach3Id}`,
        },
      });

      const response = await GET(request);
      const result = await expectSuccessResponse<ForecastsBulkResponse>(response, 200);

      expect(result.data).toHaveProperty("forecasts");
      expect(result.data.forecasts).toHaveProperty(beach1Id, 4.5);
      expect(result.data.forecasts).toHaveProperty(beach2Id, 3.2);
      expect(result.data.forecasts).toHaveProperty(beach3Id, 5.8);
    });

    it("returns empty forecasts for missing beachIds parameter", async () => {
      const request = createMockRequest("GET", "http://localhost:3000/api/forecasts/bulk");

      const response = await GET(request);
      const result = await expectSuccessResponse<ForecastsBulkResponse>(response, 200);

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
      const result = await expectSuccessResponse<ForecastsBulkResponse>(response, 200);

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
      const result = await expectSuccessResponse<ForecastsBulkResponse>(response, 200);

      expect(result.data).toHaveProperty("forecasts");
      expect(result.data.forecasts).toEqual({});
    });

    it("handles beaches with no forecast data", async () => {
      const beach1Id = "beach-with-forecast";
      const beach2Id = "beach-without-forecast";

      const mockRpcData = [
        { beach_id: beach1Id, wave_height: 4.5 },
      ];

      (mockSupabaseClient.rpc as jest.Mock).mockResolvedValue({
        data: mockRpcData,
        error: null,
      });

      const request = createMockRequest("GET", "http://localhost:3000/api/forecasts/bulk", {
        searchParams: {
          beachIds: `${beach1Id},${beach2Id}`,
        },
      });

      const response = await GET(request);
      const result = await expectSuccessResponse<ForecastsBulkResponse>(response, 200);

      expect(result.data.forecasts).toHaveProperty(beach1Id, 4.5);
      expect(result.data.forecasts).not.toHaveProperty(beach2Id);
    });

    it("limits to 50 beaches maximum", async () => {
      // Create 60 beach IDs
      const beachIds = Array.from({ length: 60 }, (_, i) => `beach-${i + 1}`);

      let rpcBeachIds: string[] = [];
      (mockSupabaseClient.rpc as jest.Mock).mockImplementation((fnName: string, params: any) => {
        rpcBeachIds = params.p_beach_ids || [];
        const mockData = rpcBeachIds.slice(0, 50).map((id, i) => ({
          beach_id: id,
          wave_height: i + 1,
        }));
        return Promise.resolve({ data: mockData, error: null });
      });

      const request = createMockRequest("GET", "http://localhost:3000/api/forecasts/bulk", {
        searchParams: {
          beachIds: beachIds.join(","),
        },
      });

      await GET(request);

      // Verify only 50 beaches were passed to RPC
      expect(rpcBeachIds.length).toBe(50);
    });
  });

  describe("Partial Failures", () => {
    it("handles partial failures gracefully", async () => {
      const beach1Id = "beach-1";
      const beach2Id = "beach-2";
      const beach3Id = "beach-3";

      const mockRpcData = [
        { beach_id: beach1Id, wave_height: 4.5 },
        { beach_id: beach3Id, wave_height: 5.8 },
      ];

      (mockSupabaseClient.rpc as jest.Mock).mockResolvedValue({
        data: mockRpcData,
        error: null,
      });

      const request = createMockRequest("GET", "http://localhost:3000/api/forecasts/bulk", {
        searchParams: {
          beachIds: `${beach1Id},${beach2Id},${beach3Id}`,
        },
      });

      const response = await GET(request);
      const result = await expectSuccessResponse<ForecastsBulkResponse>(response, 200);

      // Should return forecasts for beaches that succeeded
      expect(result.data.forecasts).toHaveProperty(beach1Id);
      expect(result.data.forecasts).toHaveProperty(beach3Id);
      // Beach 2 should be missing (partial failure)
      expect(result.data.forecasts).not.toHaveProperty(beach2Id);
    });

    it("returns 500 error on database error", async () => {
      const beachIds = "beach-1,beach-2";

      (mockSupabaseClient.rpc as jest.Mock).mockResolvedValue({
        data: null,
        error: { message: "Database connection failed", code: "CONNECTION_ERROR" },
      });

      const request = createMockRequest("GET", "http://localhost:3000/api/forecasts/bulk", {
        searchParams: { beachIds },
      });

      const response = await GET(request);

      // Database connection errors are genuine server errors - 500 is correct
      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.success).toBe(false);
    });

    it("returns 500 error on unexpected error", async () => {
      const beachIds = "beach-1,beach-2";

      (mockSupabaseClient.rpc as jest.Mock).mockRejectedValue(new Error("Unexpected error"));

      const request = createMockRequest("GET", "http://localhost:3000/api/forecasts/bulk", {
        searchParams: { beachIds },
      });

      const response = await GET(request);

      // Unexpected errors are genuine server errors - 500 is correct
      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.success).toBe(false);
    });

    it("handles forecasts with null wave_height", async () => {
      const beach1Id = "beach-1";

      const mockRpcData = [
        { beach_id: beach1Id, wave_height: null },
      ];

      (mockSupabaseClient.rpc as jest.Mock).mockResolvedValue({
        data: mockRpcData,
        error: null,
      });

      const request = createMockRequest("GET", "http://localhost:3000/api/forecasts/bulk", {
        searchParams: {
          beachIds: beach1Id,
        },
      });

      const response = await GET(request);
      const result = await expectSuccessResponse<ForecastsBulkResponse>(response, 200);

      // Beach should not have a forecast entry if wave_height is null
      expect(result.data.forecasts).not.toHaveProperty(beach1Id);
    });
  });

  describe("Data Filtering", () => {
    it("uses RPC function for bulk forecast retrieval", async () => {
      const beachId = "beach-1";

      (mockSupabaseClient.rpc as jest.Mock).mockResolvedValue({
        data: [],
        error: null,
      });

      const request = createMockRequest("GET", "http://localhost:3000/api/forecasts/bulk", {
        searchParams: { beachIds: beachId },
      });

      await GET(request);

      // Should call RPC function with beach IDs
      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith("get_bulk_current_forecasts", {
        p_beach_ids: [beachId],
      });
    });

    it("calls RPC with array of beach IDs", async () => {
      const beachIds = "beach-1,beach-2";

      (mockSupabaseClient.rpc as jest.Mock).mockResolvedValue({
        data: [],
        error: null,
      });

      const request = createMockRequest("GET", "http://localhost:3000/api/forecasts/bulk", {
        searchParams: { beachIds },
      });

      await GET(request);

      // Should call RPC with parsed beach IDs
      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith("get_bulk_current_forecasts", {
        p_beach_ids: ["beach-1", "beach-2"],
      });
    });
  });

  describe("Input Parsing", () => {
    it("trims whitespace from beach IDs", async () => {
      const beach1Id = "beach-1";
      const beach2Id = "beach-2";

      (mockSupabaseClient.rpc as jest.Mock).mockResolvedValue({
        data: [],
        error: null,
      });

      const request = createMockRequest("GET", "http://localhost:3000/api/forecasts/bulk", {
        searchParams: {
          beachIds: `  ${beach1Id}  ,  ${beach2Id}  `,
        },
      });

      await GET(request);

      // IDs should be trimmed before passing to RPC
      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith("get_bulk_current_forecasts", {
        p_beach_ids: [beach1Id, beach2Id],
      });
    });

    it("filters out empty strings from beach IDs", async () => {
      const beach1Id = "beach-1";

      (mockSupabaseClient.rpc as jest.Mock).mockResolvedValue({
        data: [],
        error: null,
      });

      const request = createMockRequest("GET", "http://localhost:3000/api/forecasts/bulk", {
        searchParams: {
          beachIds: `${beach1Id},,,`,
        },
      });

      await GET(request);

      // Empty strings should be filtered out
      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith("get_bulk_current_forecasts", {
        p_beach_ids: [beach1Id],
      });
    });
  });

  describe("RPC Function Integration", () => {
    it("returns wave heights from RPC function", async () => {
      const beachId = "beach-1";

      const mockRpcData = [
        { beach_id: beachId, wave_height: 4.5 },
      ];

      (mockSupabaseClient.rpc as jest.Mock).mockResolvedValue({
        data: mockRpcData,
        error: null,
      });

      const request = createMockRequest("GET", "http://localhost:3000/api/forecasts/bulk", {
        searchParams: { beachIds: beachId },
      });

      const response = await GET(request);
      const result = await expectSuccessResponse<ForecastsBulkResponse>(response, 200);

      // Should return wave height from RPC result
      expect(result.data.forecasts[beachId]).toBe(4.5);
    });
  });
});
