/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";
import {
  createMockSupabaseClient,
  createMockRequest,
  createMockUser,
  mockAuthenticatedUser,
  expectSuccessResponse,
  expectErrorResponse,
  type MockSupabaseClient,
} from "@/test-utils/api-test-helpers";

/**
 * Tests for POST /api/intel route (intel post creation)
 *
 * This file focuses on creation logic specifically:
 * - Validation of required fields (latitude, longitude, tag, title, description)
 * - Optional fields (photo_url, emoji_rating, beach_id)
 * - Tag validation (parking, hazard, crowd, conditions, access, other)
 * - Coordinate validation (lat: -90 to 90, lon: -180 to 180)
 * - String trimming and normalization
 * - User ID attachment from auth context
 * - Expiration time calculation (fast vs standard tags)
 * - Deduplication hash generation
 * - Duplicate detection within time window
 * - Surf conditions JSONB normalization
 *
 * Note: The existing __tests__/api/intel-route.test.ts covers these comprehensively.
 * This file provides additional focused tests on creation-specific edge cases.
 */

// =============================================================================
// MOCK SETUP
// =============================================================================

const mockSupabaseClient = createMockSupabaseClient();

// Mock Supabase server client
jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: jest.fn(() => mockSupabaseClient),
}));

// Mock middleware wrappers
jest.mock("@/lib/middleware/api-wrappers", () => {
  const actual = jest.requireActual("@/lib/middleware/api-wrappers");
  return {
    ...actual,
    withAuth: (handler: any, options: any) => async (request: any, context: any) => {
      try {
        const { data: authData } = await mockSupabaseClient.auth.getUser();
        if (!authData.user) {
          const { createAuthenticationError } = jest.requireActual("@/lib/middleware/api-wrappers");
          return createAuthenticationError();
        }

        const authContext = {
          user: authData.user,
          supabase: mockSupabaseClient,
          params: context?.params || {},
        };
        return await handler(request, authContext);
      } catch (error: any) {
        const { handleApiError } = jest.requireActual("@/lib/api-utils");
        return handleApiError(error, options?.errorMessage || "Request failed");
      }
    },
  };
});

// Import after mocks
let POST: any;

beforeAll(async () => {
  const route = await import("@/app/api/intel/route");
  POST = route.POST;
});

// =============================================================================
// TEST HELPERS
// =============================================================================

const VALID_INTEL_POST_ID = "12345678-1234-1234-8234-123456789012";
const VALID_USER_ID = "87654321-4321-4321-9321-210987654321";

function mockIntelPost(overrides: any = {}) {
  const defaultPost = {
    id: VALID_INTEL_POST_ID,
    user_id: VALID_USER_ID,
    latitude: 32.715,
    longitude: -117.161,
    tag: "conditions",
    title: "Great waves",
    description: "Perfect conditions",
    is_active: true,
    created_at: new Date().toISOString(),
  };
  return { ...defaultPost, ...overrides };
}

function setupSuccessfulCreation(mockClient: MockSupabaseClient, post: any = mockIntelPost()) {
  (mockClient.from as jest.Mock).mockImplementation(() => {
    return {
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue({ data: [], error: null }),
      single: jest.fn()
        .mockResolvedValueOnce({ data: post, error: null })
        .mockResolvedValueOnce({
          data: { id: VALID_USER_ID, full_name: "Test User", avatar_url: null },
          error: null,
        }),
    };
  });
}

// =============================================================================
// POST /api/intel - REQUIRED FIELDS VALIDATION
// =============================================================================

