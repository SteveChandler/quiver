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
 * Tests for /api/intel/[id]/confirm route
 *
 * Covers:
 * - POST: Confirm an intel post
 * - POST: Validation (UUID, post existence, active status, expiration)
 * - POST: Prevent self-confirmation
 * - POST: Prevent duplicate confirmations
 * - POST: Increment confirmation count
 * - DELETE: Remove confirmation
 * - DELETE: Decrement confirmation count
 * - DELETE: Handle non-existent confirmations
 * - Authentication requirements
 * - Error handling
 */

// =============================================================================
// MOCK SETUP
// =============================================================================

// UUID Constants - must be valid v1-v5 UUIDs (third group starts with 1-5, fourth with 8-b)
const VALID_INTEL_POST_ID = "12345678-1234-1234-8234-123456789012";
const VALID_USER_ID = "87654321-4321-4321-9321-210987654321";
const VALID_OTHER_USER_ID = "11111111-2222-3333-a444-555555555555";
const VALID_CONFIRMATION_ID = "98765432-1234-1234-b234-123456789abc";

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
        const paramsToUse = context?.params || { id: "12345678-1234-1234-8234-123456789012" };
        const authContext = {
          user: { id: "87654321-4321-4321-9321-210987654321" },
          supabase: mockSupabaseClient,
          params: paramsToUse,
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
let DELETE: any;

beforeAll(async () => {
  const route = await import("@/app/api/intel/[id]/confirm/route");
  POST = route.POST;
  DELETE = route.DELETE;
});

// =============================================================================
// TEST HELPERS
// =============================================================================

function mockIntelPost(overrides: any = {}) {
  const defaultPost = {
    id: VALID_INTEL_POST_ID,
    user_id: VALID_OTHER_USER_ID,
    is_active: true,
    expires_at: new Date(Date.now() + 86400000).toISOString(), // 1 day from now
  };
  return { ...defaultPost, ...overrides };
}

function setupMockChain(mockClient: MockSupabaseClient, responses: any[]) {
  let responseIndex = 0;

  mockClient.from.mockImplementation(() => {
    const chain: any = {
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockImplementation(async () => {
        if (responseIndex < responses.length) {
          return responses[responseIndex++];
        }
        return { data: null, error: null };
      }),
    };
    return chain;
  });
}

// =============================================================================
// POST /api/intel/[id]/confirm TESTS
// =============================================================================

describe("POST /api/intel/[id]/confirm", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthenticatedUser(mockSupabaseClient, createMockUser());
  });

  describe("Confirmation Creation", () => {
    it("should confirm an intel post with valid data", async () => {
      const validPostId = VALID_INTEL_POST_ID;
      const intelPost = mockIntelPost();
      const confirmation = {
        id: VALID_CONFIRMATION_ID,
        intel_post_id: validPostId,
        user_id: VALID_USER_ID,
        created_at: new Date().toISOString(),
      };
      const updatedPost = { confirmations_count: 1 };

      setupMockChain(mockSupabaseClient, [
        { data: intelPost, error: null }, // Intel post lookup
        { data: null, error: { code: "PGRST116" } }, // No existing confirmation
        { data: confirmation, error: null }, // Create confirmation
        { data: updatedPost, error: null }, // Updated count
      ]);

      const request = createMockRequest("POST", `http://localhost/api/intel/${validPostId}/confirm`);
      const response = await POST(request, { params: { id: validPostId } });

      const data = await expectSuccessResponse(response, 200);
      expect(data.data.confirmed).toBe(true);
      expect(data.data.confirmations_count).toBe(1);
      expect(data.data.confirmation_id).toBe(VALID_CONFIRMATION_ID);
    });

    it("should increment confirmations count correctly", async () => {
      const intelPost = mockIntelPost();
      const confirmation = {
        id: VALID_CONFIRMATION_ID,
        intel_post_id: VALID_INTEL_POST_ID,
        user_id: VALID_USER_ID,
      };
      const updatedPost = { confirmations_count: 5 }; // Already has 4 confirmations

      setupMockChain(mockSupabaseClient, [
        { data: intelPost, error: null },
        { data: null, error: { code: "PGRST116" } },
        { data: confirmation, error: null },
        { data: updatedPost, error: null },
      ]);

      const request = createMockRequest("POST", `http://localhost/api/intel/${VALID_INTEL_POST_ID}/confirm`);
      const response = await POST(request, { params: { id: VALID_INTEL_POST_ID } });

      const data = await expectSuccessResponse(response, 200);
      expect(data.data.confirmations_count).toBe(5);
    });

    it("should handle confirmation count fetch failure gracefully", async () => {
      const intelPost = mockIntelPost();
      const confirmation = {
        id: VALID_CONFIRMATION_ID,
        intel_post_id: VALID_INTEL_POST_ID,
        user_id: VALID_USER_ID,
      };

      setupMockChain(mockSupabaseClient, [
        { data: intelPost, error: null },
        { data: null, error: { code: "PGRST116" } },
        { data: confirmation, error: null },
        { data: null, error: { message: "Database error" } }, // Count fetch fails
      ]);

      const request = createMockRequest("POST", `http://localhost/api/intel/${VALID_INTEL_POST_ID}/confirm`);
      const response = await POST(request, { params: { id: VALID_INTEL_POST_ID } });

      const data = await expectSuccessResponse(response, 200);
      expect(data.data.confirmed).toBe(true);
      expect(data.data.confirmations_count).toBe(0); // Default to 0 on error
    });
  });

  describe("Validation", () => {
    it("should reject invalid UUID", async () => {
      const request = createMockRequest("POST", "http://localhost/api/intel/not-a-uuid/confirm");
      const response = await POST(request, { params: { id: "not-a-uuid" } });

      await expectErrorResponse(response, 400, "Invalid intel format");
    });

    it("should return 404 when intel post does not exist", async () => {
      setupMockChain(mockSupabaseClient, [
        { data: null, error: { message: "Not found" } },
      ]);

      const request = createMockRequest("POST", `http://localhost/api/intel/${VALID_INTEL_POST_ID}/confirm`);
      const response = await POST(request, { params: { id: VALID_INTEL_POST_ID } });

      await expectErrorResponse(response, 404, "Intel post not found");
    });

    it("should reject inactive intel posts", async () => {
      const inactivePost = mockIntelPost({ is_active: false });

      setupMockChain(mockSupabaseClient, [
        { data: inactivePost, error: null },
      ]);

      const request = createMockRequest("POST", `http://localhost/api/intel/${VALID_INTEL_POST_ID}/confirm`);
      const response = await POST(request, { params: { id: VALID_INTEL_POST_ID } });

      await expectErrorResponse(response, 400, "no longer active");
    });

    it("should reject expired intel posts", async () => {
      const expiredPost = mockIntelPost({
        expires_at: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
      });

      setupMockChain(mockSupabaseClient, [
        { data: expiredPost, error: null },
      ]);

      const request = createMockRequest("POST", `http://localhost/api/intel/${VALID_INTEL_POST_ID}/confirm`);
      const response = await POST(request, { params: { id: VALID_INTEL_POST_ID } });

      await expectErrorResponse(response, 400, "has expired");
    });

    it("should allow confirming posts without expiration date", async () => {
      const noExpiryPost = mockIntelPost({ expires_at: null });
      const confirmation = {
        id: VALID_CONFIRMATION_ID,
        intel_post_id: VALID_INTEL_POST_ID,
        user_id: VALID_USER_ID,
      };

      setupMockChain(mockSupabaseClient, [
        { data: noExpiryPost, error: null },
        { data: null, error: { code: "PGRST116" } },
        { data: confirmation, error: null },
        { data: { confirmations_count: 1 }, error: null },
      ]);

      const request = createMockRequest("POST", `http://localhost/api/intel/${VALID_INTEL_POST_ID}/confirm`);
      const response = await POST(request, { params: { id: VALID_INTEL_POST_ID } });

      await expectSuccessResponse(response, 200);
    });
  });

  describe("Self-Confirmation Prevention", () => {
    it("should prevent users from confirming their own posts", async () => {
      const ownPost = mockIntelPost({ user_id: VALID_USER_ID });

      setupMockChain(mockSupabaseClient, [
        { data: ownPost, error: null },
      ]);

      const request = createMockRequest("POST", `http://localhost/api/intel/${VALID_INTEL_POST_ID}/confirm`);
      const response = await POST(request, { params: { id: VALID_INTEL_POST_ID } });

      await expectErrorResponse(response, 400, "cannot confirm your own");
    });
  });

  describe("Duplicate Prevention", () => {
    it("should prevent duplicate confirmations", async () => {
      const intelPost = mockIntelPost();
      const existingConfirmation = {
        id: "VALID_CONFIRMATION_ID",
        intel_post_id: VALID_INTEL_POST_ID,
        user_id: VALID_USER_ID,
      };

      setupMockChain(mockSupabaseClient, [
        { data: intelPost, error: null },
        { data: existingConfirmation, error: null }, // Existing confirmation found
      ]);

      const request = createMockRequest("POST", `http://localhost/api/intel/${VALID_INTEL_POST_ID}/confirm`);
      const response = await POST(request, { params: { id: VALID_INTEL_POST_ID } });

      await expectErrorResponse(response, 400, "already confirmed");
    });

    it("should handle duplicate check database errors", async () => {
      const intelPost = mockIntelPost();

      setupMockChain(mockSupabaseClient, [
        { data: intelPost, error: null },
        { data: null, error: { message: "Database error", code: "OTHER" } },
      ]);

      const request = createMockRequest("POST", `http://localhost/api/intel/${VALID_INTEL_POST_ID}/confirm`);
      const response = await POST(request, { params: { id: VALID_INTEL_POST_ID } });

      await expectErrorResponse(response, 500);
    });
  });

  describe("Error Handling", () => {
    it("should handle confirmation insertion errors", async () => {
      const intelPost = mockIntelPost();

      setupMockChain(mockSupabaseClient, [
        { data: intelPost, error: null },
        { data: null, error: { code: "PGRST116" } }, // No existing confirmation
        { data: null, error: { message: "Database error" } }, // Insert fails
      ]);

      const request = createMockRequest("POST", `http://localhost/api/intel/${VALID_INTEL_POST_ID}/confirm`);
      const response = await POST(request, { params: { id: VALID_INTEL_POST_ID } });

      await expectErrorResponse(response, 500, "Failed to confirm");
    });
  });
});

