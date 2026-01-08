/**
 * @jest-environment node
 */

import { GET } from "@/app/api/v1/recommendations/route";
import {
  createMockRequest,
  createMockSupabaseClient,
  expectErrorResponse,
  expectSuccessResponse,
  setupApiTestEnvironment,
} from "@/test-utils/api-test-helpers";

const mockSupabaseClient = createMockSupabaseClient();

jest.mock("@/lib/middleware/rate-limiter", () => ({
  withRateLimit: (handler: any) => handler,
}));

jest.mock("@/lib/supabase/api-server-client", () => ({
  createAPIServerClient: jest.fn(() => mockSupabaseClient),
}));

describe("GET /api/v1/recommendations", () => {
  let cleanup: () => void;

  beforeEach(() => {
    const env = setupApiTestEnvironment();
    cleanup = env.cleanup;
    jest.clearAllMocks();
  });

  afterEach(() => {
    cleanup?.();
  });

  describe("input validation", () => {
    it("returns 400 for missing coordinates", async () => {
      const req = createMockRequest(
        "GET",
        "http://localhost:3000/api/v1/recommendations"
      );
      const res = await GET(req);
      await expectErrorResponse(res, 400, "Missing required parameters");
    });

    it("returns 400 for non-numeric coordinates", async () => {
      const req = createMockRequest(
        "GET",
        "http://localhost:3000/api/v1/recommendations",
        { searchParams: { lat: "nope", lon: "also-nope" } }
      );
      const res = await GET(req);
      await expectErrorResponse(res, 400, "Invalid coordinate format");
    });

    it("returns 400 for out-of-range coordinates", async () => {
      const req = createMockRequest(
        "GET",
        "http://localhost:3000/api/v1/recommendations",
        { searchParams: { lat: "100", lon: "-200" } }
      );
      const res = await GET(req);
      await expectErrorResponse(res, 400, "Coordinates out of valid range");
    });

    it("returns 400 for invalid time", async () => {
      const req = createMockRequest(
        "GET",
        "http://localhost:3000/api/v1/recommendations",
        { searchParams: { lat: "32.79", lon: "-117.23", time: "not-a-date" } }
      );
      const res = await GET(req);
      await expectErrorResponse(res, 400, "Invalid time format");
    });
  });

  describe("degraded service", () => {
    it("includes degradation metadata when PostGIS RPC fails", async () => {
      mockSupabaseClient.rpc.mockResolvedValueOnce({
        data: null,
        error: { message: "RPC not found" },
      });

      const beachesChain = mockSupabaseClient.from();
      // terminal await is on limit()
      beachesChain.limit.mockResolvedValueOnce({
        data: [
          {
            id: "beach-1",
            name: "Test Beach",
            is_private: false,
            created_at: new Date().toISOString(),
          },
        ],
        error: null,
      });

      // For forecast queries, return empty results quickly
      const marineChain: any = {};
      marineChain.select = jest.fn(() => marineChain);
      marineChain.in = jest.fn(() => marineChain);
      marineChain.gte = jest.fn(() => marineChain);
      marineChain.lte = jest.fn(() => marineChain);
      marineChain.order = jest
        .fn()
        .mockReturnValueOnce(marineChain)
        .mockResolvedValueOnce({ data: [], error: null });

      const tideChain: any = {};
      tideChain.select = jest.fn(() => tideChain);
      tideChain.in = jest.fn(() => tideChain);
      tideChain.gte = jest.fn(() => tideChain);
      tideChain.lte = jest.fn(() => tideChain);
      tideChain.order = jest
        .fn()
        .mockReturnValueOnce(tideChain)
        .mockResolvedValueOnce({ data: [], error: null });

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === "beaches") return beachesChain as any;
        if (table === "marine_forecasts") return marineChain;
        if (table === "tide_forecasts") return tideChain;
        return beachesChain as any;
      });

      const req = createMockRequest(
        "GET",
        "http://localhost:3000/api/v1/recommendations",
        { searchParams: { lat: "32.79", lon: "-117.23" } }
      );

      const res = await GET(req);
      const body = await expectSuccessResponse<any>(res, 200);

      expect(body.data).toHaveProperty("metadata");
      expect(body.data.metadata).toHaveProperty("degradation");
      expect(body.data.metadata.degradation).toMatchObject({
        postgis_unavailable: true,
        fallback_to_simple_query: true,
      });
    });
  });
});















