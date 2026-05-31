/**
 * @jest-environment node
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  createMockSupabaseClient,
  createMockRequest,
  createMockUser,
  mockAuthenticatedUser,
  expectSuccessResponse,
  expectErrorResponse,
  type MockSupabaseClient,
} from "@/test-utils/api-test-helpers";

/** Type for intel vote API response */
interface IntelVoteResponse {
  vote_type: "helpful" | "off" | "confirmed" | null;
  helpful_count: number;
  off_count: number;
  confirmed_count: number;
}

/**
 * Tests for /api/intel/[id]/vote route
 *
 * Covers:
 * - POST: Cast a new vote on an intel post (insert)
 * - POST: Idempotent no-op when same vote type cast again
 * - POST: Change vote type (update)
 * - POST: Validation (UUID, vote_type, body, post existence, active, expiry, own post)
 * - DELETE: Remove a vote from an intel post
 * - DELETE: Validation (UUID, post existence)
 * - Authentication requirements for both methods
 */

// =============================================================================
// MOCK SETUP
// =============================================================================

// UUID Constants - must be valid v1-v5 UUIDs (fourth group starts with 8-b)
const VALID_INTEL_POST_ID = "12345678-1234-1234-8234-123456789012";
const VALID_USER_ID = "87654321-4321-4321-9321-210987654321";
const VALID_OTHER_USER_ID = "11111111-2222-3333-a444-555555555555";
const VALID_VOTE_ID = "aaaabbbb-1111-2222-a333-444455556666";

const mockSupabaseClient = createMockSupabaseClient();

// Mock Supabase server client
jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: jest.fn(() => mockSupabaseClient),
}));

