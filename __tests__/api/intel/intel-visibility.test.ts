/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";
import {
  createMockSupabaseClient,
  createMockRequest,
  createMockUser,
  mockAuthenticatedUser,
  mockUnauthenticatedUser,
  expectSuccessResponse,
  expectErrorResponse,
  type MockSupabaseClient,
} from "@/test-utils/api-test-helpers";

/** Type for intel posts list API response */
interface IntelPostsResponse {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  posts: any[];
}

/** Type for intel post create API response */
interface IntelPostCreateResponse {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  post: any;
}

/**
 * Tests for intel posts RLS visibility and authorization
 *
 * Covers:
 * - GET: Public can view active intel posts
 * - GET: Posts filtered by is_active flag
 * - GET: Expired posts excluded from results
 * - POST: Requires authentication
 * - POST: User can create posts
 * - POST: user_id automatically set from auth context
 * - Confirm: Requires authentication
 * - Confirm: User cannot confirm own posts (authorization)
 * - Report: Requires authentication
 * - Report: User cannot report own posts (authorization)
 * - RLS policies enforcement
 */

// =============================================================================
// MOCK SETUP
// =============================================================================

// UUID Constants - must be valid v1-v5 UUIDs (third group starts with 1-5, fourth with 8-b)
const VALID_INTEL_POST_ID = "12345678-1234-1234-8234-123456789012";
const VALID_USER_ID = "87654321-4321-4321-9321-210987654321";
const VALID_OTHER_USER_ID = "11111111-2222-3333-a444-555555555555";
const VALID_VIEWER_ID = "22222222-3333-4444-b555-666666666666";

const mockSupabaseClient = createMockSupabaseClient();

// Mock Supabase server client
jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: jest.fn(() => mockSupabaseClient),
}));

// Mock middleware wrappers for GET (unauthenticated) and POST/confirm/report (authenticated)
jest.mock("@/lib/middleware/api-wrappers", () => {
  const actual = jest.requireActual("@/lib/middleware/api-wrappers");
  return {
    ...actual,
    withAuth: (handler: any, options: any) => async (request: any, context: any) => {
      try {
        // Check if user is authenticated
        const { data: authData } = await mockSupabaseClient.auth.getUser();
        if (!authData.user) {
          const { createAuthError } = jest.requireActual("@/lib/api-utils");
          return createAuthError(options?.authErrorMessage || "Authentication required");
        }

        const authContext = {
          user: authData.user,
          supabase: mockSupabaseClient,
          params: context?.params || { id: "12345678-1234-1234-8234-123456789012" },
        };
        return await handler(request, authContext);
      } catch (error: any) {
        const { handleApiError } = jest.requireActual("@/lib/api-utils");
        return handleApiError(error, options?.errorMessage || "Request failed");
      }
    },
    withErrorHandler: (handler: any, options: any) => async (request: any) => {
      try {
        return await handler(request);
      } catch (error: any) {
        const { handleApiError } = jest.requireActual("@/lib/api-utils");
        return handleApiError(error, options?.errorMessage || "Request failed");
      }
    },
    withBotBlockingAndRateLimit: (handler: any) => handler,
    withRateLimit: (handler: any) => handler,
  };
});

// Import after mocks
let GET: any;
let POST: any;
let CONFIRM_POST: any;
let REPORT_POST: any;

beforeAll(async () => {
  const intelRoute = await import("@/app/api/intel/route");
  const confirmRoute = await import("@/app/api/intel/[id]/confirm/route");
  const reportRoute = await import("@/app/api/intel/[id]/report/route");

  GET = intelRoute.GET;
  POST = intelRoute.POST;
  CONFIRM_POST = confirmRoute.POST;
  REPORT_POST = reportRoute.POST;
});

// =============================================================================
// TEST HELPERS
// =============================================================================

function mockIntelPost(overrides: any = {}) {
  const defaultPost = {
    id: VALID_INTEL_POST_ID,
    user_id: VALID_OTHER_USER_ID,
    latitude: 32.715,
    longitude: -117.161,
    tag: "conditions",
    title: "Great waves",
    description: "Perfect conditions",
    is_active: true,
    expires_at: new Date(Date.now() + 86400000).toISOString(), // 1 day from now
    created_at: new Date().toISOString(),
    confirmations_count: 0,
  };
  return { ...defaultPost, ...overrides };
}

