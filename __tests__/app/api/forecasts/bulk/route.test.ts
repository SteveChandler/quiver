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
  forecasts: Record<string, number | undefined>;
  waterTemps: Record<string, string | undefined>;
  isCalibrated: Record<string, boolean>;
}

// Mock the Supabase server client
const mockSupabaseClient = createMockSupabaseClient();

jest.mock("@/lib/supabase/api-server-client", () => ({
  createAPIServerClient: jest.fn(() => mockSupabaseClient),
}));

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: jest.fn(() => mockSupabaseClient),
}));

// Mock API utils
jest.mock("@/lib/api-utils", () => {
  const actual = jest.requireActual("@/lib/api-utils");
  return {
    ...actual,
    createSuccessResponse: jest.fn((data: any) => {
      return new Response(JSON.stringify({ success: true, data, timestamp: new Date().toISOString() }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }),
    handleApiError: jest.fn((error: any, message: string) => {
      return new Response(JSON.stringify({ success: false, error: message, timestamp: new Date().toISOString() }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }),
  };
});

describe("/api/forecasts/bulk", () => {
  let cleanup: () => void;

  beforeEach(() => {
    const testEnv = setupApiTestEnvironment();
    cleanup = testEnv.cleanup;
    jest.clearAllMocks();

    // Default: RPC returns empty array
    (mockSupabaseClient as any).rpc = jest.fn().mockResolvedValue({
      data: [],
      error: null,
    });
  });

  afterEach(() => {
    cleanup?.();
  });

  describe("GET", () => {
    it("should return empty forecasts when beachIds parameter is missing", async () => {
      const request = createMockRequest("GET", "http://localhost:3000/api/forecasts/bulk");
      const response = await GET(request);

      const data = await expectSuccessResponse<BulkForecastResponse>(response, 200);
      expect(data.data).toEqual({ forecasts: {}, waterTemps: {}, isCalibrated: {} });
      expect(mockSupabaseClient.rpc).not.toHaveBeenCalled();
    });

    it("should return empty forecasts when beachIds parameter is empty string", async () => {
      const request = createMockRequest("GET", "http://localhost:3000/api/forecasts/bulk?beachIds=");
      const response = await GET(request);

      const data = await expectSuccessResponse<BulkForecastResponse>(response, 200);
      expect(data.data).toEqual({ forecasts: {}, waterTemps: {}, isCalibrated: {} });
      expect(mockSupabaseClient.rpc).not.toHaveBeenCalled();
    });

    it("should return empty forecasts when beachIds contains only whitespace", async () => {
      const request = createMockRequest("GET", "http://localhost:3000/api/forecasts/bulk?beachIds=   ");
      const response = await GET(request);

      const data = await expectSuccessResponse<BulkForecastResponse>(response, 200);
      expect(data.data).toEqual({ forecasts: {}, waterTemps: {}, isCalibrated: {} });
      expect(mockSupabaseClient.rpc).not.toHaveBeenCalled();
    });

    it("should call RPC with correct beach IDs for single beach", async () => {
      (mockSupabaseClient as any).rpc = jest.fn().mockResolvedValue({
        data: [{ beach_id: "beach-1", wave_height: "1.2" }],
        error: null,
      });

      const request = createMockRequest("GET", "http://localhost:3000/api/forecasts/bulk?beachIds=beach-1");
      const response = await GET(request);

      const data = await expectSuccessResponse<BulkForecastResponse>(response, 200);

      // Verify RPC was called with correct function and params
      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith("get_bulk_current_forecasts", {
        p_beach_ids: ["beach-1"],
      });

      // Verify response includes wave height
      expect(data.data.forecasts).toHaveProperty("beach-1");
      expect(data.data.forecasts["beach-1"]).toBe("1.2");
    });

    it("should fetch forecasts for multiple beaches", async () => {
      (mockSupabaseClient as any).rpc = jest.fn().mockResolvedValue({
        data: [
          { beach_id: "beach-1", wave_height: "2.5" },
          { beach_id: "beach-2", wave_height: "3.2" },
          { beach_id: "beach-3", wave_height: "1.8" },
        ],
        error: null,
      });

      const request = createMockRequest("GET", "http://localhost:3000/api/forecasts/bulk?beachIds=beach-1,beach-2,beach-3");
      const response = await GET(request);

      const data = await expectSuccessResponse<BulkForecastResponse>(response, 200);

      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith("get_bulk_current_forecasts", {
        p_beach_ids: ["beach-1", "beach-2", "beach-3"],
      });

      expect(data.data.forecasts).toHaveProperty("beach-1");
      expect(data.data.forecasts).toHaveProperty("beach-2");
      expect(data.data.forecasts).toHaveProperty("beach-3");
    });

    it("should respect 50 beach limit", async () => {
      // Create 60 beach IDs
      const beachIds = Array.from({ length: 60 }, (_, i) => `beach-${i}`);

      const request = createMockRequest("GET", `http://localhost:3000/api/forecasts/bulk?beachIds=${beachIds.join(",")}`);
      await GET(request);

      // Verify only first 50 beach IDs were sent to RPC
      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith("get_bulk_current_forecasts", {
        p_beach_ids: beachIds.slice(0, 50),
      });
    });

    it("should handle whitespace in beach IDs", async () => {
      const request = createMockRequest("GET", "http://localhost:3000/api/forecasts/bulk?beachIds= beach-1 , beach-2 , ");
      await GET(request);

      // Verify beach IDs were trimmed and empty strings filtered out
      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith("get_bulk_current_forecasts", {
        p_beach_ids: ["beach-1", "beach-2"],
      });
    });

    it("should return 500 error when database errors occur", async () => {
      (mockSupabaseClient as any).rpc = jest.fn().mockResolvedValue({
        data: null,
        error: { message: "Database connection failed" },
      });

      const request = createMockRequest("GET", "http://localhost:3000/api/forecasts/bulk?beachIds=beach-1");
      const response = await GET(request);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain("Failed to fetch bulk forecasts");
    });

    it("should return empty forecasts when no forecasts exist for beach", async () => {
      (mockSupabaseClient as any).rpc = jest.fn().mockResolvedValue({
        data: [],
        error: null,
      });

      const request = createMockRequest("GET", "http://localhost:3000/api/forecasts/bulk?beachIds=beach-1,beach-2");
      const response = await GET(request);

      const data = await expectSuccessResponse<BulkForecastResponse>(response, 200);
      expect(data.data).toEqual({ forecasts: {}, waterTemps: {}, isCalibrated: {} });
    });

    it("should handle null data from database", async () => {
      (mockSupabaseClient as any).rpc = jest.fn().mockResolvedValue({
        data: null,
        error: null,
      });

      const request = createMockRequest("GET", "http://localhost:3000/api/forecasts/bulk?beachIds=beach-1");
      const response = await GET(request);

      const data = await expectSuccessResponse<BulkForecastResponse>(response, 200);
      expect(data.data).toEqual({ forecasts: {}, waterTemps: {}, isCalibrated: {} });
    });

    it("should handle beaches with no matching forecasts in the result set", async () => {
      (mockSupabaseClient as any).rpc = jest.fn().mockResolvedValue({
        data: [
          { beach_id: "beach-1", wave_height: "2.5" },
          // beach-2 has no row returned by RPC
        ],
        error: null,
      });

      const request = createMockRequest("GET", "http://localhost:3000/api/forecasts/bulk?beachIds=beach-1,beach-2");
      const response = await GET(request);

      const data = await expectSuccessResponse<BulkForecastResponse>(response, 200);

      // beach-1 should have forecast, beach-2 should not be in the response
      expect(data.data.forecasts).toHaveProperty("beach-1");
      expect(data.data.forecasts).not.toHaveProperty("beach-2");
    });

    it("should skip beaches with null wave_height", async () => {
      (mockSupabaseClient as any).rpc = jest.fn().mockResolvedValue({
        data: [
          { beach_id: "beach-1", wave_height: null },
        ],
        error: null,
      });

      const request = createMockRequest("GET", "http://localhost:3000/api/forecasts/bulk?beachIds=beach-1");
      const response = await GET(request);

      const data = await expectSuccessResponse<BulkForecastResponse>(response, 200);

      // Should not include beach when wave_height is null
      expect(data.data.forecasts).toEqual({});
    });
  });

  describe("isCalibrated envelope field", () => {
    // Helper: stub `from()` so the `beaches` call returns the given rows
    // while other tables fall through to the default empty chain.
    function stubBeachesQuery(
      rows: Array<{ id: string; shoaling_factors: unknown }> | null,
      error: { message: string } | null = null,
    ) {
      const defaultFrom = (mockSupabaseClient as any).from;
      (mockSupabaseClient as any).from = jest.fn((table: string) => {
        if (table === "beaches") {
          const chain: any = {
            select: jest.fn(),
            in: jest.fn(),
            then: jest.fn((onResolve: any) =>
              Promise.resolve(onResolve({ data: rows, error })),
            ),
          };
          chain.select.mockReturnValue(chain);
          chain.in.mockReturnValue(chain);
          return chain;
        }
        // Fall through to the shared default chain factory
        return defaultFrom(table);
      });
    }

    it("returns is_calibrated=true for beaches with shoaling_factors set", async () => {
      (mockSupabaseClient as any).rpc = jest.fn().mockResolvedValue({
        data: [{ beach_id: "beach-calibrated", wave_height: "2.5" }],
        error: null,
      });
      stubBeachesQuery([
        { id: "beach-calibrated", shoaling_factors: { "180": 0.9 } },
      ]);

      const request = createMockRequest(
        "GET",
        "http://localhost:3000/api/forecasts/bulk?beachIds=beach-calibrated",
      );
      const response = await GET(request);
      const data = await expectSuccessResponse<BulkForecastResponse>(response, 200);

      expect(data.data.isCalibrated).toEqual({ "beach-calibrated": true });
    });

    it("returns is_calibrated=false for beaches with shoaling_factors null", async () => {
      (mockSupabaseClient as any).rpc = jest.fn().mockResolvedValue({
        data: [{ beach_id: "beach-ml-only", wave_height: "1.8" }],
        error: null,
      });
      stubBeachesQuery([
        { id: "beach-ml-only", shoaling_factors: null },
      ]);

      const request = createMockRequest(
        "GET",
        "http://localhost:3000/api/forecasts/bulk?beachIds=beach-ml-only",
      );
      const response = await GET(request);
      const data = await expectSuccessResponse<BulkForecastResponse>(response, 200);

      expect(data.data.isCalibrated).toEqual({ "beach-ml-only": false });
    });

    it("mixes calibrated and uncalibrated beaches in a single response", async () => {
      (mockSupabaseClient as any).rpc = jest.fn().mockResolvedValue({
        data: [
          { beach_id: "beach-a", wave_height: "2.5" },
          { beach_id: "beach-b", wave_height: "3.1" },
        ],
        error: null,
      });
      stubBeachesQuery([
        { id: "beach-a", shoaling_factors: { "270": 1.05 } },
        { id: "beach-b", shoaling_factors: null },
      ]);

      const request = createMockRequest(
        "GET",
        "http://localhost:3000/api/forecasts/bulk?beachIds=beach-a,beach-b",
      );
      const response = await GET(request);
      const data = await expectSuccessResponse<BulkForecastResponse>(response, 200);

      expect(data.data.isCalibrated).toEqual({
        "beach-a": true,
        "beach-b": false,
      });
    });

    it("defaults to empty isCalibrated map when beaches query errors", async () => {
      (mockSupabaseClient as any).rpc = jest.fn().mockResolvedValue({
        data: [{ beach_id: "beach-1", wave_height: "2.5" }],
        error: null,
      });
      stubBeachesQuery(null, { message: "rls denied" });

      const request = createMockRequest(
        "GET",
        "http://localhost:3000/api/forecasts/bulk?beachIds=beach-1",
      );
      const response = await GET(request);
      const data = await expectSuccessResponse<BulkForecastResponse>(response, 200);

      // Wave heights still flow through; calibration map is empty so
      // clients treat the beach as uncalibrated by default.
      expect(data.data.forecasts).toHaveProperty("beach-1");
      expect(data.data.isCalibrated).toEqual({});
    });
  });
});
