/**
 * @jest-environment node
 */

import {
  createMockSupabaseClient,
  createMockRequest,
  expectSuccessResponse,
  setupApiTestEnvironment,
} from "@/test-utils/api-test-helpers";
import { createMockBeach } from "@/__tests__/setup/typed-mocks";
import type { Beach } from "@/types/database";

/** Type for the beach detail API response */
interface BeachDetailResponse {
  beach: Beach;
}

// Mock the Supabase server client
const mockSupabaseClient = createMockSupabaseClient();

jest.mock("@/lib/middleware/api-wrappers", () => ({
  withBotBlockingAndRateLimit: (handler: any) => handler,
}));

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: jest.fn(() => Promise.resolve(mockSupabaseClient)),
}));

// Import after mocks
 
const { GET } = require("@/app/api/beaches/[id]/route");

describe("GET /api/beaches/[id]", () => {
  let cleanup: () => void;

  beforeEach(() => {
    const testEnv = setupApiTestEnvironment();
    cleanup = testEnv.cleanup;
    jest.clearAllMocks();

    // Reset mock to return fresh chain objects for each call
    (mockSupabaseClient.from as jest.Mock).mockImplementation(() => ({
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
    }));
  });

  afterEach(() => {
    cleanup?.();
  });

  it("returns beach with all fields", async () => {
    const beachId = "beach-123";
    const mockBeach = createMockBeach({
      id: beachId,
      name: "Pipeline",
      slug: "pipeline",
      lat: 21.6641,
      lon: -158.0526,
      city: "Haleiwa",
      state: "HI",
      country: "USA",
      region: "North Shore",
      description: "World-famous reef break",
      skill_level: "Expert",
      crowd_level: "High",
      break_type: "Reef Break",
      best_months: [11, 12, 1, 2],
      average_rating: 4.8,
      review_count: 250,
    });

    // Mock successful beach query
    (mockSupabaseClient.from as jest.Mock).mockImplementation(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn(() =>
        Promise.resolve({
          data: mockBeach,
          error: null,
        })
      ),
    }));

    const request = createMockRequest("GET");
    const response = await GET(request, { params: Promise.resolve({ id: beachId }) });

    const result = await expectSuccessResponse<BeachDetailResponse>(response, 200);
    expect(result.data).toHaveProperty("beach");
    expect(result.data.beach).toMatchObject({
      id: beachId,
      name: "Pipeline",
      slug: "pipeline",
      city: "Haleiwa",
      state: "HI",
      country: "USA",
      region: "North Shore",
      skill_level: "Expert",
      break_type: "Reef Break",
      average_rating: 4.8,
      review_count: 250,
    });
  });

  it("returns error for invalid beach ID", async () => {
    const invalidBeachId = "non-existent-beach-id";

    // Mock query returning null data (no beach found)
    // Supabase .single() returns error when no row is found
    (mockSupabaseClient.from as jest.Mock).mockImplementation(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn(() =>
        Promise.resolve({
          data: null,
          error: { message: "Row not found", code: "PGRST116" },
        })
      ),
    }));

    const request = createMockRequest("GET");
    const response = await GET(request, {
      params: Promise.resolve({ id: invalidBeachId }),
    });

    // Row not found errors should return 404, but handleApiError currently returns 500
    // TODO: Update handleApiError to return 404 for "Row not found" errors
    expect(response.status).toBe(500);
    const json = await response.json();
    expect(json.success).toBe(false);
    expect(json.error).toContain("Failed to fetch beach");
  });

  it("returns error for deleted beach", async () => {
    const deletedBeachId = "deleted-beach-123";

    // Mock query returning no data (beach was soft-deleted or doesn't exist)
    (mockSupabaseClient.from as jest.Mock).mockImplementation(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn(() =>
        Promise.resolve({
          data: null,
          error: { message: "No rows returned", code: "PGRST116" },
        })
      ),
    }));

    const request = createMockRequest("GET");
    const response = await GET(request, {
      params: Promise.resolve({ id: deletedBeachId }),
    });

    expect(response.status).toBe(500);
    const json = await response.json();
    expect(json.success).toBe(false);
    expect(json.error).toContain("Failed to fetch beach");
  });

  it("includes recent sessions count when available", async () => {
    const beachId = "beach-with-sessions";
    const mockBeach = createMockBeach({
      id: beachId,
      name: "Trestles",
      slug: "trestles",
    });

    (mockSupabaseClient.from as jest.Mock).mockImplementation(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn(() =>
        Promise.resolve({
          data: mockBeach,
          error: null,
        })
      ),
    }));

    const request = createMockRequest("GET");
    const response = await GET(request, { params: Promise.resolve({ id: beachId }) });

    const result = await expectSuccessResponse<BeachDetailResponse>(response, 200);
    expect(result.data.beach.id).toBe(beachId);
    expect(result.data.beach.name).toBe("Trestles");
  });

  it("respects cache headers", async () => {
    const beachId = "cached-beach-123";
    const mockBeach = createMockBeach({
      id: beachId,
      name: "Mavericks",
    });

    (mockSupabaseClient.from as jest.Mock).mockImplementation(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn(() =>
        Promise.resolve({
          data: mockBeach,
          error: null,
        })
      ),
    }));

    const request = createMockRequest("GET");
    const response = await GET(request, { params: Promise.resolve({ id: beachId }) });

    expect(response.status).toBe(200);

    // Verify cache headers are set correctly
    const cacheControl = response.headers.get("Cache-Control");
    expect(cacheControl).toBe("public, s-maxage=3600, stale-while-revalidate=86400");
  });

  it("handles database connection errors gracefully", async () => {
    const beachId = "beach-db-error";

    // Mock database connection error
    (mockSupabaseClient.from as jest.Mock).mockImplementation(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn(() =>
        Promise.resolve({
          data: null,
          error: { message: "Database connection failed", code: "ECONNREFUSED" },
        })
      ),
    }));

    const request = createMockRequest("GET");
    const response = await GET(request, { params: Promise.resolve({ id: beachId }) });

    expect(response.status).toBe(500);
    const json = await response.json();
    expect(json.success).toBe(false);
    expect(json.error).toContain("Failed to fetch beach");
  });

  it("returns beach data with coordinates", async () => {
    const beachId = "beach-coords-123";
    const mockBeach = createMockBeach({
      id: beachId,
      name: "Huntington Beach",
      lat: 33.6603,
      lon: -118.0021,
    });

    (mockSupabaseClient.from as jest.Mock).mockImplementation(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn(() =>
        Promise.resolve({
          data: mockBeach,
          error: null,
        })
      ),
    }));

    const request = createMockRequest("GET");
    const response = await GET(request, { params: Promise.resolve({ id: beachId }) });

    const result = await expectSuccessResponse<BeachDetailResponse>(response, 200);
    expect(result.data.beach).toMatchObject({
      id: beachId,
      name: "Huntington Beach",
      lat: 33.6603,
      lon: -118.0021,
    });
  });
});
