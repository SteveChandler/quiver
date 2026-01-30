/**
 * @jest-environment node
 */

import {
  createMockSupabaseClient,
  createMockRequest,
  expectSuccessResponse,
  expectErrorResponse,
  setupApiTestEnvironment,
  createMockBeach,
} from "@/test-utils/api-test-helpers";

// Type for beach search response data
interface BeachSearchResponse {
  data: Array<{
    id: string;
    name: string;
    city?: string;
    state?: string;
    [key: string]: unknown;
  }>;
  meta?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

// Mock the search utility function
const mockSearchBeachesMultiple = jest.fn();

jest.mock("@/lib/utils/beach-search-utils", () => ({
  searchBeachesMultiple: (...args: unknown[]) => mockSearchBeachesMultiple(...args),
}));

// Mock the middleware wrapper to pass through
jest.mock("@/lib/middleware/api-wrappers", () => ({
  withBotBlockingAndRateLimit: (handler: unknown) => handler,
}));

// Mock Supabase (not directly used by route but may be by search utility)
const mockSupabaseClient = createMockSupabaseClient();

jest.mock("@/lib/supabase/api-server-client", () => ({
  createAPIServerClient: jest.fn(() => mockSupabaseClient),
}));

describe("GET /api/beaches/search", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let GET: any;
  let cleanup: () => void;

  beforeEach(async () => {
    const testEnv = setupApiTestEnvironment();
    cleanup = testEnv.cleanup;
    jest.clearAllMocks();

    // Reset mock implementation
    mockSearchBeachesMultiple.mockReset();

    // Import fresh route handler
    const route = await import("@/app/api/beaches/search/route");
    GET = route.GET;
  });

  afterEach(() => {
    cleanup?.();
  });

  describe("Basic Search Functionality", () => {
    it("finds beaches by name", async () => {
      const mockBeaches = [
        createMockBeach({
          id: "beach-1",
          name: "Malibu Beach",
          city: "Malibu",
          state: "California",
        }),
        createMockBeach({
          id: "beach-2",
          name: "Malibu Pier",
          city: "Malibu",
          state: "California",
        }),
      ];

      mockSearchBeachesMultiple.mockResolvedValue(mockBeaches);

      const request = createMockRequest(
        "GET",
        "http://localhost:3000/api/beaches/search",
        {
          searchParams: { query: "Malibu" },
        }
      );

      const response = await GET(request);
      const result = await expectSuccessResponse<BeachSearchResponse["data"]>(response, 200);

      expect(mockSearchBeachesMultiple).toHaveBeenCalledWith("Malibu");
      expect(result.data).toHaveLength(2);
      expect(result.data[0]).toMatchObject({ name: "Malibu Beach" });
      expect(result.data[1]).toMatchObject({ name: "Malibu Pier" });
    });

    it("finds beaches by city", async () => {
      const mockBeaches = [
        createMockBeach({
          id: "beach-1",
          name: "Venice Beach",
          city: "Los Angeles",
          state: "California",
        }),
        createMockBeach({
          id: "beach-2",
          name: "Santa Monica Beach",
          city: "Los Angeles",
          state: "California",
        }),
      ];

      mockSearchBeachesMultiple.mockResolvedValue(mockBeaches);

      const request = createMockRequest(
        "GET",
        "http://localhost:3000/api/beaches/search",
        {
          searchParams: { query: "Los Angeles" },
        }
      );

      const response = await GET(request);
      const result = await expectSuccessResponse<BeachSearchResponse["data"]>(response, 200);

      expect(mockSearchBeachesMultiple).toHaveBeenCalledWith("Los Angeles");
      expect(result.data).toHaveLength(2);
    });

    it("returns empty array for no matches", async () => {
      mockSearchBeachesMultiple.mockResolvedValue([]);

      const request = createMockRequest(
        "GET",
        "http://localhost:3000/api/beaches/search",
        {
          searchParams: { query: "NonexistentBeach12345" },
        }
      );

      const response = await GET(request);
      const result = await expectSuccessResponse<BeachSearchResponse["data"]>(response, 200);

      expect(mockSearchBeachesMultiple).toHaveBeenCalledWith("NonexistentBeach12345");
      expect(result.data).toHaveLength(0);
      expect(result.data).toEqual([]);
    });

    it("returns empty results for empty query", async () => {
      const request = createMockRequest(
        "GET",
        "http://localhost:3000/api/beaches/search",
        {
          searchParams: { query: "" },
        }
      );

      const response = await GET(request);
      const result = await expectSuccessResponse<BeachSearchResponse["data"]>(response, 200);

      // Empty query should return empty results without calling search
      expect(mockSearchBeachesMultiple).not.toHaveBeenCalled();
      expect(result.data).toHaveLength(0);
    });

    it("trims whitespace from query", async () => {
      mockSearchBeachesMultiple.mockResolvedValue([]);

      const request = createMockRequest(
        "GET",
        "http://localhost:3000/api/beaches/search",
        {
          searchParams: { query: "  Malibu  " },
        }
      );

      const response = await GET(request);
      await expectSuccessResponse(response, 200);

      // Should call with trimmed query
      expect(mockSearchBeachesMultiple).toHaveBeenCalledWith("Malibu");
    });
  });

  describe("Security - Special Characters and SQL Injection Prevention", () => {
    it("handles special characters safely", async () => {
      mockSearchBeachesMultiple.mockResolvedValue([]);

      const specialChars = "Beach's & \"Test\" <script>";
      const request = createMockRequest(
        "GET",
        "http://localhost:3000/api/beaches/search",
        {
          searchParams: { query: specialChars },
        }
      );

      const response = await GET(request);

      // Should not crash - returns success
      expect(response.status).toBeLessThan(500);

      // Should pass the query to search function (search function handles sanitization)
      expect(mockSearchBeachesMultiple).toHaveBeenCalledWith(specialChars);
    });

    it("prevents SQL injection - drop table attempt", async () => {
      mockSearchBeachesMultiple.mockResolvedValue([]);

      const maliciousQuery = "'; DROP TABLE beaches; --";
      const request = createMockRequest(
        "GET",
        "http://localhost:3000/api/beaches/search",
        {
          searchParams: { query: maliciousQuery },
        }
      );

      const response = await GET(request);

      // Should not crash (Supabase client handles sanitization)
      expect(response.status).toBeLessThan(500);

      // Query should be passed through; the search function/Supabase handles security
      expect(mockSearchBeachesMultiple).toHaveBeenCalledWith(maliciousQuery);
    });

    it("prevents SQL injection - union select attempt", async () => {
      mockSearchBeachesMultiple.mockResolvedValue([]);

      const maliciousQuery = "beach UNION SELECT * FROM users --";
      const request = createMockRequest(
        "GET",
        "http://localhost:3000/api/beaches/search",
        {
          searchParams: { query: maliciousQuery },
        }
      );

      const response = await GET(request);

      // Should not crash
      expect(response.status).toBeLessThan(500);
    });

    it("prevents SQL injection - comment injection attempt", async () => {
      mockSearchBeachesMultiple.mockResolvedValue([]);

      const maliciousQuery = "beach/* comment */";
      const request = createMockRequest(
        "GET",
        "http://localhost:3000/api/beaches/search",
        {
          searchParams: { query: maliciousQuery },
        }
      );

      const response = await GET(request);

      // Should not crash
      expect(response.status).toBeLessThan(500);
    });

    it("handles unicode characters safely", async () => {
      mockSearchBeachesMultiple.mockResolvedValue([]);

      const unicodeQuery = "Playa del Sol \u0000\uFFFF";
      const request = createMockRequest(
        "GET",
        "http://localhost:3000/api/beaches/search",
        {
          searchParams: { query: unicodeQuery },
        }
      );

      const response = await GET(request);

      // Should not crash
      expect(response.status).toBeLessThan(500);
    });

    it("handles extremely long query strings", async () => {
      mockSearchBeachesMultiple.mockResolvedValue([]);

      const longQuery = "a".repeat(10000);
      const request = createMockRequest(
        "GET",
        "http://localhost:3000/api/beaches/search",
        {
          searchParams: { query: longQuery },
        }
      );

      const response = await GET(request);

      // Should not crash - may return empty or handle gracefully
      expect(response.status).toBeLessThan(500);
    });
  });

  describe("Relevance Ranking", () => {
    it("ranks results by relevance", async () => {
      // Mock the search function to return results in relevance order
      // (the actual relevance scoring is done by searchBeachesMultiple)
      const mockBeaches = [
        createMockBeach({
          id: "beach-exact",
          name: "Malibu", // Exact match should be first
          city: "Malibu",
        }),
        createMockBeach({
          id: "beach-starts-with",
          name: "Malibu Beach", // Starts with search term
          city: "Malibu",
        }),
        createMockBeach({
          id: "beach-contains",
          name: "Point Malibu", // Contains search term
          city: "Los Angeles",
        }),
      ];

      mockSearchBeachesMultiple.mockResolvedValue(mockBeaches);

      const request = createMockRequest(
        "GET",
        "http://localhost:3000/api/beaches/search",
        {
          searchParams: { query: "Malibu" },
        }
      );

      const response = await GET(request);
      const result = await expectSuccessResponse<BeachSearchResponse["data"]>(response, 200);

      // Results should be returned in the order from searchBeachesMultiple
      // (which handles relevance scoring internally)
      expect(result.data).toHaveLength(3);
      expect(result.data[0].name).toBe("Malibu"); // Exact match first
      expect(result.data[1].name).toBe("Malibu Beach"); // Starts with
      expect(result.data[2].name).toBe("Point Malibu"); // Contains
    });
  });

  describe("Pagination", () => {
    it("supports pagination with page and limit parameters", async () => {
      const allBeaches = Array.from({ length: 25 }, (_, i) =>
        createMockBeach({
          id: `beach-${i}`,
          name: `Beach ${i}`,
        })
      );

      mockSearchBeachesMultiple.mockResolvedValue(allBeaches);

      const request = createMockRequest(
        "GET",
        "http://localhost:3000/api/beaches/search",
        {
          searchParams: { query: "Beach", page: "1", limit: "10" },
        }
      );

      const response = await GET(request);
      const result = await response.json();

      // Should return first 10 results
      expect(result.data).toHaveLength(10);
      expect(result.data[0].name).toBe("Beach 0");
      expect(result.data[9].name).toBe("Beach 9");

      // Should include pagination metadata
      expect(result).toHaveProperty("meta");
      if (result.meta) {
        expect(result.meta.page).toBe(1);
        expect(result.meta.limit).toBe(10);
        expect(result.meta.total).toBe(25);
        expect(result.meta.totalPages).toBe(3);
        expect(result.meta.hasNextPage).toBe(true);
        expect(result.meta.hasPreviousPage).toBe(false);
      }
    });

    it("returns correct results for page 2", async () => {
      const allBeaches = Array.from({ length: 25 }, (_, i) =>
        createMockBeach({
          id: `beach-${i}`,
          name: `Beach ${i}`,
        })
      );

      mockSearchBeachesMultiple.mockResolvedValue(allBeaches);

      const request = createMockRequest(
        "GET",
        "http://localhost:3000/api/beaches/search",
        {
          searchParams: { query: "Beach", page: "2", limit: "10" },
        }
      );

      const response = await GET(request);
      const result = await expectSuccessResponse<BeachSearchResponse["data"]>(response, 200);

      // Should return results 10-19
      expect(result.data).toHaveLength(10);
      expect(result.data[0].name).toBe("Beach 10");
      expect(result.data[9].name).toBe("Beach 19");
    });

    it("uses default pagination values when not provided", async () => {
      const mockBeaches = Array.from({ length: 30 }, (_, i) =>
        createMockBeach({
          id: `beach-${i}`,
          name: `Beach ${i}`,
        })
      );

      mockSearchBeachesMultiple.mockResolvedValue(mockBeaches);

      const request = createMockRequest(
        "GET",
        "http://localhost:3000/api/beaches/search",
        {
          searchParams: { query: "Beach" },
        }
      );

      const response = await GET(request);
      const result = await expectSuccessResponse<BeachSearchResponse["data"]>(response, 200);

      // Default limit is 20 based on route implementation
      expect(result.data).toHaveLength(20);
    });

    it("enforces maximum limit of 50", async () => {
      const mockBeaches = Array.from({ length: 100 }, (_, i) =>
        createMockBeach({
          id: `beach-${i}`,
          name: `Beach ${i}`,
        })
      );

      mockSearchBeachesMultiple.mockResolvedValue(mockBeaches);

      const request = createMockRequest(
        "GET",
        "http://localhost:3000/api/beaches/search",
        {
          searchParams: { query: "Beach", limit: "100" }, // Request 100, should be capped at 50
        }
      );

      const response = await GET(request);
      const result = await expectSuccessResponse<BeachSearchResponse["data"]>(response, 200);

      // Should be capped at 50 (max limit)
      expect(result.data.length).toBeLessThanOrEqual(50);
    });
  });

  describe("Error Handling", () => {
    it("handles search function errors gracefully", async () => {
      mockSearchBeachesMultiple.mockRejectedValue(new Error("Database connection failed"));

      const request = createMockRequest(
        "GET",
        "http://localhost:3000/api/beaches/search",
        {
          searchParams: { query: "Malibu" },
        }
      );

      const response = await GET(request);
      await expectErrorResponse(response, 500, "Failed to search beaches");
    });

    it("returns proper error structure on failure", async () => {
      mockSearchBeachesMultiple.mockRejectedValue(new Error("Search failed"));

      const request = createMockRequest(
        "GET",
        "http://localhost:3000/api/beaches/search",
        {
          searchParams: { query: "test" },
        }
      );

      const response = await GET(request);
      const errorData = await response.json();

      expect(errorData).toHaveProperty("success", false);
      expect(errorData).toHaveProperty("error");
      expect(errorData).toHaveProperty("timestamp");
    });
  });

  describe("Response Structure", () => {
    it("returns standardized response with timestamp", async () => {
      mockSearchBeachesMultiple.mockResolvedValue([
        createMockBeach({ id: "beach-1", name: "Test Beach" }),
      ]);

      const request = createMockRequest(
        "GET",
        "http://localhost:3000/api/beaches/search",
        {
          searchParams: { query: "Test" },
        }
      );

      const response = await GET(request);
      const result = await response.json();

      expect(result).toHaveProperty("success", true);
      expect(result).toHaveProperty("data");
      expect(result).toHaveProperty("timestamp");
      expect(typeof result.timestamp).toBe("string");
      // Verify timestamp is valid ISO date
      expect(new Date(result.timestamp).toISOString()).toBe(result.timestamp);
    });

    it("includes cache headers in response", async () => {
      mockSearchBeachesMultiple.mockResolvedValue([
        createMockBeach({ id: "beach-1", name: "Test Beach" }),
      ]);

      const request = createMockRequest(
        "GET",
        "http://localhost:3000/api/beaches/search",
        {
          searchParams: { query: "Test" },
        }
      );

      const response = await GET(request);

      // Should have cache control header
      expect(response.headers.has("cache-control")).toBe(true);
    });
  });

  describe("Edge Cases", () => {
    it("handles query with only whitespace", async () => {
      const request = createMockRequest(
        "GET",
        "http://localhost:3000/api/beaches/search",
        {
          searchParams: { query: "   " },
        }
      );

      const response = await GET(request);
      const result = await expectSuccessResponse<BeachSearchResponse["data"]>(response, 200);

      // Whitespace-only query should be treated as empty
      expect(mockSearchBeachesMultiple).not.toHaveBeenCalled();
      expect(result.data).toHaveLength(0);
    });

    it("handles missing query parameter", async () => {
      const request = createMockRequest(
        "GET",
        "http://localhost:3000/api/beaches/search",
        {
          searchParams: {},
        }
      );

      const response = await GET(request);
      const result = await expectSuccessResponse<BeachSearchResponse["data"]>(response, 200);

      // Missing query should return empty results
      expect(mockSearchBeachesMultiple).not.toHaveBeenCalled();
      expect(result.data).toHaveLength(0);
    });

    it("handles single character query", async () => {
      mockSearchBeachesMultiple.mockResolvedValue([
        createMockBeach({ id: "beach-1", name: "A Beach" }),
      ]);

      const request = createMockRequest(
        "GET",
        "http://localhost:3000/api/beaches/search",
        {
          searchParams: { query: "A" },
        }
      );

      const response = await GET(request);
      const result = await expectSuccessResponse<BeachSearchResponse["data"]>(response, 200);

      // Single char queries should work (search utility handles filtering)
      expect(mockSearchBeachesMultiple).toHaveBeenCalledWith("A");
    });

    it("handles numeric query", async () => {
      mockSearchBeachesMultiple.mockResolvedValue([
        createMockBeach({ id: "beach-1", name: "Beach 1" }),
      ]);

      const request = createMockRequest(
        "GET",
        "http://localhost:3000/api/beaches/search",
        {
          searchParams: { query: "123" },
        }
      );

      const response = await GET(request);
      await expectSuccessResponse(response, 200);

      expect(mockSearchBeachesMultiple).toHaveBeenCalledWith("123");
    });
  });

  describe("Performance", () => {
    it("handles concurrent search requests", async () => {
      mockSearchBeachesMultiple.mockResolvedValue([
        createMockBeach({ id: "beach-1", name: "Test Beach" }),
      ]);

      const requests = Array.from({ length: 5 }, () =>
        createMockRequest("GET", "http://localhost:3000/api/beaches/search", {
          searchParams: { query: "test" },
        })
      );

      const responses = await Promise.all(requests.map((req) => GET(req)));

      // All requests should succeed
      responses.forEach((response) => {
        expect(response.status).toBe(200);
      });
    });
  });
});