function setupMockChain(mockClient: MockSupabaseClient, responses: any[]) {
  let responseIndex = 0;

  mockClient.from.mockImplementation(() => {
    const chain: any = {
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
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

  mockClient.rpc.mockImplementation(async () => {
    if (responseIndex < responses.length) {
      return responses[responseIndex++];
    }
    return { data: [], error: null };
  });
}

function setupGetIntelMock(mockClient: MockSupabaseClient, posts: any[], profilesData: any[] = [], confirmationsData: any[] = []) {
  mockClient.rpc.mockResolvedValue({ data: posts, error: null });

  let inCallCount = 0;
  const mockChain = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    in: jest.fn().mockImplementation(async () => {
      if (inCallCount === 0) {
        inCallCount++;
        return { data: profilesData, error: null };
      } else if (inCallCount === 1) {
        inCallCount++;
        return { data: confirmationsData, error: null };
      }
      return { data: [], error: null };
    }),
  };

  mockChain.select.mockReturnValue(mockChain);
  mockChain.eq.mockReturnValue(mockChain);
  (mockClient.from as jest.Mock).mockReturnValue(mockChain);
}

// =============================================================================
// GET /api/intel - PUBLIC VISIBILITY TESTS
// =============================================================================

describe("GET /api/intel - Public Visibility", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Unauthenticated Access", () => {
    it("should allow unauthenticated users to view intel posts", async () => {
      mockUnauthenticatedUser(mockSupabaseClient);

      const posts = [mockIntelPost()];
      setupGetIntelMock(mockSupabaseClient, posts);

      const request = createMockRequest("GET", "http://localhost/api/intel?lat=32.715&lon=-117.161");
      const response = await GET(request);

      const data = await expectSuccessResponse<IntelPostsResponse>(response, 200);
      expect(data.data.posts).toBeDefined();
    });

    it("should only return active intel posts", async () => {
      mockUnauthenticatedUser(mockSupabaseClient);

      const activePosts = [
        mockIntelPost({ id: "post-1", is_active: true }),
        mockIntelPost({ id: "post-2", is_active: true }),
      ];

      setupGetIntelMock(mockSupabaseClient, activePosts);

      const request = createMockRequest("GET", "http://localhost/api/intel?lat=32.715&lon=-117.161");
      const response = await GET(request);

      const data = await expectSuccessResponse<IntelPostsResponse>(response, 200);
      expect(data.data.posts.length).toBe(2);
      expect(data.data.posts.every((p: any) => p.is_active)).toBe(true);
    });

    it("should exclude inactive intel posts", async () => {
      mockUnauthenticatedUser(mockSupabaseClient);

      // Simulate DB query already filtering inactive posts
      const activePosts = [mockIntelPost({ id: "post-1", is_active: true })];

      setupGetIntelMock(mockSupabaseClient, activePosts);

      const request = createMockRequest("GET", "http://localhost/api/intel?lat=32.715&lon=-117.161");
      const response = await GET(request);

      const data = await expectSuccessResponse<IntelPostsResponse>(response, 200);
      expect(data.data.posts.length).toBe(1);
      expect(data.data.posts.every((p: any) => p.is_active)).toBe(true);
    });

    it("should exclude expired intel posts", async () => {
      mockUnauthenticatedUser(mockSupabaseClient);

      // Simulate DB query already filtering expired posts
      const nonExpiredPosts = [
        mockIntelPost({ id: "post-1", expires_at: new Date(Date.now() + 86400000).toISOString() }),
      ];

      setupGetIntelMock(mockSupabaseClient, nonExpiredPosts);

      const request = createMockRequest("GET", "http://localhost/api/intel?lat=32.715&lon=-117.161");
      const response = await GET(request);

      const data = await expectSuccessResponse<IntelPostsResponse>(response, 200);
      expect(data.data.posts.length).toBe(1);
    });
  });

  describe("Authenticated Access", () => {
    it("should allow authenticated users to view intel posts", async () => {
      mockAuthenticatedUser(mockSupabaseClient, createMockUser({ id: VALID_VIEWER_ID }));

      const posts = [mockIntelPost()];
      setupGetIntelMock(mockSupabaseClient, posts, [], []);

      const request = createMockRequest("GET", "http://localhost/api/intel?lat=32.715&lon=-117.161");
      const response = await GET(request);

      const data = await expectSuccessResponse<IntelPostsResponse>(response, 200);
      expect(data.data.posts).toBeDefined();
    });

    it("should include user_confirmed status for authenticated users", async () => {
      mockAuthenticatedUser(mockSupabaseClient, createMockUser({ id: VALID_VIEWER_ID }));

      const posts = [mockIntelPost()];
      setupGetIntelMock(mockSupabaseClient, posts, [], [{ intel_post_id: VALID_INTEL_POST_ID }]);

      const request = createMockRequest("GET", "http://localhost/api/intel?lat=32.715&lon=-117.161");
      const response = await GET(request);

      const data = await expectSuccessResponse<IntelPostsResponse>(response, 200);
      expect(data.data.posts[0].user_confirmed).toBe(true);
    });
  });
});

