/**
 * @jest-environment node
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { NextRequest } from "next/server";
import { INTEL_CONFIG } from "@/lib/constants/intel";
import { DEFAULT_INTEL_DEDUPE_WINDOW_MINUTES } from "@/lib/utils/intel-dedupe";
import { expectConsoleWarnings } from "@/__tests__/setup/test-utils";

/**
 * Tests for /api/intel route
 *
 * Covers:
 * - GET: Geo-spatial queries with lat/lon coordinates
 * - GET: Radius validation (valid ranges, edge cases)
 * - GET: Returns intel posts for location with user enrichment
 * - GET: Handles legacy coordinate parameters (lng, latitude, longitude)
 * - POST: Deduplication hash calculation
 * - POST: Duplicate detection within time window
 * - POST: Expiry calculation by tag type (fast vs standard)
 * - POST: Normalization of surf_conditions JSONB
 * - POST: Requires authentication
 * - Error handling for missing coordinates, invalid radius, database errors
 */

// =============================================================================
// MOCK SETUP
// =============================================================================

const mockSupabaseClient = {
  auth: {
    getUser: jest.fn(),
  },
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  in: jest.fn().mockReturnThis(),
  gte: jest.fn().mockReturnThis(),
  order: jest.fn().mockReturnThis(),
  limit: jest.fn(),
  single: jest.fn(),
  rpc: jest.fn(),
};

const mockServiceRoleClient = {
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  gte: jest.fn().mockReturnThis(),
  order: jest.fn().mockReturnThis(),
  limit: jest.fn(),
  single: jest.fn(),
};

// Mock Supabase clients
jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: jest.fn(() => mockSupabaseClient),
  createSupabaseServiceRoleClient: jest.fn(() => mockServiceRoleClient),
}));

// Mock middleware wrappers to pass through and provide context.
// `withAuth` honours the current mockSupabaseClient.auth.getUser() result so
// GET (optional auth) can see a null user, and POST (required auth) 401s
// unless mockAuthenticatedUser() was called first.
jest.mock("@/lib/middleware/api-wrappers", () => {
  const actual = jest.requireActual("@/lib/middleware/api-wrappers");
  const { NextResponse } = require("next/server");
  return {
    ...actual,
    withAuth: (handler: any, options: any = {}) => async (request: any) => {
      try {
        const { data, error } = await mockSupabaseClient.auth.getUser();
        const user = error ? null : data?.user ?? null;
        if (!options.optional && !user) {
          return NextResponse.json(
            { error: options.authErrorMessage ?? "Authentication required" },
            { status: 401 },
          );
        }
        const context = {
          user,
          supabase: mockSupabaseClient,
        };
        return await handler(request, context);
      } catch (error: any) {
        const { handleApiError } = jest.requireActual("@/lib/api-utils");
        return handleApiError(error, options?.errorMessage || "Request failed");
      }
    },
    withBotBlockingAndRateLimit: (handler: any) => handler,
    withErrorHandler: (handler: any, options: any) => async (request: any) => {
      try {
        return await handler(request);
      } catch (error: any) {
        const { handleApiError } = jest.requireActual("@/lib/api-utils");
        return handleApiError(error, options?.errorMessage || "Request failed");
      }
    },
  };
});

// Import after mocks
let GET: any;
let POST: any;

beforeAll(async () => {
  const route = await import("@/app/api/intel/route");
  GET = route.GET;
  POST = route.POST;
});