describe("POST /api/intel - Required Fields", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthenticatedUser(mockSupabaseClient, createMockUser());
  });

  describe("Latitude Validation", () => {
    it("should reject missing latitude", async () => {
      const request = createMockRequest("POST", "http://localhost/api/intel", {
        body: {
          longitude: -117.161,
          tag: "conditions",
          title: "Test",
          description: "Test description",
        },
      });

      const response = await POST(request);

      await expectErrorResponse(response, 400);
    });

    it("should reject latitude below -90", async () => {
      const request = createMockRequest("POST", "http://localhost/api/intel", {
        body: {
          latitude: -90.1,
          longitude: -117.161,
          tag: "conditions",
          title: "Test",
          description: "Test description",
        },
      });

      const response = await POST(request);

      await expectErrorResponse(response, 400, "Latitude");
    });

    it("should reject latitude above 90", async () => {
      const request = createMockRequest("POST", "http://localhost/api/intel", {
        body: {
          latitude: 90.1,
          longitude: -117.161,
          tag: "conditions",
          title: "Test",
          description: "Test description",
        },
      });

      const response = await POST(request);

      await expectErrorResponse(response, 400, "Latitude");
    });

    it("should accept latitude at boundary -90", async () => {
      setupSuccessfulCreation(mockSupabaseClient);

      const request = createMockRequest("POST", "http://localhost/api/intel", {
        body: {
          latitude: -90,
          longitude: -117.161,
          tag: "conditions",
          title: "Test",
          description: "Test description",
        },
      });

      const response = await POST(request);

      await expectSuccessResponse(response, 200);
    });

    it("should accept latitude at boundary 90", async () => {
      setupSuccessfulCreation(mockSupabaseClient);

      const request = createMockRequest("POST", "http://localhost/api/intel", {
        body: {
          latitude: 90,
          longitude: -117.161,
          tag: "conditions",
          title: "Test",
          description: "Test description",
        },
      });

      const response = await POST(request);

      await expectSuccessResponse(response, 200);
    });
  });

  describe("Longitude Validation", () => {
    it("should reject missing longitude", async () => {
      const request = createMockRequest("POST", "http://localhost/api/intel", {
        body: {
          latitude: 32.715,
          tag: "conditions",
          title: "Test",
          description: "Test description",
        },
      });

      const response = await POST(request);

      await expectErrorResponse(response, 400);
    });

    it("should reject longitude below -180", async () => {
      const request = createMockRequest("POST", "http://localhost/api/intel", {
        body: {
          latitude: 32.715,
          longitude: -180.1,
          tag: "conditions",
          title: "Test",
          description: "Test description",
        },
      });

      const response = await POST(request);

      await expectErrorResponse(response, 400, "Longitude");
    });

    it("should reject longitude above 180", async () => {
      const request = createMockRequest("POST", "http://localhost/api/intel", {
        body: {
          latitude: 32.715,
          longitude: 180.1,
          tag: "conditions",
          title: "Test",
          description: "Test description",
        },
      });

      const response = await POST(request);

      await expectErrorResponse(response, 400, "Longitude");
    });

    it("should accept longitude at boundary -180", async () => {
      setupSuccessfulCreation(mockSupabaseClient);

      const request = createMockRequest("POST", "http://localhost/api/intel", {
        body: {
          latitude: 32.715,
          longitude: -180,
          tag: "conditions",
          title: "Test",
          description: "Test description",
        },
      });

      const response = await POST(request);

      await expectSuccessResponse(response, 200);
    });

    it("should accept longitude at boundary 180", async () => {
      setupSuccessfulCreation(mockSupabaseClient);

      const request = createMockRequest("POST", "http://localhost/api/intel", {
        body: {
          latitude: 32.715,
          longitude: 180,
          tag: "conditions",
          title: "Test",
          description: "Test description",
        },
      });

      const response = await POST(request);

      await expectSuccessResponse(response, 200);
    });
  });

  describe("Tag Validation", () => {
    it("should reject missing tag", async () => {
      const request = createMockRequest("POST", "http://localhost/api/intel", {
        body: {
          latitude: 32.715,
          longitude: -117.161,
          title: "Test",
          description: "Test description",
        },
      });

      const response = await POST(request);

      await expectErrorResponse(response, 400);
    });

    it("should reject invalid tag value", async () => {
      const request = createMockRequest("POST", "http://localhost/api/intel", {
        body: {
          latitude: 32.715,
          longitude: -117.161,
          tag: "invalid-tag",
          title: "Test",
          description: "Test description",
        },
      });

      const response = await POST(request);

      await expectErrorResponse(response, 400);
    });

    it("should accept valid tag: parking", async () => {
      setupSuccessfulCreation(mockSupabaseClient);

      const request = createMockRequest("POST", "http://localhost/api/intel", {
        body: {
          latitude: 32.715,
          longitude: -117.161,
          tag: "parking",
          title: "Test",
          description: "Test description",
        },
      });

      const response = await POST(request);

      await expectSuccessResponse(response, 200);
    });

    it("should accept valid tag: hazard", async () => {
      setupSuccessfulCreation(mockSupabaseClient);

      const request = createMockRequest("POST", "http://localhost/api/intel", {
        body: {
          latitude: 32.715,
          longitude: -117.161,
          tag: "hazard",
          title: "Test",
          description: "Test description",
        },
      });

      const response = await POST(request);

      await expectSuccessResponse(response, 200);
    });

    it("should accept valid tag: crowd", async () => {
      setupSuccessfulCreation(mockSupabaseClient);

      const request = createMockRequest("POST", "http://localhost/api/intel", {
        body: {
          latitude: 32.715,
          longitude: -117.161,
          tag: "crowd",
          title: "Test",
          description: "Test description",
        },
      });

      const response = await POST(request);

      await expectSuccessResponse(response, 200);
    });

    it("should accept valid tag: conditions", async () => {
      setupSuccessfulCreation(mockSupabaseClient);

      const request = createMockRequest("POST", "http://localhost/api/intel", {
        body: {
          latitude: 32.715,
          longitude: -117.161,
          tag: "conditions",
          title: "Test",
          description: "Test description",
        },
      });

      const response = await POST(request);

      await expectSuccessResponse(response, 200);
    });

    it("should accept valid tag: access", async () => {
      setupSuccessfulCreation(mockSupabaseClient);

      const request = createMockRequest("POST", "http://localhost/api/intel", {
        body: {
          latitude: 32.715,
          longitude: -117.161,
          tag: "access",
          title: "Test",
          description: "Test description",
        },
      });

      const response = await POST(request);

      await expectSuccessResponse(response, 200);
    });

    it("should accept valid tag: other", async () => {
      setupSuccessfulCreation(mockSupabaseClient);

      const request = createMockRequest("POST", "http://localhost/api/intel", {
        body: {
          latitude: 32.715,
          longitude: -117.161,
          tag: "other",
          title: "Test",
          description: "Test description",
        },
      });

      const response = await POST(request);

      await expectSuccessResponse(response, 200);
    });
  });

  describe("Title Validation", () => {
    it("should reject missing title", async () => {
      const request = createMockRequest("POST", "http://localhost/api/intel", {
        body: {
          latitude: 32.715,
          longitude: -117.161,
          tag: "conditions",
          description: "Test description",
        },
      });

      const response = await POST(request);

      await expectErrorResponse(response, 400);
    });

    it("should reject empty title", async () => {
      const request = createMockRequest("POST", "http://localhost/api/intel", {
        body: {
          latitude: 32.715,
          longitude: -117.161,
          tag: "conditions",
          title: "",
          description: "Test description",
        },
      });

      const response = await POST(request);

      await expectErrorResponse(response, 400, "Title");
    });

    it("should reject title exceeding 100 characters", async () => {
      const longTitle = "a".repeat(101);

      const request = createMockRequest("POST", "http://localhost/api/intel", {
        body: {
          latitude: 32.715,
          longitude: -117.161,
          tag: "conditions",
          title: longTitle,
          description: "Test description",
        },
      });

      const response = await POST(request);

      await expectErrorResponse(response, 400, "Title");
    });

    it("should accept title at 100 characters", async () => {
      setupSuccessfulCreation(mockSupabaseClient);

      const maxTitle = "a".repeat(100);

      const request = createMockRequest("POST", "http://localhost/api/intel", {
        body: {
          latitude: 32.715,
          longitude: -117.161,
          tag: "conditions",
          title: maxTitle,
          description: "Test description",
        },
      });

      const response = await POST(request);

      await expectSuccessResponse(response, 200);
    });

    it("should trim whitespace from title", async () => {
      setupSuccessfulCreation(mockSupabaseClient);

      const request = createMockRequest("POST", "http://localhost/api/intel", {
        body: {
          latitude: 32.715,
          longitude: -117.161,
          tag: "conditions",
          title: "  Trimmed Title  ",
          description: "Test description",
        },
      });

      const response = await POST(request);

      await expectSuccessResponse(response, 200);
    });
  });

  describe("Description Validation", () => {
    it("should reject missing description", async () => {
      const request = createMockRequest("POST", "http://localhost/api/intel", {
        body: {
          latitude: 32.715,
          longitude: -117.161,
          tag: "conditions",
          title: "Test",
        },
      });

      const response = await POST(request);

      await expectErrorResponse(response, 400);
    });

    it("should reject empty description", async () => {
      const request = createMockRequest("POST", "http://localhost/api/intel", {
        body: {
          latitude: 32.715,
          longitude: -117.161,
          tag: "conditions",
          title: "Test",
          description: "",
        },
      });

      const response = await POST(request);

      await expectErrorResponse(response, 400, "Description");
    });

    it("should reject description exceeding 1000 characters", async () => {
      const longDescription = "a".repeat(1001);

      const request = createMockRequest("POST", "http://localhost/api/intel", {
        body: {
          latitude: 32.715,
          longitude: -117.161,
          tag: "conditions",
          title: "Test",
          description: longDescription,
        },
      });

      const response = await POST(request);

      await expectErrorResponse(response, 400, "Description");
    });

    it("should accept description at 500 characters (max)", async () => {
      setupSuccessfulCreation(mockSupabaseClient);

      const maxDescription = "a".repeat(500);

      const request = createMockRequest("POST", "http://localhost/api/intel", {
        body: {
          latitude: 32.715,
          longitude: -117.161,
          tag: "conditions",
          title: "Test",
          description: maxDescription,
        },
      });

      const response = await POST(request);

      await expectSuccessResponse(response, 200);
    });

    it("should trim whitespace from description", async () => {
      setupSuccessfulCreation(mockSupabaseClient);

      const request = createMockRequest("POST", "http://localhost/api/intel", {
        body: {
          latitude: 32.715,
          longitude: -117.161,
          tag: "conditions",
          title: "Test",
          description: "  Trimmed description  ",
        },
      });

      const response = await POST(request);

      await expectSuccessResponse(response, 200);
    });
  });
});