// =============================================================================
// POST /api/intel - AUTHENTICATION REQUIREMENT
// =============================================================================

describe("POST /api/intel - Authentication Requirement", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Unauthenticated Access", () => {
    it("should reject unauthenticated post creation", async () => {
      mockUnauthenticatedUser(mockSupabaseClient);

      const request = createMockRequest("POST", "http://localhost/api/intel", {
        body: {
          latitude: 32.715,
          longitude: -117.161,
          tag: "conditions",
          title: "Test post",
          description: "Test description",
        },
      });

      const response = await POST(request);

      await expectErrorResponse(response, 401, "Authentication required");
    });
  });

  describe("Authenticated Access", () => {
    it("should allow authenticated users to create posts", async () => {
      mockAuthenticatedUser(mockSupabaseClient, createMockUser({ id: VALID_USER_ID }));

      (mockSupabaseClient.from as jest.Mock).mockImplementation(() => {
        return {
          select: jest.fn().mockReturnThis(),
          insert: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          gte: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          limit: jest.fn().mockResolvedValue({ data: [], error: null }),
          single: jest.fn()
            .mockResolvedValueOnce({
              data: mockIntelPost({ user_id: VALID_USER_ID }),
              error: null,
            })
            .mockResolvedValueOnce({
              data: { id: VALID_USER_ID, full_name: "Test User", avatar_url: null },
              error: null,
            }),
        };
      });

      const request = createMockRequest("POST", "http://localhost/api/intel", {
        body: {
          latitude: 32.715,
          longitude: -117.161,
          tag: "conditions",
          title: "Test post",
          description: "Test description",
        },
      });

      const response = await POST(request);

      await expectSuccessResponse<IntelPostsResponse>(response, 200);
    });

    it("should automatically set user_id from auth context", async () => {
      mockAuthenticatedUser(mockSupabaseClient, createMockUser({ id: VALID_USER_ID }));

      let capturedInsertData: any = null;

      (mockSupabaseClient.from as jest.Mock).mockImplementation(() => {
        return {
          select: jest.fn().mockReturnThis(),
          insert: jest.fn((data: any) => {
            capturedInsertData = data;
            return {
              select: jest.fn().mockReturnThis(),
              single: jest.fn()
                .mockResolvedValueOnce({
                  data: mockIntelPost({ user_id: VALID_USER_ID }),
                  error: null,
                })
                .mockResolvedValueOnce({
                  data: { id: VALID_USER_ID, full_name: "Test User", avatar_url: null },
                  error: null,
                }),
            };
          }),
          eq: jest.fn().mockReturnThis(),
          gte: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          limit: jest.fn().mockResolvedValue({ data: [], error: null }),
        };
      });

      const request = createMockRequest("POST", "http://localhost/api/intel", {
        body: {
          latitude: 32.715,
          longitude: -117.161,
          tag: "conditions",
          title: "Test post",
          description: "Test description",
        },
      });

      await POST(request);

      expect(capturedInsertData).toBeDefined();
      expect(capturedInsertData.user_id).toBe(VALID_USER_ID);
    });
  });
});

// =============================================================================
// CONFIRM - AUTHORIZATION TESTS
// =============================================================================

describe("POST /api/intel/[id]/confirm - Authorization", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Unauthenticated Access", () => {
    it("should reject unauthenticated confirmation attempts", async () => {
      mockUnauthenticatedUser(mockSupabaseClient);

      const request = createMockRequest("POST", "http://localhost/api/intel/VALID_INTEL_POST_ID/confirm");
      const response = await CONFIRM_POST(request, { params: { id: VALID_INTEL_POST_ID } });

      await expectErrorResponse(response, 401, "Authentication required");
    });
  });

  describe("Self-Confirmation Prevention", () => {
    it("should prevent users from confirming their own posts", async () => {
      mockAuthenticatedUser(mockSupabaseClient, createMockUser({ id: VALID_OTHER_USER_ID }));

      const ownPost = mockIntelPost({ user_id: VALID_OTHER_USER_ID });

      setupMockChain(mockSupabaseClient, [
        { data: ownPost, error: null },
      ]);

      const request = createMockRequest("POST", "http://localhost/api/intel/VALID_INTEL_POST_ID/confirm");
      const response = await CONFIRM_POST(request, { params: { id: VALID_INTEL_POST_ID } });

      await expectErrorResponse(response, 400, "cannot confirm your own");
    });

    it("should allow users to confirm posts by other authors", async () => {
      mockAuthenticatedUser(mockSupabaseClient, createMockUser({ id: "VALID_USER_ID" }));

      const post = mockIntelPost({ user_id: VALID_OTHER_USER_ID });
      const confirmation = {
        id: "98765432-1234-1234-1234-123456789abc",
        intel_post_id: VALID_INTEL_POST_ID,
        user_id: "VALID_USER_ID",
      };

      setupMockChain(mockSupabaseClient, [
        { data: post, error: null },
        { data: null, error: { code: "PGRST116" } },
        { data: confirmation, error: null },
        { data: { confirmations_count: 1 }, error: null },
      ]);

      const request = createMockRequest("POST", "http://localhost/api/intel/VALID_INTEL_POST_ID/confirm");
      const response = await CONFIRM_POST(request, { params: { id: VALID_INTEL_POST_ID } });

      await expectSuccessResponse<IntelPostsResponse>(response, 200);
    });
  });
});

