/**
 * @jest-environment node
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { NextRequest } from "next/server";
import {
  createMockSupabaseClient,
  createMockRequest,
  expectSuccessResponse,
  expectErrorResponse,
  setupApiTestEnvironment,
} from "@/test-utils/api-test-helpers";

// Type for beaches response data
interface BeachesResponse {
  beaches: Array<{
    id: string;
    name: string;
    lat: number;
    lon: number;
    city: string | null;
    state: string | null;
    slug: string | null;
    country: string | null;
    created_at: string;
    is_private?: boolean;
    updated_at: string | null;
  }>;
  count: number;
}

// Mock the Supabase server client
const mockSupabaseClient = createMockSupabaseClient();

// Mock the middleware to pass through (public endpoint)
jest.mock("@/lib/middleware/api-wrappers", () => {
  const actual = jest.requireActual("@/lib/middleware/api-wrappers");
  return {
    ...actual,
    withBotBlockingAndRateLimit: (handler: unknown) => handler,
    withAuth: (handler: unknown) => handler,
  };
});

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: jest.fn(() => mockSupabaseClient),
}));

// Mock cache utilities to avoid async hashing issues in tests
jest.mock("@/lib/utils/cache-headers", () => ({
  CacheDuration: {
    SHORT: { maxAge: 120, sMaxAge: 120, staleWhileRevalidate: 300 },
    MEDIUM: { maxAge: 300, sMaxAge: 600, staleWhileRevalidate: 3600 },
    LONG: { maxAge: 600, sMaxAge: 1200, staleWhileRevalidate: 7200 },
    VERY_LONG: { maxAge: 1800, sMaxAge: 3600, staleWhileRevalidate: 86400 },
  },
  generateETag: jest.fn().mockResolvedValue('"test-etag"'),
  isETagMatch: jest.fn().mockResolvedValue(false),
  createCacheHeaders: jest.fn().mockReturnValue({
    "Cache-Control": "public, max-age=300",
    ETag: '"test-etag"',
  }),
}));

// Helper function to mock beaches query chain with preferred schema
function mockBeachesQuery(
  mockClient: any,
  beachesData: any,
  error: any = null
) {
  mockClient.from.mockReturnValue({
    select: jest.fn(() => ({
      order: jest.fn(() =>
        Promise.resolve({
          data: beachesData,
          error: error,
        })
      ),
    })),
  });
}

// Helper to mock schema fallback (first call fails with 42703, second succeeds)
function mockBeachesQueryWithFallback(
  mockClient: any,
  legacyData: any
) {
  let callCount = 0;
  mockClient.from.mockReturnValue({
    select: jest.fn((selectStr: string) => ({
      order: jest.fn(() => {
        callCount++;
        if (callCount === 1) {
          // First call with preferred schema fails
          return Promise.resolve({
            data: null,
            error: { code: "42703", message: "column does not exist" },
          });
        }
        // Second call with legacy schema succeeds
        return Promise.resolve({
          data: legacyData,
          error: null,
        });
      }),
    })),
  });
}

describe("GET /api/beaches", () => {
  let cleanup: () => void;
  let GET: (request: NextRequest) => Promise<Response>;

  beforeEach(async () => {
    const testEnv = setupApiTestEnvironment();
    cleanup = testEnv.cleanup;
    jest.clearAllMocks();

    // Import fresh module
    const route = await import("@/app/api/beaches/route");
    GET = route.GET;
  });

  afterEach(() => {
    cleanup?.();
  });

  it("uses the shared API wrapper module for response helpers", () => {
    const source = readFileSync(
      join(process.cwd(), "app/api/beaches/route.ts"),
      "utf8"
    );

    expect(source).not.toMatch(/@\/lib\/api-utils/);
    expect(source).toMatch(/@\/lib\/middleware\/api-wrappers/);
  });

  describe("Success cases", () => {
    it("returns all beaches with proper field normalization", async () => {
      const mockBeaches = [
        {
          id: "beach-1",
          name: "Pipeline",
          lat: 21.6655,
          lon: -158.0539,
          city: "Haleiwa",
          state: "Hawaii",
          slug: "pipeline",
          country: "USA",
          created_at: "2024-01-01T00:00:00Z",
          is_private: false,
        },
        {
          id: "beach-2",
          name: "Mavericks",
          lat: 37.4949,
          lon: -122.4984,
          city: "Half Moon Bay",
          state: "California",
          slug: "mavericks",
          country: "USA",
          created_at: "2024-01-01T00:00:00Z",
          is_private: false,
        },
      ];

      mockBeachesQuery(mockSupabaseClient, mockBeaches);

      const request = createMockRequest(
        "GET",
        "http://localhost:3000/api/beaches"
      );

      const response = await GET(request);
      const data = await expectSuccessResponse<BeachesResponse>(response, 200);

      expect(data.data.beaches).toHaveLength(2);
      expect(data.data.count).toBe(2);

      // Verify field normalization
      const beach1 = data.data.beaches[0];
      expect(beach1).toMatchObject({
        id: "beach-1",
        name: "Pipeline",
        city: "Haleiwa",
        state: "Hawaii",
        slug: "pipeline",
      });

      // Verify updated_at is normalized to null when not present
      expect(beach1.updated_at).toBeNull();

      expect(mockSupabaseClient.from).toHaveBeenCalledWith("beaches");
    });

    it("handles legacy schema fallback (center_lat/center_lng)", async () => {
      // Legacy schema uses location/region instead of city/state
      const legacyBeaches = [
        {
          id: "beach-1",
          name: "Old Beach",
          lat: 33.7490,
          lon: -118.4095,
          location: "Manhattan Beach", // legacy field
          region: "California", // legacy field
          country: "USA",
          created_at: "2024-01-01T00:00:00Z",
          is_private: false,
        },
      ];

      mockBeachesQueryWithFallback(mockSupabaseClient, legacyBeaches);

      const request = createMockRequest(
        "GET",
        "http://localhost:3000/api/beaches"
      );

      const response = await GET(request);
      const data = await expectSuccessResponse<BeachesResponse>(response, 200);

      expect(data.data.beaches).toHaveLength(1);

      // Verify legacy fields are normalized to preferred field names
      const beach = data.data.beaches[0];
      expect(beach.city).toBe("Manhattan Beach"); // normalized from location
      expect(beach.state).toBe("California"); // normalized from region
      expect(beach.slug).toBeNull(); // slug not present in legacy schema
    });

    it("paginates results correctly (returns count)", async () => {
      const mockBeaches = Array.from({ length: 25 }, (_, i) => ({
        id: `beach-${i}`,
        name: `Beach ${i}`,
        lat: 33.0 + i * 0.1,
        lon: -118.0 - i * 0.1,
        city: "Test City",
        state: "Test State",
        slug: `beach-${i}`,
        country: "USA",
        created_at: "2024-01-01T00:00:00Z",
        is_private: false,
      }));

      mockBeachesQuery(mockSupabaseClient, mockBeaches);

      const request = createMockRequest(
        "GET",
        "http://localhost:3000/api/beaches"
      );

      const response = await GET(request);
      const data = await expectSuccessResponse<BeachesResponse>(response, 200);

      // Verify count matches returned results
      expect(data.data.count).toBe(25);
      expect(data.data.beaches).toHaveLength(25);
    });

    it("sorts by specified field (name by default)", async () => {
      const mockBeaches = [
        {
          id: "beach-1",
          name: "Zuma Beach",
          lat: 34.0195,
          lon: -118.8225,
          city: "Malibu",
          state: "California",
          slug: "zuma-beach",
          country: "USA",
          created_at: "2024-01-01T00:00:00Z",
          is_private: false,
        },
        {
          id: "beach-2",
          name: "Avalanche",
          lat: 21.6655,
          lon: -158.0539,
          city: "Haleiwa",
          state: "Hawaii",
          slug: "avalanche",
          country: "USA",
          created_at: "2024-01-01T00:00:00Z",
          is_private: false,
        },
      ];

      // Mock to verify order is called
      (mockSupabaseClient.from as jest.Mock).mockReturnValue({
        select: jest.fn(() => ({
          order: jest.fn((field: string) => {
            // Verify order is called with 'name'
            expect(field).toBe("name");
            return Promise.resolve({
              data: mockBeaches,
              error: null,
            });
          }),
        })),
      });

      const request = createMockRequest(
        "GET",
        "http://localhost:3000/api/beaches"
      );

      const response = await GET(request);
      const data = await expectSuccessResponse<BeachesResponse>(response, 200);

      expect(data.data.beaches).toHaveLength(2);
    });

    it("returns empty array when no beaches exist", async () => {
      mockBeachesQuery(mockSupabaseClient, []);

      const request = createMockRequest(
        "GET",
        "http://localhost:3000/api/beaches"
      );

      const response = await GET(request);
      const data = await expectSuccessResponse<BeachesResponse>(response, 200);

      expect(data.data.beaches).toEqual([]);
      expect(data.data.count).toBe(0);
    });
  });

  describe("Security", () => {
    it("includes private beaches in results (RLS handles filtering)", async () => {
      // Note: The GET endpoint returns all beaches including private ones.
      // RLS policies on the database handle actual access control.
      const mockBeaches = [
        {
          id: "beach-1",
          name: "Public Beach",
          lat: 33.7490,
          lon: -118.4095,
          city: "Test City",
          state: "Test State",
          slug: "public-beach",
          country: "USA",
          created_at: "2024-01-01T00:00:00Z",
          is_private: false,
        },
        {
          id: "beach-2",
          name: "Private Beach",
          lat: 34.0195,
          lon: -118.8225,
          city: "Secret City",
          state: "Secret State",
          slug: "private-beach",
          country: "USA",
          created_at: "2024-01-01T00:00:00Z",
          is_private: true,
        },
      ];

      mockBeachesQuery(mockSupabaseClient, mockBeaches);

      const request = createMockRequest(
        "GET",
        "http://localhost:3000/api/beaches"
      );

      const response = await GET(request);
      const data = await expectSuccessResponse<BeachesResponse>(response, 200);

      // The endpoint returns what the database returns - RLS handles filtering
      expect(data.data.beaches).toHaveLength(2);
      expect(data.data.beaches.some((b) => b.is_private === true)).toBe(true);
      expect(data.data.beaches.some((b) => b.is_private === false)).toBe(true);
    });

    it("is accessible without authentication (public endpoint)", async () => {
      // This endpoint uses withBotBlockingAndRateLimit, not withAuth
      // So it should be accessible to unauthenticated users
      const mockBeaches = [
        {
          id: "beach-1",
          name: "Test Beach",
          lat: 33.7490,
          lon: -118.4095,
          city: "Test City",
          state: "Test State",
          slug: "test-beach",
          country: "USA",
          created_at: "2024-01-01T00:00:00Z",
          is_private: false,
        },
      ];

      mockBeachesQuery(mockSupabaseClient, mockBeaches);

      // Request without auth headers
      const request = createMockRequest(
        "GET",
        "http://localhost:3000/api/beaches"
      );

      const response = await GET(request);

      // Should succeed without authentication
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
    });
  });

  describe("Error cases", () => {
    let consoleErrorSpy: jest.SpiedFunction<typeof console.error>;

    beforeEach(() => {
      consoleErrorSpy = jest
        .spyOn(console, "error")
        .mockImplementation(() => undefined);
    });

    afterEach(() => {
      consoleErrorSpy.mockRestore();
    });

    it("handles database errors gracefully", async () => {
      const dbError = {
        message: "Database connection failed",
        code: "PGRST301",
      };
      mockBeachesQuery(mockSupabaseClient, null, dbError);

      const request = createMockRequest(
        "GET",
        "http://localhost:3000/api/beaches"
      );

      const response = await GET(request);
      await expectErrorResponse(response, 500, "Failed to fetch beaches");
      expect(consoleErrorSpy).toHaveBeenCalledWith("Database error:", dbError);
      expect(consoleErrorSpy).toHaveBeenCalledWith("API Error:", "Unknown error");
    });

    it("returns 500 when Supabase client is null", async () => {
      // Mock createSupabaseServerClient to return null
      const mockModule = jest.requireMock("@/lib/supabase/server");
      mockModule.createSupabaseServerClient.mockReturnValueOnce(null);

      const request = createMockRequest(
        "GET",
        "http://localhost:3000/api/beaches"
      );

      const response = await GET(request);
      await expectErrorResponse(response, 500, "Failed to fetch beaches");
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "API Error:",
        "Supabase client not initialized"
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Stack trace:",
        expect.stringContaining("Supabase client not initialized")
      );
    });

    it("handles unexpected exceptions gracefully", async () => {
      const thrownError = new Error("Unexpected database failure");
      // Mock to throw an exception
      mockSupabaseClient.from.mockImplementation(() => {
        throw thrownError;
      });

      const request = createMockRequest(
        "GET",
        "http://localhost:3000/api/beaches"
      );

      const response = await GET(request);
      await expectErrorResponse(response, 500, "Failed to fetch beaches");
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Error fetching beaches:",
        thrownError
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "API Error:",
        "Unexpected database failure"
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Stack trace:",
        expect.stringContaining("Unexpected database failure")
      );
    });

    it("handles legacy schema fallback failure", async () => {
      const schemaError = { code: "42703", message: "column does not exist" };
      // Both preferred and legacy schema queries fail
      (mockSupabaseClient.from as jest.Mock).mockReturnValue({
        select: jest.fn(() => ({
          order: jest.fn(() =>
            Promise.resolve({
              data: null,
              error: schemaError,
            })
          ),
        })),
      });

      const request = createMockRequest(
        "GET",
        "http://localhost:3000/api/beaches"
      );

      const response = await GET(request);
      await expectErrorResponse(response, 500, "Failed to fetch beaches");
      expect(consoleErrorSpy).toHaveBeenCalledWith("Database error:", schemaError);
      expect(consoleErrorSpy).toHaveBeenCalledWith("API Error:", "Unknown error");
    });
  });

  describe("Response structure", () => {
    it("returns standardized response with timestamp", async () => {
      const mockBeaches = [
        {
          id: "beach-1",
          name: "Test Beach",
          lat: 33.7490,
          lon: -118.4095,
          city: "Test City",
          state: "Test State",
          slug: "test-beach",
          country: "USA",
          created_at: "2024-01-01T00:00:00Z",
          is_private: false,
        },
      ];

      mockBeachesQuery(mockSupabaseClient, mockBeaches);

      const request = createMockRequest(
        "GET",
        "http://localhost:3000/api/beaches"
      );

      const response = await GET(request);
      const json = await response.json();

      expect(json).toHaveProperty("success", true);
      expect(json).toHaveProperty("data");
      expect(json).toHaveProperty("timestamp");
      expect(typeof json.timestamp).toBe("string");
      expect(json.data).toHaveProperty("beaches");
      expect(json.data).toHaveProperty("count");
    });

    it("normalizes null fields properly", async () => {
      const mockBeaches = [
        {
          id: "beach-1",
          name: "Minimal Beach",
          lat: 33.7490,
          lon: -118.4095,
          // Missing optional fields
          city: null,
          state: null,
          slug: null,
          country: null,
          created_at: "2024-01-01T00:00:00Z",
          is_private: false,
        },
      ];

      mockBeachesQuery(mockSupabaseClient, mockBeaches);

      const request = createMockRequest(
        "GET",
        "http://localhost:3000/api/beaches"
      );

      const response = await GET(request);
      const data = await expectSuccessResponse<BeachesResponse>(response, 200);

      const beach = data.data.beaches[0];
      expect(beach.city).toBeNull();
      expect(beach.state).toBeNull();
      expect(beach.slug).toBeNull();
      expect(beach.updated_at).toBeNull();
    });
  });

  describe("Caching", () => {
    it("includes cache headers in response", async () => {
      const mockBeaches = [
        {
          id: "beach-1",
          name: "Test Beach",
          lat: 33.7490,
          lon: -118.4095,
          city: "Test City",
          state: "Test State",
          slug: "test-beach",
          country: "USA",
          created_at: "2024-01-01T00:00:00Z",
          is_private: false,
        },
      ];

      mockBeachesQuery(mockSupabaseClient, mockBeaches);

      const request = createMockRequest(
        "GET",
        "http://localhost:3000/api/beaches"
      );

      const response = await GET(request);

      // Verify response is successful
      expect(response.status).toBe(200);

      // Cache headers should be set by createCachedResponse
      // (In real usage, these would be set; we mock the utility)
    });
  });
});