// Mock middleware wrappers — mirrors the pattern in intel-create.test.ts so
// unauthenticated tests return 401 while authenticated tests receive the mock
// supabase client.
jest.mock("@/lib/middleware/api-wrappers", () => {
  const actual = jest.requireActual("@/lib/middleware/api-wrappers");
  return {
    ...actual,
    withAuth: (handler: any, options: any) => async (request: any, context: any) => {
      try {
        const { data: authData } = await mockSupabaseClient.auth.getUser();
        if (!authData.user) {
          const { createAuthError } = jest.requireActual("@/lib/api-utils");
          return createAuthError("Authentication required");
        }

        const paramsToUse = context?.params || { id: VALID_INTEL_POST_ID };
        const authContext = {
          user: authData.user,
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
  const route = await import("@/app/api/intel/[id]/vote/route");
  POST = route.POST;
  DELETE = route.DELETE;
});

// =============================================================================
// TEST HELPERS
// =============================================================================

function mockIntelPost(overrides: any = {}) {
  const defaultPost = {
    id: VALID_INTEL_POST_ID,
    user_id: VALID_OTHER_USER_ID, // Different from the authenticated user
    is_active: true,
    expires_at: new Date(Date.now() + 86400000).toISOString(), // 1 day from now
  };
  return { ...defaultPost, ...overrides };
}

function mockCounts(overrides: any = {}) {
  return {
    helpful_count: 1,
    off_count: 0,
    confirmed_count: 0,
    ...overrides,
  };
}

/**
 * Sets up a sequential mock chain on the supabase client.
 *
 * The vote route uses two terminal query patterns:
 *   - `.single()` / `.maybeSingle()` — each call consumes the next response
 *   - direct await on a mutating chain (insert/update/delete) — these do NOT
 *     consume a response slot because `.then()` is not defined on the chain;
 *     JavaScript awaits the chain object directly, yielding undefined for any
 *     missing properties (i.e. `error` is undefined → falsy → no error thrown).
 *
 * So only `.single()` and `.maybeSingle()` calls advance the response index.
 * Callers should omit entries for insert/update/delete operations unless they
 * need to simulate an error on those operations (handled separately).
 */
function setupMockChain(mockClient: MockSupabaseClient, responses: any[]) {
  let responseIndex = 0;

  mockClient.from.mockImplementation(() => {
    const chain: any = {
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockImplementation(async () => {
        if (responseIndex < responses.length) {
          return responses[responseIndex++];
        }
        return { data: null, error: null };
      }),
      maybeSingle: jest.fn().mockImplementation(async () => {
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
// POST /api/intel/[id]/vote TESTS
// =============================================================================

describe("POST /api/intel/[id]/vote", () => {
  it("uses the shared API wrapper module for validation helpers", () => {
    const source = readFileSync(
      join(process.cwd(), "app/api/intel/[id]/vote/route.ts"),
      "utf8"
    );

    expect(source).not.toMatch(/from\s+["']@\/lib\/api-utils["']/);
    expect(source).toMatch(/from\s+["']@\/lib\/middleware\/api-wrappers["']/);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthenticatedUser(
      mockSupabaseClient,
      createMockUser({ id: VALID_USER_ID })
    );
  });

  describe("Authentication", () => {
    it("returns 401 for unauthenticated requests", async () => {
      // Override auth to simulate no user
      mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
        data: { user: null },
        error: null,
      });

      const request = createMockRequest(
        "POST",
        `http://localhost/api/intel/${VALID_INTEL_POST_ID}/vote`,
        { body: { vote_type: "helpful" } }
      );
      const response = await POST(request, {
        params: { id: VALID_INTEL_POST_ID },
      });

      expect(response.status).toBe(401);
      await expectErrorResponse(response, 401);
    });
  });

  describe("Validation", () => {
    it("returns 400 for invalid UUID", async () => {
      const request = createMockRequest(
        "POST",
        "http://localhost/api/intel/not-a-uuid/vote",
        { body: { vote_type: "helpful" } }
      );
      const response = await POST(request, { params: { id: "not-a-uuid" } });

      expect(response.status).toBe(400);
      await expectErrorResponse(response, 400, "Invalid intel format");
    });

    it("returns 400 for invalid vote_type", async () => {
      const request = createMockRequest(
        "POST",
        `http://localhost/api/intel/${VALID_INTEL_POST_ID}/vote`,
        { body: { vote_type: "bogus" } }
      );
      const response = await POST(request, {
        params: { id: VALID_INTEL_POST_ID },
      });

      expect(response.status).toBe(400);
      await expectErrorResponse(response, 400);
    });

    it("returns 400 for missing body", async () => {
      const request = createMockRequest(
        "POST",
        `http://localhost/api/intel/${VALID_INTEL_POST_ID}/vote`
        // No body
      );
      const response = await POST(request, {
        params: { id: VALID_INTEL_POST_ID },
      });

      expect(response.status).toBe(400);
      await expectErrorResponse(response, 400);
    });

    it("returns 404 when post does not exist", async () => {
      setupMockChain(mockSupabaseClient, [
        { data: null, error: { message: "Not found" } }, // post lookup fails
      ]);

      const request = createMockRequest(
        "POST",
        `http://localhost/api/intel/${VALID_INTEL_POST_ID}/vote`,
        { body: { vote_type: "helpful" } }
      );
      const response = await POST(request, {
        params: { id: VALID_INTEL_POST_ID },
      });

      expect(response.status).toBe(404);
      await expectErrorResponse(response, 404, "Intel post not found");
    });

    it("returns 400 when post is inactive", async () => {
      setupMockChain(mockSupabaseClient, [
        { data: mockIntelPost({ is_active: false }), error: null },
      ]);

      const request = createMockRequest(
        "POST",
        `http://localhost/api/intel/${VALID_INTEL_POST_ID}/vote`,
        { body: { vote_type: "helpful" } }
      );
      const response = await POST(request, {
        params: { id: VALID_INTEL_POST_ID },
      });

      expect(response.status).toBe(400);
      await expectErrorResponse(response, 400, "no longer active");
    });

    it("returns 400 when post has expired", async () => {
      setupMockChain(mockSupabaseClient, [
        {
          data: mockIntelPost({
            expires_at: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
          }),
          error: null,
        },
      ]);

      const request = createMockRequest(
        "POST",
        `http://localhost/api/intel/${VALID_INTEL_POST_ID}/vote`,
        { body: { vote_type: "helpful" } }
      );
      const response = await POST(request, {
        params: { id: VALID_INTEL_POST_ID },
      });

      expect(response.status).toBe(400);
      await expectErrorResponse(response, 400, "has expired");
    });

    it("returns 400 when voting on own post", async () => {
      // Post belongs to the same user that is authenticated
      setupMockChain(mockSupabaseClient, [
        { data: mockIntelPost({ user_id: VALID_USER_ID }), error: null },
      ]);

      const request = createMockRequest(
        "POST",
        `http://localhost/api/intel/${VALID_INTEL_POST_ID}/vote`,
        { body: { vote_type: "helpful" } }
      );
      const response = await POST(request, {
        params: { id: VALID_INTEL_POST_ID },
      });

      expect(response.status).toBe(400);
      await expectErrorResponse(response, 400, "cannot vote on your own");
    });
  });

  describe("Casting a New Vote (insert)", () => {
    it("returns 200 with counts when casting a new vote", async () => {
      const counts = mockCounts({ helpful_count: 1 });

      // Response queue: single() post-lookup → maybeSingle() no-existing-vote → single() counts
      // insert() is awaited directly (no .then on chain) so does NOT consume a slot
      setupMockChain(mockSupabaseClient, [
        { data: mockIntelPost(), error: null }, // post lookup
        { data: null, error: null },             // no existing vote (maybeSingle)
        { data: counts, error: null },           // updated counts
      ]);

      const request = createMockRequest(
        "POST",
        `http://localhost/api/intel/${VALID_INTEL_POST_ID}/vote`,
        { body: { vote_type: "helpful" } }
      );
      const response = await POST(request, {
        params: { id: VALID_INTEL_POST_ID },
      });

      const data =
        await expectSuccessResponse<IntelVoteResponse>(response, 200);
      expect(data.data.vote_type).toBe("helpful");
      expect(data.data.helpful_count).toBe(1);
      expect(data.data.off_count).toBe(0);
      expect(data.data.confirmed_count).toBe(0);
    });

    it("returns 200 with correct counts for 'off' vote type", async () => {
      const counts = mockCounts({ off_count: 2 });

      setupMockChain(mockSupabaseClient, [
        { data: mockIntelPost(), error: null },
        { data: null, error: null },
        { data: counts, error: null },
      ]);

      const request = createMockRequest(
        "POST",
        `http://localhost/api/intel/${VALID_INTEL_POST_ID}/vote`,
        { body: { vote_type: "off" } }
      );
      const response = await POST(request, {
        params: { id: VALID_INTEL_POST_ID },
      });

      const data =
        await expectSuccessResponse<IntelVoteResponse>(response, 200);
      expect(data.data.vote_type).toBe("off");
      expect(data.data.off_count).toBe(2);
    });
  });

  describe("Idempotent Same Vote Type (no-op)", () => {
    it("returns 200 with current counts when casting the same vote type again", async () => {
      const existingVote = {
        id: VALID_VOTE_ID,
        vote_type: "helpful", // Same as what we're voting
      };
      const counts = mockCounts({ helpful_count: 3 });

      // Response queue: single() post-lookup → maybeSingle() existing-vote → single() counts
      setupMockChain(mockSupabaseClient, [
        { data: mockIntelPost(), error: null }, // post lookup
        { data: existingVote, error: null },    // existing vote found (same type)
        { data: counts, error: null },           // current counts returned
      ]);

      const request = createMockRequest(
        "POST",
        `http://localhost/api/intel/${VALID_INTEL_POST_ID}/vote`,
        { body: { vote_type: "helpful" } }
      );
      const response = await POST(request, {
        params: { id: VALID_INTEL_POST_ID },
      });

      const data =
        await expectSuccessResponse<IntelVoteResponse>(response, 200);
      expect(data.data.vote_type).toBe("helpful");
      expect(data.data.helpful_count).toBe(3);
    });

    it("returns 500 when count fetch fails in no-op path", async () => {
      const existingVote = {
        id: VALID_VOTE_ID,
        vote_type: "off",
      };

      setupMockChain(mockSupabaseClient, [
        { data: mockIntelPost(), error: null },
        { data: existingVote, error: null },
        { data: null, error: { message: "DB error" } }, // counts fetch fails — selectIntelVoteCounts throws
      ]);

      const request = createMockRequest(
        "POST",
        `http://localhost/api/intel/${VALID_INTEL_POST_ID}/vote`,
        { body: { vote_type: "off" } }
      );
      const response = await POST(request, {
        params: { id: VALID_INTEL_POST_ID },
      });

      expect(response.status).toBe(500);
      await expectErrorResponse(response, 500);
    });
  });

  describe("Changing Vote Type (update)", () => {
    it("returns 200 with updated counts when changing vote type", async () => {
      const existingVote = {
        id: VALID_VOTE_ID,
        vote_type: "helpful", // Previously voted helpful
      };
      const updatedCounts = mockCounts({ helpful_count: 0, off_count: 1 });

      // Response queue: single() post-lookup → maybeSingle() existing-vote → single() updated-counts
      // update() is awaited directly (no .then on chain) so does NOT consume a slot
      setupMockChain(mockSupabaseClient, [
        { data: mockIntelPost(), error: null }, // post lookup
        { data: existingVote, error: null },    // existing vote (different type)
        { data: updatedCounts, error: null },   // updated counts
      ]);

      const request = createMockRequest(
        "POST",
        `http://localhost/api/intel/${VALID_INTEL_POST_ID}/vote`,
        { body: { vote_type: "off" } } // Changing from helpful → off
      );
      const response = await POST(request, {
        params: { id: VALID_INTEL_POST_ID },
      });

      const data =
        await expectSuccessResponse<IntelVoteResponse>(response, 200);
      expect(data.data.vote_type).toBe("off");
      expect(data.data.helpful_count).toBe(0);
      expect(data.data.off_count).toBe(1);
    });

    it("returns 200 when changing from 'off' to 'confirmed'", async () => {
      const existingVote = {
        id: VALID_VOTE_ID,
        vote_type: "off",
      };
      const updatedCounts = mockCounts({ confirmed_count: 2 });

      setupMockChain(mockSupabaseClient, [
        { data: mockIntelPost(), error: null },
        { data: existingVote, error: null },
        { data: updatedCounts, error: null },
      ]);

      const request = createMockRequest(
        "POST",
        `http://localhost/api/intel/${VALID_INTEL_POST_ID}/vote`,
        { body: { vote_type: "confirmed" } }
      );
      const response = await POST(request, {
        params: { id: VALID_INTEL_POST_ID },
      });

      const data =
        await expectSuccessResponse<IntelVoteResponse>(response, 200);
      expect(data.data.vote_type).toBe("confirmed");
      expect(data.data.confirmed_count).toBe(2);
    });
  });
});

// =============================================================================
// DELETE /api/intel/[id]/vote TESTS
// =============================================================================

describe("DELETE /api/intel/[id]/vote", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthenticatedUser(
      mockSupabaseClient,
      createMockUser({ id: VALID_USER_ID })
    );
  });

  describe("Authentication", () => {
    it("returns 401 for unauthenticated requests", async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
        data: { user: null },
        error: null,
      });

      const request = createMockRequest(
        "DELETE",
        `http://localhost/api/intel/${VALID_INTEL_POST_ID}/vote`
      );
      const response = await DELETE(request, {
        params: { id: VALID_INTEL_POST_ID },
      });

      expect(response.status).toBe(401);
      await expectErrorResponse(response, 401);
    });
  });

  describe("Validation", () => {
    it("returns 400 for invalid UUID", async () => {
      const request = createMockRequest(
        "DELETE",
        "http://localhost/api/intel/not-a-uuid/vote"
      );
      const response = await DELETE(request, { params: { id: "not-a-uuid" } });

      expect(response.status).toBe(400);
      await expectErrorResponse(response, 400, "Invalid intel format");
    });

    it("returns 404 when post does not exist", async () => {
      setupMockChain(mockSupabaseClient, [
        { data: null, error: { message: "Not found" } },
      ]);

      const request = createMockRequest(
        "DELETE",
        `http://localhost/api/intel/${VALID_INTEL_POST_ID}/vote`
      );
      const response = await DELETE(request, {
        params: { id: VALID_INTEL_POST_ID },
      });

      expect(response.status).toBe(404);
      await expectErrorResponse(response, 404, "Intel post not found");
    });
  });

  describe("Vote Removal", () => {
    it("returns 200 with null vote_type when removing a vote", async () => {
      const counts = mockCounts({ helpful_count: 0 });

      // Response queue: single() post-lookup → single() updated-counts
      // delete() is awaited directly (no .then on chain) so does NOT consume a slot
      setupMockChain(mockSupabaseClient, [
        { data: { id: VALID_INTEL_POST_ID }, error: null }, // post lookup
        { data: counts, error: null },                        // updated counts
      ]);

      const request = createMockRequest(
        "DELETE",
        `http://localhost/api/intel/${VALID_INTEL_POST_ID}/vote`
      );
      const response = await DELETE(request, {
        params: { id: VALID_INTEL_POST_ID },
      });

      const data =
        await expectSuccessResponse<IntelVoteResponse>(response, 200);
      expect(data.data.vote_type).toBeNull();
      expect(data.data.helpful_count).toBe(0);
      expect(data.data.off_count).toBe(0);
      expect(data.data.confirmed_count).toBe(0);
    });

    it("returns 500 when count fetch fails after deletion", async () => {
      setupMockChain(mockSupabaseClient, [
        { data: { id: VALID_INTEL_POST_ID }, error: null },
        { data: null, error: { message: "DB error" } }, // counts fetch fails — selectIntelVoteCounts throws
      ]);

      const request = createMockRequest(
        "DELETE",
        `http://localhost/api/intel/${VALID_INTEL_POST_ID}/vote`
      );
      const response = await DELETE(request, {
        params: { id: VALID_INTEL_POST_ID },
      });

      expect(response.status).toBe(500);
      await expectErrorResponse(response, 500);
    });
  });
});