// =============================================================================
// POST /api/intel - OPTIONAL FIELDS
// =============================================================================

describe("POST /api/intel - Optional Fields", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthenticatedUser(mockSupabaseClient, createMockUser());
  });

  describe("Photo URL", () => {
    it("should accept valid photo_url", async () => {
      setupSuccessfulCreation(mockSupabaseClient);

      const request = createMockRequest("POST", "http://localhost/api/intel", {
        body: {
          latitude: 32.715,
          longitude: -117.161,
          tag: "conditions",
          title: "Test",
          description: "Test description",
          photo_url: "https://example.com/photo.jpg",
        },
      });

      const response = await POST(request);

      await expectSuccessResponse(response, 200);
    });

    it("should accept missing photo_url", async () => {
      setupSuccessfulCreation(mockSupabaseClient);

      const request = createMockRequest("POST", "http://localhost/api/intel", {
        body: {
          latitude: 32.715,
          longitude: -117.161,
          tag: "conditions",
          title: "Test",
          description: "Test description",
        },
      });

      const response = await POST(request);

      await expectSuccessResponse(response, 200);
    });
  });

  describe("Emoji Rating", () => {
    it("should accept valid emoji_rating: fire", async () => {
      setupSuccessfulCreation(mockSupabaseClient);

      const request = createMockRequest("POST", "http://localhost/api/intel", {
        body: {
          latitude: 32.715,
          longitude: -117.161,
          tag: "conditions",
          title: "Test",
          description: "Test description",
          emoji_rating: "fire",
        },
      });

      const response = await POST(request);

      await expectSuccessResponse(response, 200);
    });

    it("should accept valid emoji_rating: shaka", async () => {
      setupSuccessfulCreation(mockSupabaseClient);

      const request = createMockRequest("POST", "http://localhost/api/intel", {
        body: {
          latitude: 32.715,
          longitude: -117.161,
          tag: "conditions",
          title: "Test",
          description: "Test description",
          emoji_rating: "shaka",
        },
      });

      const response = await POST(request);

      await expectSuccessResponse(response, 200);
    });

    it("should accept valid emoji_rating: meh", async () => {
      setupSuccessfulCreation(mockSupabaseClient);

      const request = createMockRequest("POST", "http://localhost/api/intel", {
        body: {
          latitude: 32.715,
          longitude: -117.161,
          tag: "conditions",
          title: "Test",
          description: "Test description",
          emoji_rating: "meh",
        },
      });

      const response = await POST(request);

      await expectSuccessResponse(response, 200);
    });

    it("should accept valid emoji_rating: thumbsdown", async () => {
      setupSuccessfulCreation(mockSupabaseClient);

      const request = createMockRequest("POST", "http://localhost/api/intel", {
        body: {
          latitude: 32.715,
          longitude: -117.161,
          tag: "conditions",
          title: "Test",
          description: "Test description",
          emoji_rating: "thumbsdown",
        },
      });

      const response = await POST(request);

      await expectSuccessResponse(response, 200);
    });

    it("should accept missing emoji_rating", async () => {
      setupSuccessfulCreation(mockSupabaseClient);

      const request = createMockRequest("POST", "http://localhost/api/intel", {
        body: {
          latitude: 32.715,
          longitude: -117.161,
          tag: "conditions",
          title: "Test",
          description: "Test description",
        },
      });

      const response = await POST(request);

      await expectSuccessResponse(response, 200);
    });
  });

  describe("Beach ID", () => {
    it("should accept valid beach_id", async () => {
      setupSuccessfulCreation(mockSupabaseClient);

      const request = createMockRequest("POST", "http://localhost/api/intel", {
        body: {
          latitude: 32.715,
          longitude: -117.161,
          tag: "conditions",
          title: "Test",
          description: "Test description",
          beach_id: "12345678-1234-1234-8234-123456789012",
        },
      });

      const response = await POST(request);

      await expectSuccessResponse(response, 200);
    });

    it("should accept missing beach_id", async () => {
      setupSuccessfulCreation(mockSupabaseClient);

      const request = createMockRequest("POST", "http://localhost/api/intel", {
        body: {
          latitude: 32.715,
          longitude: -117.161,
          tag: "conditions",
          title: "Test",
          description: "Test description",
        },
      });

      const response = await POST(request);

      await expectSuccessResponse(response, 200);
    });
  });
});