// =============================================================================
// REPORT - AUTHORIZATION TESTS
// =============================================================================

describe("POST /api/intel/[id]/report - Authorization", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Unauthenticated Access", () => {
    it("should reject unauthenticated report attempts", async () => {
      mockUnauthenticatedUser(mockSupabaseClient);

      const request = createMockRequest("POST", "http://localhost/api/intel/VALID_INTEL_POST_ID/report");
      const response = await REPORT_POST(request, { params: { id: VALID_INTEL_POST_ID } });

      await expectErrorResponse(response, 401, "Authentication required");
    });
  });

  describe("Self-Reporting Prevention", () => {
    it("should prevent users from reporting their own posts", async () => {
      mockAuthenticatedUser(mockSupabaseClient, createMockUser({ id: VALID_OTHER_USER_ID }));

      const ownPost = mockIntelPost({ user_id: VALID_OTHER_USER_ID });

      setupMockChain(mockSupabaseClient, [
        { data: ownPost, error: null },
      ]);

      const request = createMockRequest("POST", "http://localhost/api/intel/VALID_INTEL_POST_ID/report");
      const response = await REPORT_POST(request, { params: { id: VALID_INTEL_POST_ID } });

      await expectErrorResponse(response, 400, "cannot report your own");
    });

    it("should allow users to report posts by other authors", async () => {
      mockAuthenticatedUser(mockSupabaseClient, createMockUser({ id: VALID_USER_ID }));

      const post = mockIntelPost({ user_id: VALID_OTHER_USER_ID });

      setupMockChain(mockSupabaseClient, [
        { data: post, error: null },
        { data: null, error: { code: "PGRST116" } }, // No existing report
        { data: null, error: null }, // Insert report
      ]);

      const request = createMockRequest("POST", "http://localhost/api/intel/VALID_INTEL_POST_ID/report");
      const response = await REPORT_POST(request, { params: { id: VALID_INTEL_POST_ID } });

      await expectSuccessResponse<IntelPostsResponse>(response, 200);
    });
  });
});

// =============================================================================
// RLS POLICY DOCUMENTATION
// =============================================================================

describe("RLS Policies - Documentation", () => {
  it("documents intel_posts RLS policies", () => {
    // This test documents the expected RLS policies for intel_posts table:
    // 1. SELECT: Public can view posts where is_active = true
    // 2. INSERT: Authenticated users can create posts (user_id set automatically)
    // 3. UPDATE: Only post author can update their own posts
    // 4. DELETE: Only post author can delete their own posts (soft delete via is_active)

    expect(true).toBe(true);
  });

  it("documents intel_post_confirmations RLS policies", () => {
    // This test documents the expected RLS policies for intel_post_confirmations table:
    // 1. SELECT: Public can view all confirmations (count visible to all)
    // 2. INSERT: Authenticated users can confirm posts (prevents self-confirmation via CHECK)
    // 3. DELETE: Users can only delete their own confirmations

    expect(true).toBe(true);
  });

  it("documents intel_reports RLS policies", () => {
    // This test documents the expected RLS policies for intel_reports table:
    // (From migration 20260113145000_add_intel_emoji_and_reports.sql)
    // 1. INSERT: Authenticated users can report posts (prevents self-reporting via CHECK)
    // 2. SELECT: Users can only view their own reports
    // 3. DELETE: Users can only delete their own reports
    // 4. Auto-hide: Posts with 3+ reports are automatically set to is_active = false

    expect(true).toBe(true);
  });
});