// =============================================================================
// DELETE /api/intel/[id]/confirm TESTS
// =============================================================================

describe("DELETE /api/intel/[id]/confirm", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthenticatedUser(mockSupabaseClient, createMockUser());
  });

  describe("Confirmation Removal", () => {
    it("should remove confirmation from intel post", async () => {
      const intelPost = mockIntelPost();
      const deletedConfirmation = {
        id: VALID_CONFIRMATION_ID,
        intel_post_id: VALID_INTEL_POST_ID,
        user_id: VALID_USER_ID,
      };
      const updatedPost = { confirmations_count: 0 };

      setupMockChain(mockSupabaseClient, [
        { data: intelPost, error: null }, // Intel post lookup
        { data: deletedConfirmation, error: null }, // Delete confirmation
        { data: updatedPost, error: null }, // Updated count
      ]);

      const request = createMockRequest("DELETE", `http://localhost/api/intel/${VALID_INTEL_POST_ID}/confirm`);
      const response = await DELETE(request, { params: { id: VALID_INTEL_POST_ID } });

      const data = await expectSuccessResponse(response, 200);
      expect(data.data.confirmed).toBe(false);
      expect(data.data.confirmations_count).toBe(0);
      expect(data.data.confirmation_id).toBe(VALID_CONFIRMATION_ID);
    });

    it("should decrement confirmations count correctly", async () => {
      const intelPost = mockIntelPost();
      const deletedConfirmation = {
        id: VALID_CONFIRMATION_ID,
        intel_post_id: VALID_INTEL_POST_ID,
        user_id: VALID_USER_ID,
      };
      const updatedPost = { confirmations_count: 4 }; // Had 5, now 4

      setupMockChain(mockSupabaseClient, [
        { data: intelPost, error: null },
        { data: deletedConfirmation, error: null },
        { data: updatedPost, error: null },
      ]);

      const request = createMockRequest("DELETE", `http://localhost/api/intel/${VALID_INTEL_POST_ID}/confirm`);
      const response = await DELETE(request, { params: { id: VALID_INTEL_POST_ID } });

      const data = await expectSuccessResponse(response, 200);
      expect(data.data.confirmations_count).toBe(4);
    });

    it("should handle confirmation count fetch failure gracefully", async () => {
      const intelPost = mockIntelPost();
      const deletedConfirmation = {
        id: VALID_CONFIRMATION_ID,
        intel_post_id: VALID_INTEL_POST_ID,
        user_id: VALID_USER_ID,
      };

      setupMockChain(mockSupabaseClient, [
        { data: intelPost, error: null },
        { data: deletedConfirmation, error: null },
        { data: null, error: { message: "Database error" } }, // Count fetch fails
      ]);

      const request = createMockRequest("DELETE", `http://localhost/api/intel/${VALID_INTEL_POST_ID}/confirm`);
      const response = await DELETE(request, { params: { id: VALID_INTEL_POST_ID } });

      const data = await expectSuccessResponse(response, 200);
      expect(data.data.confirmed).toBe(false);
      expect(data.data.confirmations_count).toBe(0); // Default to 0 on error
    });
  });

  describe("Validation", () => {
    it("should reject invalid UUID", async () => {
      const request = createMockRequest("DELETE", "http://localhost/api/intel/not-a-uuid/confirm");
      const response = await DELETE(request, { params: { id: "not-a-uuid" } });

      await expectErrorResponse(response, 400, "Invalid intel format");
    });

    it("should return 404 when intel post does not exist", async () => {
      setupMockChain(mockSupabaseClient, [
        { data: null, error: { message: "Not found" } },
      ]);

      const request = createMockRequest("DELETE", `http://localhost/api/intel/${VALID_INTEL_POST_ID}/confirm`);
      const response = await DELETE(request, { params: { id: VALID_INTEL_POST_ID } });

      await expectErrorResponse(response, 404, "Intel post not found");
    });

    it("should return 400 when user has not confirmed the post", async () => {
      const intelPost = mockIntelPost();

      setupMockChain(mockSupabaseClient, [
        { data: intelPost, error: null },
        { data: null, error: { code: "PGRST116" } }, // No confirmation found
      ]);

      const request = createMockRequest("DELETE", `http://localhost/api/intel/${VALID_INTEL_POST_ID}/confirm`);
      const response = await DELETE(request, { params: { id: VALID_INTEL_POST_ID } });

      await expectErrorResponse(response, 400, "have not confirmed");
    });
  });

  describe("Error Handling", () => {
    it("should handle deletion errors (non-PGRST116)", async () => {
      const intelPost = mockIntelPost();

      setupMockChain(mockSupabaseClient, [
        { data: intelPost, error: null },
        { data: null, error: { message: "Database error", code: "OTHER" } },
      ]);

      const request = createMockRequest("DELETE", `http://localhost/api/intel/${VALID_INTEL_POST_ID}/confirm`);
      const response = await DELETE(request, { params: { id: VALID_INTEL_POST_ID } });

      await expectErrorResponse(response, 500);
    });
  });

  describe("Idempotency", () => {
    it("should not error on multiple deletion attempts (PGRST116)", async () => {
      const intelPost = mockIntelPost();

      setupMockChain(mockSupabaseClient, [
        { data: intelPost, error: null },
        { data: null, error: { code: "PGRST116" } }, // Already deleted
      ]);

      const request = createMockRequest("DELETE", `http://localhost/api/intel/${VALID_INTEL_POST_ID}/confirm`);
      const response = await DELETE(request, { params: { id: VALID_INTEL_POST_ID } });

      await expectErrorResponse(response, 400, "have not confirmed");
    });
  });
});