it("uses the shared API wrapper module for response and validation helpers", () => {
  const source = readFileSync(
    join(process.cwd(), "app/api/intel/route.ts"),
    "utf8"
  );

  expect(source).not.toMatch(/from\s+["']@\/lib\/api-utils["']/);
  expect(source).toMatch(/from\s+["']@\/lib\/middleware\/api-wrappers["']/);
});

// =============================================================================
// TEST HELPERS
// =============================================================================

function createMockRequest(method: string, url: string, body?: any): NextRequest {
  return new NextRequest(new URL(url), {
    method,
    body: body ? JSON.stringify(body) : undefined,
    headers: body ? { "Content-Type": "application/json" } : undefined,
  });
}

function mockIntelPosts(posts: any[]) {
  mockSupabaseClient.rpc.mockResolvedValue({ data: posts, error: null });
}

function mockProfilesData(profiles: any[]) {
  mockSupabaseClient.limit.mockResolvedValue({ data: profiles, error: null });
}

function mockConfirmationsData(confirmations: any[]) {
  mockSupabaseClient.limit.mockResolvedValue({ data: confirmations, error: null });
}

function mockAuthenticatedUser(userId: string = "test-user-123") {
  mockSupabaseClient.auth.getUser.mockResolvedValue({
    data: { user: { id: userId } },
    error: null,
  });
}

function mockUnauthenticatedUser() {
  mockSupabaseClient.auth.getUser.mockResolvedValue({
    data: { user: null },
    error: { message: "Unauthorized" },
  });
}

// =============================================================================
// GET /api/intel TESTS
// =============================================================================

describe("GET /api/intel", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUnauthenticatedUser(); // Default to unauthenticated for GET tests
  });

  describe("Coordinate Parameter Handling", () => {
    it("should accept lat and lon query parameters", async () => {
      mockIntelPosts([]);

      const request = createMockRequest(
        "GET",
        "http://localhost/api/intel?lat=32.715&lon=-117.161"
      );
      const response = await GET(request);

      expect(response.status).toBe(200);
      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith(
        "get_nearby_intel_posts",
        expect.objectContaining({
          center_lat: 32.715,
          center_lng: -117.161,
        })
      );
    });

    it("should accept legacy lng parameter instead of lon", async () => {
      mockIntelPosts([]);

      const request = createMockRequest(
        "GET",
        "http://localhost/api/intel?lat=32.715&lng=-117.161"
      );
      const response = await GET(request);

      expect(response.status).toBe(200);
      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith(
        "get_nearby_intel_posts",
        expect.objectContaining({
          center_lat: 32.715,
          center_lng: -117.161,
        })
      );
    });

    it("should accept latitude and longitude parameters", async () => {
      mockIntelPosts([]);

      const request = createMockRequest(
        "GET",
        "http://localhost/api/intel?latitude=32.715&longitude=-117.161"
      );
      const response = await GET(request);

      expect(response.status).toBe(200);
      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith(
        "get_nearby_intel_posts",
        expect.objectContaining({
          center_lat: 32.715,
          center_lng: -117.161,
        })
      );
    });

    it("should return 400 when coordinates are missing", async () => {
      const request = createMockRequest("GET", "http://localhost/api/intel");
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json.success).toBe(false);
      expect(json.error).toContain("Latitude and longitude are required");
    });

    it("should return 400 when only latitude is provided", async () => {
      const request = createMockRequest(
        "GET",
        "http://localhost/api/intel?lat=32.715"
      );
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json.success).toBe(false);
    });
  });

  describe("Radius Validation", () => {
    it("should use default radius when not provided", async () => {
      mockIntelPosts([]);

      const request = createMockRequest(
        "GET",
        "http://localhost/api/intel?lat=32.715&lon=-117.161"
      );
      await GET(request);

      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith(
        "get_nearby_intel_posts",
        expect.objectContaining({
          radius_miles: INTEL_CONFIG.DEFAULT_RADIUS_MILES,
        })
      );
    });

    it("should accept valid radius values", async () => {
      mockIntelPosts([]);

      const request = createMockRequest(
        "GET",
        "http://localhost/api/intel?lat=32.715&lon=-117.161&radius=10"
      );
      await GET(request);

      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith(
        "get_nearby_intel_posts",
        expect.objectContaining({
          radius_miles: 10,
        })
      );
    });

    it("should reject radius exceeding MAX_RADIUS_MILES", async () => {
      const request = createMockRequest(
        "GET",
        `http://localhost/api/intel?lat=32.715&lon=-117.161&radius=${INTEL_CONFIG.MAX_RADIUS_MILES + 1}`
      );
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json.success).toBe(false);
      expect(json.error).toContain(`cannot exceed ${INTEL_CONFIG.MAX_RADIUS_MILES} miles`);
      expect(json.details.maxRadiusMiles).toBe(INTEL_CONFIG.MAX_RADIUS_MILES);
    });

    it("should accept radius at exact MAX_RADIUS_MILES boundary", async () => {
      mockIntelPosts([]);

      const request = createMockRequest(
        "GET",
        `http://localhost/api/intel?lat=32.715&lon=-117.161&radius=${INTEL_CONFIG.MAX_RADIUS_MILES}`
      );
      const response = await GET(request);

      expect(response.status).toBe(200);
    });
  });

  describe("Tag Filtering", () => {
    it("should pass null tag_filter for 'all' tag", async () => {
      mockIntelPosts([]);

      const request = createMockRequest(
        "GET",
        "http://localhost/api/intel?lat=32.715&lon=-117.161&tag=all"
      );
      await GET(request);

      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith(
        "get_nearby_intel_posts",
        expect.objectContaining({
          tag_filter: undefined,
        })
      );
    });

    it("should pass specific tag filter", async () => {
      mockIntelPosts([]);

      const request = createMockRequest(
        "GET",
        "http://localhost/api/intel?lat=32.715&lon=-117.161&tag=conditions"
      );
      await GET(request);

      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith(
        "get_nearby_intel_posts",
        expect.objectContaining({
          tag_filter: "conditions",
        })
      );
    });
  });

  describe("Limit Parameter", () => {
    it("should use default limit when not provided", async () => {
      mockIntelPosts([]);

      const request = createMockRequest(
        "GET",
        "http://localhost/api/intel?lat=32.715&lon=-117.161"
      );
      await GET(request);

      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith(
        "get_nearby_intel_posts",
        expect.objectContaining({
          limit_count: INTEL_CONFIG.DEFAULT_LIMIT,
        })
      );
    });

    it("should cap limit at MAX_LIMIT", async () => {
      mockIntelPosts([]);

      const request = createMockRequest(
        "GET",
        `http://localhost/api/intel?lat=32.715&lon=-117.161&limit=${INTEL_CONFIG.MAX_LIMIT + 50}`
      );
      await GET(request);

      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith(
        "get_nearby_intel_posts",
        expect.objectContaining({
          limit_count: INTEL_CONFIG.MAX_LIMIT,
        })
      );
    });
  });

  describe("Data Enrichment", () => {
    it("should return empty array when no posts found", async () => {
      mockIntelPosts([]);

      const request = createMockRequest(
        "GET",
        "http://localhost/api/intel?lat=32.715&lon=-117.161"
      );
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.posts).toEqual([]);
      expect(json.data.total).toBe(0);
      expect(json.data.filters).toMatchObject({
        latitude: 32.715,
        longitude: -117.161,
      });
    });

    it("should enrich posts with user profiles", async () => {
      const mockPosts = [
        {
          id: "post-1",
          user_id: "user-1",
          title: "Great conditions",
          tag: "conditions",
          latitude: 32.715,
          longitude: -117.161,
        },
      ];

      const mockProfiles = [
        {
          id: "user-1",
          full_name: "John Surfer",
          avatar_url: "https://example.com/avatar.jpg",
        },
      ];

      mockSupabaseClient.rpc.mockResolvedValue({ data: mockPosts, error: null });

      // Setup chain for profiles query
      mockSupabaseClient.from.mockReturnThis();
      mockSupabaseClient.select.mockReturnThis();
      mockSupabaseClient.in.mockResolvedValueOnce({ data: mockProfiles, error: null });

      const request = createMockRequest(
        "GET",
        "http://localhost/api/intel?lat=32.715&lon=-117.161"
      );
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.data.posts[0].user).toEqual({
        id: "user-1",
        full_name: "John Surfer",
        avatar_url: "https://example.com/avatar.jpg",
        // Surfaced so the feed can label automated posts as system cards.
        is_system_account: null,
      });
    });

    it("should include user_confirmed status for authenticated users", async () => {
      mockAuthenticatedUser("test-user-123");

      const mockPosts = [
        {
          id: "post-1",
          user_id: "user-1",
          title: "Great conditions",
        },
      ];

      mockSupabaseClient.rpc.mockResolvedValue({ data: mockPosts, error: null });

      // Setup chain for profiles query
      mockSupabaseClient.from.mockReturnThis();
      mockSupabaseClient.select.mockReturnThis();
      mockSupabaseClient.in
        .mockResolvedValueOnce({ data: [], error: null }) // profiles
        .mockResolvedValueOnce({ // confirmations
          data: [{ intel_post_id: "post-1" }],
          error: null,
        });

      const request = createMockRequest(
        "GET",
        "http://localhost/api/intel?lat=32.715&lon=-117.161"
      );
      const response = await GET(request);
      const json = await response.json();

      expect(json.data.posts[0].user_confirmed).toBe(true);
    });

    it("should handle profile lookup failures gracefully", async () => {
      const mockPosts = [
        {
          id: "post-1",
          user_id: "user-1",
          user_name: "FallbackUser",
          title: "Great conditions",
        },
      ];

      mockSupabaseClient.rpc.mockResolvedValue({ data: mockPosts, error: null });

      // Setup chain for profiles query failure
      mockSupabaseClient.from.mockReturnThis();
      mockSupabaseClient.select.mockReturnThis();
      mockSupabaseClient.in.mockResolvedValueOnce({
        data: null,
        error: { message: "RLS policy denied" },
      });

      const request = createMockRequest(
        "GET",
        "http://localhost/api/intel?lat=32.715&lon=-117.161"
      );
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.data.posts[0].user.full_name).toBe("FallbackUser");
    });
  });

  describe("Error Handling", () => {
    it("should handle RPC errors", async () => {
      mockSupabaseClient.rpc.mockResolvedValue({
        data: null,
        error: { message: "Database connection failed" },
      });

      const request = createMockRequest(
        "GET",
        "http://localhost/api/intel?lat=32.715&lon=-117.161"
      );

      const response = await GET(request);
      const json = await response.json();

      // Database connection errors are genuine server errors - 500 is correct
      expect(response.status).toBe(500);
      expect(json.success).toBe(false);
      expect(json.error).toBe("Failed to fetch intel posts");
    });

    it("should return an empty list when local PostGIS geography is unavailable", async () => {
      mockSupabaseClient.rpc.mockResolvedValue({
        data: null,
        error: {
          code: "42704",
          message: 'type "public.geography" does not exist',
        },
      });

      const request = createMockRequest(
        "GET",
        "http://localhost/api/intel?lat=32.715&lon=-117.161&limit=1"
      );

      const response = await GET(request);
      const json = await response.json();
      expectConsoleWarnings([/Intel geospatial lookup unavailable/]);

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.posts).toEqual([]);
      expect(json.data.total).toBe(0);
      expect(mockSupabaseClient.from).not.toHaveBeenCalled();
    });
  });
});

// =============================================================================
// POST /api/intel TESTS
// =============================================================================

describe("POST /api/intel", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.ALLOW_E2E_MUTATIONS_DEV;
    // POST is withAuth(required). Default to authed; individual tests can
    // override via mockUnauthenticatedUser() to assert 401 behavior.
    mockAuthenticatedUser("test-user-123");
  });

  describe("Authentication", () => {
    it("should require authentication", async () => {
      mockUnauthenticatedUser();

      const request = createMockRequest("POST", "http://localhost/api/intel", {
        latitude: 32.715,
        longitude: -117.161,
        tag: "conditions",
        title: "Test post",
        description: "Test description",
      });

      const response = await POST(request);
      const json = await response.json();

      expect(response.status).toBe(401);
      expect(json.error).toContain("Authentication required");
    });
  });

  describe("Request Validation", () => {
    it("should reject invalid JSON", async () => {
      const request = new NextRequest(new URL("http://localhost/api/intel"), {
        method: "POST",
        body: "invalid json",
        headers: { "Content-Type": "application/json" },
      });

      const response = await POST(request);
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json.success).toBe(false);
    });

    it("should reject missing required fields", async () => {
      const request = createMockRequest("POST", "http://localhost/api/intel", {
        latitude: 32.715,
        // missing longitude, tag, title, description
      });

      const response = await POST(request);
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json.success).toBe(false);
    });

    it("should reject coordinates out of valid range", async () => {
      const request = createMockRequest("POST", "http://localhost/api/intel", {
        latitude: 95, // Invalid: > 90
        longitude: -117.161,
        tag: "conditions",
        title: "Test post",
        description: "Test description",
      });

      const response = await POST(request);
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json.success).toBe(false);
    });

    it("should reject invalid tag values", async () => {
      const request = createMockRequest("POST", "http://localhost/api/intel", {
        latitude: 32.715,
        longitude: -117.161,
        tag: "invalid-tag",
        title: "Test post",
        description: "Test description",
      });

      const response = await POST(request);
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json.success).toBe(false);
    });
  });

  describe("Expiry Calculation", () => {
    it("should set 1-day expiry for fast-expiry tags (conditions)", async () => {
      mockSupabaseClient.from.mockReturnThis();
      mockSupabaseClient.select.mockReturnThis();
      mockSupabaseClient.eq.mockReturnThis();
      mockSupabaseClient.gte.mockReturnThis();
      mockSupabaseClient.order.mockReturnThis();
      mockSupabaseClient.limit.mockResolvedValue({ data: [], error: null });
      mockSupabaseClient.insert.mockReturnThis();
      mockSupabaseClient.single.mockResolvedValue({
        data: { id: "post-1", expires_at: new Date(Date.now() + 86400000).toISOString() },
        error: null,
      });

      const request = createMockRequest("POST", "http://localhost/api/intel", {
        latitude: 32.715,
        longitude: -117.161,
        tag: "conditions",
        title: "Current conditions",
        description: "Clean 3-4ft waves",
      });

      await POST(request);

      const insertCall = mockSupabaseClient.insert.mock.calls[0][0];
      const expiresAt = new Date(insertCall.expires_at);
      const now = new Date();
      const hoursDiff = (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60);

      expect(hoursDiff).toBeGreaterThan(23);
      expect(hoursDiff).toBeLessThan(25);
    });

    it("should set 1-day expiry for fast-expiry tags (crowd)", async () => {
      mockSupabaseClient.from.mockReturnThis();
      mockSupabaseClient.select.mockReturnThis();
      mockSupabaseClient.eq.mockReturnThis();
      mockSupabaseClient.gte.mockReturnThis();
      mockSupabaseClient.order.mockReturnThis();
      mockSupabaseClient.limit.mockResolvedValue({ data: [], error: null });
      mockSupabaseClient.insert.mockReturnThis();
      mockSupabaseClient.single.mockResolvedValue({
        data: { id: "post-1", expires_at: new Date(Date.now() + 86400000).toISOString() },
        error: null,
      });

      const request = createMockRequest("POST", "http://localhost/api/intel", {
        latitude: 32.715,
        longitude: -117.161,
        tag: "crowd",
        title: "Packed lineup",
        description: "Very crowded right now",
      });

      await POST(request);

      const insertCall = mockSupabaseClient.insert.mock.calls[0][0];
      const expiresAt = new Date(insertCall.expires_at);
      const now = new Date();
      const hoursDiff = (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60);

      expect(hoursDiff).toBeGreaterThan(23);
      expect(hoursDiff).toBeLessThan(25);
    });

    it("should set 7-day expiry for standard tags", async () => {
      mockSupabaseClient.from.mockReturnThis();
      mockSupabaseClient.select.mockReturnThis();
      mockSupabaseClient.eq.mockReturnThis();
      mockSupabaseClient.gte.mockReturnThis();
      mockSupabaseClient.order.mockReturnThis();
      mockSupabaseClient.limit.mockResolvedValue({ data: [], error: null });
      mockSupabaseClient.insert.mockReturnThis();
      mockSupabaseClient.single.mockResolvedValue({
        data: { id: "post-1", expires_at: new Date(Date.now() + 7 * 86400000).toISOString() },
        error: null,
      });

      const request = createMockRequest("POST", "http://localhost/api/intel", {
        latitude: 32.715,
        longitude: -117.161,
        tag: "parking",
        title: "New parking lot",
        description: "Free parking opened nearby",
      });

      await POST(request);

      const insertCall = mockSupabaseClient.insert.mock.calls[0][0];
      const expiresAt = new Date(insertCall.expires_at);
      const now = new Date();
      const daysDiff = (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);

      expect(daysDiff).toBeGreaterThan(6.9);
      expect(daysDiff).toBeLessThan(7.1);
    });
  });

  describe("Surf Conditions Normalization", () => {
    it("should normalize surf condition fields into JSONB", async () => {
      mockSupabaseClient.from.mockReturnThis();
      mockSupabaseClient.select.mockReturnThis();
      mockSupabaseClient.eq.mockReturnThis();
      mockSupabaseClient.gte.mockReturnThis();
      mockSupabaseClient.order.mockReturnThis();
      mockSupabaseClient.limit.mockResolvedValue({ data: [], error: null });
      mockSupabaseClient.insert.mockReturnThis();
      mockSupabaseClient.single.mockResolvedValue({
        data: { id: "post-1" },
        error: null,
      });

      const request = createMockRequest("POST", "http://localhost/api/intel", {
        latitude: 32.715,
        longitude: -117.161,
        tag: "conditions",
        title: "Current report",
        description: "Clean sets",
        wave_height: 4.5,
        wind_speed: 8,
        wind_direction: "offshore",
        water_temp: 68,
        crowd_level: 3,
        wave_types: ["point", "reef"],
        forecast_accuracy: "accurate",
      });

      await POST(request);

      const insertCall = mockSupabaseClient.insert.mock.calls[0][0];
      expect(insertCall.surf_conditions).toEqual({
        wave_height: 4.5,
        wind_speed: 8,
        wind_direction: "offshore",
        water_temp: 68,
        crowd_level: 3,
        wave_types: ["point", "reef"],
        forecast_accuracy: "accurate",
      });
    });

    it("should set surf_conditions to null when no fields provided", async () => {
      mockSupabaseClient.from.mockReturnThis();
      mockSupabaseClient.select.mockReturnThis();
      mockSupabaseClient.eq.mockReturnThis();
      mockSupabaseClient.gte.mockReturnThis();
      mockSupabaseClient.order.mockReturnThis();
      mockSupabaseClient.limit.mockResolvedValue({ data: [], error: null });
      mockSupabaseClient.insert.mockReturnThis();
      mockSupabaseClient.single.mockResolvedValue({
        data: { id: "post-1" },
        error: null,
      });

      const request = createMockRequest("POST", "http://localhost/api/intel", {
        latitude: 32.715,
        longitude: -117.161,
        tag: "parking",
        title: "Parking update",
        description: "Lots of space",
      });

      await POST(request);

      const insertCall = mockSupabaseClient.insert.mock.calls[0][0];
      expect(insertCall.surf_conditions).toBeNull();
    });

    it("should include only provided surf condition fields", async () => {
      let capturedInsertData: any = null;

      mockSupabaseClient.from.mockImplementation(() => {
        return {
          ...mockSupabaseClient,
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          gte: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          limit: jest.fn().mockResolvedValue({ data: [], error: null }),
          insert: jest.fn((data: any) => {
            capturedInsertData = data;
            return {
              ...mockSupabaseClient,
              select: jest.fn().mockReturnThis(),
              single: jest.fn()
                .mockResolvedValueOnce({
                  data: {
                    id: "post-1",
                    surf_conditions: { wave_height: 3 },
                  },
                  error: null,
                })
                .mockResolvedValueOnce({
                  data: {
                    id: "test-user-123",
                    full_name: "Test User",
                    avatar_url: null,
                  },
                  error: null,
                }),
            };
          }),
        };
      });

      const request = createMockRequest("POST", "http://localhost/api/intel", {
        latitude: 32.715,
        longitude: -117.161,
        tag: "conditions",
        title: "Partial data",
        description: "Some conditions",
        wave_height: 3,
        // Omit other optional surf condition fields
      });

      const response = await POST(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(capturedInsertData).toEqual(
        expect.objectContaining({
          surf_conditions: { wave_height: 3 },
        })
      );
      expect(capturedInsertData.surf_conditions).toEqual({
        wave_height: 3,
      });
      // Verify wind_speed, water_temp, etc. are not in the object
      expect(capturedInsertData.surf_conditions.wind_speed).toBeUndefined();
      expect(capturedInsertData.surf_conditions.water_temp).toBeUndefined();
    });
  });

  describe("Deduplication", () => {
    it("should calculate dedupe hash", async () => {
      mockSupabaseClient.from.mockReturnThis();
      mockSupabaseClient.select.mockReturnThis();
      mockSupabaseClient.eq.mockReturnThis();
      mockSupabaseClient.gte.mockReturnThis();
      mockSupabaseClient.order.mockReturnThis();
      mockSupabaseClient.limit.mockResolvedValue({ data: [], error: null });
      mockSupabaseClient.insert.mockReturnThis();
      mockSupabaseClient.single.mockResolvedValue({
        data: { id: "post-1" },
        error: null,
      });

      const request = createMockRequest("POST", "http://localhost/api/intel", {
        latitude: 32.715,
        longitude: -117.161,
        tag: "conditions",
        title: "Test post",
        description: "Test description",
      });

      await POST(request);

      const insertCall = mockSupabaseClient.insert.mock.calls[0][0];
      expect(insertCall).toEqual(
        expect.objectContaining({
          dedupe_hash: expect.stringMatching(/^[a-f0-9]{64}$/),
        })
      );
    });

    it("should detect duplicates within dedupe window", async () => {
      const existingPost = {
        id: "existing-post",
        title: "Dawn patrol",
        description: "Clean 3-4ft waves",
        latitude: 32.715,
        longitude: -117.161,
        beach_id: null,
        created_at: new Date().toISOString(),
      };

      mockSupabaseClient.from.mockReturnThis();
      mockSupabaseClient.select.mockReturnThis();
      mockSupabaseClient.eq.mockReturnThis();
      mockSupabaseClient.gte.mockReturnThis();
      mockSupabaseClient.order.mockReturnThis();
      mockSupabaseClient.limit.mockResolvedValue({
        data: [existingPost],
        error: null,
      });

      const request = createMockRequest("POST", "http://localhost/api/intel", {
        latitude: 32.715,
        longitude: -117.161,
        tag: "conditions",
        title: "Dawn patrol",
        description: "Clean 3-4ft waves",
      });

      const response = await POST(request);
      const json = await response.json();

      expect(response.status).toBe(409);
      expect(json.success).toBe(false);
      expect(json.error).toContain("already shared");
      expect(json.details.dedupe_window_minutes).toBe(DEFAULT_INTEL_DEDUPE_WINDOW_MINUTES);
      expect(mockSupabaseClient.insert).not.toHaveBeenCalled();
    });

    it("should allow posts with different content", async () => {
      const existingPost = {
        id: "existing-post",
        title: "Morning session",
        description: "Choppy 1-2ft",
        latitude: 32.715,
        longitude: -117.161,
        beach_id: null,
        created_at: new Date().toISOString(),
      };

      mockSupabaseClient.from.mockReturnThis();
      mockSupabaseClient.select.mockReturnThis();
      mockSupabaseClient.eq.mockReturnThis();
      mockSupabaseClient.gte.mockReturnThis();
      mockSupabaseClient.order.mockReturnThis();
      mockSupabaseClient.limit.mockResolvedValue({
        data: [existingPost],
        error: null,
      });
      mockSupabaseClient.insert.mockReturnThis();
      mockSupabaseClient.single.mockResolvedValue({
        data: { id: "post-1" },
        error: null,
      });

      const request = createMockRequest("POST", "http://localhost/api/intel", {
        latitude: 32.715,
        longitude: -117.161,
        tag: "conditions",
        title: "Afternoon report",
        description: "Clean 3-4ft overhead sets",
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(mockSupabaseClient.insert).toHaveBeenCalled();
    });

    it("should query dedupe window with correct time range", async () => {
      mockSupabaseClient.from.mockReturnThis();
      mockSupabaseClient.select.mockReturnThis();
      mockSupabaseClient.eq.mockReturnThis();
      mockSupabaseClient.gte.mockReturnThis();
      mockSupabaseClient.order.mockReturnThis();
      mockSupabaseClient.limit.mockResolvedValue({ data: [], error: null });
      mockSupabaseClient.insert.mockReturnThis();
      mockSupabaseClient.single.mockResolvedValue({
        data: { id: "post-1" },
        error: null,
      });

      const beforeTime = new Date(Date.now() - DEFAULT_INTEL_DEDUPE_WINDOW_MINUTES * 60 * 1000);

      const request = createMockRequest("POST", "http://localhost/api/intel", {
        latitude: 32.715,
        longitude: -117.161,
        tag: "conditions",
        title: "Test",
        description: "Test description",
      });

      await POST(request);

      const gteCall = mockSupabaseClient.gte.mock.calls[0];
      expect(gteCall[0]).toBe("created_at");

      const queriedTime = new Date(gteCall[1]);
      const timeDiff = Math.abs(queriedTime.getTime() - beforeTime.getTime());
      expect(timeDiff).toBeLessThan(1000); // Within 1 second
    });
  });

  describe("Post Creation", () => {
    it("should create intel post with valid data", async () => {
      mockSupabaseClient.from.mockReturnThis();
      mockSupabaseClient.select.mockReturnThis();
      mockSupabaseClient.eq.mockReturnThis();
      mockSupabaseClient.gte.mockReturnThis();
      mockSupabaseClient.order.mockReturnThis();
      mockSupabaseClient.limit.mockResolvedValue({ data: [], error: null });
      mockSupabaseClient.insert.mockReturnThis();
      mockSupabaseClient.single
        .mockResolvedValueOnce({
          data: {
            id: "post-1",
            user_id: "test-user-123",
            latitude: 32.715,
            longitude: -117.161,
            tag: "conditions",
            title: "Great waves",
            description: "Perfect conditions",
          },
          error: null,
        })
        .mockResolvedValueOnce({
          data: {
            id: "test-user-123",
            full_name: "Test User",
            avatar_url: null,
          },
          error: null,
        });

      const request = createMockRequest("POST", "http://localhost/api/intel", {
        latitude: 32.715,
        longitude: -117.161,
        tag: "conditions",
        title: "Great waves",
        description: "Perfect conditions",
      });

      const response = await POST(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.id).toBe("post-1");
      expect(json.data.user.full_name).toBe("Test User");
      expect(json.data.user_has_confirmed).toBe(false);
    });

    it("should trim whitespace from title and description", async () => {
      mockSupabaseClient.from.mockReturnThis();
      mockSupabaseClient.select.mockReturnThis();
      mockSupabaseClient.eq.mockReturnThis();
      mockSupabaseClient.gte.mockReturnThis();
      mockSupabaseClient.order.mockReturnThis();
      mockSupabaseClient.limit.mockResolvedValue({ data: [], error: null });
      mockSupabaseClient.insert.mockReturnThis();
      mockSupabaseClient.single.mockResolvedValue({
        data: { id: "post-1" },
        error: null,
      });

      const request = createMockRequest("POST", "http://localhost/api/intel", {
        latitude: 32.715,
        longitude: -117.161,
        tag: "conditions",
        title: "  Trimmed title  ",
        description: "  Trimmed description  ",
      });

      await POST(request);

      const insertCall = mockSupabaseClient.insert.mock.calls[0][0];
      expect(insertCall.title).toBe("Trimmed title");
      expect(insertCall.description).toBe("Trimmed description");
    });

    it("should handle database insertion errors", async () => {
      mockSupabaseClient.from.mockReturnThis();
      mockSupabaseClient.select.mockReturnThis();
      mockSupabaseClient.eq.mockReturnThis();
      mockSupabaseClient.gte.mockReturnThis();
      mockSupabaseClient.order.mockReturnThis();
      mockSupabaseClient.limit.mockResolvedValue({ data: [], error: null });
      mockSupabaseClient.insert.mockReturnThis();
      mockSupabaseClient.single.mockResolvedValue({
        data: null,
        error: { message: "Database error" },
      });

      const request = createMockRequest("POST", "http://localhost/api/intel", {
        latitude: 32.715,
        longitude: -117.161,
        tag: "conditions",
        title: "Test",
        description: "Test description",
      });

      const response = await POST(request);
      const json = await response.json();

      // Database errors are genuine server errors - 500 is correct
      expect(response.status).toBe(500);
      expect(json.success).toBe(false);
      expect(json.error).toBe("Failed to create intel post");
    });
  });

  describe("Optional Fields", () => {
    it("should accept and store photo_url", async () => {
      mockSupabaseClient.from.mockReturnThis();
      mockSupabaseClient.select.mockReturnThis();
      mockSupabaseClient.eq.mockReturnThis();
      mockSupabaseClient.gte.mockReturnThis();
      mockSupabaseClient.order.mockReturnThis();
      mockSupabaseClient.limit.mockResolvedValue({ data: [], error: null });
      mockSupabaseClient.insert.mockReturnThis();
      mockSupabaseClient.single.mockResolvedValue({
        data: { id: "post-1" },
        error: null,
      });

      const request = createMockRequest("POST", "http://localhost/api/intel", {
        latitude: 32.715,
        longitude: -117.161,
        tag: "conditions",
        title: "Test",
        description: "Test description",
        photo_url: "https://example.com/photo.jpg",
      });

      await POST(request);

      const insertCall = mockSupabaseClient.insert.mock.calls[0][0];
      expect(insertCall.photo_url).toBe("https://example.com/photo.jpg");
    });

    it("should accept and store emoji_rating", async () => {
      mockSupabaseClient.from.mockReturnThis();
      mockSupabaseClient.select.mockReturnThis();
      mockSupabaseClient.eq.mockReturnThis();
      mockSupabaseClient.gte.mockReturnThis();
      mockSupabaseClient.order.mockReturnThis();
      mockSupabaseClient.limit.mockResolvedValue({ data: [], error: null });
      mockSupabaseClient.insert.mockReturnThis();
      mockSupabaseClient.single.mockResolvedValue({
        data: { id: "post-1" },
        error: null,
      });

      const request = createMockRequest("POST", "http://localhost/api/intel", {
        latitude: 32.715,
        longitude: -117.161,
        tag: "conditions",
        title: "Test",
        description: "Test description",
        emoji_rating: "fire",
      });

      await POST(request);

      const insertCall = mockSupabaseClient.insert.mock.calls[0][0];
      expect(insertCall.emoji_rating).toBe("fire");
    });
  });
});
